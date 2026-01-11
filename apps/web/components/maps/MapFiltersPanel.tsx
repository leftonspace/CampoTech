'use client';

import { useState } from 'react';
import {
  Filter,
  Search,
  X,
  ChevronDown,
} from 'lucide-react';

export interface MapFilters {
  search: string;
  technicianId: string | null;
  zone: string | null;
  customerHasActiveJob: boolean;
  customerNoRecentJob: boolean;
  showCustomersOnly: boolean;
  showTechniciansOnly: boolean;
  showJobsOnly: boolean;
}

interface Technician {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  code: string;
}

interface MapFiltersPanelProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  technicians: Technician[];
  zones: Zone[];
  onClearFilters: () => void;
}

export function MapFiltersPanel({
  filters,
  onFiltersChange,
  technicians,
  zones,
  onClearFilters,
}: MapFiltersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateFilter = <K extends keyof MapFilters>(
    key: K,
    value: MapFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    filters.search ||
    filters.technicianId ||
    filters.zone ||
    filters.customerHasActiveJob ||
    filters.customerNoRecentJob ||
    filters.showCustomersOnly ||
    filters.showTechniciansOnly ||
    filters.showJobsOnly;

  return (
    <div className="bg-white rounded-lg shadow-md w-72 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 hover:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtros</span>
          {hasActiveFilters && (
            <span className="h-2 w-2 rounded-full bg-primary-500" />
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="Cliente, técnico, trabajo..."
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
              {filters.search && (
                <button
                  onClick={() => updateFilter('search', '')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                >
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Technician Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Técnico
            </label>
            <select
              value={filters.technicianId || ''}
              onChange={(e) =>
                updateFilter('technicianId', e.target.value || null)
              }
              className="w-full py-1.5 px-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos los técnicos</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
          </div>

          {/* Zone Filter */}
          {zones.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Zona
              </label>
              <select
                value={filters.zone || ''}
                onChange={(e) => updateFilter('zone', e.target.value || null)}
                className="w-full py-1.5 px-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Todas las zonas</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} ({zone.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Filters */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Filtros rápidos
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.customerHasActiveJob}
                  onChange={(e) =>
                    updateFilter('customerHasActiveJob', e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Clientes con trabajo hoy
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.customerNoRecentJob}
                  onChange={(e) =>
                    updateFilter('customerNoRecentJob', e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Sin trabajo reciente (&gt;30 días)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showCustomersOnly}
                  onChange={(e) =>
                    updateFilter('showCustomersOnly', e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Solo clientes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showTechniciansOnly}
                  onChange={(e) =>
                    updateFilter('showTechniciansOnly', e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Solo técnicos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showJobsOnly}
                  onChange={(e) =>
                    updateFilter('showJobsOnly', e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Solo trabajos de hoy
                </span>
              </label>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="w-full py-1.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MapFiltersPanel;
