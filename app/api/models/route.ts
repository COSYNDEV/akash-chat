import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { getAvailableModelsForUser } from '@/lib/models';

export async function GET(req: NextRequest) {
    try {
        // Check if user is authenticated
        const session = await getSession(req, NextResponse.next());
        const userId = session?.user?.sub || null;
                
        // Get models based on user's tier (or anonymous/permissionless for non-logged-in users)
        const models = await getAvailableModelsForUser(userId);
        
        return NextResponse.json(models);
    } catch (error) {
        console.error('[API] Error fetching models:', error);
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }
} 