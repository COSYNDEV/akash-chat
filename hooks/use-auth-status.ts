'use client';

import { useState, useEffect } from 'react';

interface AuthStatus {
  authEnabled: boolean | null;
  requiresAccessToken: boolean;
  isLoading: boolean;
}

export function useAuthStatus(): AuthStatus {
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [requiresAccessToken, setRequiresAccessToken] = useState(false);

  useEffect(() => {
    fetch('/api/auth/status/')
      .then(res => res.json())
      .then(data => {
        setAuthEnabled(data.authEnabled);
        setRequiresAccessToken(data.requiresAccessToken ?? false);
      })
      .catch(() => {
        setAuthEnabled(false);
        setRequiresAccessToken(false);
      });
  }, []);

  return {
    authEnabled,
    requiresAccessToken,
    isLoading: authEnabled === null,
  };
}
