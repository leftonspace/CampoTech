'use client';

import Image from 'next/image';

/**
 * Selfie Capture Component
 * ========================
 *
 * Camera capture component for identity verification.
 * Captures live selfie with face position guidelines.
 * Works on both mobile and desktop.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  RefreshCw,
  X,
  CheckCircle,
  AlertCircle,
  SwitchCamera,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface SelfieCaptureProps {
  /** Callback when photo is captured */
  onCapture: (imageData: Blob) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Whether to show face position guides */
  showGuides?: boolean;
  /** Capture mode: selfie alone or selfie with DNI */
  mode?: 'selfie' | 'selfie_with_dni';
  /** Mirror the video (default: true for selfie) */
  mirrored?: boolean;
  /** Additional class names */
  className?: string;
}

type CameraState = 'idle' | 'requesting' | 'active' | 'captured' | 'error';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function SelfieCapture({
  onCapture,
  onCancel,
  showGuides = true,
  mode = 'selfie',
  mirrored = true,
  className,
}: SelfieCaptureProps) {
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // CAMERA SETUP
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const startCamera = useCallback(async () => {
    setCameraState('requesting');
    setError(null);

    try {
      // Check for camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }

      // Check for multiple cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(cameras.length > 1);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState('active');
    } catch (err) {
      console.error('Camera error:', err);

      let message = 'No se pudo acceder a la cámara';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          message = 'Permiso de cámara denegado. Por favor, habilitá el acceso a la cámara.';
        } else if (err.name === 'NotFoundError') {
          message = 'No se encontró ninguna cámara en el dispositivo';
        } else if (err.name === 'NotReadableError') {
          message = 'La cámara está siendo usada por otra aplicación';
        }
      }

      setError(message);
      setCameraState('error');
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, [stopCamera]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (cameraState === 'active') {
      stopCamera();
      startCamera();
    }
  }, [facingMode, cameraState, stopCamera, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // CAPTURE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Handle mirroring for selfie mode
    if (mirrored && facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Get image data
    const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageUrl);
    setCameraState('captured');

    // Stop the camera while previewing
    stopCamera();
  }, [mirrored, facingMode, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setCameraState('idle');
    startCamera();
  }, [startCamera]);

  const confirmPhoto = useCallback(() => {
    if (!capturedImage) return;

    // Convert base64 to blob
    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        onCapture(blob);
      });
  }, [capturedImage, onCapture]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const guideText =
    mode === 'selfie_with_dni'
      ? 'Sostené tu DNI junto a tu rostro'
      : 'Posicioná tu rostro dentro del óvalo';

  return (
    <div className={cn('relative bg-gray-900 rounded-lg overflow-hidden', className)}>
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera preview / Captured image */}
      <div className="relative aspect-[4/3] bg-black">
        {/* Idle state - Start button */}
        {cameraState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <Camera className="h-8 w-8" />
            </div>
            <p className="text-center text-sm mb-4">
              {mode === 'selfie_with_dni'
                ? 'Tomá una selfie sosteniendo tu DNI junto a tu rostro'
                : 'Tomá una selfie para verificar tu identidad'}
            </p>
            <button
              onClick={startCamera}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
            >
              Iniciar cámara
            </button>
          </div>
        )}

        {/* Requesting permission */}
        {cameraState === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
            <Loader2 className="h-10 w-10 animate-spin mb-4" />
            <p className="text-center text-sm">Solicitando acceso a la cámara...</p>
          </div>
        )}

        {/* Error state */}
        {cameraState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
            <AlertCircle className="h-10 w-10 text-danger-500 mb-4" />
            <p className="text-center text-sm mb-4">{error}</p>
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Video preview */}
        {cameraState === 'active' && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'w-full h-full object-cover',
                mirrored && facingMode === 'user' && 'scale-x-[-1]'
              )}
            />

            {/* Face position guides */}
            {showGuides && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Oval guide */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {mode === 'selfie' ? (
                    <div
                      className="border-2 border-white/50 border-dashed rounded-[50%]"
                      style={{
                        width: '50%',
                        height: '65%',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
                      }}
                    />
                  ) : (
                    <div
                      className="border-2 border-white/50 border-dashed rounded-lg"
                      style={{
                        width: '85%',
                        height: '70%',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
                      }}
                    />
                  )}
                </div>

                {/* Guide text */}
                <div className="absolute bottom-20 left-0 right-0 text-center">
                  <p className="text-white text-sm bg-black/50 py-2 px-4 inline-block rounded-full">
                    {guideText}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Captured preview */}
        {cameraState === 'captured' && capturedImage && (
          <Image
            src={capturedImage}
            alt="Captured selfie"
            width={800}
            height={600}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-900">
        {/* Active camera controls */}
        {cameraState === 'active' && (
          <div className="flex items-center justify-center gap-4">
            {/* Cancel button */}
            {onCancel && (
              <button
                onClick={() => {
                  stopCamera();
                  onCancel();
                }}
                className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Cancelar"
              >
                <X className="h-6 w-6" />
              </button>
            )}

            {/* Capture button */}
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white hover:bg-gray-200 flex items-center justify-center transition-colors"
              title="Capturar foto"
            >
              <div className="w-12 h-12 rounded-full bg-primary-600" />
            </button>

            {/* Switch camera button */}
            {hasMultipleCameras && (
              <button
                onClick={switchCamera}
                className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Cambiar cámara"
              >
                <SwitchCamera className="h-6 w-6" />
              </button>
            )}
          </div>
        )}

        {/* Captured photo controls */}
        {cameraState === 'captured' && (
          <div className="flex items-center justify-center gap-4">
            {/* Retake button */}
            <button
              onClick={retakePhoto}
              className="flex items-center gap-2 px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
              Volver a tomar
            </button>

            {/* Confirm button */}
            <button
              onClick={confirmPhoto}
              className="flex items-center gap-2 px-6 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg font-medium transition-colors"
            >
              <CheckCircle className="h-5 w-5" />
              Usar esta foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SelfieCapture;
