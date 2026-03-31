import { NextRequest, NextResponse } from 'next/server';

import { withAuth0Auth } from '@/lib/middleware/auth';
import { createDatabaseService } from '@/lib/services/database-service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const authResult = await withAuth0Auth(request);
    if (!authResult.success) {
      return authResult.error!;
    }

    const { chatId } = await params;
    const dbService = createDatabaseService(authResult.userId!);

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
    const authResult = await withAuth0Auth(request);
    if (!authResult.success) {
      return authResult.error!;
    }

    const { chatId } = await params;
    const updates = await request.json();

    const dbService = createDatabaseService(authResult.userId!);

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.folderId !== undefined) {
      updateData.folder_id = updates.folderId;
    }

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