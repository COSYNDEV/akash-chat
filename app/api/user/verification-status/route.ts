import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { auth0Management } from '@/lib/auth0-management';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req, NextResponse.next());
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.sub || typeof session.user.sub !== 'string') {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const userId = session.user.sub;
    
    // Get user data from Auth0
    const userData = await auth0Management.getUserData(userId);
    
    // Check verification status
    const emailVerified = userData.email_verified === true;
    const marketingConsent = userData.user_metadata?.marketing_consent === true;
    const isFullyVerified = emailVerified && marketingConsent;

    return NextResponse.json({
      emailVerified,
      marketingConsent,
      isFullyVerified,
      requirements: {
        emailVerification: {
          completed: emailVerified,
          description: 'Verify your email address to access additional features'
        },
        marketingConsent: {
          completed: marketingConsent,
          description: 'Accept marketing communications to unlock extended access'
        }
      },
      benefits: isFullyVerified 
        ? 'You have extended access!'
        : 'Complete verification for extended access!'
    });
  } catch (err: any) {
    console.error('Error checking verification status:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req, NextResponse.next());
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.sub || typeof session.user.sub !== 'string') {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const { consent } = await req.json();
    if (typeof consent !== 'boolean') {
      return NextResponse.json({ error: 'Invalid consent value' }, { status: 400 });
    }

    const userId = session.user.sub;
    await auth0Management.updateUserMetadata(userId, { marketing_consent: consent });

    // Return updated verification status
    const userData = await auth0Management.getUserData(userId);
    const emailVerified = userData.email_verified === true;
    const marketingConsent = userData.user_metadata?.marketing_consent === true;
    const isFullyVerified = emailVerified && marketingConsent;

    return NextResponse.json({ 
      success: true,
      emailVerified,
      marketingConsent,
      isFullyVerified
    });
  } catch (err: any) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}