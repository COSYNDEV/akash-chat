import { NextRequest, NextResponse } from 'next/server';

import { getOptionalSession, isAuth0Configured } from '@/lib/auth';

export interface AuthMiddlewareResult {
  success: boolean;
  userId?: string;
  user?: any;
  error?: NextResponse;
}

export async function withAuth0Auth(request: NextRequest): Promise<AuthMiddlewareResult> {
  try {
    if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
      const devUserId = process.env.DEV_USER_ID || 'dev-test-user';
      console.log('[DEV MODE] Using hardcoded test user:', devUserId);

      return {
        success: true,
        userId: devUserId,
        user: {
          sub: devUserId,
          email: 'dev@test.com',
          name: 'Dev Test User',
          picture: null
        }
      };
    }

    if (!isAuth0Configured()) {
      return {
        success: false,
        error: NextResponse.json({ error: 'Authentication not configured' }, { status: 401 })
      };
    }

    const session = await getOptionalSession(request);

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

export function requireAuth<T extends any[]>(
  handler: (request: NextRequest, userId: string, user: any, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await withAuth0Auth(request);
    
    if (!authResult.success) {
      return authResult.error!;
    }

    return handler(request, authResult.userId!, authResult.user!, ...args);
  };
}