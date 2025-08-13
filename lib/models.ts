import OpenAI from 'openai';

import { apiEndpoint, apiKey } from '@/app/config/api';
import { models, Model } from '@/app/config/models';
import redis from '@/lib/redis';

const MODELS_CACHE_KEY = 'cached_models';
const MODELS_CACHE_TTL = 600; // Cache for 10 minutes

export async function getAvailableModels(): Promise<Model[]> {
    try {
        const cachedModels = await redis.get(MODELS_CACHE_KEY);
        if (cachedModels) {
            return JSON.parse(cachedModels);
        }

        const response = await fetch(apiEndpoint + '/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const apiModels = await response.json();
        
        // For predefined models, check if they're available in the API or explicitly marked as available
        const availableFromConfig = models.map(model => ({
            ...model,
            available: apiModels.data.some((apiModel: OpenAI.Model) => apiModel.id === model.id) || model.available === true
        }));

        // Get additional models from the API that aren't in our static config
        // Only include them if it's a proxy or chatapi (user's custom setup)
        const additionalModels = apiModels.data
            .filter((apiModel: OpenAI.Model) => 
                !models.some(model => model.id === apiModel.id))
            .map((apiModel: OpenAI.Model) => ({
                id: apiModel.id,
                name: apiModel.id.split('/').pop() || apiModel.id,
                description: `${apiModel.id} model`,
                temperature: 0.7,
                top_p: 0.95,
                available: true,
                owned_by: apiModel.owned_by
            }));
        
        // Combine all models
        const allModels = [
            ...availableFromConfig,
            ...additionalModels
        ] as Model[];
        await redis.setex(MODELS_CACHE_KEY, MODELS_CACHE_TTL, JSON.stringify(allModels));

        return allModels;
    } catch (error) {
        console.error('Error fetching models:', error);
        // Return predefined models as fallback, but only those explicitly marked as available
        return models.filter(model => model.available === true);
    }
} 