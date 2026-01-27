import type { Message as AIMessage } from 'ai';
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const processMessages = (messages: AIMessage[]): AIMessage[] => {
  return messages.map((msg, index) => {
    if (index === messages.length - 1 && msg.role === 'assistant') {
      return msg;
    }

    if (typeof msg.content === 'string') {
      const content = msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return { ...msg, content };
    }

    return msg;
  });
};

/**
 * Validates the access token with the backend
 * On success, the backend creates a session stored in httpOnly cookies
 */
export const validateAccessToken = async (token: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !token.trim()) {
    return false;
  }

  try {
    const response = await fetch('/api/auth/session/', {
      headers: {
        'Authorization': `Bearer ${token.trim()}`
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Access token validation failed:', error);
    return false;
  }
};