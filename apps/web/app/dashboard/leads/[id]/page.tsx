'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  User,
  Phone,
  MessageSquare,
  Image,
  Send,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  Briefcase,
  FileText,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Lead {
  id: string;
  requestNumber: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  budgetRange: string | null;
  preferredSchedule: string | null;
  photos: string[];
  consumer: {
    displayName: string | null;
    profilePhotoUrl: string | null;
    totalRequests: number;
    completedJobs: number;
  };
  location: {
    city: string;
    neighborhood: string | null;
    address?: string;
    distance: number | null;
  };
  status: 'new' | 'viewed' | 'quoted' | 'accepted' | 'expired';
  myQuote: {
    id: string;
    quoteNumber: string;
    priceMin: number;
    priceMax: number;
    description: string;
    status: string;
    createdAt: string;
  } | null;
  competingQuotes: number;
  createdAt: string;
  expiresAt: string;
}

interface QuoteFormData {
  priceMin: number;
  priceMax: number;
  durationHours: number;
  description: string;
  includesPartsMessage: string;
  validDays: number;
  notes: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plomeria',
  electrical: 'Electricidad',
  hvac: 'Aire y Climatizacion',
  gas: 'Gas',
  locksmith: 'Cerrajeria',
  painting: 'Pintura',
  cleaning: 'Limpieza',
  moving: 'Mudanza',
  carpentry: 'Carpinteria',
  appliance_repair: 'Reparacion de Electrodomesticos',
  pest_control: 'Control de Plagas',
  roofing: 'Techos',
  landscaping: 'Jardineria',
  glass_repair: 'Vidrios',
  security: 'Seguridad',
  flooring: 'Pisos',
  general: 'Mantenimiento General',
  other: 'Otro',
};

const URGENCY_LABELS: Record<string, string> = {
  emergency: 'Urgente - Lo antes posible',
  today: 'Hoy',
  this_week: 'Esta semana',
  flexible: 'Flexible',
};

