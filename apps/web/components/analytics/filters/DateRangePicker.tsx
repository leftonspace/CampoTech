'use client';

/**
 * Date Range Picker Component
 * ===========================
 *
 * Phase 10.4: Analytics Dashboard UI
 * Custom date range selector with presets.
 */

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'ytd' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  value: DateRangePreset | DateRange;
  onChange: (value: DateRangePreset | DateRange) => void;
  showCustom?: boolean;
  className?: string;
}

const PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'week', label: 'Íšltima semana' },
  { value: 'month', label: 'Íšltimo mes' },
  { value: 'quarter', label: 'Íšltimo trimestre' },
  { value: 'year', label: 'Íšltimo año' },
  { value: 'ytd', label: 'Este año' },
];

export default function DateRangePicker({
  value,
  onChange,
  showCustom = true,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    if (typeof value === 'string') {
      const preset = PRESET_OPTIONS.find((p) => p.value === value);
      return preset?.label || value;
    }
    return `${formatDate(value.start)} - ${formatDate(value.end)}`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const handlePresetSelect = (preset: DateRangePreset) => {
    onChange(preset);
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({
        start: new Date(customStart),
        end: new Date(customEnd),
      });
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-green-500 focus:border-transparent"
      >
        <Calendar size={16} className="text-gray-500" />
        <span className="text-gray-700">{getDisplayLabel()}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Presets */}
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 px-2 py-1">Períodos predefinidos</p>
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handlePresetSelect(option.value)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  value === option.value
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          {showCustom && (
            <div className="p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Rango personalizado</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500">Desde</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Hasta</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleCustomApply}
                  disabled={!customStart || !customEnd}
                  className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to get date range from preset
export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { start: today, end: now };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: now };
    case 'month':
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: monthAgo, end: now };
    case 'quarter':
      const quarterAgo = new Date(today);
      quarterAgo.setMonth(quarterAgo.getMonth() - 3);
      return { start: quarterAgo, end: now };
    case 'year':
      const yearAgo = new Date(today);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return { start: yearAgo, end: now };
    case 'ytd':
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return { start: yearStart, end: now };
    default:
      return { start: today, end: now };
  }
}
