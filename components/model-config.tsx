'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { Plus, Save, Trash2, RotateCcw, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";

import { DEFAULT_SYSTEM_PROMPT } from "@/app/config/api";
import { models } from "@/app/config/models";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEncryptedSettings } from '@/hooks/use-encrypted-settings';
import { trackEvent } from '@/lib/analytics';
import { safeSetItem } from '@/lib/local-storage-manager';

interface ModelConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: string;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  onTemperatureChange?: (temp: number) => void;
  onTopPChange?: (topP: number) => void;
}

interface SavedPrompt {
  id?: string;
  name: string;
  content: string;
  synced?: boolean; // Legacy field for backward compatibility
  source?: 'local' | 'database'; // New field for consistent tagging
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const currentThemeIndex = themes.findIndex(t => t.value === theme);
  const currentTheme = themes[currentThemeIndex] || themes[0];

  const handleThemeSelect = (themeValue: string) => {
    setTheme(themeValue);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Theme</label>
      
      <div className="flex items-center gap-3">
        {/* Interactive toggle switch */}
        <div className="relative flex bg-muted border border-border rounded-lg p-1 flex-shrink-0">
          {/* Background slider */}
          <div 
            className="absolute top-1 bottom-1 w-8 bg-background border border-border rounded-md shadow-sm transition-all duration-300 ease-out"
            style={{ 
              left: `${4 + currentThemeIndex * 32}px`
            }}
          />
          
          {/* Interactive theme buttons */}
          {themes.map((themeOption, index) => (
            <button
              key={themeOption.value}
              onClick={() => handleThemeSelect(themeOption.value)}
              className={`relative z-10 flex items-center justify-center w-8 h-6 transition-all duration-200 rounded-md ${
                currentThemeIndex === index 
                  ? 'text-foreground' 
                  : 'text-muted-foreground hover:text-foreground/80'
              }`}
              title={themeOption.label}
            >
              <themeOption.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
        
        {/* Current theme label */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <currentTheme.icon className="w-4 h-4" />
          <span>{currentTheme.label}</span>
        </div>
      </div>
    </div>
  );
}

export function ModelConfig({ 
  open, 
  onOpenChange, 
  currentModel,
  systemPrompt,
  onSystemPromptChange,
  onTemperatureChange,
  onTopPChange
}: ModelConfigProps) {
  const [promptName, setPromptName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [selectedPromptName, setSelectedPromptName] = useState<string | null>(null);
  const [localSavedPrompts, setLocalSavedPrompts] = useState<SavedPrompt[]>([]); // For not-logged-in users
  const maxLength = 1500;

  // Debounced system prompt state
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use Auth0 user hook for proper authentication check
  const { user } = useUser();
  // Use encrypted settings hook
  const { 
    savedPrompts, 
    savePrompt: saveEncryptedPrompt, 
    deletePrompt: deleteEncryptedPrompt,
  } = useEncryptedSettings();

  // Sync localSystemPrompt when systemPrompt prop changes
  useEffect(() => {
    setLocalSystemPrompt(systemPrompt);
    
    const allPrompts = user?.sub ? savedPrompts : localSavedPrompts;
    const matchingPrompt = allPrompts.find(prompt => prompt.content === systemPrompt);
    
    if (matchingPrompt) {
      setSelectedPromptName(matchingPrompt.name);
    } else {
      setSelectedPromptName(null);
    }
  }, [systemPrompt, savedPrompts, localSavedPrompts, user?.sub]);

  // Debounced system prompt change handler
  const handleSystemPromptChange = (value: string) => {
    if (value.length <= maxLength) {
      setLocalSystemPrompt(value);
      
      // Clear selection if user manually edits and content no longer matches saved prompts
      const allPrompts = user?.sub ? savedPrompts : localSavedPrompts;
      const matchingPrompt = allPrompts.find(prompt => prompt.content === value);
      
      if (!matchingPrompt) {
        setSelectedPromptName(null);
      }
      
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // Set new timeout to trigger parent change after 500ms of no typing
      debounceTimeoutRef.current = setTimeout(() => {
        onSystemPromptChange(value);
      }, 500);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // On mount, always load local prompts (for lazy migration when authenticated)
  useEffect(() => {
    const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
    let localPrompts: SavedPrompt[] = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
    
    // Migrate old prompts to use source tags for backward compatibility
    let needsUpdate = false;
    localPrompts = localPrompts.map(prompt => {
      if (!prompt.source) {
        needsUpdate = true;
        // Determine source based on existing data
        if (prompt.id && prompt.synced === true) {
          return { ...prompt, source: 'database' };
        } else {
          return { ...prompt, source: 'local', synced: false };
        }
      }
      return prompt;
    });
    
    // Update localStorage if migration was needed
    if (needsUpdate) {
      safeSetItem('savedSystemPrompts', JSON.stringify(localPrompts));
    }
    
    setLocalSavedPrompts(localPrompts);
  }, [open, user?.sub, savedPrompts]);

  // Get current model configuration
  const currentModelConfig = models.find(m => m.id === currentModel);
  const [temperature, setTemperature] = useState(currentModelConfig?.temperature || 0.7);
  const [topP, setTopP] = useState(currentModelConfig?.top_p || 0.95);

  // Update temperature and top_p when model changes
  useEffect(() => {
    const model = models.find(m => m.id === currentModel);
    if (model) {
      setTemperature(model.temperature || 0.7);
      setTopP(model.top_p || 0.95);
    }
  }, [currentModel]);

  useEffect(() => {
    if (open) {
      trackEvent.configureModel();
    }
  }, [open]);

  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTemperature(value);
    onTemperatureChange?.(value);
  };

  const handleTopPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTopP(value);
    onTopPChange?.(value);
  };

  const savePrompt = async () => {
    if (!promptName.trim()) {return;}

    // If not logged in, save to localStorage as local prompt
    if (!user?.sub) {
      const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
      let savedPrompts: SavedPrompt[] = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
      // Remove any with the same name
      savedPrompts = savedPrompts.filter(p => p.name !== promptName);
      const newPrompt: SavedPrompt = { 
        name: promptName, 
        content: localSystemPrompt, 
        source: 'local',
        synced: false 
      };
      savedPrompts.push(newPrompt);
      safeSetItem('savedSystemPrompts', JSON.stringify(savedPrompts));
      setLocalSavedPrompts(savedPrompts); // Update local state
      setPromptName('');
      setShowSaveInput(false);
      return;
    }

    // If logged in, save directly to database
    try {
      const savedPrompt = await saveEncryptedPrompt(promptName, localSystemPrompt);
      
      // Also add to localStorage as database prompt for consistency
      const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
      let savedPrompts: SavedPrompt[] = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
      savedPrompts = savedPrompts.filter(p => p.name !== promptName); // Remove any duplicates
      savedPrompts.push({
        id: savedPrompt?.id,
        name: promptName,
        content: localSystemPrompt,
        source: 'database',
        synced: true
      });
      safeSetItem('savedSystemPrompts', JSON.stringify(savedPrompts));
      setLocalSavedPrompts(savedPrompts);
    } catch (error) {
      console.warn(`Failed to save prompt "${promptName}" to database:`, error);
      // Don't return here - still clear the form even if save failed
    }
    setPromptName('');
    setShowSaveInput(false);
  };

  const deletePrompt = async (promptIdOrName: string) => {
    // If not logged in, delete from localStorage by name
    if (!user?.sub) {
      const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
      let savedPrompts: SavedPrompt[] = savedPromptsStr ? JSON.parse(savedPromptsStr) : [];
      savedPrompts = savedPrompts.filter(p => p.id !== promptIdOrName);
      safeSetItem('savedSystemPrompts', JSON.stringify(savedPrompts));
      setLocalSavedPrompts(savedPrompts); // Update local state
      setSelectedPromptName(null);
      return;
    }
    // If logged in, delete by id
    await deleteEncryptedPrompt(promptIdOrName);
  };

  const selectPrompt = async (prompt: SavedPrompt) => {
    onSystemPromptChange(prompt.content);
    setSelectedPromptName(prompt.name);
    setPromptName(prompt.name);
    
    // Lazy migration: If this is a local prompt and user is logged in, sync it to database
    const isLocalPrompt = prompt.source === 'local' || prompt.synced === false;
    if (user?.sub && isLocalPrompt) {
      try {
        // Save the prompt to database (this automatically handles deduplication and localStorage updates)
        await saveEncryptedPrompt(prompt.name, prompt.content);
        
        // Update local state to reflect the changes made by saveEncryptedPrompt
        const savedPromptsStr = localStorage.getItem('savedSystemPrompts');
        if (savedPromptsStr) {
          const updatedPrompts = JSON.parse(savedPromptsStr);
          setLocalSavedPrompts(updatedPrompts);
        }
      } catch (error) {
        console.warn(`Failed to migrate prompt "${prompt.name}":`, error);
        // Silent failure - user can still use the prompt even if migration fails
      }
    }
  };

  // Display prompts logic: 
  // - Not logged in: show localStorage prompts only
  // - Logged in: show database prompts + localStorage prompts (for lazy migration)
  const displayPrompts = !user?.sub 
    ? localSavedPrompts 
    : (() => {
        // When logged in, merge database and localStorage prompts with deduplication
        const dbPrompts = savedPrompts || [];
        const localPrompts = localSavedPrompts || [];
        
        // Create a Set of database prompt names to avoid duplicates
        const dbPromptNames = new Set(dbPrompts.map(p => p.name));
        
        // Filter out localStorage prompts that already exist in database
        const uniqueLocalPrompts = localPrompts
          .filter(p => !dbPromptNames.has(p.name))
          .map(p => ({ ...p, synced: false })); // Mark as unsynced
        
        return [...dbPrompts, ...uniqueLocalPrompts];
      })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto p-2 sm:p-6 w-[97vw] sm:w-full mx-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>
            Configurations
          </DialogTitle>
          <DialogDescription>
            Adjust the model parameters and theme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Theme Toggle */}
          <ThemeToggle />
          {/* System Prompt */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">System Prompt</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2"
                  onClick={() => {
                    onSystemPromptChange(DEFAULT_SYSTEM_PROMPT);
                    setSelectedPromptName(null);
                    setPromptName('');
                  }}
                  title="Reset to default system prompt"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {localSystemPrompt.length}/{maxLength}
              </span>
            </div>
            <Textarea
              value={localSystemPrompt}
              onChange={(e) => handleSystemPromptChange(e.target.value)}
              placeholder="Enter system prompt..."
              className="min-h-[100px]"
              maxLength={maxLength}
            />
          </div>

          {/* Model Parameters */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Temperature ({temperature})</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => {
                    const defaultTemp = currentModelConfig?.temperature || 0.7;
                    setTemperature(defaultTemp);
                    onTemperatureChange?.(defaultTemp);
                  }}
                  title="Reset to default"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={handleTemperatureChange}
                  className="w-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Controls randomness: Lower values make the model more focused and deterministic, higher values make it more creative.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Top P ({topP})</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => {
                    const defaultTopP = currentModelConfig?.top_p || 0.95;
                    setTopP(defaultTopP);
                    onTopPChange?.(defaultTopP);
                  }}
                  title="Reset to default"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={topP}
                  onChange={handleTopPChange}
                  className="w-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Controls diversity: Lower values make the model more focused on likely tokens, higher values consider a broader range of tokens.
              </p>
            </div>
          </div>

          {/* Save Prompt Section */}
          <div className="space-y-2">
            {showSaveInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      savePrompt();
                    }
                  }}
                  placeholder="Enter prompt name"
                  className="flex-1 px-3 py-1 text-sm border rounded-md"
                />
                <Button size="sm" onClick={savePrompt}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowSaveInput(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowSaveInput(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Save Current Prompt
              </Button>
            )}
          </div>

          {/* Saved Prompts Section */}
          {displayPrompts.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Saved Prompts</label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {displayPrompts.map((prompt) => {
                  const hasId = typeof (prompt as any).id === 'string';
                  return (
                    <div
                      key={hasId ? (prompt as any).id : prompt.name}
                      className={`flex items-center justify-between p-2 border rounded-md hover:bg-accent ${
                        selectedPromptName === prompt.name ? 'bg-accent border-primary' : ''
                      }`}
                    >
                      <button
                        className="flex-1 text-left text-sm flex items-center gap-2"
                        onClick={() => selectPrompt(prompt)}
                      >
                        <span>{prompt.name}</span>
                        {user?.sub && (prompt.source === 'local' || prompt.synced === false) && (
                          <span className="text-xs text-muted-foreground bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded-full">
                            local
                          </span>
                        )}
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const promptId = (prompt as any).id;
                          if (promptId) {
                            // For logged in users, delete by ID
                            deletePrompt(promptId);
                          } else {
                            // For not logged in users, delete by name
                            deletePrompt(prompt.name);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 