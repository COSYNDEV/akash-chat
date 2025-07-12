import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  userId: string;
  user: any;
}

export interface AuthMiddlewareResult {
  success: boolean;
  userId?: string;
  user?: any;
  error?: NextResponse;
}

/**
 * Authentication middleware for API routes
 * Validates session and extracts user information
 */
export async function withAuth(request: NextRequest): Promise<AuthMiddlewareResult> {
  try {
    const session = await getSession(request, new NextResponse());
    
    if (!session?.user?.sub) {
      return {
        success: false,
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      };
    }

    return {
      success: true,
      userId: session.user.sub,
      user: session.user
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    };
  }
}

/**
 * Higher-order function to wrap API route handlers with authentication
 */
export function requireAuth<T extends any[]>(
  handler: (request: NextRequest, userId: string, user: any, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await withAuth(request);
    
    if (!authResult.success) {
      return authResult.error!;
    }
    
    return handler(request, authResult.userId!, authResult.user!, ...args);
  };
}

/**
 * Simplified authentication check for middleware chains
 */
export async function authenticateUser(request: NextRequest): Promise<{ userId: string; user: any } | null> {
  try {
    const session = await getSession(request, new NextResponse());
    
    if (!session?.user?.sub) {
      return null;
    }

    return {
      userId: session.user.sub,
      user: session.user
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}