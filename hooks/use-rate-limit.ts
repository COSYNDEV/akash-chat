/**
 * Centralized rate limit management hook
 * Prevents multiple components from spamming the rate limit endpoint
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

interface RateLimitStatus {
  limit: number;
  used: number;
  remaining: number;
  resetTime: Date;
  blocked: boolean;
  authenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Singleton state to share across all components
let globalRateLimitState: RateLimitStatus | null = null;
let lastFetchTime = 0;
let subscribers: Set<(state: RateLimitStatus) => void> = new Set();
let fetchPromise: Promise<void> | null = null;

const FETCH_INTERVAL = 5000; // 5 seconds for more responsive rate limiting
const MIN_FETCH_INTERVAL = 1000; // Minimum 1 second between fetches

async function fetchRateLimitStatus(): Promise<void> {
  const now = Date.now();
  
  // Prevent too frequent fetches
  if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
    return;
  }

  // If there's already a fetch in progress, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      lastFetchTime = now;
      const response = await fetch('/api/rate-limit/status');
      
      if (response.ok) {
        const data = await response.json();
        const newState: RateLimitStatus = {
          limit: data.limit,
          used: data.used,
          remaining: data.remaining,
          resetTime: new Date(data.resetTime),
          blocked: data.blocked || false,
          authenticated: data.authenticated || false,
          isLoading: false,
          error: null,
        };
        
        globalRateLimitState = newState;
        
        // Notify all subscribers
        subscribers.forEach(callback => callback(newState));
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Rate limit fetch error:', error);
      
      const errorState: RateLimitStatus = {
        limit: 20,
        used: 0,
        remaining: 20,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        blocked: false,
        authenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rate limit',
      };
      
      globalRateLimitState = errorState;
      subscribers.forEach(callback => callback(errorState));
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function useRateLimit() {
  const { user, isLoading: isAuthLoading } = useUser();
  const [state, setState] = useState<RateLimitStatus>(() => 
    globalRateLimitState || {
      limit: 0,
      used: 0,
      remaining: 0,
      resetTime: new Date(),
      blocked: false,
      authenticated: false,
      isLoading: true,
      error: null,
    }
  );

  const refreshRateLimit = useCallback(async () => {
    // Don't fetch for authenticated users
    if (user?.sub) return;
    await fetchRateLimitStatus();
  }, [user?.sub]);

  useEffect(() => {
    // For authenticated users, return extended status immediately
    if (user?.sub) {
      const authenticatedState: RateLimitStatus = {
        limit: 999999,
        used: 0,
        remaining: 999999,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        blocked: false,
        authenticated: true,
        isLoading: false,
        error: null,
      };
      setState(authenticatedState);
      return; // Don't set up any polling for authenticated users
    }

    // Skip if still loading auth
    if (isAuthLoading) return;

    // Subscribe to global state updates for anonymous users only
    subscribers.add(setState);
    
    // Initial fetch if we don't have data or it's stale
    const needsFetch = !globalRateLimitState || 
      globalRateLimitState.isLoading || 
      (Date.now() - lastFetchTime > FETCH_INTERVAL);
    
    if (needsFetch) {
      fetchRateLimitStatus();
    } else if (globalRateLimitState) {
      // Use existing global state
      setState(globalRateLimitState);
    }

    // Set up periodic refresh for anonymous users only
    const interval = setInterval(() => {
      fetchRateLimitStatus();
    }, FETCH_INTERVAL);

    // Cleanup
    return () => {
      subscribers.delete(setState);
      clearInterval(interval);
    };
  }, [user?.sub, isAuthLoading]);

  // Check rate limit before sending a message
  const checkBeforeSubmit = useCallback(async (): Promise<boolean> => {
    // Authenticated users are never rate limited
    if (user?.sub) return true;
    
    // Refresh rate limit status before checking
    await refreshRateLimit();
    
    // Return true if not blocked, false if blocked
    return !globalRateLimitState?.blocked;
  }, [user?.sub, refreshRateLimit]);

  // Force refresh rate limit status (useful after failed requests)
  const forceRefresh = useCallback(async () => {
    lastFetchTime = 0; // Reset to force immediate fetch
    await fetchRateLimitStatus();
  }, []);

  return {
    ...state,
    refresh: refreshRateLimit,
    checkBeforeSubmit,
    forceRefresh,
  };
}

