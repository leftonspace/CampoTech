/**
 * AFIP Credentials Service
 * ========================
 *
 * Secure storage and retrieval of AFIP credentials with AES-256-GCM encryption.
 *
 * Security requirements (per implementation-plan.md Phase 1.1):
 * - AFIP credentials encrypted with AES-256-GCM
 * - Stored in dedicated columns, not JSONB
 * - AAD context binding prevents cross-org access
 *
 * @see src/lib/security/encryption.service.ts for encryption implementation
 */

import * as crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface AFIPCredentials {
    /** CUIT number (11 digits) - not sensitive, stored as plain text */
    cuit: string;
    /** PEM-encoded certificate */
    certificate: string;
    /** Private key passphrase */
    privateKey: string;
    /** Punto de venta number */
    puntoVenta?: string;
    /** Environment: 'testing' | 'production' */
    environment?: 'testing' | 'production';
}

export interface AFIPCredentialsInput {
    cuit: string;
    certificate?: string;
    privateKey?: string;
    puntoVenta?: string;
    environment?: 'testing' | 'production';
}

export interface EncryptedPayload {
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
    /** AAD hash for context verification */
    aadHash?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONSTANTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const _KEY_LENGTH = 32;
const CURRENT_KEY_VERSION = 1;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENCRYPTION HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Get the master encryption key from environment
 * Falls back to a derived key from DATABASE_URL in development
 */
function getMasterKey(): Buffer {
    const envKey = process.env.AFIP_ENCRYPTION_KEY;

    if (envKey) {
        // Decode from base64 or hex
        if (envKey.length === 64) {
            return Buffer.from(envKey, 'hex');
        } else if (envKey.length === 44) {
            return Buffer.from(envKey, 'base64');
        }
        throw new Error('AFIP_ENCRYPTION_KEY must be 32 bytes in hex (64 chars) or base64 (44 chars)');
    }

    // Development fallback: derive from DATABASE_URL
    // WARNING: Not suitable for production - use proper key management
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error('AFIP_ENCRYPTION_KEY or DATABASE_URL must be set');
    }

    // This is a deterministic but weak derivation - ONLY for development
    if (process.env.NODE_ENV === 'production') {
        console.warn(
            'âš ï¸ SECURITY WARNING: Using derived encryption key in production. Set AFIP_ENCRYPTION_KEY!'
        );
    }

    return crypto
        .createHash('sha256')
        .update(`campotech-afip-dev-key:${dbUrl}`)
        .digest();
}

/**
 * Build AAD (Additional Authenticated Data) from context
 * This binds ciphertext to a specific organization, preventing cross-org access
 */
function buildAAD(orgId: string, purpose: string): Buffer {
    return Buffer.from(`orgId=${orgId}|purpose=${purpose}`, 'utf8');
}

/**
 * Hash AAD for storage and verification
 */
function hashAAD(aad: Buffer): string {
    return crypto.createHash('sha256').update(aad).digest('hex').substring(0, 16);
}

/**
 * Encrypt plaintext using AES-256-GCM
 */
function encrypt(plaintext: string, orgId: string, purpose: string): EncryptedPayload {
    const masterKey = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const aad = buildAAD(orgId, purpose);

    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([
        cipher.update(Buffer.from(plaintext, 'utf8')),
        cipher.final(),
    ]);

    return {
        ciphertext: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        algorithm: ALGORITHM,
        keyVersion: CURRENT_KEY_VERSION,
        aadHash: hashAAD(aad),
    };
}

/**
 * Decrypt encrypted payload using AES-256-GCM
 */
