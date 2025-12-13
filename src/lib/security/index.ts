/**
 * Security Module Index
 * ====================
 *
 * Security utilities for encryption, secrets management, and log redaction.
 */

// Encryption
export {
  EncryptionService,
  initializeEncryption,
  getEncryptionService,
  deriveKeyFromPassword,
  generateEncryptionKey,
  generateSalt,
  envelopeEncrypt,
  envelopeDecrypt,
  encryptFields,
  decryptFields,
} from './encryption.service';
export type {
  EncryptedData,
  AADContext,
  EncryptionConfig,
  EnvelopeEncryptedData,
} from './encryption.service';

// Secrets Manager
export {
  SecretsManager,
  initializeSecretsManager,
  getSecretsManager,
  getSecret,
} from './secrets-manager';
export type {
  SecretValue,
  SecretsManagerConfig,
} from './secrets-manager';

// Log Redaction
export {
  LogRedactionService,
  initializeLogRedaction,
  getLogRedactionService,
  redact,
  redactString,
  redactError,
  safeStringify,
  redactionMiddleware,
} from './log-redaction';
export type {
  RedactionConfig,
  RedactionStats,
} from './log-redaction';
