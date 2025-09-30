'use client';

import { useEffect, useState } from 'react';

import { setStorageErrorHandler, cleanupChatMessages, cleanupPrivateChats, getLocalStorageInfo } from '@/lib/local-storage-manager';

export function StorageErrorToast() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log('Setting up storage error handler');
    // Set up the global error handler
    setStorageErrorHandler((message: string) => {
      console.log('Storage error received:', message);
      setErrorMessage(message);
    });
  }, []);

  const handleCleanupPrivateChats = () => {
    const cleaned = cleanupPrivateChats();
    if (cleaned) {
      const newSize = getLocalStorageInfo();
      console.log(`Cleaned private chats. New size: ${(newSize.totalSize / 1024 / 1024).toFixed(2)} MB`);
      setErrorMessage(null);
    }
  };

  const handleCleanupChatMessages = () => {
    const cleaned = cleanupChatMessages();
    if (cleaned) {
      const newSize = getLocalStorageInfo();
      console.log(`Cleaned chat messages. New size: ${(newSize.totalSize / 1024 / 1024).toFixed(2)} MB`);
      setErrorMessage(null);
    }
  };

  if (!errorMessage) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: '#ef4444',
        color: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 9999,
        maxWidth: '420px',
        fontSize: '14px',
        border: '1px solid #dc2626'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        Storage Quota Exceeded
      </div>
      <div style={{ marginBottom: '12px' }}>
        {errorMessage}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleCleanupPrivateChats}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Clear Private Chats
        </button>
        <button
          onClick={handleCleanupChatMessages}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Trim Chat History
        </button>
        <button
          onClick={() => setErrorMessage(null)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}