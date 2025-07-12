import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { createDatabaseService } from '@/lib/services/database-service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await getSession(request, new NextResponse());
    if (!session?.user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;
    const dbService = createDatabaseService(session.user.sub);

    // Delete the chat session (will cascade delete messages automatically)
    const result = await dbService.deleteChatSession(chatId);

    if (!result.success) {
      console.error('Failed to delete chat session:', result.error);
      return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await getSession(request, new NextResponse());
    if (!session?.user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;
    const updates = await request.json();

    // Use database service for encrypted chat updates
    const dbService = createDatabaseService(session.user.sub);
    
    // Prepare update object with proper field mapping
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.folderId !== undefined) {
      updateData.folder_id = updates.folderId;
    }

    // Update the chat session using database service
    const result = await dbService.updateChatSession(chatId, updateData);

    if (!result.success) {
      console.error('Failed to update chat session:', result.error);
      return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      chat: result.data,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}