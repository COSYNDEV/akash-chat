import Redis from 'ioredis';

import { CACHE_TTL } from '@/app/config/api';

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface SessionData {
  created: number;
  lastAccessed: number;
}

// Session management functions
export async function storeSession(
  sessionToken: string, 
  expiryInSeconds: number = CACHE_TTL
) {
  const sessionData: SessionData = {
    created: Date.now(),
    lastAccessed: Date.now()
  };

  await redis.set(
    `session:${sessionToken}`, 
    JSON.stringify(sessionData), 
    'EX', 
    expiryInSeconds
  );
}

export async function validateSession(sessionToken: string): Promise<boolean> {
  // Check if token has valid format (64 character hex string)
  if (!/^[a-f0-9]{64}$/.test(sessionToken)) {
    return false;
  }

  try {
    const sessionData = await redis.get(`session:${sessionToken}`);
    if (!sessionData) {return false;}

    // Parse and validate session data
    const data = JSON.parse(sessionData) as SessionData;
    const now = Date.now();
    
    // Update last accessed time
    await redis.set(
      `session:${sessionToken}`,
      JSON.stringify({ ...data, lastAccessed: now }),
      'KEEPTTL' // Keep the existing TTL
    );

    return true;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

export async function deleteSession(sessionToken: string) {
  await redis.del(`session:${sessionToken}`);
}

// LiteLLM API key session management
export async function getUserLiteLLMKey(userId: string): Promise<string | null> {
  try {
    const key = `litellm:api_key:${userId}`;
    const data = await redis.get(key);
    
    if (!data) {return null;}

    const keyData = JSON.parse(data);
    
    // Check if expired
    if (Date.now() > keyData.expiresAt) {
      await redis.del(key);
      return null;
    }

    return keyData.key;
  } catch (error) {
    console.error('Failed to get LiteLLM API key from Redis:', error);
    return null;
  }
}

export async function storeLiteLLMKey(userId: string, apiKey: string, expiryInSeconds: number = 24 * 60 * 60): Promise<void> {
  const keyData = {
    key: apiKey,
    userId,
    expiresAt: Date.now() + (expiryInSeconds * 1000)
  };

  const redisKey = `litellm:api_key:${userId}`;
  await redis.set(redisKey, JSON.stringify(keyData), 'EX', expiryInSeconds);
}

export default redis; 