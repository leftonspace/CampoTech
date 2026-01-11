'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Circle,
  Square,
  Hexagon,
  Edit3,
  Save,
  X,
  Info,
} from 'lucide-react';

interface CoverageArea {
  type: 'circle' | 'polygon' | 'custom';
  center?: { lat: number; lng: number };
  radius?: number; // in km
  coordinates?: number[][][]; // GeoJSON polygon coordinates
}

interface CoverageEditorProps {
  value?: CoverageArea | null;
  onChange: (coverage: CoverageArea) => void;
  locationCenter: { lat: number; lng: number };
  className?: string;
  disabled?: boolean;
}

const PRESET_RADII = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 15, label: '15 km' },
  { value: 20, label: '20 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
];

export function CoverageEditor({
  value,
  onChange,
  locationCenter,
  className,
  disabled = false,
}: CoverageEditorProps) {
  const [coverageType, setCoverageType] = useState<'circle' | 'polygon' | 'custom'>(
    value?.type || 'circle'
  );
  const [radius, setRadius] = useState(value?.radius || 10);
  const [isEditing, setIsEditing] = useState(!value);

  useEffect(() => {
    if (value) {
      setCoverageType(value.type);
      if (value.radius) setRadius(value.radius);
    }
  }, [value]);

  const handleSave = () => {
    if (coverageType === 'circle') {
      onChange({
        type: 'circle',
        center: locationCenter,
        radius,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (value) {
      setCoverageType(value.type);
      if (value.radius) setRadius(value.radius);
    }
    setIsEditing(false);
  };

  const calculateArea = (radiusKm: number) => {
    const area = Math.PI * radiusKm * radiusKm;
    return area.toFixed(1);
  };

  if (!isEditing && value) {
    return (
      <div className={cn('rounded-lg border bg-white p-4', className)}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary-100 p-2">
              {value.type === 'circle' ? (
                <Circle className="h-5 w-5 text-primary-600" />
              ) : value.type === 'polygon' ? (
                <Hexagon className="h-5 w-5 text-primary-600" />
              ) : (
                <Square className="h-5 w-5 text-primary-600" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {value.type === 'circle'
                  ? 'Cobertura circular'
                  : value.type === 'polygon'
                  ? 'Polígono personalizado'
                  : 'Área personalizada'}
              </p>
              {value.type === 'circle' && value.radius && (
                <div className="mt-1 text-sm text-gray-500">
                  <p>Radio: {value.radius} km</p>
                  <p>Área: {calculateArea(value.radius)} km²</p>
                </div>
              )}
              {value.type === 'polygon' && value.coordinates && (
                <p className="mt-1 text-sm text-gray-500">
                  {value.coordinates[0]?.length || 0} vértices
                </p>
              )}
            </div>
          </div>
          {!disabled && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-white', className)}>
      <div className="border-b p-4">
        <h3 className="font-medium text-gray-900">Configurar área de cobertura</h3>
        <p className="mt-1 text-sm text-gray-500">
          Define el área geográfica de servicio para esta zona
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Coverage type selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de cobertura
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCoverageType('circle')}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
                coverageType === 'circle'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <Circle className="h-6 w-6" />
              <span className="text-sm font-medium">Circular</span>
            </button>
            <button
              type="button"
              onClick={() => setCoverageType('polygon')}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
                coverageType === 'polygon'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <Hexagon className="h-6 w-6" />
              <span className="text-sm font-medium">Polígono</span>
            </button>
            <button
              type="button"
              onClick={() => setCoverageType('custom')}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
                coverageType === 'custom'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <Square className="h-6 w-6" />
              <span className="text-sm font-medium">Personalizado</span>
            </button>
          </div>
        </div>

        {/* Circle configuration */}
        {coverageType === 'circle' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Radio de cobertura
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_RADII.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setRadius(preset.value)}
                    disabled={disabled}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      radius === preset.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Radio personalizado (km)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  disabled={disabled}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={radius}
                  onChange={(e) => setRadius(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={disabled}
                  className="input w-20"
                />
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-gray-400 mt-0.5" />
                <div className="text-sm text-gray-600">
                  <p>
                    <strong>Centro:</strong> {locationCenter.lat.toFixed(6)},{' '}
                    {locationCenter.lng.toFixed(6)}
                  </p>
                  <p>
                    <strong>Área aproximada:</strong> {calculateArea(radius)} km²
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Polygon configuration */}
        {coverageType === 'polygon' && (
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900">Editor de polígonos</p>
                <p className="mt-1 text-sm text-blue-700">
                  Usa el editor de zonas para dibujar polígonos personalizados en el mapa.
                  Haz clic en puntos del mapa para definir los vértices del área de cobertura.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Custom configuration */}
        {coverageType === 'custom' && (
          <div className="rounded-lg bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900">Área personalizada</p>
                <p className="mt-1 text-sm text-amber-700">
                  Puedes definir áreas de cobertura complejas combinando múltiples zonas
                  o importando coordenadas GeoJSON desde un archivo externo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t p-4">
        {value && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={disabled}
            className="btn-secondary"
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || coverageType !== 'circle'}
          className="btn-primary"
        >
          <Save className="mr-2 h-4 w-4" />
          Guardar cobertura
        </button>
      </div>
    </div>
  );
}

export default CoverageEditor;
