import { isAuth0Configured, isDevBypassEnabled } from '@/lib/auth';
import { handleAuth } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

const DEV_SESSION_COOKIE = 'dev_auth_session';

function getDevUserId(): string {
  return process.env.DEV_USER_ID || 'dev-test-user';
}

function getDevUser() {
  const userId = getDevUserId();
  const email = userId.includes('|') 
    ? `${userId.split('|')[0]}@dev.test` 
    : 'dev@test.com';
  const name = userId.includes('|')
    ? `Dev User (${userId.split('|')[0]})`
    : 'Dev Test User';
  
  return {
    sub: userId,
    email,
    name,
    picture: null,
    email_verified: true,
    updated_at: new Date().toISOString(),
  };
}

function handleDevLogin(request: NextRequest): NextResponse {
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';
  const redirectUrl = new URL(returnTo, request.url);
  
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(DEV_SESSION_COOKIE, 'true', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  
  const userId = getDevUserId();
  console.log('[DEV MODE] Login bypass - setting dev session cookie for user:', userId);
  return response;
}

function handleDevLogout(request: NextRequest): NextResponse {
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';
  const redirectUrl = new URL(returnTo, request.url);
  
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.delete(DEV_SESSION_COOKIE);
  
  console.log('[DEV MODE] Logout bypass - clearing dev session cookie');
  return response;
}

function handleDevMe(request: NextRequest): NextResponse {
  const hasDevSession = request.cookies.get(DEV_SESSION_COOKIE)?.value === 'true';
  
  if (hasDevSession) {
    const devUser = getDevUser();
    console.log('[DEV MODE] Returning dev user for /me endpoint:', devUser.sub);
    return NextResponse.json(devUser);
  }

  return NextResponse.json(null, { status: 401 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ auth0: string[] }> }) {
  const params = await context.params;
  const route = params.auth0?.[0];

  // Handle dev bypass or when Auth0 is not configured
  if (isDevBypassEnabled() || !isAuth0Configured()) {
    switch (route) {
      case 'login':
        if (!isAuth0Configured()) {
          return NextResponse.json({ error: 'Authentication not configured' }, { status: 501 });
        }
        return handleDevLogin(request);
      case 'logout':
        if (!isAuth0Configured()) {
          return NextResponse.redirect(new URL('/', request.url));
        }
        return handleDevLogout(request);
      case 'me':
        if (!isAuth0Configured()) {
          return NextResponse.json(null, { status: 401 });
        }
        return handleDevMe(request);
      case 'callback':
        return NextResponse.redirect(new URL('/', request.url));
      case 'session':
      case 'status':
        if (!isAuth0Configured()) {
          return NextResponse.json({ isAuthenticated: false });
        }
        break;
      default:
        if (!isAuth0Configured()) {
          return NextResponse.json({ error: 'Authentication not configured' }, { status: 501 });
        }
    }
  }

  const auth0Handler = handleAuth();

  return auth0Handler(request, { params });
}