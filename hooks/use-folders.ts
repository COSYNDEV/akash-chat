import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { safeSetItem } from '@/lib/local-storage-manager';

export interface Folder {
  id: string;
  name: string;
  color?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
  source: 'local' | 'database';
  databaseId?: string;
  lastSynced?: string;
  hasLocalChats?: boolean; 
}

export function useFolders(
  onDeleteChatsInFolder?: (folderId: string) => void,
  onFolderIdChange?: (oldFolderId: string, newFolderId: string) => void
) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const { user } = useUser();
  const [pendingSyncs, setPendingSyncs] = useState<Set<string>>(new Set());
  const [lastMergedFolderIds, setLastMergedFolderIds] = useState<Set<string>>(new Set());
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

  // Helper function to count local chats in a folder (defined early to avoid dependency issues)
  const getLocalChatCountInFolder = useCallback((folderId: string): number => {
    try {
      const chatsStr = localStorage.getItem('chats');
      if (!chatsStr) return 0;
      
      const chats = JSON.parse(chatsStr);
      return chats.filter((chat: any) => 
        chat.folderId === folderId && 
        (chat.source === 'local' || (!chat.source && !chat.databaseId))
      ).length;
    } catch (error) {
      console.error('Error counting local chats in folder:', error);
      return 0;
    }
  }, []);

  // Load folders from localStorage on mount with migration
  useEffect(() => {
    const savedFolders = localStorage.getItem('folders');
    if (savedFolders) {
      try {
        const parsedFolders = JSON.parse(savedFolders);
        
        // Migrate existing folders to include source field
        const migratedFolders = parsedFolders.map((folder: any) => ({
          ...folder,
          source: folder.source || 'local', // Default existing folders to 'local'
        }));
        
        setFolders(migratedFolders);
        
        // Save migrated folders back to localStorage
        if (migratedFolders.some((folder: any) => !folder.source)) {
          safeSetItem('folders', JSON.stringify(migratedFolders));
        }
      } catch (error) {
        console.error('Failed to parse saved folders:', error);
        localStorage.removeItem('folders');
      }
    }
  }, []);

  // Save folders to localStorage whenever they change (with debouncing and user-aware filtering)
  useEffect(() => {
    // Debounce localStorage saves to avoid conflicts during auth transitions
    const timeoutId = setTimeout(() => {
      try {
        // If user is logged in, save all folders (local + database) for persistence
        // If user is logged out, save only local folders
        const foldersToSave = user?.sub ? folders : folders.filter(folder => folder.source === 'local');
        
        safeSetItem('folders', JSON.stringify(foldersToSave));
      } catch (error) {
        console.error('Failed to save folders to localStorage:', error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [folders, user?.sub]);

  // Effect to handle auth state changes  
  useEffect(() => {
    if (user?.sub) {
      setForceUpdateCounter(prev => prev + 1);
    } else if (user !== undefined) {
      // User logged out - keep local folders AND database folders that have local chats
      setFolders(prevFolders => {
        const foldersToPreserve = prevFolders.filter(folder => 
          folder.source === 'local' || 
          getLocalChatCountInFolder(folder.id) > 0
        );
        return foldersToPreserve;
      });
      
      setPendingSyncs(new Set());
      setLastMergedFolderIds(new Set());
      setForceUpdateCounter(prev => prev + 1);
    }
  }, [user?.sub, user, getLocalChatCountInFolder]);

  // Database operations
  const createFolderInDatabase = useCallback(async (folder: Folder): Promise<Folder | null> => {
    if (!user?.sub) return null;

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folder)
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (result.success && result.data && result.data.folder) {
        return result.data.folder;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating folder in database:', error);
      return null;
    }
  }, [user?.sub]);

  const updateFolderInDatabase = useCallback(async (folderId: string, updates: Partial<Folder>): Promise<boolean> => {
    if (!user?.sub) return false;

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        console.error('Failed to update folder in database:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating folder in database:', error);
      return false;
    }
  }, [user?.sub]);

  const deleteFolderFromDatabase = useCallback(async (folderId: string): Promise<boolean> => {
    if (!user?.sub) return false;

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        console.error('Failed to delete folder from database:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting folder from database:', error);
      return false;
    }
  }, [user?.sub]);

  const createFolder = useCallback(async (name: string) => {
    const localId = crypto.randomUUID();
    const newFolder: Folder = {
      id: localId,
      name,
      source: 'local', // All new folders are local by default
    };
    
    // Add to local state immediately
    setFolders(prev => [...prev, newFolder]);
    
    // Sync to database if user is logged in
    if (user?.sub) {
      try {
        const dbFolder = await createFolderInDatabase(newFolder);
        if (dbFolder) {
          // Update the folder in local state with database sync metadata
          setFolders(prev => 
            prev.map(folder => 
              folder.id === localId 
                ? { 
                    ...folder, 
                    id: dbFolder.id,
                    source: 'database',
                    databaseId: dbFolder.id,
                    lastSynced: dbFolder.updated_at || new Date().toISOString()
                  } 
                : folder
            )
          );
          
          // Update localStorage with the new database ID and sync metadata
          const currentFoldersStr = localStorage.getItem('folders');
          if (currentFoldersStr) {
            const currentFolders = JSON.parse(currentFoldersStr);
            const updatedFolders = currentFolders.map((folder: any) => 
              folder.id === localId 
                ? { 
                    ...folder, 
                    id: dbFolder.id,
                    source: 'database',
                    databaseId: dbFolder.id,
                    lastSynced: dbFolder.updated_at || new Date().toISOString()
                  } 
                : folder
            );
            safeSetItem('folders', JSON.stringify(updatedFolders));
          }
          
          return dbFolder.id;
        }
      } catch (error) {
        console.error('Failed to sync new folder to database:', error);
      }
    }
    
    return localId; // Return local ID if database sync failed
  }, [user?.sub, createFolderInDatabase]);

  // Database sync functions for lazy migration
  const syncFolderToDatabase = useCallback(async (folder: Folder): Promise<boolean> => {
    if (!user?.sub) {
      return false;
    }
    
    // Prevent concurrent syncs of the same folder
    if (pendingSyncs.has(folder.id)) {
      return false;
    }

    try {
      // Validate folder data before sending
      if (!folder.id || !folder.name) {
        throw new Error('Invalid folder data: missing required fields');
      }
      
      setPendingSyncs(prev => new Set(prev).add(folder.id));
      
      const requestBody = JSON.stringify(folder);
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      
      const newFolderId = result.data?.folderId || result.folderId;
      const originalFolderId = folder.id;
      
      // Update folder with database sync metadata and change source to 'database'
      setFolders(prevFolders => 
        prevFolders.map(f => 
          f.id === folder.id 
            ? { 
                ...f, 
                id: newFolderId,
                source: 'database', 
                databaseId: newFolderId, 
                lastSynced: result.lastSynced || new Date().toISOString()
              }
            : f
        )
      );

      // If folder ID changed, update all chat references
      if (originalFolderId !== newFolderId) {
        // Update chats in localStorage to use new folder ID
        const savedChats = localStorage.getItem('chats');
        if (savedChats) {
          try {
            const parsedChats = JSON.parse(savedChats);
            const updatedChats = parsedChats.map((c: any) => 
              c.folderId === originalFolderId ? { ...c, folderId: newFolderId } : c
            );
            safeSetItem('chats', JSON.stringify(updatedChats));
          } catch (error) {
            console.error('Failed to update chat folder references:', error);
          }
        }
        
        // Notify about folder ID change so chat history can update its in-memory state
        if (onFolderIdChange) {
          onFolderIdChange(originalFolderId, newFolderId);
        }
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Folder sync timeout');
      } else {
        console.error('Failed to sync folder to database:', error);
      }
      return false;
    } finally {
      setPendingSyncs(prev => {
        const newSet = new Set(prev);
        newSet.delete(folder.id);
        return newSet;
      });
    }
  }, [user?.sub, pendingSyncs]);

  const updateFolder = useCallback((id: string, name: string) => {
    setFolders(prev => 
      prev.map(folder => 
        folder.id === id ? { ...folder, name } : folder
      )
    );
    
    // Sync to database if user is logged in
    if (user?.sub) {
      updateFolderInDatabase(id, { name }).catch(error => 
        console.error('Failed to sync folder update to database:', error)
      );
    }
  }, [user?.sub, updateFolderInDatabase]);

  const deleteFolder = useCallback((id: string) => {
    // Delete all chats in this folder first
    if (onDeleteChatsInFolder) {
      onDeleteChatsInFolder(id);
    }
    
    setFolders(prev => prev.filter(folder => folder.id !== id));
    
    // Delete from database if user is logged in
    if (user?.sub) {
      deleteFolderFromDatabase(id).catch(error => 
        console.error('Failed to delete folder from database:', error)
      );
    }
  }, [user?.sub, deleteFolderFromDatabase, onDeleteChatsInFolder]);

  // Function to refresh folders from localStorage
  const refreshFolders = useCallback(() => {
    const savedFolders = localStorage.getItem('folders');
    if (savedFolders) {
      try {
        const parsedFolders = JSON.parse(savedFolders);
        setFolders(parsedFolders);
      } catch (error) {
        console.error('Failed to refresh folders from localStorage:', error);
      }
    }
  }, []);

  const cleanupDatabaseFolders = useCallback(() => {
    setFolders(prevFolders => {
      // Keep local folders AND database folders that contain local chats
      const foldersToPreserve = prevFolders.filter(folder => 
        folder.source === 'local' || 
        getLocalChatCountInFolder(folder.id) > 0
      );
      return foldersToPreserve;
    });
    // Also clear any pending syncs and merge tracking on logout
    setPendingSyncs(new Set());
    setLastMergedFolderIds(new Set());
    // Force update to ensure UI re-renders
    setForceUpdateCounter(prev => prev + 1);
  }, [getLocalChatCountInFolder]);

  const mergeDatabaseFolders = useCallback((databaseFolders: any[]) => {
    // Don't merge if user is logged out
    if (!user?.sub) {
      return;
    }
    
    // Check if we're trying to merge the same folders again
    const incomingFolderIds = new Set(databaseFolders.map(folder => folder.id));
    const isSameMerge = incomingFolderIds.size === lastMergedFolderIds.size && 
      Array.from(incomingFolderIds).every(id => lastMergedFolderIds.has(id));
    
    if (isSameMerge && databaseFolders.length > 0) {
      return;
    }
    
    setLastMergedFolderIds(incomingFolderIds);
    
    setFolders(prevFolders => {
      // Keep only local folders and remove any existing database folders to avoid duplicates
      const localFolders = prevFolders.filter(folder => folder.source === 'local');
      
      // Format database folders with proper source marking
      const formattedDbFolders: Folder[] = databaseFolders.map(dbFolder => {
        // Check if data is already formatted or raw (direct API)
        const isAlreadyFormatted = dbFolder.source && dbFolder.source === 'database';
        
        if (isAlreadyFormatted) {
          // Data comes from data-sync.ts, already formatted
          return {
            ...dbFolder,
            source: 'database' as const,
            databaseId: dbFolder.databaseId || dbFolder.id,
            lastSynced: dbFolder.lastSynced || new Date().toISOString(),
          };
        } else {
          return {
            id: dbFolder.id || crypto.randomUUID(),
            name: dbFolder.name || 'Unnamed Folder',
            color: dbFolder.color || undefined,
            position: dbFolder.position || undefined,
            created_at: dbFolder.created_at || undefined,
            updated_at: dbFolder.updated_at || undefined,
            source: 'database' as const,
            databaseId: dbFolder.id,
            lastSynced: new Date().toISOString(),
          };
        }
      });
      
      // Combine local + database folders, ensuring no duplicates
      const allFolders = [...localFolders, ...formattedDbFolders];
      
      // Remove duplicates by ID
      const seenIds = new Set();
      const combinedFolders = allFolders.filter(folder => {
        if (seenIds.has(folder.id)) {
          return false;
        }
        seenIds.add(folder.id);
        return true;
      });
      
      // Force a UI update after successful merge
      setForceUpdateCounter(prev => prev + 1);
      
      return combinedFolders;
    });
  }, [lastMergedFolderIds, user?.sub]);

  const getLocalFoldersOnly = useCallback(() => {
    return folders.filter(folder => folder.source === 'local');
  }, [folders]);

  const getDatabaseFoldersOnly = useCallback(() => {
    return folders.filter(folder => folder.source === 'database');
  }, [folders]);

  // Helper function to check if folder has local chats
  const folderHasLocalChats = useCallback((folderId: string): boolean => {
    return getLocalChatCountInFolder(folderId) > 0;
  }, [getLocalChatCountInFolder]);

  // Get folders that should be preserved during logout (local folders + database folders with local chats)
  const getFoldersToPreserveOnLogout = useCallback(() => {
    return folders.filter(folder => 
      folder.source === 'local' || folderHasLocalChats(folder.id)
    );
  }, [folders, folderHasLocalChats]);

  // Get folders with computed hasLocalChats property for UI display
  const getFoldersWithHybridState = useCallback(() => {
    return folders.map(folder => ({
      ...folder,
      hasLocalChats: getLocalChatCountInFolder(folder.id) > 0
    }));
  }, [folders, getLocalChatCountInFolder]);

  // Get hybrid folders (database folders that contain local chats)
  const getHybridFolders = useCallback(() => {
    return folders.filter(folder => 
      folder.source === 'database' && getLocalChatCountInFolder(folder.id) > 0
    );
  }, [folders, getLocalChatCountInFolder]);

  // Clean up database folders that no longer have local chats (for when last local chat is removed)
  const cleanupEmptyDatabaseFolders = useCallback(() => {
    if (user?.sub) {
      // Don't cleanup when user is logged in - they might have database chats
      return;
    }
    
    setFolders(prevFolders => {
      const foldersToKeep = prevFolders.filter(folder => {
        // Keep local folders always
        if (folder.source === 'local') return true;
        
        // Keep database folders only if they have local chats
        if (folder.source === 'database') {
          return getLocalChatCountInFolder(folder.id) > 0;
        }
        
        return true;
      });
      
      return foldersToKeep;
    });
  }, [user?.sub, getLocalChatCountInFolder]);

  // Hook to be called when a chat is deleted/moved to trigger folder cleanup
  const onChatRemovedFromFolder = useCallback(() => {
    // Small delay to ensure localStorage is updated
    setTimeout(() => {
      cleanupEmptyDatabaseFolders();
    }, 100);
  }, [cleanupEmptyDatabaseFolders]);

  return {
    folders,
    createFolder,
    updateFolder,
    deleteFolder,
    refreshFolders,
    cleanupDatabaseFolders,
    cleanupEmptyDatabaseFolders,
    mergeDatabaseFolders,
    getLocalFoldersOnly,
    getDatabaseFoldersOnly,
    getHybridFolders,
    syncFolderToDatabase,
    getLocalChatCountInFolder,
    folderHasLocalChats,
    getFoldersToPreserveOnLogout,
    getFoldersWithHybridState,
    onChatRemovedFromFolder,
    forceUpdateCounter,
  };
} 