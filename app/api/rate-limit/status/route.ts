import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { checkTokenLimit, getClientIP, getRateLimitConfigForUser } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    // Check if rate limiting is disabled (ACCESS_TOKEN is required)
    const isAccessTokenRequired = process.env.ACCESS_TOKEN && process.env.ACCESS_TOKEN.trim() !== '';
    
    if (isAccessTokenRequired) {
      // For deployments with ACCESS_TOKEN, rate limiting is disabled
      return Response.json({
        usagePercentage: 0,
        remainingPercentage: 100,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        blocked: false,
        authenticated: true,
      });
    }

    // Check authentication status
    const session = await getSession(req, NextResponse.next());
    const isAuthenticated = !!session?.user;
    
    // Determine rate limit identifier and config
    let rateLimitIdentifier: string;
    let userId: string | null = null;
    
    if (isAuthenticated && session?.user?.sub) {
      // Use Auth0 user ID for authenticated users
      rateLimitIdentifier = session.user.sub;
      userId = session.user.sub;
    } else {
      // Use IP for anonymous users
      rateLimitIdentifier = getClientIP(req);
    }
    
    const rateLimitConfig = await getRateLimitConfigForUser(userId);

    const rateLimit = await checkTokenLimit(rateLimitIdentifier, rateLimitConfig);

    // Calculate usage percentage (0-100)
    const usagePercentage = rateLimit.limit > 0 
      ? Math.round((rateLimit.used / rateLimit.limit) * 100)
      : 0;
    
    const remainingPercentage = Math.max(0, 100 - usagePercentage);

    return Response.json({
      usagePercentage,
      remainingPercentage,
      resetTime: rateLimit.resetTime.toISOString(),
      blocked: rateLimit.blocked,
      authenticated: isAuthenticated,
    });
  } catch (error) {
    console.error('Rate limit status error:', error);
    
    // Return safe fallback
    return Response.json({
      usagePercentage: 0,
      remainingPercentage: 100,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      blocked: false,
      authenticated: false,
    });
  }
}