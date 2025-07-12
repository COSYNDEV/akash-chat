import { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/middleware/auth';
import { withErrorHandling, createSuccessResponse, validateRequestBody, ValidationError } from '@/lib/middleware/error-handler';
import { createDatabaseService } from '@/lib/services/database-service';

export const PATCH = withErrorHandling(
  requireAuth(async (
    request: NextRequest, 
    userId: string, 
    { params }: { params: Promise<{ folderId: string }> }
  ) => {
    const { folderId } = await params;
    
    if (!folderId) {
      throw new ValidationError('Folder ID is required');
    }

    // Validate request body
    const updates = await validateRequestBody(request);
    
    // Validate that at least one field is being updated
    const allowedFields = ['name', 'position'];
    const hasValidUpdates = allowedFields.some(field => updates[field] !== undefined);
    
    if (!hasValidUpdates) {
      throw new ValidationError('At least one field must be provided for update');
    }

    // Create database service
    const dbService = createDatabaseService(userId);

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) {updateData.name = updates.name;}

    // Update folder using database service
    const result = await dbService.updateUserFolder(folderId, updateData);

    if (!result.success) {
      throw new Error(result.error || 'Failed to update folder');
    }

    return createSuccessResponse({
      folder: result.data
    });
  })
);

export const DELETE = withErrorHandling(
  requireAuth(async (
    _request: NextRequest,
    userId: string,
    { params }: { params: Promise<{ folderId: string }> }
  ) => {
    const { folderId } = await params;
    
    if (!folderId) {
      throw new ValidationError('Folder ID is required');
    }

    // Create database service
    const dbService = createDatabaseService(userId);

    // Delete folder using database service
    const result = await dbService.deleteUserFolder(folderId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete folder');
    }

    return createSuccessResponse({
      message: 'Folder deleted successfully'
    });
  })
);