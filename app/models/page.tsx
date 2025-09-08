import { Metadata } from 'next';

import { ModelsPageClient } from '@/components/models/models-page-client';

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

// Cache for models/all API response  
let modelsCache: any = null;
let cacheTime: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

async function fetchAllModels() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (modelsCache && (now - cacheTime) < CACHE_TTL) {
    return modelsCache;
  }
  
  try {
    // Determine the correct base URL for the API call
    let baseUrl = 'http://localhost:3000';
    
    if (typeof window !== 'undefined') {
      // Client side - use current origin
      baseUrl = window.location.origin;
    } else if (process.env.VERCEL_URL) {
      // Vercel deployment
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXTAUTH_URL) {
      // Custom deployment
      baseUrl = process.env.NEXTAUTH_URL;
    }
    
    const response = await fetch(`${baseUrl}/api/models/all`, {
      next: { revalidate: 60 }, // Next.js caching
    });
    
    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }
    
    const data = await response.json();
    modelsCache = data;
    cacheTime = now;
    
    return data;
  } catch (error) {
    console.warn('[MODELS PAGE] Failed to fetch models/all, using empty fallback:', error);
    // Return empty fallback for build time and error cases
    return {
      models: [],
      user_tier: 'permissionless',
      stats: { total_models: 0 }
    };
  }
}

export default async function ModelsPage() {
  // Helper function to convert database model to config model format
  const convertToConfigModel = (dbModel: any) => ({
    id: dbModel.model_id, // This is the key - use model_id as the id for navigation
    name: dbModel.name,
    description: dbModel.description,
    available: dbModel.is_available_now, // Use the real-time availability status
    temperature: dbModel.temperature,
    top_p: dbModel.top_p,
    tokenLimit: dbModel.token_limit,
    owned_by: dbModel.owned_by,
    parameters: dbModel.parameters,
    architecture: dbModel.architecture,
    hf_repo: dbModel.hf_repo,
    aboutContent: dbModel.about_content,
    infoContent: dbModel.info_content,
    thumbnailId: dbModel.thumbnail_id,
    deployUrl: dbModel.deploy_url,
    apiId: dbModel.api_id,
    // Add the access control info for potential future use
    tier_requirement: dbModel.tier_requirement,
    user_has_access: dbModel.user_has_access,
    action_button: dbModel.action_button,
    action_text: dbModel.action_text
  });

  try {
    const { models: allModels } = await fetchAllModels();
    
    // Only show models that are currently available (both in database AND on LiteLLM API)
    const availableModels = allModels
      .filter((model: any) => model.is_available_now)
      .map(convertToConfigModel);
    return <ModelsPageClient models={availableModels} />;
  } catch (error) {
    console.error('[MODELS PAGE] Error fetching models:', error);
    // Return empty state or fallback
    return (
      <div className="flex-1 overflow-auto p-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Available Models</h1>
            <p className="text-muted-foreground">
              Unable to load models at this time. Please try again later.
            </p>
          </header>
        </div>
      </div>
    );
  }
} 