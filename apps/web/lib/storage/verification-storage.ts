/**
 * CampoTech Verification Document Storage
 * ========================================
 *
 * Manages document storage for verification system using Supabase Storage.
 * Handles uploads, downloads, and signed URLs for verification documents.
 *
 * Bucket: 'verifications' (private, authenticated access only)
 * Path structure: /{orgId}/{requirementCode}/{timestamp}-{filename}
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const VERIFICATION_BUCKET = 'verifications';

/** Maximum file size in bytes (10MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for uploads */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

/** Allowed file extensions */
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

/** Signed URL expiration in seconds (1 hour) */
export const SIGNED_URL_EXPIRATION = 3600;

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase storage client
 */
export function getStorageClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[VerificationStorage] Supabase credentials not configured');
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  return supabaseClient;
}

/**
 * Check if storage is configured
 */
export function isStorageConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  extension?: string;
  size?: number;
}

export interface VerificationFile {
  path: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate file before upload
 */
export function validateFile(
  file: File | { name: string; type: string; size: number }
): FileValidationResult {
  // Check size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      size: file.size,
    };
  }

  // Check MIME type
  const mimeType = file.type.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido: ${mimeType}. Tipos permitidos: ${ALLOWED_MIME_TYPES.join(', ')}`,
      mimeType,
    };
  }

  // Check extension
  const filename = file.name.toLowerCase();
  const extension = filename.substring(filename.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Extensión de archivo no permitida: ${extension}. Extensiones permitidas: ${ALLOWED_EXTENSIONS.join(', ')}`,
      extension,
    };
  }

  return {
    valid: true,
    mimeType,
    extension,
    size: file.size,
  };
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove directory traversal attempts
  let sanitized = filename.replace(/[/\\]/g, '_');

  // Remove special characters except dots, dashes, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length
  if (sanitized.length > 100) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    sanitized = sanitized.substring(0, 100 - ext.length) + ext;
  }

  return sanitized;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATH GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate storage path for verification document
 * Format: {orgId}/{requirementCode}/{timestamp}-{filename}
 */
