'use client';

/**
 * Technician Filter Component
 * ===========================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Filter by technician for analytics views.
 */

import { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, X, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { searchMatches } from '@/lib/utils';

interface Technician {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
}

interface TechnicianFilterProps {
  value: string | string[] | 'all';
  onChange: (value: string | string[] | 'all') => void;
  multiple?: boolean;
  className?: string;
}

export default function TechnicianFilter({
  value,
  onChange,
  multiple = false,
  className = '',
}: TechnicianFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch technicians
  const { data: technicians = [], isLoading } = useQuery<Technician[]>({
    queryKey: ['technicians-filter'],
    queryFn: async () => {
      const response = await fetch('/api/users?role=technician');
      if (!response.ok) return [];
      const data = await response.json();
      return data.users || [];
    },
    staleTime: 5 * 60 * 1000,
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

  const filteredTechnicians = technicians.filter((tech) =>
    searchMatches(tech.name, search)
  );

  const getDisplayLabel = (): string => {
    if (value === 'all') return 'Todos los técnicos';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Seleccionar técnicos';
      if (value.length === 1) {
        const tech = technicians.find((t) => t.id === value[0]);
        return tech?.name || 'Técnico seleccionado';
      }
      return `${value.length} técnicos`;
    }
    const tech = technicians.find((t) => t.id === value);
    return tech?.name || 'Seleccionar técnico';
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
        <User size={16} className="text-gray-500" />
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
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              placeholder="Buscar técnico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto p-2">
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
              <span>Todos los técnicos</span>
            </button>

            {/* Loading */}
            {isLoading && (
              <div className="px-3 py-4 text-center text-gray-400 text-sm">
                Cargando...
              </div>
            )}

            {/* Technicians list */}
            {filteredTechnicians.map((tech) => (
              <button
                key={tech.id}
                onClick={() => handleSelect(tech.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  isSelected(tech.id)
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {isSelected(tech.id) && <Check size={14} />}
                </div>
                {tech.avatar ? (
                  <img src={tech.avatar} alt={tech.name} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-green-700">
                      {tech.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="truncate">{tech.name}</span>
              </button>
            ))}

            {filteredTechnicians.length === 0 && !isLoading && (
              <div className="px-3 py-4 text-center text-gray-400 text-sm">
                No se encontraron técnicos
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
