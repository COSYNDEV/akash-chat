import redis from './redis';

interface Auth0Token {
  access_token: string;
  expires_at: number;
}

interface Auth0TokenCache {
  token: Auth0Token | null;
  isRefreshing: boolean;
  refreshPromise: Promise<Auth0Token> | null;
}

class Auth0ManagementService {
  private memoryCache: Auth0TokenCache = {
    token: null,
    isRefreshing: false,
    refreshPromise: null
  };

  private readonly REDIS_KEY = 'auth0:management:token';
  private readonly CONSENT_CACHE_KEY = 'auth0:marketing_consent';

  private async fetchNewToken(): Promise<Auth0Token> {
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;
    if (!issuerBaseUrl) {
      throw new Error('Missing AUTH0_ISSUER_BASE_URL');
    }

    const response = await fetch(`${issuerBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.AUTH0_MGMT_CLIENT_ID,
        client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
        audience: `${issuerBaseUrl}/api/v2/`,
        grant_type: 'client_credentials',
        scope: 'read:users update:users',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Auth0 token fetch failed: ${error}`);
    }

    const data = await response.json();
    
    // Tokens typically expire in 24 hours, cache for 23 hours to be safe
    const expiresAt = Date.now() + (23 * 60 * 60 * 1000);
    
    const token = {
      access_token: data.access_token,
      expires_at: expiresAt
    };

    // Store in Redis with TTL
    try {
      const ttlSeconds = Math.floor((expiresAt - Date.now()) / 1000);
      await redis.set(this.REDIS_KEY, JSON.stringify(token), 'EX', ttlSeconds);
    } catch (error) {
      console.error('Failed to cache Auth0 token in Redis:', error);
      // Continue without Redis caching
    }

    return token;
  }

  private async getTokenFromRedis(): Promise<Auth0Token | null> {
    try {
      const tokenData = await redis.get(this.REDIS_KEY);
      if (!tokenData) {return null;}

      const token = JSON.parse(tokenData) as Auth0Token;
      
      // Verify token is still valid (5 minute buffer)
      if (token.expires_at > (Date.now() + 5 * 60 * 1000)) {
        return token;
      }
      
      // Token expired, remove from Redis
      await redis.del(this.REDIS_KEY);
      return null;
    } catch (error) {
      console.error('Redis token retrieval failed:', error);
      return null;
    }
  }

  private isTokenValid(token: Auth0Token | null): boolean {
    if (!token) {return false;}
    // Check if token expires in the next 5 minutes
    return token.expires_at > (Date.now() + 5 * 60 * 1000);
  }

  async getToken(): Promise<string> {
    // Check memory cache first
    if (this.isTokenValid(this.memoryCache.token)) {
      return this.memoryCache.token!.access_token;
    }

    // Check Redis cache
    const redisToken = await this.getTokenFromRedis();
    if (redisToken) {
      this.memoryCache.token = redisToken;
      return redisToken.access_token;
    }

    // If already refreshing, wait for that promise
    if (this.memoryCache.isRefreshing && this.memoryCache.refreshPromise) {
      const token = await this.memoryCache.refreshPromise;
      return token.access_token;
    }

    // Start refresh process
    this.memoryCache.isRefreshing = true;
    this.memoryCache.refreshPromise = this.fetchNewToken();

    try {
      const token = await this.memoryCache.refreshPromise;
      this.memoryCache.token = token;
      return token.access_token;
    } finally {
      this.memoryCache.isRefreshing = false;
      this.memoryCache.refreshPromise = null;
    }
  }

  private async getMarketingConsentFromCache(userId: string): Promise<boolean | null> {
    try {
      const cacheKey = `${this.CONSENT_CACHE_KEY}:${userId}`;
      const cached = await redis.get(cacheKey);
      return cached === 'true' ? true : null; // Only return true if explicitly cached as true
    } catch (error) {
      console.error('Failed to get marketing consent from cache:', error);
      return null;
    }
  }

  private async cacheMarketingConsent(userId: string, consent: boolean): Promise<void> {
    try {
      const cacheKey = `${this.CONSENT_CACHE_KEY}:${userId}`;
      if (consent) {
        // Cache true consent for 24 hours
        await redis.set(cacheKey, 'true', 'EX', 24 * 60 * 60);
      } else {
        // Remove cache if consent is false (don't cache false values)
        await redis.del(cacheKey);
      }
    } catch (error) {
      console.error('Failed to cache marketing consent:', error);
    }
  }

  async getUserData(userId: string): Promise<any> {
    const token = await this.getToken();
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;
    
    const response = await fetch(`${issuerBaseUrl}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch user data: ${error}`);
    }

    const userData = await response.json();
    
    // Cache marketing consent if it's true
    const marketingConsent = userData.user_metadata?.marketing_consent || false;
    if (marketingConsent) {
      await this.cacheMarketingConsent(userId, marketingConsent);
    }

    return userData;
  }

  async getMarketingConsent(userId: string): Promise<boolean> {
    // Check cache first
    const cachedConsent = await this.getMarketingConsentFromCache(userId);
    if (cachedConsent !== null) {
      return cachedConsent;
    }

    // Not in cache, fetch from Auth0
    const userData = await this.getUserData(userId);
    return userData.user_metadata?.marketing_consent || false;
  }

   // currently unused 
  async updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<void> {
    const token = await this.getToken();
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;
    
    const response = await fetch(`${issuerBaseUrl}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ user_metadata: metadata }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update user metadata: ${error}`);
    }

    // Update cache if marketing consent was changed
    if ('marketing_consent' in metadata) {
      await this.cacheMarketingConsent(userId, metadata.marketing_consent);
    }
  }
}

// Singleton instance
export const auth0Management = new Auth0ManagementService();

export default auth0Management;