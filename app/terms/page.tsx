'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
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

        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Effective Date: August 1, 2025 | Last Updated: August 1, 2025</p>

        <div className="prose dark:prose-invert max-w-none">
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using AkashChat ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                AkashChat is an AI chat application that provides access to artificial intelligence models through Akash Network's decentralized cloud infrastructure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">2. Description of Service</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">2.1 Core Features</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">AkashChat provides:</p>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Access to multiple AI models hosted on Akash Network</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Chat history management with local and cloud storage options</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Voice transcription capabilities</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Image generation through AkashGen</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>File upload and processing for context</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Customizable system prompts and model configurations</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Private chat modes with memory-only storage</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">2.2 Account Types</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Authenticated Users</strong>: Full features with cloud synchronization via Auth0</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Anonymous Users</strong>: Limited access with rate limiting and local storage only</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">2.3 Decentralized Infrastructure</h3>
              <p className="text-muted-foreground leading-relaxed">
                The Service utilizes Akash Network's decentralized compute infrastructure, meaning your requests may be processed across multiple independent providers in the network.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">3. Age Requirements and User Accounts</h2>
              
              <h3 className="text-xl font-semibold text-primary mb-3">3.1 Age Restrictions</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>You must be at least 13 years old to use AkashChat</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Users under 18 require parental or guardian consent to use our services</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>By using the Service, you represent that you meet these age requirements</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">3.2 Account Creation</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>You may create an account using Auth0 authentication services</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Marketing Consent Required</strong>: To access authenticated features with cloud sync, you must consent to receive marketing emails from Akash Network</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>This marketing consent requirement helps us keep basic features free for all users</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span><strong>Premium Features</strong>: Some advanced features may require paid subscriptions in addition to marketing consent</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>You are responsible for maintaining the confidentiality of your account credentials</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>You must provide accurate and complete information</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">3.3 Account Security</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>You are responsible for all activities under your account</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Notify us immediately of any unauthorized use of your account</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We reserve the right to suspend accounts showing suspicious activity</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">3.4 Anonymous Usage</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Anonymous users may use the Service with rate limiting without marketing consent requirements</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Anonymous usage is subject to IP-based access controls</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>No data persistence or cloud synchronization for anonymous users</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">4. Acceptable Use Policy</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">4.1 Permitted Uses</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">You may use AkashChat for:</p>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Legitimate AI-assisted conversations and tasks</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Educational and research purposes</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Creative writing and content generation</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Code assistance and technical discussions</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Image generation for lawful purposes</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">4.2 Prohibited Uses</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">You may NOT use AkashChat for:</p>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Illegal activities or content that violates applicable laws</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Harassment, abuse, or harmful content directed at individuals or groups</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Generating malicious code, malware, or security exploits</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Spamming or automated abuse of the Service</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Circumventing rate limits or security measures</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Impersonating others or providing false information</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Activities that could harm minors</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Generating content that infringes intellectual property rights</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Activities that violate Akash Network's acceptable use policies</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">4.3 Content Moderation</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>We reserve the right to review content for compliance with these Terms</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We may suspend or terminate accounts that violate our Acceptable Use Policy</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Users are responsible for the content they generate and share</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">5. Intellectual Property Rights</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">5.1 Your Content</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>You retain ownership of content you input into the Service</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>You grant us a limited license to process your content to provide the Service</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>You represent that you have the right to use and share any content you upload</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">5.2 AI-Generated Content</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>AI-generated responses are provided as-is without ownership claims</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>You are responsible for reviewing and validating AI-generated content</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>AI outputs may not be unique and similar content may be generated for other users</span></li>
              </ul>

            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">6. Privacy and Data Protection</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">6.1 Data Handling</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Your use of the Service is governed by our Privacy Notice</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We implement client-side encryption for sensitive data</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Private chats are never stored permanently and exist only in memory</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">6.2 Data Retention</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>You control your data retention through export and deletion features</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Account deletion permanently removes all your data from our systems</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Session data expires automatically based on configured time limits</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">6.3 Third-Party Processing</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>AI model providers may temporarily process your messages to generate responses</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>All data processing occurs within the global Akash Network infrastructure</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We do not sell or share your personal data for marketing purposes</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">7. Service Availability and Performance</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">7.1 Service Availability</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>We strive to maintain high availability but do not guarantee uninterrupted service</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Scheduled and emergency maintenance may temporarily interrupt the Service</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Decentralized infrastructure may experience varying performance across providers</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">7.2 Rate Limiting</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>Anonymous users are subject to rate limiting based on IP address</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Authenticated users have extended access to prevent abuse</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Rate limits may be adjusted to ensure fair usage and service stability</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">7.3 Resource Usage</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>AI model access is subject to availability on the Akash Network</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Heavy usage may be subject to fair use policies</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We reserve the right to implement usage limits if necessary</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">8. Payment and Billing</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">8.1 Service Pricing Model</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                AkashChat's core features are provided free of charge for all users. Authenticated users receive enhanced features in exchange for marketing consent to Akash Network communications. Premium features may require paid subscriptions for authenticated users. Anonymous users receive basic features without marketing consent requirements but with usage limitations. This tiered model allows us to keep essential features free while supporting advanced functionality and Akash Network's ecosystem.
              </p>

              <h3 className="text-xl font-semibold text-primary mb-3">8.2 Premium Subscriptions</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Premium features may be introduced that require paid subscriptions</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>All premium features will be clearly disclosed with transparent pricing</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Payment terms and billing cycles will be provided before any charges are incurred</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Refund policies will be established and communicated for all paid services</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Users can manage their subscriptions through their account settings</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Introduction of premium features will not remove existing free functionality</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">9. Disclaimers and Limitations</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">9.1 AI Content Disclaimer</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>AI-generated content is provided for informational purposes only</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>AI responses may contain inaccuracies, biases, or inappropriate content</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Users should verify important information independently</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We are not responsible for decisions made based on AI-generated content</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">9.2 Service Disclaimer</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>The Service is provided "as-is" without warranties of any kind</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We disclaim all warranties, express or implied, including merchantability and fitness for purpose</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Decentralized infrastructure means we cannot guarantee consistent performance</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">9.3 Limitation of Liability</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Our liability is limited to the maximum extent permitted by law</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We are not liable for indirect, incidental, or consequential damages</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Total liability, if any, is limited to the amount paid for the Service (currently $0)</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">10. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                You agree to indemnify and hold harmless AkashChat, Akash Network, and our affiliates from any claims, damages, or expenses arising from:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Your use of the Service</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Your violation of these Terms</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Your violation of any third-party rights</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Content you submit or generate through the Service</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">11. Termination</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">11.1 Termination by You</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>You may stop using the Service at any time</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>You may delete your account and all associated data</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Termination does not relieve you of obligations incurred before termination</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">11.2 Termination by Us</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>We may suspend or terminate your access for violations of these Terms</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We may discontinue the Service with reasonable advance notice</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Active subscriptions will be handled according to our refund policy upon service termination</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Upon termination, your right to use the Service ceases immediately</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">11.3 Effect of Termination</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Terminated accounts lose access to all Service features</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Data retention follows our Privacy Notice and deletion policies</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Provisions of these Terms that should survive termination will continue to apply</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">12. Changes to Terms</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">12.1 Updates</h3>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start"><span className="mr-2">•</span><span>We may update these Terms from time to time</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Material changes will be communicated through the Service or email</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Continued use after changes constitutes acceptance of new Terms</span></li>
              </ul>

              <h3 className="text-xl font-semibold text-primary mb-3">12.2 Notification</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>We will provide at least 30 days notice for significant changes</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Changes will be posted with updated effective dates</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Users who disagree with changes may terminate their use of the Service</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">13. Dispute Resolution</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">13.1 Governing Law</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                These Terms are governed by applicable law, without regard to conflict of law principles.
              </p>

              <h3 className="text-xl font-semibold text-primary mb-3">13.2 Dispute Resolution Process</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start"><span className="mr-2">•</span><span>Initial disputes should be addressed through direct communication</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Formal disputes may be subject to binding arbitration</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Class action waivers may apply where legally permissible</span></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">14. General Provisions</h2>
              <h3 className="text-xl font-semibold text-primary mb-3">14.1 Entire Agreement</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                These Terms, together with our Privacy Notice, constitute the entire agreement between you and AkashChat.
              </p>

              <h3 className="text-xl font-semibold text-primary mb-3">14.2 Severability</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If any provision of these Terms is found unenforceable, the remaining provisions will continue in full force.
              </p>

              <h3 className="text-xl font-semibold text-primary mb-3">14.3 No Waiver</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Failure to enforce any provision does not constitute a waiver of our rights.
              </p>

              <h3 className="text-xl font-semibold text-primary mb-3">14.4 Assignment</h3>
              <p className="text-muted-foreground leading-relaxed">
                We may assign these Terms or our rights hereunder. You may not assign your rights without our consent.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">15. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms of Use or to report violations, please contact us through the appropriate channels provided on <Link href="https://akash.network" className="text-primary hover:underline">akash.network</Link>.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                <strong>Project Repository:</strong> <Link href="https://github.com/akash-network/akash-chat" className="text-primary hover:underline">https://github.com/akash-network/akash-chat</Link>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>Akash Network:</strong> <Link href="https://akash.network" className="text-primary hover:underline">https://akash.network</Link>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">16. Acknowledgment</h2>
              <p className="text-muted-foreground leading-relaxed">
                By using AkashChat, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Notice.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 