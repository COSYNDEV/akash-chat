'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { AlertCircle, LoaderCircle, Trash2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { defaultModel, models } from '@/app/config/models';
import { useChatContext } from '@/app/context/ChatContext';
import { AkashChatLogo } from '@/components/branding/akash-chat-logo';
import { ChatHeader } from '@/components/chat/chat-header';
import { Button } from '@/components/ui/button';
import { cleanupUserDataOnLogout, clearUserChatsFromLocalStorage } from '@/lib/data-sync';

export default function ProfilePage() {
  // All hooks at the top
  const { user, isLoading } = useUser();
  const router = useRouter();
  const { resetAllState, refreshFolders } = useChatContext();
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingConsent, setCheckingConsent] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [deleteType, setDeleteType] = useState<'chat' | 'account'>('chat');
  const defaultModelObj = models.find(m => m.id === defaultModel) || models[0];

  const isEmailVerified = user?.email_verified || user?.emailVerified;

  // Check if user has already given marketing consent
  useEffect(() => {
    const checkMarketingConsent = async () => {
      if (!user || !isEmailVerified) {return;}
      
      setCheckingConsent(true);
      try {
        const res = await fetch('/api/user/verification-status', {
          method: 'GET',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.marketingConsent) {
            setMarketingConsent(true);
            // Don't set consentGiven here - this is for existing consent
          }
        }
      } catch (e) {
        console.error('Failed to check marketing consent:', e);
      } finally {
        setCheckingConsent(false);
      }
    };

    checkMarketingConsent();
  }, [user, isEmailVerified]);

  const handleConsent = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Save marketing consent to Auth0 user_metadata via API (session-based)
      const res = await fetch('/api/user/verification-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consent: true }),
        credentials: 'include', // Ensure session cookie is sent
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save consent');
      }
      
      // Set consent states and redirect immediately
      setConsentGiven(true);
      setMarketingConsent(true);
      setRedirecting(true);
      
      // Use a timeout to ensure state is set before redirect
      setTimeout(() => {
        router.replace('/');
      }, 100);
    } catch (e: any) {
      setError(e.message || 'Failed to save consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteData = async () => {
    setDeletingData(true);
    setError(null);
    try {
      if (deleteType === 'chat') {
        const res = await fetch('/api/user/chat-history', {
          method: 'DELETE',
          credentials: 'include',
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to delete chat history');
        }
        
        const result = await res.json();
        
        // Clear user chats from localStorage if API indicates to do so
        if (result.clearLocalStorage) {
          clearUserChatsFromLocalStorage();
          
          // Refresh the app state to reflect the cleared local storage
          refreshFolders();
          
          // Schedule a page refresh after showing success message to reflect cleared state
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
        
        setSuccessMessage(result.message || 'Chat history deleted successfully!');
        setShowSuccessModal(true);
      } else if (deleteType === 'account') {
        const res = await fetch('/api/user/account', {
          method: 'DELETE',
          credentials: 'include',
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to delete account');
        }
        
        const result = await res.json();
        setSuccessMessage(result.message || 'Account deleted successfully! You will be logged out.');
        setShowSuccessModal(true);
        
        // Coordinated logout process
        try {
          // Step 1: Clean up localStorage
          cleanupUserDataOnLogout();
          // Step 2: Reset React state
          resetAllState();
          
          // Step 3: Redirect after cleanup
          setTimeout(() => {
            window.location.href = '/api/auth/logout';
          }, 100);
        } catch (error) {
          console.error('Error during logout cleanup:', error);
          window.location.href = '/api/auth/logout';
        }
        return;
      }
      
      setShowDeleteConfirm(false);
    } catch (e: any) {
      setError(e.message || `Failed to delete ${deleteType}. Please try again.`);
    } finally {
      setDeletingData(false);
    }
  };

  const openDeleteConfirm = (type: 'chat' | 'account') => {
    setDeleteType(type);
    setShowDeleteConfirm(true);
  };

  // Only redirect if user just completed consent (not when visiting profile directly)
  useEffect(() => {
    if (consentGiven && !checkingConsent && !redirecting) {
      setRedirecting(true);
      router.replace('/');
    }
  }, [consentGiven, checkingConsent, redirecting, router]);

  // Handle redirect for non-authenticated users
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [isLoading, user, router]);

  // Only after all hooks: conditional returns
  if (isLoading || checkingConsent || redirecting) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-lg z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AkashChatLogo className="w-48 animate-pulse" />
          <LoaderCircle className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header - using normal ChatHeader */}
      <ChatHeader
        modelSelection={defaultModelObj.id}
        setModelSelection={() => {}}
        availableModels={[defaultModelObj]}
        isLoadingModels={false}
        isSidebarOpen={false}
        setSidebarOpen={() => {}}
        disableSidebarButton={true}
        disableModelSelection={true}
        className="gap-6"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center p-4 min-h-full">
            <div className={`w-full space-y-6 ${isEmailVerified && (marketingConsent || consentGiven) ? 'max-w-2xl' : 'max-w-md'}`}>
            {!isEmailVerified ? (
              <div className="border border-border rounded-lg p-6 text-center space-y-4">
                <div className="flex justify-center">
                  <AlertCircle className="w-12 h-12 text-amber-500" />
                </div>
                <h1 className="text-2xl font-bold">Complete Your Profile</h1>
                <h2 className="text-lg font-semibold">Verify Your Email</h2>
                <p className="text-muted-foreground">
                  You must verify your email address to continue using AkashChat. 
                  Please check your inbox for a verification email and follow the instructions.
                </p>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline"
                  className="w-full"
                >
                  I've Verified My Email
                </Button>
              </div>
            ) : !(marketingConsent || consentGiven) ? (
              <div className="border border-border rounded-lg p-6 text-center space-y-4">
                <div className="flex justify-center">
                  <AlertCircle className="w-12 h-12" />
                </div>
                <h1 className="text-2xl font-bold">Complete Your Profile</h1>
                <h2 className="text-lg font-semibold">Marketing Consent Required</h2>
                <p className="text-muted-foreground">
                  To use AkashChat, you must agree to receive marketing emails. 
                </p>
                {error && (
                  <div className="text-red-500 text-sm flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
                <Button 
                  onClick={handleConsent} 
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? 'Saving...' : 'I Agree to Receive Marketing Emails'}
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-2xl font-bold">Profile Settings</h1>
                  <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                  </p>
                </div>
                
                <div className="border border-border rounded-lg p-6 space-y-6">
                  {/* Account Information */}
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Account Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <div className="p-3 bg-muted rounded-md">
                          <span className="text-sm">{user?.email}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <div className="p-3 bg-muted rounded-md">
                          <span className="text-sm">{user?.name || 'Not set'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Marketing Preferences */}
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Marketing Preferences</h2>
                    <div className="p-4 bg-muted rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Marketing Emails</p>
                          <p className="text-xs text-muted-foreground">Receive updates about new features and announcements</p>
                        </div>
                        <div className="text-sm text-green-600">✓ Enabled</div>
                      </div>
                    </div>
                  </div>

                  {/* Privacy & Data */}
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Privacy & Data</h2>
                    <div className="p-4 bg-muted rounded-md space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Chat History</p>
                          <p className="text-xs text-muted-foreground">Delete all your conversation history permanently</p>
                        </div>
                        <Button 
                          onClick={() => openDeleteConfirm('chat')}
                          variant="destructive"
                          size="sm"
                          disabled={deletingData}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete History
                        </Button>
                      </div>
                      
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-600">Delete Account</p>
                            <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
                          </div>
                          <Button 
                            onClick={() => openDeleteConfirm('account')}
                            variant="destructive"
                            size="sm"
                            disabled={deletingData}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Account
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delete Confirmation Modal */}
                  {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full space-y-4">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-6 h-6 text-red-500" />
                          <h3 className="text-lg font-semibold">
                            {deleteType === 'chat' && 'Delete Chat History'}
                            {deleteType === 'account' && 'Delete Account'}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {deleteType === 'chat' && 'Are you sure you want to delete all your chat history? This action cannot be undone.'}
                          {deleteType === 'account' && 'Are you sure you want to permanently delete your account? This will delete all your data including chat history, settings, and account information. This action cannot be undone.'}
                        </p>
                        {deleteType === 'account' && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-800 font-medium">
                              ⚠️ Warning: Account deletion is permanent and irreversible.
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <Button 
                            onClick={() => setShowDeleteConfirm(false)}
                            variant="outline"
                            disabled={deletingData}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleDeleteData}
                            variant="destructive"
                            disabled={deletingData}
                          >
                            {deletingData ? (
                              <>
                                <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                                {deleteType === 'chat' && 'Deleting...'}
                                {deleteType === 'account' && 'Deleting Account...'}
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                {deleteType === 'chat' && 'Delete History'}
                                {deleteType === 'account' && 'Delete Account'}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Success Modal */}
                  {showSuccessModal && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full space-y-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <h3 className="text-lg font-semibold">Success</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {successMessage}
                        </p>
                        <div className="flex justify-end">
                          <Button 
                            onClick={() => {
                              setShowSuccessModal(false);
                              setSuccessMessage('');
                            }}
                          >
                            OK
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Back to App */}
                  <div className="pt-4">
                    <Button 
                      onClick={() => router.replace('/')}
                      className="w-full"
                    >
                      Back to AkashChat
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 