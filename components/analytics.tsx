'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import { useEffect, useState } from 'react';

import { hasAnalyticsConsent } from './cookie-banner';

export function ConditionalAnalytics() {
  const [shouldLoadAnalytics, setShouldLoadAnalytics] = useState(false);

  useEffect(() => {
    // Check if user has given consent for analytics
    const hasConsent = hasAnalyticsConsent();
    setShouldLoadAnalytics(hasConsent);

    // Listen for consent changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookie-consent') {
        const newConsent = e.newValue === 'accepted';
        setShouldLoadAnalytics(newConsent);
        
        // If consent was withdrawn, disable analytics
        if (!newConsent && typeof window !== 'undefined' && (window as unknown as { gtag?: Function }).gtag) {
          (window as unknown as { gtag: Function }).gtag('consent', 'update', {
            'analytics_storage': 'denied',
            'ad_storage': 'denied'
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Only render Google Analytics if user has consented
  if (!shouldLoadAnalytics || !process.env.NEXT_PUBLIC_GA_ID) {
    return null;
  }

  return <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />;
}