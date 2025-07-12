import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { deleteAllUserChatHistory } from '@/lib/database';

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req, NextResponse.next());
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