import { NextRequest, NextResponse } from 'next/server';

import { getOptionalSession } from '@/lib/auth';
import { getAvailableModelsForUser } from '@/lib/models';

export async function GET(req: NextRequest) {
    try {
        // Check if user is authenticated (optional - works without Auth0)
        const session = await getOptionalSession(req);
        const userId = session?.user?.sub || null;
                
        // Get models based on user's tier (or anonymous/permissionless for non-logged-in users)
        const models = await getAvailableModelsForUser(userId);
        
        return NextResponse.json(models);
    } catch (error) {
        console.error('[API] Error fetching models:', error);
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }
} 