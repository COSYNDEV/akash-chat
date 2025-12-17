import { handleAuth } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

const DEV_SESSION_COOKIE = 'dev_auth_session';

/**
 * Get the dev user ID from environment (read dynamically)
 */
function getDevUserId(): string {
  return process.env.DEV_USER_ID || 'dev-test-user';
}

/**
 * Get the dev user object for dev mode authentication bypass
 */
function getDevUser() {
  const userId = getDevUserId();
  // Extract email/name from user ID if it's an Auth0 ID format (auth0|xxx or github|xxx)
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

/**
 * Check if dev auth bypass is enabled
 */
function isDevBypassEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true';
}

/**
 * Handle dev mode login - sets a cookie and redirects back
 */
function handleDevLogin(request: NextRequest): NextResponse {
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';
  const redirectUrl = new URL(returnTo, request.url);
  
  const response = NextResponse.redirect(redirectUrl);
  
  // Set dev session cookie
  response.cookies.set(DEV_SESSION_COOKIE, 'true', {
    httpOnly: true,
    secure: false, // Dev mode only
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  
  const userId = getDevUserId();
  console.log('[DEV MODE] Login bypass - setting dev session cookie for user:', userId);
  return response;
}

/**
 * Handle dev mode logout - clears the cookie and redirects
 */
function handleDevLogout(request: NextRequest): NextResponse {
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';
  const redirectUrl = new URL(returnTo, request.url);
  
  const response = NextResponse.redirect(redirectUrl);
  
  // Clear dev session cookie
  response.cookies.delete(DEV_SESSION_COOKIE);
  
  console.log('[DEV MODE] Logout bypass - clearing dev session cookie');
  return response;
}

/**
 * Handle dev mode /me endpoint - returns dev user if session exists
 */
function handleDevMe(request: NextRequest): NextResponse {
  const hasDevSession = request.cookies.get(DEV_SESSION_COOKIE)?.value === 'true';
  
  if (hasDevSession) {
    const devUser = getDevUser();
    console.log('[DEV MODE] Returning dev user for /me endpoint:', devUser.sub);
    return NextResponse.json(devUser);
  }
  
  // No dev session, return empty (not logged in)
  return NextResponse.json(null, { status: 401 });
}

// Next.js 15 compatible Auth0 handler
export async function GET(request: NextRequest, context: { params: Promise<{ auth0: string[] }> }) {
  // Await the params as required by Next.js 15
  const params = await context.params;
  const route = params.auth0?.[0];
  
  // DEV MODE: Bypass Auth0 for login/logout/me routes
  if (isDevBypassEnabled()) {
    switch (route) {
      case 'login':
        return handleDevLogin(request);
      case 'logout':
        return handleDevLogout(request);
      case 'me':
        return handleDevMe(request);
      // callback not needed in dev mode
      case 'callback':
        return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  // Create a new context with resolved params for Auth0
  const auth0Handler = handleAuth();
  
  // Call the Auth0 handler with the resolved params
  return auth0Handler(request, { params });
}