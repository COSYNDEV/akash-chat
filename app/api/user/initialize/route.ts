import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { getUserPreferences } from '@/lib/database';
import { LiteLLMService } from '@/lib/services/litellm-service';

/**
 * Initialize a new user - create LiteLLM API key and set up basic preferences
 * This endpoint should be called when a user first signs up or logs in
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req, NextResponse.next());
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const existingPreferences = await getUserPreferences(userId);
    
    // Generate or get API key for this user
    if (!await LiteLLMService.getApiKey(userId)) {
      await LiteLLMService.generateApiKey(userId);
    }

    return NextResponse.json({ 
      success: true,
      isNewUser: !existingPreferences,
      message: existingPreferences 
        ? 'User initialized successfully' 
        : 'New user created and initialized'
    });

  } catch (error: any) {
    console.error('Error initializing user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize user' },
      { status: 500 }
    );
  }
}

// Removed GET endpoint - API keys should never be exposed to frontend