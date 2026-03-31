import { 
  upsertUserPreferences, 
  getUserPreferences,
  createChatSession,
  getUserChatSessions,
  updateChatSession,
  deleteChatSession,
  createChatMessage,
  getChatMessages,
  getBulkChatMessages,
  createFolder,
  getUserFolders,
  updateFolder,
  deleteFolder,
  folderExists,
  findFolderByName,
  createUserApiKey,
  getUserApiKey,
  type UserPreferences,
  type ChatSession,
  type ChatMessage,
  type Folder,
  type UserApiKey
} from '../database';

import { EncryptionService, encryptChatName, encryptFolderName, decryptFolderName } from './encryption-service';

const folderCreationLocks = new Map<string, Promise<DatabaseOperationResult<Folder>>>();

export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BatchOperationResult<T = any> {
  success: boolean;
  results: T[];
  errors: string[];
  totalProcessed: number;
  totalFailed: number;
}

/**
 * Centralized database service with encryption integration
 */
export class DatabaseService {
  private encryptionService: EncryptionService;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.encryptionService = new EncryptionService(userId);
  }

  // User Preferences Operations
  async saveUserPreferences(preferences: Partial<UserPreferences>): Promise<DatabaseOperationResult<UserPreferences>> {
    try {
      const savedPreferences = await upsertUserPreferences({
        user_id: this.userId,
        ...preferences
      });

      return { success: true, data: savedPreferences };
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async loadUserPreferences(): Promise<DatabaseOperationResult<UserPreferences | null>> {
    try {
      const preferences = await getUserPreferences(this.userId);
      return { success: true, data: preferences };
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Chat Operations
  async saveChatSession(chat: Omit<ChatSession, 'user_id'> & { name?: string }, folderInfo?: { name: string }): Promise<DatabaseOperationResult<ChatSession & { needsFolderUpdate?: boolean; originalFolderId?: string; newFolderId?: string }>> {
    try {
      let needsFolderUpdate = false;
      let originalFolderId: string | undefined;
      let newFolderId: string | undefined;

      if (chat.folder_id) {
        try {
          const exists = await folderExists(this.userId, chat.folder_id);
          if (!exists && folderInfo?.name) {
            const existingFolder = await findFolderByName(this.userId, folderInfo.name);
            if (existingFolder?.id) {
              originalFolderId = chat.folder_id;
              newFolderId = existingFolder.id;
              chat = { ...chat, folder_id: newFolderId };
              needsFolderUpdate = true;
            } else {
              originalFolderId = chat.folder_id;
              const folderResult = await this.createUserFolder(folderInfo.name);

              if (folderResult.success && folderResult.data) {
                newFolderId = folderResult.data.id!;
                chat = { ...chat, folder_id: newFolderId };
                needsFolderUpdate = true;
              } else {
                chat = { ...chat, folder_id: undefined };
              }
            }
          } else if (!exists) {
            chat = { ...chat, folder_id: undefined };
          }
        } catch (error) {
          chat = { ...chat, folder_id: undefined };
        }
      }

      let chatToSave = { ...chat };
      if (chat.name) {
        const encryptedName = await encryptChatName(chat.name, this.userId);
        if (encryptedName) {
          const { name: _, ...chatWithoutName } = chat;
          chatToSave = {
            ...chatWithoutName,
            name_encrypted: encryptedName.content_encrypted,
            name_iv: encryptedName.content_iv,
            name_tag: encryptedName.content_tag
          };
        }
      }

      const chatSession = await createChatSession({
        ...chatToSave,
        user_id: this.userId
      });

      const responseData = {
        ...chatSession,
        ...(needsFolderUpdate && {
          needsFolderUpdate,
          originalFolderId,
          newFolderId
        })
      };

      return { success: true, data: responseData };
    } catch (error) {
      console.error('Failed to save chat session:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async saveChatMessage(
    chatSessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    position: number,
    tokenCount?: number,
  ): Promise<DatabaseOperationResult<ChatMessage>> {
    try {
      const encryptedContent = await this.encryptionService.encryptForDatabase(content);

      const message = await createChatMessage(this.userId, {
        chat_session_id: chatSessionId,
        role,
        position,
        content_encrypted: encryptedContent.content_encrypted,
        content_iv: encryptedContent.content_iv,
        content_tag: encryptedContent.content_tag,
        token_count: tokenCount,
      });

      return { success: true, data: message };
    } catch (error) {
      console.error('Failed to save chat message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async loadUserChats(): Promise<DatabaseOperationResult<ChatSession[]>> {
    try {
      const chats = await getUserChatSessions(this.userId);
      
      if (chats.length === 0) {
        return { success: true, data: [] };
      }

      const encryptedNames = [];
      const nameMapping = new Map<string, number>();
      
      for (const chat of chats) {
        if (chat.name_encrypted && chat.name_iv && chat.name_tag) {
          const nameIndex = encryptedNames.length;
          encryptedNames.push({
            content_encrypted: chat.name_encrypted,
            content_iv: chat.name_iv,
            content_tag: chat.name_tag
          });
          nameMapping.set(chat.id!, nameIndex);
        }
      }

      const nameDecryptResults = encryptedNames.length > 0 
        ? await this.encryptionService.decryptBatchSafe(encryptedNames)
        : [];

      const decryptedChats = chats.map((chat) => {
        const nameIndex = nameMapping.get(chat.id!);
        const decryptedName = nameIndex !== undefined 
          ? (nameDecryptResults[nameIndex]?.content || 'Unnamed Chat')
          : 'Unnamed Chat';
        
        return {
          ...chat,
          name: decryptedName
        };
      });
      
      return { success: true, data: decryptedChats };
    } catch (error) {
      console.error('Failed to load user chats:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async loadChatMessages(chatSessionId: string): Promise<DatabaseOperationResult<ChatMessage[]>> {
    try {
      const messages = await getChatMessages(this.userId, chatSessionId);
      return { success: true, data: messages };
    } catch (error) {
      console.error('Failed to load chat messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async loadBulkChatMessages(chatSessionIds: string[]): Promise<DatabaseOperationResult<Map<string, ChatMessage[]>>> {
    try {
      const messagesByChat = await getBulkChatMessages(this.userId, chatSessionIds);
      return { success: true, data: messagesByChat };
    } catch (error) {
      console.error('Failed to load bulk chat messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateChatSession(chatSessionId: string, updates: Partial<ChatSession & { name?: string }>): Promise<DatabaseOperationResult<ChatSession>> {
    try {
      let updatesToSave: Partial<ChatSession> = { ...updates };
      if (updates.name !== undefined) {
        const encryptedName = await encryptChatName(updates.name, this.userId);
        if (encryptedName) {
          const { name: _, ...updatesWithoutName } = updates;
          updatesToSave = {
            ...updatesWithoutName,
            name_encrypted: encryptedName.content_encrypted,
            name_iv: encryptedName.content_iv,
            name_tag: encryptedName.content_tag
          };
        }
      }

      const updatedSession = await updateChatSession(this.userId, chatSessionId, updatesToSave);
      return { success: true, data: updatedSession };
    } catch (error) {
      console.error('Failed to update chat session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteChatSession(chatSessionId: string): Promise<DatabaseOperationResult<void>> {
    try {
      await deleteChatSession(this.userId, chatSessionId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Folder Operations
  async createUserFolder(name: string): Promise<DatabaseOperationResult<Folder>> {
    const lockKey = `${this.userId}:${name}`;

    const existingLock = folderCreationLocks.get(lockKey);
    if (existingLock) {
      return existingLock;
    }

    const creationPromise = this._createUserFolderInternal(name);
    folderCreationLocks.set(lockKey, creationPromise);
    
    try {
      const result = await creationPromise;
      return result;
    } finally {
      folderCreationLocks.delete(lockKey);
    }
  }

  private async _createUserFolderInternal(name: string): Promise<DatabaseOperationResult<Folder>> {
    try {
      try {
        const folder = await createFolder(this.userId, name);
        return { success: true, data: folder };
      } catch (createError: any) {
        if (createError?.message?.includes('unique') || createError?.code === '23505') {
          const existingFolder = await findFolderByName(this.userId, name);
          
          if (existingFolder?.id) {
            return { success: true, data: existingFolder };
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async loadUserFolders(): Promise<DatabaseOperationResult<Array<Folder & { name: string }>>> {
    try {
      const folders = await getUserFolders(this.userId);

      const decryptedFolders = await Promise.all(
        folders.map(async (folder) => {
          const name = await decryptFolderName({
            content_encrypted: folder.name_encrypted!,
            content_iv: folder.name_iv!,
            content_tag: folder.name_tag!
          }, this.userId);
          
          return {
            ...folder,
            name: name || 'Unnamed Folder'
          };
        })
      );
      
      return { success: true, data: decryptedFolders };
    } catch (error) {
      console.error('Failed to load folders:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async updateUserFolder(folderId: string, updates: { name?: string; color?: string; position?: number }): Promise<DatabaseOperationResult<Folder>> {
    try {
      const dbUpdates: Partial<Folder> = {};

      if (updates.name !== undefined) {
        const encryptedName = await encryptFolderName(updates.name, this.userId);
        if (encryptedName) {
          dbUpdates.name_encrypted = encryptedName.content_encrypted;
          dbUpdates.name_iv = encryptedName.content_iv;
          dbUpdates.name_tag = encryptedName.content_tag;
        }
      }

      const folder = await updateFolder(this.userId, folderId, dbUpdates);
      return { success: true, data: folder };
    } catch (error) {
      console.error('Failed to update folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteUserFolder(folderId: string): Promise<DatabaseOperationResult<void>> {
    try {
      await deleteFolder(this.userId, folderId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async saveFoldersBatch(folders: Array<{ name: string; color?: string }>): Promise<BatchOperationResult<Folder>> {
    const results: Folder[] = [];
    const errors: string[] = [];
    let totalProcessed = 0;
    let totalFailed = 0;

    for (const folder of folders) {
      try {
        const result = await this.createUserFolder(folder.name);
        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push(result.error || 'Unknown error');
          totalFailed++;
        }
        totalProcessed++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown error');
        totalFailed++;
        totalProcessed++;
      }
    }

    return {
      success: totalFailed === 0,
      results,
      errors,
      totalProcessed,
      totalFailed
    };
  }

  // API Key Operations
  async createApiKey(encryptedApiKey: { encrypted: string; iv: string; tag: string }): Promise<DatabaseOperationResult<UserApiKey>> {
    try {
      const apiKey = await createUserApiKey({
        user_id: this.userId,
        litellm_api_key_encrypted_b64: encryptedApiKey.encrypted,
        litellm_api_key_iv_b64: encryptedApiKey.iv,
        litellm_api_key_tag_b64: encryptedApiKey.tag,
        is_active: true
      });

      return { success: true, data: apiKey };
    } catch (error) {
      console.error('Failed to create API key:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async loadApiKey(): Promise<DatabaseOperationResult<UserApiKey | null>> {
    try {
      const apiKey = await getUserApiKey(this.userId);
      return { success: true, data: apiKey };
    } catch (error) {
      console.error('Failed to load API key:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

/**
 * Factory function to create database service instances
 */
export function createDatabaseService(userId: string): DatabaseService {
  return new DatabaseService(userId);
}