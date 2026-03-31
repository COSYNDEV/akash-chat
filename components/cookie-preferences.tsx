'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { safeSetItem } from '@/lib/local-storage-manager';

import { getCookieConsent } from './cookie-banner';

interface CookiePreferencesProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CookiePreferences({ isOpen, onClose }: CookiePreferencesProps) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    setAnalyticsEnabled(consent === 'accepted');
  }, [isOpen]);

  const handleSave = () => {
    safeSetItem('cookie-consent', analyticsEnabled ? 'accepted' : 'declined');
    
    if (!analyticsEnabled && typeof window !== 'undefined' && (window as unknown as { gtag?: Function }).gtag) {
      (window as unknown as { gtag: Function }).gtag('consent', 'update', {
        'analytics_storage': 'denied',
        'ad_storage': 'denied'
      });
    }
    
    // Trigger a storage event to notify other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'cookie-consent',
      newValue: analyticsEnabled ? 'accepted' : 'declined'
    }));
    
    onClose();
  };

  const handleAcceptAll = () => {
    setAnalyticsEnabled(true);
    safeSetItem('cookie-consent', 'accepted');
    
    // Enable Google Analytics consent
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: Function }).gtag) {
      (window as unknown as { gtag: Function }).gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': 'denied'
      });
    }
    
    // Trigger a storage event to notify other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'cookie-consent',
      newValue: 'accepted'
    }));
    
    onClose();
  };

  const clearAllData = () => {
    if (confirm('This will clear all your local data including chats, settings, and preferences. Are you sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cookie Preferences</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Cookie Categories</h3>
            
            <div className="space-y-4">
              <div className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Essential Cookies</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Required HTTP cookies for authentication (session_token) and core functionality. 
                    Your chat data, themes, and preferences are stored locally on your device, not in cookies.
                    These cannot be disabled.
                  </p>
                </div>
                <input type="checkbox" checked={true} disabled className="w-4 h-4" />
              </div>
              
              <div className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Analytics Cookies</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Help us understand how you use our service to improve performance and user experience. 
                    Uses Google Analytics with privacy-focused settings.
                  </p>
                </div>
                <input 
                  type="checkbox" 
                  checked={analyticsEnabled} 
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Data Management</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearAllData}>
                Clear All Local Data
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/privacy">Privacy Policy</Link>
              </Button>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleSave}>
              Save Custom
            </Button>
            <Button onClick={handleAcceptAll} className="bg-primary hover:bg-primary/90">
              Accept All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}