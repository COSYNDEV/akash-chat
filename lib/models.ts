import OpenAI from 'openai';

import { apiEndpoint, apiKey } from '@/app/config/api';
import { models, createApiToConfigIdMap } from '@/app/config/models';
import { Model as DatabaseModel } from '@/lib/database';
import redis from '@/lib/redis';

// User-facing model interface (hides token_multiplier)
export interface Model extends Omit<DatabaseModel, 'token_multiplier'> {}

// Helper to convert database model to user-facing model
function toUserFacingModel(dbModel: DatabaseModel): Model {
  const { token_multiplier, ...userModel } = dbModel;
  // Map model_id to id for frontend compatibility
  return {
    ...userModel,
    id: dbModel.model_id
  };
}

const MODELS_CACHE_KEY = 'cached_models';
const USER_MODELS_CACHE_KEY = 'user_models';
const MODELS_CACHE_TTL = 600; // Cache for 10 minutes

// Models that are always available regardless of LiteLLM API status
const ALWAYS_AVAILABLE_MODELS = ['AkashGen'];

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
                if (apiModel.id === model.id) {return true;}
                // Match with mapped API ID
                if (model.apiId && apiModel.id === model.apiId) {return true;}
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
                if (apiToConfigIdMap.has(apiModel.id)) {return false;}
                // Skip if we already have a direct match
                if (models.some(model => model.id === apiModel.id)) {return false;}
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
        console.error('[MODELS] Error fetching models:', error);
        console.log('[MODELS] Falling back to static config models');
        // Return predefined models as fallback, converted to database model format
        const fallbackModels: Model[] = models.filter(model => model.available === true).map(configModel => ({
            id: undefined,
            model_id: configModel.id,
            api_id: configModel.apiId,
            name: configModel.name,
            description: configModel.description,
            tier_requirement: 'permissionless',
            available: configModel.available || false,
            temperature: configModel.temperature,
            top_p: configModel.top_p,
            token_limit: configModel.tokenLimit,
            owned_by: configModel.owned_by,
            parameters: configModel.parameters,
            architecture: configModel.architecture,
            hf_repo: configModel.hf_repo,
            about_content: configModel.aboutContent,
            info_content: configModel.infoContent,
            thumbnail_id: configModel.thumbnailId,
            deploy_url: configModel.deployUrl,
            display_order: 0,
            created_at: undefined,
            updated_at: undefined,
        }));
        return fallbackModels;
    }
}

/**
 * Get available models for a specific user (considers tier access)
 */
