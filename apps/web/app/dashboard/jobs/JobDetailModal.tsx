'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  X,
  User,
  MapPin,
  Calendar,
  Clock,
  Phone,
  Edit2,
  Briefcase,
  FileText,
  MessageCircle,
  Copy,
  Wrench,
  CheckCircle,
  XCircle,
  Truck,
  ChevronRight,
  ExternalLink,
  CalendarDays,
  Repeat,
} from 'lucide-react';
import { cn, formatCurrency, formatPhone, formatAddress, formatDate, formatDateTime, getInitials, JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/lib/utils';
import { Job } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Job type already includes customer and assignments
type JobDetail = Job;

interface JobDetailModalProps {
  jobId: string | null;
  onClose: () => void;
  onEdit?: (jobId: string) => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 border-gray-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  INSTALACION_SPLIT: 'Instalación Split',
  REPARACION_SPLIT: 'Reparación Split',
  MANTENIMIENTO_SPLIT: 'Mantenimiento Split',
  INSTALACION_CALEFACTOR: 'Instalación Calefactor',
  REPARACION_CALEFACTOR: 'Reparación Calefactor',
  MANTENIMIENTO_CALEFACTOR: 'Mantenimiento Calefactor',
  OTRO: 'Otro',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function JobDetailModal({
  jobId,
  onClose,
  onEdit,
}: JobDetailModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch job details
  const { data, isLoading, error } = useQuery({
    queryKey: ['job-detail', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Error fetching job');
      return res.json();
    },
    enabled: !!jobId,
  });

  const job: JobDetail | null = data?.data || null;

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Error updating status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Don't render if no job selected
  if (!jobId) return null;

  const handleWhatsApp = () => {
    if (job?.customer?.phone) {
      const cleanPhone = job.customer.phone.replace(/\D/g, '');
      const whatsappPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
      const message = `Hola ${job.customer.name}, le escribimos de CampoTech respecto al trabajo ${job.jobNumber} programado para el ${job.scheduledDate ? formatDate(job.scheduledDate) : 'próximamente'}.`;
      window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const handleViewFull = () => {
    router.push(`/dashboard/jobs/${jobId}`);
    onClose();
  };

  const handleDuplicate = () => {
    if (job) {
      router.push(`/dashboard/jobs/new?customerId=${job.customerId}&serviceType=${job.serviceType}&description=${encodeURIComponent(job.description || '')}`);
      onClose();
    }
  };

  const handleCreateInvoice = () => {
    if (job) {
      router.push(`/dashboard/invoices/new?jobId=${job.id}&customerId=${job.customerId}`);
      onClose();
    }
  };

  const handleViewCustomer = () => {
    if (job?.customerId) {
      router.push(`/dashboard/customers/${job.customerId}`);
      onClose();
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (confirm(`¿Cambiar estado a "${JOB_STATUS_LABELS[newStatus]}"?`)) {
      statusMutation.mutate(newStatus);
    }
  };

  // Parse time slot
  let timeSlot = '';
  if (job?.scheduledTimeStart && job?.scheduledTimeEnd) {
    timeSlot = `${job.scheduledTimeStart} - ${job.scheduledTimeEnd}`;
  } else if (job?.scheduledTimeStart) {
    timeSlot = job.scheduledTimeStart;
  }

  // Get display address
  const displayAddress = job?.address || formatAddress(job?.customer?.address) || '';

  // Service type label
  const serviceTypeLabel = job?.serviceType ? (SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType.replace(/_/g, ' ')) : '';

  // Check if job is completed/cancelled
  const isCompleted = job?.status === 'COMPLETED';
  const isCancelled = job?.status === 'CANCELLED';
  const isFinal = isCompleted || isCancelled;

  // Format price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceValue = (job as any)?.estimatedPrice || (job as any)?.total;
  const formattedPrice = priceValue ? formatCurrency(Number(priceValue)) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          {isLoading ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="h-12 w-12 rounded-lg bg-gray-200" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          ) : job ? (
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">
                    {serviceTypeLabel || job.description || 'Trabajo'}
                  </h2>
                  <span className={cn(
                    'px-2.5 py-0.5 text-xs font-medium rounded-full',
                    JOB_STATUS_COLORS[job.status]
                  )}>
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                  {job.priority && job.priority !== 'normal' && (
                    <span className={cn(
                      'px-2 py-0.5 text-xs font-medium rounded-full border',
                      PRIORITY_COLORS[job.priority]
                    )}>
                      {PRIORITY_LABELS[job.priority]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{job.jobNumber}</p>
              </div>
            </div>
          ) : null}

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4 animate-pulse">
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-500">Error al cargar el trabajo</p>
            </div>
          ) : job ? (
            <>
              {/* Job Details Section */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Detalles
                </h3>
                <div className="space-y-3">
                  {job.description && (
                    <p className="text-gray-700">{job.description}</p>
                  )}

                  {/* Date & Time */}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">
                      {job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha programada'}
                    </span>
                    {timeSlot && (
                      <>
                        <Clock className="h-4 w-4 text-gray-400 ml-2" />
                        <span className="text-gray-700">{timeSlot}</span>
                      </>
                    )}
                  </div>

                  {/* Address */}
                  {displayAddress && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">{displayAddress}</span>
                    </div>
                  )}

                  {/* Price */}
                  {formattedPrice && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-semibold text-gray-900">{formattedPrice}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Section */}
              {job.customer && (
                <div className="p-6 border-b">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Cliente
                  </h3>
                  <div
                    onClick={handleViewCustomer}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium">
                        {getInitials(job.customer.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{job.customer.name}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="h-3 w-3" />
                          {formatPhone(job.customer.phone)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              )}

              {/* Technicians Section */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Técnicos Asignados
                </h3>
                {job.assignments && job.assignments.length > 0 ? (
                  <div className="space-y-2">
                    {job.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="h-10 w-10 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{assignment.technician?.name}</p>
                          <p className="text-xs text-gray-500">
                            Asignado: {formatDate(assignment.assignedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Sin técnicos asignados</span>
                    {!isFinal && (
                      <button
                        onClick={handleViewFull}
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Asignar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Visits Section (for multi-visit jobs) */}
              {(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const jobAny = job as any;
                const visits = jobAny.visits || [];
                const durationType = jobAny.durationType || 'SINGLE_VISIT';
                const isMultiVisit = durationType === 'MULTIPLE_VISITS' || durationType === 'RECURRING' || visits.length > 1;

                if (!isMultiVisit && visits.length === 0) return null;

                return (
                  <div className="p-6 border-b">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      {durationType === 'RECURRING' ? (
                        <>
                          <Repeat className="h-4 w-4" />
                          Visitas Recurrentes
                        </>
                      ) : (
                        <>
                          <CalendarDays className="h-4 w-4" />
                          Visitas Programadas ({visits.length})
                        </>
                      )}
                    </h3>
                    {visits.length > 0 ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {visits.map((visit: any) => {
                          const visitTimeSlot = visit.scheduledTimeSlot as { start?: string; end?: string } | null;
                          const visitTime = visitTimeSlot?.start && visitTimeSlot?.end
                            ? `${visitTimeSlot.start} - ${visitTimeSlot.end}`
                            : visitTimeSlot?.start || '';

                          return (
                            <div
                              key={visit.id}
                              className={cn(
                                'flex items-center justify-between p-3 rounded-lg border',
                                visit.status === 'COMPLETED' ? 'bg-green-50 border-green-200' :
                                  visit.status === 'IN_PROGRESS' ? 'bg-orange-50 border-orange-200' :
                                    'bg-gray-50 border-gray-200'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm',
                                  visit.status === 'COMPLETED' ? 'bg-green-200 text-green-700' :
                                    visit.status === 'IN_PROGRESS' ? 'bg-orange-200 text-orange-700' :
                                      'bg-gray-200 text-gray-700'
                                )}>
                                  {visit.visitNumber}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="font-medium">{formatDate(visit.scheduledDate)}</span>
                                    {visitTime && (
                                      <>
                                        <Clock className="h-3.5 w-3.5 text-gray-400 ml-1" />
                                        <span className="text-gray-600">{visitTime}</span>
                                      </>
                                    )}
                                  </div>
                                  {visit.technician && (
                                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                      <User className="h-3 w-3" />
                                      {visit.technician.name}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className={cn(
                                'px-2 py-0.5 text-xs font-medium rounded-full',
                                JOB_STATUS_COLORS[visit.status]
                              )}>
                                {JOB_STATUS_LABELS[visit.status]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {durationType === 'RECURRING'
                          ? 'Las visitas recurrentes se generarán automáticamente'
                          : 'No hay visitas programadas'
                        }
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Status Actions (if not final) */}
              {!isFinal && (
                <div className="p-6 border-b">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Cambiar Estado
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {job.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleStatusChange('ASSIGNED')}
                          disabled={statusMutation.isPending}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                        >
                          <Calendar className="h-4 w-4" />
                          Marcar Asignado
                        </button>
                      </>
                    )}
                    {job.status === 'ASSIGNED' && (
                      <button
                        onClick={() => handleStatusChange('EN_ROUTE')}
                        disabled={statusMutation.isPending}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                      >
                        <Truck className="h-4 w-4" />
                        En Camino
                      </button>
                    )}
                    {job.status === 'EN_ROUTE' && (
                      <button
                        onClick={() => handleStatusChange('IN_PROGRESS')}
                        disabled={statusMutation.isPending}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                      >
                        <Wrench className="h-4 w-4" />
                        En Trabajo
                      </button>
                    )}
                    {job.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleStatusChange('COMPLETED')}
                        disabled={statusMutation.isPending}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Completar
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange('CANCELLED')}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-2 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Completion Info (if completed) */}
              {isCompleted && (
                <div className="p-6 border-b bg-green-50">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Trabajo Completado</span>
                  </div>
                  {job.completedAt && (
                    <p className="text-sm text-green-600 mt-1">
                      Finalizado el {formatDateTime(job.completedAt)}
                    </p>
                  )}
                </div>
              )}

              {/* Cancelled Info */}
              {isCancelled && (
                <div className="p-6 border-b bg-red-50">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Trabajo Cancelado</span>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Acciones
                </h3>
                <div className="flex flex-wrap gap-2">
                  {job.customer?.phone && (
                    <button
                      onClick={handleWhatsApp}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>
                  )}

                  {isCompleted && !job.invoiceId && (
                    <button
                      onClick={handleCreateInvoice}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      Crear Factura
                    </button>
                  )}

                  {onEdit && (
                    <button
                      onClick={() => onEdit(jobId!)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </button>
                  )}

                  <button
                    onClick={handleDuplicate}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </button>

                  <button
                    onClick={handleViewFull}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver Completo
                  </button>
                </div>
              </div>

              {/* Timestamps */}
              <div className="px-6 pb-6">
                <div className="text-xs text-gray-400 flex gap-4">
                  <span>Creado: {formatDateTime(job.createdAt)}</span>
                  <span>Actualizado: {formatDateTime(job.updatedAt)}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
