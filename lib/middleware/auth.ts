import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

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