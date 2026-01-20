'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import { PriceCurrencyInput, Currency, InflationAdjustmentModal, AdjustmentSubmission, PriceAdjustmentHistory } from '@/components/pricing';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Package,
  Wrench,
  X,
  Save,
  Filter,
  Clock,
  Ruler,
  Hash,
  Calendar,
  FileText,
  Tag,
  TrendingUp,
  History,
} from 'lucide-react';

// Specialty options for multi-trade support
const SPECIALTY_OPTIONS = [
  { value: 'PLOMERO', label: 'Plomero', color: 'bg-blue-100 text-blue-700' },
  { value: 'ELECTRICISTA', label: 'Electricista', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'GASISTA', label: 'Gasista', color: 'bg-orange-100 text-orange-700' },
  { value: 'CALEFACCIONISTA', label: 'Calefaccionista', color: 'bg-red-100 text-red-700' },
  { value: 'REFRIGERACION', label: 'Refrigeración', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'ALBANIL', label: 'Albañil', color: 'bg-stone-100 text-stone-700' },
  { value: 'PINTOR', label: 'Pintor', color: 'bg-purple-100 text-purple-700' },
  { value: 'CARPINTERO', label: 'Carpintero', color: 'bg-amber-100 text-amber-700' },
  { value: 'TECHISTA', label: 'Techista', color: 'bg-slate-100 text-slate-700' },
  { value: 'HERRERO', label: 'Herrero', color: 'bg-zinc-100 text-zinc-700' },
  { value: 'SOLDADOR', label: 'Soldador', color: 'bg-rose-100 text-rose-700' },
  { value: 'OTRO', label: 'Otro', color: 'bg-gray-100 text-gray-700' },
];

// Pricing model options with unit behavior
const PRICING_MODEL_OPTIONS = [
  { value: 'FIXED', label: 'Precio Fijo', icon: DollarSign, description: 'Un precio cerrado', unitBehavior: 'hidden' as const, defaultUnit: '' },
  { value: 'HOURLY', label: 'Por Hora', icon: Clock, description: 'Cobro por hora de trabajo', unitBehavior: 'auto' as const, defaultUnit: 'hora' },
  { value: 'PER_UNIT', label: 'Por Unidad', icon: Hash, description: 'Por punto, toma, etc.', unitBehavior: 'required' as const, defaultUnit: '' },
  { value: 'PER_M2', label: 'Por m²', icon: Ruler, description: 'Por metro cuadrado', unitBehavior: 'auto' as const, defaultUnit: 'm²' },
  { value: 'PER_DAY', label: 'Por Jornal', icon: Calendar, description: 'Tarifa diaria', unitBehavior: 'hidden' as const, defaultUnit: '' },
  { value: 'QUOTE', label: 'Presupuesto', icon: FileText, description: 'Cotización personalizada', unitBehavior: 'hidden' as const, defaultUnit: '' },
];

// Helper to get pricing model config
const getPricingModelConfig = (model: string) => {
  return PRICING_MODEL_OPTIONS.find(opt => opt.value === model) || null;
};

interface PriceItem {
  id: string;
  name: string;
  description?: string;
  type: 'service' | 'product';
  price: number;
  unit?: string;
  taxRate?: number;
  isActive: boolean;
  specialty?: string | null;
  pricingModel?: string | null;
  // Multi-currency fields (Phase 2)
  priceCurrency?: 'ARS' | 'USD';
  priceInUsd?: number | null;
  exchangeRateAtSet?: number | null;
}

