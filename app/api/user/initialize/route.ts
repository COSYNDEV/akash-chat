import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { getUserPreferences, upsertUserPreferences, updateUserTier } from '@/lib/database';
import { LiteLLMService } from '@/lib/services/litellm-service';

function isDevBypassEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true';
}

export async function POST(req: NextRequest) {
  try {
    if (isDevBypassEnabled()) {
      const devUserId = process.env.DEV_USER_ID || 'dev-test-user';
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

    if (!key) {
      await LiteLLMService.generateApiKey(userId);
    }

    if (!existingPreferences) {
      await upsertUserPreferences({
        user_id: userId,
        temperature: 0.7,
        top_p: 0.95
      });

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
