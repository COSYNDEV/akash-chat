import { createOpenAI } from '@ai-sdk/openai';
import { streamText, createDataStreamResponse, generateText, simulateReadableStream, Message } from 'ai';
import cl100k_base from "tiktoken/encoders/cl100k_base.json";
import { Tiktoken } from "tiktoken/lite";

import { apiEndpoint, apiKey, imgGenFnModel, DEFAULT_SYSTEM_PROMPT } from '@/app/config/api';
import { defaultModel, models, createConfigToApiIdMap } from '@/app/config/models';
import { withAuth } from '@/lib/auth';
import { getAvailableModels } from '@/lib/models';
import { generateImageTool } from '@/lib/tools';
// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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
async function handlePostRequest(req: Request) {
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
        if (process.env.NODE_ENV === 'development') {
          console.log(`Token limit reached: ${tokenCount + tokens.length}`);
        }
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
      const smallModel = openai(imgGenFnModel || 'Meta-Llama-3-3-70B-Instruct');
      const smallResponse = await generateText({
        model: smallModel,
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
      console.log('Error generating image');
      console.error(error);
    }
  }

  return createDataStreamResponse({
    execute: dataStream => {
      const systemToUse = system || DEFAULT_SYSTEM_PROMPT;
      
      // Map config model ID to API model ID if needed
      const configToApiIdMap = createConfigToApiIdMap();
      const apiModelId = configToApiIdMap.get(model || defaultModel) || model || defaultModel;

      const result = streamText({
        model: openai(apiModelId),
        messages: messagesToSend,
        system: systemToUse,
        temperature: temperature || selectedModel?.temperature,
        topP: topP || selectedModel?.top_p,

      });
      result.mergeIntoDataStream(dataStream);
    },
    onError: error => {
      console.log('error', error);
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
        console.error(error.message);
        return error.message;
      }
      console.error(error);
      return String(error);
    }
  });
}

// Export the wrapped handler
export const POST = withAuth(handlePostRequest);
