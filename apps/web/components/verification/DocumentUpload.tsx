'use client';

/**
 * Document Upload Component
 * =========================
 *
 * Drag-and-drop file upload component for verification documents.
 * Supports images (jpg, png, webp) and PDF files up to 10MB.
 */

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  File,
  Image,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSubmissionAcknowledgment } from '@/lib/config/acknowledgments';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocumentUploadProps {
  /** Requirement code for the upload */
  requirementCode: string;
  /** User ID for employee documents (optional) */
  userId?: string;
  /** Callback when upload completes successfully */
  onUploadComplete?: (result: UploadResult) => void;
  /** Callback when upload fails */
  onUploadError?: (error: string) => void;
  /** Accepted file types */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Custom label text */
  label?: string;
  /** Custom help text */
  helpText?: string;
  /** Whether to require data accuracy confirmation before upload */
  requireDataAccuracy?: boolean;
}

export interface UploadResult {
  submissionId: string;
  documentUrl?: string;
  path?: string;
}

interface FilePreview {
  file: File;
  preview: string;
  type: 'image' | 'pdf';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,application/pdf';
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

const FILE_ICONS = {
  image: Image,
  pdf: File,
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function DocumentUpload({
  requirementCode,
  userId,
  onUploadComplete,
  onUploadError,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  disabled = false,
  className,
  label = 'Subir documento',
  helpText,
  requireDataAccuracy = true,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dataAccuracyConfirmed, setDataAccuracyConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the data accuracy acknowledgment config
  const dataAccuracyAck = getSubmissionAcknowledgment();

  // ─────────────────────────────────────────────────────────────────────────────
  // FILE VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check size
      if (file.size > maxSize) {
        return `El archivo excede el tamaño máximo de ${Math.round(maxSize / 1024 / 1024)}MB`;
      }

      // Check type
      const allowedTypes = accept.split(',').map((t) => t.trim());
      if (!allowedTypes.includes(file.type)) {
        return 'Tipo de archivo no permitido';
      }

      return null;
    },
    [accept, maxSize]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // FILE HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setErrorMessage(error);
        setUploadStatus('error');
        onUploadError?.(error);
        return;
      }

      // Create preview
      const type = file.type.startsWith('image/') ? 'image' : 'pdf';
      const previewUrl = type === 'image' ? URL.createObjectURL(file) : '';

      setPreview({ file, preview: previewUrl, type });
      setUploadStatus('idle');
      setErrorMessage(null);
    },
    [validateFile, onUploadError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, isUploading, handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  const clearPreview = useCallback(() => {
    if (preview?.preview) {
      URL.revokeObjectURL(preview.preview);
    }
    setPreview(null);
    setUploadStatus('idle');
    setErrorMessage(null);
    setDataAccuracyConfirmed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [preview]);

  // ─────────────────────────────────────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!preview || isUploading) return;

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', preview.file);
      formData.append('requirementCode', requirementCode);
      if (userId) {
        formData.append('userId', userId);
      }

      const response = await fetch('/api/verification/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al subir el documento');
      }

      setUploadStatus('success');
      onUploadComplete?.({
        submissionId: result.submissionId,
        documentUrl: result.documentUrl,
        path: result.path,
      });

      // Clear preview after successful upload
      setTimeout(() => {
        clearPreview();
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(message);
      setUploadStatus('error');
      onUploadError?.(message);
    } finally {
      setIsUploading(false);
    }
  }, [preview, isUploading, requirementCode, userId, onUploadComplete, onUploadError, clearPreview]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const FileIcon = preview ? FILE_ICONS[preview.type] : Upload;

  return (
    <div className={cn('w-full', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Drop zone / Preview area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!preview ? handleClick : undefined}
        className={cn(
          'relative border-2 border-dashed rounded-lg transition-all duration-200',
          !preview && 'cursor-pointer',
          isDragging && 'border-primary-500 bg-primary-50',
          !isDragging && !preview && 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          disabled && 'opacity-50 cursor-not-allowed',
          uploadStatus === 'success' && 'border-success-500 bg-success-50',
          uploadStatus === 'error' && 'border-danger-500 bg-danger-50'
        )}
      >
        {/* No preview - Drop zone */}
        {!preview && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center mb-4',
                isDragging ? 'bg-primary-100' : 'bg-gray-100'
              )}
            >
              <Upload
                className={cn(
                  'h-6 w-6',
                  isDragging ? 'text-primary-600' : 'text-gray-400'
                )}
              />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
            <p className="text-xs text-gray-500">
              Arrastrá un archivo aquí o hacé clic para seleccionar
            </p>
            {helpText && <p className="text-xs text-gray-400 mt-2">{helpText}</p>}
            <p className="text-xs text-gray-400 mt-2">
              JPG, PNG, WebP o PDF • Máximo {Math.round(maxSize / 1024 / 1024)}MB
            </p>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="p-4">
            <div className="flex items-start gap-4">
              {/* Thumbnail / Icon */}
              <div className="flex-shrink-0">
                {preview.type === 'image' && preview.preview ? (
                  <img
                    src={preview.preview}
                    alt="Vista previa"
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {preview.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(preview.file.size / 1024).toFixed(1)} KB
                </p>

                {/* Status message */}
                {uploadStatus === 'success' && (
                  <div className="flex items-center gap-1 mt-2 text-success-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs">Subido correctamente</span>
                  </div>
                )}
                {uploadStatus === 'error' && errorMessage && (
                  <div className="flex items-center gap-1 mt-2 text-danger-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs">{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {/* Upload button */}
                {uploadStatus !== 'success' && (
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || disabled || (requireDataAccuracy && !dataAccuracyConfirmed)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                      'bg-primary-600 text-white hover:bg-primary-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center gap-1.5'
                    )}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Subir
                      </>
                    )}
                  </button>
                )}

                {/* Clear button */}
                <button
                  onClick={clearPreview}
                  disabled={isUploading}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Quitar archivo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Data accuracy acknowledgment checkbox */}
            {requireDataAccuracy && uploadStatus !== 'success' && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className="flex items-start gap-2 cursor-pointer">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={dataAccuracyConfirmed}
                      onChange={(e) => setDataAccuracyConfirmed(e.target.checked)}
                      disabled={isUploading}
                      className="sr-only peer"
                    />
                    <div
                      className={cn(
                        'w-4 h-4 border-2 rounded transition-colors',
                        dataAccuracyConfirmed
                          ? 'bg-primary-600 border-primary-600'
                          : 'bg-white border-gray-300',
                        !isUploading && 'hover:border-primary-500'
                      )}
                    >
                      {dataAccuracyConfirmed && (
                        <svg
                          className="w-full h-full text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-600">
                    {dataAccuracyAck.checkbox}
                  </span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentUpload;
