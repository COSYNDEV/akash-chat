import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

import { apiEndpoint, apiKey } from '@/app/config/api';
import { getUserTier, getAllModels } from '@/lib/database';

// Models that are always available regardless of LiteLLM API status
const ALWAYS_AVAILABLE_MODELS = ['AkashGen'];

interface ModelWithAccess {
  // Core model fields
  id?: string;
  model_id: string;
  api_id?: string;
  name: string;
  description?: string;
  tier_requirement: string;
  available: boolean;
  temperature?: number;
  top_p?: number;
  token_limit?: number;
  owned_by?: string;
  parameters?: string;
  architecture?: string;
  hf_repo?: string;
  about_content?: string;
  info_content?: string;
  thumbnail_id?: string;
  deploy_url?: string;
  display_order: number;
  created_at?: Date;
  updated_at?: Date;
  
  // Access control fields
  user_has_access: boolean;
  is_available_now: boolean;
  action_button: 'start_chat' | 'sign_up' | 'upgrade';
  action_text: string;
}

export async function GET(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getSession(req, NextResponse.next());
    const userId = session?.user?.sub || null;
    
    // Get user's tier
    let userTier = null;
    if (userId) {
      userTier = await getUserTier(userId);
    } 
    
    const userTierName = userTier?.name || 'permissionless';
    
    // Get all models from database (across all tiers)
    const allModels = await getAllModels();
    
    // Check which models are currently available via LiteLLM API
    let apiModels: any[] = [];
    try {
      const response = await fetch(apiEndpoint + '/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      const apiData = await response.json();
      apiModels = apiData.data || [];
    } catch (error) {
      console.warn('[API] Failed to fetch from LiteLLM API:', error);
      // Continue with empty array - models will be marked as unavailable
    }
    
    // Create set of available API model IDs for quick lookup
    const availableApiIds = new Set(apiModels.map(model => model.id));
    
    // Get user's accessible tiers
    const userAccessibleTiers = new Set();
    switch (userTierName) {
      case 'pro':
        userAccessibleTiers.add('permissionless');
        userAccessibleTiers.add('extended');
        userAccessibleTiers.add('pro');
        break;
      case 'extended':
        userAccessibleTiers.add('permissionless');
        userAccessibleTiers.add('extended');
        break;
      case 'permissionless':
      default:
        userAccessibleTiers.add('permissionless');
        break;
    }
    
    // Process each model to determine access and availability
    const modelsWithAccess: ModelWithAccess[] = allModels.map(model => {
      // Check if user has tier access to this model
      const userHasAccess = userAccessibleTiers.has(model.tier_requirement);
      
      // Check if model is currently available via API or is always available
      const isAlwaysAvailable = ALWAYS_AVAILABLE_MODELS.includes(model.model_id);
      const isAvailableInApi = availableApiIds.has(model.model_id) || (model.api_id && availableApiIds.has(model.api_id));
      const isAvailableNow = model.available && (isAvailableInApi || isAlwaysAvailable);
      
      // Determine action button and text
      let actionButton: 'start_chat' | 'sign_up' | 'upgrade';
      let actionText: string;
      
      if (userHasAccess && isAvailableNow) {
        actionButton = 'start_chat';
        actionText = 'Start Chat';
      } else if (userHasAccess && !isAvailableNow) {
        actionButton = 'start_chat';
        actionText = 'Unavailable';
      } else if (model.tier_requirement === 'extended') {
        actionButton = userId ? 'upgrade' : 'sign_up';
        actionText = userId ? 'Upgrade to Extended' : 'Sign Up for Extended';
      } else if (model.tier_requirement === 'pro') {
        actionButton = userId ? 'upgrade' : 'sign_up';
        actionText = userId ? 'Upgrade to Pro' : 'Sign Up for Pro';
      } else {
        // Shouldn't happen for permissionless models, but fallback
        actionButton = 'sign_up';
        actionText = 'Sign Up';
      }
      
      // Remove token_multiplier from response (internal field)
      const { token_multiplier, ...modelWithoutMultiplier } = model;
      
      return {
        ...modelWithoutMultiplier,
        user_has_access: userHasAccess,
        is_available_now: isAvailableNow,
        action_button: actionButton,
        action_text: actionText
      };
    });
    
    // Sort models by display_order then by name
    const sortedModels = modelsWithAccess.sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      return a.name.localeCompare(b.name);
    });
    
    // Create summary statistics
    const stats = {
      total_models: sortedModels.length,
      available_now: sortedModels.filter(m => m.is_available_now).length,
      user_accessible: sortedModels.filter(m => m.user_has_access).length,
      user_available: sortedModels.filter(m => m.user_has_access && m.is_available_now).length,
      by_tier: {
        permissionless: sortedModels.filter(m => m.tier_requirement === 'permissionless').length,
        extended: sortedModels.filter(m => m.tier_requirement === 'extended').length,
        pro: sortedModels.filter(m => m.tier_requirement === 'pro').length
      }
    };
    
    return NextResponse.json({
      models: sortedModels,
      user_tier: userTierName,
      stats
    });
    
  } catch (error) {
    console.error('[API] Error fetching all models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}