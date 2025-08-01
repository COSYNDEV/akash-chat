'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-3 py-2 hover:bg-accent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Link>
        </div>
        
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">Privacy Notice</h1>
        <p className="text-muted-foreground mb-8">Effective Date: August 1, 2025 | Last Updated: August 1, 2025</p>
        
        <div className="prose dark:prose-invert max-w-none">
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                AkashChat ("we," "our," or "us") is committed to protecting your privacy. This Privacy Notice explains how we collect, use, store, and protect your information when you use our AI chat application powered by Akash Network's decentralized infrastructure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-primary mb-3">1. Account Information</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">When you create an account, we collect:</p>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Email address and name (via Auth0 authentication)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Required marketing consent</strong>: Consent to receive marketing emails from Akash Network (required for authenticated access)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Payment information (if you subscribe to premium features)</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">2. Chat Data and Content</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Chat messages and conversations with AI models</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Custom system prompts and saved prompts</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Chat organization preferences (folders, names)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>AI model configurations (temperature, top-p settings)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Files you upload for context (PDFs, text documents)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Voice recordings for transcription (processed in real-time, not stored)</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">3. Technical Information</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Session tokens for authentication</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>IP address (for rate limiting anonymous users only)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Browser and device information</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Usage analytics (feature usage, not personal data)</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">4. Anonymous Usage</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">If you use AkashChat without an account:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>We collect minimal data necessary for functionality</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>IP-based rate limiting applies</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>No personal information is stored permanently</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">We use your information to:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Provide AI chat services through Akash Network</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Maintain your chat history and preferences</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Authenticate your account and maintain security</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Process voice transcriptions and file uploads</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Generate images through AkashGen service</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Process payments for premium features (when applicable)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Improve our services through usage analytics</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Send marketing communications from Akash Network</strong> (required for authenticated users to keep basic features free)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Send important service updates and billing notifications</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Data Storage and Security</h2>
              
              <h3 className="text-xl font-semibold text-primary mb-3">Encryption and Security</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Server-Side Encryption</strong>: All sensitive data is encrypted on our servers before being stored in the database using AES-GCM encryption</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Transport Security</strong>: All data is transmitted over HTTPS/TLS encryption</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>User-Specific Keys</strong>: Each user has unique encryption keys </span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Database Security</strong>: Encrypted data is stored in PostgreSQL with additional security measures</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-4">Data Access and Processing</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>AI Processing</strong>: Messages are processed by AI models to generate responses</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>No Human Review</strong>: Messages are processed automatically by AI systems</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>User Isolation</strong>: Each user's data is encrypted with unique keys</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Legal Requirements</strong>: We may access data only when required by law or for security investigations</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">Data Location</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>AI Processing: Distributed across Akash Network's decentralized infrastructure</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Session Management: Redis cache with configurable data retention</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Database Storage: PostgreSQL database with server-side encryption</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">Private Chats</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Private chats are stored only in memory during your session</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Private chats are never synced to our database or stored permanently</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Private chats are automatically deleted when you close the application</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Data Sharing and Third Parties</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">We share data only as necessary to provide our services:</p>

              <h3 className="text-xl font-semibold text-primary mb-3">AI Model Providers</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Chat messages are sent to AI models hosted on Akash Network for processing</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Messages are encrypted in transit and processed securely</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>AI providers may temporarily process your messages to generate responses</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">Service Providers</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Auth0</strong>: User authentication and account management</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Redis</strong>: Session and cache management</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Google Analytics</strong>: Anonymous usage statistics (if enabled)</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">No Data Sales</h3>
              <p className="text-muted-foreground leading-relaxed">
                We never sell, rent, or trade your personal information to third parties for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Your Rights and Choices</h2>
              
              <h3 className="text-xl font-semibold text-primary mb-3">Data Control</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Export Data</strong>: Download all your chat data, folders, and prompts in JSON format</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Delete Data</strong>: Permanently delete your account and all associated data</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Private Mode</strong>: Use private chats that are never stored permanently</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Access Control</strong>: Manage your authentication preferences and account settings</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">Marketing Communications</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Required for Authenticated Users</strong>: Consent to receive marketing emails from Akash Network is required to use the authenticated version of AkashChat with cloud sync and access to premium features</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>This consent helps keep basic features free by allowing us to share Akash Network updates and opportunities</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Anonymous Users</strong>: No marketing consent required, but limited to local storage and rate-limited access</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Premium Features</strong>: Some advanced features may require paid subscriptions in addition to marketing consent</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">Anonymous Usage</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Use AkashChat without creating an account (with rate limiting)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Access token authentication available for enhanced anonymous usage</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Data Retention</h2>
              
              <h3 className="text-xl font-semibold text-primary mb-3">Automatic Retention</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Session tokens expire after 10 minutes of inactivity (configurable)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Private chats are deleted immediately when you close the application</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Management tokens are cached for 23 hours maximum</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">User-Controlled Retention</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Your account data persists until you choose to delete it</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>You can selectively delete individual chats or your entire chat history</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Account deletion permanently removes all your data from our systems</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Cookies and Tracking</h2>
              
              <h3 className="text-xl font-semibold text-primary mb-3">Essential Cookies</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">We use minimal cookies for:</p>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Session management and authentication</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Theme preferences (dark/light mode)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Essential application functionality</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">Analytics</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Limited Google Analytics for understanding feature usage</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>No personal information is included in analytics</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>No social media tracking pixels or advertisement tracking</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">International Users</h2>
              <p className="text-muted-foreground leading-relaxed">
                AkashChat is powered by Akash Network's global, decentralized infrastructure. Your data may be processed across multiple geographic locations as part of this decentralized network. All data is encrypted using server-side encryption before being stored in our database, regardless of processing location.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our services are not directed to or intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you have reason to believe that a child under 13 has provided personal information to AkashChat through the services, please contact us through the channels provided on <Link href="https://akash.network" className="text-primary hover:underline">akash.network</Link>. We will investigate any report and, if appropriate, delete the personal information from our systems. Users under 18 require parental or guardian consent to use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Changes to This Privacy Notice</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                We may update this Privacy Notice from time to time. We will notify you of material changes by:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Posting the updated notice with a new effective date</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Sending email notifications for significant changes (if you've provided an email)</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Displaying prominent notices within the application</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about this Privacy Notice or our data practices, please contact us through the appropriate channels provided on <Link href="https://akash.network" className="text-primary hover:underline">akash.network</Link>.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>Project Repository:</strong> <Link href="https://github.com/akash-network/akash-chat" className="text-primary hover:underline">https://github.com/akash-network/akash-chat</Link>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 