'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  X,
  User,
  Calendar,
  Clock,
  Briefcase,
  Wrench,
  CheckCircle,
  XCircle,
  Truck,
  ChevronRight,
  CalendarDays,
  Users,
  Car,
  History,
  Package,
  Camera,
  MessageCircle,
  ExternalLink,
  Mic,
  Receipt,
} from 'lucide-react';
import { JobReportButton } from '@/components/jobs/JobReportButton';
import VoiceInvoiceReview from './components/VoiceInvoiceReview';
import { cn, formatCurrency, formatPhone, formatAddress, formatDate, formatDateTime, JOB_STATUS_LABELS } from '@/lib/utils';
import { Job } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

type JobDetail = Job;

interface JobDetailModalProps {
  jobId: string | null;
  onClose: () => void;
  onEdit?: (jobId: string) => void;
}

type TabType = 'resumen' | 'visitas' | 'equipo' | 'facturacion' | 'historial';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'resumen', label: 'Resumen', icon: Briefcase },
  { id: 'visitas', label: 'Visitas', icon: CalendarDays },
  { id: 'equipo', label: 'Equipo', icon: Users },
  { id: 'facturacion', label: 'Facturación', icon: Receipt },
  { id: 'historial', label: 'Historial', icon: History },
];

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
// HELPER COMPONENT: Clickable Phone (opens WhatsApp)
// ═══════════════════════════════════════════════════════════════════════════════
function ClickablePhone({
  phone,
  customerName,
  jobNumber,
  scheduledDate,
  className = ''
}: {
  phone: string | null | undefined;
  customerName?: string;
  jobNumber?: string;
  scheduledDate?: string | Date | null;
  className?: string;
}) {
  if (!phone) return <span className="text-gray-400">Sin teléfono</span>;

  const cleanPhone = phone.replace(/\D/g, '');
  const whatsappPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;

  // Build default message
  const formattedDate = scheduledDate ? formatDate(scheduledDate) : 'próximamente';
  const message = customerName
    ? `Hola ${customerName}, le escribimos de CampoTech respecto al trabajo ${jobNumber || ''} programado para el ${formattedDate}.`
    : '';

  const whatsappUrl = `https://wa.me/${whatsappPhone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 hover:underline transition-colors',
        className
      )}
      title="Abrir en WhatsApp"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {formatPhone(phone)}
    </a>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function JobDetailModal({
  jobId,
  onClose,
  onEdit: _onEdit,
}: JobDetailModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('resumen');

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle visibility animation when jobId changes
  useEffect(() => {
    if (jobId) {
      // Reset to visible state with animation
      setIsVisible(false);
      const timer = setTimeout(() => setIsVisible(true), 10);
      setActiveTab('resumen');
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [jobId]);

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

  // Handle close with animation
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't render if no job selected or not mounted
  if (!jobId || !mounted) return null;

  const handleViewFull = () => {
    router.push(`/dashboard/jobs/${jobId}`);
    handleClose();
  };

  const _handleDuplicate = () => {
    if (job) {
      router.push(`/dashboard/jobs/new?customerId=${job.customerId}&serviceType=${job.serviceType}&description=${encodeURIComponent(job.description || '')}`);
      handleClose();
    }
  };

  const _handleCreateInvoice = () => {
    if (job) {
      router.push(`/dashboard/invoices/new?jobId=${job.id}&customerId=${job.customerId}`);
      handleClose();
    }
  };

  const handleViewCustomer = () => {
    if (job?.customerId) {
      router.push(`/dashboard/customers/${job.customerId}`);
      handleClose();
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

  // Get visits data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobAny = job as any;
  const visits = jobAny?.visits || [];

  // Parse title and description from combined description field
  // The NewJobModal saves as "Title\n\nDescription" format
  const parseJobText = (description: string | null | undefined) => {
    if (!description) return { title: null, desc: null };

    // Check if there's a double newline separator
    const separatorIndex = description.indexOf('\n\n');
    if (separatorIndex > 0) {
      return {
        title: description.substring(0, separatorIndex).trim(),
        desc: description.substring(separatorIndex + 2).trim() || null,
      };
    }
    // No separator - treat entire thing as title
    return { title: description.trim(), desc: null };
  };

  const { title: jobTitle, desc: jobDesc } = parseJobText(job?.description);

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200',
        isVisible ? 'bg-black/60' : 'bg-transparent pointer-events-none'
      )}
      onClick={handleClose}
    >
      <div
        className={cn(
          'bg-white rounded-2xl shadow-xl w-full max-w-2xl transform transition-all duration-200 overflow-hidden',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable content wrapper */}
        <div className="max-h-[92vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b">
            {isLoading ? (
              <div className="flex items-center gap-4 animate-pulse">
                <div className="space-y-2">
                  <div className="h-5 w-40 bg-gray-200 rounded" />
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                </div>
              </div>
            ) : job ? (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {jobTitle || 'Trabajo'}
                  </h2>
                  {/* Job number in Spanish format */}
                  <span className="text-sm text-gray-400">Trabajo-{job.jobNumber?.replace('JOB-', '')}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-gray-500">
                    {serviceTypeLabel || 'Sin tipo de servicio'}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full border',
                    job.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                      job.status === 'CANCELLED' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                        job.status === 'IN_PROGRESS' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          job.status === 'EN_ROUTE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            job.status === 'ASSIGNED' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
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
              </div>
            ) : null}

            <button
              onClick={handleClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          {job && (
            <div className="flex border-b px-6 bg-gray-50">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                      isActive
                        ? 'border-gray-900 text-gray-900 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Content */}
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
            <div className="p-6">
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* TAB: RESUMEN */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'resumen' && (
                <div className="space-y-4">
                  {/* Form-style fields like Empleados */}

                  {/* Description */}
                  {jobDesc && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                      <div className="input bg-gray-50 cursor-default text-gray-700">{jobDesc}</div>
                    </div>
                  )}

                  {/* Date and Time - 2 column grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                      <div className="input bg-gray-50 cursor-default text-gray-700">
                        {job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Horario</label>
                      <div className="input bg-gray-50 cursor-default text-gray-700">
                        {timeSlot || 'Sin horario'}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  {displayAddress && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                      <div className="input bg-gray-50 cursor-default text-gray-700">{displayAddress}</div>
                    </div>
                  )}

                  {/* Price */}
                  {formattedPrice && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                      <div className="input bg-gray-50 cursor-default text-gray-700 font-semibold">{formattedPrice}</div>
                    </div>
                  )}

                  {/* Customer - Form field style (not boxed card) */}
                  {job.customer && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del cliente</label>
                        <div
                          onClick={handleViewCustomer}
                          className="input bg-gray-50 cursor-pointer hover:bg-gray-100 text-gray-700 flex items-center justify-between"
                        >
                          <span>{job.customer.name}</span>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                        <div className="input bg-gray-50 cursor-default text-gray-700" onClick={(e) => e.stopPropagation()}>
                          <ClickablePhone
                            phone={job.customer.phone}
                            customerName={job.customer.name}
                            jobNumber={job.jobNumber}
                            scheduledDate={job.scheduledDate}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Technician(s) assigned - from assignments or technician field */}
                  {(jobAny?.assignments?.length > 0 || jobAny?.technicianId) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Técnico(s) asignado(s)</label>
                      <div className="input bg-gray-50 cursor-default text-gray-700">
                        {jobAny?.assignments?.length > 0
                          ? jobAny.assignments.map((a: { technician?: { name: string } }, _idx: number) =>
                            a.technician?.name
                          ).filter(Boolean).join(', ') || 'Sin asignar'
                          : jobAny?.technician?.name || 'Sin asignar'
                        }
                      </div>
                    </div>
                  )}

                  {/* Status Actions (if not final) */}
                  {!isFinal && (
                    <div className="border-t pt-4 mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estado del trabajo</label>
                      <div className="flex flex-wrap gap-2">
                        {/* PENDING status is for jobs without technicians assigned - skip to EN_ROUTE */}
                        {(job.status === 'PENDING' || job.status === 'ASSIGNED') && (
                          <button
                            onClick={() => handleStatusChange('EN_ROUTE')}
                            disabled={statusMutation.isPending}
                            className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                          >
                            <Truck className="h-4 w-4" />
                            En Camino
                          </button>
                        )}
                        {job.status === 'EN_ROUTE' && (
                          <button
                            onClick={() => handleStatusChange('IN_PROGRESS')}
                            disabled={statusMutation.isPending}
                            className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                          >
                            <Wrench className="h-4 w-4" />
                            En Trabajo
                          </button>
                        )}
                        {job.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleStatusChange('COMPLETED')}
                            disabled={statusMutation.isPending}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Completar
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Locked Status Info - subtle indicator */}
                  {isCompleted && (
                    <div className="border-t pt-6">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">Trabajo Completado</span>
                        {job.completedAt && (
                          <span className="text-gray-500">• {formatDateTime(job.completedAt)}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        🔒 Registro bloqueado para auditoría
                      </p>
                    </div>
                  )}

                  {isCancelled && (
                    <div className="border-t pt-6">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <XCircle className="h-4 w-4" />
                        <span className="font-medium">Trabajo Cancelado</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        🔒 Registro bloqueado para auditoría
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* TAB: VISITAS */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'visitas' && (
                <div className="space-y-4">
                  {visits.length > 0 ? (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    visits.map((visit: any) => {
                      const visitTimeSlot = visit.scheduledTimeSlot as { start?: string; end?: string } | null;
                      const visitTime = visitTimeSlot?.start && visitTimeSlot?.end
                        ? `${visitTimeSlot.start} - ${visitTimeSlot.end}`
                        : visitTimeSlot?.start || '';

                      // Phase 6: Vehicle assignments
                      const vehicleAssignments = visit.vehicleAssignments || [];

                      return (
                        <div
                          key={visit.id}
                          className={cn(
                            'rounded-lg border p-4',
                            visit.status === 'COMPLETED' ? 'border-l-4 border-l-green-500 border-gray-200' :
                              visit.status === 'IN_PROGRESS' ? 'border-l-4 border-l-orange-500 border-gray-200' :
                                'border-gray-200'
                          )}
                        >
                          {/* Visit Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-gray-100 text-gray-700">
                                {visit.visitNumber}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 font-medium text-sm">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span>{formatDate(visit.scheduledDate)}</span>
                                </div>
                                {visitTime && (
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>{visitTime}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded-full border',
                              visit.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                                visit.status === 'IN_PROGRESS' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  visit.status === 'CANCELLED' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                    'bg-amber-50 text-amber-700 border-amber-200'
                            )}>
                              {JOB_STATUS_LABELS[visit.status]}
                            </span>
                          </div>

                          {/* Technician for visit */}
                          {visit.technician && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3 pl-13">
                              <User className="h-4 w-4 text-gray-400" />
                              <span>{visit.technician.name}</span>
                            </div>
                          )}

                          {/* Phase 6: Vehicle Assignments */}
                          {vehicleAssignments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
                                <Car className="h-3.5 w-3.5" />
                                Vehículos Asignados
                              </div>
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {vehicleAssignments.map((va: any) => (
                                <div
                                  key={va.id}
                                  className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-primary-500" />
                                    <span className="font-medium text-sm">
                                      {va.vehicle?.make} {va.vehicle?.model}
                                    </span>
                                    {va.vehicle?.plateNumber && (
                                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                        {va.vehicle.plateNumber}
                                      </span>
                                    )}
                                  </div>
                                  {va.drivers && va.drivers.length > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1 ml-6">
                                      <Users className="h-3.5 w-3.5" />
                                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                      <span>Conductores: {va.drivers.map((d: any) => d.user?.name).join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CalendarDays className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay visitas programadas</p>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* TAB: EQUIPO */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'equipo' && (
                <div className="space-y-5">
                  {/* Technicians */}
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Users className="h-4 w-4 text-primary-500" />
                      Técnicos Asignados
                    </h3>
                    {job.assignments && job.assignments.length > 0 ? (
                      <div className="space-y-2">
                        {job.assignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white"
                          >
                            <div className="h-10 w-10 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{assignment.technician?.name}</p>
                              <p className="text-xs text-gray-500">
                                Asignado: {formatDate(assignment.assignedAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                        <span className="text-gray-500">Sin técnicos asignados</span>
                        {!isFinal && (
                          <button
                            onClick={handleViewFull}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Asignar
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Vehicle (legacy single vehicle) */}
                  {job.vehicle && (
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Truck className="h-4 w-4 text-primary-500" />
                        Vehículo Principal
                      </h3>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                        <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                          <Truck className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {job.vehicle.make} {job.vehicle.model}
                          </p>
                          <p className="text-xs text-gray-500">{job.vehicle.plateNumber}</p>
                        </div>
                      </div>

                      {/* Mileage info */}
                      {job.vehicleMileageStart && (
                        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
                          <p className="text-gray-600">
                            <span className="font-medium">Km inicio:</span> {job.vehicleMileageStart.toLocaleString()}
                          </p>
                          {job.vehicleMileageEnd && (
                            <>
                              <p className="text-gray-600">
                                <span className="font-medium">Km fin:</span> {job.vehicleMileageEnd.toLocaleString()}
                              </p>
                              <p className="text-gray-800 font-medium">
                                Recorrido: {(job.vehicleMileageEnd - job.vehicleMileageStart).toLocaleString()} km
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* TAB: FACTURACIÓN (Phase 6: Voice-to-Invoice) */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'facturacion' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Mic className="h-4 w-4 text-primary-500" />
                      Reporte de Voz a Factura
                    </h3>
                    <span className="text-xs text-gray-500 bg-primary-50 px-2 py-1 rounded-full">
                      IA Asistida
                    </span>
                  </div>

                  <p className="text-sm text-gray-600">
                    Utilizá el reporte de voz para generar automáticamente los items de facturación.
                    La IA extraerá partes, materiales y servicios de tu descripción.
                  </p>

                  <VoiceInvoiceReview
                    jobId={job.id}
                    onComplete={(result) => {
                      // Refresh job data after applying line items
                      queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] });
                      queryClient.invalidateQueries({ queryKey: ['jobs'] });
                      console.log('Voice invoice completed:', result);
                    }}
                    onCancel={() => {
                      // Switch back to summary tab
                      setActiveTab('resumen');
                    }}
                  />
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* TAB: HISTORIAL */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'historial' && (
                <div className="space-y-5">
                  {/* Completion Info */}
                  {isCompleted && (
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Información de Finalización
                      </h3>
                      <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-3">
                        {job.completedAt && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Completado:</span> {formatDateTime(job.completedAt)}
                          </p>
                        )}
                        {job.actualDuration && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Duración real:</span> {job.actualDuration} min
                          </p>
                        )}
                        {job.resolution && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Resolución:</p>
                            <p className="text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-100">{job.resolution}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Photos */}
                  {job.photos && job.photos.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Camera className="h-4 w-4 text-primary-500" />
                        Fotos ({job.photos.length})
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {job.photos.map((photo, index) => (
                          <a
                            key={index}
                            href={photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square overflow-hidden rounded-lg bg-gray-100 hover:opacity-80 transition-opacity"
                          >
                            <img
                              src={photo}
                              alt={`Foto ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customer Signature */}
                  {job.customerSignature && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Firma del cliente</h3>
                      <div className="w-48 rounded-lg border border-gray-200 bg-white p-2">
                        <img
                          src={job.customerSignature}
                          alt="Firma"
                          className="h-auto w-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Materials Used */}
                  {job.materialsUsed && Array.isArray(job.materialsUsed) && job.materialsUsed.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Package className="h-4 w-4 text-primary-500" />
                        Materiales Utilizados
                      </h3>
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left py-2 px-3 font-medium text-gray-700">Producto</th>
                              <th className="text-center py-2 px-3 font-medium text-gray-700">Cant.</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-700">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {job.materialsUsed.map((material, idx) => (
                              <tr key={idx} className="border-t border-gray-100">
                                <td className="py-2 px-3">{material.name}</td>
                                <td className="text-center py-2 px-3">{material.quantity}</td>
                                <td className="text-right py-2 px-3">{formatCurrency(material.quantity * material.unitPrice)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-200 bg-gray-50 font-medium">
                              <td colSpan={2} className="py-2 px-3 text-right">Total:</td>
                              <td className="text-right py-2 px-3">
                                {formatCurrency(
                                  job.materialsUsed.reduce(
                                    (sum, m) => sum + m.quantity * m.unitPrice,
                                    0
                                  )
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Registro</h3>
                    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Creado</span>
                        <span className="text-gray-700">{formatDateTime(job.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Actualizado</span>
                        <span className="text-gray-700">{formatDateTime(job.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Empty state for non-completed jobs */}
                  {!isCompleted && !job.photos?.length && !job.materialsUsed?.length && (
                    <div className="text-center py-8 text-gray-500">
                      <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>El historial se completará cuando finalice el trabajo</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* Footer Actions - matching Empleados pattern */}
          {job && (
            <div className="flex-shrink-0 border-t px-4 py-3 flex items-center justify-between">
              <div className="flex gap-2">
                {/* WhatsApp button - green outline */}
                {job.customer?.phone && (
                  <button
                    onClick={() => {
                      const cleanPhone = job.customer!.phone!.replace(/\D/g, '');
                      const whatsappPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
                      window.open(`https://wa.me/${whatsappPhone}`, '_blank');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </button>
                )}

                {/* Job Report button - download PDF */}
                <JobReportButton
                  jobId={job.id}
                  jobNumber={job.jobNumber}
                  jobStatus={job.status}
                  variant="compact"
                />

                {/* Cancelar button - red outline (cancels job if not final) */}
                {!isFinal && (
                  <button
                    onClick={() => handleStatusChange('CANCELLED')}
                    disabled={statusMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {/* Cancelar modal button - like Empleados */}
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>

                {/* Guardar / Ver Completo - solid green like Empleados */}
                <button
                  onClick={handleViewFull}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver Completo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
