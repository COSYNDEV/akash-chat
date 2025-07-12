import redis from './redis';

const MAX_REQUESTS = 3;

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
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  keyPrefix?: string;
}

// Default rate limit: 2 messages per 2 hours for anonymous users
export const DEFAULT_ANONYMOUS_LIMIT: RateLimitConfig = {
  maxRequests: MAX_REQUESTS,
  windowMs: 2 * 60 * 60 * 1000, // 2 hours
  keyPrefix: 'rate_limit:anonymous:',
};

/**
 * Increment rate limit counter for a successful request
 */
export async function incrementRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_ANONYMOUS_LIMIT
): Promise<RateLimit> {
  const key = `${config.keyPrefix}${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  try {
    // Use Redis sorted set to track requests with timestamps
    const pipeline = redis.pipeline();
    
    // Remove old entries outside the time window
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in the window
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration for the key
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));
    
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Redis pipeline failed');
    }
    
    // Get the count before adding the current request
    const currentCount = (results[1][1] as number) || 0;
    const used = currentCount + 1; // Include the current request
    
    // Calculate reset time: when the oldest request will expire (sliding window)
    let resetTime = new Date(now + config.windowMs);
    
    // If we're at or over the limit, find when the oldest request expires
    if (used >= config.maxRequests) {
      try {
        // Get the oldest request timestamp
        const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        if (oldestRequest.length >= 2) {
          const oldestTimestamp = parseInt(oldestRequest[1]);
          resetTime = new Date(oldestTimestamp + config.windowMs);
        }
      } catch (error) {
        console.error('Failed to get oldest request:', error);
        // Fallback to window end
        resetTime = new Date(now + config.windowMs);
      }
    }
    
    const rateLimit: RateLimit = {
      limit: config.maxRequests,
      used,
      remaining: Math.max(0, config.maxRequests - used),
      resetTime,
      blocked: used > config.maxRequests,
    };
    
    return rateLimit;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    
    // Fallback: Allow request if Redis is down
    return {
      limit: config.maxRequests,
      used: 0,
      remaining: config.maxRequests,
      resetTime: new Date(now + config.windowMs),
      blocked: false,
    };
  }
}

/**
 * Check rate limit without incrementing (for pre-request validation)
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_ANONYMOUS_LIMIT
): Promise<RateLimit> {
  const key = `${config.keyPrefix}${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  try {
    // Remove old entries and count current requests
    await redis.zremrangebyscore(key, 0, windowStart);
    const currentCount = await redis.zcard(key);
    
    // Calculate reset time: when the oldest request will expire (sliding window)
    let resetTime = new Date(now + config.windowMs);
    
    // If we're at or over the limit, find when the oldest request expires
    if (currentCount >= config.maxRequests) {
      try {
        // Get the oldest request timestamp
        const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        if (oldestRequest.length >= 2) {
          const oldestTimestamp = parseInt(oldestRequest[1]);
          resetTime = new Date(oldestTimestamp + config.windowMs);
        }
      } catch (error) {
        console.error('Failed to get oldest request:', error);
        // Fallback to window end
        resetTime = new Date(now + config.windowMs);
      }
    }
    
    return {
      limit: config.maxRequests,
      used: currentCount,
      remaining: Math.max(0, config.maxRequests - currentCount),
      resetTime,
      blocked: currentCount >= config.maxRequests,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    
    // Fallback
    return {
      limit: config.maxRequests,
      used: 0,
      remaining: config.maxRequests,
      resetTime: new Date(now + config.windowMs),
      blocked: false,
    };
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  // Fallback for development
  return '127.0.0.1';
}
