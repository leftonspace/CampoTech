'use client';

/**
 * Service Type Filter Component
 * =============================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Filter by service type for analytics views.
 */

import { useState, useRef, useEffect } from 'react';
import { Wrench, ChevronDown, X, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface ServiceType {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

interface ServiceTypeFilterProps {
  value: string | string[] | 'all';
  onChange: (value: string | string[] | 'all') => void;
  multiple?: boolean;
  className?: string;
}

// Default service types (can be overridden by API)
const DEFAULT_SERVICE_TYPES: ServiceType[] = [
  { id: 'installation', name: 'Instalación', color: '#3b82f6' },
  { id: 'repair', name: 'Reparación', color: '#ef4444' },
  { id: 'maintenance', name: 'Mantenimiento', color: '#22c55e' },
  { id: 'inspection', name: 'Inspección', color: '#f59e0b' },
  { id: 'consultation', name: 'Consulta', color: '#8b5cf6' },
];

export default function ServiceTypeFilter({
  value,
  onChange,
  multiple = false,
  className = '',
}: ServiceTypeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch service types from API or use defaults
  const { data: serviceTypes = DEFAULT_SERVICE_TYPES } = useQuery<ServiceType[]>({
    queryKey: ['service-types-filter'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/service-types');
        if (!response.ok) return DEFAULT_SERVICE_TYPES;
        const data = await response.json();
        return data.serviceTypes || DEFAULT_SERVICE_TYPES;
      } catch {
        return DEFAULT_SERVICE_TYPES;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayLabel = (): string => {
    if (value === 'all') return 'Todos los servicios';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Seleccionar servicios';
      if (value.length === 1) {
        const service = serviceTypes.find((s) => s.id === value[0]);
        return service?.name || 'Servicio seleccionado';
      }
      return `${value.length} servicios`;
    }
    const service = serviceTypes.find((s) => s.id === value);
    return service?.name || 'Seleccionar servicio';
  };

  const isSelected = (id: string): boolean => {
    if (value === 'all') return false;
    if (Array.isArray(value)) return value.includes(id);
    return value === id;
  };

  const handleSelect = (id: string) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      if (currentValue.includes(id)) {
        const newValue = currentValue.filter((v) => v !== id);
        onChange(newValue.length === 0 ? 'all' : newValue);
      } else {
        onChange([...currentValue, id]);
      }
    } else {
      onChange(id);
      setIsOpen(false);
    }
  };

  const handleSelectAll = () => {
    onChange('all');
    if (!multiple) setIsOpen(false);
  };

  const handleClear = () => {
    onChange('all');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-green-500 focus:border-transparent"
      >
        <Wrench size={16} className="text-gray-500" />
        <span className="text-gray-700">{getDisplayLabel()}</span>
        {value !== 'all' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            <X size={14} className="text-gray-400" />
          </button>
        )}
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-2">
            {/* All option */}
            <button
              onClick={handleSelectAll}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                value === 'all'
                  ? 'bg-green-50 text-green-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {value === 'all' && <Check size={14} />}
              </div>
              <span>Todos los servicios</span>
            </button>

            <div className="border-t border-gray-100 my-1" />

            {/* Service types list */}
            {serviceTypes.map((service) => (
              <button
                key={service.id}
                onClick={() => handleSelect(service.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  isSelected(service.id)
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {isSelected(service.id) && <Check size={14} />}
                </div>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: service.color || '#6b7280' }}
                />
                <span className="truncate">{service.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
