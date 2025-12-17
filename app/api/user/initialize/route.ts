import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { getUserPreferences, upsertUserPreferences, updateUserTier } from '@/lib/database';
import { LiteLLMService } from '@/lib/services/litellm-service';

/**
 * Check if dev auth bypass is enabled
 */
function isDevBypassEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true';
}

/**
 * Initialize a new user - create LiteLLM API key and set up basic preferences
 * This endpoint should be called when a user first signs up or logs in
 */
export async function POST(req: NextRequest) {
  try {
    // DEV MODE: Return success immediately
    if (isDevBypassEnabled()) {
      const devUserId = process.env.DEV_USER_ID || 'dev-test-user';
      // Still try to initialize in dev mode if needed, but don't fail
      try {
        const existingPreferences = await getUserPreferences(devUserId);
        return NextResponse.json({ 
          success: true,
          isNewUser: !existingPreferences,
          message: existingPreferences 
            ? 'User initialized successfully' 
            : 'New user created and initialized with extended tier'
        });
      } catch (error) {
        // If DB fails in dev mode, still return success
        console.log('[DEV MODE] User initialize - DB error (ignored):', error);
        return NextResponse.json({ 
          success: true,
          isNewUser: false,
          message: 'User initialized successfully (dev mode)'
        });
      }
    }

    const session = await getSession(req, NextResponse.next());
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const existingPreferences = await getUserPreferences(userId);
    const key = await LiteLLMService.getApiKey(userId);

    // Generate or get API key for this user
    if (!key) {
      await LiteLLMService.generateApiKey(userId);
    }

    // Create user preferences record for new users
    if (!existingPreferences) {
      // Create default preferences for new user
      await upsertUserPreferences({
        user_id: userId,
        temperature: 0.7,
        top_p: 0.95
      });
      
      // Set user tier to 'extended' (default for new users)
      await updateUserTier(userId, 'extended');
    }

    return NextResponse.json({ 
      success: true,
      isNewUser: !existingPreferences,
      message: existingPreferences 
        ? 'User initialized successfully' 
        : 'New user created and initialized with extended tier'
    });

  } catch (error: any) {
    console.error('Error initializing user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize user' },
      { status: 500 }
    );
  }
}
