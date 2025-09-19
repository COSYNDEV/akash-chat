import { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/middleware/auth';
import { withErrorHandling, createSuccessResponse, ValidationError } from '@/lib/middleware/error-handler';
import { createDatabaseService } from '@/lib/services/database-service';
import { createEncryptionService } from '@/lib/services/encryption-service';
import { validateChatSession, validateChatMessage } from '@/lib/validation';

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, userId: string, _user: any) => {
    let chatData;
    try {
      const body = await request.text();
      
      if (!body || body.trim().length === 0) {
        throw new ValidationError('Empty request body');
      }
      
      chatData = JSON.parse(body);
    } catch (parseError) {
      throw new ValidationError('Invalid JSON payload');
    }

    // Validate required fields
    if (!chatData.id || !chatData.name || !chatData.model) {
      throw new ValidationError('Missing required fields: id, name, model');
    }
    
    // Reject private chats - they should never be saved to database
    if (chatData.isPrivate) {
      throw new ValidationError('Private chats cannot be saved to database');
    }
    
    // Environment check
    
    // Create services
    const dbService = createDatabaseService(userId);
    const encryptionService = createEncryptionService(userId);

    // Prepare chat session data
    const chatSession: any = {
      id: chatData.id,
      name: chatData.name,
      model_id: chatData.model?.id || chatData.model_id,
      model_name: chatData.model?.name || chatData.model_name,
      folder_id: chatData.folderId,
      parent_chat_id: chatData.parentChatId,
      branched_at_index: chatData.branchedAtIndex,
      created_at: chatData.created_at,
      updated_at: chatData.updated_at,
      user_id: userId
    };

    // Validate chat session data against database schema
    const validation = validateChatSession(chatSession);
    if (!validation.isValid) {
      throw new ValidationError(`Invalid chat session data: ${validation.errors.join(', ')}`);
    }

    // Handle system prompt encryption if present
    if (chatData.system) {
      const encryptedPrompt = await encryptionService.encryptForDatabase(chatData.system);
      chatSession.system_prompt_encrypted = encryptedPrompt.content_encrypted;
      chatSession.system_prompt_iv = encryptedPrompt.content_iv;
      chatSession.system_prompt_tag = encryptedPrompt.content_tag;
    }

    // Handle name encryption if present
    if (chatData.name) {
      const encryptedName = await encryptionService.encryptForDatabase(chatData.name);
      chatSession.name_encrypted = encryptedName.content_encrypted;
      chatSession.name_iv = encryptedName.content_iv;
      chatSession.name_tag = encryptedName.content_tag;
    }
    // Collect folder information if chat has a folderId for lazy migration
    let folderInfo: { name: string } | undefined;
    if (chatData.folderId && chatData.folderInfo) {
      folderInfo = {
        name: chatData.folderInfo.name
      };
    }

    // Save chat session using database service
    const chatResult = await dbService.saveChatSession(chatSession, folderInfo);
    
    if (!chatResult.success) {
      throw new Error(`Failed to save chat session: ${chatResult.error}`);
    }
    
    let messagesSaved = 0;

    // Process and save messages if they exist
    if (chatData.messages && Array.isArray(chatData.messages) && chatData.messages.length > 0) {
      
      // Filter valid messages (same logic as before but cleaner)
      const validMessages = chatData.messages.filter((msg: any) => {
        if (!msg || typeof msg !== 'object') {
          return false;
        }
        
        if (!['user', 'assistant', 'system'].includes(msg.role)) {
          return false;
        }
        
        if (typeof msg.content !== 'string') {
          return false;
        }
        
        const isEmpty = !msg.content || msg.content.trim() === '';
        
        // Skip ALL empty messages - they should never be saved to database
        if (isEmpty) {
          return false;
        }
        
        return true;
      });
      
      // Save messages using database service
      for (let index = 0; index < validMessages.length; index++) {
        const msg = validMessages[index];
        
        try {
          // Validate message data against database schema
          const messageToValidate = {
            chat_session_id: chatData.id,
            role: msg.role,
            position: index,
          };
          
          const messageValidation = validateChatMessage(messageToValidate);
          if (!messageValidation.isValid) {
            throw new ValidationError(`Invalid message data: ${messageValidation.errors.join(', ')}`);
          }
          
          const messageResult = await dbService.saveChatMessage(
            chatData.id,
            msg.role,
            msg.content || '',
            index,
            msg.tokenCount
          );
          
          if (messageResult.success) {
            messagesSaved++;
          } else {
            throw new Error(`Failed to save message ${index}: ${messageResult.error}`);
          }
        } catch (error: any) {
          throw new Error(`Message processing failed for ${index}: ${error.message}`);
        }
      }
    }

    return createSuccessResponse({
      chatId: chatData.id,
      messagesSaved,
      updatedFolderId: chatResult.data?.folder_id,
      needsFolderUpdate: chatResult.data?.needsFolderUpdate,
      originalFolderId: chatResult.data?.originalFolderId,
      newFolderId: chatResult.data?.newFolderId,
      message: `Chat saved with ${messagesSaved} messages`
    });
  })
);