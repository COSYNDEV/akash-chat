import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { models } from '@/app/config/models';
import { ModelDetailClient } from '@/components/models/model-detail-client';

// Revalidate every 10 minutes like the main models page
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
    console.warn('[MODELS] Failed to fetch models/all, using static fallback:', error);
    // Return static fallback for build time and error cases
    return {
      models: models.map(model => ({
        model_id: model.id,
        name: model.name,
        description: model.description,
        tier_requirement: 'permissionless',
        available: true,
        parameters: model.parameters,
        architecture: model.architecture,
        about_content: model.aboutContent,
        info_content: model.infoContent,
        thumbnail_id: model.thumbnailId,
        deploy_url: model.deployUrl,
        user_has_access: true,
        is_available_now: true,
        action_button: 'start_chat',
        action_text: 'Start Chat',
        temperature: model.temperature,
        top_p: model.top_p,
        token_limit: model.tokenLimit,
        owned_by: model.owned_by,
        hf_repo: model.hf_repo,
        api_id: model.apiId,
        display_order: 0
      })),
      user_tier: 'permissionless',
      stats: { total_models: models.length }
    };
  }
}

// Generate static params for all models in the config
// This ensures all model pages are pre-built at build time
export async function generateStaticParams() {
  try {
    const { models: allModels } = await fetchAllModels();
    return allModels.map((model: any) => ({
      modelId: model.model_id,
    }));
  } catch (error) {
    console.warn('[MODELS] Using static config for generateStaticParams:', error);
    return models.map(model => ({
      modelId: model.id,
    }));
  }
}

