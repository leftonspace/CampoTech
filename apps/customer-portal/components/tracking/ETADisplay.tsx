'use client';

/**
 * ETA Display Component
 * =====================
 *
 * Shows estimated time of arrival with real-time updates.
 */

import { Clock, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ETADisplayProps {
  minutes: number;
  distance?: string;
  updatedAt?: string;
  variant?: 'default' | 'compact' | 'large';
  className?: string;
}

export default function ETADisplay({
  minutes,
  distance,
  updatedAt,
  variant = 'default',
  className = '',
}: ETADisplayProps) {
  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return 'hace unos segundos';
    if (diffSec < 120) return 'hace 1 minuto';
    if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} minutos`;

    return date.toLocaleTimeString('es-AR', { hour: 'numeric', minute: 'numeric' });
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Clock className="w-4 h-4 text-primary-600" />
        <span className="font-semibold text-primary-600">{minutes} min</span>
        {distance && <span className="text-gray-400">({distance})</span>}
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div className={cn('text-center', className)}>
        <p className="text-sm text-gray-500 mb-1">Tiempo estimado de llegada</p>
        <div className="flex items-center justify-center gap-3">
          <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center">
            <Clock className="w-7 h-7 text-primary-600" />
          </div>
          <div className="text-left">
            <p className="text-4xl font-bold text-primary-600">{minutes}</p>
            <p className="text-sm text-gray-500">minutos</p>
          </div>
        </div>
        {distance && (
          <div className="flex items-center justify-center gap-1 mt-2 text-gray-500">
            <Navigation className="w-4 h-4" />
            <span className="text-sm">{distance}</span>
          </div>
        )}
        {updatedAt && (
          <p className="text-xs text-gray-400 mt-2">
            Actualizado {formatRelativeTime(updatedAt)}
          </p>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('bg-white rounded-lg shadow-md px-4 py-3', className)}>
      <p className="text-xs text-gray-500">Tiempo estimado</p>
      <p className="text-2xl font-bold text-primary-600">{minutes} min</p>
      {distance && <p className="text-xs text-gray-500">{distance}</p>}
      {updatedAt && (
        <p className="text-xs text-gray-400 mt-1">
          Actualizado {formatRelativeTime(updatedAt)}
        </p>
      )}
    </div>
  );
}
