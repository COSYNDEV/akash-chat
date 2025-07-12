'use client';

import { Keyboard } from 'lucide-react';
import { useState, useEffect } from 'react';

import { KeyboardShortcut, formatShortcutKeys, groupShortcutsByCategory } from '@/hooks/use-keyboard-shortcuts';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';

interface KeyboardShortcutsModalProps {
  shortcuts: KeyboardShortcut[];
  trigger?: React.ReactNode;
}

export function KeyboardShortcutsModal({ shortcuts, trigger }: KeyboardShortcutsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const groupedShortcuts = groupShortcutsByCategory(shortcuts);

  // Handle Ctrl+Shift+? to open the modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const defaultTrigger = (
    <button
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      title="Keyboard shortcuts (Ctrl+Shift+?)"
    >
      <Keyboard className="w-4 h-4" />
      <span>Shortcuts</span>
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent 
        className="max-w-4xl max-h-[80vh] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and interact with the application more efficiently.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="space-y-3">
              <h3 className="font-semibold text-foreground border-b border-border pb-1">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground flex-1">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {formatShortcutKeys(shortcut).split(' + ').map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center">
                          <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded shadow-sm">
                            {key}
                          </kbd>
                          {keyIndex < formatShortcutKeys(shortcut).split(' + ').length - 1 && (
                            <span className="mx-1 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1 py-0.5 text-xs bg-muted border border-border rounded">Ctrl</kbd> + 
            <kbd className="px-1 py-0.5 text-xs bg-muted border border-border rounded mx-1">Shift</kbd> + 
            <kbd className="px-1 py-0.5 text-xs bg-muted border border-border rounded">?</kbd> to open this dialog anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
} 