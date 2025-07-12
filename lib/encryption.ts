import crypto from 'crypto';

/**
 * Secure data encryption utilities for chat message content
 * Uses AES-256-CBC for reliable encryption
 */

const ALGORITHM = 'aes-256-cbc';
const TAG_LENGTH = 16;

// Derive encryption key from master key and user-specific salt
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt as any, 100000, 32, 'sha512');
}

export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  salt: Buffer;
}

/**
 * Decrypt sensitive text data
 */
export function decryptText(encryptedData: EncryptedData, masterKey: string): string {
  if (!encryptedData || !masterKey) {
    throw new Error('Encrypted data and master key are required for decryption');
  }

  const { encrypted, iv, tag, salt } = encryptedData;
  
  try {
    // Derive the same key used for encryption
    const key = deriveKey(masterKey, salt);
    
    // Create decipher for CBC mode
    const decipher = crypto.createDecipheriv(ALGORITHM, key as any, iv as any);
    
    // Decrypt the data
    const decryptedPart1 = decipher.update(encrypted as any);
    const decryptedPart2 = decipher.final();
    const decrypted = Buffer.concat([decryptedPart1 as any, decryptedPart2 as any]);
    const decryptedText = decrypted.toString('utf8');
    
    // Verify integrity using the tag (basic check for CBC mode)
    const expectedTag = crypto.createHash('sha256').update(encrypted as any).digest().slice(0, TAG_LENGTH);
    if (!(tag as any).equals(expectedTag)) {
      throw new Error('Data integrity check failed');
    }
    
    return decryptedText;
  } catch (error: any) {
    console.error('Decryption error details:', {
      error: error.message,
      encryptedLength: encrypted?.length,
      ivLength: iv?.length, 
      tagLength: tag?.length,
      saltLength: salt?.length
    });
    throw new Error(`Failed to decrypt data: ${error.message}`);
  }
}

/**
 * Generate a secure master key for a user
 * This should be derived from user's Auth0 ID and application secret
 */
export function generateUserMasterKey(userId: string): string {
  const appSecret = process.env.ENCRYPTION_SECRET;
  if (!appSecret) {
    throw new Error('ENCRYPTION_SECRET environment variable is required');
  }
  
  // Create deterministic but secure key for user
  return crypto
    .createHmac('sha256', appSecret)
    .update(userId)
    .digest('hex');
}
