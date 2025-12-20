'use client';

/**
 * Acknowledgment Modal Component
 * ===============================
 *
 * Modal for displaying and accepting legal acknowledgments.
 * Captures IP address and user agent for audit trail.
 *
 * Features:
 * - Scrollable content for long legal text
 * - Checkbox to confirm agreement
 * - Submit button disabled until checkbox checked
 * - Loading state during submission
 * - Captures device info for compliance records
 */

import { useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, Loader2, AlertCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AcknowledgmentConfig, AcknowledgmentType } from '@/lib/config/acknowledgments';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AcknowledgmentModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The acknowledgment configuration to display */
  acknowledgment: AcknowledgmentConfig;
  /** Callback when modal is closed (without accepting) */
  onClose?: () => void;
  /** Callback when acknowledgment is accepted */
  onAccept: (result: AcknowledgmentResult) => void;
  /** Whether closing is allowed (for blocking acknowledgments) */
  allowClose?: boolean;
  /** Additional class names */
  className?: string;
}

export interface AcknowledgmentResult {
  acknowledgmentType: AcknowledgmentType;
  version: string;
  ipAddress: string | null;
  userAgent: string;
  acceptedAt: Date;
}

interface DeviceInfo {
  ipAddress: string | null;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  language: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AcknowledgmentModal({
  isOpen,
  acknowledgment,
  onClose,
  onAccept,
  allowClose = true,
  className,
}: AcknowledgmentModalProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // DEVICE INFO COLLECTION
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    // Collect device info
    const collectDeviceInfo = async () => {
      let ipAddress: string | null = null;

      // Try to get IP address from a public API
      try {
        const response = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(3000), // 3 second timeout
        });
        const data = await response.json();
        ipAddress = data.ip;
      } catch {
        // IP collection failed, continue without it
        console.log('[Acknowledgment] Could not fetch IP address');
      }

      setDeviceInfo({
        ipAddress,
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
      });
    };

    collectDeviceInfo();
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
      setError(null);
      setHasScrolledToBottom(false);
    }
  }, [isOpen]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCROLL TRACKING
  // ─────────────────────────────────────────────────────────────────────────────

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom =
      target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  }, [hasScrolledToBottom]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMISSION
  // ─────────────────────────────────────────────────────────────────────────────

  const handleAccept = useCallback(async () => {
    if (!isChecked || !deviceInfo) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Call the API to record the acknowledgment
      const response = await fetch('/api/verification/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acknowledgmentType: acknowledgment.type,
          version: acknowledgment.version,
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          deviceInfo: {
            screenWidth: deviceInfo.screenWidth,
            screenHeight: deviceInfo.screenHeight,
            timezone: deviceInfo.timezone,
            language: deviceInfo.language,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al registrar aceptación');
      }

      // Call onAccept callback
      onAccept({
        acknowledgmentType: acknowledgment.type,
        version: acknowledgment.version,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        acceptedAt: new Date(),
      });
    } catch (err) {
      console.error('[Acknowledgment] Error:', err);
      setError(err instanceof Error ? err.message : 'Error al registrar aceptación');
    } finally {
      setIsSubmitting(false);
    }
  }, [isChecked, deviceInfo, acknowledgment, onAccept]);

  // ─────────────────────────────────────────────────────────────────────────────
  // CLOSE HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    if (!allowClose) return;
    onClose?.();
  }, [allowClose, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowClose) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allowClose, handleClose]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // Check if text is long enough to require scrolling
  const isLongText = acknowledgment.text.length > 500;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className={cn(
          'w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden',
          'max-h-[90vh] flex flex-col',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {acknowledgment.title}
              </h2>
              <p className="text-xs text-gray-500">
                Versión {acknowledgment.version}
              </p>
            </div>
          </div>
          {allowClose && (
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div
          className={cn(
            'flex-1 overflow-y-auto px-6 py-4',
            isLongText && 'min-h-[300px]'
          )}
          onScroll={handleScroll}
        >
          {/* Legal text */}
          <div className="prose prose-sm max-w-none text-gray-700">
            {acknowledgment.text.split('\n\n').map((paragraph, index) => (
              <p key={index} className="mb-4 whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Scroll indicator for long text */}
          {isLongText && !hasScrolledToBottom && (
            <div className="sticky bottom-0 left-0 right-0 py-2 text-center bg-gradient-to-t from-white via-white to-transparent">
              <span className="text-xs text-gray-500 animate-pulse">
                Desplazate hacia abajo para continuar
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-center gap-2 text-danger-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-4">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                disabled={isSubmitting || (isLongText && !hasScrolledToBottom)}
                className="sr-only peer"
              />
              <div
                className={cn(
                  'w-5 h-5 border-2 rounded transition-colors',
                  isChecked
                    ? 'bg-primary-600 border-primary-600'
                    : 'bg-white border-gray-300',
                  isLongText && !hasScrolledToBottom && 'opacity-50 cursor-not-allowed',
                  !isSubmitting && !(isLongText && !hasScrolledToBottom) && 'hover:border-primary-500'
                )}
              >
                {isChecked && (
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
            <span
              className={cn(
                'text-sm text-gray-700',
                isLongText && !hasScrolledToBottom && 'text-gray-400'
              )}
            >
              {acknowledgment.checkbox}
            </span>
          </label>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            {allowClose && (
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleAccept}
              disabled={!isChecked || isSubmitting || !deviceInfo}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
                isChecked && !isSubmitting && deviceInfo
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Acepto
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE ACKNOWLEDGMENT CHECKBOX
// ═══════════════════════════════════════════════════════════════════════════════

export interface InlineAcknowledgmentProps {
  /** The acknowledgment configuration */
  acknowledgment: AcknowledgmentConfig;
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Callback when checkbox changes */
  onChange: (checked: boolean) => void;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Inline acknowledgment checkbox for use within forms
 * (e.g., data_accuracy confirmation on document submission)
 */
export function InlineAcknowledgment({
  acknowledgment,
  checked,
  onChange,
  disabled = false,
  error,
  className,
}: InlineAcknowledgmentProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label
        className={cn(
          'flex items-start gap-3 cursor-pointer',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="sr-only peer"
          />
          <div
            className={cn(
              'w-5 h-5 border-2 rounded transition-colors',
              checked
                ? 'bg-primary-600 border-primary-600'
                : 'bg-white border-gray-300',
              error && 'border-danger-500',
              !disabled && 'hover:border-primary-500'
            )}
          >
            {checked && (
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
        <span className="text-sm text-gray-700">{acknowledgment.checkbox}</span>
      </label>
      {error && (
        <p className="text-xs text-danger-600 ml-8">{error}</p>
      )}
    </div>
  );
}

export default AcknowledgmentModal;
