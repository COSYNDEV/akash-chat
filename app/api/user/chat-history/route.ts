import { NextRequest, NextResponse } from 'next/server';

import { getOptionalSession, isAuth0Configured } from '@/lib/auth';
import { deleteAllUserChatHistory } from '@/lib/database';

export async function DELETE(req: NextRequest) {
  try {
    if (!isAuth0Configured()) {
      return NextResponse.json({ error: 'Authentication not configured' }, { status: 401 });
    }

    const session = await getOptionalSession(req);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Delete all chat history from database
    await deleteAllUserChatHistory(userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Chat history deleted successfully',
      clearLocalStorage: true
    });
  } catch (error: any) {
    console.error('Error deleting chat history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete chat history' },
      { status: 500 }
    );
  }
}