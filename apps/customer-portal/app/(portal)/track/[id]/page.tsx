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
import dynamic from 'next/dynamic';
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
import { StatusTimeline, TechnicianCard } from '@/components/tracking';

// Dynamic import for map to avoid SSR issues
const LiveMap = dynamic(() => import('@/components/tracking/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  ),
});

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
      <div className="mb-4">
        <LiveMap
          technicianLocation={technicianLocation}
          customerLocation={job.latitude && job.longitude ? { lat: job.latitude, lng: job.longitude } : undefined}
          eta={eta}
          onRefresh={loadInitialData}
          className="border border-gray-200"
        />
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
        <TechnicianCard
          name={job.technicianName}
          phone={job.technicianPhone}
          className="mb-4"
        />
      )}

      {/* Status timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Historial</h3>
        <StatusTimeline history={statusHistory} />
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
