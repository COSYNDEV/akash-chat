import OpenAI from 'openai';

import { apiEndpoint, apiKey } from '@/app/config/api';
import { models, createApiToConfigIdMap } from '@/app/config/models';
import { Model as DatabaseModel } from '@/lib/database';
import { isDatabaseAvailable } from '@/lib/postgres';
import redis from '@/lib/redis';

export interface Model extends Omit<DatabaseModel, 'token_multiplier'> {}

function toUserFacingModel(dbModel: DatabaseModel): Model {
  const { token_multiplier, ...userModel } = dbModel;
  return {
    ...userModel,
    id: dbModel.model_id
  };
}

const MODELS_CACHE_KEY = 'cached_models';
const USER_MODELS_CACHE_KEY = 'user_models';
const MODELS_CACHE_TTL = 600;

const ALWAYS_AVAILABLE_MODELS = ['AkashGen'];

/**
 * Fetch models directly from the API endpoint when database is not available
 */
async function getModelsFromApiOnly(): Promise<Model[]> {
    try {
        const response = await fetch(apiEndpoint + '/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const apiModels = await response.json();
        const modelList = apiModels.data || [];

        return modelList.map((apiModel: OpenAI.Model) => ({
            id: apiModel.id,
            model_id: apiModel.id,
            api_id: apiModel.id,
            name: apiModel.id.split('/').pop() || apiModel.id,
            description: `${apiModel.id} model`,
            tier_requirement: 'permissionless',
            available: true,
            temperature: 0.7,
            top_p: 0.95,
            token_limit: 128000,
            owned_by: apiModel.owned_by,
            parameters: undefined,
            architecture: undefined,
            hf_repo: undefined,
            about_content: undefined,
            info_content: undefined,
            thumbnail_id: undefined,
            deploy_url: undefined,
            display_order: 0,
            created_at: undefined,
            updated_at: undefined,
        }));
    } catch (error) {
        console.error('[MODELS] Error fetching models from API:', error);
        return [];
    }
}

export async function getAvailableModels(): Promise<Model[]> {
    try {
        if (redis) {
            const cachedModels = await redis.get(MODELS_CACHE_KEY);
            if (cachedModels) {
                return JSON.parse(cachedModels);
            }
        }

        const response = await fetch(apiEndpoint + '/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const apiModels = await response.json();

        const apiToConfigIdMap = createApiToConfigIdMap();

        const availableFromConfig = models.map(model => {
            const isAvailableInApi = apiModels.data.some((apiModel: OpenAI.Model) => {
                if (apiModel.id === model.id) {return true;}
                if (model.apiId && apiModel.id === model.apiId) {return true;}
                return false;
            });

            return {
                ...model,
                available: isAvailableInApi || model.available === true
            };
        });

        const additionalModels = apiModels.data
            .filter((apiModel: OpenAI.Model) => {
                if (apiToConfigIdMap.has(apiModel.id)) {return false;}
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

        const allModels = [
            ...availableFromConfig,
            ...additionalModels
        ] as Model[];

        if (redis) {
            await redis.setex(MODELS_CACHE_KEY, MODELS_CACHE_TTL, JSON.stringify(allModels));
        }

        return allModels;
    } catch (error) {
        console.error('[MODELS] Error fetching models:', error);
        console.log('[MODELS] Falling back to API-only mode');
        return await getModelsFromApiOnly();
    }
}

export async function getAvailableModelsForUser(userId: string | null): Promise<Model[]> {
    // If database is not available, fall back to API-only mode
    if (!isDatabaseAvailable()) {
        return await getModelsFromApiOnly();
    }

    if (!userId) {
        return await getAvailableModelsFromDatabase('permissionless');
    }

    try {
        const cacheKey = `${USER_MODELS_CACHE_KEY}:${userId}`;
        if (redis) {
            const cachedModels = await redis.get(cacheKey);
            if (cachedModels) {
                return JSON.parse(cachedModels);
            }
        }

        const userTier = await import('@/lib/database').then(db => db.getUserTier(userId));

        if (!userTier) {
            return await getAvailableModelsFromDatabase('permissionless');
        }

        const { getModelsForTier } = await import('@/lib/database');
        const userModels = await getModelsForTier(userTier.name);

        const response = await fetch(apiEndpoint + '/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const apiModels = await response.json();

        const availableUserModels = userModels
            .filter(model => {
                const isAvailableInApi = apiModels.data.some((apiModel: OpenAI.Model) => {
                    return apiModel.id === model.model_id || apiModel.id === model.api_id;
                });

                const isAlwaysAvailable = ALWAYS_AVAILABLE_MODELS.includes(model.model_id);

                const isChatAvailable = model.is_chat_available !== false;
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

        if (redis) {
            await redis.setex(cacheKey, MODELS_CACHE_TTL, JSON.stringify(availableUserModels));
        }

        return availableUserModels;
    } catch (error) {
        console.error('[MODELS] Error fetching user models for user:', userId, error);
        return await getAvailableModelsFromDatabase('permissionless');
    }
}

async function getAvailableModelsFromDatabase(tierName: string): Promise<Model[]> {
    // If database is not available, fall back to API-only mode
    if (!isDatabaseAvailable()) {
        return await getModelsFromApiOnly();
    }

    try {
        const cacheKey = `${MODELS_CACHE_KEY}:tier:${tierName}`;
        if (redis) {
            const cachedModels = await redis.get(cacheKey);
            if (cachedModels) {
                return JSON.parse(cachedModels);
            }
        }

        const { getModelsForTier } = await import('@/lib/database');
        const dbModels = await getModelsForTier(tierName);

        const response = await fetch(apiEndpoint + '/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const apiModels = await response.json();

        const availableDbModels = dbModels.filter(model => {
            const isAvailableInApi = apiModels.data.some((apiModel: any) => {
                return apiModel.id === model.model_id || apiModel.id === model.api_id;
            });

            const isAlwaysAvailable = ALWAYS_AVAILABLE_MODELS.includes(model.model_id);

            const isChatAvailable = model.is_chat_available !== false;
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

        const userFacingModels = availableDbModels.map(toUserFacingModel);

        if (redis) {
            await redis.setex(cacheKey, MODELS_CACHE_TTL, JSON.stringify(userFacingModels));
        }

        return userFacingModels;
    } catch (error) {
        console.error('[MODELS] Error fetching models from database for tier:', tierName, error);

        if (error instanceof Error && error.message.includes('connection timeout')) {
            console.warn('[MODELS] Database connection timeout - this may indicate network issues');
        }

        // Fall back to API-only mode
        return await getModelsFromApiOnly();
    }
} 