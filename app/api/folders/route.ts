import { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/middleware/auth';
import { withErrorHandling, createSuccessResponse, validateRequestBody, ValidationError } from '@/lib/middleware/error-handler';
import { createDatabaseService } from '@/lib/services/database-service';
import { validateFolder } from '@/lib/validation';

export const GET = withErrorHandling(
  requireAuth(async (_request: NextRequest, userId: string, _user: any) => {
    // Create database service
    const dbService = createDatabaseService(userId);

    // Load user folders from database
    const result = await dbService.loadUserFolders();

    if (!result.success) {
      throw new Error(result.error || 'Failed to load folders');
    }

    return createSuccessResponse({
      folders: result.data
    });
  })
);

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, userId: string, _user: any) => {
    // Validate request body
    const folderData = await validateRequestBody(request, ['name']);
    
    if (!folderData.id) {
      throw new ValidationError('Folder ID is required');
    }

    // Validate folder data against database schema
    const folderToValidate = {
      user_id: userId,
      name: folderData.name,
    };
    
    const validation = validateFolder(folderToValidate);
    if (!validation.isValid) {
      throw new ValidationError(`Invalid folder data: ${validation.errors.join(', ')}`);
    }

    // Create database service
    const dbService = createDatabaseService(userId);

    // Create folder using database service
    const result = await dbService.createUserFolder(folderData.name);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create folder');
    }

    return createSuccessResponse({
      folder: result.data
    });
  })
);