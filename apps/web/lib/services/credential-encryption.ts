/**
 * Credential Encryption Service
 * ==============================
 *
 * Phase 4 Security Remediation: Finding 1
 * Encrypts MercadoPago OAuth tokens and other payment credentials at rest.
 *
 * Uses AES-256-GCM with AAD (Additional Authenticated Data) to prevent
 * credentials from being used outside their intended organization context.
 */

import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EncryptedCredential {
    /** Base64-encoded ciphertext */
    ciphertext: string;
    /** Base64-encoded initialization vector */
    iv: string;
    /** Base64-encoded authentication tag */
    authTag: string;
    /** Algorithm identifier */
    algorithm: 'aes-256-gcm';
    /** Key version for rotation support */
    keyVersion: number;
    /** Organization ID hash (for AAD verification) */
    orgHash: string;
    /** Encrypted timestamp */
    encryptedAt: string;
}

export interface MercadoPagoCredentials {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    userId: number;
    publicKey: string;
    liveMode: boolean;
    connectedAt: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
}

export interface EncryptedMPSettings {
    connected: boolean;
    connectedAt: string;
    /** Encrypted tokens (store as JSON string) */
    encryptedCredentials: EncryptedCredential;
    /** Non-sensitive user info (for display) */
    userId: number;
    publicKey: string;
    liveMode: boolean;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const _KEY_LENGTH = 32;
const CREDENTIAL_ENCRYPTION_KEY_ENV = 'CREDENTIAL_ENCRYPTION_KEY';

// ═══════════════════════════════════════════════════════════════════════════════
// KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get encryption key from environment
 * Falls back to AUDIT_ENCRYPTION_KEY or derived key in development
 */
function getEncryptionKey(): Buffer {
    const keyString =
        process.env[CREDENTIAL_ENCRYPTION_KEY_ENV] ||
        process.env.AUDIT_ENCRYPTION_KEY;

    if (!keyString) {
        if (process.env.NODE_ENV === 'development') {
            console.warn(
                '[CredentialEncryption] Using derived key for development. Set CREDENTIAL_ENCRYPTION_KEY in production.'
            );
            return crypto.createHash('sha256').update('campotech-dev-credentials').digest();
        }
        throw new Error(`${CREDENTIAL_ENCRYPTION_KEY_ENV} environment variable not set`);
    }

    // Key should be 32 bytes (64 hex chars) or 44 chars (base64)
    if (keyString.length === 64) {
        return Buffer.from(keyString, 'hex');
    } else if (keyString.length === 44) {
        return Buffer.from(keyString, 'base64');
    } else {
        // Hash the provided key to get 32 bytes
        return crypto.createHash('sha256').update(keyString).digest();
    }
}

/**
 * Hash organization ID for AAD
 */
function hashOrgId(orgId: string): string {
    return crypto.createHash('sha256').update(orgId).digest('hex').substring(0, 32);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class CredentialEncryptionService {
    private static currentKeyVersion = 1;

    /**
     * Encrypt credentials with organization context binding
     */
    static encrypt(credentials: MercadoPagoCredentials, orgId: string): EncryptedCredential {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const orgHash = hashOrgId(orgId);

        // Build AAD (Additional Authenticated Data) to bind ciphertext to org
        const aad = Buffer.from(`orgId=${orgId}|purpose=mercadopago-credentials`, 'utf8');

        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        cipher.setAAD(aad);

        // Encrypt only sensitive tokens
        const sensitiveData = {
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
        };

        const plaintext = JSON.stringify(sensitiveData);
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        return {
            ciphertext: encrypted,
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            algorithm: ALGORITHM,
            keyVersion: this.currentKeyVersion,
            orgHash,
            encryptedAt: new Date().toISOString(),
        };
    }

    /**
     * Decrypt credentials with organization context verification
     */
    static decrypt(
        encryptedCredential: EncryptedCredential,
        orgId: string
    ): { accessToken: string; refreshToken: string } {
        // Verify org hash matches
        const expectedOrgHash = hashOrgId(orgId);
        if (encryptedCredential.orgHash !== expectedOrgHash) {
            throw new Error('Organization context mismatch - credential cannot be decrypted for this organization');
        }

        const key = getEncryptionKey();
        const iv = Buffer.from(encryptedCredential.iv, 'base64');
        const authTag = Buffer.from(encryptedCredential.authTag, 'base64');

        // Build AAD (must match encryption)
        const aad = Buffer.from(`orgId=${orgId}|purpose=mercadopago-credentials`, 'utf8');

        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAAD(aad);
        decipher.setAuthTag(authTag);

        // Decrypt
        let decrypted = decipher.update(encryptedCredential.ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    /**
     * Check if stored settings have encrypted credentials
     */
    static hasEncryptedCredentials(mpSettings: unknown): mpSettings is EncryptedMPSettings {
        return (
            typeof mpSettings === 'object' &&
            mpSettings !== null &&
            'encryptedCredentials' in mpSettings &&
            typeof (mpSettings as EncryptedMPSettings).encryptedCredentials === 'object' &&
            'ciphertext' in (mpSettings as EncryptedMPSettings).encryptedCredentials
        );
    }

    /**
     * Check if stored settings have legacy plaintext credentials
     */
    static hasPlaintextCredentials(
        mpSettings: unknown
    ): mpSettings is { accessToken: string; refreshToken: string } {
        if (typeof mpSettings !== 'object' || mpSettings === null) {
            return false;
        }
        const settings = mpSettings as Record<string, unknown>;
        const accessToken = settings.accessToken;
        return (
            typeof accessToken === 'string' &&
            !accessToken.startsWith('{')
        );
    }

    /**
     * Migrate legacy plaintext credentials to encrypted format
     */
    static migrateToEncrypted(
        legacySettings: Record<string, unknown>,
        orgId: string
    ): EncryptedMPSettings {
        const credentials: MercadoPagoCredentials = {
            accessToken: String(legacySettings.accessToken || ''),
            refreshToken: String(legacySettings.refreshToken || ''),
            expiresIn: Number(legacySettings.expiresIn || 0),
            tokenType: String(legacySettings.tokenType || 'Bearer'),
            userId: Number(legacySettings.userId || 0),
            publicKey: String(legacySettings.publicKey || ''),
            liveMode: Boolean(legacySettings.liveMode),
            connectedAt: String(legacySettings.connectedAt || new Date().toISOString()),
            email: legacySettings.email as string | null,
            firstName: legacySettings.firstName as string | null,
            lastName: legacySettings.lastName as string | null,
        };

        return {
            connected: true,
            connectedAt: credentials.connectedAt,
            encryptedCredentials: this.encrypt(credentials, orgId),
            userId: credentials.userId,
            publicKey: credentials.publicKey,
            liveMode: credentials.liveMode,
            email: credentials.email,
            firstName: credentials.firstName,
            lastName: credentials.lastName,
        };
    }

    /**
     * Get access token for MercadoPago API calls
     */
    static getAccessToken(mpSettings: unknown, orgId: string): string | null {
        if (!mpSettings || typeof mpSettings !== 'object') {
            return null;
        }

        // Handle encrypted credentials
        if (this.hasEncryptedCredentials(mpSettings)) {
            try {
                const decrypted = this.decrypt(mpSettings.encryptedCredentials, orgId);
                return decrypted.accessToken;
            } catch (error) {
                console.error('[CredentialEncryption] Failed to decrypt access token:', error);
                return null;
            }
        }

        // Handle legacy plaintext credentials (migration pending)
        if (this.hasPlaintextCredentials(mpSettings)) {
            console.warn(
                '[CredentialEncryption] Legacy plaintext credentials detected. Migration recommended.'
            );
            return mpSettings.accessToken;
        }

        return null;
    }

    /**
     * Get refresh token for token refresh operations
     */
    static getRefreshToken(mpSettings: unknown, orgId: string): string | null {
        if (!mpSettings || typeof mpSettings !== 'object') {
            return null;
        }

        if (this.hasEncryptedCredentials(mpSettings)) {
            try {
                const decrypted = this.decrypt(mpSettings.encryptedCredentials, orgId);
                return decrypted.refreshToken;
            } catch (error) {
                console.error('[CredentialEncryption] Failed to decrypt refresh token:', error);
                return null;
            }
        }

        if (this.hasPlaintextCredentials(mpSettings)) {
            return mpSettings.refreshToken;
        }

        return null;
    }
}

/**
 * Helper: Create encrypted MP settings from OAuth response
 */
export function createEncryptedMPSettings(
    tokens: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
        user_id: number;
        public_key: string;
        live_mode: boolean;
    },
    userInfo: { email?: string; first_name?: string; last_name?: string } | null,
    orgId: string
): EncryptedMPSettings {
    const credentials: MercadoPagoCredentials = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type,
        userId: tokens.user_id,
        publicKey: tokens.public_key,
        liveMode: tokens.live_mode,
        connectedAt: new Date().toISOString(),
        email: userInfo?.email || null,
        firstName: userInfo?.first_name || null,
        lastName: userInfo?.last_name || null,
    };

    return {
        connected: true,
        connectedAt: credentials.connectedAt,
        encryptedCredentials: CredentialEncryptionService.encrypt(credentials, orgId),
        userId: credentials.userId,
        publicKey: credentials.publicKey,
        liveMode: credentials.liveMode,
        email: credentials.email,
        firstName: credentials.firstName,
        lastName: credentials.lastName,
    };
}
