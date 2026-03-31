import { Mic, MicOff, LoaderCircle, Paperclip, X, Plus, Lock, LockOpen } from 'lucide-react';
import { useState, useRef, useEffect } from "react";

import { ContextFile } from "@/app/context/ChatContext";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { useWebSocketTranscription } from '@/hooks/use-websocket-transcription';
import { getCookie, setCookie } from '@/lib/cookies';
import { cn } from "@/lib/utils";
import { handleFileSelect } from '@/utils/file-handler';

import { FileUpload } from '../file-upload';
import { Button } from "../ui/button";

import { RateLimitMessage } from './rate-limit-message';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onStop?: () => void;
  className?: string;
  showStopButton?: boolean;
  onFilesChange?: (files: ContextFile[]) => void;
  contextFiles?: ContextFile[];
  isInitialized?: boolean;
  isLimitReached?: boolean;
  onLimitReached?: (reached: boolean) => void;
  isPrivateMode?: boolean;
  onPrivateModeToggle?: () => void;
  hasMessages?: boolean;
}

export function ChatInput({
  input,
  isLoading,
  onSubmit,
  onChange,
  onStop,
  className,
  showStopButton = false,
  onFilesChange,
  contextFiles = [],
  isInitialized = false,
  isLimitReached = false,
  isPrivateMode = false,
  onPrivateModeToggle,
  hasMessages = false,
}: ChatInputProps) {
  const { isRecording, isConnecting, connectionPossible, startRecording, stopRecording } = useWebSocketTranscription({
    onTranscription: (transcriptionText:string) => {
      let newChatContent = input;
      // Add spacing unless the new text starts with punctuation
      const needsSpace = 
        input && 
        !input.endsWith(' ') && 
        !input.endsWith('\n') &&
        !/^[.,!?;:]/.test(transcriptionText);
        
      newChatContent = input + (needsSpace ? ' ' : '') + transcriptionText;
      const event = {
        target: { value: newChatContent }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      onChange(event);
    },
    
    onError: (error: any) => {
      console.error('Transcription error:', error);
    },
    isInitialized: isInitialized
  });
  
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previousInput, setPreviousInput] = useState(input);

  // Terms disclaimer acceptance tracking
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showRateLimitTooltip, setShowRateLimitTooltip] = useState(false);
  
  useEffect(() => {
    const hasAccepted = getCookie('akash-terms-accepted');
    setShowDisclaimer(!hasAccepted);
  }, []);

  const isVoiceFeatureAvailable = isInitialized && connectionPossible === true;
  const isCheckingVoiceAvailability = isInitialized && connectionPossible === null;

  // Calculate live time remaining
  const getTimeRemaining = () => {
    if (!resetTime) {return '...';}

    const diff = resetTime.getTime() - currentTime.getTime();
    
    if (diff <= 0) {
      return 'now';
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Use centralized rate limit hook
  const { usagePercentage, remainingPercentage, resetTime, blocked, conversationTokenPercentage, showConversationWarning } = useRateLimit();
  const isNearRateLimit = usagePercentage >= 90 && remainingPercentage > 0 && remainingPercentage <= 10 && !blocked;

  const shouldShowIndicator = isNearRateLimit || (showConversationWarning && hasMessages);

  // Update current time every second when limit is reached for live countdown
  useEffect(() => {
    if (isLimitReached) {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isLimitReached]);

  const handleRemoveFile = (fileId: string) => {
    if (onFilesChange) {
      const updatedFiles = contextFiles.filter(f => f.id !== fileId);
      onFilesChange(updatedFiles);
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    if (onFilesChange) {
      const newFiles = await handleFileSelect(files);
      const updatedFiles = [...contextFiles, ...newFiles];
      onFilesChange(updatedFiles);
      setShowFileUpload(false);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      if (input.trim() === '') {
        // Reset to minimum height when empty
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = '24px';
      }
    }
    
    setPreviousInput(input);
  }, [input, previousInput]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const TermsDisclaimer = () => {
    if (!showDisclaimer) {
      return null;
    }

    const handleAccept = () => {
      setCookie('akash-terms-accepted', 'true', { days: 30 }); // Terms acceptance expires after 1 month
      setShowDisclaimer(false);
    };

    return (
      <div className="text-xs text-muted-foreground text-center mt-2 px-2">
        By sending messages, you accept our{' '}
        <a 
          href="/terms/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          Terms of Service
        </a>
        {' '}and{' '}
        <a 
          href="/privacy/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          Privacy Notice
        </a>
        .{' '}
        <button
          onClick={handleAccept}
          className="underline hover:text-foreground transition-colors ml-2"
        >
          Dismiss
        </button>
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {(showFileUpload || contextFiles.length > 0) && (
        <div className="rounded-lg border bg-card">
          <div className="p-2 space-y-2">
            {contextFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contextFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 max-w-full"
                  >
                    <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1" title={file.name}>
                      {file.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 hover:bg-background/80"
                      onClick={() => handleRemoveFile(file.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* File Upload Area */}
            {showFileUpload && (
              <div className="pt-2">
                <FileUpload
                  onFileSelect={handleFilesSelected}
                  acceptedFileTypes={['application/pdf', 'text/plain', 'text/markdown', 'application/json']}
                  maxFiles={5 - contextFiles.length}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Main chat input container */}
      <div className="relative flex w-full flex-col border border-input rounded-2xl bg-background">
        {/* Text input area or rate limit message */}
        <div className="px-3 pt-3 pb-2">
          {isLimitReached ? (
            <RateLimitMessage getTimeRemaining={getTimeRemaining} />
          ) : (
            <>
            <form onSubmit={(e) => {
              e.preventDefault();
              
              if (isRecording) {
                stopRecording();
              }
              onSubmit(e);
            }}>
              <Textarea
                ref={textareaRef}
                className={cn(
                  "text-primary placeholder:text-muted-foreground block w-full resize-none border-0 bg-transparent px-2 py-0 ring-0 placeholder:ps-px focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 min-h-0 no-select",
                  "scrollbar-thin"
                )}
                value={input}
                placeholder="Message AkashChat"
                autoFocus={true}
                onChange={(e) => {
                  if (isRecording && e.target.value !== input) {
                    stopRecording();
                  }
                  
                  onChange(e);
                  // Adjust height
                  e.target.style.height = 'auto';
                  if (e.target.value.trim() === '') {
                    // Reset to minimum height when empty
                    e.target.style.height = '24px';
                  } else {
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isLoading) {
                      onSubmit(e as any);
                    }
                  }
                }}
                rows={1}
                style={{
                  lineHeight: '1.5rem',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}
              />
            </form>
            </>
          )}
        </div>

        {/* Action buttons row */}
        {!isLimitReached && (
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              {/* File upload button */}
              <button
                type="button"
                onClick={() => setShowFileUpload(!showFileUpload)}
                className={cn(
                  "composer-btn flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  "hover:bg-muted text-muted-foreground hover:text-foreground",
                  (showFileUpload || contextFiles.length > 0) && "text-primary bg-primary/10"
                )}
                aria-label="Add files and photos"
              >
                <Plus className="w-4 h-4" strokeWidth={1.75} />
              </button>
              
              {/* Private chat toggle button */}
              {onPrivateModeToggle && (!hasMessages || isPrivateMode) && (
                <button
                  type="button"
                  onClick={onPrivateModeToggle}
                  className={cn(
                    "composer-btn flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                    "hover:bg-muted text-muted-foreground hover:text-foreground",
                    isPrivateMode && "text-amber-600 bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400"
                  )}
                  aria-label={isPrivateMode ? "Switch to regular chat" : "Switch to private chat"}
                  title={isPrivateMode ? "Private chat (local only)" : "Enable private chat"}
                >
                  {isPrivateMode ? (
                    <Lock className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <LockOpen className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
              )}
            </div>
            
            {/* Submit/Stop button on the right */}
            <div className="flex items-center gap-1">
            {/* Rate limit/conversation token indicator */}
            {shouldShowIndicator && (
              <TooltipProvider>
                <Tooltip open={showRateLimitTooltip} onOpenChange={setShowRateLimitTooltip}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`composer-btn flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer ${
                        isNearRateLimit 
                          ? "text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
                          : "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        setShowRateLimitTooltip(!showRateLimitTooltip);
                      }}
                    >
                      <svg className="w-4 h-4 translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="space-y-1">
                      {showConversationWarning && hasMessages && (
                        <p>Next message will use {conversationTokenPercentage > 100 ? '>100' : conversationTokenPercentage}% of your remaining limit</p>
                      )}
                      {isNearRateLimit && (
                        <p>{(() => {
                          if (remainingPercentage <= 0) {return '<1';}
                          return remainingPercentage;
                        })()}% of your rate limit remaining</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Voice recording button loading state */}
            {isCheckingVoiceAvailability && (
              <button
                type="button"
                disabled={true}
                className="composer-btn flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted text-muted-foreground opacity-50"
                aria-label="Checking microphone availability..."
              >
                <LoaderCircle className="h-4 w-4 animate-spin" />
              </button>
            )}

            {/* Voice recording button - show only if transcription is available */}
            {isVoiceFeatureAvailable && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isConnecting}
                className={cn(
                  "composer-btn flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  "hover:bg-muted text-muted-foreground hover:text-foreground",
                  isRecording && "text-destructive",
                  (isLoading || isConnecting) && "opacity-50 cursor-not-allowed"
                )}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isConnecting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-full border border-destructive scale-[1.3] group-hover:border-foreground transition-colors duration-200 overflow-hidden">
                      <div className="absolute inset-0 bg-destructive/25 [animation:pulse_3s_ease-in-out_infinite] group-hover:animate-none group-hover:opacity-0 transition-opacity duration-200" />
                    </div>
                    <Mic className="h-4 w-4 relative z-10 text-destructive group-hover:opacity-0 transition-opacity duration-300" />
                    <MicOff className="absolute inset-0 h-4 w-4 z-10 text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                ) : (
                  <Mic className="h-4 w-4" strokeWidth={1.75}/>
                )}
              </button>
            )}
            {showStopButton && isLoading ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStop?.();
                }}
                className={cn(
                  "composer-btn relative flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                aria-label="Stop generating"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={1.75} />
                  <rect x="9" y="9" width="6" height="6" fill="currentColor" strokeWidth={1.75}/>
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={cn(
                  "composer-btn relative flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  "bg-black/10 dark:bg-white/20 text-foreground hover:bg-black/20 hover:dark:bg-white/30",
                  (isLoading || !input.trim()) && "opacity-30 cursor-not-allowed"
                )}
                aria-label="Send message"
                onClick={(e) => {
                  if (isRecording) {
                    stopRecording();
                  }
                  if (input.trim() && !isLoading) {
                    onSubmit(e as any);
                  }
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth={1.75} d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
      </div>
      
      {/* Terms and Privacy Disclaimer */}
      <TermsDisclaimer />
      
      {/* Custom styles */}
      <style>{`
        .composer-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        
        .scrollbar-thin {
          scrollbar-width: thin;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
        
        /* Focus indicators removed but text selection is visible */
        
        .no-select {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
        }
        
        .no-select:focus {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
          ring: none !important;
        }
        
        .no-select:focus-visible {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
          ring: none !important;
        }
      `}</style>
    </div>
  );
} 