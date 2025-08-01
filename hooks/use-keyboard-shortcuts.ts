import { useEffect, useRef, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
  action: () => void;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  preventDefault?: boolean;
  disabled?: boolean;
}

export interface KeyboardShortcutsConfig {
  // Chat actions
  newChat?: () => void;
  toggleSidebar?: () => void;
  focusInput?: () => void;
  sendMessage?: () => void;
  stopGeneration?: () => void;
  regenerateLastMessage?: () => void;
  
  // Navigation
  selectNextChat?: () => void;
  selectPreviousChat?: () => void;
  selectNextModel?: () => void;
  selectPreviousModel?: () => void;
  
  // File and context
  addFiles?: () => void;
  clearContext?: () => void;
  
  // Sidebar actions
  createFolder?: () => void;
  exportChats?: () => void;
  importChats?: () => void;
  openSettings?: () => void;
  
  // Quick access
  jumpToHome?: () => void;
  jumpToModels?: () => void;
  toggleSearch?: () => void;
  
  // Voice
  toggleVoiceRecording?: () => void;
  
  // States
  isLoading?: boolean;
  isRecording?: boolean;
  hasMessages?: boolean;
  isSidebarOpen?: boolean;
  canRegenerateLastMessage?: boolean;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const shortcutsRef = useRef<KeyboardShortcut[]>([]);
  
  const updateShortcuts = useCallback(() => {
    const shortcuts: KeyboardShortcut[] = [
      // Chat Management
      {
        key: 'n',
        description: 'New chat',
        category: 'Chat',
        action: config.newChat || (() => {}),
        ctrlKey: true,
        disabled: !config.newChat,
      },
      {
        key: 'Escape',
        description: 'Stop generation',
        category: 'Chat',
        action: config.stopGeneration || (() => {}),
        disabled: !config.stopGeneration,
      },
      {
        key: 'r',
        description: 'Regenerate last message',
        category: 'Chat',
        action: config.regenerateLastMessage || (() => {}),
        ctrlKey: true,
        disabled: !config.regenerateLastMessage,
      },
      {
        key: 'k',
        description: 'Focus message input',
        category: 'Chat',
        action: config.focusInput || (() => {}),
        ctrlKey: true,
        disabled: !config.focusInput,
      },
      
      // Navigation
      {
        key: 'b',
        description: 'Toggle sidebar',
        category: 'Navigation',
        action: config.toggleSidebar || (() => {}),
        ctrlKey: true,
        disabled: !config.toggleSidebar,
      },
      {
        key: 'ArrowUp',
        description: 'Select previous chat',
        category: 'Navigation',
        action: config.selectPreviousChat || (() => {}),
        ctrlKey: true,
        shiftKey: true,
        disabled: !config.selectPreviousChat || config.isLoading,
      },
      {
        key: 'ArrowDown',
        description: 'Select next chat',
        category: 'Navigation',
        action: config.selectNextChat || (() => {}),
        ctrlKey: true,
        shiftKey: true,
        disabled: !config.selectNextChat || config.isLoading,
      },
      {
        key: 'ArrowLeft',
        description: 'Select previous model',
        category: 'Navigation',
        action: config.selectPreviousModel || (() => {}),
        ctrlKey: true,
        shiftKey: true,
        disabled: !config.selectPreviousModel || config.isLoading,
      },
      {
        key: 'ArrowRight',
        description: 'Select next model',
        category: 'Navigation',
        action: config.selectNextModel || (() => {}),
        ctrlKey: true,
        shiftKey: true,
        disabled: !config.selectNextModel || config.isLoading,
      },
      
      // File and Context
      {
        key: 'u',
        description: 'Add files',
        category: 'Files',
        action: config.addFiles || (() => {}),
        ctrlKey: true,
        disabled: !config.addFiles,
      },
      {
        key: 'l',
        description: 'Clear context files',
        category: 'Files',
        action: config.clearContext || (() => {}),
        ctrlKey: true,
        shiftKey: true,
        disabled: !config.clearContext,
      },
      
      // Sidebar Actions
      {
        key: ',',
        description: 'Open settings',
        category: 'Settings',
        action: config.openSettings || (() => {}),
        ctrlKey: true,
        disabled: !config.openSettings,
      },
      
      // Quick Access
      {
        key: 'h',
        description: 'Go to home',
        category: 'Quick Access',
        action: config.jumpToHome || (() => {}),
        ctrlKey: true,
        disabled: !config.jumpToHome,
      },
      {
        key: 'm',
        description: 'Go to models page',
        category: 'Quick Access',
        action: config.jumpToModels || (() => {}),
        ctrlKey: true,
        disabled: !config.jumpToModels,
      },
      
      // Voice
      {
        key: 'v',
        description: config.isRecording ? 'Stop voice recording' : 'Start voice recording',
        category: 'Voice',
        action: config.toggleVoiceRecording || (() => {}),
        ctrlKey: true,
        disabled: !config.toggleVoiceRecording,
      },
      
    ];
    
    shortcutsRef.current = shortcuts.filter(shortcut => !shortcut.disabled);
  }, [config]);

  useEffect(() => {
    updateShortcuts();
  }, [updateShortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]')
      ) {
        // Allow certain shortcuts even when in input fields
        const allowedInInputs = ['Escape', 'Tab'];
        if (!allowedInInputs.includes(event.key)) {
          return;
        }
      }

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.disabled) continue;
        
        const matchesKey = event.key === shortcut.key;
        const matchesCtrl = !!shortcut.ctrlKey === event.ctrlKey;
        const matchesShift = !!shortcut.shiftKey === event.shiftKey;
        const matchesAlt = !!shortcut.altKey === event.altKey;
        
        if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          try {
            shortcut.action();
          } catch (error) {
            console.warn('Keyboard shortcut action failed:', error);
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    shortcuts: shortcutsRef.current,
    updateShortcuts,
  };
}

// Helper to format shortcut key combinations for display
export function formatShortcutKeys(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrlKey || shortcut.metaKey) {
    parts.push('Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push('Shift');
  }
  if (shortcut.altKey) {
    parts.push('Alt');
  }
  
  // Format special keys
  let key = shortcut.key;
  const specialKeys: Record<string, string> = {
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '↵',
    'Escape': 'Esc',
    ' ': 'Space',
  };
  
  if (specialKeys[key]) {
    key = specialKeys[key];
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }
  
  parts.push(key);
  return parts.join(' + ');
}

// Group shortcuts by category for display
export function groupShortcutsByCategory(shortcuts: KeyboardShortcut[]): Record<string, KeyboardShortcut[]> {
  return shortcuts.reduce((groups, shortcut) => {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
    return groups;
  }, {} as Record<string, KeyboardShortcut[]>);
} 