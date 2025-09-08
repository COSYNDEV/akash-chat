import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

import { cleanupDuplicatePrompts } from '@/lib/data-sync';

export interface SavedPrompt {
  id?: string;
  name: string;
  content: string;
  position?: number;
  source?: 'local' | 'database';
  synced?: boolean;
}

export interface UserPreferences {
  selected_model?: string;
  system_prompt?: string;
  temperature?: number;
  top_p?: number;
  last_selected_chat_id?: string;
}

export function useEncryptedSettings() {
  const { user, isLoading: isAuthLoading } = useUser();
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Debounced sync state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const lastScheduleTimeRef = useRef<number>(0);
  const pendingChangesRef = useRef<{
    preferences?: UserPreferences;
    prompts?: SavedPrompt[];
  }>({});
  
  // Request deduplication
  const loadRequestRef = useRef<Promise<void> | null>(null);
  const debouncedSyncRequestRef = useRef<Promise<void> | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  // Debounced sync function
  const debouncedSync = useCallback(async () => {
    if (!user?.sub || !hasUnsavedChanges) return;

    // Deduplicate concurrent requests
    if (debouncedSyncRequestRef.current) {
      return debouncedSyncRequestRef.current;
    }

    // Rate limiting: prevent syncs more frequently than every 10 seconds
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 10000) {
      return;
    }

    const syncPromise = (async () => {
      try {
        setIsLoading(true);
        lastSyncTimeRef.current = now;
      
      const changes = pendingChangesRef.current;
      let synced = false;

      // Sync preferences if changed
      if (changes.preferences) {
        const response = await fetch('/api/user/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_preferences',
            data: changes.preferences
          }),
        });
        if (response.ok) {
          setUserPreferences(changes.preferences);
          synced = true;
        }
      }

      // Sync prompts if changed
      if (changes.prompts) {
        // Get current prompts from database to compare
        const response = await fetch('/api/user/settings', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const data = await response.json();
          const currentDbPrompts = data.savedPrompts || [];
          const newLocalPrompts = changes.prompts;
          
          // Find prompts that exist in database but not in local state (deleted)
          // Now we can use ID-based matching since all prompts should have IDs
          const deletedPrompts = currentDbPrompts.filter((dbPrompt: any) => 
            !newLocalPrompts.some(localPrompt => {
              // Primary match by ID (preferred)
              if (localPrompt.id && dbPrompt.id) {
                return localPrompt.id === dbPrompt.id;
              }
              // Fallback match by name for any remaining prompts without IDs
              if (!localPrompt.id && dbPrompt.name) {
                return localPrompt.name === dbPrompt.name;
              }
              return false;
            })
          );
          
          // Find prompts that are new or updated in local state
          const newOrUpdatedPrompts = newLocalPrompts.filter(p => !p.id || p.synced !== true);
          
          
          // Delete prompts that were removed
          for (const prompt of deletedPrompts) {
            // Only delete if it has an ID (database prompt)
            if (prompt.id) {
              const deleteResponse = await fetch('/api/user/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'delete_prompt',
                  data: { promptId: prompt.id }
                }),
              });
              if (deleteResponse.ok) {
                synced = true;
              } else {
              }
            } else {
            }
          }
          
          // Save new or updated prompts
          if (newOrUpdatedPrompts.length > 0) {
            const saveResponse = await fetch('/api/user/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'sync_to_database',
                data: { 
                  localStorageData: {
                    savedPrompts: newOrUpdatedPrompts.map(p => ({ name: p.name, content: p.content }))
                  }
                }
              }),
            });
            if (saveResponse.ok) {
              synced = true;
            }
          }
        }
      }

        if (synced) {
          setHasUnsavedChanges(false);
          pendingChangesRef.current = {};
          
          // Reload settings to get updated IDs from database
          await loadSettingsFromDatabase();
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
        debouncedSyncRequestRef.current = null;
      }
    })();

    debouncedSyncRequestRef.current = syncPromise;
    return syncPromise;
  }, [user?.sub, hasUnsavedChanges]);

  // Schedule debounced sync
  const scheduleSync = useCallback((delay: number = 15000) => { // Increased from 5s to 15s
    const now = Date.now();
    
    // Throttle: don't schedule if we just scheduled less than 5 seconds ago
    if (now - lastScheduleTimeRef.current < 5000) {
      return;
    }
    
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    lastScheduleTimeRef.current = now;
    syncTimeoutRef.current = setTimeout(() => {
      debouncedSync();
    }, delay);
  }, [debouncedSync]);

  // Load settings from database when user is authenticated
  const loadSettingsFromDatabase = useCallback(async () => {
    if (!user?.sub || isLoading) return;

    // Deduplicate concurrent requests
    if (loadRequestRef.current) {
      return loadRequestRef.current;
    }

    const loadPromise = (async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/user/settings', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

      if (response.ok) {
        const data = await response.json();
        
        if (data.preferences) {
          setUserPreferences(data.preferences);
        }
        // Handle saved prompts (even if empty array)
        const databasePrompts = data.savedPrompts || [];
        
        // Simply use database prompts and merge with localStorage
        if (typeof window !== 'undefined') {
          const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
          const localPrompts: SavedPrompt[] = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
          
          // Use localStorage prompts if they exist (data-sync already handled merging)
          // Otherwise use database prompts
          const prompts = localPrompts.length > 0 ? localPrompts : databasePrompts;
          setSavedPrompts(prompts);
          
          // Update localStorage with database prompts if needed
          if (localPrompts.length === 0 && databasePrompts.length > 0) {
            localStorage.setItem('savedSystemPrompts', JSON.stringify(databasePrompts));
          }
        } else {
          setSavedPrompts(databasePrompts);
        }
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
        loadRequestRef.current = null;
      }
    })();

    loadRequestRef.current = loadPromise;
    return loadPromise;
  }, [user?.sub, isLoading]);
  
  // Save user preferences (debounced)
  const saveUserPreferences = useCallback(async (preferences: UserPreferences) => {
    if (!user?.sub) return;

    // Check if preferences actually changed
    if (userPreferences && 
        userPreferences.selected_model === preferences.selected_model &&
        userPreferences.system_prompt === preferences.system_prompt &&
        userPreferences.temperature === preferences.temperature &&
        userPreferences.top_p === preferences.top_p &&
        userPreferences.last_selected_chat_id === preferences.last_selected_chat_id) {
      return;
    }
    
    // Update local state immediately
    setUserPreferences(preferences);
    
    // Queue for debounced sync
    pendingChangesRef.current.preferences = preferences;
    setHasUnsavedChanges(true);
    scheduleSync();
  }, [user?.sub, userPreferences, scheduleSync]);

  // Save a prompt (immediate)
  const savePrompt = useCallback(async (name: string, content: string, position?: number) => {
    if (!user?.sub) return undefined;

    try {
      // Save to database immediately
      const saveResponse = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_prompt',
          data: { name, content, position }
        }),
      });

      if (!saveResponse.ok) {
        throw new Error(`Failed to save prompt: ${saveResponse.statusText}`);
      }

      const result = await saveResponse.json();
      const promptId = result.data?.promptId;

      const newPrompt: SavedPrompt = {
        id: promptId,
        name,
        content,
        position: position || 0,
        synced: true // Mark as synced since it was just saved to database
      };

      // Update local state immediately - replace existing prompt with same name
      setSavedPrompts(prev => {
        // Remove any existing prompt with the same name
        const filtered = prev.filter(p => p.name !== name);
        // Add the new prompt
        return [...filtered, newPrompt];
      });

      // Update localStorage immediately - replace existing prompt with same name
      if (typeof window !== 'undefined') {
        const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
        const currentPrompts = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
        // Remove any existing prompt with the same name
        const filteredPrompts = currentPrompts.filter((p: any) => p.name !== name);
        // Add the new prompt
        filteredPrompts.push(newPrompt);
        localStorage.setItem('savedSystemPrompts', JSON.stringify(filteredPrompts));
      }

      return newPrompt;
    } catch (e) {
      // Still add to local state/localStorage but mark as unsynced for retry later
      const newPrompt: SavedPrompt = {
        name,
        content,
        position: position || 0,
        synced: false
      };

      setSavedPrompts(prev => {
        // Remove any existing prompt with the same name
        const filtered = prev.filter(p => p.name !== name);
        // Add the new prompt
        return [...filtered, newPrompt];
      });
      
      if (typeof window !== 'undefined') {
        const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
        const currentPrompts = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
        // Remove any existing prompt with the same name
        const filteredPrompts = currentPrompts.filter((p: any) => p.name !== name);
        // Add the new prompt
        filteredPrompts.push(newPrompt);
        localStorage.setItem('savedSystemPrompts', JSON.stringify(filteredPrompts));
      }

      // TODO: Show user error message
      return newPrompt;
    }
  }, [user?.sub]);

  // Update a prompt (immediate)
  const updatePrompt = useCallback(async (promptId: string, updates: Partial<{ name: string; content: string; position: number }>) => {
    if (!user?.sub) return;


    try {
      // Update in database immediately
      const updateResponse = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_prompt',
          data: { promptId, updates }
        }),
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update prompt: ${updateResponse.statusText}`);
      }

      // Update local state immediately - mark as synced
      setSavedPrompts(prev => 
        prev.map(prompt => 
          prompt.id === promptId 
            ? { ...prompt, ...updates, synced: true }
            : prompt
        )
      );

      // Update localStorage immediately
      if (typeof window !== 'undefined') {
        const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
        if (savedPromptsStr) {
          const currentPrompts = JSON.parse(savedPromptsStr);
          const updatedPrompts = currentPrompts.map((p: any) => 
            p.id === promptId 
              ? { ...p, ...updates, synced: true }
              : p
          );
          localStorage.setItem('savedSystemPrompts', JSON.stringify(updatedPrompts));
        }
      }

    } catch (error) {
      
      // Update local state but mark as unsynced for retry later
      setSavedPrompts(prev => 
        prev.map(prompt => 
          prompt.id === promptId 
            ? { ...prompt, ...updates, synced: false }
            : prompt
        )
      );

      // Update localStorage with unsynced status
      if (typeof window !== 'undefined') {
        const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
        if (savedPromptsStr) {
          const currentPrompts = JSON.parse(savedPromptsStr);
          const updatedPrompts = currentPrompts.map((p: any) => 
            p.id === promptId 
              ? { ...p, ...updates, synced: false }
              : p
          );
          localStorage.setItem('savedSystemPrompts', JSON.stringify(updatedPrompts));
        }
      }

      // TODO: Show user error message
    }
  }, [user?.sub]);

  // Delete a prompt (immediate) - now simplified to only handle ID-based deletion
  const deletePrompt = useCallback(async (promptId: string) => {
    // Find the prompt to delete
    let promptToDelete = savedPrompts.find(prompt => prompt.id === promptId);
    if (!promptToDelete) {
      return;
    }

    try {
      // Delete from database if user is authenticated
      if (user?.sub) {
        const deleteResponse = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_prompt',
          data: { promptId: promptId }
        }),
      });

      if (!deleteResponse.ok) {
        throw new Error(`Failed to delete prompt: ${deleteResponse.statusText}`);
      }

      }

      // Update localStorage immediately - remove by ID (for both authenticated and unauthenticated users)
      if (typeof window !== 'undefined') {
        const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
        if (savedPromptsStr) {
          const localPrompts = JSON.parse(savedPromptsStr);
          const filteredPrompts = localPrompts.filter((p: any) => p.id !== promptId);
          localStorage.setItem('savedSystemPrompts', JSON.stringify(filteredPrompts));
        }
      }

      // Update local state immediately - filter by ID
      setSavedPrompts(prev => {
        const filtered = prev.filter(prompt => prompt.id !== promptId);
        return filtered;
      });

    } catch (error) {
      // TODO: Show user error message or revert UI changes
    }
  }, [user?.sub, savedPrompts]);

  // Reorder prompts (debounced)
  const reorderPrompts = useCallback(async (promptIds: string[]) => {
    if (!user?.sub) return;

    // Update local state immediately
    const reorderedPrompts = promptIds.map((id, index) => {
      const prompt = savedPrompts.find(p => p.id === id);
      return prompt ? { ...prompt, position: index, synced: false } : null;
    }).filter(Boolean) as SavedPrompt[];
    
    setSavedPrompts(reorderedPrompts);
    
    // Queue for debounced sync
    pendingChangesRef.current.prompts = reorderedPrompts;
    setHasUnsavedChanges(true);
    scheduleSync();
  }, [user?.sub, savedPrompts, scheduleSync]);


  // Load settings when user is authenticated or not
  useEffect(() => {
    // Check if user changed to prevent duplicate loads
    if (prevUserIdRef.current !== user?.sub) {
      prevUserIdRef.current = user?.sub || null;
      
      if (user?.sub && !isInitialized && !isAuthLoading) {
        
        // First load from localStorage for immediate display
        if (typeof window !== 'undefined') {
          // Clean up any existing duplicates first
          cleanupDuplicatePrompts();
          
          const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
          let localPrompts: SavedPrompt[] = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
          setSavedPrompts(localPrompts);
        }
        
        // Then load from database (will merge/replace)
        loadSettingsFromDatabase();
      } else if (!user?.sub && typeof window !== 'undefined') {
        // Not logged in: load from localStorage
        // Clean up any existing duplicates first
        cleanupDuplicatePrompts();
        
        const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
        let localPrompts: SavedPrompt[] = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
        setSavedPrompts(localPrompts);
        setIsInitialized(true);
      }
    }
  }, [user?.sub, isInitialized, isAuthLoading]); // Removed loadSettingsFromDatabase dependency

  // Sync on app close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges) {
        // Use sendBeacon for more reliable sync on page unload
        const data = JSON.stringify({
          action: 'sync_to_database',
          data: { 
            localStorageData: {
              savedPrompts: pendingChangesRef.current.prompts?.filter(p => !p.id || p.synced !== true).map(p => ({ name: p.name, content: p.content })) || [],
              ...pendingChangesRef.current.preferences
            }
          }
        });
        
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/user/settings', data);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also try to sync when component unmounts
      if (hasUnsavedChanges) {
        debouncedSync();
      }
    };
  }, [hasUnsavedChanges, debouncedSync]);

  // Periodic sync for data consistency (every 15 minutes - reduced frequency)
  useEffect(() => {
    if (!user?.sub) return;

    const intervalId = setInterval(() => {
      if (hasUnsavedChanges) {
        debouncedSync();
      }
    }, 15 * 60 * 1000); // 15 minutes (reduced from 5 minutes)

    return () => clearInterval(intervalId);
  }, [user?.sub, hasUnsavedChanges, debouncedSync]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    savedPrompts,
    userPreferences,
    isLoading,
    isInitialized,
    hasUnsavedChanges,
    saveUserPreferences,
    savePrompt,
    updatePrompt,
    deletePrompt,
    reorderPrompts,
    loadSettingsFromDatabase
  };
} 