const DURATION_OPTIONS = [
  { value: 1, label: '1 hora' },
  { value: 2, label: '2 horas' },
  { value: 3, label: '3 horas' },
  { value: 4, label: '4 horas' },
  { value: 6, label: '6 horas' },
  { value: 8, label: '1 dia (8h)' },
  { value: 16, label: '2 dias' },
  { value: 24, label: '3 dias' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const leadId = params.id as string;

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState<QuoteFormData>({
    priceMin: 0,
    priceMax: 0,
    durationHours: 2,
    description: '',
    includesPartsMessage: '',
    validDays: 7,
    notes: '',
  });

  // Fetch lead details
  const { data, isLoading, error } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => apiRequest<Lead>(`/leads/${leadId}`),
    enabled: !!leadId,
  });

  const lead = data?.data;

  // Submit quote mutation
  const submitQuoteMutation = useMutation({
    mutationFn: async (formData: QuoteFormData) => {
      const response = await apiRequest('/leads/quote', {
        method: 'POST',
        body: {
          serviceRequestId: leadId,
          ...formData,
        },
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Error al enviar cotizacion');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      setShowQuoteForm(false);
    },
  });

  // Decline lead mutation
  const declineMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest(`/leads/${leadId}/decline`, {
        method: 'POST',
        body: { reason },
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Error');
      }
      return response;
    },
    onSuccess: () => {
      router.push('/dashboard/leads');
    },
  });

  // Handle quote form change
  const handleFormChange = (
    field: keyof QuoteFormData,
    value: string | number
  ) => {
    setQuoteForm((prev) => ({ ...prev, [field]: value }));
  };

  // Handle quote submit
  const handleSubmitQuote = () => {
    if (quoteForm.priceMin <= 0 || quoteForm.priceMax <= 0) {
      alert('Por favor ingresa precios validos');
      return;
    }
    if (quoteForm.priceMax < quoteForm.priceMin) {
      alert('El precio maximo debe ser mayor al minimo');
      return;
    }
    if (!quoteForm.description.trim()) {
      alert('Por favor ingresa una descripcion');
      return;
    }
    submitQuoteMutation.mutate(quoteForm);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="card h-96 bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-4 text-lg font-medium text-gray-900">Lead no encontrado</p>
        <Link href="/dashboard/leads" className="btn-primary mt-4">
          Volver a leads
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/leads"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{lead.title}</h1>
            <span className="text-sm text-gray-500">#{lead.requestNumber}</span>
          </div>
          <p className="text-gray-500">
            {CATEGORY_LABELS[lead.category] || lead.category}
          </p>
        </div>
        {lead.status === 'expired' && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
            Expirada
          </span>
        )}
        {lead.myQuote && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
            Cotizada
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photos */}
          {lead.photos.length > 0 && (
            <div className="card overflow-hidden">
              {/* Main photo */}
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={lead.photos[selectedPhotoIndex]}
                  alt=""
                  className="h-full w-full object-contain"
                />
                {lead.photos.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setSelectedPhotoIndex(
                          (selectedPhotoIndex - 1 + lead.photos.length) %
                            lead.photos.length
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() =>
                        setSelectedPhotoIndex(
                          (selectedPhotoIndex + 1) % lead.photos.length
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
                      {selectedPhotoIndex + 1} / {lead.photos.length}
                    </div>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {lead.photos.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {lead.photos.map((photo, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedPhotoIndex(index)}
                      className={cn(
                        'flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-all',
                        selectedPhotoIndex === index
                          ? 'border-primary-500'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      )}
                    >
                      <img
                        src={photo}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Descripcion del trabajo
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap">{lead.description}</p>
          </div>

          {/* Details */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div>
                  <dt className="text-sm text-gray-500">Ubicacion</dt>
                  <dd className="font-medium text-gray-900">
                    {lead.location.neighborhood
                      ? `${lead.location.neighborhood}, `
                      : ''}
                    {lead.location.city}
                    {lead.location.distance && (
                      <span className="text-gray-500">
                        {' '}
                        ({lead.location.distance.toFixed(1)} km)
                      </span>
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div>
                  <dt className="text-sm text-gray-500">Cuando</dt>
                  <dd className="font-medium text-gray-900">
                    {URGENCY_LABELS[lead.urgency] || lead.urgency}
                    {lead.preferredSchedule && (
                      <span className="text-gray-500">
                        {' '}
                        - {lead.preferredSchedule}
                      </span>
                    )}
                  </dd>
                </div>
              </div>
              {lead.budgetRange && (
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div>
                    <dt className="text-sm text-gray-500">Presupuesto estimado</dt>
                    <dd className="font-medium text-gray-900">{lead.budgetRange}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div>
                  <dt className="text-sm text-gray-500">Solicitud creada</dt>
                  <dd className="font-medium text-gray-900">
                    {formatDate(lead.createdAt)}
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          {/* Quote Form */}
          {showQuoteForm && !lead.myQuote && lead.status !== 'expired' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Enviar cotizacion
              </h2>
              <div className="space-y-4">
                {/* Price range */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio minimo *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        value={quoteForm.priceMin || ''}
                        onChange={(e) =>
                          handleFormChange('priceMin', parseInt(e.target.value) || 0)
                        }
                        placeholder="15000"
                        className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio maximo *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        value={quoteForm.priceMax || ''}
                        onChange={(e) =>
                          handleFormChange('priceMax', parseInt(e.target.value) || 0)
                        }
                        placeholder="25000"
                        className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duracion estimada
                  </label>
                  <select
                    value={quoteForm.durationHours}
                    onChange={(e) =>
                      handleFormChange('durationHours', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripcion del trabajo *
                  </label>
                  <textarea
                    value={quoteForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Detalla que incluye tu cotizacion, materiales, garantia, etc."
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Parts message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Materiales incluidos
                  </label>
                  <input
                    type="text"
                    value={quoteForm.includesPartsMessage}
                    onChange={(e) =>
                      handleFormChange('includesPartsMessage', e.target.value)
                    }
                    placeholder="Ej: Incluye mano de obra, materiales aparte"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Valid days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cotizacion valida por
                  </label>
                  <select
                    value={quoteForm.validDays}
                    onChange={(e) =>
                      handleFormChange('validDays', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={3}>3 dias</option>
                    <option value={7}>7 dias</option>
                    <option value={14}>14 dias</option>
                    <option value={30}>30 dias</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas adicionales
                  </label>
                  <textarea
                    value={quoteForm.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Cualquier otra informacion relevante..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowQuoteForm(false)}
                    className="btn-outline flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmitQuote}
                    disabled={submitQuoteMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {submitQuoteMutation.isPending ? (
                      'Enviando...'
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar cotizacion
                      </>
                    )}
                  </button>
                </div>

                {submitQuoteMutation.error && (
                  <p className="text-sm text-red-600 text-center">
                    {submitQuoteMutation.error.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* My Quote */}
          {lead.myQuote && (
            <div className="card p-6 border-green-200 bg-green-50">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Tu cotizacion enviada
              </h2>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Numero:</dt>
                  <dd className="font-medium">{lead.myQuote.quoteNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Precio:</dt>
                  <dd className="font-medium text-green-700">
                    ${lead.myQuote.priceMin.toLocaleString()} - $
                    {lead.myQuote.priceMax.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Estado:</dt>
                  <dd
                    className={cn(
                      'font-medium',
                      lead.myQuote.status === 'accepted'
                        ? 'text-green-600'
                        : 'text-yellow-600'
                    )}
                  >
                    {lead.myQuote.status === 'accepted' ? 'Aceptada' : 'Pendiente'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Enviada:</dt>
                  <dd>{formatDate(lead.myQuote.createdAt)}</dd>
                </div>
              </dl>
              {lead.myQuote.description && (
                <p className="mt-4 text-sm text-gray-600 border-t pt-3">
                  {lead.myQuote.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Consumer info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cliente</h3>
            <div className="flex items-center gap-3 mb-4">
              {lead.consumer.profilePhotoUrl ? (
                <img
                  src={lead.consumer.profilePhotoUrl}
                  alt=""
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {lead.consumer.displayName || 'Cliente'}
                </p>
                <p className="text-sm text-gray-500">
                  {lead.consumer.completedJobs > 0
                    ? `${lead.consumer.completedJobs} trabajos completados`
                    : 'Nuevo cliente'}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Briefcase className="h-4 w-4" />
                <span>{lead.consumer.totalRequests} solicitudes totales</span>
              </div>
            </div>
          </div>

          {/* Competition */}
          {lead.competingQuotes > 0 && (
            <div className="card p-6 border-orange-200 bg-orange-50">
              <h3 className="text-sm font-semibold text-orange-800 mb-2">
                Competencia
              </h3>
              <p className="text-2xl font-bold text-orange-700">
                {lead.competingQuotes}
              </p>
              <p className="text-sm text-orange-600">
                {lead.competingQuotes === 1
                  ? 'otra cotizacion enviada'
                  : 'cotizaciones enviadas'}
              </p>
            </div>
          )}

          {/* Expiration */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Expira en
            </h3>
            <p className="text-lg font-medium text-gray-900">
              {new Date(lead.expiresAt) > new Date()
                ? formatDate(lead.expiresAt)
                : 'Expirada'}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!lead.myQuote && lead.status !== 'expired' && (
              <button
                onClick={() => setShowQuoteForm(true)}
                className="btn-primary w-full"
                disabled={showQuoteForm}
              >
                <Send className="mr-2 h-4 w-4" />
                Enviar cotizacion
              </button>
            )}
            {lead.myQuote?.status === 'accepted' && (
              <Link
                href={`/dashboard/leads/${leadId}/schedule`}
                className="btn-primary w-full text-center block"
              >
                <Calendar className="mr-2 h-4 w-4 inline" />
                Agendar trabajo
              </Link>
            )}
            {!lead.myQuote && (
              <button
                onClick={() => {
                  const reason = window.prompt('Por que no te interesa este lead?');
                  if (reason) declineMutation.mutate(reason);
                }}
                className="btn-outline w-full text-gray-600"
              >
                No me interesa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
