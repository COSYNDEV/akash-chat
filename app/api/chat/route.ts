import { createOpenAI } from '@ai-sdk/openai';
import { getSession } from '@auth0/nextjs-auth0';
import { streamText, createDataStreamResponse, generateText, simulateReadableStream, Message } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import { Tiktoken } from "tiktoken/lite";

import { apiEndpoint, apiKey, imgGenFnModel, DEFAULT_SYSTEM_PROMPT } from '@/app/config/api';
import { defaultModel, models, createConfigToApiIdMap } from '@/app/config/models';
import { withAuth } from '@/lib/auth';
import { getAvailableModels } from '@/lib/models';
import { checkTokenLimit, incrementTokenUsage, getClientIP } from '@/lib/rate-limit';
import { LiteLLMService } from '@/lib/services/litellm-service';
import { generateImageTool } from '@/lib/tools';

if (!apiKey) {
  throw new Error('API_KEY is not set in environment variables');
}

// Create custom OpenAI provider instance with reasoning injection
const openai = createOpenAI({
  baseURL: apiEndpoint,
  apiKey: apiKey,
  compatibility: 'compatible',
  // Inject reasoning content into the stream
  fetch: async (url, options) => {
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
      openaiClient = createOpenAI({
        baseURL: apiEndpoint,
        apiKey: userApiKey,
        compatibility: 'compatible'
      });
    }
  }
  
  // Check rate limit for unauthenticated users AND authenticated users without API keys
  const isAccessTokenRequired = process.env.ACCESS_TOKEN && process.env.ACCESS_TOKEN.trim() !== '';
  let clientIP: string | null = null;
  
  const shouldApplyRateLimit = (!isAuthenticated && !isAccessTokenRequired) || 
                               (isAuthenticated && !userApiKey);
  
  if (shouldApplyRateLimit) {
    clientIP = getClientIP(req);
    const rateLimit = await checkTokenLimit(clientIP);
    
    if (rateLimit.blocked) {
      const message = isAuthenticated 
        ? `You've reached your token limit of ${rateLimit.limit} tokens per 4 hours. Please verify your email and accept marketing consent for unlimited access.`
        : `You've reached your token limit of ${rateLimit.limit} tokens per 4 hours. Please try again later or sign in for extended access.`;
        
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message,
          limit: rateLimit.limit,
          used: rateLimit.used,
          remaining: rateLimit.remaining,
          resetTime: rateLimit.resetTime.toISOString(),
          requiresVerification: isAuthenticated, // Flag to indicate user needs verification
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-TokenLimit-Limit': rateLimit.limit.toString(),
            'X-TokenLimit-Remaining': rateLimit.remaining.toString(),
            'X-TokenLimit-Reset': Math.ceil(rateLimit.resetTime.getTime() / 1000).toString(),
          },
        }
      );
    }
  }
  
  // Extract the `messages` and `model` from the body of the request
  const body = await req.json();
  const { messages, system, temperature, topP, context } = body;
  let { model } = body;
  // Get available models from cache or API
  const allModels = await getAvailableModels();
  const selectedModel = allModels.find(m => m.id === model) || models.find(m => m.id === defaultModel);

  const encoding = new Tiktoken(
    cl100k_base.bpe_ranks,
    cl100k_base.special_tokens,
    cl100k_base.pat_str
  );

  const prompt_tokens = encoding.encode(system || DEFAULT_SYSTEM_PROMPT);
  let inputTokenCount = prompt_tokens.length;
  let tokenCount = inputTokenCount;
  let messagesToSend: Message[] = [];

  if (context) {
    for (const file of context) {
      const tokens = encoding.encode(file.content);
      if (tokenCount + tokens.length + 1000 > (selectedModel?.tokenLimit || 128000)) {
        return new Response('Your files have too much content for this model. Please remove some files or try a different model.', {
          status: 400,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }
      tokenCount += tokens.length;
      inputTokenCount += tokens.length;
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const tokens = encoding.encode(message.content);

    if (tokenCount + tokens.length + 1000 > (selectedModel?.tokenLimit || 128000)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Token limit reached: ${tokenCount + tokens.length}`);
      }
      // If we haven't added any messages yet, we need to include at least the last message
      // even if it's too long, to avoid empty messages array
      if (messagesToSend.length === 0) {
        const tokenLimit = selectedModel?.tokenLimit || 128000;
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
    inputTokenCount += tokens.length;
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

  if (model === 'AkashGen') {
    // Skip the image generation tool if it fails
    try {
      // Send the message to a small model first to determine if it's an image request
      const smallModelId = imgGenFnModel || 'Meta-Llama-3-3-70B-Instruct';
      
      // Calculate input tokens for image generation request
      const imageMessages = messagesToSend.slice(-3);
      const imageSystemPrompt = "Always enhance the user's image request by creating a descriptive image prompt in order to generate a detailed, high-quality image with Stable Diffusion 3.5. Only use the generateImage tool if the user asks for an image. To decide if the user asked for an image, messages but focus on the last one. When asked to generate images, you will use the generateImage tool.";
      
      let imageInputTokens = encoding.encode(imageSystemPrompt).length;
      for (const msg of imageMessages) {
        imageInputTokens += encoding.encode(msg.content).length;
      }
      
      const smallResponse = await generateText({
        model: openaiClient(smallModelId),
        messages: imageMessages,
        system: imageSystemPrompt,
        tools: {
          generateImage: generateImageTool
        },
        temperature: temperature || selectedModel?.temperature,
        topP: topP || selectedModel?.top_p
      });

      // If the small model used the image generation tool, return the result
      if (smallResponse.toolResults.length > 0) {
        const imageResult = smallResponse.toolResults[0].result;
        
        // Track token usage for image generation with manual counting fallback
        if (shouldApplyRateLimit && clientIP) {
          let inputTokens = imageInputTokens; // Our manual count
          let outputTokens = 0;
          
          // Try to use API usage data first, fallback to manual counting
          if (smallResponse.usage && smallResponse.usage.promptTokens && smallResponse.usage.completionTokens) {
            inputTokens = smallResponse.usage.promptTokens;
            outputTokens = smallResponse.usage.completionTokens;
          } else {
            // Manual token counting fallback - estimate output based on tool result
            const toolOutput = JSON.stringify(imageResult);
            outputTokens = encoding.encode(toolOutput).length;
          }
          
          const totalTokens = inputTokens + outputTokens;
          
          if (totalTokens > 0) {
            try {
              await incrementTokenUsage(clientIP, totalTokens);
            } catch (error) {
              console.error('Failed to track token usage for image generation:', error);
            }
          } else {
            console.warn('No token usage data available for image generation rate limiting');
          }
        }
        
        // Clean up encoding before returning
        encoding.free();
        
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
      // Clean up encoding on error
      encoding.free();
      
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

  // Track output content for manual token counting
  let outputContent = '';
  let tokensAlreadyCounted = false;
  
  // Function to count and track tokens
  const countAndTrackTokens = async (forceCount = false) => {
    if (tokensAlreadyCounted && !forceCount) {return;}
    tokensAlreadyCounted = true;
    
    if (shouldApplyRateLimit && clientIP) {
      const inputTokens = inputTokenCount;
      let outputTokens = 0;
      
      outputTokens = encoding.encode(outputContent).length;
      
      const totalTokens = inputTokens + outputTokens;
      
      if (totalTokens > 0) {
        try {
          await incrementTokenUsage(clientIP, totalTokens);
        } catch (error) {
          console.error('Failed to track token usage:', error);
        }
      }
    }
  };

  return createDataStreamResponse({
    execute: async dataStream => {      
      // Map config model ID to API model ID if needed
      const configToApiIdMap = createConfigToApiIdMap();
      const apiModelId = configToApiIdMap.get(model || defaultModel) || model || defaultModel;
      
      const result = streamText({
        model: openai(apiModelId),
        messages: messagesToSend,
        system: system || DEFAULT_SYSTEM_PROMPT,
        temperature: temperature || selectedModel?.temperature,
        topP: topP || selectedModel?.top_p,
        onChunk: (chunk) => {
          // Collect output content for manual token counting
          if (chunk.chunk.type === 'text-delta') {
            outputContent += chunk.chunk.textDelta;
          }
        },
      });

      // Track token usage for rate limiting with manual counting fallback
      result.usage.then(async (usage) => {
        if (shouldApplyRateLimit && clientIP && usage && usage.promptTokens && usage.completionTokens) {
          tokensAlreadyCounted = true;
          
          const inputTokens = usage.promptTokens;
          const outputTokens = usage.completionTokens;
          const totalTokens = inputTokens + outputTokens;
          
          if (totalTokens > 0) {
            try {
              await incrementTokenUsage(clientIP, totalTokens);
            } catch (error) {
              console.error('Failed to track token usage:', error);
            }
          }
        } else {
          await countAndTrackTokens();
        }
      }).catch(error => {
        console.error('Failed to get usage data:', error);
      }).finally(() => {
        // Clean up encoding after processing
        encoding.free();
      });
      
      result.mergeIntoDataStream(dataStream);
    },
    onError: error => {
      console.log('error', error);
      // Clean up encoding on error
      encoding.free();
      
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
export const POST = withAuth(handlePostRequest);
