/**
 * Secrets Manager
 * ===============
 *
 * Centralized secrets management with AWS Secrets Manager and KMS integration.
 * Provides caching, rotation support, and local fallback for development.
 */

import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecretValue {
  value: string;
  version: string;
  cachedAt: Date;
  expiresAt: Date;
}

export interface SecretsManagerConfig {
  /** AWS region */
  region: string;
  /** Secret cache TTL in milliseconds */
  cacheTTL: number;
  /** Use local environment variables instead of AWS */
  useLocal: boolean;
  /** KMS key ID for encryption */
  kmsKeyId?: string;
}

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SECRET_PREFIX = 'campotech/';

// Well-known secret names
export const SecretNames = {
  // Database
  DATABASE_URL: 'database/url',
  DATABASE_PASSWORD: 'database/password',

  // Redis
  REDIS_URL: 'redis/url',
  REDIS_PASSWORD: 'redis/password',

  // JWT
  JWT_SECRET: 'auth/jwt-secret',
  JWT_REFRESH_SECRET: 'auth/jwt-refresh-secret',

  // AFIP
  AFIP_CERT: 'integrations/afip/certificate',
  AFIP_PRIVATE_KEY: 'integrations/afip/private-key',
  AFIP_CUIT: 'integrations/afip/cuit',

  // MercadoPago
  MERCADOPAGO_ACCESS_TOKEN: 'integrations/mercadopago/access-token',
  MERCADOPAGO_PUBLIC_KEY: 'integrations/mercadopago/public-key',

  // WhatsApp
  WHATSAPP_TOKEN: 'integrations/whatsapp/token',
  WHATSAPP_VERIFY_TOKEN: 'integrations/whatsapp/verify-token',

  // OpenAI (for voice transcription)
  OPENAI_API_KEY: 'integrations/openai/api-key',

  // Sentry
  SENTRY_DSN: 'monitoring/sentry-dsn',

  // Master encryption key
  MASTER_ENCRYPTION_KEY: 'security/master-encryption-key',
} as const;

export type SecretName = typeof SecretNames[keyof typeof SecretNames];

