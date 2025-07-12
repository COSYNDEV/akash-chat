import { auth0Management } from '../auth0-management';
import { createUserApiKey, getUserApiKey } from '../database';
import redis from '../redis';

import { EncryptionService } from './encryption-service';

interface LiteLLMApiKey {
  key: string;
  userId: string;
  expiresAt: number;
}

export class LiteLLMService {
  private static readonly REDIS_PREFIX = 'litellm:api_key:';
  private static readonly KEY_EXPIRY_HOURS = 24;

  /**
   * Generate a new LiteLLM API key for a user via LiteLLM API
   * The key is created in LiteLLM with userId as key_alias
   * Requires user to have verified email and accepted marketing consent
   */
  static async generateApiKey(userId: string): Promise<string> {
    // Check if user meets verification requirements
    const isVerified = await this.checkUserVerificationRequirements(userId);
    if (!isVerified) {
      throw new Error('User must verify email and accept marketing consent to generate API key');
    }
    let litellmEndpoint = process.env.API_ENDPOINT;
    litellmEndpoint = litellmEndpoint?.replace('/v1', '');
    const adminKey = process.env.API_KEY;
    const userRole = process.env.LITELLM_USER_ROLE || 'internal_user_viewer';
    const maxParallelRequests = parseInt(process.env.LITELLM_MAX_PARALLEL_REQUESTS || '1');
    const teamId = process.env.LITELLM_TEAM_ID || 'akashchat_user';

    if (!litellmEndpoint || !adminKey) {
      throw new Error('LiteLLM configuration missing: API_ENDPOINT and API_KEY required');
    }

    try {
      // Create user-specific API key via LiteLLM API
      const response = await fetch(`${litellmEndpoint}/key/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key_alias: userId+'_akashchat',
          user_role: userRole,
          max_parallel_requests: maxParallelRequests,
          team_id: teamId,
          metadata: {
            user_id: userId,
            created_by: 'akashchat_signup',
            created_at: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LiteLLM API key creation failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      const apiKey = result.key;

      if (!apiKey) {
        throw new Error('LiteLLM API did not return a valid key');
      }

      // Store in database (encrypted) for backup/caching
      await this.storeApiKeyInDatabase(userId, apiKey);
      
      // Store in Redis for fast session access
      await this.storeApiKeyInRedis(userId, apiKey);
      
      return apiKey;
    } catch (error) {
      console.error('Failed to generate LiteLLM API key:', error);
      throw error;
    }
  }

  /**
   * Get an API key for a user with full fallback chain
   * Order: Redis cache → Database
   */
  static async getApiKey(userId: string): Promise<string | null> {
    // 1. Try Redis cache first (fastest)
    const cachedKey = await this.getApiKeyFromRedis(userId);
    if (cachedKey) {
      return cachedKey;
    }

    // 2. Try database backup
    const dbKey = await this.getApiKeyFromDatabase(userId);
    if (dbKey) {
      // Re-cache in Redis for future requests
      await this.storeApiKeyInRedis(userId, dbKey);
      return dbKey;
    }
    return null;
  }

  /**
   * Store API key in Redis for fast session access
   */
  private static async storeApiKeyInRedis(userId: string, apiKey: string): Promise<void> {
    const keyData: LiteLLMApiKey = {
      key: apiKey,
      userId,
      expiresAt: Date.now() + (this.KEY_EXPIRY_HOURS * 60 * 60 * 1000)
    };

    const redisKey = `${this.REDIS_PREFIX}${userId}`;
    const expirySeconds = this.KEY_EXPIRY_HOURS * 60 * 60;

    await redis.set(redisKey, JSON.stringify(keyData), 'EX', expirySeconds);
  }

  /**
   * Get API key from Redis cache
   */
  private static async getApiKeyFromRedis(userId: string): Promise<string | null> {
    try {
      const redisKey = `${this.REDIS_PREFIX}${userId}`;
      const data = await redis.get(redisKey);
      
      if (!data) {return null;}

      const keyData = JSON.parse(data) as LiteLLMApiKey;
      
      // Check if expired
      if (Date.now() > keyData.expiresAt) {
        await redis.del(redisKey);
        return null;
      }

      return keyData.key;
    } catch (error) {
      console.error('Failed to get API key from Redis:', error);
      return null;
    }
  }

  /**
   * Store API key in database (encrypted)
   */
  private static async storeApiKeyInDatabase(userId: string, apiKey: string): Promise<void> {
    const encryptionService = new EncryptionService(userId);
    
    // Encrypt the API key
    const encrypted = await encryptionService.encryptForDatabase(apiKey);
    
    // Store in database
    await createUserApiKey({
      user_id: userId,
      litellm_api_key_encrypted_b64: encrypted.content_encrypted,
      litellm_api_key_iv_b64: encrypted.content_iv,
      litellm_api_key_tag_b64: encrypted.content_tag,
      is_active: true
    });
  }

  /**
   * Get and decrypt API key from database
   */
  private static async getApiKeyFromDatabase(userId: string): Promise<string | null> {
    try {
      const dbApiKey = await getUserApiKey(userId);
      if (!dbApiKey || !dbApiKey.is_active) {
        return null;
      }

      const encryptionService = new EncryptionService(userId);
      
      // Decrypt the API key
      const decrypted = await encryptionService.decryptFromDatabase({
        content_encrypted: dbApiKey.litellm_api_key_encrypted_b64,
        content_iv: dbApiKey.litellm_api_key_iv_b64,
        content_tag: dbApiKey.litellm_api_key_tag_b64
      });

      return decrypted;
    } catch (error) {
      console.error('Failed to get API key from database:', error);
      return null;
    }
  }

  /**
   * Check if user meets verification requirements for API key generation
   * Requires both email verification and marketing consent
   */
  private static async checkUserVerificationRequirements(userId: string): Promise<boolean> {
    try {
      // Get user data from Auth0
      const userData = await auth0Management.getUserData(userId);
      
      // Check email verification
      const emailVerified = userData.email_verified === true;
      
      // Check marketing consent
      const marketingConsent = userData.user_metadata?.marketing_consent === true;
      
      return emailVerified && marketingConsent;
    } catch (error) {
      console.error('Failed to check user verification requirements:', error);
      return false;
    }
  }
}