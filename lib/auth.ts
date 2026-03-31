import * as crypto from 'crypto';

import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_TOKEN } from '@/app/config/api';

import { validateSession, isRedisAvailable } from './redis';

export function isDevBypassEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true';
}

export function isAuth0Configured(): boolean {
  return !!(
    process.env.AUTH0_SECRET &&
    process.env.AUTH0_BASE_URL &&
    process.env.AUTH0_ISSUER_BASE_URL &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET
  );
}

export async function getOptionalSession(req: NextRequest): Promise<{ user?: { sub: string; email?: string; name?: string } } | null> {
  if (!isAuth0Configured()) {
    return null;
  }

  try {
    const session = await getSession(req, NextResponse.next());
    if (!session?.user?.sub) {
      return null;
    }
    return {
      user: {
        sub: session.user.sub as string,
        email: session.user.email as string | undefined,
        name: session.user.name as string | undefined,
      }
    };
  } catch {
    return null;
  }
}

const HASHED_ACCESS_TOKEN = ACCESS_TOKEN ? 
  crypto.createHash('sha256').update(ACCESS_TOKEN).digest('hex') : null;

export async function validateSessionToken(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie');
  const sessionToken = cookieHeader?.split(';')
      .find(c => c.trim().startsWith('session_token='))
      ?.split('=')[1];

  if (!sessionToken) {return false;}
  
  try {
    return await validateSession(sessionToken);
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

export function withSessionAuth(handler: Function) {
  return async function(req: NextRequest) {
    // Bypass session validation if Auth0 or Redis is not configured
    if (!isAuth0Configured() || !isRedisAvailable()) {
      return handler(req);
    }

    const isValid = await validateSessionToken(req);

    if (!isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthorized: Invalid session'
        }),
        {
          status: 403,
          headers: {
            'content-type': 'application/json',
          },
        }
      );
    }

    return handler(req);
  }
}

/**
 * Creates a constant-time comparison of two strings to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns True if the strings are equal
 */
function secureCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  // Manual constant-time comparison as a fallback
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Middleware function to check API access token
 * @param request - The incoming request
 * @returns Response object if authentication fails, null if authentication passes
 */
export function checkApiAccessToken(request: Request): NextResponse | null {
  // If no access token is required, always pass authentication
  if (!HASHED_ACCESS_TOKEN) {
    return null;
  }

  const authHeader = request.headers.get('Authorization');
  const accessToken = authHeader?.split(' ')[1];

  // If access token is required but not provided
  if (!accessToken) {
    return NextResponse.json({
      error: 'Access token required',
      message: 'This application requires an access token to continue'
    }, { status: 403 });
  }

  // Hash the provided token for comparison
  const hashedProvidedToken = crypto.createHash('sha256').update(accessToken).digest('hex');

  // If access token is provided but doesn't match
  if (!secureCompare(hashedProvidedToken, HASHED_ACCESS_TOKEN)) {
    return NextResponse.json({
      error: 'Invalid Access token',
      message: 'The provided access token is invalid'
    }, { status: 403 });
  }

  // Authentication successful
  return null;
} 