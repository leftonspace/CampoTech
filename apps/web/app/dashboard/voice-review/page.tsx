'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { searchMatchesAny } from '@/lib/utils';
import {
  Mic,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  RefreshCw,
  ChevronRight,
  Filter,
  Search,
  User,
  MapPin,
  Wrench,
  Calendar,
} from 'lucide-react';

interface VoiceReviewItem {
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
  };
  extraction?: {
    customerName?: { value: string; confidence: number };
    customerAddress?: { value: string; confidence: number };
    serviceType?: { value: string; confidence: number };
    description?: { value: string; confidence: number };
    urgency?: { value: string; confidence: number };
    overallConfidence: number;
  };
  routing?: {
    route: string;
    reason: string;
  };
  priority: number;
}

export default function VoiceReviewPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('awaiting_review');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['voice-review-queue', statusFilter],
    queryFn: () => api.voice.reviewQueue.list({ status: statusFilter }),
  });

  const items = (data?.data || []) as VoiceReviewItem[];

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    return searchMatchesAny(
      [item.customerPhone, item.customerName, item.transcription?.text],
      searchQuery
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'awaiting_review':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-warning-50 text-warning-700">
            <Clock className="h-3 w-3" />
            Pendiente
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success-50 text-success-700">
            <CheckCircle className="h-3 w-3" />
            Completado
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-danger-50 text-danger-700">
            <AlertCircle className="h-3 w-3" />
            Fallido
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: number) => {
    if (priority <= 2) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-danger-100 text-danger-700">
          Alta
        </span>
      );
    }
    if (priority <= 4) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-warning-100 text-warning-700">
          Media
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
        Normal
      </span>
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revision de Voz</h1>
          <p className="text-gray-500">
            Mensajes de voz que requieren revision manual
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {filteredItems.length} pendientes
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por telefono, nombre o transcripcion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="awaiting_review">Pendientes</option>
          <option value="completed">Completados</option>
          <option value="failed">Fallidos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {/* Review Queue */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            Cargando cola de revision...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Mic className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay mensajes pendientes de revision</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/voice-review/${item.id}`}
              className="block"
            >
              <div className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Audio indicator */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <Mic className="h-6 w-6 text-primary-600" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {item.customerName || item.customerPhone}
                      </span>
                      {getStatusBadge(item.status)}
                      {getPriorityBadge(item.priority)}
                    </div>

                    {/* Transcription preview */}
                    {item.transcription && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        &quot;{item.transcription.text}&quot;
                      </p>
                    )}

                    {/* Extracted data preview */}
                    {item.extraction && (
                      <div className="flex flex-wrap gap-3 text-sm">
                        {item.extraction.serviceType?.value && (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            <Wrench className="h-3 w-3" />
                            {getServiceTypeLabel(item.extraction.serviceType.value)}
                          </span>
                        )}
                        {item.extraction.customerAddress?.value && (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            <MapPin className="h-3 w-3" />
                            {item.extraction.customerAddress.value.slice(0, 30)}...
                          </span>
                        )}
                        {item.extraction.urgency?.value === 'urgente' && (
                          <span className="inline-flex items-center gap-1 text-danger-600 font-medium">
                            <AlertCircle className="h-3 w-3" />
                            Urgente
                          </span>
                        )}
                      </div>
                    )}

                    {/* Routing reason */}
                    {item.routing?.reason && (
                      <p className="text-xs text-warning-600 mt-2">
                        {item.routing.reason}
                      </p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm text-gray-500 mb-1">
                      {formatDuration(item.audioDuration)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(item.createdAt).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 mt-2 ml-auto" />
                  </div>
                </div>

                {/* Confidence bar */}
                {item.extraction && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Confianza de extraccion</span>
                      <span>{Math.round(item.extraction.overallConfidence * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getConfidenceColor(item.extraction.overallConfidence)}`}
                        style={{ width: `${item.extraction.overallConfidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function getServiceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    instalacion_split: 'Instalacion Split',
    reparacion_split: 'Reparacion Split',
    mantenimiento_split: 'Mantenimiento Split',
    instalacion_calefactor: 'Instalacion Calefactor',
    reparacion_calefactor: 'Reparacion Calefactor',
    mantenimiento_calefactor: 'Mantenimiento Calefactor',
    otro: 'Otro',
  };
  return labels[type] || type;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-success-500';
  if (confidence >= 0.6) return 'bg-warning-500';
  return 'bg-danger-500';
}
