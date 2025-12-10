'use client';

/**
 * Status Timeline Component
 * =========================
 *
 * Visual timeline showing job status history.
 */

import {
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Truck,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusEntry {
  status: string;
  timestamp: string;
  note?: string;
}

interface StatusTimelineProps {
  history: StatusEntry[];
  className?: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: any }
> = {
  scheduled: {
    label: 'Programado',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: Calendar,
  },
  confirmed: {
    label: 'Confirmado',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: CheckCircle,
  },
  en_route: {
    label: 'En camino',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: Truck,
  },
  arrived: {
    label: 'Llegó',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: MapPin,
  },
  in_progress: {
    label: 'En servicio',
    color: 'text-primary-600',
    bgColor: 'bg-primary-100',
    icon: Clock,
  },
  completed: {
    label: 'Completado',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
  issue: {
    label: 'Problema',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: AlertCircle,
  },
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('es-AR', {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'short',
  });
}

export default function StatusTimeline({ history, className = '' }: StatusTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">El historial aparecerá aquí</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {history.map((entry, index) => {
        const config = statusConfig[entry.status] || statusConfig.scheduled;
        const Icon = config.icon;
        const isFirst = index === 0;
        const isLast = index === history.length - 1;

        return (
          <div key={`${entry.status}-${entry.timestamp}`} className="flex gap-3">
            {/* Timeline line and dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                  isFirst ? config.bgColor : 'bg-gray-100'
                )}
              >
                <Icon
                  className={cn('w-4 h-4', isFirst ? config.color : 'text-gray-400')}
                />
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
              <p
                className={cn(
                  'font-medium',
                  isFirst ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                {config.label}
              </p>
              <p className="text-xs text-gray-400">{formatTimestamp(entry.timestamp)}</p>
              {entry.note && (
                <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                  {entry.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
