'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  CheckCircle,
  XCircle,
  Edit3,
  User,
  Phone,
  MapPin,
  Wrench,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface VoiceMessageDetail {
  id: string;
  waMessageId: string;
  customerPhone: string;
  customerId?: string;
  customerName?: string;
  audioDuration: number;
  audioUrl: string;
  status: string;
  createdAt: string;
  transcription?: {
    text: string;
    confidence: number;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  extraction?: {
    customerName?: { value: string; confidence: number; source: string };
    customerPhone?: { value: string; confidence: number; source: string };
    customerAddress?: { value: string; confidence: number; source: string };
    serviceType?: { value: string; confidence: number; source: string };
    description?: { value: string; confidence: number; source: string };
    urgency?: { value: string; confidence: number; source: string };
    preferredDate?: { value: string; confidence: number; source: string };
    preferredTimeSlot?: { value: string; confidence: number; source: string };
    notes?: { value: string; confidence: number; source: string };
    overallConfidence: number;
    requiresReview: boolean;
    reviewReason?: string;
  };
  routing?: {
    route: string;
    reason: string;
  };
}

export default function VoiceReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['voice-message', params.id],
    queryFn: () => api.voice.messages.get(params.id as string),
  });

  const message = data?.data as VoiceMessageDetail | undefined;

  const approveMutation = useMutation({
    mutationFn: () =>
      api.voice.review.submit(params.id as string, {
        action: 'approve',
        notes: reviewNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-review-queue'] });
      router.push('/dashboard/voice-review');
    },
  });

  const editMutation = useMutation({
    mutationFn: () =>
      api.voice.review.submit(params.id as string, {
        action: 'edit',
        corrections: editedData,
        notes: reviewNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-review-queue'] });
      router.push('/dashboard/voice-review');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      api.voice.review.submit(params.id as string, {
        action: 'reject',
        notes: reviewNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-review-queue'] });
      router.push('/dashboard/voice-review');
    },
  });

  // Audio controls
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Mensaje no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/voice-review"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revisar mensaje de voz</h1>
          <p className="text-gray-500">
            De {message.customerName || message.customerPhone}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column - Audio & Transcription */}
        <div className="space-y-6">
          {/* Audio Player */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Audio</h2>

            <audio
              ref={audioRef}
              src={message.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Player controls */}
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => handleSeek(Math.max(0, currentTime - 5))}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded"
              >
                <SkipBack className="h-5 w-5" />
              </button>

              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-1" />
                )}
              </button>

              <button
                onClick={() => handleSeek(Math.min(message.audioDuration, currentTime + 5))}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded"
              >
                <SkipForward className="h-5 w-5" />
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded"
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={message.audioDuration}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(message.audioDuration)}</span>
              </div>
            </div>
          </div>

          {/* Transcription */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Transcripcion</h2>
              {message.transcription && (
                <span className="text-sm text-gray-500">
                  Confianza: {Math.round(message.transcription.confidence * 100)}%
                </span>
              )}
            </div>

            {message.transcription ? (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {message.transcription.text}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">No hay transcripcion disponible</p>
            )}

            {/* Segments */}
            {message.transcription?.segments && message.transcription.segments.length > 1 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Segmentos:</p>
                {message.transcription.segments.map((segment, i) => (
                  <button
                    key={i}
                    onClick={() => handleSeek(segment.start)}
                    className="block w-full text-left p-2 text-sm hover:bg-gray-100 rounded"
                  >
                    <span className="text-gray-400">{formatTime(segment.start)}</span>
                    <span className="ml-2 text-gray-700">{segment.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column - Extraction & Actions */}
        <div className="space-y-6">
          {/* Extracted Data */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Datos extraidos</h2>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="btn-outline text-sm"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                {isEditing ? 'Cancelar' : 'Editar'}
              </button>
            </div>

            {message.extraction && (
              <div className="space-y-4">
                <ExtractedField
                  icon={<User className="h-4 w-4" />}
                  label="Nombre"
                  field={message.extraction.customerName}
                  isEditing={isEditing}
                  value={editedData.customerName}
                  onChange={(v) => setEditedData({ ...editedData, customerName: v })}
                />

                <ExtractedField
                  icon={<Phone className="h-4 w-4" />}
                  label="Telefono"
                  field={message.extraction.customerPhone}
                  isEditing={isEditing}
                  value={editedData.customerPhone}
                  onChange={(v) => setEditedData({ ...editedData, customerPhone: v })}
                />

                <ExtractedField
                  icon={<MapPin className="h-4 w-4" />}
                  label="Direccion"
                  field={message.extraction.customerAddress}
                  isEditing={isEditing}
                  value={editedData.customerAddress}
                  onChange={(v) => setEditedData({ ...editedData, customerAddress: v })}
                />

                <ExtractedField
                  icon={<Wrench className="h-4 w-4" />}
                  label="Tipo de servicio"
                  field={message.extraction.serviceType}
                  isEditing={isEditing}
                  value={editedData.serviceType}
                  onChange={(v) => setEditedData({ ...editedData, serviceType: v })}
                  options={[
                    { value: 'instalacion_split', label: 'Instalacion Split' },
                    { value: 'reparacion_split', label: 'Reparacion Split' },
                    { value: 'mantenimiento_split', label: 'Mantenimiento Split' },
                    { value: 'instalacion_calefactor', label: 'Instalacion Calefactor' },
                    { value: 'reparacion_calefactor', label: 'Reparacion Calefactor' },
                    { value: 'mantenimiento_calefactor', label: 'Mantenimiento Calefactor' },
                    { value: 'otro', label: 'Otro' },
                  ]}
                />

                <ExtractedField
                  icon={<FileText className="h-4 w-4" />}
                  label="Descripcion"
                  field={message.extraction.description}
                  isEditing={isEditing}
                  value={editedData.description}
                  onChange={(v) => setEditedData({ ...editedData, description: v })}
                  multiline
                />

                <ExtractedField
                  icon={<AlertCircle className="h-4 w-4" />}
                  label="Urgencia"
                  field={message.extraction.urgency}
                  isEditing={isEditing}
                  value={editedData.urgency}
                  onChange={(v) => setEditedData({ ...editedData, urgency: v })}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'urgente', label: 'Urgente' },
                    { value: 'programado', label: 'Programado' },
                  ]}
                />

                <ExtractedField
                  icon={<Calendar className="h-4 w-4" />}
                  label="Fecha preferida"
                  field={message.extraction.preferredDate}
                  isEditing={isEditing}
                  value={editedData.preferredDate}
                  onChange={(v) => setEditedData({ ...editedData, preferredDate: v })}
                />

                <ExtractedField
                  icon={<Clock className="h-4 w-4" />}
                  label="Horario preferido"
                  field={message.extraction.preferredTimeSlot}
                  isEditing={isEditing}
                  value={editedData.preferredTimeSlot}
                  onChange={(v) => setEditedData({ ...editedData, preferredTimeSlot: v })}
                />

                {/* Overall confidence */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Confianza general</span>
                    <span className="font-medium">
                      {Math.round(message.extraction.overallConfidence * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getConfidenceColor(message.extraction.overallConfidence)}`}
                      style={{ width: `${message.extraction.overallConfidence * 100}%` }}
                    />
                  </div>
                </div>

                {/* Review reason */}
                {message.extraction.reviewReason && (
                  <div className="p-3 bg-warning-50 rounded-lg">
                    <p className="text-sm text-warning-700">
                      <strong>Motivo de revision:</strong> {message.extraction.reviewReason}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Review Notes */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notas de revision</h2>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Agrega notas sobre esta revision (opcional)..."
              className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className="flex-1 btn-outline text-danger-600 border-danger-300 hover:bg-danger-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rechazar
            </button>

            {isEditing ? (
              <button
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending}
                className="flex-1 btn-primary"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Guardar y crear trabajo
              </button>
            ) : (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex-1 btn-primary"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprobar y crear trabajo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ExtractedFieldProps {
  icon: React.ReactNode;
  label: string;
  field?: { value: string; confidence: number; source: string };
  isEditing: boolean;
  value?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  options?: Array<{ value: string; label: string }>;
}

function ExtractedField({
  icon,
  label,
  field,
  isEditing,
  value,
  onChange,
  multiline,
  options,
}: ExtractedFieldProps) {
  const displayValue = value ?? field?.value ?? '';

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {field && !isEditing && (
            <span
              className={`text-xs ${
                field.confidence >= 0.8
                  ? 'text-success-600'
                  : field.confidence >= 0.6
                  ? 'text-warning-600'
                  : 'text-danger-600'
              }`}
            >
              {Math.round(field.confidence * 100)}%
            </span>
          )}
        </div>

        {isEditing ? (
          options ? (
            <select
              value={displayValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Seleccionar...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : multiline ? (
            <textarea
              value={displayValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 border rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          ) : (
            <input
              type="text"
              value={displayValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          )
        ) : (
          <p className="text-gray-900">{displayValue || '-'}</p>
        )}
      </div>
    </div>
  );
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-success-500';
  if (confidence >= 0.6) return 'bg-warning-500';
  return 'bg-danger-500';
}
