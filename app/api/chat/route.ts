import { createOpenAI } from '@ai-sdk/openai';
import { getSession } from '@auth0/nextjs-auth0';
import { streamText, createDataStreamResponse, generateText, simulateReadableStream, Message } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import { Tiktoken } from "tiktoken/lite";

import { apiEndpoint, apiKey, imgGenFnModel, DEFAULT_SYSTEM_PROMPT } from '@/app/config/api';
import { defaultModel } from '@/app/config/models';
import { withSessionAuth } from '@/lib/auth';
import { getAvailableModelsForUser } from '@/lib/models';
import { checkTokenLimit, incrementTokenUsageWithMultiplier, getClientIP, getRateLimitConfigForUser, storeConversationTokens } from '@/lib/rate-limit';
import { LiteLLMService } from '@/lib/services/litellm-service';
import { generateImageTool } from '@/lib/tools';

if (!apiKey) {
  throw new Error('API_KEY is not set in environment variables');
}

function createOpenAIWithRateLimit(apiKey: string) {
  return createOpenAI({
    baseURL: apiEndpoint,
    apiKey: apiKey,
    compatibility: 'compatible',
    // Inject reasoning content into the stream
    fetch: async (url, options) => {
      // Inject required kwargs for DeepSeek V3.1 to enable thinking. Workaround for old ai sdk version.
      const body = JSON.parse(options!.body as string || '{}');
      if (body.model.includes('deepseek-ai/DeepSeek-V3.') || body.model === 'DeepSeek-V3.1') {
        options!.body = JSON.stringify({
          ...body,
          chat_template_kwargs: {
            thinking: true
          }
        });
      }

      const response = await fetch(url, options);

      // Only process streaming responses
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        let reasoningBuffer = '';
        let isFirstContent = true;

        const transformStream = new TransformStream({
          transform(chunk, controller) {
            const chunkText = new TextDecoder().decode(chunk);
            const lines = chunkText.split('\n');
            const modifiedLines: string[] = [];

            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(line.slice(6));

                  // Capture reasoning content
                  if (data.choices?.[0]?.delta?.reasoning_content) {
                    reasoningBuffer += data.choices[0].delta.reasoning_content;
                  }

                  // Inject reasoning before first content
                  if (data.choices?.[0]?.delta?.content && isFirstContent && reasoningBuffer) {
                    isFirstContent = false;

                    const reasoningChunk = {
                      ...data,
                      choices: [{
                        ...data.choices[0],
                        delta: {
                          content: `<think>\n${reasoningBuffer}\n</think>\n\n`,
                          role: data.choices[0].delta.role
                        }
                      }]
                    };

                    modifiedLines.push(`data: ${JSON.stringify(reasoningChunk)}`);
                    modifiedLines.push('');
                  }

                  modifiedLines.push(line);

                } catch (e) {
                  modifiedLines.push(line);
                }
              } else {
                modifiedLines.push(line);
              }
            }
            
            controller.enqueue(new TextEncoder().encode(modifiedLines.join('\n')));
          }
        });

        return new Response(response.body?.pipeThrough(transformStream), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }

      return response;
    }
  });
}

// Create custom OpenAI provider instance with reasoning injection
const openai = createOpenAIWithRateLimit(apiKey);

