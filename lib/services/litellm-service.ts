import { auth0Management } from '../auth0-management';
import { createUserApiKey, getUserApiKey, updateUserApiKey } from '../database';
import redis from '../redis';

import { EncryptionService } from './encryption-service';

interface LiteLLMApiKey {
  key: string;
  userId: string;
  expiresAt: number;
}

interface JWTTokenCache {
  token: string;
  expiresAt: number;
}

export class LiteLLMService {
  private static readonly REDIS_PREFIX = 'litellm:api_key:';
  private static readonly KEY_EXPIRY_HOURS = 24;
  private static readonly JWT_REDIS_KEY = 'litellm:jwt_token';
  private static jwtTokenCache: JWTTokenCache | null = null;

  /**
   * Decode JWT to get expiration time (without verification)
   */
  private static getJWTExpiration(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {return null;}

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
    } catch (error) {
      return null;
    }
  }

  /**
   * Get a valid JWT token, refreshing if necessary
   */
  private static async getValidJWT(): Promise<string> {
    // Check memory cache first
    if (this.jwtTokenCache && Date.now() < this.jwtTokenCache.expiresAt - 5 * 60 * 1000) {
      return this.jwtTokenCache.token;
    }

    // Check Redis cache
    try {
      const cachedData = await redis.get(this.JWT_REDIS_KEY);
      if (cachedData) {
        const cached = JSON.parse(cachedData) as JWTTokenCache;
        // Use cached token if more than 5 minutes remaining
        if (Date.now() < cached.expiresAt - 5 * 60 * 1000) {
          this.jwtTokenCache = cached;
          return cached.token;
        }
      }
    } catch (error) {
      console.error('Failed to get JWT from Redis:', error);
    }

    // Check if static token from env is still valid
    const staticToken = process.env.JWT_API_KEY;
    if (staticToken) {
      const expiration = this.getJWTExpiration(staticToken);
      if (expiration && Date.now() < expiration - 5 * 60 * 1000) {
        // Static token is still valid, cache it
        const tokenCache: JWTTokenCache = {
          token: staticToken,
          expiresAt: expiration
        };
        this.jwtTokenCache = tokenCache;

        try {
          const ttlSeconds = Math.floor((expiration - Date.now()) / 1000);
          await redis.set(this.JWT_REDIS_KEY, JSON.stringify(tokenCache), 'EX', ttlSeconds);
        } catch (error) {
          console.error('Failed to cache static JWT in Redis:', error);
        }

        return staticToken;
      }
    }

    // Token expired or not found, refresh it
    return await this.refreshJWT();
  }

  /**
   * Refresh JWT token using refresh token
   */
  private static async refreshJWT(): Promise<string> {
    const refreshToken = process.env.JWT_REFRESH_TOKEN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;

    if (!refreshToken || !clientId || !issuerBaseUrl) {
      // Fallback to static token if refresh not configured
      console.warn('JWT refresh not configured, using static token');
      return process.env.JWT_API_KEY || '';
    }

    try {
      const response = await fetch(`${issuerBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`JWT refresh failed: ${error}`);
      }

      const data = await response.json();
      const expiresAt = Date.now() + (data.expires_in * 1000);

      const tokenCache: JWTTokenCache = {
        token: data.access_token,
        expiresAt
      };

      // Store in memory
      this.jwtTokenCache = tokenCache;

      // Store in Redis with TTL
      try {
        const ttlSeconds = Math.floor((expiresAt - Date.now()) / 1000);
        await redis.set(this.JWT_REDIS_KEY, JSON.stringify(tokenCache), 'EX', ttlSeconds);
      } catch (error) {
        console.error('Failed to cache JWT in Redis:', error);
      }

      console.log('JWT token refreshed successfully');
      return data.access_token;
    } catch (error) {
      console.error('Failed to refresh JWT token:', error);
      // Fallback to static token
      return process.env.JWT_API_KEY || '';
    }
  }

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
      // Get a valid JWT token (auto-refreshes if needed)
      const jwtToken = await this.getValidJWT();

      // Create API key with Basic tier limits using admin API user ID
      const apiKeyResponse = await fetch(`${apiEndpoint}/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: "chat_"+userId,
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
   * Get an API key for a user with full fallback chain and lazy migration
   * Order: Redis cache → Database (with validation & auto-migration) → null
   *
   * Lazy Migration: When a key is retrieved from the database, it's validated
   * against the API server. If invalid, a new key is created and updated in the DB.
   */
  static async getApiKey(userId: string): Promise<string | null> {
    // 1. Try Redis cache first (fastest)
    const cachedKey = await this.getApiKeyFromRedis(userId);
    if (cachedKey) {
      return cachedKey;
    }

    // 2. Try database backup (includes lazy migration if key is invalid)
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
   * Verify if an API key is valid by attempting to use it
   */
  private static async verifyApiKeyValid(apiKey: string): Promise<boolean> {
    const apiEndpoint = process.env.API_ENDPOINT;

    if (!apiEndpoint) {
      return false;
    }

    try {
      // Test the key by making a simple request to the models endpoint
      const response = await fetch(`${apiEndpoint}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to verify API key:', error);
      return false;
    }
  }

  /**
   * Recreate API key and update in database (migration)
   */
  private static async recreateAndUpdateApiKey(userId: string): Promise<string | null> {
    try {
      console.log(`Migrating API key for user ${userId}`);

      // Check if user meets verification requirements
      const isVerified = await this.checkUserVerificationRequirements(userId);
      if (!isVerified) {
        console.log(`User ${userId} does not meet verification requirements for migration`);
        return null;
      }

      let apiEndpoint = process.env.API_ENDPOINT;
      apiEndpoint = apiEndpoint?.replace('/v1', '');

      if (!apiEndpoint) {
        throw new Error('API_ENDPOINT not configured');
      }

      // Get valid JWT token
      const jwtToken = await this.getValidJWT();

      // Create new API key via Admin API
      const apiKeyResponse = await fetch(`${apiEndpoint}/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: "chat_"+userId,
          maxConcurrentRequests: 1
        })
      });

      if (!apiKeyResponse.ok) {
        const errorText = await apiKeyResponse.text();
        throw new Error(`API key creation failed: ${apiKeyResponse.status} ${errorText}`);
      }

      const result = (await apiKeyResponse.json()).data;
      const newApiKey = result.key;

      if (!newApiKey) {
        throw new Error('API did not return a valid key');
      }

      // Encrypt the new API key
      const encryptionService = new EncryptionService(userId);
      const encrypted = await encryptionService.encryptForDatabase(newApiKey);
      console.log("updating api key in database");

      // Update in database
      await updateUserApiKey(userId, {
        litellm_api_key_encrypted_b64: encrypted.content_encrypted,
        litellm_api_key_iv_b64: encrypted.content_iv,
        litellm_api_key_tag_b64: encrypted.content_tag
      });

      console.log(`API key migrated successfully for user ${userId}`);
      return newApiKey;
    } catch (error) {
      console.error('Failed to recreate and update API key:', error);
      return null;
    }
  }

  /**
   * Get and decrypt API key from database with lazy migration
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

      // LAZY MIGRATION: Verify if the key is valid on the server
      const isValid = await this.verifyApiKeyValid(decrypted);

      if (!isValid) {
        // Key is invalid - attempt migration
        console.log(`API key invalid for user ${userId}, attempting migration`);
        const migratedKey = await this.recreateAndUpdateApiKey(userId);
        return migratedKey;
      }

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