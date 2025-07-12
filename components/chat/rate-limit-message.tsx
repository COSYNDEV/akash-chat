import { LogIn, Clock } from 'lucide-react';

import { Button } from "../ui/button";

interface RateLimitMessageProps {
  getTimeRemaining: () => string;
}

export function RateLimitMessage({ getTimeRemaining }: RateLimitMessageProps) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-3 min-h-[24px] flex flex-col justify-center">
      <div className="flex items-center justify-center gap-2 text-destructive font-medium text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>Limit reached</span>
      </div>
      
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Resets in {getTimeRemaining()}</span>
        </div>
      </div>
      
      <Button 
        size="sm" 
        className="w-full h-8 text-xs"
        onClick={() => {
          window.location.href = '/api/auth/login';
        }}
      >
        <LogIn className="w-3 h-3 mr-2" />
        Sign in for extended access
      </Button>
    </div>
  );
} 