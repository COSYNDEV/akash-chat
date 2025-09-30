interface LocalStorageSize {
  totalSize: number;
  keys: Array<{
    key: string;
    size: number;
  }>;
}

interface StorageResult {
  success: boolean;
  error?: string;
}

// Global error notification system
let errorNotificationCallback: ((message: string) => void) | null = null;

export function setStorageErrorHandler(callback: (message: string) => void) {
  errorNotificationCallback = callback;
}

function notifyStorageError(message: string) {
  console.error('Storage error:', message);
  if (errorNotificationCallback) {
    errorNotificationCallback(message);
  }
}

const STORAGE_THRESHOLD_MB = 4; // 4MB threshold
const STORAGE_THRESHOLD_BYTES = STORAGE_THRESHOLD_MB * 1024 * 1024;

function calculateLocalStorageSize(): LocalStorageSize {
  let totalSize = 0;
  const keys: Array<{ key: string; size: number }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        // Calculate size in bytes (UTF-16 encoding, each character is 2 bytes)
        const size = (key.length + value.length) * 2;
        totalSize += size;
        keys.push({ key, size });
      }
    }
  }

  return { totalSize, keys };
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(2)} KB`;
}

export function cleanupChatMessages(): boolean {
  try {
    const chatsData = localStorage.getItem('chats');
    if (!chatsData) {return false;}

    const chats = JSON.parse(chatsData);
    if (!Array.isArray(chats) || chats.length === 0) {return false;}

    // Sort chats by last message timestamp (most recent first)
    const sortedChats = chats.map(chat => {
      const lastMessageTime = chat.messages && chat.messages.length > 0
        ? new Date(chat.messages[chat.messages.length - 1].createdAt || 0).getTime()
        : 0;
      return { ...chat, lastMessageTime };
    }).sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    let cleaned = false;
    let currentSize = calculateLocalStorageSize().totalSize;

    // Remove messages from oldest chats first, starting with the longest conversations
    for (const chat of sortedChats.reverse()) { // Start with oldest chats
      if (currentSize <= STORAGE_THRESHOLD_BYTES * 0.8) {break;} // Stop when we're at 80% of threshold

      if (chat.messages && chat.messages.length > 2) {
        // Keep at least the first and last message to preserve chat context
        const originalLength = chat.messages.length;
        const messagesToKeep = Math.max(2, Math.floor(originalLength * 0.3)); // Keep 30% of messages, minimum 2

        // Keep first message and most recent messages
        chat.messages = [
          chat.messages[0], // Keep first message
          ...chat.messages.slice(-messagesToKeep + 1) // Keep most recent messages
        ];

        cleaned = true;
      }
    }

    if (cleaned) {
      // Update the chats array (restore original order by sorting by last message time)
      const cleanedChats = sortedChats
        .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
        .map(({ lastMessageTime, ...chat }) => chat);

      localStorage.setItem('chats', JSON.stringify(cleanedChats));

      // Recalculate size after cleanup
      currentSize = calculateLocalStorageSize().totalSize;

      console.log(`Local storage cleanup completed. New size: ${formatSize(currentSize)}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error during chat cleanup:', error);
    return false;
  }
}

export function cleanupPrivateChats(): boolean {
  try {
    const privateChatsData = localStorage.getItem('privateChats');
    if (!privateChatsData) {return false;}

    const privateChats = JSON.parse(privateChatsData);
    if (typeof privateChats !== 'object' || Object.keys(privateChats).length === 0) {return false;}

    // Remove all private chats as they're temporary anyway
    localStorage.removeItem('privateChats');
    console.log('Removed private chats to free up storage space');
    return true;
  } catch (error) {
    console.error('Error during private chat cleanup:', error);
    return false;
  }
}

export function checkStorageSize(): { isOverLimit: boolean; size: LocalStorageSize } {
  try {
    const storageInfo = calculateLocalStorageSize();
    const isOverLimit = storageInfo.totalSize > STORAGE_THRESHOLD_BYTES;

    if (isOverLimit) {
      console.warn(`Local storage size (${formatSize(storageInfo.totalSize)}) exceeded threshold (${formatSize(STORAGE_THRESHOLD_BYTES)})`);
    }

    return { isOverLimit, size: storageInfo };
  } catch (error) {
    console.error('Error checking local storage:', error);
    return { isOverLimit: false, size: { totalSize: 0, keys: [] } };
  }
}

export function getLocalStorageInfo(): LocalStorageSize {
  return calculateLocalStorageSize();
}

export function isStorageNearLimit(): boolean {
  const { totalSize } = calculateLocalStorageSize();
  return totalSize > STORAGE_THRESHOLD_BYTES * 0.9; // 90% of threshold
}

export function safeSetItem(key: string, value: string): StorageResult {
  try {
    localStorage.setItem(key, value);
    return { success: true };
  } catch (error) {
    let errorMessage: string;

    if (error instanceof Error && error.name === 'QuotaExceededError') {
      errorMessage = 'Storage quota exceeded. Please clear some chat history to continue.';
    } else {
      errorMessage = 'Unable to save data to local storage.';
    }

    notifyStorageError(errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
}