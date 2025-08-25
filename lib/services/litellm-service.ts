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
   * Generate a new API key for a user via Admin API
   * First creates user on API server if needed, then creates API key
   * Requires user to have verified email and accepted marketing consent
   */
  static async generateApiKey(userId: string): Promise<string> {
    // Check if user meets verification requirements
    const isVerified = await this.checkUserVerificationRequirements(userId);
    if (!isVerified) {
      throw new Error('User must verify email and accept marketing consent to generate API key');
    }
    
    let apiEndpoint = process.env.API_ENDPOINT;
    apiEndpoint = apiEndpoint?.replace('/v1', '');
    const adminKey = process.env.API_KEY;

    if (!apiEndpoint || !adminKey) {
      throw new Error('Admin API configuration missing: API_ENDPOINT and API_KEY required');
    }

    try {
      // Get user data from Auth0 for creating user on API server
      const userData = await auth0Management.getUserData(userId);
      
      // Get admin API user ID dynamically
      let adminApiUserId = await this.getAdminApiUserId(userId);
      
      // If user doesn't exist in admin API, create them
      if (!adminApiUserId) {
        const body = JSON.stringify({
          email: "akash_"+userData.email,
          firstName: userData.given_name || userData.name?.split(' ')[0] || 'User',
          lastName: userData.family_name || userData.name?.split(' ').slice(1).join(' ') || '',
          emailVerified: true,
          isActive: true,
          auth0Userid: `akash_${userId}`,
          startBalance: 1000,
        });

        // Create user
        const createUserResponse = await fetch(`${apiEndpoint}/admin/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminKey}`,
            'Content-Type': 'application/json'
          },
          body
        });
        
        if (createUserResponse.ok) {
          const createData = await createUserResponse.json();
          adminApiUserId = createData.userId || createData.id;
        }
        
        if (!adminApiUserId) {
          throw new Error('Failed to create or get admin API user ID');
        }
      }

      // Create API key with Basic tier limits using admin API user ID
      const apiKeyResponse = await fetch(`${apiEndpoint}/admin/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: adminApiUserId,
          name: "akashchat",
          rateLimitRpm: 30,        // 30 requests per minute (1 every 2 seconds)
          maxConcurrentRequests: 1 // 1 concurrent request (single user)
        })
      });

      if (!apiKeyResponse.ok) {
        const errorText = await apiKeyResponse.text();
        throw new Error(`Admin API key creation failed: ${apiKeyResponse.status} ${errorText}`);
      }

      const result = (await apiKeyResponse.json()).data;
      const apiKey = result.key;

      if (!apiKey) {
        throw new Error('Admin API did not return a valid key');
      }

      // Store in database (encrypted) for backup/caching
      await this.storeApiKeyInDatabase(userId, apiKey);
      
      // Store in Redis for fast session access
      await this.storeApiKeyInRedis(userId, apiKey);
      
      return apiKey;
    } catch (error) {
      console.error('Failed to generate API key via Admin API:', error);
      throw error;
    }
  }

  /**
   * Get an API key for a user with full fallback chain and auto-recreation
   * Order: Redis cache → Database → Auto-recreate if expired
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
  private static async storeApiKeyInDatabase(
    userId: string, 
    apiKey: string
  ): Promise<void> {
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
   * Get admin API user ID from Auth0 user ID
   */
  private static async getAdminApiUserId(auth0UserId: string): Promise<string | null> {
    let apiEndpoint = process.env.API_ENDPOINT;
    apiEndpoint = apiEndpoint?.replace('/v1', '');
    const adminKey = process.env.API_KEY;

    if (!apiEndpoint || !adminKey) {
      throw new Error('Admin API configuration missing: API_ENDPOINT and API_KEY required');
    }

    const auth0Id = `akash_${auth0UserId}`;

    try {
      const response = await fetch(`${apiEndpoint}/admin/users/${encodeURIComponent(auth0Id)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = (await response.json()).data;
        return userData.id || null;
      }

      return null;
    } catch (error) {
      console.error('Failed to get admin API user ID:', error);
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