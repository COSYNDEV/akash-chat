import OpenAI from 'openai';

import { apiEndpoint, apiKey } from '@/app/config/api';
import { models, createApiToConfigIdMap } from '@/app/config/models';
import { Model as DatabaseModel } from '@/lib/database';
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
        await redis.setex(MODELS_CACHE_KEY, MODELS_CACHE_TTL, JSON.stringify(allModels));

        return allModels;
    } catch (error) {
        console.error('[MODELS] Error fetching models:', error);
        console.log('[MODELS] Falling back to static config models');
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

export async function getAvailableModelsForUser(userId: string | null): Promise<Model[]> {
    if (!userId) {
        return await getAvailableModelsFromDatabase('permissionless');
    }

    try {
        const cacheKey = `${USER_MODELS_CACHE_KEY}:${userId}`;
        const cachedModels = await redis.get(cacheKey);
        if (cachedModels) {
            return JSON.parse(cachedModels);
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

        await redis.setex(cacheKey, MODELS_CACHE_TTL, JSON.stringify(availableUserModels));

        return availableUserModels;
    } catch (error) {
        console.error('[MODELS] Error fetching user models for user:', userId, error);
        return await getAvailableModelsFromDatabase('permissionless');
    }
}

async function getAvailableModelsFromDatabase(tierName: string): Promise<Model[]> {
    try {
        const cacheKey = `${MODELS_CACHE_KEY}:tier:${tierName}`;
        const cachedModels = await redis.get(cacheKey);
        if (cachedModels) {
            return JSON.parse(cachedModels);
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

        await redis.setex(cacheKey, MODELS_CACHE_TTL, JSON.stringify(userFacingModels));

        return userFacingModels;
    } catch (error) {
        console.error('[MODELS] Error fetching models from database for tier:', tierName, error);

        if (error instanceof Error && error.message.includes('connection timeout')) {
            console.warn('[MODELS] Database connection timeout - this may indicate network issues');
        }

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