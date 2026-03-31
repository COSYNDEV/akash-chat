import { executeQuery, executeQuerySingle } from './postgres';
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
  position?: number;
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
    SELECT * FROM upsert_user_preferences(
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    )
  `;

  const data = await executeQuerySingle<UserPreferences>(query, [
    user_id,
    selected_model,
    system_prompt_encrypted,
    system_prompt_iv,
    system_prompt_tag,
    temperature,
    top_p,
    last_selected_chat_id,
    last_selected_chat_updated_at
  ]);

  if (!data) {
    throw new Error('Failed to upsert user preferences');
  }
  return data;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const query = 'SELECT * FROM get_user_preferences($1)';
  const data = await executeQuerySingle<UserPreferences>(query, [userId]);
  return data;
}

// Folder Operations
export async function createFolder(userId: string, name: string): Promise<Folder> {
  const encryptedName = await encryptFolderName(name, userId);
  if (!encryptedName) {
    throw new Error('Failed to encrypt folder name');
  }

  const query = `
    SELECT * FROM insert_folder($1, $2, $3, $4)
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
  const query = 'SELECT * FROM get_user_folders($1)';
  const result = await executeQuery<Folder>(query, [userId]);
  return result.rows;
}

export async function folderExists(userId: string, folderId: string): Promise<boolean> {
  const query = 'SELECT folder_exists($1, $2) as exists';
  const data = await executeQuerySingle<{exists: boolean}>(query, [userId, folderId]);
  return data?.exists ?? false;
}

export async function findFolderByName(userId: string, folderName: string): Promise<Folder | null> {
  const query = 'SELECT * FROM get_user_folders($1)';
  const result = await executeQuery<Folder>(query, [userId]);

  if (result.rows.length === 0) {
    return null;
  }

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
        continue;
      }
    }
  }

  return null;
}

export async function updateFolder(userId: string, folderId: string, updates: Partial<Folder>) {
  const { name_encrypted, name_iv, name_tag } = updates;

  const query = `
    SELECT * FROM update_folder($1, $2, $3, $4, $5)
  `;

  const data = await executeQuerySingle<Folder>(query, [
    userId,
    folderId,
    name_encrypted,
    name_iv,
    name_tag
  ]);

  if (!data) {
    throw new Error('Failed to update folder');
  }
  return data;
}

