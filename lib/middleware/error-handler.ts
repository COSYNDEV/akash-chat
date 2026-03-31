import { NextRequest, NextResponse } from 'next/server';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
  path: string;
}

/**
 * Standardized error response creator
 */
export function createErrorResponse(
  error: string | Error | ApiError,
  statusCode: number = 500,
  request?: NextRequest,
  details?: any
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorCode = error instanceof Error && 'code' in error ? (error as ApiError).code : undefined;
  const errorDetails = error instanceof Error && 'details' in error ? (error as ApiError).details : details;

  const response: ErrorResponse = {
    error: errorMessage,
    ...(errorCode && { code: errorCode }),
    ...(errorDetails && { details: errorDetails }),
    timestamp: new Date().toISOString(),
    path: request?.url || 'unknown'
  };

  // Log error for debugging
  console.error('API Error:', {
    message: errorMessage,
    statusCode,
    code: errorCode,
    path: request?.url,
    timestamp: response.timestamp,
    details: errorDetails
  });

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Common error types
 */
export class AuthenticationError extends Error implements ApiError {
  statusCode = 401;
  code = 'AUTHENTICATION_REQUIRED';

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements ApiError {
  statusCode = 403;
  code = 'INSUFFICIENT_PERMISSIONS';

  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error implements ApiError {
  statusCode = 400;
  code = 'VALIDATION_FAILED';
  details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404;
  code = 'RESOURCE_NOT_FOUND';

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements ApiError {
  statusCode = 409;
  code = 'RESOURCE_CONFLICT';

  constructor(message: string = 'Resource already exists') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error implements ApiError {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends Error implements ApiError {
  statusCode = 500;
  code = 'DATABASE_ERROR';

  constructor(message: string = 'Database operation failed') {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class EncryptionError extends Error implements ApiError {
  statusCode = 500;
  code = 'ENCRYPTION_ERROR';

  constructor(message: string = 'Encryption operation failed') {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Higher-order function to wrap API route handlers with error handling
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] as NextRequest;
      
      // Handle known API errors
      if (error instanceof Error && 'statusCode' in error) {
        const apiError = error as ApiError;
        return createErrorResponse(apiError, apiError.statusCode, request);
      }
      
      // Handle unknown errors
      console.error('Unhandled API error:', error);
      return createErrorResponse(
        'Internal server error',
        500,
        request,
        process.env.NODE_ENV === 'development' ? error : undefined
      );
    }
  };
}

/**
 * Validation helper function
 */
export function validateRequired(data: any, fields: string[]): void {
  const missing = fields.filter(field => !data[field]);
  
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    );
  }
}

/**
 * Validation helper for request body
 */
export async function validateRequestBody(request: NextRequest, requiredFields: string[] = []): Promise<any> {
  try {
    const body = await request.json();
    
    if (requiredFields.length > 0) {
      validateRequired(body, requiredFields);
    }
    
    return body;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Success response helper
 */
export function createSuccessResponse(data: any, statusCode: number = 200): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }, { status: statusCode });
}

/**
 * Paginated response helper
 */
export function createPaginatedResponse(
  data: any[],
  total: number,
  page: number,
  limit: number,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    },
    timestamp: new Date().toISOString()
  }, { status: statusCode });
}