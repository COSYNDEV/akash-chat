import { DEFAULT_SYSTEM_PROMPT } from "@/app/config/api";

// Simple in-memory cache for user data
const userDataCache = new Map<string, { data: UserData; timestamp: number; ttl: number }>();

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// Cache cleanup interval: 10 minutes
const CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000;

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userDataCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      userDataCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

export interface UserData {
  preferences: {
    selectedModel?: string;
    systemPrompt?: string;
    temperature?: number;
    topP?: number;
  };
  chatSessions: any[];
  folders: any[];
  savedPrompts: any[];
}

/**
 * Load user data from database via API routes with caching
 */
export async function loadUserDataFromDatabase(userId: string): Promise<UserData> {
    // Check cache first
    const cached = userDataCache.get(userId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data;
    }
    
    // Use the new optimized unified API endpoint
    const response = await fetch('/api/user/data');
    
    if (!response.ok) {
      throw new Error(`Failed to load user data: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    const { data } = responseData;
    
    if (!data) {
      throw new Error('Invalid response format: missing data field');
    }
    
    const { preferences, chatSessions, folders, savedPrompts } = data;
    
    const userData = {
      preferences: preferences || {},
      chatSessions: chatSessions || [],
      folders: folders || [],
      savedPrompts: savedPrompts || []
    };
    
    // Cache the result
    userDataCache.set(userId, {
      data: userData,
      timestamp: now,
      ttl: CACHE_TTL
    });
    
    return userData;

}

/**
 * Apply loaded data to localStorage for backward compatibility
 */
export function applyDataToLocalStorage(userData: UserData) {
    // Apply preferences
    if (userData.preferences.selectedModel) {
      localStorage.setItem('selectedModel', userData.preferences.selectedModel);
    }
    if (userData.preferences.systemPrompt) {
      localStorage.setItem('currentSystemPrompt', userData.preferences.systemPrompt);
    }
    if (userData.preferences.temperature !== undefined && userData.preferences.temperature !== null) {
      localStorage.setItem('currentTemperature', userData.preferences.temperature.toString());
    }
    if (userData.preferences.topP !== undefined && userData.preferences.topP !== null) {
      localStorage.setItem('currentTopP', userData.preferences.topP.toString());
    }

    // Apply folders
    if (userData.folders.length > 0) {
      localStorage.setItem('folders', JSON.stringify(userData.folders));
    }

    // Apply saved prompts from database to localStorage (preserving existing local prompts)
    if (userData.savedPrompts.length > 0) {
      // Get existing local prompts
      const existingPromptsStr = localStorage.getItem('savedSystemPrompts');
      const existingPrompts = existingPromptsStr ? JSON.parse(existingPromptsStr) : [];
      
      // Convert database prompts to localStorage format with consistent source tagging
      const databasePrompts = userData.savedPrompts.map(prompt => ({
        id: prompt.id,
        name: prompt.name,
        content: prompt.content,
        source: 'database' as const, // Use consistent source tagging
        synced: true // Legacy field for backward compatibility
      }));
      
      // Create a Set of database prompt names for deduplication (case-insensitive)
      const dbPromptNames = new Set(databasePrompts.map(p => p.name.toLowerCase().trim()));
      
      // Preserve existing local prompts that don't conflict with database prompts
      const preservedLocalPrompts = existingPrompts.filter((localPrompt: any) => 
        localPrompt.source === 'local' && !dbPromptNames.has(localPrompt.name.toLowerCase().trim())
      );
      
      // Merge database prompts with preserved local prompts
      const mergedPrompts = [...databasePrompts, ...preservedLocalPrompts];
      
      localStorage.setItem('savedSystemPrompts', JSON.stringify(mergedPrompts));
    }
}

/**
 * Check if user has local data that needs syncing
 */
export function hasLocalDataToSync(): boolean {
    const allKeys = Object.keys(localStorage);
    
    const relevantKeys = allKeys.filter(key => 
      key.startsWith('selectedModel') ||
      key.startsWith('currentSystemPrompt') ||
      key.startsWith('currentTemperature') ||
      key.startsWith('currentTopP') ||
      key === 'chats' ||
      key === 'folders' ||
      key.startsWith('chat-') ||
      key.startsWith('folder-') ||
      key.startsWith('chatHistory')
    );
    
    return relevantKeys.length > 0;
}

/**
 * Check if user has data in database
 */
export async function hasDataInDatabase(): Promise<boolean> {
    const response = await fetch('/api/user/data');
    
    if (!response.ok) {
      return false;
    }
    
    const responseData = await response.json();
    
    const { data } = responseData;
    
    if (!data || !data.summary) {
      return false;
    }
    
    const { summary } = data;
    
    const hasData = !!(summary.hasPreferences || summary.chatCount > 0 || summary.folderCount > 0);
    
    return hasData;
}

/**
 * Clear all user data cache
 */
export function clearUserDataCache(): void {
  userDataCache.clear();
}

/**
 * Clear user's database-synced chats from localStorage while keeping local chats
 * Used when user deletes chat history from profile page
 */
export function clearUserChatsFromLocalStorage(): void {
  try {
    const chatsStr = localStorage.getItem('chats');
    if (chatsStr) {
      try {
        const chats = JSON.parse(chatsStr);
        // Keep only local chats that haven't been synced to database
        const localChats = chats.filter((chat: any) => 
          chat.source === 'local' && !chat.databaseId
        );
        
        if (localChats.length > 0) {
          localStorage.setItem('chats', JSON.stringify(localChats));
        } else {
          localStorage.removeItem('chats');
        }
      } catch (error) {
        localStorage.removeItem('chats');
      }
    }
  } catch (error) {
    console.error('Error clearing user chats from localStorage:', error);
  }
}

/**
 * Comprehensive cleanup of all user data on logout
 * This ensures no sensitive data persists between user sessions
 */
export function cleanupUserDataOnLogout(): void {
  try {
    // 1. Reset user preferences to defaults
    localStorage.setItem('currentSystemPrompt', DEFAULT_SYSTEM_PROMPT);
    localStorage.setItem('currentTemperature', '0.7');
    localStorage.setItem('currentTopP', '0.95');
    localStorage.removeItem('selectedModel');
    localStorage.removeItem('selectedChat');

    // 2. Clean up synced prompts (keep only local prompts)
    const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
    if (savedPromptsStr) {
      try {
        const savedPrompts = JSON.parse(savedPromptsStr);
        // Keep only local prompts (new source-based approach + legacy compatibility)
        const localPrompts = savedPrompts.filter((p: any) => 
          p.source === 'local' || (p.synced === false || (!p.id && p.synced !== true))
        );
        
        if (localPrompts.length > 0) {
          localStorage.setItem('savedSystemPrompts', JSON.stringify(localPrompts));
        } else {
          localStorage.removeItem('savedSystemPrompts');
        }
      } catch (error) {
        localStorage.removeItem('savedSystemPrompts');
      }
    }

    // 3. Clean up chat data (remove database chats, keep only local chats)
    const chatsStr = localStorage.getItem('chats');
    if (chatsStr) {
      try {
        const chats = JSON.parse(chatsStr);
        const localChats = chats.filter((chat: any) => 
          chat.source !== 'database' && !chat.databaseId
        );
        
        if (localChats.length > 0) {
          localStorage.setItem('chats', JSON.stringify(localChats));
        } else {
          localStorage.removeItem('chats');
        }
      } catch (error) {
        localStorage.removeItem('chats');
      }
    }

    // 4. Clean up folders (remove all folders as they're user-specific)  
    localStorage.removeItem('folders');

    // 5. Clean up private chats (stored separately from regular chats)
    localStorage.removeItem('privateChats');

    // 6. Clear any cached access tokens or auth data
    localStorage.removeItem('access_token');
    localStorage.removeItem('authToken');

    // 7. Clear any other user-specific localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('user-') || 
        key.startsWith('encrypted-') ||
        key.startsWith('sync-') ||
        key.includes('userId') ||
        key.includes('database')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // 8. Clear user data cache
    clearUserDataCache();
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    // Fallback: clear all localStorage if cleanup fails
    try {
      localStorage.clear();
    } catch (clearError) {
      console.error('Failed to clear localStorage:', clearError);
    }
  }
}