export async function getAvailableModelsForUser(userId: string | null): Promise<Model[]> {
    if (!userId) {
        // Anonymous user - return permissionless tier models from database
        return await getAvailableModelsFromDatabase('permissionless');
    }
    
    try {
        // Check cache first
        const cacheKey = `${USER_MODELS_CACHE_KEY}:${userId}`;
        const cachedModels = await redis.get(cacheKey);
        if (cachedModels) {
            return JSON.parse(cachedModels);
        }

        // Get user's tier first
        const userTier = await import('@/lib/database').then(db => db.getUserTier(userId));
        
        if (!userTier) {
            // User has no tier, fallback to permissionless
            return await getAvailableModelsFromDatabase('permissionless');
        }

        // Get models for user's tier from database
        const { getModelsForTier } = await import('@/lib/database');
        const userModels = await getModelsForTier(userTier.name);
        
        // Check availability with LiteLLM API
        const response = await fetch(apiEndpoint + '/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const apiModels = await response.json();
        
        // Filter models based on API availability
        const availableUserModels = userModels
            .filter(model => {
                // Check if model is available in API
                const isAvailableInApi = apiModels.data.some((apiModel: OpenAI.Model) => {
                    return apiModel.id === model.model_id || apiModel.id === model.api_id;
                });
                
                // Special case: Some models are always available (e.g., image generation)
                const isAlwaysAvailable = ALWAYS_AVAILABLE_MODELS.includes(model.model_id);
                
                // Model must be in database (available=true) AND (available in API OR always available) AND chat available
                const isChatAvailable = model.is_chat_available !== false; // true if null or true, false only if explicitly false
                const isAvailable = model.available && (isAvailableInApi || isAlwaysAvailable) && isChatAvailable;
                if (!isAvailable) {
                    let reason = 'unknown';
                    if (!model.available) {reason = 'disabled in database';}
                    else if (!isChatAvailable) {reason = 'not available for chat';}
                    else {reason = 'not available in API';}
                    console.log('[MODELS] Filtering out model:', model.model_id, `(${reason})`);
                } else if (isAlwaysAvailable) {
                    console.log('[MODELS] Including', model.model_id, '(always available)');
                }
                return isAvailable;
            })
            .map(toUserFacingModel);

        // Cache for 30 seconds
        await redis.setex(cacheKey, MODELS_CACHE_TTL, JSON.stringify(availableUserModels));
        
        return availableUserModels;
    } catch (error) {
        console.error('[MODELS] Error fetching user models for user:', userId, error);
        // Fallback to permissionless tier models
        return await getAvailableModelsFromDatabase('permissionless');
    }
}

/**
 * Get available models from database for a specific tier
 */
async function getAvailableModelsFromDatabase(tierName: string): Promise<Model[]> {
    try {
        const cacheKey = `${MODELS_CACHE_KEY}:tier:${tierName}`;
        const cachedModels = await redis.get(cacheKey);
        if (cachedModels) {
            return JSON.parse(cachedModels);
        }

        // Get models from database based on tier
        const { getModelsForTier } = await import('@/lib/database');
        const dbModels = await getModelsForTier(tierName);
        
        // Check availability with LiteLLM API
        const response = await fetch(apiEndpoint + '/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const apiModels = await response.json();
        
        // Filter models based on API availability
        const availableDbModels = dbModels.filter(model => {
            // Check if model is available in API
            const isAvailableInApi = apiModels.data.some((apiModel: any) => {
                return apiModel.id === model.model_id || apiModel.id === model.api_id;
            });
            
            // Special case: Some models are always available (e.g., image generation)
            const isAlwaysAvailable = ALWAYS_AVAILABLE_MODELS.includes(model.model_id);
            
            // Model must be in database (available=true) AND (available in API OR always available) AND chat available
            const isChatAvailable = model.is_chat_available !== false; // true if null or true, false only if explicitly false
            const isAvailable = model.available && (isAvailableInApi || isAlwaysAvailable) && isChatAvailable;
            if (!isAvailable) {
                let reason = 'unknown';
                if (!model.available) {reason = 'disabled in database';}
                else if (!isChatAvailable) {reason = 'not available for chat';}
                else {reason = 'not available in API';}
                console.log('[MODELS] Filtering out model:', model.model_id, `(${reason})`);
            } else if (isAlwaysAvailable) {
                console.log('[MODELS] Including', model.model_id, '(always available)');
            }
            return isAvailable;
        });
        
        // Hide token_multiplier from user-facing response
        const userFacingModels = availableDbModels.map(toUserFacingModel);

        // Cache the results
        await redis.setex(cacheKey, MODELS_CACHE_TTL, JSON.stringify(userFacingModels));
        
        return userFacingModels;
    } catch (error) {
        console.error('[MODELS] Error fetching models from database for tier:', tierName, error);
        
        // If this is a connection timeout, log it specifically
        if (error instanceof Error && error.message.includes('connection timeout')) {
            console.warn('[MODELS] Database connection timeout - this may indicate network issues with Supabase');
        }
        
        // Fallback to static config - need to convert to database format
        const fallbackModels: Model[] = models.filter(model => model.available === true).map(configModel => ({
            id: undefined,
            model_id: configModel.id,
            api_id: configModel.apiId,
            name: configModel.name,
            description: configModel.description,
            tier_requirement: 'permissionless',
            available: configModel.available || false,
            temperature: configModel.temperature,
            top_p: configModel.top_p,
            token_limit: configModel.tokenLimit,
            owned_by: configModel.owned_by,
            parameters: configModel.parameters,
            architecture: configModel.architecture,
            hf_repo: configModel.hf_repo,
            about_content: configModel.aboutContent,
            info_content: configModel.infoContent,
            thumbnail_id: configModel.thumbnailId,
            deploy_url: configModel.deployUrl,
            display_order: 0,
            created_at: undefined,
            updated_at: undefined,
        }));
        return fallbackModels;
    }
} 