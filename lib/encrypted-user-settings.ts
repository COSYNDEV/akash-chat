import { safeSetItem } from '@/lib/local-storage-manager';

import {
  getUserPreferences,
  upsertUserPreferences,
  getUserSavedPrompts,
  createSavedPrompt,
  updateSavedPrompt,
  deleteSavedPrompt,
  reorderSavedPrompts
} from './database';
import { createEncryptionService } from './services/encryption-service';

export interface DecryptedUserPreferences {
  selected_model?: string;
  system_prompt?: string;
  temperature?: number;
  top_p?: number;
  last_selected_chat_id?: string;
}

export interface DecryptedSavedPrompt {
  id?: string;
  name: string;
  content: string;
  position?: number;
}

export interface DecryptedChatSession {
  id?: string;
  user_id: string;
  folder_id?: string;
  name: string;
  model_id: string;
  model_name: string;
  system_prompt?: string;
  parent_chat_id?: string;
  branched_at_index?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get user preferences with decryption
 */
export async function getDecryptedUserPreferences(userId: string): Promise<DecryptedUserPreferences | null> {
  try {
    const preferences = await getUserPreferences(userId);
    if (!preferences) {
      // Return empty preferences object for new users
      return {
        selected_model: undefined,
        system_prompt: undefined,
        temperature: undefined,
        top_p: undefined,
        last_selected_chat_id: undefined
      };
    }

    const encryptionService = createEncryptionService(userId);
    const decrypted: DecryptedUserPreferences = {
      selected_model: preferences.selected_model,
      temperature: preferences.temperature,
      top_p: preferences.top_p,
      last_selected_chat_id: preferences.last_selected_chat_id
    };

    // Decrypt system prompt if present and columns exist
    if (preferences.system_prompt_encrypted && preferences.system_prompt_iv && preferences.system_prompt_tag) {
      try {
        const systemPrompt = await encryptionService.decryptFromDatabase({
          content_encrypted: preferences.system_prompt_encrypted,
          content_iv: preferences.system_prompt_iv,
          content_tag: preferences.system_prompt_tag
        });
        decrypted.system_prompt = systemPrompt;
      } catch (error) {
        // Continue without the system prompt
      }
    }

    return decrypted;
  } catch (error) {
    // Return empty preferences object on error
    return {
      selected_model: undefined,
      system_prompt: undefined,
      temperature: undefined,
      top_p: undefined,
      last_selected_chat_id: undefined
    };
  }
}

/**
 * Save user preferences with encryption
 */
export async function saveEncryptedUserPreferences(
  userId: string, 
  preferences: DecryptedUserPreferences
): Promise<void> {
  try {
    const encryptionService = createEncryptionService(userId);
    const encryptedPreferences: any = {
      user_id: userId,
      selected_model: preferences.selected_model,
      temperature: preferences.temperature,
      top_p: preferences.top_p,
      last_selected_chat_id: preferences.last_selected_chat_id,
      last_selected_chat_updated_at: new Date().toISOString()
    };

    // Encrypt system prompt if present
    if (preferences.system_prompt) {
      try {
        const encrypted = await encryptionService.encryptForDatabase(preferences.system_prompt);
        encryptedPreferences.system_prompt_encrypted = encrypted.content_encrypted;
        encryptedPreferences.system_prompt_iv = encrypted.content_iv;
        encryptedPreferences.system_prompt_tag = encrypted.content_tag;
      } catch (encryptError) {
        // Continue without encrypting the system prompt
      }
    }

    await upsertUserPreferences(encryptedPreferences);
  } catch (error) {
    console.log('Continuing without saving preferences due to error');
  }
}

/**
 * Get saved prompts with decryption
 */
export async function getDecryptedSavedPrompts(userId: string): Promise<DecryptedSavedPrompt[]> {
  try {
    const prompts = await getUserSavedPrompts(userId);
    const encryptionService = createEncryptionService(userId);
    
    const decryptedPrompts = await Promise.all(prompts.map(async prompt => {
      try {
        // Check if the required fields exist (for migration safety)
        if (!prompt.name_encrypted || !prompt.name_iv || !prompt.name_tag ||
            !prompt.content_encrypted || !prompt.content_iv || !prompt.content_tag) {
          // console.warn('Prompt missing required encrypted fields, skipping:', prompt.id);
          return null;
        }

        // Decrypt name using the new EncryptionService (handles both old and new formats)
        const name = await encryptionService.decryptFromDatabase({
          content_encrypted: prompt.name_encrypted,
          content_iv: prompt.name_iv,
          content_tag: prompt.name_tag
        });
        
        // Decrypt content using the new EncryptionService (handles both old and new formats)
        const content = await encryptionService.decryptFromDatabase({
          content_encrypted: prompt.content_encrypted,
          content_iv: prompt.content_iv,
          content_tag: prompt.content_tag
        });
        
        return {
          id: prompt.id,
          name,
          content,
        };
      } catch (error) {
        // console.error('Failed to decrypt prompt:', error);
        return null;
      }
    }));
    
    return decryptedPrompts.filter(Boolean) as DecryptedSavedPrompt[];
  } catch (error) {
    return [];
  }
}

/**
 * Save a prompt with encryption
 */
export async function saveEncryptedPrompt(
  userId: string,
  name: string,
  content: string,
): Promise<string> {

  const encryptionService = createEncryptionService(userId);
  const nameEncrypted = await encryptionService.encryptForDatabase(name);
  const contentEncrypted = await encryptionService.encryptForDatabase(content);

  const prompt = await createSavedPrompt({
    user_id: userId,
    name_encrypted: nameEncrypted.content_encrypted,
    name_iv: nameEncrypted.content_iv,
    name_tag: nameEncrypted.content_tag,
    content_encrypted: contentEncrypted.content_encrypted,
    content_iv: contentEncrypted.content_iv,
    content_tag: contentEncrypted.content_tag
  });
      
  if (!prompt?.id) {
    throw new Error(`createSavedPrompt did not return an ID. Got: ${JSON.stringify(prompt)}`);
  }
      
  return prompt.id;
}

/**
 * Update a saved prompt
 */
export async function updateEncryptedPrompt(
  promptId: string,
  userId: string,
  updates: Partial<{ name: string; content: string }>
): Promise<void> {
  try {
    const encryptionService = createEncryptionService(userId);
    const encryptedUpdates: any = {};
    
    if (updates.name !== undefined) {
      const nameEncrypted = await encryptionService.encryptForDatabase(updates.name);
      encryptedUpdates.name_encrypted = nameEncrypted.content_encrypted;
      encryptedUpdates.name_iv = nameEncrypted.content_iv;
      encryptedUpdates.name_tag = nameEncrypted.content_tag;
    }
    
    if (updates.content !== undefined) {
      const contentEncrypted = await encryptionService.encryptForDatabase(updates.content);
      encryptedUpdates.content_encrypted = contentEncrypted.content_encrypted;
      encryptedUpdates.content_iv = contentEncrypted.content_iv;
      encryptedUpdates.content_tag = contentEncrypted.content_tag;
    }
    
    await updateSavedPrompt(userId, promptId, encryptedUpdates);
  } catch (error) {
    console.error('Failed to update prompt:', error);
    throw error;
  }
}

/**
 * Delete a saved prompt
 */
export async function deleteEncryptedPrompt(userId: string, promptId: string): Promise<void> {
  try {
    await deleteSavedPrompt(userId, promptId);
  } catch (error) {
    console.error('Failed to delete prompt:', error);
    throw error;
  }
}

/**
 * Reorder saved prompts
 */
export async function reorderEncryptedPrompts(userId: string, promptIds: string[]): Promise<void> {
  try {
    await reorderSavedPrompts(userId, promptIds);
  } catch (error) {
    console.error('Failed to reorder prompts:', error);
    throw error;
  }
}

/**
 * Sync user settings from localStorage to database
 */
export async function syncUserSettingsToDatabase(
  userId: string, 
  localStorageData?: {
    selectedModel?: string;
    systemPrompt?: string;
    temperature?: string;
    topP?: string;
    lastSelectedChat?: string;
    savedPrompts?: Array<{ name: string; content: string }>;
  }
): Promise<void> {
    
    // If no localStorage data provided, skip sync
    if (!localStorageData) {
      return;
    }

    const { selectedModel, systemPrompt, temperature, topP, lastSelectedChat, savedPrompts } = localStorageData;
    
    // Sync user preferences
    if (selectedModel || systemPrompt || temperature || topP || lastSelectedChat) {
      await saveEncryptedUserPreferences(userId, {
        selected_model: selectedModel || undefined,
        system_prompt: systemPrompt || undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        top_p: topP ? parseFloat(topP) : undefined,
        last_selected_chat_id: lastSelectedChat || undefined
      });
    }
    
    // Sync saved prompts
    if (savedPrompts && savedPrompts.length > 0) {
      
      // Get existing prompts from database
      const existingPrompts = await getDecryptedSavedPrompts(userId);
      const existingNames = new Set(existingPrompts.map(p => p.name));
      
      for (const prompt of savedPrompts) {
        if (!existingNames.has(prompt.name)) {
          await saveEncryptedPrompt(userId, prompt.name, prompt.content);
        }
      }
      
    }
}

/**
 * Sync user settings from database to localStorage
 */
export async function syncUserSettingsFromDatabase(userId: string): Promise<void> {
    const preferences = await getDecryptedUserPreferences(userId);
    if (preferences) {
      if (preferences.selected_model) {
        safeSetItem('selectedModel', preferences.selected_model);
      }
      if (preferences.system_prompt) {
        safeSetItem('currentSystemPrompt', preferences.system_prompt);
      }
      if (preferences.temperature !== undefined) {
        safeSetItem('currentTemperature', preferences.temperature.toString());
      }
      if (preferences.top_p !== undefined) {
        safeSetItem('currentTopP', preferences.top_p.toString());
      }
      if (preferences.last_selected_chat_id) {
        safeSetItem('selectedChat', preferences.last_selected_chat_id);
      }
    }
    
    // Sync saved prompts
    const savedPrompts = await getDecryptedSavedPrompts(userId);
    if (savedPrompts.length > 0) {
      const promptsForLocalStorage = savedPrompts.map(p => ({
        name: p.name,
        content: p.content
      }));
      safeSetItem('savedSystemPrompts', JSON.stringify(promptsForLocalStorage));
    }
}
