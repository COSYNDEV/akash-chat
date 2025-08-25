import { NextRequest } from 'next/server';

import { checkTokenLimit, getClientIP } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    // Only check rate limit status for anonymous users (when ACCESS_TOKEN is not required)
    const isAccessTokenRequired = process.env.ACCESS_TOKEN && process.env.ACCESS_TOKEN.trim() !== '';
    
    if (isAccessTokenRequired) {
      // For authenticated deployments, return extended status
      return Response.json({
        limit: 999999,
        used: 0,
        remaining: 999999,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        blocked: false,
        authenticated: true,
      });
    }

    // For anonymous users, get actual token limit status
    const clientIP = getClientIP(req);
    const rateLimit = await checkTokenLimit(clientIP);

    return Response.json({
      limit: rateLimit.limit,
      used: rateLimit.used,
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime.toISOString(),
      blocked: rateLimit.blocked,
      authenticated: false,
    });
  } catch (error) {
    console.error('Rate limit status error:', error);
    
    // Return safe fallback
    return Response.json({
      limit: 20,
      used: 0,
      remaining: 20,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      blocked: false,
      authenticated: false,
    });
  }
}