'use client';

import { Plus, Save, Trash2, RotateCcw, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { DEFAULT_SYSTEM_PROMPT } from "@/app/config/api";
import { models } from "@/app/config/models";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from '@/lib/analytics';

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
  name: string;
  content: string;
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
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [promptName, setPromptName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [selectedPromptName, setSelectedPromptName] = useState<string | null>(null);
  const maxLength = 1500;

  // Get current model configuration
  const currentModelConfig = models.find(m => m.id === currentModel);
  const [temperature, setTemperature] = useState(currentModelConfig?.temperature || 0.7);
  const [topP, setTopP] = useState(currentModelConfig?.top_p || 0.95);

  useEffect(() => {
    const saved = localStorage.getItem('savedSystemPrompts');
    if (saved) {
      setSavedPrompts(JSON.parse(saved));
    }
  }, []);

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

  const savePrompt = () => {
    if (!promptName.trim()) {return;}
    
    const newPrompt: SavedPrompt = {
      name: promptName,
      content: systemPrompt
    };
    
    const updatedPrompts = [...savedPrompts.filter(p => p.name !== promptName), newPrompt];
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedSystemPrompts', JSON.stringify(updatedPrompts));
    
    setPromptName('');
    setShowSaveInput(false);
  };

  const deletePrompt = (name: string) => {
    const updatedPrompts = savedPrompts.filter(prompt => prompt.name !== name);
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedSystemPrompts', JSON.stringify(updatedPrompts));
  };

  const selectPrompt = (prompt: SavedPrompt) => {
    onSystemPromptChange(prompt.content);
    setSelectedPromptName(prompt.name);
    setPromptName(prompt.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto p-2 sm:p-6 w-[97vw] sm:w-full mx-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>Configurations</DialogTitle>
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
                {systemPrompt.length}/{maxLength}
              </span>
            </div>
            <Textarea
              value={systemPrompt}
              onChange={(e) => {
                if (e.target.value.length <= maxLength) {
                  onSystemPromptChange(e.target.value);
                }
              }}
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
          {savedPrompts.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Saved Prompts</label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {savedPrompts.map((prompt) => (
                  <div
                    key={prompt.name}
                    className={`flex items-center justify-between p-2 border rounded-md hover:bg-accent ${
                      selectedPromptName === prompt.name ? 'bg-accent border-primary' : ''
                    }`}
                  >
                    <button
                      className="flex-1 text-left text-sm"
                      onClick={() => selectPrompt(prompt)}
                    >
                      {prompt.name}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deletePrompt(prompt.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 