export async function deleteFolder(userId: string, folderId: string) {
  const query = 'SELECT delete_folder($1, $2) as deleted';
  const result = await executeQuerySingle<{deleted: boolean}>(query, [userId, folderId]);

  if (!result?.deleted) {
    throw new Error('Failed to delete folder or folder not found');
  }
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
    SELECT * FROM insert_chat_session(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
  `;

  const data = await executeQuerySingle<ChatSession>(query, [
    id,
    user_id,
    folder_id,
    model_id,
    model_name,
    name_encrypted,
    name_iv,
    name_tag,
    system_prompt_encrypted,
    system_prompt_iv,
    system_prompt_tag,
    parent_chat_id,
    branched_at_index
  ]);

  if (!data) {
    throw new Error('Failed to create chat session');
  }
  return data;
}

export async function getUserChatSessions(userId: string): Promise<ChatSession[]> {
  const query = 'SELECT * FROM get_user_chat_sessions($1, 30)';
  const result = await executeQuery<ChatSession>(query, [userId]);
  return result.rows;
}

export async function updateChatSession(userId: string, sessionId: string, updates: Partial<ChatSession>) {
  const { folder_id, name_encrypted, name_iv, name_tag } = updates;

  const query = `
    SELECT * FROM update_chat_session($1, $2, $3, $4, $5, $6)
  `;

  const data = await executeQuerySingle<ChatSession>(query, [
    userId,
    sessionId,
    folder_id,
    name_encrypted,
    name_iv,
    name_tag
  ]);

  if (!data) {
    throw new Error('Failed to update chat session');
  }
  return data;
}

export async function deleteChatSession(userId: string, sessionId: string) {
  const query = 'SELECT delete_chat_session($1, $2) as deleted';
  const result = await executeQuerySingle<{deleted: boolean}>(query, [userId, sessionId]);

  if (!result?.deleted) {
    throw new Error('Failed to delete chat session or session not found');
  }
}

// Chat Message Operations
export async function createChatMessage(userId: string, message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage> {
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
    SELECT * FROM insert_chat_message($1, $2, $3, $4, $5, $6, $7, $8)
  `;

  const data = await executeQuerySingle<ChatMessage>(query, [
    userId,
    chat_session_id,
    role,
    position,
    content_encrypted,
    content_iv,
    content_tag,
    token_count
  ]);

  if (!data) {
    throw new Error('Failed to create chat message');
  }
  return data;
}

export async function getChatMessages(userId: string, chatSessionId: string): Promise<ChatMessage[]> {
  const query = 'SELECT * FROM get_chat_messages($1, $2)';
  const result = await executeQuery<ChatMessage>(query, [userId, chatSessionId]);
  return result.rows;
}

export async function getBulkChatMessages(userId: string, chatSessionIds: string[]): Promise<Map<string, ChatMessage[]>> {
  if (chatSessionIds.length === 0) {
    return new Map();
  }

  const query = 'SELECT * FROM get_bulk_chat_messages($1, $2)';
  const result = await executeQuery<ChatMessage>(query, [userId, chatSessionIds]);

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
export async function createSavedPrompt(prompt: Omit<SavedPrompt, 'id' | 'created_at' | 'updated_at'> & { position?: number }): Promise<SavedPrompt> {
  const {
    user_id,
    name_encrypted,
    name_iv,
    name_tag,
    content_encrypted,
    content_iv,
    content_tag,
    position
  } = prompt;

  const query = `
    SELECT * FROM insert_saved_prompt($1, $2, $3, $4, $5, $6, $7, $8)
  `;

  const data = await executeQuerySingle<SavedPrompt>(query, [
    user_id,
    name_encrypted,
    name_iv,
    name_tag,
    content_encrypted,
    content_iv,
    content_tag,
    position ?? 0
  ]);

  if (!data) {
    throw new Error('Failed to create saved prompt');
  }
  return data;
}

export async function getUserSavedPrompts(userId: string): Promise<SavedPrompt[]> {
  const query = 'SELECT * FROM get_user_saved_prompts($1)';
  const result = await executeQuery<SavedPrompt>(query, [userId]);
  return result.rows;
}

export async function updateSavedPrompt(userId: string, promptId: string, updates: Partial<SavedPrompt>) {
  const {
    name_encrypted,
    name_iv,
    name_tag,
    content_encrypted,
    content_iv,
    content_tag,
    position
  } = updates;

  const query = `
    SELECT * FROM update_saved_prompt($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;

  const data = await executeQuerySingle<SavedPrompt>(query, [
    userId,
    promptId,
    name_encrypted,
    name_iv,
    name_tag,
    content_encrypted,
    content_iv,
    content_tag,
    position
  ]);

  if (!data) {
    throw new Error('Failed to update saved prompt');
  }
  return data;
}

export async function deleteSavedPrompt(userId: string, promptId: string) {
  const query = 'SELECT delete_saved_prompt($1, $2) as deleted';
  const result = await executeQuerySingle<{deleted: boolean}>(query, [userId, promptId]);

  if (!result?.deleted) {
    throw new Error('Failed to delete saved prompt or prompt not found');
  }
}

export async function reorderSavedPrompts(userId: string, promptIds: string[]) {
  // Update each prompt's position individually
  for (let i = 0; i < promptIds.length; i++) {
    const query = 'SELECT * FROM update_saved_prompt($1, $2, $3, $4, $5, $6, $7, $8, $9)';
    await executeQuery(query, [
      userId,
      promptIds[i],
      null, // name_encrypted
      null, // name_iv
      null, // name_tag
      null, // content_encrypted
      null, // content_iv
      null, // content_tag
      i     // position
    ]);
  }
}

// User API Key Operations
export async function createUserApiKey(apiKey: Omit<UserApiKey, 'id' | 'created_at' | 'updated_at'>): Promise<UserApiKey> {
  const {
    user_id,
    litellm_api_key_encrypted_b64,
    litellm_api_key_iv_b64,
    litellm_api_key_tag_b64
  } = apiKey;

  const query = `
    SELECT * FROM insert_user_api_key($1, $2, $3, $4)
  `;

  const data = await executeQuerySingle<UserApiKey>(query, [
    user_id,
    litellm_api_key_encrypted_b64,
    litellm_api_key_iv_b64,
    litellm_api_key_tag_b64
  ]);

  if (!data) {
    throw new Error('Failed to create user API key');
  }
  return data;
}

export async function getUserApiKey(userId: string): Promise<UserApiKey | null> {
  const query = 'SELECT * FROM get_user_api_key($1)';
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
    SELECT * FROM update_user_api_key($1, $2, $3, $4)
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
  const query = 'SELECT delete_all_user_chat_history($1) as success';

  try {
    const result = await executeQuerySingle<{success: boolean}>(query, [userId]);
    if (result?.success) {
      console.log(`Successfully deleted chat history for user: ${userId}`);
    } else {
      throw new Error('Deletion failed');
    }
  } catch (error) {
    console.error('Error deleting chat sessions:', error);
    throw error;
  }
}

export async function deleteAllUserData(userId: string) {
  console.log(`Starting complete data deletion for user: ${userId}`);

  try {
    const query = 'SELECT delete_all_user_data($1) as success';
    const result = await executeQuerySingle<{success: boolean}>(query, [userId]);

    if (result?.success) {
      console.log(`Successfully deleted all data for user: ${userId} at ${new Date().toISOString()}`);
    } else {
      throw new Error('Deletion failed');
    }
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
