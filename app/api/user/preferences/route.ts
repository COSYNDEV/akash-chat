import { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/middleware/auth';
import { withErrorHandling, createSuccessResponse, validateRequestBody, ValidationError } from '@/lib/middleware/error-handler';
import { createDatabaseService } from '@/lib/services/database-service';
import { createEncryptionService } from '@/lib/services/encryption-service';
import { validateUserPreferences } from '@/lib/validation';

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, userId: string, _user: any) => {
    // Validate request body
    const { preferences } = await validateRequestBody(request, ['preferences']);
    
    // Validate preferences structure
    if (!preferences || typeof preferences !== 'object') {
      throw new ValidationError('Invalid preferences format');
    }

    // Create services
    const dbService = createDatabaseService(userId);
    const encryptionService = createEncryptionService(userId);

    // Prepare preferences for database
    const userPreferences: any = {
      user_id: userId,
      selected_model: preferences.selectedModel,
      temperature: preferences.temperature,
      top_p: preferences.topP
    };

    // Validate preferences against database schema
    const validation = validateUserPreferences(userPreferences);
    if (!validation.isValid) {
      throw new ValidationError(`Invalid preferences data: ${validation.errors.join(', ')}`);
    }

    // Handle system prompt encryption if present
    if (preferences.systemPrompt) {
      const encryptedPrompt = await encryptionService.encryptForDatabase(preferences.systemPrompt);
      userPreferences.system_prompt_encrypted = encryptedPrompt.content_encrypted;
      userPreferences.system_prompt_iv = encryptedPrompt.content_iv;
      userPreferences.system_prompt_tag = encryptedPrompt.content_tag;
    }

    // Save preferences using database service
    const result = await dbService.saveUserPreferences(userPreferences);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to save preferences');
    }

    return createSuccessResponse(result.data);
  })
); 