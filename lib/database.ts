import { executeQuery, executeQuerySingle, withTransaction } from './postgres';
import { encryptFolderName, decryptFolderName } from './services/encryption-service';

export interface UserPreferences {
  id?: string;
  user_id: string;
  selected_model?: string;
  system_prompt_encrypted?: string;
  system_prompt_iv?: string;
  system_prompt_tag?: string;
  temperature?: number;
  top_p?: number;
  last_selected_chat_id?: string;
  last_selected_chat_updated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SavedPrompt {
  id?: string;
  user_id: string;
  name_encrypted: string;
  name_iv: string;
  name_tag: string;
  content_encrypted: string;
  content_iv: string;
  content_tag: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatSession {
  id?: string;
  user_id: string;
  folder_id?: string;
  name_encrypted?: string;
  name_iv?: string;
  name_tag?: string;
  model_id: string;
  model_name: string;
  system_prompt_encrypted?: string;
  system_prompt_iv?: string;
  system_prompt_tag?: string;
  parent_chat_id?: string;
  branched_at_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  id?: string;
  chat_session_id: string;
  role: 'user' | 'assistant' | 'system';
  position: number;
  content_encrypted: string;
  content_iv: string;
  content_tag: string;
  token_count?: number;
  created_at?: string;
}

export interface Folder {
  id?: string;
  user_id: string;
  name_encrypted?: string;
  name_iv?: string; 
  name_tag?: string;
  color?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserApiKey {
  id?: string;
  user_id: string;
  litellm_api_key_encrypted_b64: string;
  litellm_api_key_iv_b64: string;
  litellm_api_key_tag_b64: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  last_used_at?: string;
  total_requests?: number;
  total_tokens?: number;
  total_cost_usd?: number;
}

// User Preferences Operations
export async function upsertUserPreferences(preferences: UserPreferences) {
  const {
    user_id,
    selected_model,
    system_prompt_encrypted,
    system_prompt_iv,
    system_prompt_tag,
    temperature,
    top_p,
    last_selected_chat_id,
    last_selected_chat_updated_at
  } = preferences;

  const query = `
    INSERT INTO user_preferences (
      user_id, selected_model, system_prompt_encrypted, system_prompt_iv, 
      system_prompt_tag, temperature, top_p, last_selected_chat_id, 
      last_selected_chat_updated_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      selected_model = EXCLUDED.selected_model,
      system_prompt_encrypted = EXCLUDED.system_prompt_encrypted,
      system_prompt_iv = EXCLUDED.system_prompt_iv,
      system_prompt_tag = EXCLUDED.system_prompt_tag,
      temperature = EXCLUDED.temperature,
      top_p = EXCLUDED.top_p,
      last_selected_chat_id = EXCLUDED.last_selected_chat_id,
      last_selected_chat_updated_at = EXCLUDED.last_selected_chat_updated_at,
      updated_at = NOW()
    RETURNING *
  `;
  
  const data = await executeQuerySingle<UserPreferences>(query, [
    user_id, selected_model, system_prompt_encrypted, system_prompt_iv,
    system_prompt_tag, temperature, top_p, last_selected_chat_id,
    last_selected_chat_updated_at
  ]);
  
  if (!data) {
    throw new Error('Failed to upsert user preferences');
  }
  return data;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const query = 'SELECT * FROM user_preferences WHERE user_id = $1';
  const data = await executeQuerySingle<UserPreferences>(query, [userId]);
  return data;
}

// Folder Operations
export async function createFolder(userId: string, name: string): Promise<Folder> {
  // Encrypt the folder name
  const encryptedName = await encryptFolderName(name, userId);
  if (!encryptedName) {
    throw new Error('Failed to encrypt folder name');
  }
  
  const query = `
    INSERT INTO folders (user_id, name_encrypted, name_iv, name_tag, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING *
  `;
  
  const data = await executeQuerySingle<Folder>(query, [
    userId,
    encryptedName.content_encrypted,
    encryptedName.content_iv,
    encryptedName.content_tag,
  ]);
  
  if (!data) {
    throw new Error('Failed to create folder');
  }
  return data;
}

export async function getUserFolders(userId: string): Promise<Folder[]> {
  const query = 'SELECT * FROM folders WHERE user_id = $1 ORDER BY created_at ASC';
  const result = await executeQuery<Folder>(query, [userId]);
  return result.rows;
}

export async function folderExists(userId: string, folderId: string): Promise<boolean> {
  const query = 'SELECT id FROM folders WHERE id = $1 AND user_id = $2';
  const data = await executeQuerySingle(query, [folderId, userId]);
  return data !== null;
}

export async function findFolderByName(userId: string, folderName: string): Promise<Folder | null> {
  const query = 'SELECT * FROM folders WHERE user_id = $1';
  const result = await executeQuery<Folder>(query, [userId]);
  
  if (result.rows.length === 0) {
    return null;
  }

  // Decrypt folder names and find match
  const folders = result.rows;
  for (const folder of folders) {
    if (folder.name_encrypted && folder.name_iv && folder.name_tag) {
      try {
        const decryptedName = await decryptFolderName({
          content_encrypted: folder.name_encrypted,
          content_iv: folder.name_iv,
          content_tag: folder.name_tag
        }, userId);
        
        if (decryptedName === folderName) {
          return folder;
        }
      } catch (error) {
        // Skip if decryption fails
        continue;
      }
    }
  }
  
  return null;
}

export async function updateFolder(folderId: string, updates: Partial<Folder>) {
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  let paramCount = 1;
  
  // Remove updated_at from updates to avoid duplicate assignment
  const { updated_at, ...updatesWithoutTimestamp } = updates;
  
  for (const [key, value] of Object.entries(updatesWithoutTimestamp)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }
  
  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }
  
  updateFields.push('updated_at = NOW()');
  values.push(folderId);
  
  const query = `
    UPDATE folders 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;
  
  const data = await executeQuerySingle<Folder>(query, values);
  if (!data) {
    throw new Error('Failed to update folder');
  }
  return data;
}

export async function deleteFolder(folderId: string) {
  await withTransaction(async (client) => {
    // First delete all chat sessions in this folder
    await client.query('DELETE FROM chat_sessions WHERE folder_id = $1', [folderId]);
    
    // Then delete the folder itself
    await client.query('DELETE FROM folders WHERE id = $1', [folderId]);
  });
}

// Chat Session Operations
export async function createChatSession(chatSession: Omit<ChatSession, 'created_at' | 'updated_at'>): Promise<ChatSession> {
  const {
    id,
    user_id,
    folder_id,
    name_encrypted,
    name_iv,
    name_tag,
    model_id,
    model_name,
    system_prompt_encrypted,
    system_prompt_iv,
    system_prompt_tag,
    parent_chat_id,
    branched_at_index
  } = chatSession;

  const query = `
    INSERT INTO chat_sessions (
      id, user_id, folder_id, name_encrypted, name_iv, name_tag,
      model_id, model_name, system_prompt_encrypted, system_prompt_iv,
      system_prompt_tag, parent_chat_id, branched_at_index, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      folder_id = EXCLUDED.folder_id,
      name_encrypted = EXCLUDED.name_encrypted,
      name_iv = EXCLUDED.name_iv,
      name_tag = EXCLUDED.name_tag,
      model_id = EXCLUDED.model_id,
      model_name = EXCLUDED.model_name,
      system_prompt_encrypted = EXCLUDED.system_prompt_encrypted,
      system_prompt_iv = EXCLUDED.system_prompt_iv,
      system_prompt_tag = EXCLUDED.system_prompt_tag,
      parent_chat_id = EXCLUDED.parent_chat_id,
      branched_at_index = EXCLUDED.branched_at_index,
      updated_at = NOW()
    RETURNING *
  `;
  
  const data = await executeQuerySingle<ChatSession>(query, [
    id, user_id, folder_id, name_encrypted, name_iv, name_tag,
    model_id, model_name, system_prompt_encrypted, system_prompt_iv,
    system_prompt_tag, parent_chat_id, branched_at_index
  ]);
  
  if (!data) {
    throw new Error('Failed to create chat session');
  }
  return data;
}

export async function getUserChatSessions(userId: string): Promise<ChatSession[]> {
  const query = 'SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30';
  const result = await executeQuery<ChatSession>(query, [userId]);
  return result.rows;
}

export async function updateChatSession(sessionId: string, updates: Partial<ChatSession>) {
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  let paramCount = 1;
  
  // Remove updated_at from updates to avoid duplicate assignment
  const { updated_at, ...updatesWithoutTimestamp } = updates;
  
  for (const [key, value] of Object.entries(updatesWithoutTimestamp)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }
  
  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }
  
  updateFields.push('updated_at = NOW()');
  values.push(sessionId);
  
  const query = `
    UPDATE chat_sessions 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;
  
  const data = await executeQuerySingle<ChatSession>(query, values);
  if (!data) {
    throw new Error('Failed to update chat session');
  }
  return data;
}

export async function deleteChatSession(sessionId: string) {
  const query = 'DELETE FROM chat_sessions WHERE id = $1';
  await executeQuery(query, [sessionId]);
}

// Chat Message Operations
export async function createChatMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage> {
  const {
    chat_session_id,
    role,
    position,
    content_encrypted,
    content_iv,
    content_tag,
    token_count
  } = message;

  const query = `
    INSERT INTO chat_messages (
      chat_session_id, role, position, content_encrypted,
      content_iv, content_tag, token_count, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (chat_session_id, position) DO UPDATE SET
      role = EXCLUDED.role,
      content_encrypted = EXCLUDED.content_encrypted,
      content_iv = EXCLUDED.content_iv,
      content_tag = EXCLUDED.content_tag,
      token_count = EXCLUDED.token_count
    RETURNING *
  `;
  
  const data = await executeQuerySingle<ChatMessage>(query, [
    chat_session_id, role, position, content_encrypted,
    content_iv, content_tag, token_count
  ]);
  
  if (!data) {
    throw new Error('Failed to create chat message');
  }
  return data;
}

export async function getChatMessages(chatSessionId: string): Promise<ChatMessage[]> {
  const query = 'SELECT * FROM chat_messages WHERE chat_session_id = $1 ORDER BY position ASC';
  const result = await executeQuery<ChatMessage>(query, [chatSessionId]);
  return result.rows;
}

export async function getBulkChatMessages(chatSessionIds: string[]): Promise<Map<string, ChatMessage[]>> {
  if (chatSessionIds.length === 0) {
    return new Map();
  }

  // Create placeholder string for IN clause
  const placeholders = chatSessionIds.map((_, index) => `$${index + 1}`).join(',');
  const query = `
    SELECT * FROM chat_messages 
    WHERE chat_session_id IN (${placeholders})
    ORDER BY chat_session_id ASC, position ASC
  `;
  
  const result = await executeQuery<ChatMessage>(query, chatSessionIds);
  
  // Group messages by chat session ID
  const messagesByChat = new Map<string, ChatMessage[]>();
  
  for (const message of result.rows) {
    const chatId = message.chat_session_id;
    if (!messagesByChat.has(chatId)) {
      messagesByChat.set(chatId, []);
    }
    messagesByChat.get(chatId)!.push(message);
  }
  
  return messagesByChat;
}

// Saved Prompts Operations
export async function createSavedPrompt(prompt: Omit<SavedPrompt, 'id' | 'created_at' | 'updated_at'>): Promise<SavedPrompt> {
  const {
    user_id,
    name_encrypted,
    name_iv,
    name_tag,
    content_encrypted,
    content_iv,
    content_tag,
  } = prompt;

  const query = `
    INSERT INTO saved_prompts (
      user_id, name_encrypted, name_iv, name_tag,
      content_encrypted, content_iv, content_tag,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING *
  `;
  
  const data = await executeQuerySingle<SavedPrompt>(query, [
    user_id, name_encrypted, name_iv, name_tag,
    content_encrypted, content_iv, content_tag
  ]);
  
  if (!data) {
    throw new Error('Failed to create saved prompt');
  }
  return data;
}

export async function getUserSavedPrompts(userId: string): Promise<SavedPrompt[]> {
  const query = 'SELECT * FROM saved_prompts WHERE user_id = $1 ORDER BY position ASC';
  const result = await executeQuery<SavedPrompt>(query, [userId]);
  return result.rows;
}

export async function updateSavedPrompt(promptId: string, updates: Partial<SavedPrompt>) {
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  let paramCount = 1;
  
  // Remove updated_at from updates to avoid duplicate assignment
  const { updated_at, ...updatesWithoutTimestamp } = updates;
  
  for (const [key, value] of Object.entries(updatesWithoutTimestamp)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }
  
  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }
  
  updateFields.push('updated_at = NOW()');
  values.push(promptId);
  
  const query = `
    UPDATE saved_prompts 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;
  
  const data = await executeQuerySingle<SavedPrompt>(query, values);
  if (!data) {
    throw new Error('Failed to update saved prompt');
  }
  return data;
}

export async function deleteSavedPrompt(promptId: string) {
  const query = 'DELETE FROM saved_prompts WHERE id = $1';
  await executeQuery(query, [promptId]);
}

export async function reorderSavedPrompts(userId: string, promptIds: string[]) {
  await withTransaction(async (client) => {
    for (let i = 0; i < promptIds.length; i++) {
      await client.query(
        'UPDATE saved_prompts SET position = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
        [i, promptIds[i], userId]
      );
    }
  });
}

// User API Key Operations
export async function createUserApiKey(apiKey: Omit<UserApiKey, 'id' | 'created_at' | 'updated_at'>): Promise<UserApiKey> {
  const {
    user_id,
    litellm_api_key_encrypted_b64,
    litellm_api_key_iv_b64,
    litellm_api_key_tag_b64,
    is_active
  } = apiKey;

  const query = `
    INSERT INTO user_api_keys (
      user_id, litellm_api_key_encrypted_b64, litellm_api_key_iv_b64,
      litellm_api_key_tag_b64, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING *
  `;
  
  const data = await executeQuerySingle<UserApiKey>(query, [
    user_id, litellm_api_key_encrypted_b64, litellm_api_key_iv_b64,
    litellm_api_key_tag_b64, is_active
  ]);
  
  if (!data) {
    throw new Error('Failed to create user API key');
  }
  return data;
}

export async function getUserApiKey(userId: string): Promise<UserApiKey | null> {
  const query = 'SELECT * FROM user_api_keys WHERE user_id = $1 AND is_active = true';
  const data = await executeQuerySingle<UserApiKey>(query, [userId]);
  return data;
}

export async function updateUserApiKey(
  userId: string,
  encryptedData: {
    litellm_api_key_encrypted_b64: string;
    litellm_api_key_iv_b64: string;
    litellm_api_key_tag_b64: string;
  }
): Promise<UserApiKey> {
  const query = `
    UPDATE user_api_keys
    SET litellm_api_key_encrypted_b64 = $2,
        litellm_api_key_iv_b64 = $3,
        litellm_api_key_tag_b64 = $4,
        updated_at = NOW()
    WHERE user_id = $1 AND is_active = true
    RETURNING *
  `;

  const data = await executeQuerySingle<UserApiKey>(query, [
    userId,
    encryptedData.litellm_api_key_encrypted_b64,
    encryptedData.litellm_api_key_iv_b64,
    encryptedData.litellm_api_key_tag_b64
  ]);

  if (!data) {
    throw new Error('Failed to update user API key');
  }
  return data;
}

// Batch Deletion Operations
export async function deleteAllUserChatHistory(userId: string) {  
  // Use database cascading delete - messages will be deleted automatically
  // due to ON DELETE CASCADE in the schema
  const query = 'DELETE FROM chat_sessions WHERE user_id = $1';
  
  try {
    await executeQuery(query, [userId]);
    console.log(`Successfully deleted chat history for user: ${userId}`);
  } catch (error) {
    console.error('Error deleting chat sessions:', error);
    throw error;
  }
}

export async function deleteAllUserData(userId: string) {
  console.log(`Starting complete data deletion for user: ${userId}`);
  
  try {
    await withTransaction(async (client) => {
      // Delete all user data in proper order (respecting foreign key constraints)
      // Chat sessions will cascade delete messages automatically
      
      // Delete chat sessions (cascades to messages)
      await client.query('DELETE FROM chat_sessions WHERE user_id = $1', [userId]);
      
      // Delete independent tables
      await client.query('DELETE FROM folders WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
      
      // Delete optional tables (ignore errors if tables don't exist)
      try {
        await client.query('DELETE FROM saved_prompts WHERE user_id = $1', [userId]);
      } catch (error: any) {
        if (error.code !== '42P01') { // Not "table does not exist"
          console.error('Error deleting from saved_prompts:', error);
        }
      }
      
      try {
        await client.query('DELETE FROM user_api_keys WHERE user_id = $1', [userId]);
      } catch (error: any) {
        if (error.code !== '42P01') { // Not "table does not exist"
          console.error('Error deleting from user_api_keys:', error);
        }
      }
    });
    
    console.log(`Successfully deleted all data for user: ${userId} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error in user data deletion:', error);
    throw error;
  }
}

// User Tiers Management
export interface UserTier {
  id?: string;
  name: string;
  display_name: string;
  token_limit: number;
  rate_limit_window_ms: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface Model {
  id?: string;
  model_id: string;
  api_id?: string;
  name: string;
  description?: string;
  tier_requirement: string;
  available: boolean;
  token_multiplier: number;
  temperature?: number;
  top_p?: number;
  token_limit?: number;
  owned_by?: string;
  parameters?: string;
  architecture?: string;
  hf_repo?: string;
  about_content?: string;
  info_content?: string;
  thumbnail_id?: string;
  deploy_url?: string;
  display_order: number;
  created_at?: Date;
  updated_at?: Date;
  // New fields for API availability and categorization
  category?: string;
  is_api_available?: boolean;
  is_chat_available?: boolean;
}

/**
 * Get user's tier information
 * Anonymous users (no userId) default to permissionless tier
 * Only extended/pro users have user_preferences records
 */
export async function getUserTier(userId: string | null): Promise<UserTier | null> {
  if (!userId) {
    // Anonymous user - return permissionless tier
    const query = `SELECT * FROM user_tiers WHERE name = 'permissionless' LIMIT 1`;
    const result = await executeQuery<UserTier>(query, []);
    const tier = result.rows[0] || null;
    return tier;
  }
  
  const query = `
    SELECT ut.* FROM user_tiers ut
    JOIN user_preferences up ON up.tier_id = ut.id
    WHERE up.user_id = $1
  `;
  
  const result = await executeQuery<UserTier>(query, [userId]);
  if (result.rows[0]) {
    return result.rows[0];
  }
  
  // User exists but no preferences record - they're anonymous/permissionless
  const permissionlessQuery = `SELECT * FROM user_tiers WHERE name = 'permissionless' LIMIT 1`;
  const permissionlessResult = await executeQuery<UserTier>(permissionlessQuery, []);
  const fallbackTier = permissionlessResult.rows[0] || null;
  return fallbackTier;
}

/**
 * Get all available user tiers
 */
export async function getAllUserTiers(): Promise<UserTier[]> {
  const query = 'SELECT * FROM user_tiers ORDER BY token_limit ASC';
  const result = await executeQuery<UserTier>(query, []);
  return result.rows;
}

/**
 * Update user's tier
 */
export async function updateUserTier(userId: string, tierName: string): Promise<boolean> {
  const query = `
    UPDATE user_preferences 
    SET tier_id = (SELECT id FROM user_tiers WHERE name = $2 LIMIT 1), updated_at = NOW()
    WHERE user_id = $1
  `;
  
  const result = await executeQuery(query, [userId, tierName]);
  return result.rowCount > 0;
}

/**
 * Get models available to user's tier
 */
export async function getModelsForUserTier(userId: string): Promise<Model[]> {
  const query = `
    SELECT m.* FROM models m
    JOIN user_tiers ut ON (
      ut.name = 'pro' OR 
      (ut.name = 'extended' AND m.tier_requirement IN ('permissionless', 'extended')) OR
      (ut.name = 'permissionless' AND m.tier_requirement = 'permissionless')
    )
    JOIN user_preferences up ON up.tier_id = ut.id
    WHERE up.user_id = $1 AND m.available = true
    ORDER BY m.display_order ASC, m.name ASC
  `;
  
  const result = await executeQuery<Model>(query, [userId]);
  return result.rows;
}

/**
 * Get all models (includes all tiers and availability states)
 */
export async function getAllModels(): Promise<Model[]> {
  const query = 'SELECT * FROM models ORDER BY display_order ASC, name ASC';
  const result = await executeQuery<Model>(query, []);
  return result.rows;
}

/**
 * Get models for a specific tier
 */
export async function getModelsForTier(tierName: string): Promise<Model[]> {
  let tierCondition = '';
  
  switch (tierName) {
    case 'pro':
      tierCondition = "tier_requirement IN ('permissionless', 'extended', 'pro')";
      break;
    case 'extended':
      tierCondition = "tier_requirement IN ('permissionless', 'extended')";
      break;
    case 'permissionless':
    default:
      tierCondition = "tier_requirement = 'permissionless'";
      break;
  }
  
  const query = `
    SELECT * FROM models 
    WHERE available = true AND ${tierCondition}
    ORDER BY display_order ASC, name ASC
  `;
  
  const result = await executeQuery<Model>(query, []);
  return result.rows;
}

/**
 * Get model by model_id (includes token_multiplier for backend use)
 */
export async function getModelByModelId(modelId: string): Promise<Model | null> {
  const query = 'SELECT * FROM models WHERE model_id = $1 AND available = true';
  const result = await executeQuery<Model>(query, [modelId]);
  const model = result.rows[0] || null;
  return model;
}

/**
 * Create or update a model (admin function)
 */
export async function upsertModel(model: Partial<Model>): Promise<Model | null> {
  const {
    model_id, api_id, name, description, tier_requirement, available,
    token_multiplier, temperature, top_p, token_limit, owned_by,
    parameters, architecture, hf_repo, about_content, info_content,
    thumbnail_id, deploy_url, display_order, category, is_api_available, is_chat_available
  } = model;
  
  const query = `
    INSERT INTO models (
      model_id, api_id, name, description, tier_requirement, available,
      token_multiplier, temperature, top_p, token_limit, owned_by,
      parameters, architecture, hf_repo, about_content, info_content,
      thumbnail_id, deploy_url, display_order, category, is_api_available, is_chat_available
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
    )
    ON CONFLICT (model_id) DO UPDATE SET
      api_id = EXCLUDED.api_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      tier_requirement = EXCLUDED.tier_requirement,
      available = EXCLUDED.available,
      token_multiplier = EXCLUDED.token_multiplier,
      temperature = EXCLUDED.temperature,
      top_p = EXCLUDED.top_p,
      token_limit = EXCLUDED.token_limit,
      owned_by = EXCLUDED.owned_by,
      parameters = EXCLUDED.parameters,
      architecture = EXCLUDED.architecture,
      hf_repo = EXCLUDED.hf_repo,
      about_content = EXCLUDED.about_content,
      info_content = EXCLUDED.info_content,
      thumbnail_id = EXCLUDED.thumbnail_id,
      deploy_url = EXCLUDED.deploy_url,
      display_order = EXCLUDED.display_order,
      category = EXCLUDED.category,
      is_api_available = EXCLUDED.is_api_available,
      is_chat_available = EXCLUDED.is_chat_available,
      updated_at = NOW()
    RETURNING *
  `;
  
  const values = [
    model_id, api_id, name, description, tier_requirement || 'permissionless', available !== false,
    token_multiplier || 1.0, temperature || 0.7, top_p || 0.95, token_limit || 4096,
    owned_by, parameters, architecture, hf_repo, about_content, info_content,
    thumbnail_id, deploy_url, display_order || 0, category, is_api_available, is_chat_available
  ];
  
  const result = await executeQuerySingle<Model>(query, values);
  return result;
}