export async function generateMetadata(props: {
  params: Promise<{ modelId: string }>
}): Promise<Metadata> {
  const { modelId } = await props.params;
  
  // Try to get model from API first, then fallback to static config
  let model: any = null;
  try {
    const { models: allModels } = await fetchAllModels();
    model = allModels.find((m: any) => m.model_id.toLowerCase() === modelId.toLowerCase());
  } catch (error) {
    console.warn('[MODELS] Using static config for metadata:', error);
  }
  
  // Fallback to static config if not found in API
  if (!model) {
    const staticModel = models.find(m => m.id.toLowerCase() === modelId.toLowerCase());
    if (!staticModel) {
      return {
        title: 'Model Not Found - AkashChat',
        description: 'The requested AI model could not be found on AkashChat.',
      };
    }
    model = {
      name: staticModel.name,
      description: staticModel.description,
      about_content: staticModel.aboutContent,
      hf_repo: staticModel.hf_repo,
      architecture: staticModel.architecture,
      parameters: staticModel.parameters,
      token_limit: staticModel.tokenLimit
    };
  }

  return {
    title: `${model.name} - AI Model | AkashChat`,
    description: model.about_content || model.description || `Learn about and chat with ${model.name}, an advanced AI model powered by the Akash Supercloud.`,
    openGraph: {
      title: `${model.name} - AI Model | AkashChat`,
      description: model.about_content || model.description || `Learn about and chat with ${model.name}, an advanced AI model powered by the Akash Supercloud.`,
      url: `https://chat.akash.network/models/${modelId}/`,
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: `${model.name} - AI Model on AkashChat`
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${model.name} - AI Model | AkashChat`,
      description: model.about_content || model.description || `Learn about and chat with ${model.name}, an advanced AI model powered by the Akash Supercloud.`,
      images: ['/og-image.png']
    },
    alternates: {
      canonical: `/models/${modelId}/`,
    },
    keywords: ['AI model', model.name, 'language model', 'Akash Network', 'LLM', 'machine learning', 'chat model', 'AI conversation', 'free AI', 'free chat AI', 'free AI model', 'decentralized AI', model.hf_repo || '', model.architecture || '', (model.parameters || '') + ' parameters', (model.token_limit || model.tokenLimit)?.toString() + ' context length' || ''],
  };
}

export default async function ModelIntroPage(props: {
  params: Promise<{ modelId: string }>
}) {
  const { modelId } = await props.params;
  
  // Get model data with access control and availability info
  let modelWithAccess: any = null;
  let userTier = 'permissionless';
  
  try {
    const { models: allModels, user_tier } = await fetchAllModels();
    modelWithAccess = allModels.find((m: any) => m.model_id.toLowerCase() === modelId.toLowerCase());
    userTier = user_tier || 'permissionless';
  } catch (error) {
    console.warn('[MODELS DETAIL] API error, using static fallback:', error);
  }
  
  // Fallback to static config if not found in API
  if (!modelWithAccess) {
    const staticModel = models.find(m => m.id.toLowerCase() === modelId.toLowerCase());
    if (!staticModel) {
      notFound();
    }
    
    // Convert static model to API format
    modelWithAccess = {
      model_id: staticModel.id,
      name: staticModel.name,
      description: staticModel.description,
      tier_requirement: 'permissionless',
      available: true,
      temperature: staticModel.temperature,
      top_p: staticModel.top_p,
      token_limit: staticModel.tokenLimit,
      owned_by: staticModel.owned_by,
      parameters: staticModel.parameters,
      architecture: staticModel.architecture,
      hf_repo: staticModel.hf_repo,
      about_content: staticModel.aboutContent,
      info_content: staticModel.infoContent,
      thumbnail_id: staticModel.thumbnailId,
      deploy_url: staticModel.deployUrl,
      api_id: staticModel.apiId,
      user_has_access: true,
      is_available_now: true,
      action_button: 'start_chat',
      action_text: 'Start Chat',
      display_order: 0
    };
  }
  
  // Helper function to convert database model to config model format for compatibility
  const convertToConfigModel = (dbModel: any) => ({
    id: dbModel.model_id,
    name: dbModel.name,
    description: dbModel.description,
    available: dbModel.is_available_now,
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
  });

  const model = convertToConfigModel(modelWithAccess);

  return (
    <>
      {/* Pre-render model data on the server for better SEO */}
      <article 
        className="model-detail"
        itemScope 
        itemType="https://schema.org/WebApplication"
      >
        {/* Web Application Properties */}
        <meta itemProp="name" content="AkashChat" />
        <meta itemProp="description" content="A platform for chatting with various AI language models" />
        <meta itemProp="applicationCategory" content="ChatApplication" />
        <meta itemProp="operatingSystem" content="Any" />
        <meta itemProp="url" content={`https://chat.akash.network/models/${modelId}/`} />
        
        {/* Chat Service Properties */}
        <div itemProp="offers" itemScope itemType="https://schema.org/Service">
          <meta itemProp="name" content={`Chat with ${model.name}`} />
          <meta itemProp="description" content={model.aboutContent || model.description} />
          <meta itemProp="serviceType" content="AI Chat Service" />
          <div itemProp="offers" itemScope itemType="https://schema.org/Offer">
            <meta itemProp="price" content="0" />
            <meta itemProp="priceCurrency" content="USD" />
            <meta itemProp="availability" content="https://schema.org/InStock" />
          </div>
        </div>

        {/* AI Model Properties */}
        <div itemProp="about" itemScope itemType="https://schema.org/SoftwareApplication">
          <meta itemProp="name" content={model.name} />
          <meta itemProp="description" content={model.aboutContent || model.description} />
          <meta itemProp="applicationCategory" content="ArtificialIntelligenceApplication" />
          <meta itemProp="featureList" content={`Parameters: ${model.parameters}, Architecture: ${model.architecture}, Token Limit: ${model.tokenLimit}, Hugging Face Repo: ${model.hf_repo}`} />
          <meta itemProp="softwareVersion" content="1.0" />
        </div>

        {/* Publisher Information */}
        <div itemProp="publisher" itemScope itemType="https://schema.org/Organization">
          <meta itemProp="name" content="Akash Network" />
          <meta itemProp="url" content="https://akash.network" />
        </div>
        
        <div className="max-w-4xl mx-auto p-4">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2" itemProp="name">{model.name}</h1>
            <p className="text-muted-foreground" itemProp="description">
              { model.description || "An AI language model for chat and text generation."}
            </p>
            {/* Add hidden accessible metadata for search engines */}
            <div className="sr-only">
              <p>Model ID: {model.id}</p>
              <p>Token Limit: {model.tokenLimit ? `${(model.tokenLimit / 1000).toFixed(0)}K` : 'Standard'}</p>
              <p>Availability: {model.available ? 'Available' : 'Currently Unavailable'}</p>
              <p>Parameters: {model.parameters}</p>
              <p>Architecture: {model.architecture}</p>
              <p>Temperature: {model.temperature}</p>
              <p>Top P: {model.top_p}</p>
              <p>Hugging Face Repo: {model.hf_repo}</p>
            </div>
          </header>
        </div>
      </article>
      
      {/* Client component for interactive elements */}
      <ModelDetailClient 
        modelId={modelId} 
        model={model} 
        modelWithAccess={modelWithAccess}
        userTier={userTier}
      />
    </>
  );
} 