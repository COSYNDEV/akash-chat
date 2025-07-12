/**
 * Database schema validation utilities
 * Ensures data matches the actual database constraints
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate chat session data against database schema constraints
 */
export function validateChatSession(data: any): ValidationResult {
  const errors: string[] = [];

  // user_id: character varying(255)
  if (data.user_id && data.user_id.length > 255) {
    errors.push('User ID must not exceed 255 characters');
  }

  // name: character varying(500)
  if (!data.name) {
    errors.push('Chat name is required');
  } else if (data.name.length > 500) {
    errors.push('Chat name must not exceed 500 characters');
  }

  // model_id: character varying(100)
  if (!data.model_id) {
    errors.push('Model ID is required');
  } else if (data.model_id.length > 100) {
    errors.push('Model ID must not exceed 100 characters');
  }

  // model_name: character varying(255)
  if (!data.model_name) {
    errors.push('Model name is required');
  } else if (data.model_name.length > 255) {
    errors.push('Model name must not exceed 255 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate chat message data against database schema constraints
 */
export function validateChatMessage(data: any): ValidationResult {
  const errors: string[] = [];

  // chat_session_id: uuid (required)
  if (!data.chat_session_id) {
    errors.push('Chat session ID is required');
  }

  // role: must be one of 'user', 'assistant', 'system'
  if (!data.role) {
    errors.push('Message role is required');
  } else if (!['user', 'assistant', 'system'].includes(data.role)) {
    errors.push('Message role must be one of: user, assistant, system');
  }

  // position: integer (required)
  if (data.position === undefined || data.position === null) {
    errors.push('Message position is required');
  } else if (!Number.isInteger(data.position) || data.position < 0) {
    errors.push('Message position must be a non-negative integer');
  }

  // model_used: character varying(100) (optional)
  if (data.model_used && data.model_used.length > 100) {
    errors.push('Model used must not exceed 100 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate folder data against database schema constraints
 */
export function validateFolder(data: any): ValidationResult {
  const errors: string[] = [];

  // user_id: character varying(255)
  if (data.user_id && data.user_id.length > 255) {
    errors.push('User ID must not exceed 255 characters');
  }

  // name: character varying(255)
  if (!data.name) {
    errors.push('Folder name is required');
  } else if (data.name.length > 255) {
    errors.push('Folder name must not exceed 255 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate user preferences against database schema constraints
 */
export function validateUserPreferences(data: any): ValidationResult {
  const errors: string[] = [];

  // user_id: character varying(255)
  if (data.user_id && data.user_id.length > 255) {
    errors.push('User ID must not exceed 255 characters');
  }

  // selected_model: character varying(100)
  if (data.selected_model && data.selected_model.length > 100) {
    errors.push('Selected model must not exceed 100 characters');
  }

  // temperature: numeric(3,2) - range 0 to 2
  if (data.temperature !== undefined && data.temperature !== null) {
    const temp = Number(data.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) {
      errors.push('Temperature must be a number between 0 and 2');
    }
  }

  // top_p: numeric(3,2) - range 0 to 1
  if (data.top_p !== undefined && data.top_p !== null) {
    const topP = Number(data.top_p);
    if (isNaN(topP) || topP < 0 || topP > 1) {
      errors.push('Top P must be a number between 0 and 1');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}