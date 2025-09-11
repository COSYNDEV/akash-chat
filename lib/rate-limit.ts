import { getUserTier, getModelByModelId } from './database';
import redis from './redis';

const MAX_TOKENS = parseInt(process.env.RATE_LIMIT_ANONYMOUS_TOKENS || '25000');
const MAX_TOKENS_AUTHENTICATED = parseInt(process.env.RATE_LIMIT_AUTHENTICATED_TOKENS || '100000');

/**
 * Client-safe rate limiting utilities
 * These functions don't import Redis and can be used in client components
 */

export interface RateLimit {
  limit: number;
  used: number;
  remaining: number;
  resetTime: Date;
  blocked: boolean;
}

/**
 * Format time remaining until reset
 */
export function formatTimeUntilReset(resetTime: Date): string {
  const now = new Date();
  const diff = resetTime.getTime() - now.getTime();
  
  if (diff <= 0) {
    return 'now';
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}

export interface RateLimitConfig {
  maxTokens: number;
  windowMs: number;
  keyPrefix?: string;
}

export const DEFAULT_ANONYMOUS_LIMIT: RateLimitConfig = {
  maxTokens: MAX_TOKENS,
  windowMs: 4 * 60 * 60 * 1000, // 4 hours
  keyPrefix: 'token_limit:anonymous:',
};

export const AUTHENTICATED_USER_LIMIT: RateLimitConfig = {
  maxTokens: MAX_TOKENS_AUTHENTICATED,
  windowMs: 4 * 60 * 60 * 1000, // 4 hours
  keyPrefix: 'token_limit:user:',
};

/**
 * Get rate limit config based on user authentication status
 */
export function getRateLimitConfig(isAuthenticated: boolean): RateLimitConfig {
  if (isAuthenticated) {
    return AUTHENTICATED_USER_LIMIT; // 50K tokens for authenticated users
  }
  
  return DEFAULT_ANONYMOUS_LIMIT; // 10K tokens for anonymous users
}

/**
 * Get rate limit config based on user's tier from database
 */
export async function getRateLimitConfigForUser(userId: string | null): Promise<RateLimitConfig> {
  if (!userId) {
    return DEFAULT_ANONYMOUS_LIMIT;
  }
  
  try {
    const userTier = await getUserTier(userId);
    if (!userTier) {
      return DEFAULT_ANONYMOUS_LIMIT;
    }
    
    return {
      maxTokens: userTier.token_limit,
      windowMs: userTier.rate_limit_window_ms,
      keyPrefix: 'token_limit:user:',
    };
  } catch (error) {
    console.error('Error fetching user tier for rate limiting:', error);
    return DEFAULT_ANONYMOUS_LIMIT;
  }
}

/**
 * Increment token usage with model multiplier support
 */
export async function incrementTokenUsageWithMultiplier(
  identifier: string,
  actualTokens: number,
  modelId: string,
  config: RateLimitConfig
): Promise<RateLimit> {
  try {
    // Get the model to find its token multiplier
    const model = await getModelByModelId(modelId);
    const tokenMultiplier = model?.token_multiplier || 1.0;
    
    // Calculate effective tokens (hidden from user)
    const effectiveTokens = Math.ceil(actualTokens * tokenMultiplier);
    
    // Use the effective tokens for rate limiting
    return await incrementTokenUsage(identifier, effectiveTokens, config);
  } catch (error) {
    console.error('Error applying token multiplier:', error);
    // Fallback to using actual tokens if model lookup fails
    return await incrementTokenUsage(identifier, actualTokens, config);
  }
}

/**
 * Increment token usage for a successful request (legacy function)
 */
export async function incrementTokenUsage(
  identifier: string,
  tokenCount: number,
  config: RateLimitConfig = DEFAULT_ANONYMOUS_LIMIT
): Promise<RateLimit> {
  const tokenKey = `${config.keyPrefix}${identifier}`;
  const timestampKey = `${config.keyPrefix}${identifier}:start`;
  const now = Date.now();
  
  try {
    // Check if this is the first request for this IP
    const pipeline = redis.pipeline();
    pipeline.get(tokenKey);
    pipeline.get(timestampKey);
    
    const results = await pipeline.exec();
    if (!results || results.length !== 2) {
      throw new Error('Redis pipeline failed');
    }
    
    const currentTokens = parseInt((results[0][1] as string) || '0');
    let windowStartTime = parseInt((results[1][1] as string) || '0');
    
    if (!windowStartTime) {
      windowStartTime = now;
    }
    
    const used = currentTokens + tokenCount;
    const resetTime = new Date(windowStartTime + config.windowMs);
    const ttlSeconds = Math.ceil((resetTime.getTime() - now) / 1000);
    
    // Update both token count and start time with same TTL
    const updatePipeline = redis.pipeline();
    updatePipeline.setex(tokenKey, ttlSeconds, used.toString());
    updatePipeline.setex(timestampKey, ttlSeconds, windowStartTime.toString());
    
    await updatePipeline.exec();
    
    const rateLimit: RateLimit = {
      limit: config.maxTokens,
      used,
      remaining: Math.max(0, config.maxTokens - used),
      resetTime,
      blocked: used > config.maxTokens,
    };
    
    return rateLimit;
  } catch (error) {
    console.error('Token usage tracking failed:', error);
    
    const resetTime = new Date(now + config.windowMs);
    return {
      limit: config.maxTokens,
      used: 0,
      remaining: config.maxTokens,
      resetTime,
      blocked: false,
    };
  }
}

/**
 * Check token limit without incrementing (for pre-request validation)
 */
export async function checkTokenLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_ANONYMOUS_LIMIT
): Promise<RateLimit> {
  const tokenKey = `${config.keyPrefix}${identifier}`;
  const timestampKey = `${config.keyPrefix}${identifier}:start`;
  const now = Date.now();
  
  try {
    // Get current token count and start timestamp
    const pipeline = redis.pipeline();
    pipeline.get(tokenKey);
    pipeline.get(timestampKey);
    
    const results = await pipeline.exec();
    if (!results || results.length !== 2) {
      throw new Error('Redis pipeline failed');
    }
    
    const currentTokens = parseInt((results[0][1] as string) || '0');
    const windowStartTime = parseInt((results[1][1] as string) || '0');
    
    // If no start time exists, user hasn't made any requests yet
    const resetTime = windowStartTime 
      ? new Date(windowStartTime + config.windowMs)
      : new Date(now + config.windowMs);
    
    return {
      limit: config.maxTokens,
      used: currentTokens,
      remaining: Math.max(0, config.maxTokens - currentTokens),
      resetTime,
      blocked: currentTokens >= config.maxTokens,
    };
  } catch (error) {
    console.error('Token limit check failed:', error);
    
    // Fallback
    const resetTime = new Date(now + config.windowMs);
    return {
      limit: config.maxTokens,
      used: 0,
      remaining: config.maxTokens,
      resetTime,
      blocked: false,
    };
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request): string {
  // Only use the reliable X-Original-Chat-Forwarded-For header set by Caddy
  const originalChatForwarded = request.headers.get('X-Original-Chat-Forwarded-For');
  
  if (originalChatForwarded) {
    const ip = originalChatForwarded.split(',')[0].trim();
    // Remove port if present (e.g., "162.158.172.8:59694" -> "162.158.172.8")
    return ip.split(':')[0];
  }
  
  // Consistent fallback to prevent rate limit resets
  return '127.0.0.1';
}
