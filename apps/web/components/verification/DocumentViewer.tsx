'use client';

/**
 * Document Viewer Component
 * =========================
 *
 * Displays uploaded verification documents with zoom, pan, and download.
 * Supports images (with zoom/pan/rotate) and PDFs (embedded viewer).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  X,
  Maximize2,
  Minimize2,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocumentViewerProps {
  /** Document URL or path */
  src: string;
  /** Document filename for download */
  filename?: string;
  /** Document MIME type */
  mimeType?: string;
  /** Alt text for images */
  alt?: string;
  /** Whether to show controls */
  showControls?: boolean;
  /** Whether fullscreen mode is enabled */
  allowFullscreen?: boolean;
  /** Initial zoom level */
  initialZoom?: number;
  /** Callback when closed (for modal usage) */
  onClose?: () => void;
  /** Additional class names */
  className?: string;
}

interface Transform {
  zoom: number;
  rotation: number;
  x: number;
  y: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function DocumentViewer({
  src,
  filename,
  mimeType,
  alt = 'Documento',
  showControls = true,
  allowFullscreen = true,
  initialZoom = 1,
  onClose,
  className,
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transform, setTransform] = useState<Transform>({
    zoom: initialZoom,
    rotation: 0,
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Determine document type
  const isPDF =
    mimeType?.includes('pdf') ||
    src.toLowerCase().endsWith('.pdf') ||
    src.includes('application/pdf');
  const isImage = mimeType?.startsWith('image/') || !isPDF;

  // ─────────────────────────────────────────────────────────────────────────────
  // ZOOM CONTROLS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom + ZOOM_STEP, MAX_ZOOM),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom - ZOOM_STEP, MIN_ZOOM),
    }));
  }, []);

  const handleRotate = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
  }, []);

  const handleReset = useCallback(() => {
    setTransform({
      zoom: initialZoom,
      rotation: 0,
      x: 0,
      y: 0,
    });
  }, [initialZoom]);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAN CONTROLS (for images)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isImage || transform.zoom <= 1) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    },
    [isImage, transform.zoom, transform.x, transform.y]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // FULLSCREEN
  // ─────────────────────────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(() => {
    if (!allowFullscreen) return;

    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [allowFullscreen, isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // DOWNLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'documento';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [src, filename]);

  // ─────────────────────────────────────────────────────────────────────────────
  // KEYBOARD SHORTCUTS
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === 'r') {
        handleRotate();
      } else if (e.key === '0') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleZoomIn, handleZoomOut, handleRotate, handleReset]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-gray-900 rounded-lg overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
    >
      {/* Controls */}
      {showControls && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/50 to-transparent">
          {/* Left controls */}
          <div className="flex items-center gap-1">
            {isImage && (
              <>
                <button
                  onClick={handleZoomOut}
                  disabled={transform.zoom <= MIN_ZOOM}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Alejar (-)"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                <span className="text-white/80 text-sm min-w-[50px] text-center">
                  {Math.round(transform.zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={transform.zoom >= MAX_ZOOM}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Acercar (+)"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-2"
                  title="Rotar (R)"
                >
                  <RotateCw className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Descargar"
            >
              <Download className="h-5 w-5" />
            </button>
            {allowFullscreen && (
              <button
                onClick={toggleFullscreen}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Cerrar (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div
        className={cn(
          'flex items-center justify-center min-h-[300px]',
          isFullscreen ? 'h-screen' : 'h-[400px]',
          isImage && transform.zoom > 1 && 'cursor-move'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Loading */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-4">
            <AlertCircle className="h-10 w-10 text-danger-500 mb-3" />
            <p className="text-sm text-center">{error}</p>
          </div>
        )}

        {/* Image viewer */}
        {isImage && (
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError('No se pudo cargar la imagen');
            }}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom}) rotate(${transform.rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
            className={cn(
              'max-w-full max-h-full object-contain select-none',
              isLoading && 'opacity-0'
            )}
            draggable={false}
          />
        )}

        {/* PDF viewer */}
        {isPDF && (
          <div className="w-full h-full flex flex-col">
            <iframe
              src={`${src}#toolbar=1&navpanes=0`}
              className="w-full flex-1 border-0"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError('No se pudo cargar el PDF');
              }}
              title={alt}
            />
            {/* Fallback for browsers that don't support PDF embedding */}
            <noscript>
              <div className="flex flex-col items-center justify-center h-full text-white p-4">
                <FileText className="h-10 w-10 mb-3" />
                <p className="text-sm mb-3">Vista previa no disponible</p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm"
                >
                  Descargar PDF
                </button>
              </div>
            </noscript>
          </div>
        )}
      </div>

      {/* Filename footer */}
      {filename && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/50 to-transparent">
          <p className="text-white/80 text-sm truncate">{filename}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocumentViewerModalProps extends DocumentViewerProps {
  isOpen: boolean;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  ...props
}: DocumentViewerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-4xl max-h-[90vh]">
        <DocumentViewer {...props} onClose={onClose} />
      </div>
    </div>
  );
}

export default DocumentViewer;
