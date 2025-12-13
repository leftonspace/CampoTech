'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Building2, MapPin } from 'lucide-react';

interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  isHeadquarters: boolean;
}

interface LocationSelectorProps {
  value?: string;
  onChange: (locationId: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showInactive?: boolean;
  excludeIds?: string[];
}

async function fetchLocations(showInactive: boolean): Promise<{ success: boolean; data: Location[] }> {
  const url = showInactive ? '/api/locations' : '/api/locations?status=active';
  const response = await fetch(url);
  return response.json();
}

export function LocationSelector({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Seleccionar zona',
  className,
  showInactive = false,
  excludeIds = [],
}: LocationSelectorProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['locations-selector', showInactive],
    queryFn: () => fetchLocations(showInactive),
    staleTime: 5 * 60 * 1000,
  });

  const locations = (data?.data || []).filter((l) => !excludeIds.includes(l.id));

  if (isLoading) {
    return (
      <div className={cn('h-10 w-full animate-pulse rounded-md bg-gray-200', className)} />
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className={cn('input', className)}
    >
      <option value="">{placeholder}</option>
      {locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.name} ({location.code})
          {location.isHeadquarters ? ' - HQ' : ''}
          {!location.isActive ? ' (Inactiva)' : ''}
        </option>
      ))}
    </select>
  );
}

// Card-style selector for more visual selection
interface LocationCardSelectorProps {
  value?: string;
  onChange: (locationId: string) => void;
  className?: string;
  showInactive?: boolean;
}

export function LocationCardSelector({
  value,
  onChange,
  className,
  showInactive = false,
}: LocationCardSelectorProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['locations-card-selector', showInactive],
    queryFn: () => fetchLocations(showInactive),
    staleTime: 5 * 60 * 1000,
  });

  const locations = data?.data || [];

  if (isLoading) {
    return (
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {locations.map((location) => (
        <button
          key={location.id}
          onClick={() => onChange(location.id)}
          className={cn(
            'flex items-start gap-3 rounded-lg border p-4 text-left transition-all',
            value === location.id
              ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              value === location.id
                ? 'bg-primary-100 text-primary-600'
                : 'bg-gray-100 text-gray-500'
            )}
          >
            {location.isHeadquarters ? (
              <Building2 className="h-5 w-5" />
            ) : (
              <MapPin className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'font-medium truncate',
                value === location.id ? 'text-primary-900' : 'text-gray-900'
              )}
            >
              {location.name}
            </p>
            <p className="text-sm text-gray-500">{location.code}</p>
            {location.isHeadquarters && (
              <span className="mt-1 inline-block rounded bg-primary-100 px-1.5 py-0.5 text-xs text-primary-700">
                Casa matriz
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default LocationSelector;
