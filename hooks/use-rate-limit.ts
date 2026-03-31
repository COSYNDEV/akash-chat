/**
 * Centralized rate limit management hook
 * Prevents multiple components from spamming the rate limit endpoint
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

interface RateLimitStatus {
  usagePercentage: number;
  remainingPercentage: number;
  resetTime: Date;
  blocked: boolean;
  authenticated: boolean;
  isLoading: boolean;
  error: string | null;
  conversationTokenPercentage: number;
  showConversationWarning: boolean;
}

// Singleton state to share across all components
let globalRateLimitState: RateLimitStatus | null = null;
let lastFetchTime = 0;
let subscribers: Set<(state: RateLimitStatus) => void> = new Set();
let fetchPromise: Promise<void> | null = null;

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
          usagePercentage: data.usagePercentage || 0,
          remainingPercentage: data.remainingPercentage || 100,
          resetTime: new Date(data.resetTime),
          blocked: data.blocked || false,
          authenticated: data.authenticated || false,
          isLoading: false,
          error: null,
          conversationTokenPercentage: data.conversationTokenPercentage || 0,
          showConversationWarning: data.showConversationWarning || false,
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
        usagePercentage: 0,
        remainingPercentage: 100,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        blocked: false,
        authenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rate limit',
        conversationTokenPercentage: 0,
        showConversationWarning: false,
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
  const { isLoading: isAuthLoading } = useUser();
  const [state, setState] = useState<RateLimitStatus>(() => 
    globalRateLimitState || {
      usagePercentage: 0,
      remainingPercentage: 100,
      resetTime: new Date(),
      blocked: false,
      authenticated: false,
      isLoading: true,
      error: null,
      conversationTokenPercentage: 0,
      showConversationWarning: false,
    }
  );

  const refreshRateLimit = useCallback(async () => {
    await fetchRateLimitStatus();
  }, []);

  useEffect(() => {
    // Skip if still loading auth
    if (isAuthLoading) return;

    // Subscribe to global state updates for both authenticated and anonymous users
    subscribers.add(setState);
    
    // Initial fetch if we don't have data
    const needsFetch = !globalRateLimitState || globalRateLimitState.isLoading;
    
    if (needsFetch) {
      fetchRateLimitStatus();
    } else if (globalRateLimitState) {
      // Use existing global state
      setState(globalRateLimitState);
    }

    // Cleanup
    return () => {
      subscribers.delete(setState);
    };
  }, [isAuthLoading]);

  // Check rate limit before sending a message
  const checkBeforeSubmit = useCallback(async (): Promise<boolean> => {
    await refreshRateLimit();
    
    // Return true if not blocked, false if blocked
    return !globalRateLimitState?.blocked;
  }, [refreshRateLimit]);

  const forceRefresh = useCallback(async () => {
    lastFetchTime = 0;
    await fetchRateLimitStatus();
  }, []);

  // Event-based tracking functions
  const trackMessageSuccess = useCallback(async (tokenUsage?: { promptTokens: number; completionTokens: number }) => {
    // Add delay to ensure server has finished updating rate limit
    // Server updates in result.usage.then() which happens after stream completes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update rate limit after successful message
    await forceRefresh();

    if (tokenUsage && process.env.NODE_ENV === 'development') {
      console.log('Message succeeded with token usage:', tokenUsage);
    }
  }, [forceRefresh]);

  const trackMessageFailure = useCallback(async (error?: any) => {
    // Handle message failure - refresh to get current status
    await forceRefresh();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Message failed:', error);
    }
  }, [forceRefresh]);

  return {
    ...state,
    refresh: refreshRateLimit,
    checkBeforeSubmit,
    forceRefresh,
    // Event-based tracking
    trackMessageSuccess,
    trackMessageFailure,
  };
}

