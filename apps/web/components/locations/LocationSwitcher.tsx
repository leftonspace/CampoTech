'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Building2,
  ChevronDown,
  Check,
  MapPin,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  isHeadquarters: boolean;
}

interface LocationSwitcherProps {
  selectedLocationId?: string | null;
  onLocationChange?: (locationId: string | null) => void;
  showAllOption?: boolean;
  className?: string;
}

async function fetchLocations(): Promise<{ success: boolean; data: Location[] }> {
  const response = await fetch('/api/locations?status=active');
  return response.json();
}

export function LocationSwitcher({
  selectedLocationId,
  onLocationChange,
  showAllOption = true,
  className,
}: LocationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['locations-switcher'],
    queryFn: fetchLocations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const locations = data?.data || [];
  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (locationId: string | null) => {
    onLocationChange?.(locationId);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className={cn('h-9 w-40 animate-pulse rounded-md bg-gray-200', className)} />
    );
  }

  if (locations.length === 0) {
    return null;
  }

  // If only one location and no "all" option, don't show switcher
  if (locations.length === 1 && !showAllOption) {
    return null;
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
          'bg-white hover:bg-gray-50 border-gray-200',
          isOpen && 'ring-2 ring-primary-500 ring-offset-1'
        )}
      >
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="max-w-[150px] truncate">
          {selectedLocation?.name || 'Todas las sucursales'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {showAllOption && (
              <button
                onClick={() => handleSelect(null)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50',
                  !selectedLocationId && 'bg-primary-50'
                )}
              >
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="flex-1 text-left">Todas las sucursales</span>
                {!selectedLocationId && (
                  <Check className="h-4 w-4 text-primary-600" />
                )}
              </button>
            )}
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => handleSelect(location.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50',
                  selectedLocationId === location.id && 'bg-primary-50'
                )}
              >
                <MapPin className="h-4 w-4 text-gray-400" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">{location.name}</p>
                  <p className="text-xs text-gray-500">{location.code}</p>
                </div>
                {location.isHeadquarters && (
                  <span className="rounded bg-primary-100 px-1.5 py-0.5 text-xs text-primary-700">
                    HQ
                  </span>
                )}
                {selectedLocationId === location.id && (
                  <Check className="h-4 w-4 text-primary-600" />
                )}
              </button>
            ))}
          </div>
          <div className="border-t px-2 py-2">
            <Link
              href="/dashboard/locations"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              <Plus className="h-4 w-4" />
              Administrar sucursales
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationSwitcher;
