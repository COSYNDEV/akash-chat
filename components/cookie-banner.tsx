'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { getCookie, setCookie } from '@/lib/cookies';

import { CookiePreferences } from './cookie-preferences';

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = getCookie('cookie-consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleConsent = (accepted: boolean) => {
    setCookie('cookie-consent', accepted ? 'accepted' : 'declined', {
      days: accepted ? 365 : 1  // Declined consent expires after 1 day, accepted after 1 year
    });
    
    if (!accepted) {
      // Disable Google Analytics if it was loaded
      if (typeof window !== 'undefined' && (window as unknown as { gtag?: Function }).gtag) {
        (window as unknown as { gtag: Function }).gtag('consent', 'update', {
          'analytics_storage': 'denied',
          'ad_storage': 'denied'
        });
      }
    } else {
      // Enable Google Analytics consent
      if (typeof window !== 'undefined' && (window as unknown as { gtag?: Function }).gtag) {
        (window as unknown as { gtag: Function }).gtag('consent', 'update', {
          'analytics_storage': 'granted',
          'ad_storage': 'denied'
        });
      }
    }
    
    setShowBanner(false);
  };

  if (!showBanner) {return null;}

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-xl z-50">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium mb-1">Cookie Notice</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                We use essential cookies for functionality and optional cookies for analytics.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => handleConsent(false)} 
                  variant="outline" 
                  size="sm"
                  className="text-xs h-8"
                >
                  Essential Only
                </Button>
                <Button 
                  onClick={() => handleConsent(true)} 
                  size="sm"
                  className="text-xs h-8"
                >
                  Accept All
                </Button>
              </div>
              
              <div className="flex items-center gap-3 mt-2 text-xs">
                <button 
                  onClick={() => setShowDetails(true)} 
                  className="text-primary hover:text-primary/80 transition-colors underline-offset-2 hover:underline"
                >
                  Details
                </button>
                <Link 
                  href="/privacy" 
                  className="text-primary hover:text-primary/80 transition-colors underline-offset-2 hover:underline"
                >
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <CookiePreferences 
        isOpen={showDetails} 
        onClose={() => setShowDetails(false)} 
      />
    </>
  );
}

export function getCookieConsent(): 'accepted' | 'declined' | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const consent = getCookie('cookie-consent');
  return consent as 'accepted' | 'declined' | null;
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'accepted';
}