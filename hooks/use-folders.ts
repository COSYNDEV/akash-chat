import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

export interface Folder {
  id: string;
  name: string;
  color?: string;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

export function useFolders(onDeleteChatsInFolder?: (folderId: string) => void) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const { user } = useUser();

  // Load folders from localStorage on mount
  useEffect(() => {
    const savedFolders = localStorage.getItem('folders');
    if (savedFolders) {
      try {
        setFolders(JSON.parse(savedFolders));
      } catch (error) {
        console.error('Failed to parse saved folders:', error);
        localStorage.removeItem('folders');
      }
    }
  }, []);

  // Save folders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('folders', JSON.stringify(folders));
  }, [folders]);

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
    };
    
    // Add to local state immediately
    setFolders(prev => [...prev, newFolder]);
    
    // Sync to database if user is logged in
    if (user?.sub) {
      try {
        const dbFolder = await createFolderInDatabase(newFolder);
        if (dbFolder) {
          // Update the folder in local state with the database ID
          setFolders(prev => 
            prev.map(folder => 
              folder.id === localId 
                ? { ...folder, id: dbFolder.id } 
                : folder
            )
          );
          
          // Update localStorage with the new database ID
          const currentFoldersStr = localStorage.getItem('folders');
          if (currentFoldersStr) {
            const currentFolders = JSON.parse(currentFoldersStr);
            const updatedFolders = currentFolders.map((folder: any) => 
              folder.id === localId ? { ...folder, id: dbFolder.id } : folder
            );
            localStorage.setItem('folders', JSON.stringify(updatedFolders));
          }
          
          return dbFolder.id;
        }
      } catch (error) {
        console.error('Failed to sync new folder to database:', error);
      }
    }
    
    return localId; // Return local ID if database sync failed
  }, [user?.sub, createFolderInDatabase]);

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
    // Delete all chats in this folder first (if callback provided)
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

  // Function to refresh folders from localStorage (useful when folders are created externally)
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

  return {
    folders,
    createFolder,
    updateFolder,
    deleteFolder,
    refreshFolders,
  };
} 