import { Metadata } from 'next';

import { ModelsPageClient } from '@/components/models/models-page-client';
import { getAvailableModels } from '@/lib/models';

export const metadata: Metadata = {
  title: 'AI Models - AkashChat',
  description: 'Explore all available AI models on AkashChat. Chat with leading open source AI models powered by the Akash Supercloud.',
  openGraph: {
    title: 'AI Models - AkashChat',
    description: 'Explore all available AI models on AkashChat. Chat with leading open source AI models powered by the Akash Supercloud.',
    url: 'https://chat.akash.network/models/',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AkashChat Models - Powered by Akash Network'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Models - AkashChat',
    description: 'Explore all available AI models on AkashChat. Chat with leading open source AI models powered by the Akash Supercloud.',
    images: ['/og-image.png']
  },
  keywords: ['free AI models', 'free to try AI', 'free LLM', 'free AI chat', 'AI models', 'language models', 'Akash Network', 'LLM', 'machine learning', 'open source AI', 'no cost AI models', 'try AI for free'],
  authors: [{ name: 'Akash Network', url: 'https://akash.network' }],
  creator: 'Akash Network',
  publisher: 'Akash Network',
};

// Revalidate every 10 minutes (600 seconds)
export const revalidate = 600;

export default async function ModelsPage() {
  const models = await getAvailableModels();
  const availableModels = models.filter(model => model.available);
  
  return <ModelsPageClient models={availableModels} />;
} 