// ═══════════════════════════════════════════════════════════════════════════════
// SECRETS MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class SecretsManager {
  private config: SecretsManagerConfig;
  private cache: Map<string, SecretValue> = new Map();
  private awsCredentials?: AWSCredentials;

  constructor(config: Partial<SecretsManagerConfig> = {}) {
    this.config = {
      region: config.region || process.env.AWS_REGION || 'sa-east-1',
      cacheTTL: config.cacheTTL || DEFAULT_CACHE_TTL,
      useLocal: config.useLocal ?? (process.env.NODE_ENV !== 'production'),
      kmsKeyId: config.kmsKeyId || process.env.AWS_KMS_KEY_ID,
    };
  }

  /**
   * Get a secret value
   */
  async getSecret(name: SecretName | string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > new Date()) {
      return cached.value;
    }

    // Fetch secret
    const value = this.config.useLocal
      ? await this.getLocalSecret(name)
      : await this.getAWSSecret(name);

    // Cache the value
    this.cache.set(name, {
      value,
      version: 'local',
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.cacheTTL),
    });

    return value;
  }

  /**
   * Get a secret as JSON object
   */
  async getSecretJSON<T = Record<string, any>>(name: SecretName | string): Promise<T> {
    const value = await this.getSecret(name);
    return JSON.parse(value) as T;
  }

  /**
   * Get a secret as Buffer (for binary data like certificates)
   */
  async getSecretBuffer(name: SecretName | string): Promise<Buffer> {
    const value = await this.getSecret(name);
    // Secrets are stored as base64-encoded strings
    return Buffer.from(value, 'base64');
  }

  /**
   * Invalidate cached secret
   */
  invalidateCache(name?: string): void {
    if (name) {
      this.cache.delete(name);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if a secret exists
   */
  async hasSecret(name: SecretName | string): Promise<boolean> {
    try {
      await this.getSecret(name);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get multiple secrets at once
   */
  async getSecrets(names: (SecretName | string)[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Fetch in parallel
    const promises = names.map(async (name) => {
      const value = await this.getSecret(name);
      results.set(name, value);
    });

    await Promise.all(promises);
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL SECRETS (Development)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get secret from environment variables
   */
  private async getLocalSecret(name: string): Promise<string> {
    // Convert secret name to env var format
    // e.g., "database/url" -> "DATABASE_URL"
    const envKey = name
      .replace(SECRET_PREFIX, '')
      .replace(/\//g, '_')
      .toUpperCase();

    const value = process.env[envKey];

    if (!value) {
      throw new Error(`Secret not found: ${name} (env: ${envKey})`);
    }

    return value;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AWS SECRETS MANAGER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get secret from AWS Secrets Manager
   */
  private async getAWSSecret(name: string): Promise<string> {
    const secretName = `${SECRET_PREFIX}${name}`;

    try {
      const response = await this.awsRequest('secretsmanager', 'GetSecretValue', {
        SecretId: secretName,
      });

      if (response.SecretString) {
        return response.SecretString;
      }

      if (response.SecretBinary) {
        return Buffer.from(response.SecretBinary, 'base64').toString('utf8');
      }

      throw new Error('Secret has no value');
    } catch (error: any) {
      if (error.code === 'ResourceNotFoundException') {
        throw new Error(`Secret not found: ${name}`);
      }
      throw error;
    }
  }

  /**
   * Create or update a secret in AWS
   */
  async putSecret(name: SecretName | string, value: string): Promise<void> {
    if (this.config.useLocal) {
      console.warn('putSecret called in local mode - secrets are read-only from env');
      return;
    }

    const secretName = `${SECRET_PREFIX}${name}`;

    try {
      // Try to update existing secret
      await this.awsRequest('secretsmanager', 'PutSecretValue', {
        SecretId: secretName,
        SecretString: value,
      });
    } catch (error: any) {
      if (error.code === 'ResourceNotFoundException') {
        // Create new secret
        await this.awsRequest('secretsmanager', 'CreateSecret', {
          Name: secretName,
          SecretString: value,
          KmsKeyId: this.config.kmsKeyId,
        });
      } else {
        throw error;
      }
    }

    // Invalidate cache
    this.invalidateCache(name);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AWS KMS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Encrypt data using AWS KMS
   */
  async kmsEncrypt(plaintext: Buffer): Promise<Buffer> {
    if (this.config.useLocal) {
      // In local mode, use simple encryption with local key
      return this.localEncrypt(plaintext);
    }

    if (!this.config.kmsKeyId) {
      throw new Error('KMS key ID not configured');
    }

    const response = await this.awsRequest('kms', 'Encrypt', {
      KeyId: this.config.kmsKeyId,
      Plaintext: plaintext.toString('base64'),
    });

    return Buffer.from(response.CiphertextBlob, 'base64');
  }

  /**
   * Decrypt data using AWS KMS
   */
  async kmsDecrypt(ciphertext: Buffer): Promise<Buffer> {
    if (this.config.useLocal) {
      return this.localDecrypt(ciphertext);
    }

    const response = await this.awsRequest('kms', 'Decrypt', {
      CiphertextBlob: ciphertext.toString('base64'),
    });

    return Buffer.from(response.Plaintext, 'base64');
  }

  /**
   * Generate a data key using KMS
   */
  async generateDataKey(): Promise<{ plaintext: Buffer; encrypted: Buffer }> {
    if (this.config.useLocal) {
      const plaintext = crypto.randomBytes(32);
      const encrypted = this.localEncrypt(plaintext);
      return { plaintext, encrypted };
    }

    if (!this.config.kmsKeyId) {
      throw new Error('KMS key ID not configured');
    }

    const response = await this.awsRequest('kms', 'GenerateDataKey', {
      KeyId: this.config.kmsKeyId,
      KeySpec: 'AES_256',
    });

    return {
      plaintext: Buffer.from(response.Plaintext, 'base64'),
      encrypted: Buffer.from(response.CiphertextBlob, 'base64'),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL ENCRYPTION (Development fallback)
  // ═══════════════════════════════════════════════════════════════════════════

  private getLocalKey(): Buffer {
    const key = process.env.LOCAL_ENCRYPTION_KEY || 'dev-key-do-not-use-in-production';
    return crypto.createHash('sha256').update(key).digest();
  }

  private localEncrypt(plaintext: Buffer): Buffer {
    const key = this.getLocalKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Format: iv (16) + authTag (16) + ciphertext
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private localDecrypt(ciphertext: Buffer): Buffer {
    const key = this.getLocalKey();

    const iv = ciphertext.subarray(0, 16);
    const authTag = ciphertext.subarray(16, 32);
    const encrypted = ciphertext.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AWS REQUEST HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Make AWS API request
   * This is a simplified implementation - in production use AWS SDK
   */
  private async awsRequest(
    service: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    // In a real implementation, this would use the AWS SDK
    // For now, throw an error to indicate AWS SDK needs to be installed

    throw new Error(
      `AWS SDK not configured. To use AWS Secrets Manager:\n` +
      `1. Install: npm install @aws-sdk/client-secrets-manager @aws-sdk/client-kms\n` +
      `2. Configure AWS credentials\n` +
      `3. Set AWS_REGION and AWS_KMS_KEY_ID environment variables\n\n` +
      `For development, set USE_LOCAL_SECRETS=true to use environment variables.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let secretsManager: SecretsManager | null = null;

/**
 * Initialize the global secrets manager
 */
export function initializeSecretsManager(config?: Partial<SecretsManagerConfig>): void {
  secretsManager = new SecretsManager(config);
}

/**
 * Get the global secrets manager
 */
export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    // Auto-initialize with defaults
    secretsManager = new SecretsManager();
  }
  return secretsManager;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a secret value
 */
export async function getSecret(name: SecretName | string): Promise<string> {
  return getSecretsManager().getSecret(name);
}

/**
 * Get multiple secrets
 */
export async function getSecrets(names: (SecretName | string)[]): Promise<Map<string, string>> {
  return getSecretsManager().getSecrets(names);
}
