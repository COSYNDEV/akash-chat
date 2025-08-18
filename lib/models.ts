import OpenAI from 'openai';

import { apiEndpoint, apiKey } from '@/app/config/api';
import { models, Model, createApiToConfigIdMap } from '@/app/config/models';
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
        
        // Create mapping from API model IDs to config model IDs
        const apiToConfigIdMap = createApiToConfigIdMap();
        
        // For predefined models, check if they're available in the API using the mapping
        const availableFromConfig = models.map(model => {
            // Check if the model is available using either the config ID or the mapped API ID
            const isAvailableInApi = apiModels.data.some((apiModel: OpenAI.Model) => {
                // Direct match with config ID
                if (apiModel.id === model.id) return true;
                // Match with mapped API ID
                if (model.apiId && apiModel.id === model.apiId) return true;
                return false;
            });
            
            return {
                ...model,
                available: isAvailableInApi || model.available === true
            };
        });

        // Get additional models from the API that aren't in our static config
        // Only include them if they don't map to existing config models
        const additionalModels = apiModels.data
            .filter((apiModel: OpenAI.Model) => {
                // Skip if this API model ID maps to a config model
                if (apiToConfigIdMap.has(apiModel.id)) return false;
                // Skip if we already have a direct match
                if (models.some(model => model.id === apiModel.id)) return false;
                return true;
            })
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