export function generateStoragePath(
  organizationId: string,
  requirementCode: string,
  filename: string,
  userId?: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = sanitizeFilename(filename);

  // Include userId in path if provided (for employee documents)
  if (userId) {
    return `${organizationId}/${requirementCode}/${userId}/${timestamp}-${sanitizedFilename}`;
  }

  return `${organizationId}/${requirementCode}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Generate path for selfie verification (paired documents)
 * Format: {orgId}/identity/{userId}/{sessionId}/{type}-{timestamp}.{ext}
 */
export function generateSelfiePath(
  organizationId: string,
  userId: string,
  sessionId: string,
  type: 'dni_front' | 'dni_back' | 'selfie',
  extension: string
): string {
  const timestamp = Date.now();
  return `${organizationId}/identity/${userId}/${sessionId}/${type}-${timestamp}.${extension}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upload verification document
 */
export async function uploadDocument(
  organizationId: string,
  requirementCode: string,
  file: Buffer | Blob,
  filename: string,
  mimeType: string,
  userId?: string
): Promise<UploadResult> {
  const client = getStorageClient();

  if (!client) {
    return { success: false, error: 'Storage client not configured' };
  }

  try {
    const path = generateStoragePath(organizationId, requirementCode, filename, userId);

    const { error: uploadError } = await client.storage
      .from(VERIFICATION_BUCKET)
      .upload(path, file, {
        contentType: mimeType,
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      console.error('[VerificationStorage] Upload failed:', uploadError);
      return { success: false, error: uploadError.message };
    }

    console.log(`[VerificationStorage] Uploaded: ${path}`);

    return {
      success: true,
      path,
    };
  } catch (error) {
    console.error('[VerificationStorage] Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload selfie verification documents (paired upload)
 */
export async function uploadSelfieDocuments(
  organizationId: string,
  userId: string,
  sessionId: string,
  documents: {
    dniFront?: { data: Buffer | Blob; mimeType: string };
    dniBack?: { data: Buffer | Blob; mimeType: string };
    selfie?: { data: Buffer | Blob; mimeType: string };
  }
): Promise<{
  success: boolean;
  paths: { dniFront?: string; dniBack?: string; selfie?: string };
  error?: string;
}> {
  const client = getStorageClient();

  if (!client) {
    return { success: false, paths: {}, error: 'Storage client not configured' };
  }

  const paths: { dniFront?: string; dniBack?: string; selfie?: string } = {};
  const errors: string[] = [];

  try {
    // Upload DNI front
    if (documents.dniFront) {
      const ext = documents.dniFront.mimeType.split('/')[1] || 'jpg';
      const path = generateSelfiePath(organizationId, userId, sessionId, 'dni_front', ext);

      const { error } = await client.storage
        .from(VERIFICATION_BUCKET)
        .upload(path, documents.dniFront.data, {
          contentType: documents.dniFront.mimeType,
          upsert: false,
        });

      if (error) {
        errors.push(`DNI frontal: ${error.message}`);
      } else {
        paths.dniFront = path;
      }
    }

    // Upload DNI back
    if (documents.dniBack) {
      const ext = documents.dniBack.mimeType.split('/')[1] || 'jpg';
      const path = generateSelfiePath(organizationId, userId, sessionId, 'dni_back', ext);

      const { error } = await client.storage
        .from(VERIFICATION_BUCKET)
        .upload(path, documents.dniBack.data, {
          contentType: documents.dniBack.mimeType,
          upsert: false,
        });

      if (error) {
        errors.push(`DNI dorso: ${error.message}`);
      } else {
        paths.dniBack = path;
      }
    }

    // Upload selfie
    if (documents.selfie) {
      const ext = documents.selfie.mimeType.split('/')[1] || 'jpg';
      const path = generateSelfiePath(organizationId, userId, sessionId, 'selfie', ext);

      const { error } = await client.storage
        .from(VERIFICATION_BUCKET)
        .upload(path, documents.selfie.data, {
          contentType: documents.selfie.mimeType,
          upsert: false,
        });

      if (error) {
        errors.push(`Selfie: ${error.message}`);
      } else {
        paths.selfie = path;
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        paths,
        error: errors.join('; '),
      };
    }

    console.log(`[VerificationStorage] Selfie documents uploaded for session: ${sessionId}`);

    return { success: true, paths };
  } catch (error) {
    console.error('[VerificationStorage] Selfie upload error:', error);
    return {
      success: false,
      paths,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD & URL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate signed URL for document access
 */
export async function getSignedUrl(
  path: string,
  expiresIn: number = SIGNED_URL_EXPIRATION
): Promise<string | null> {
  const client = getStorageClient();

  if (!client) {
    console.error('[VerificationStorage] Storage client not configured');
    return null;
  }

  try {
    const { data, error } = await client.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error || !data) {
      console.error('[VerificationStorage] Signed URL generation failed:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('[VerificationStorage] Signed URL error:', error);
    return null;
  }
}

/**
 * Download document as buffer
 */
export async function downloadDocument(path: string): Promise<Buffer | null> {
  const client = getStorageClient();

  if (!client) {
    console.error('[VerificationStorage] Storage client not configured');
    return null;
  }

  try {
    const { data, error } = await client.storage
      .from(VERIFICATION_BUCKET)
      .download(path);

    if (error || !data) {
      console.error('[VerificationStorage] Download failed:', error);
      return null;
    }

    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    console.error('[VerificationStorage] Download error:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHIVE & CLEANUP OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Move document to archive folder (when superseded)
 * Note: Supabase doesn't have a native move, so we copy then delete
 */
export async function archiveDocument(path: string): Promise<boolean> {
  const client = getStorageClient();

  if (!client) {
    return false;
  }

  try {
    // Download the file
    const { data: fileData, error: downloadError } = await client.storage
      .from(VERIFICATION_BUCKET)
      .download(path);

    if (downloadError || !fileData) {
      console.error('[VerificationStorage] Archive download failed:', downloadError);
      return false;
    }

    // Generate archive path
    const archivePath = `_archived/${path}`;

    // Upload to archive location
    const { error: uploadError } = await client.storage
      .from(VERIFICATION_BUCKET)
      .upload(archivePath, fileData, {
        contentType: fileData.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[VerificationStorage] Archive upload failed:', uploadError);
      return false;
    }

    // Delete original (optional - keep for now based on requirements)
    // We're keeping the original for audit purposes
    // const { error: deleteError } = await client.storage
    //   .from(VERIFICATION_BUCKET)
    //   .remove([path]);

    console.log(`[VerificationStorage] Archived: ${path} -> ${archivePath}`);
    return true;
  } catch (error) {
    console.error('[VerificationStorage] Archive error:', error);
    return false;
  }
}

/**
 * List documents for an organization/requirement
 */
export async function listDocuments(
  organizationId: string,
  requirementCode?: string,
  userId?: string
): Promise<VerificationFile[]> {
  const client = getStorageClient();

  if (!client) {
    return [];
  }

  try {
    let path = organizationId;
    if (requirementCode) {
      path += `/${requirementCode}`;
    }
    if (userId) {
      path += `/${userId}`;
    }

    const { data: files, error } = await client.storage
      .from(VERIFICATION_BUCKET)
      .list(path, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error || !files) {
      console.error('[VerificationStorage] List failed:', error);
      return [];
    }

    return files.map((file) => ({
      path: `${path}/${file.name}`,
      filename: file.name,
      mimeType: file.metadata?.mimetype || 'application/octet-stream',
      size: file.metadata?.size || 0,
      createdAt: file.created_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[VerificationStorage] List error:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUCKET MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure verification bucket exists with proper configuration
 */
export async function ensureBucketExists(): Promise<boolean> {
  const client = getStorageClient();

  if (!client) {
    return false;
  }

  try {
    const { data: buckets } = await client.storage.listBuckets();

    if (!buckets?.find((b) => b.name === VERIFICATION_BUCKET)) {
      const { error } = await client.storage.createBucket(VERIFICATION_BUCKET, {
        public: false, // Private - requires authentication
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });

      if (error) {
        console.error('[VerificationStorage] Bucket creation failed:', error);
        return false;
      }

      console.log(`[VerificationStorage] Created bucket: ${VERIFICATION_BUCKET}`);
    }

    return true;
  } catch (error) {
    console.error('[VerificationStorage] Bucket check error:', error);
    return false;
  }
}
