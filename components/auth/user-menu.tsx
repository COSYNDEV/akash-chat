'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { LogIn, LogOut, User } from 'lucide-react';

import { useChatContext } from '@/app/context/ChatContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStatus } from '@/hooks/use-auth-status';
import { cleanupUserDataOnLogout } from '@/lib/data-sync';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps) {
  const { user, isLoading } = useUser();
  const { resetAllState } = useChatContext();
  const { authEnabled, isLoading: authLoading } = useAuthStatus();

  const handleLogout = () => {
    
    try {
      cleanupUserDataOnLogout();      
      resetAllState();
      setTimeout(() => {
        window.location.href = '/api/auth/logout';
      }, 100);
      
    } catch (error) {
      console.error('Error during logout process:', error);
      // Fallback: redirect to logout anyway
      window.location.href = '/api/auth/logout';
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className={cn("w-8 h-8 rounded-full bg-muted animate-pulse", className)} />
    );
  }

  // Don't show sign in button if auth is not configured
  if (!user) {
    if (!authEnabled) {
      return null;
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => {
          window.location.href = `/api/auth/login`;
        }}
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">Sign In</span>
      </Button>
    );
  }

  const userInitials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "relative h-8 w-8 rounded-full p-0 hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0",
            className
          )}
        >
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name || 'User'}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
              {userInitials}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            {user.name && (
              <p className="font-medium">{user.name}</p>
            )}
            {user.email && (
              <p className="w-[200px] truncate text-sm text-muted-foreground">
                {user.email}
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.location.href = '/profile/'}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}