export default function PricebookPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('');
  const [showInflationModal, setShowInflationModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pricebook'],
    queryFn: () => api.settings.pricebook.list(),
  });

  // Fetch org pricing settings for preferred rate source
  const { data: pricingSettings } = useQuery({
    queryKey: ['pricing-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/pricing');
      const json = await res.json();
      return json.success ? json.data : null;
    },
    staleTime: 5 * 60 * 1000,
  });
  const defaultRateSource = pricingSettings?.exchangeRateSource || 'BLUE';

  // Allow user to temporarily view in different rate (defaults to org preference)
  const [selectedRateSource, setSelectedRateSource] = useState<string>('');
  const activeRateSource = selectedRateSource || defaultRateSource;

  // Fetch exchange rate for selected source (BLUE, MEP, and CCL work with Ambito)
  const { data: exchangeRateData, isError: rateError } = useQuery({
    queryKey: ['exchange-rate', activeRateSource],
    queryFn: async () => {
      const res = await fetch(`/api/exchange-rates/${activeRateSource.toLowerCase()}`);
      const json = await res.json();
      if (!json.success) throw new Error('Rate fetch failed');
      return json.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once
    enabled: !!activeRateSource && ['BLUE', 'MEP', 'CCL'].includes(activeRateSource),
  });
  const currentRate = exchangeRateData?.sellRate || 0;
  const rateLabel = exchangeRateData?.label || activeRateSource;
  const rateUnavailable = rateError || (!currentRate && activeRateSource);

  const items = (data?.data as PriceItem[]) || [];

  const filteredItems = items.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false;
    if (specialtyFilter && item.specialty !== specialtyFilter) return false;
    return true;
  });

  // Get unique specialties from items for filter tabs
  const usedSpecialties = [...new Set(items.map(i => i.specialty).filter(Boolean))] as string[];

  const createMutation = useMutation({
    mutationFn: (data: Partial<PriceItem>) => api.settings.pricebook.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricebook'] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PriceItem> }) =>
      api.settings.pricebook.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricebook'] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.settings.pricebook.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricebook'] });
    },
  });

  // Inflation adjustment mutation (Phase 5)
  const adjustMutation = useMutation({
    mutationFn: async (data: AdjustmentSubmission) => {
      const res = await fetch('/api/settings/pricebook/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pricebook'] });
      queryClient.invalidateQueries({ queryKey: ['price-adjustment-history'] });
      setShowInflationModal(false);
      alert(`✅ Se ajustaron ${result.data.itemsAdjusted} ítems (${result.data.summary.averageChange.toFixed(1)}% promedio)`);
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleOpenModal = (item?: PriceItem) => {
    setEditingItem(item || null);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este item?')) {
      deleteMutation.mutate(id);
    }
  };

  const getSpecialtyInfo = (specialty: string | null | undefined) => {
    if (!specialty) return null;
    return SPECIALTY_OPTIONS.find(s => s.value === specialty);
  };

  const getPricingModelInfo = (model: string | null | undefined) => {
    if (!model) return null;
    return PRICING_MODEL_OPTIONS.find(m => m.value === model);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Lista de precios</h1>
          <p className="text-gray-500">Servicios y productos con soporte multi-oficio</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <History className="h-4 w-4" />
            Historial
          </button>
          <button
            onClick={() => setShowInflationModal(true)}
            className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            <TrendingUp className="h-4 w-4" />
            Ajustar por Inflación
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo item
          </button>
        </div>
      </div>

      {/* Specialty Tabs */}
      {usedSpecialties.length > 0 && (
        <div className="card p-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSpecialtyFilter('')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${!specialtyFilter
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
            >
              Todos
            </button>
            {usedSpecialties.map((specialty) => {
              const info = getSpecialtyInfo(specialty);
              return (
                <button
                  key={specialty}
                  onClick={() => setSpecialtyFilter(specialty)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${specialtyFilter === specialty
                    ? info?.color || 'bg-primary-100 text-primary-700'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {info?.label || specialty}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Filtrar por tipo:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">Todos</option>
            <option value="service">Servicios</option>
            <option value="product">Productos</option>
          </select>

          {/* Exchange rate selector for USD items */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">Cotización USD:</span>
            <select
              value={selectedRateSource}
              onChange={(e) => setSelectedRateSource(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700"
            >
              <option value="">Por defecto ({defaultRateSource})</option>
              <option value="BLUE">Dólar Blue</option>
              <option value="MEP">Dólar MEP (Bolsa)</option>
              <option value="CCL">Dólar CCL</option>
            </select>
            {currentRate > 0 ? (
              <span className="text-xs font-medium text-green-600">
                ${currentRate.toLocaleString('es-AR')}
              </span>
            ) : rateUnavailable ? (
              <span className="text-xs text-amber-600">Sin cotización</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Items grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="mt-4 h-6 w-1/3 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : filteredItems.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const specialtyInfo = getSpecialtyInfo(item.specialty);
            const pricingModelInfo = getPricingModelInfo(item.pricingModel);
            const PricingIcon = pricingModelInfo?.icon || DollarSign;

            return (
              <div
                key={item.id}
                className="card p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {item.type === 'service' ? (
                      <Wrench className="h-5 w-5 text-primary-500" />
                    ) : (
                      <Package className="h-5 w-5 text-secondary-500" />
                    )}
                    <span className="text-xs uppercase text-gray-500">
                      {item.type === 'service' ? 'Servicio' : 'Producto'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Specialty Badge */}
                {specialtyInfo && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${specialtyInfo.color}`}>
                      <Tag className="h-3 w-3" />
                      {specialtyInfo.label}
                    </span>
                  </div>
                )}

                <h3 className="mt-2 font-medium text-gray-900">{item.name}</h3>
                {item.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {item.description}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Currency indicator */}
                    {item.priceCurrency === 'USD' ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
                        US$
                      </span>
                    ) : null}
                    <span className="text-lg font-bold text-gray-900">
                      {item.priceCurrency === 'USD'
                        ? `$${item.priceInUsd?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : formatCurrency(item.price)
                      }
                    </span>
                    {item.unit && (
                      <span className="text-sm text-gray-500">/ {item.unit}</span>
                    )}
                  </div>
                  {pricingModelInfo && (
                    <div className="flex items-center gap-1 text-xs text-gray-500" title={pricingModelInfo.description}>
                      <PricingIcon className="h-3.5 w-3.5" />
                      <span>{pricingModelInfo.label}</span>
                    </div>
                  )}
                </div>

                {/* Show ARS equivalent for USD items */}
                {item.priceCurrency === 'USD' && item.priceInUsd && currentRate > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    ≈ {formatCurrency(item.priceInUsd * currentRate)} ARS
                    <span className="ml-1 text-gray-400">({rateLabel})</span>
                  </p>
                )}
                {item.priceCurrency === 'USD' && (!currentRate || currentRate === 0) && (
                  <p className="mt-1 text-xs text-gray-400 italic">
                    Cargando cotización...
                  </p>
                )}

                {item.taxRate !== undefined && item.taxRate > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    + {item.taxRate}% IVA
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">No hay items en la lista de precios</p>
          <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Agregar item
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PriceItemModal
          item={editingItem}
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
          onSave={(data) => {
            if (editingItem) {
              updateMutation.mutate({ id: editingItem.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* History Section (Phase 5) */}
      {showHistory && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Ajustes
          </h3>
          <PriceAdjustmentHistory limit={10} />
        </div>
      )}

      {/* Inflation Adjustment Modal (Phase 5) */}
      <InflationAdjustmentModal
        isOpen={showInflationModal}
        onClose={() => setShowInflationModal(false)}
        items={items}
        onApply={async (data) => {
          await adjustMutation.mutateAsync(data);
        }}
        isLoading={adjustMutation.isPending}
      />
    </div>
  );
}

interface PriceItemModalProps {
  item: PriceItem | null;
  onClose: () => void;
  onSave: (data: Partial<PriceItem>) => void;
  isLoading: boolean;
}

function PriceItemModal({ item, onClose, onSave, isLoading }: PriceItemModalProps) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: item?.name || '',
    description: item?.description || '',
    type: item?.type || 'service',
    price: item?.priceCurrency === 'USD'
      ? (item?.priceInUsd?.toString() || '')
      : (item?.price?.toString() || ''),
    unit: item?.unit || '',
    taxRate: item?.taxRate?.toString() || '21',
    isActive: item?.isActive ?? true,
    specialty: item?.specialty || '',
    pricingModel: item?.pricingModel || '',
    // Multi-currency fields
    priceCurrency: (item?.priceCurrency || 'ARS') as Currency,
  });

  // SSR safety - only render portal after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const priceValue = parseFloat(formData.price) || 0;

    onSave({
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type as 'service' | 'product',
      // For USD, priceInUsd holds the USD value, price will be calculated by backend
      price: formData.priceCurrency === 'USD' ? 0 : priceValue,
      priceInUsd: formData.priceCurrency === 'USD' ? priceValue : undefined,
      priceCurrency: formData.priceCurrency,
      unit: formData.unit || undefined,
      taxRate: parseFloat(formData.taxRate) || 0,
      isActive: formData.isActive,
      specialty: formData.specialty || undefined,
      pricingModel: formData.pricingModel || undefined,
    });
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b bg-white p-4 rounded-t-2xl">
          <h2 className="text-lg font-medium text-gray-900">
            {item ? 'Editar item' : 'Nuevo item'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            {/* Type Selection */}
            <div>
              <label className="label mb-1 block">Tipo</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value="service"
                    checked={formData.type === 'service'}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as 'service' | 'product' })
                    }
                    className="text-primary-600"
                  />
                  <Wrench className="h-4 w-4 text-primary-500" />
                  Servicio
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value="product"
                    checked={formData.type === 'product'}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as 'service' | 'product' })
                    }
                    className="text-primary-600"
                  />
                  <Package className="h-4 w-4 text-secondary-500" />
                  Producto
                </label>
              </div>
            </div>

            {/* Specialty Selection */}
            <div>
              <label htmlFor="specialty" className="label mb-1 block">
                Especialidad (Oficio)
              </label>
              <select
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                className="input"
              >
                <option value="">Sin especialidad</option>
                {SPECIALTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Agrupa items por oficio para filtrar fácilmente
              </p>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="label mb-1 block">
                Nombre *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Instalación de aire acondicionado"
                className="input"
                required
                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el nombre del item')}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="label mb-1 block">
                Descripción
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descripción opcional..."
                rows={2}
                className="input"
              />
            </div>

            {/* Pricing Model */}
            <div>
              <label htmlFor="pricingModel" className="label mb-1 block">
                Modelo de Precio
              </label>
              <select
                id="pricingModel"
                value={formData.pricingModel}
                onChange={(e) => {
                  const newModel = e.target.value;
                  const config = getPricingModelConfig(newModel);
                  // Auto-set unit based on model
                  let newUnit = '';
                  if (config?.unitBehavior === 'auto') {
                    newUnit = config.defaultUnit; // hora, m², etc.
                  } else if (config?.unitBehavior === 'required') {
                    newUnit = ''; // Clear for PER_UNIT so user must enter
                  } else if (config?.unitBehavior === 'hidden') {
                    newUnit = ''; // No unit for FIXED, PER_DAY, QUOTE
                  }
                  setFormData({ ...formData, pricingModel: newModel, unit: newUnit });
                }}
                className="input"
              >
                <option value="">Seleccionar...</option>
                {PRICING_MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} - {opt.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Price and Unit with Currency Toggle */}
            <div className="space-y-4">
              <PriceCurrencyInput
                id="price"
                label="Precio"
                value={formData.price}
                onChange={(value) => setFormData(prev => ({ ...prev, price: value }))}
                currency={formData.priceCurrency}
                onCurrencyChange={(currency) => setFormData(prev => ({ ...prev, priceCurrency: currency }))}
                unit={formData.unit}
                required
              />

              {/* Only show unit field for PER_UNIT, show readonly for auto (HOURLY, PER_M2) */}
              {(() => {
                const modelConfig = getPricingModelConfig(formData.pricingModel);
                if (modelConfig?.unitBehavior === 'hidden') return null;

                if (modelConfig?.unitBehavior === 'auto') {
                  return (
                    <div>
                      <label className="label mb-1 block text-gray-500">
                        Unidad (automática)
                      </label>
                      <div className="input bg-gray-50 text-gray-600 cursor-not-allowed">
                        {modelConfig.defaultUnit}
                      </div>
                    </div>
                  );
                }

                // Required (PER_UNIT) or no model selected
                return (
                  <div>
                    <label htmlFor="unit" className="label mb-1 block">
                      Unidad {modelConfig?.unitBehavior === 'required' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      id="unit"
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="punto, toma, metro, pieza..."
                      className="input"
                      required={modelConfig?.unitBehavior === 'required'}
                    />
                    {modelConfig?.unitBehavior === 'required' && (
                      <p className="mt-1 text-xs text-gray-500">
                        Ej: punto de luz, toma, metro de caño, etc.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Tax Rate */}
            <div>
              <label htmlFor="taxRate" className="label mb-1 block">
                Tasa IVA (%)
              </label>
              <select
                id="taxRate"
                value={formData.taxRate}
                onChange={(e) =>
                  setFormData({ ...formData, taxRate: e.target.value })
                }
                className="input"
              >
                <option value="0">0% - Exento</option>
                <option value="10.5">10.5%</option>
                <option value="21">21%</option>
                <option value="27">27%</option>
              </select>
            </div>

            {/* Active Toggle */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded text-primary-600"
                />
                <span className="text-sm text-gray-700">Item activo</span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary">
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