// Define the handler function to be wrapped with authentication
async function handlePostRequest(req: NextRequest) {
  // Check Auth0 authentication first
  const session = await getSession(req, NextResponse.next());
  const isAuthenticated = !!session?.user;
  
  // Get user-specific API key for authenticated users
  let userApiKey: string | null = null;
  let openaiClient = openai; // Default to admin client
  
  if (isAuthenticated && session?.user?.sub) {
    userApiKey = await LiteLLMService.getApiKey(session.user.sub);
    
    // Create user-specific OpenAI client if user has API key
    if (userApiKey) {
      openaiClient = createOpenAIWithRateLimit(userApiKey);
    }
  }
  
  // Apply rate limiting to all users (unless ACCESS_TOKEN is required)
  const isAccessTokenRequired = process.env.ACCESS_TOKEN && process.env.ACCESS_TOKEN.trim() !== '';
  let rateLimitIdentifier: string | null = null;
  
  const shouldApplyRateLimit = !isAccessTokenRequired;
  
  if (shouldApplyRateLimit) {
    // Determine user ID for database-driven rate limiting
    const userId = isAuthenticated && session?.user?.sub ? session.user.sub : null;
    
    // Use Auth0 user ID for authenticated users, IP for anonymous
    rateLimitIdentifier = userId || getClientIP(req);
    
    const rateLimitConfig = await getRateLimitConfigForUser(userId);
    const rateLimit = await checkTokenLimit(rateLimitIdentifier!, rateLimitConfig);
    
    if (rateLimit.blocked) {
      const message = isAuthenticated 
        ? `You've reached your usage limit for this time period. Please try again later.`
        : `You've reached your usage limit for this time period. Sign in for higher limits.`;
      
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message,
          resetTime: rateLimit.resetTime.toISOString(),
          requiresVerification: false,
          tier: isAuthenticated ? 'authenticated' : 'anonymous'
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-TokenLimit-Reset': Math.ceil(rateLimit.resetTime.getTime() / 1000).toString(),
          },
        }
      );
    }
  }
  
  // Extract the `messages` and `model` from the body of the request
  const body = await req.json();
  const { messages, system, context } = body;
  // Ensure temperature and topP are numbers
  const temperature = body.temperature ? Number(body.temperature) : undefined;
  const topP = body.topP ? Number(body.topP) : undefined;
  let { model } = body;
  // Helper to normalize model format
  const normalizeModel = (model: any) => ({
    model_id: model.model_id || model.id,
    token_limit: model.token_limit || model.tokenLimit,
    temperature: model.temperature,
    top_p: model.top_p,
  });

  // Get user ID for model access validation (authenticated users vs anonymous)
  const userId = isAuthenticated && session?.user?.sub ? session.user.sub : null;
  
  // Get available models for this specific user (considers tier access)
  const allModels = await getAvailableModelsForUser(userId);
  const dbModel = allModels.find(m => m.model_id === model);
  
  // Validate that user has access to this model
  if (!dbModel) {
    return new Response(
      JSON.stringify({
        error: 'Model not available',
        message: `The model "${model}" is not available for your account tier. Please select a different model.`,
        available_models: allModels.map(m => ({ id: m.model_id, name: m.name }))
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  const selectedModel = normalizeModel(dbModel);

  const encoding = new Tiktoken(
    cl100k_base.bpe_ranks,
    cl100k_base.special_tokens,
    cl100k_base.pat_str
  );

  const prompt_tokens = encoding.encode(system || "You are a helpful assistant.");

  let tokenCount = prompt_tokens.length;
  let messagesToSend: Message[] = [];

  if (context) {
    for (const file of context) {
      const tokens = encoding.encode(file.content);
      if (tokenCount + tokens.length + 1000 > (selectedModel?.token_limit || 128000)) {
        return new Response('Your files have too much content for this model. Please remove some files or try a different model.', {
          status: 400,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }
      tokenCount += tokens.length;
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const tokens = encoding.encode(message.content);

    if (tokenCount + tokens.length + 1000 > (selectedModel?.token_limit || 128000)) {
      // If we haven't added any messages yet, we need to include at least the last message
      // even if it's too long, to avoid empty messages array
      if (messagesToSend.length === 0) {
        const tokenLimit = selectedModel?.token_limit || 128000;
        const availableTokens = tokenLimit - tokenCount - 1000;
        const errorMessage = "[Message too long for this model. Please try with a shorter message or a different model.]";

        if (availableTokens > 100) { // Ensure we have enough tokens for a meaningful truncation
          // Calculate how much content we can actually fit
          const maxContentTokens = availableTokens - 50; // Reserve tokens for truncation notice
          const truncatedContent = message.content.slice(0, Math.floor(maxContentTokens * 3.5)); // Rough estimate: 1 token ≈ 3.5 chars
          messagesToSend = [{
            ...message,
            content: truncatedContent + "\n\n[Message truncated due to length]"
          }];
        } else {
          // If we can't fit even a truncated message, return an error response immediately
          return new Response(errorMessage, {
            status: 400,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
        }
      }
      break;
    }
    tokenCount += tokens.length;
    messagesToSend = [message, ...messagesToSend];
  }

  if (context) {
    for (const file of context) {
      messagesToSend.unshift({
        id: Math.random().toString(36).substring(2, 15),
        role: 'user',
        content: `This is the content of the file ${file.name}: ${file.content}`
      });
    }
  }

  // Store conversation token count for rate limit status display
  if (shouldApplyRateLimit && rateLimitIdentifier) {
    try {
      await storeConversationTokens(
        rateLimitIdentifier, 
        tokenCount, 
        selectedModel?.token_limit || 128000
      );
    } catch (error) {
      console.error('Failed to store conversation tokens:', error);
    }
  }

  encoding.free();

  if (model === 'AkashGen') {
    // Skip the image generation tool if it fails
    try {
      // Send the message to a small model first to determine if it's an image request
      const smallModelId = imgGenFnModel || 'Meta-Llama-3-3-70B-Instruct';
      const smallResponse = await generateText({
        model: openaiClient(smallModelId),
        messages: messagesToSend.slice(-3),
        system: "Always enhance the user's image request by creating a descriptive image prompt in order to generate a detailed, high-quality image with Stable Diffusion 3.5. Only use the generateImage tool if the user asks for an image. To decide if the user asked for an image, messages but focus on the last one. When asked to generate images, you will use the generateImage tool.",
        tools: {
          generateImage: generateImageTool
        },
        temperature: temperature || selectedModel?.temperature,
        topP: topP || selectedModel?.top_p
      });

      // If the small model used the image generation tool, return the result
      if (smallResponse.toolResults.length > 0) {
        const imageResult = smallResponse.toolResults[0].result;
        
        // Track token usage for image generation
        if (shouldApplyRateLimit && rateLimitIdentifier && smallResponse.usage) {
          const totalTokens = (smallResponse.usage.promptTokens || 0) + (smallResponse.usage.completionTokens || 0);
          if (totalTokens > 0) {
            try {
              const userId = isAuthenticated && session?.user?.sub ? session.user.sub : null;
              const rateLimitConfig = await getRateLimitConfigForUser(userId);
              // Use model from body for token multiplier calculation
              await incrementTokenUsageWithMultiplier(rateLimitIdentifier, totalTokens, model, rateLimitConfig);
            } catch (error) {
              console.error('Failed to track token usage for image generation:', error);
            }
          }
        }
        
        return new Response(
          simulateReadableStream({
            initialDelayInMs: 0, // Delay before the first chunk
            chunkDelayInMs: 0, // Delay between chunks
            chunks: [
              `0:"<image_generation> jobId='${imageResult.jobId}' prompt='${String(imageResult.prompt).replace(/'/g, "\\'")}' negative='${String(imageResult.negative || '').replace(/'/g, "\\'")}'</image_generation>"\n`,
              `e:{"finishReason":"stop","usage":{"promptTokens":20,"completionTokens":50},"isContinued":false}\n`,
              `d:{"finishReason":"stop","usage":{"promptTokens":20,"completionTokens":50}}\n`,
            ],
          }).pipeThrough(new TextEncoderStream()),
          {
            status: 200,
            headers: {
              'X-Vercel-AI-Data-Stream': 'v1',
              'Content-Type': 'text/plain; charset=utf-8',
            },
          },
        );
      }

      // If the small model didn't use the image generation tool, use the default model for the rest of the conversation
      model = 'Meta-Llama-3-3-70B-Instruct';
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Error generating image',
          message: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }

  return createDataStreamResponse({
    execute: async dataStream => {
      const apiModelId = dbModel.api_id || dbModel.model_id || defaultModel;

      const result = streamText({
        model: openaiClient(apiModelId),
        messages: messagesToSend,
        system: system || DEFAULT_SYSTEM_PROMPT,
        temperature: temperature || selectedModel?.temperature,
        topP: topP || selectedModel?.top_p,

      });
      
      // Track token usage for rate limiting
      result.usage.then(async (usage) => {
        if (shouldApplyRateLimit && rateLimitIdentifier && usage) {
          const totalTokens = (usage.promptTokens || 0) + (usage.completionTokens || 0);
          if (totalTokens > 0) {
            try {
              const userId = isAuthenticated && session?.user?.sub ? session.user.sub : null;
              const rateLimitConfig = await getRateLimitConfigForUser(userId);
              // Use model from body for token multiplier calculation
              await incrementTokenUsageWithMultiplier(rateLimitIdentifier, totalTokens, model, rateLimitConfig);
            } catch (error) {
              console.error('Failed to track token usage:', error);
            }
          }
        }
      }).catch(error => {
        console.error('Failed to get usage data:', error);
      });
      
      result.mergeIntoDataStream(dataStream);
    },
    onError: error => {
      // Handle specific OpenAI errors
      if (error instanceof Error) {
        if (error.name === 'OpenAIError') {
          // Return user-friendly error messages for common OpenAI errors
          if (error.message.includes('Rate limit')) {
            return 'Rate limit exceeded. Please try again later.';
          } else if (error.message.includes('Invalid API key')) {
            return 'Authentication failed. Please check your API key.';
          } else if (error.message.includes('context length')) {
            return 'The conversation is too long. Please start a new chat.';
          }
        }
        return error.message;
      }
      return String(error);
    }
  });
}

// Export the wrapped handler
export const POST = withSessionAuth(handlePostRequest);
