'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { cn, formatDateTime, searchMatchesAny } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  User,
  Building2,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Filter,
  Image,
  MessageSquare,
  Flag,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FraudSignal {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  details?: Record<string, unknown>;
}

interface ModerationQueueItem {
  id: string;
  reviewId: string;
  fraudScore: number;
  fraudSignals: FraudSignal[];
  priority: number;
  queueReason: string;
  queuedAt: string;
  review: {
    consumerId: string;
    consumerName: string;
    businessProfileId: string;
    businessName: string;
    overallRating: number;
    comment?: string;
    photos: string[];
    createdAt: string;
  };
}

interface QueueStats {
  pending: number;
  processed: number;
  highRisk: number;
  approvedToday: number;
  rejectedToday: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReviewModerationPage() {
  return (
    <ProtectedRoute allowedRoles={['OWNER', 'DISPATCHER']}>
      <ModerationContent />
    </ProtectedRoute>
  );
}

function ModerationContent() {
  const queryClient = useQueryClient();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Fetch queue stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['moderation-stats'],
    queryFn: () => apiRequest<QueueStats>('/marketplace/moderation/stats'),
    refetchInterval: 30000,
  });

  const stats = statsData?.data;

  // Fetch moderation queue
  const { data: queueData, isLoading: queueLoading, refetch } = useQuery({
    queryKey: ['moderation-queue', riskFilter],
    queryFn: () =>
      apiRequest<{ items: ModerationQueueItem[]; total: number }>(
        `/marketplace/moderation/queue?${riskFilter !== 'all' ? `minFraudScore=${riskFilter === 'high' ? 60 : 30}` : ''}`
      ),
    refetchInterval: 30000,
  });

  const queueItems = queueData?.data?.items || [];

  // Filter items by search query (accent-insensitive)
  const filteredItems = queueItems.filter((item) => {
    if (!searchQuery) return true;
    return searchMatchesAny(
      [item.review.consumerName, item.review.businessName, item.review.comment],
      searchQuery
    );
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await apiRequest(`/marketplace/moderation/${reviewId}/approve`, {
        method: 'POST',
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to approve');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-stats'] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ reviewId, reason }: { reviewId: string; reason: string }) => {
      const response = await apiRequest(`/marketplace/moderation/${reviewId}/reject`, {
        method: 'POST',
        body: { reason },
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to reject');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-stats'] });
    },
  });

  // Bulk approve
  const handleBulkApprove = async () => {
    for (const reviewId of Array.from(selectedItems)) {
      try {
        await approveMutation.mutateAsync(reviewId);
      } catch (error) {
        console.error(`Failed to approve ${reviewId}:`, error);
      }
    }
    setSelectedItems(new Set());
  };

  // Handle item expand
  const toggleExpand = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  // Toggle selection
  const toggleSelection = (reviewId: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(reviewId)) {
      newSet.delete(reviewId);
    } else {
      newSet.add(reviewId);
    }
    setSelectedItems(newSet);
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get fraud score color
  const getFraudScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-50';
    if (score >= 40) return 'text-orange-600 bg-orange-50';
    if (score >= 20) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  // Render stars
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-4 w-4',
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            )}
          />
        ))}
      </div>
    );
  };

  const isLoading = statsLoading || queueLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Moderacion de resenas</h1>
            <p className="text-gray-500">
              Revisa y modera las resenas del marketplace
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedItems.size > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={approveMutation.isPending}
              className="btn-primary"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprobar seleccionadas ({selectedItems.size})
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-outline"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-5">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2 text-yellow-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pendientes</p>
              <p className="text-2xl font-bold">{stats?.pending || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Alto riesgo</p>
              <p className="text-2xl font-bold text-red-600">{stats?.highRisk || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aprobadas hoy</p>
              <p className="text-2xl font-bold text-green-600">
                {stats?.approvedToday || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rechazadas hoy</p>
              <p className="text-2xl font-bold">{stats?.rejectedToday || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2 text-blue-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Procesadas total</p>
              <p className="text-2xl font-bold">{stats?.processed || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por consumidor, negocio o contenido..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todas las resenas</option>
            <option value="high">Alto riesgo (60%+)</option>
            <option value="medium">Riesgo medio (30%+)</option>
          </select>
        </div>
      </div>

      {/* Queue List */}
      <div className="space-y-4">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-gray-100" />
          ))
        ) : filteredItems.length === 0 ? (
          <div className="card p-12 text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-lg font-medium text-gray-900">
              No hay resenas pendientes
            </p>
            <p className="mt-1 text-gray-500">
              Todas las resenas han sido revisadas
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedItem === item.id;
            const isSelected = selectedItems.has(item.reviewId);

            return (
              <div
                key={item.id}
                className={cn(
                  'card overflow-hidden transition-all',
                  isSelected && 'ring-2 ring-primary-500'
                )}
              >
                {/* Main content */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Selection checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(item.reviewId)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />

                    {/* Fraud score indicator */}
                    <div
                      className={cn(
                        'flex-shrink-0 rounded-lg px-3 py-2 text-center',
                        getFraudScoreColor(item.fraudScore)
                      )}
                    >
                      <div className="text-xs font-medium uppercase">Riesgo</div>
                      <div className="text-2xl font-bold">{item.fraudScore}%</div>
                    </div>

                    {/* Review content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          {/* Rating */}
                          <div className="flex items-center gap-2 mb-1">
                            {renderStars(item.review.overallRating)}
                            <span className="text-sm text-gray-500">
                              {item.review.overallRating}/5
                            </span>
                          </div>

                          {/* Consumer and Business */}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span className="inline-flex items-center gap-1 text-gray-700">
                              <User className="h-4 w-4 text-gray-400" />
                              {item.review.consumerName}
                            </span>
                            <span className="inline-flex items-center gap-1 text-gray-700">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              {item.review.businessName}
                            </span>
                          </div>
                        </div>

                        {/* Priority badge */}
                        {item.priority > 0 && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                              item.priority >= 2
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            )}
                          >
                            <Zap className="h-3 w-3" />
                            Prioridad {item.priority}
                          </span>
                        )}
                      </div>

                      {/* Comment preview */}
                      {item.review.comment && (
                        <p className="mt-2 text-gray-600 line-clamp-2">
                          "{item.review.comment}"
                        </p>
                      )}

                      {/* Photos indicator */}
                      {item.review.photos.length > 0 && (
                        <span className="mt-2 inline-flex items-center gap-1 text-sm text-gray-500">
                          <Image className="h-4 w-4" />
                          {item.review.photos.length} foto
                          {item.review.photos.length > 1 ? 's' : ''}
                        </span>
                      )}

                      {/* Fraud signals summary */}
                      {item.fraudSignals.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.fraudSignals.slice(0, 3).map((signal, index) => (
                            <span
                              key={index}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                                getSeverityColor(signal.severity)
                              )}
                            >
                              <Flag className="h-3 w-3" />
                              {signal.type.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {item.fraudSignals.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{item.fraudSignals.length - 3} mas
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() =>
                          approveMutation.mutate(item.reviewId)
                        }
                        disabled={approveMutation.isPending}
                        className="btn-outline text-sm px-3 py-1.5 text-green-600 hover:bg-green-50"
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Aprobar
                      </button>
                      <button
                        onClick={() =>
                          rejectMutation.mutate({
                            reviewId: item.reviewId,
                            reason: 'Fraude detectado',
                          })
                        }
                        disabled={rejectMutation.isPending}
                        className="btn-outline text-sm px-3 py-1.5 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="btn-outline text-sm px-3 py-1.5"
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        {isExpanded ? 'Menos' : 'Mas'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Review details */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">
                          Detalle de la resena
                        </h4>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">ID de resena:</dt>
                            <dd className="font-mono text-gray-700">
                              {item.reviewId.slice(0, 8)}...
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Fecha:</dt>
                            <dd className="text-gray-700">
                              {new Date(item.review.createdAt).toLocaleDateString(
                                'es-AR',
                                {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Motivo en cola:</dt>
                            <dd className="text-gray-700">{item.queueReason}</dd>
                          </div>
                        </dl>

                        {/* Full comment */}
                        {item.review.comment && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-1">
                              Comentario completo:
                            </h5>
                            <p className="text-sm text-gray-600 bg-white p-3 rounded-lg border">
                              {item.review.comment}
                            </p>
                          </div>
                        )}

                        {/* Photos */}
                        {item.review.photos.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">
                              Fotos adjuntas:
                            </h5>
                            <div className="flex gap-2 flex-wrap">
                              {item.review.photos.map((photo, index) => (
                                <img
                                  key={index}
                                  src={photo}
                                  alt={`Foto ${index + 1}`}
                                  className="h-20 w-20 rounded-lg object-cover"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Fraud signals detail */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">
                          Senales de fraude detectadas
                        </h4>
                        {item.fraudSignals.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            No se detectaron senales de fraude
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {item.fraudSignals.map((signal, index) => (
                              <div
                                key={index}
                                className="bg-white p-3 rounded-lg border"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                      getSeverityColor(signal.severity)
                                    )}
                                  >
                                    {signal.severity.toUpperCase()}
                                  </span>
                                  <span className="text-sm font-medium text-gray-700">
                                    {signal.score}%
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-900">
                                  {signal.type.replace(/_/g, ' ')}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {signal.description}
                                </p>
                                {signal.details && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-gray-500 cursor-pointer">
                                      Ver detalles
                                    </summary>
                                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                      {JSON.stringify(signal.details, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions bar */}
                    <div className="mt-6 flex items-center justify-between border-t pt-4">
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/marketplace/consumers/${item.review.consumerId}`}
                          className="btn-outline text-sm"
                        >
                          <User className="mr-1 h-4 w-4" />
                          Ver consumidor
                        </Link>
                        <Link
                          href={`/dashboard/marketplace/businesses/${item.review.businessProfileId}`}
                          className="btn-outline text-sm"
                        >
                          <Building2 className="mr-1 h-4 w-4" />
                          Ver negocio
                        </Link>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            approveMutation.mutate(item.reviewId)
                          }
                          disabled={approveMutation.isPending}
                          className="btn-primary text-sm"
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Aprobar resena
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt(
                              'Motivo del rechazo:',
                              'Contenido fraudulento detectado'
                            );
                            if (reason) {
                              rejectMutation.mutate({
                                reviewId: item.reviewId,
                                reason,
                              });
                            }
                          }}
                          disabled={rejectMutation.isPending}
                          className="btn-outline text-sm text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Rechazar con motivo
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination placeholder */}
      {queueData?.data?.total && queueData.data.total > 20 && (
        <div className="flex justify-center">
          <p className="text-sm text-gray-500">
            Mostrando {filteredItems.length} de {queueData.data.total} resenas
          </p>
        </div>
      )}
    </div>
  );
}
