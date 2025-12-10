'use client';

/**
 * Live Tracking Page
 * ==================
 *
 * Real-time tracking of technician location and job status.
 * Uses WebSocket for live updates.
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Clock,
  User,
  Phone,
  Navigation,
  CheckCircle,
  Truck,
  Calendar,
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatDate, cn } from '@/lib/utils';

interface TrackingData {
  job: any;
  technicianLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  eta?: {
    minutes: number;
    distance: string;
    updatedAt: string;
  };
  statusHistory: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: 'Programado', color: 'bg-gray-100 text-gray-700', icon: Calendar },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  en_route: { label: 'En camino', color: 'bg-yellow-100 text-yellow-700', icon: Truck },
  arrived: { label: 'Llegó', color: 'bg-purple-100 text-purple-700', icon: MapPin },
  in_progress: { label: 'En servicio', color: 'bg-primary-100 text-primary-700', icon: Clock },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

export default function LiveTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);

  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    loadInitialData();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [params.id]);

  const loadInitialData = async () => {
    setIsLoading(true);
    const result = await customerApi.getJobTracking(params.id as string);

    if (result.success && result.data) {
      setTrackingData(result.data);
    } else {
      setError(result.error?.message || 'Error al cargar la información');
    }
    setIsLoading(false);
  };

  const connectWebSocket = () => {
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
      const ws = new WebSocket(`${wsUrl}/tracking/${params.id}`);

      ws.onopen = () => {
        console.log('[Tracking] WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {
          console.error('[Tracking] Error parsing message:', e);
        }
      };

      ws.onclose = () => {
        console.log('[Tracking] WebSocket disconnected');
        setIsConnected(false);
        // Try to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error('[Tracking] WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[Tracking] Failed to connect WebSocket:', e);
    }
  };

  const handleWebSocketMessage = (data: any) => {
    setLastUpdate(new Date());

    switch (data.type) {
      case 'location_update':
        setTrackingData((prev) =>
          prev
            ? {
                ...prev,
                technicianLocation: {
                  lat: data.lat,
                  lng: data.lng,
                  updatedAt: data.timestamp,
                },
              }
            : null
        );
        break;

      case 'eta_update':
        setTrackingData((prev) =>
          prev
            ? {
                ...prev,
                eta: {
                  minutes: data.minutes,
                  distance: data.distance,
                  updatedAt: data.timestamp,
                },
              }
            : null
        );
        break;

      case 'status_update':
        setTrackingData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            job: { ...prev.job, status: data.status },
            statusHistory: [
              { status: data.status, timestamp: data.timestamp, note: data.note },
              ...prev.statusHistory,
            ],
          };
        });
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600 mb-4">{error || 'No se encontró la información'}</p>
        <button onClick={() => router.push('/track')} className="btn-primary">
          Volver al seguimiento
        </button>
      </div>
    );
  }

  const { job, technicianLocation, eta, statusHistory } = trackingData;
  const currentStatus = statusConfig[job.status] || statusConfig.scheduled;
  const CurrentIcon = currentStatus.icon;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <button
          onClick={() => router.push('/track')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{job.serviceType}</h1>
            <p className="text-sm text-gray-500">{job.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )}
            />
            <span className="text-xs text-gray-500">
              {isConnected ? 'En vivo' : 'Reconectando...'}
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="h-64 bg-gradient-to-br from-gray-100 to-gray-200 relative">
          {/* Map placeholder - In production, integrate with Google Maps or Mapbox */}
          <div className="absolute inset-0 flex items-center justify-center">
            {technicianLocation ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg">
                  <Truck className="w-8 h-8 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  Ubicación del técnico
                </p>
                <p className="text-xs text-gray-500">
                  Actualizado {formatRelativeTime(technicianLocation.updatedAt)}
                </p>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <MapPin className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">Esperando ubicación...</p>
              </div>
            )}
          </div>

          {/* ETA overlay */}
          {eta && (
            <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md px-4 py-2">
              <p className="text-xs text-gray-500">Tiempo estimado</p>
              <p className="text-2xl font-bold text-primary-600">{eta.minutes} min</p>
              <p className="text-xs text-gray-500">{eta.distance}</p>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={loadInitialData}
            className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-2 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Current status */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center', currentStatus.color.split(' ')[0])}>
            <CurrentIcon className={cn('w-7 h-7', currentStatus.color.split(' ')[1])} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{currentStatus.label}</p>
            <p className="text-sm text-gray-500">
              {job.status === 'en_route' && eta
                ? `Llegada en aproximadamente ${eta.minutes} minutos`
                : job.status === 'in_progress'
                ? 'El técnico está trabajando en tu servicio'
                : job.status === 'arrived'
                ? 'El técnico llegó a tu ubicación'
                : 'Servicio programado'}
            </p>
          </div>
        </div>
      </div>

      {/* Technician info */}
      {job.technicianName && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Tu técnico</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{job.technicianName}</p>
                <p className="text-sm text-gray-500">Técnico certificado</p>
              </div>
            </div>
            {job.technicianPhone && (
              <a
                href={`tel:${job.technicianPhone}`}
                className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors"
              >
                <Phone className="w-5 h-5 text-green-600" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Status timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Historial</h3>
        <div className="space-y-4">
          {statusHistory.length > 0 ? (
            statusHistory.map((entry, index) => {
              const config = statusConfig[entry.status] || statusConfig.scheduled;
              const EntryIcon = config.icon;

              return (
                <div key={index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        index === 0 ? config.color.split(' ')[0] : 'bg-gray-100'
                      )}
                    >
                      <EntryIcon
                        className={cn(
                          'w-4 h-4',
                          index === 0 ? config.color.split(' ')[1] : 'text-gray-400'
                        )}
                      />
                    </div>
                    {index < statusHistory.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p
                      className={cn(
                        'font-medium',
                        index === 0 ? 'text-gray-900' : 'text-gray-500'
                      )}
                    >
                      {config.label}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(entry.timestamp, {
                        hour: 'numeric',
                        minute: 'numeric',
                      })}
                    </p>
                    {entry.note && (
                      <p className="text-sm text-gray-600 mt-1">{entry.note}</p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              El historial aparecerá aquí
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/support/new?job=${job.id}`}
          className="btn-outline flex-1 flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          Contactar soporte
        </Link>
        {technicianLocation && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            Abrir en Maps
          </a>
        )}
      </div>

      {/* Last update indicator */}
      {lastUpdate && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Última actualización: {formatDate(lastUpdate.toISOString(), {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'hace unos segundos';
  if (diffSec < 120) return 'hace 1 minuto';
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} minutos`;

  return formatDate(dateStr, { hour: 'numeric', minute: 'numeric' });
}
