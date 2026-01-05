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

function isDevBypassEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true';
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

  if (isDevBypassEnabled()) {
    switch (route) {
      case 'login':
        return handleDevLogin(request);
      case 'logout':
        return handleDevLogout(request);
      case 'me':
        return handleDevMe(request);
      case 'callback':
        return NextResponse.redirect(new URL('/', request.url));
    }
  }

  const auth0Handler = handleAuth();

  return auth0Handler(request, { params });
}