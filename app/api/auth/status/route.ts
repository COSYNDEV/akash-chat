import { NextResponse } from 'next/server';

import { ACCESS_TOKEN } from '@/app/config/api';
import { isAuth0Configured } from '@/lib/auth';

/**
 * API endpoint to check auth configuration status
 */
export async function GET() {
  return NextResponse.json({
    requiresAccessToken: !!ACCESS_TOKEN,
    authEnabled: isAuth0Configured(),
    message: ACCESS_TOKEN
      ? 'This application requires an access token to continue'
      : 'No access token required for this application',
  });
} 