function decrypt(payload: EncryptedPayload, orgId: string, purpose: string): string {
    const masterKey = getMasterKey();
    const iv = Buffer.from(payload.iv, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const aad = buildAAD(orgId, purpose);

    // Verify AAD hash if present
    if (payload.aadHash && hashAAD(aad) !== payload.aadHash) {
        throw new Error('AAD context mismatch - decryption context does not match encryption context');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AFIP CREDENTIALS SERVICE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export class AFIPCredentialsService {
    /**
     * Save or update AFIP credentials for an organization
     *
     * @param orgId - Organization ID
     * @param credentials - AFIP credential data
     */
    async saveCredentials(
        orgId: string,
        credentials: AFIPCredentialsInput
    ): Promise<{ success: boolean; isConfigured: boolean }> {
        // Build the update data
        const updateData: Record<string, unknown> = {
            afipConnectedAt: new Date(),
        };

        // CUIT is not sensitive, store as plain text
        if (credentials.cuit !== undefined) {
            updateData.afipCuit = credentials.cuit;
        }

        // Punto de venta is not sensitive
        if (credentials.puntoVenta !== undefined) {
            updateData.afipPuntoVenta = credentials.puntoVenta;
        }

        // Environment is not sensitive
        if (credentials.environment !== undefined) {
            updateData.afipEnvironment = credentials.environment;
        }

        // Certificate is sensitive - encrypt it
        if (credentials.certificate !== undefined) {
            const encryptedCert = encrypt(credentials.certificate, orgId, 'afip_certificate');
            updateData.afipCertificateEncrypted = JSON.stringify(encryptedCert);
        }

        // Private key is sensitive - encrypt it
        if (credentials.privateKey !== undefined) {
            const encryptedKey = encrypt(credentials.privateKey, orgId, 'afip_private_key');
            updateData.afipPrivateKeyEncrypted = JSON.stringify(encryptedKey);
        }

        await prisma.organization.update({
            where: { id: orgId },
            data: updateData,
        });

        // Check if fully configured
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                afipCuit: true,
                afipCertificateEncrypted: true,
                afipPrivateKeyEncrypted: true,
            },
        });

        const isConfigured = !!(
            org?.afipCuit &&
            org?.afipCertificateEncrypted &&
            org?.afipPrivateKeyEncrypted
        );

        return { success: true, isConfigured };
    }

    /**
     * Get AFIP credentials for an organization
     *
     * @param orgId - Organization ID
     * @returns Decrypted credentials or null if not configured
     */
    async getCredentials(orgId: string): Promise<AFIPCredentials | null> {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                afipCuit: true,
                afipCertificateEncrypted: true,
                afipPrivateKeyEncrypted: true,
                afipPuntoVenta: true,
                afipEnvironment: true,
            },
        });

        if (!org?.afipCuit || !org?.afipCertificateEncrypted || !org?.afipPrivateKeyEncrypted) {
            return null;
        }

        try {
            // Decrypt certificate
            const certPayload: EncryptedPayload = JSON.parse(org.afipCertificateEncrypted);
            const certificate = decrypt(certPayload, orgId, 'afip_certificate');

            // Decrypt private key
            const keyPayload: EncryptedPayload = JSON.parse(org.afipPrivateKeyEncrypted);
            const privateKey = decrypt(keyPayload, orgId, 'afip_private_key');

            return {
                cuit: org.afipCuit,
                certificate,
                privateKey,
                puntoVenta: org.afipPuntoVenta ?? undefined,
                environment: (org.afipEnvironment as 'testing' | 'production') ?? 'testing',
            };
        } catch (error) {
            console.error('Failed to decrypt AFIP credentials:', error);
            throw new Error('Failed to decrypt AFIP credentials');
        }
    }

    /**
     * Check if AFIP is configured for an organization
     */
    async isConfigured(orgId: string): Promise<boolean> {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                afipCuit: true,
                afipCertificateEncrypted: true,
                afipPrivateKeyEncrypted: true,
            },
        });

        return !!(
            org?.afipCuit &&
            org?.afipCertificateEncrypted &&
            org?.afipPrivateKeyEncrypted
        );
    }

    /**
     * Get non-sensitive AFIP configuration info (for display)
     */
    async getConfigurationStatus(orgId: string): Promise<{
        isConfigured: boolean;
        cuit: string | null;
        puntoVenta: string | null;
        environment: string;
        hasCertificate: boolean;
        hasPrivateKey: boolean;
        connectedAt: Date | null;
    }> {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                afipCuit: true,
                afipCertificateEncrypted: true,
                afipPrivateKeyEncrypted: true,
                afipPuntoVenta: true,
                afipEnvironment: true,
                afipConnectedAt: true,
            },
        });

        const hasCertificate = !!org?.afipCertificateEncrypted;
        const hasPrivateKey = !!org?.afipPrivateKeyEncrypted;
        const isConfigured = !!(org?.afipCuit && hasCertificate && hasPrivateKey);

        return {
            isConfigured,
            cuit: org?.afipCuit ?? null,
            puntoVenta: org?.afipPuntoVenta ?? null,
            environment: org?.afipEnvironment ?? 'testing',
            hasCertificate,
            hasPrivateKey,
            connectedAt: org?.afipConnectedAt ?? null,
        };
    }

    /**
     * Delete AFIP credentials for an organization
     */
    async deleteCredentials(orgId: string): Promise<void> {
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                afipCuit: null,
                afipCertificateEncrypted: null,
                afipPrivateKeyEncrypted: null,
                afipPuntoVenta: null,
                afipEnvironment: null,
                afipConnectedAt: null,
            },
        });
    }

    /**
     * Migrate credentials from legacy settings JSONB to encrypted columns
     * This is a one-time migration helper
     */
    async migrateFromLegacySettings(orgId: string): Promise<boolean> {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                settings: true,
                afipCertificateEncrypted: true,
            },
        });

        if (!org) return false;

        // Already migrated
        if (org.afipCertificateEncrypted) {
            return false;
        }

        // Parse settings
        const settings =
            typeof org.settings === 'string' ? JSON.parse(org.settings) : (org.settings as Record<string, unknown>) || {};

        const afipSettings = settings.afip as Record<string, string> | undefined;
        if (!afipSettings?.certificate) {
            return false;
        }

        // Migrate to encrypted storage
        await this.saveCredentials(orgId, {
            cuit: afipSettings.cuit,
            certificate: afipSettings.certificate,
            privateKey: afipSettings.privateKey,
            puntoVenta: afipSettings.puntoVenta,
            environment: afipSettings.environment as 'testing' | 'production',
        });

        // Clear from legacy settings
        delete settings.afip;
        await prisma.organization.update({
            where: { id: orgId },
            data: { settings },
        });

        return true;
    }
}

// Singleton instance
let afipCredentialsService: AFIPCredentialsService | null = null;

/**
 * Get the AFIP credentials service instance
 */
export function getAFIPCredentialsService(): AFIPCredentialsService {
    if (!afipCredentialsService) {
        afipCredentialsService = new AFIPCredentialsService();
    }
    return afipCredentialsService;
}

// Default export for convenience
export default AFIPCredentialsService;
