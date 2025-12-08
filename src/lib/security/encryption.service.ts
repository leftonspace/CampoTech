/**
 * Encryption Service
 * ==================
 *
 * AES-256-GCM encryption for sensitive data at rest.
 * Used for storing AFIP certificates, API keys, and other secrets.
 */

import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
  /** Base64-encoded authentication tag */
  authTag: string;
  /** Algorithm identifier for future compatibility */
  algorithm: 'aes-256-gcm';
  /** Key version for key rotation support */
  keyVersion: number;
}

export interface EncryptionConfig {
  /** Master encryption key (32 bytes for AES-256) */
  masterKey: Buffer;
  /** Current key version */
  keyVersion: number;
  /** Previous keys for decryption during rotation */
  previousKeys?: Map<number, Buffer>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class EncryptionService {
  private config: EncryptionConfig;

  constructor(config: EncryptionConfig) {
    if (config.masterKey.length !== KEY_LENGTH) {
      throw new Error(`Master key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 8} bits)`);
    }
    this.config = config;
  }

  /**
   * Encrypt plaintext data
   */
  encrypt(plaintext: string | Buffer): EncryptedData {
    const plaintextBuffer = typeof plaintext === 'string'
      ? Buffer.from(plaintext, 'utf8')
      : plaintext;

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.config.masterKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final(),
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: ALGORITHM,
      keyVersion: this.config.keyVersion,
    };
  }

  /**
   * Decrypt encrypted data
   */
  decrypt(encryptedData: EncryptedData): Buffer {
    // Get appropriate key for this version
    const key = this.getKeyForVersion(encryptedData.keyVersion);

    if (!key) {
      throw new Error(`No key available for version ${encryptedData.keyVersion}`);
    }

    // Decode components
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted;
  }

  /**
   * Decrypt to string (UTF-8)
   */
  decryptToString(encryptedData: EncryptedData): string {
    return this.decrypt(encryptedData).toString('utf8');
  }

  /**
   * Re-encrypt data with current key version
   * Used during key rotation
   */
  reencrypt(encryptedData: EncryptedData): EncryptedData {
    // Already using current version
    if (encryptedData.keyVersion === this.config.keyVersion) {
      return encryptedData;
    }

    // Decrypt with old key, encrypt with new
    const plaintext = this.decrypt(encryptedData);
    return this.encrypt(plaintext);
  }

  /**
   * Check if data needs re-encryption
   */
  needsReencryption(encryptedData: EncryptedData): boolean {
    return encryptedData.keyVersion < this.config.keyVersion;
  }

  /**
   * Get key for specific version
   */
  private getKeyForVersion(version: number): Buffer | null {
    if (version === this.config.keyVersion) {
      return this.config.masterKey;
    }

    if (this.config.previousKeys) {
      return this.config.previousKeys.get(version) || null;
    }

    return null;
  }

  /**
   * Serialize encrypted data for database storage
   */
  static serialize(data: EncryptedData): string {
    return JSON.stringify(data);
  }

  /**
   * Deserialize encrypted data from database
   */
  static deserialize(serialized: string): EncryptedData {
    const data = JSON.parse(serialized);

    // Validate required fields
    if (!data.ciphertext || !data.iv || !data.authTag || !data.algorithm) {
      throw new Error('Invalid encrypted data format');
    }

    return data as EncryptedData;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEY DERIVATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derive encryption key from password/passphrase
 * Uses PBKDF2 with high iteration count
 */
export function deriveKeyFromPassword(
  password: string,
  salt: Buffer,
  iterations: number = 100000
): Buffer {
  return crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Generate random encryption key
 */
export function generateEncryptionKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Generate random salt for key derivation
 */
export function generateSalt(length: number = 32): Buffer {
  return crypto.randomBytes(length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA KEY ENCRYPTION (Envelope Encryption)
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnvelopeEncryptedData {
  /** Encrypted data key */
  encryptedDataKey: EncryptedData;
  /** Data encrypted with the data key */
  encryptedData: EncryptedData;
}

/**
 * Encrypt using envelope encryption pattern
 * Generates a random data key, encrypts data with it,
 * then encrypts the data key with the master key
 */
export function envelopeEncrypt(
  service: EncryptionService,
  plaintext: string | Buffer
): EnvelopeEncryptedData {
  // Generate random data key
  const dataKey = generateEncryptionKey();

  // Encrypt data with data key
  const dataKeyService = new EncryptionService({
    masterKey: dataKey,
    keyVersion: 1,
  });
  const encryptedData = dataKeyService.encrypt(plaintext);

  // Encrypt data key with master key
  const encryptedDataKey = service.encrypt(dataKey);

  // Clear data key from memory
  dataKey.fill(0);

  return {
    encryptedDataKey,
    encryptedData,
  };
}

/**
 * Decrypt envelope-encrypted data
 */
export function envelopeDecrypt(
  service: EncryptionService,
  envelope: EnvelopeEncryptedData
): Buffer {
  // Decrypt data key
  const dataKey = service.decrypt(envelope.encryptedDataKey);

  // Decrypt data with data key
  const dataKeyService = new EncryptionService({
    masterKey: dataKey,
    keyVersion: envelope.encryptedData.keyVersion,
  });
  const plaintext = dataKeyService.decrypt(envelope.encryptedData);

  // Clear data key from memory
  dataKey.fill(0);

  return plaintext;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD-LEVEL ENCRYPTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypt specific fields in an object
 */
export function encryptFields<T extends Record<string, any>>(
  service: EncryptionService,
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };

  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      const encrypted = service.encrypt(JSON.stringify(result[field]));
      result[field] = EncryptionService.serialize(encrypted) as any;
    }
  }

  return result;
}

/**
 * Decrypt specific fields in an object
 */
export function decryptFields<T extends Record<string, any>>(
  service: EncryptionService,
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };

  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      try {
        const encrypted = EncryptionService.deserialize(result[field] as string);
        const decrypted = service.decryptToString(encrypted);
        result[field] = JSON.parse(decrypted);
      } catch {
        // Field might not be encrypted, leave as-is
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let encryptionService: EncryptionService | null = null;

/**
 * Initialize the global encryption service
 */
export function initializeEncryption(config: EncryptionConfig): void {
  encryptionService = new EncryptionService(config);
}

/**
 * Get the global encryption service
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionService) {
    throw new Error('Encryption service not initialized. Call initializeEncryption first.');
  }
  return encryptionService;
}
