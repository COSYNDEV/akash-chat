import { Metadata } from 'next';

import { models } from '@/app/config/models';

export async function generateMetadata(props: {
  params: Promise<{ modelId: string }>
}): Promise<Metadata> {
  const { modelId: encodedModelId } = await props.params;
  const modelId = decodeURIComponent(encodedModelId);
  const model = models.find(m => m.id.toLowerCase() === modelId.toLowerCase());
  
  if (!model) {
    return {
      title: 'Chat - Model Not Found - AkashChat',
      description: 'The requested AI model could not be found on AkashChat.',
    };
  }

  return {
    title: `Chat with ${model.name} - AkashChat`,
    description: model.aboutContent || model.description || `Chat with ${model.name}, an advanced AI model powered by the Akash Supercloud.`,
    openGraph: {
      title: `Chat with ${model.name} - AkashChat`,
      description: model.aboutContent || model.description || `Chat with ${model.name}, an advanced AI model powered by the Akash Supercloud.`,
      url: `https://chat.akash.network/models/${encodeURIComponent(modelId)}/chat`,
      type: 'website',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: `Chat with ${model.name} - AkashChat`
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Chat with ${model.name} - AkashChat`,
      description: model.aboutContent || model.description || `Chat with ${model.name}, an advanced AI model powered by the Akash Supercloud.`,
      images: ['/og-image.png']
    },
    alternates: {
      canonical: `/models/${encodeURIComponent(modelId)}/chat`,
    },
    keywords: ['AI chat', model.name, 'language model', 'Akash Network', 'LLM', 'machine learning', 'chat model', 'AI conversation', model.hf_repo || '', model.architecture || '', model.parameters + ' parameters', model.tokenLimit?.toString() + ' context length' || ''],
  };
} 