import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { createDatabaseService } from '@/lib/services/database-service';
import { createEncryptionService } from '@/lib/services/encryption-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request, new NextResponse());
    if (!session?.user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbService = createDatabaseService(session.user.sub);
    const encryptionService = createEncryptionService(session.user.sub);

    // Load chat sessions using database service (handles name decryption)
    const chatsResult = await dbService.loadUserChats();
    
    if (!chatsResult.success) {
      return NextResponse.json({ error: 'Failed to load chats' }, { status: 500 });
    }

    const chatSessions = chatsResult.data || [];
    
    // Load and decrypt messages for each chat
    const chatsWithMessages = await Promise.all(
      (chatSessions || []).map(async (chat) => {
        try {
          // Load messages for this chat using database service
          const messagesResult = await dbService.loadChatMessages(chat.id!);
          
          if (!messagesResult.success) {
            return { ...chat, messages: [] };
          }
          
          const messages = messagesResult.data || [];

          // Decrypt messages using the new EncryptionService
          const decryptedMessages = await Promise.all((messages || []).map(async (msg) => {
            try {
              // Check if message has the required encrypted fields
              if (!msg.content_encrypted || !msg.content_iv || !msg.content_tag) {
                return {
                  id: msg.id!,
                  role: msg.role,
                  content: '[Message data incomplete]',
                  createdAt: msg.created_at!
                };
              }

              const decryptedContent = await encryptionService.decryptFromDatabase({
                content_encrypted: msg.content_encrypted,
                content_iv: msg.content_iv,
                content_tag: msg.content_tag
              });

              return {
                id: msg.id!,
                role: msg.role,
                content: decryptedContent,
                createdAt: msg.created_at!
              };
            } catch (error) {
              return {
                id: msg.id!,
                role: msg.role,
                content: '[Decryption failed]',
                createdAt: msg.created_at!
              };
            }
          }));

          // Decrypt system prompt if present
          let systemPrompt = '';
          if (chat.system_prompt_encrypted && chat.system_prompt_iv && chat.system_prompt_tag) {
            try {
              systemPrompt = await encryptionService.decryptFromDatabase({
                content_encrypted: chat.system_prompt_encrypted,
                content_iv: chat.system_prompt_iv,
                content_tag: chat.system_prompt_tag
              });
            } catch (error) {
              console.error(`Failed to decrypt system prompt for chat ${chat.id}:`, error);
            }
          }

          // decrypt name
          let name = 'Unknown Chat';
          if (chat.name_encrypted && chat.name_iv && chat.name_tag) {
            name = await encryptionService.decryptFromDatabase({
              content_encrypted: chat.name_encrypted,
              content_iv: chat.name_iv,
              content_tag: chat.name_tag
            });
          }
          return {
            id: chat.id,
            name: name,
            model_id: chat.model_id,
            model_name: chat.model_name,
            folder_id: chat.folder_id,
            parent_chat_id: chat.parent_chat_id,
            branched_at_index: chat.branched_at_index,
            system_prompt_decrypted: systemPrompt,
            messages: decryptedMessages,
            created_at: chat.created_at,
            updated_at: chat.updated_at
          };
        } catch (error) {
          console.error(`Failed to process chat ${chat.id}:`, error);
          return { ...chat, messages: [] };
        }
      })
    );

    return NextResponse.json({
      chatSessions: chatsWithMessages,
      count: chatsWithMessages.length
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}