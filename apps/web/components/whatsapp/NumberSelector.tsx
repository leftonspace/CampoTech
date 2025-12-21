'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Phone,
  MapPin,
  Loader2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Search,
} from 'lucide-react';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  displayNumber: string;
  countryCode: string;
  areaCode?: string;
  available: boolean;
  monthlyCost?: {
    amount: number;
    currency: string;
  };
}

interface NumberSelectorProps {
  selectedNumber: string | null;
  onSelectNumber: (number: string) => void;
  onContinue: () => void;
  isLoading: boolean;
  error?: string;
}

// Argentine area codes for display
const ARGENTINA_AREA_CODES: Record<string, string> = {
  '11': 'Buenos Aires (AMBA)',
  '351': 'Córdoba',
  '341': 'Rosario',
  '261': 'Mendoza',
  '381': 'San Miguel de Tucumán',
  '387': 'Salta',
  '379': 'Corrientes',
  '343': 'Paraná',
  '223': 'Mar del Plata',
  '299': 'Neuquén',
  '291': 'Bahía Blanca',
  '342': 'Santa Fe',
  '264': 'San Juan',
  '266': 'San Luis',
  '280': 'Rawson / Trelew',
  '2901': 'Ushuaia',
  '2966': 'Río Gallegos',
};

export function NumberSelector({
  selectedNumber,
  onSelectNumber,
  onContinue,
  isLoading,
  error,
}: NumberSelectorProps) {
  const [country] = useState('AR');
  const [searchAreaCode, setSearchAreaCode] = useState('');

  const {
    data,
    isLoading: isFetching,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: ['available-numbers', country, searchAreaCode],
    queryFn: async () => {
      const params = new URLSearchParams({ country });
      if (searchAreaCode) {
        params.set('areaCode', searchAreaCode);
      }
      const res = await fetch(`/api/whatsapp/provision/available?${params}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch numbers');
      }
      return res.json();
    },
  });

  const numbers: PhoneNumber[] = data?.numbers || [];

  // Group numbers by area code
  const groupedNumbers = numbers.reduce((acc, num) => {
    const area = num.areaCode || 'Otros';
    if (!acc[area]) acc[area] = [];
    acc[area].push(num);
    return acc;
  }, {} as Record<string, PhoneNumber[]>);

  const getAreaName = (code: string) => {
    return ARGENTINA_AREA_CODES[code] || `Código ${code}`;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Elegí tu número de WhatsApp
        </h1>
        <p className="text-gray-600">
          Seleccioná un número de teléfono para tu negocio
        </p>
      </div>

      {/* Country and Search */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🇦🇷</span>
            <span className="font-medium">Argentina</span>
          </div>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar por código de área (ej: 11, 351)"
                value={searchAreaCode}
                onChange={(e) => setSearchAreaCode(e.target.value.replace(/\D/g, ''))}
                className="input pl-10"
              />
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-outline p-2"
            title="Actualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {(error || fetchError) && (
        <div className="p-4 bg-red-50 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error || (fetchError as Error)?.message}</p>
        </div>
      )}

      {/* Loading state */}
      {isFetching && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500 mb-4" />
          <p className="text-gray-500">Buscando números disponibles...</p>
        </div>
      )}

      {/* Numbers list */}
      {!isFetching && numbers.length > 0 && (
        <div className="space-y-4">
          {Object.entries(groupedNumbers).map(([areaCode, areaNumbers]) => (
            <div key={areaCode} className="card overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-700">
                  {getAreaName(areaCode)}
                </span>
                <span className="text-sm text-gray-500">
                  ({areaNumbers.length} disponibles)
                </span>
              </div>
              <div className="divide-y">
                {areaNumbers.map((num) => (
                  <label
                    key={num.id}
                    className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                      selectedNumber === num.phoneNumber
                        ? 'bg-primary-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="phone-number"
                      value={num.phoneNumber}
                      checked={selectedNumber === num.phoneNumber}
                      onChange={() => onSelectNumber(num.phoneNumber)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="font-mono font-medium">
                          {num.displayNumber}
                        </span>
                      </div>
                    </div>
                    {num.monthlyCost && (
                      <div className="text-sm text-gray-500">
                        {formatCurrency(num.monthlyCost.amount, num.monthlyCost.currency)}/mes
                      </div>
                    )}
                    {selectedNumber === num.phoneNumber && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                        Seleccionado
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isFetching && numbers.length === 0 && !fetchError && (
        <div className="text-center py-12">
          <Phone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay números disponibles
          </h3>
          <p className="text-gray-500 mb-4">
            {searchAreaCode
              ? `No encontramos números para el código de área ${searchAreaCode}`
              : 'No hay números disponibles en este momento'}
          </p>
          <button onClick={() => refetch()} className="btn-outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Volver a buscar
          </button>
        </div>
      )}

      {/* Continue button */}
      {numbers.length > 0 && (
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onContinue}
            disabled={!selectedNumber || isLoading}
            className="btn-primary"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aprovisionando...
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>Importante:</strong> Una vez seleccionado, el número quedará reservado
          para tu negocio. En el siguiente paso verificaremos tu identidad enviando
          un código a tu celular personal.
        </p>
      </div>
    </div>
  );
}
