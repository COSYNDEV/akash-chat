import { handleAuth } from '@auth0/nextjs-auth0';
import { NextRequest } from 'next/server';

// Next.js 15 compatible Auth0 handler
export async function GET(request: NextRequest, context: { params: Promise<{ auth0: string[] }> }) {
  // Await the params as required by Next.js 15
  const params = await context.params;
  
  // Create a new context with resolved params for Auth0
  const auth0Handler = handleAuth();
  
  // Call the Auth0 handler with the resolved params
  return auth0Handler(request, { params });
}