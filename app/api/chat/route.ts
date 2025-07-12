import { createOpenAI } from '@ai-sdk/openai';
import { getSession } from '@auth0/nextjs-auth0';
import { streamText, createDataStreamResponse, generateText, simulateReadableStream, Message } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import { Tiktoken } from "tiktoken/lite";

import { apiEndpoint, apiKey, imgGenFnModel, DEFAULT_SYSTEM_PROMPT } from '@/app/config/api';
import { defaultModel, models } from '@/app/config/models';
import { withAuth } from '@/lib/auth';
import { getAvailableModels } from '@/lib/models';
import { checkRateLimit, incrementRateLimit, getClientIP } from '@/lib/rate-limit';
import { LiteLLMService } from '@/lib/services/litellm-service';
import { generateImageTool } from '@/lib/tools';

if (!apiKey) {
  throw new Error('API_KEY is not set in environment variables');
}

// Create custom OpenAI provider instance
const openai = createOpenAI({
  baseURL: apiEndpoint,
  apiKey: apiKey,
  compatibility: 'compatible'
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
    const rateLimit = await checkRateLimit(clientIP);
    
    if (rateLimit.blocked) {
      const message = isAuthenticated 
        ? `You've reached your limit of ${rateLimit.limit} messages per 2 hours. Please verify your email and accept marketing consent for unlimited access.`
        : `You've reached your limit of ${rateLimit.limit} messages per 2 hours. Please try again later or sign in for extended access.`;
        
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
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': Math.ceil(rateLimit.resetTime.getTime() / 1000).toString(),
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

  const prompt_tokens = encoding.encode(system || "You are a helpful assistant.");

  let tokenCount = prompt_tokens.length;
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
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const tokens = encoding.encode(message.content);

    if (tokenCount + tokens.length + 1000 > (selectedModel?.tokenLimit || 128000)) {
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
        
        // Increment rate limit for successful image generation (unauthenticated users only)
        if (!isAuthenticated && clientIP) {
          await incrementRateLimit(clientIP);
        }
        
        return new Response(
          simulateReadableStream({
            initialDelayInMs: 0, // Delay before the first chunk
            chunkDelayInMs: 0, // Delay between chunks
            chunks: [
              `0:"<image_generation> jobId='${imageResult.jobId}' prompt='${imageResult.prompt}' negative='${imageResult.negative || ''}'</image_generation>"\n`,
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
      // Increment rate limit for successful request start (unauthenticated users and unverified authenticated users)
      if (shouldApplyRateLimit && clientIP) {
        await incrementRateLimit(clientIP);
      }
      
      const result = streamText({
        model: openaiClient(model || defaultModel),
        messages: messagesToSend,
        system: system || DEFAULT_SYSTEM_PROMPT,
        temperature: temperature || selectedModel?.temperature,
        topP: topP || selectedModel?.top_p,
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
export const POST = withAuth(handlePostRequest);
