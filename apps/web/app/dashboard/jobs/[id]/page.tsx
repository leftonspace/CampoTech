'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import {
  cn,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatAddress,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
} from '@/lib/utils';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  MapPin,
  Calendar,
  Clock,
  User,
  Users,
  Phone,
  FileText,
  Camera,
  CheckCircle,
  AlertCircle,
  Truck,
  Wrench,
  Play,
  Pause,
  XCircle,
  AlertTriangle,
  MessageCircle,
  Copy,
  Printer,
  Package,
  DollarSign,
  Plus,
} from 'lucide-react';
import { Job, User as UserType, Customer, JobPriority } from '@/types';
import { JobMaterialUsagePanel } from '@/components/inventory/JobMaterialUsagePanel';

// Form-specific interface for editing jobs
// Uses separate time fields for UX, converted to scheduledTimeSlot on save
interface JobEditFormData {
  description?: string;
  address?: string;
  priority?: JobPriority;
  serviceType?: string;
  customerId?: string;
  scheduledDate?: string;
  scheduledTimeStart?: string;
  scheduledTimeEnd?: string;
}

// Availability data from API
interface AvailableEmployee {
  id: string;
  name: string;
  phone: string;
  isAvailable: boolean;
  scheduleInfo: {
    startTime: string;
    endTime: string;
    isException: boolean;
    exceptionReason?: string;
  } | null;
  currentJobCount: number;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

// Valid status transitions (using database enum values)
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['EN_ROUTE', 'PENDING', 'CANCELLED'],
  EN_ROUTE: ['IN_PROGRESS', 'ASSIGNED'],
  IN_PROGRESS: ['COMPLETED', 'EN_ROUTE'],
  COMPLETED: [],
  CANCELLED: ['PENDING'],
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const jobId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<JobEditFormData>({});
  const [showMaterialsPanel, setShowMaterialsPanel] = useState(false);
  const [materialUsageMessage, setMaterialUsageMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-enable edit mode if ?edit=true is present
  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setIsEditing(true);
    }
  }, [searchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.jobs.get(jobId),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.users.list(),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => api.customers.list(),
  });

  // Cast job data for type safety
  const jobData = data?.data as Job | undefined;

  // Fetch availability when job has a scheduled date
  const scheduledDateStr = jobData?.scheduledDate?.split('T')[0];
  // Use separate time field from Prisma schema
  const scheduledTimeStr = jobData?.scheduledTimeStart;

  const { data: availabilityData } = useQuery({
    queryKey: ['employee-availability', scheduledDateStr, scheduledTimeStr],
    queryFn: async () => {
      const params = new URLSearchParams({ date: scheduledDateStr! });
      if (scheduledTimeStr) params.append('time', scheduledTimeStr);
      const res = await fetch(`/api/employees/availability?${params}`);
      return res.json();
    },
    enabled: !!scheduledDateStr,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Job>) => api.jobs.update(jobId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      setIsEditing(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.jobs.updateStatus(jobId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string) => api.jobs.assign(jobId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (userId: string) => api.jobs.unassign(jobId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  const job = data?.data as Job | undefined;
  const teamMembers = usersData?.data as UserType[] | undefined;
  const customers = customersData?.data as Customer[] | undefined;

  // Build availability map for quick lookup
  const availabilityMap = new Map<string, AvailableEmployee>();
  if (availabilityData?.data?.employees) {
    (availabilityData.data.employees as AvailableEmployee[]).forEach((emp) => {
      availabilityMap.set(emp.id, emp);
    });
  }

  // Get team members sorted by availability
  const getSortedTeamMembers = () => {
    if (!teamMembers) return [];

    const filtered = teamMembers.filter(
      (member) => !job?.assignments?.some((a) => a.technicianId === member.id)
    );

    // If we have availability data, sort by it
    if (availabilityMap.size > 0) {
      return filtered.sort((a, b) => {
        const aAvail = availabilityMap.get(a.id);
        const bAvail = availabilityMap.get(b.id);

        // Available first
        if (aAvail?.isAvailable && !bAvail?.isAvailable) return -1;
        if (!aAvail?.isAvailable && bAvail?.isAvailable) return 1;

        // Then by job count (less busy first)
        const aJobs = aAvail?.currentJobCount || 0;
        const bJobs = bAvail?.currentJobCount || 0;
        return aJobs - bJobs;
      });
    }

    return filtered;
  };

  const handleEdit = () => {
    if (job) {
      setEditData({
        description: job.description || '',
        address: formatAddress(job.address || job.customer?.address),
        priority: job.priority,
        serviceType: job.serviceType || '',
        customerId: job.customerId,
        scheduledDate: job.scheduledDate?.split('T')[0] || '',
        scheduledTimeStart: job.scheduledTimeStart || '',
        scheduledTimeEnd: job.scheduledTimeEnd || '',
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    // Pass form data directly - API uses separate time fields
    updateMutation.mutate(editData as Partial<Job>);
  };

  const handleStatusChange = (newStatus: string) => {
    if (confirm(`¿Cambiar estado a "${JOB_STATUS_LABELS[newStatus]}"?`)) {
      statusMutation.mutate(newStatus);
    }
  };

  const handleAssign = (userId: string) => {
    const availability = availabilityMap.get(userId);
    const member = teamMembers?.find((m) => m.id === userId);

    // If not available, show warning and ask for confirmation
    if (availability && !availability.isAvailable) {
      const reason = availability.scheduleInfo?.isException
        ? availability.scheduleInfo.exceptionReason || 'Día libre'
        : 'Fuera de horario de trabajo';

      if (
        !confirm(
          `⚠️ ${member?.name || 'Este técnico'} no está disponible.\n\nMotivo: ${reason}\n\n¿Deseas asignarlo de todos modos?`
        )
      ) {
        return;
      }
    }

    assignMutation.mutate(userId);
  };

  const handleUnassign = (userId: string, technicianName: string) => {
    if (confirm(`¿Desasignar a ${technicianName} de este trabajo?`)) {
      unassignMutation.mutate(userId);
    }
  };

  const getNextActions = (status: string) => {
    const transitions = STATUS_TRANSITIONS[status] || [];
    return transitions.map((s) => ({
      status: s,
      label: JOB_STATUS_LABELS[s],
      icon: getStatusIcon(s),
      color: getStatusButtonColor(s),
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return Calendar;
      case 'EN_ROUTE':
        return Truck;
      case 'IN_PROGRESS':
        return Wrench;
      case 'COMPLETED':
        return CheckCircle;
      case 'CANCELLED':
        return XCircle;
      case 'PENDING':
        return Pause;
      default:
        return Play;
    }
  };

  const getStatusButtonColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'btn-primary';
      case 'CANCELLED':
        return 'btn-danger';
      case 'EN_ROUTE':
        return 'bg-purple-600 text-white hover:bg-purple-700';
      case 'IN_PROGRESS':
        return 'bg-orange-600 text-white hover:bg-orange-700';
      default:
        return 'btn-outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/jobs"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trabajo no encontrado</h1>
          </div>
        </div>
        <div className="card p-8 text-center">
          <p className="text-gray-500">Este trabajo no existe o no tenés acceso.</p>
          <Link href="/dashboard/jobs" className="btn-primary mt-4 inline-flex">
            Volver a trabajos
          </Link>
        </div>
      </div>
    );
  }

  const nextActions = getNextActions(job.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/jobs"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {job.serviceType?.replace(/_/g, ' ') || job.description || 'Trabajo'}
            </h1>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium',
                JOB_STATUS_COLORS[job.status]
              )}
            >
              {JOB_STATUS_LABELS[job.status]}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                PRIORITY_COLORS[job.priority]
              )}
            >
              {PRIORITY_LABELS[job.priority]}
            </span>
          </div>
          <p className="text-gray-500">Trabajo {job.jobNumber?.replace('JOB-', 'Nº ') || `Nº ${job.id.slice(0, 8)}`}</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="btn-outline">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          ) : (
            <button onClick={handleEdit} className="btn-outline">
              <Edit2 className="mr-2 h-4 w-4" />
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Status actions */}
      {!isEditing && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Direct status dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Estado:</span>
              <select
                value={job.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusMutation.isPending}
                className="input w-auto py-1.5 text-sm"
              >
                <option value="PENDING">Pendiente</option>
                <option value="ASSIGNED">Asignado</option>
                <option value="EN_ROUTE">En camino</option>
                <option value="IN_PROGRESS">En trabajo</option>
                <option value="COMPLETED">Completado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>

            {/* Quick action buttons for common transitions */}
            {nextActions.length > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-500">Acciones rápidas:</span>
                {nextActions.map(({ status, label, icon: Icon, color }) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={statusMutation.isPending}
                    className={cn('inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium', color)}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job details */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Detalles del trabajo</h2>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="label mb-1 block">Descripción del trabajo</label>
                  <textarea
                    value={editData.description || ''}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                    placeholder="Detalles del trabajo a realizar..."
                    className="input"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1 block">Cliente</label>
                    <select
                      value={editData.customerId || ''}
                      onChange={(e) => setEditData({ ...editData, customerId: e.target.value })}
                      className="input"
                    >
                      <option value="">Seleccionar cliente...</option>
                      {customers?.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1 block">Tipo de servicio</label>
                    <input
                      type="text"
                      value={editData.serviceType || ''}
                      onChange={(e) => setEditData({ ...editData, serviceType: e.target.value })}
                      placeholder="Ej: Instalación, Mantenimiento, Reparación"
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="label mb-1 block">Dirección</label>
                  <input
                    type="text"
                    value={editData.address || ''}
                    onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                    placeholder="Dirección donde se realizará el trabajo"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Prioridad</label>
                  <select
                    value={editData.priority || 'normal'}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value as JobPriority })}
                    className="input"
                  >
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="label mb-1 block">Fecha</label>
                    <input
                      type="date"
                      value={editData.scheduledDate || ''}
                      onChange={(e) => setEditData({ ...editData, scheduledDate: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">Hora inicio</label>
                    <input
                      type="time"
                      value={editData.scheduledTimeStart || ''}
                      onChange={(e) => setEditData({ ...editData, scheduledTimeStart: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block">Hora fin</label>
                    <input
                      type="time"
                      value={editData.scheduledTimeEnd || ''}
                      onChange={(e) => setEditData({ ...editData, scheduledTimeEnd: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {job.serviceType && (
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-700">{job.serviceType}</span>
                  </div>
                )}
                {job.description && (
                  <div>
                    <p className="text-gray-700">{job.description}</p>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-gray-400" />
                  <span className="text-gray-700">{formatAddress(job.address || job.customer?.address) || 'Sin dirección'}</span>
                </div>
                {job.scheduledDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-700">{formatDate(job.scheduledDate)}</span>
                    {(job.scheduledTimeStart || job.scheduledTimeEnd) && (
                      <>
                        <Clock className="ml-2 h-5 w-5 text-gray-400" />
                        <span className="text-gray-700">
                          {job.scheduledTimeStart || '--:--'} - {job.scheduledTimeEnd || '--:--'}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {job.estimatedDuration && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-700">
                      Duración estimada: {job.estimatedDuration} min
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Material Usage Panel - Phase 2.2.2 */}
          {(job.status === 'IN_PROGRESS' || job.status === 'EN_ROUTE') && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 font-medium text-gray-900">
                  <Package className="h-5 w-5" />
                  Registrar Uso de Materiales
                </h2>
                <button
                  type="button"
                  onClick={() => setShowMaterialsPanel(!showMaterialsPanel)}
                  className="text-sm text-primary-600 hover:underline"
                >
                  {showMaterialsPanel ? 'Ocultar' : 'Expandir'}
                </button>
              </div>

              {materialUsageMessage && (
                <div className={`mb-4 rounded-lg p-3 ${materialUsageMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{materialUsageMessage.text}</span>
                    <button
                      onClick={() => setMaterialUsageMessage(null)}
                      className="text-current opacity-60 hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {showMaterialsPanel ? (
                <JobMaterialUsagePanel
                  jobId={job.id}
                  onSuccess={(summary) => {
                    setMaterialUsageMessage({ type: 'success', text: summary });
                    setShowMaterialsPanel(false);
                    queryClient.invalidateQueries({ queryKey: ['job', jobId] });
                  }}
                  onError={(error) => {
                    setMaterialUsageMessage({ type: 'error', text: error });
                  }}
                />
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm mb-3">
                    Registrá los materiales utilizados durante el trabajo
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMaterialsPanel(true)}
                    className="btn-outline inline-flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar materiales
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Completion info (if completed) */}
          {job.status === 'COMPLETED' && (
            <div className="card p-6">
              <h2 className="mb-4 font-medium text-gray-900">Información de finalización</h2>
              <div className="space-y-4">
                {job.completedAt && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-gray-700">
                      Completado el {formatDateTime(job.completedAt)}
                    </span>
                  </div>
                )}
                {job.actualDuration && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-700">
                      Duración real: {job.actualDuration} min
                    </span>
                  </div>
                )}
                {job.resolution && (
                  <div className="rounded-md bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-700">Resolución:</p>
                    <p className="mt-1 text-gray-600">{job.resolution}</p>
                  </div>
                )}
                {job.photos && job.photos.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      <Camera className="mr-1 inline h-4 w-4" />
                      Fotos ({job.photos.length})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {job.photos.map((photo, index) => (
                        <a
                          key={index}
                          href={photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square overflow-hidden rounded-md bg-gray-100"
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
                {job.customerSignature && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">Firma del cliente:</p>
                    <div className="w-48 rounded-md border bg-white p-2">
                      <img
                        src={job.customerSignature}
                        alt="Firma"
                        className="h-auto w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Materials Used Section */}
          {job.status === 'COMPLETED' && (
            <div className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-medium text-gray-900">
                <Package className="h-5 w-5" />
                Materiales Utilizados
              </h2>
              {job.materialsUsed && Array.isArray(job.materialsUsed) && job.materialsUsed.length > 0 ? (
                <div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-gray-700">Producto</th>
                        <th className="text-center py-2 font-medium text-gray-700">Cant.</th>
                        <th className="text-right py-2 font-medium text-gray-700">P. Unit.</th>
                        <th className="text-right py-2 font-medium text-gray-700">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.materialsUsed.map((material, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2">{material.name}</td>
                          <td className="text-center py-2">{material.quantity}</td>
                          <td className="text-right py-2">{formatCurrency(material.unitPrice)}</td>
                          <td className="text-right py-2">{formatCurrency(material.quantity * material.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-medium">
                        <td colSpan={3} className="py-2 text-right">Total Materiales:</td>
                        <td className="text-right py-2">
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
              ) : (
                <p className="text-gray-500 text-sm">No se registraron materiales para este trabajo</p>
              )}
            </div>
          )}

          {/* Related invoice */}
          {job.invoiceId && (
            <div className="card p-6">
              <h2 className="mb-4 font-medium text-gray-900">Factura relacionada</h2>
              <Link
                href={`/dashboard/invoices/${job.invoiceId}`}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-gray-50"
              >
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-primary-600">Ver factura</span>
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer info */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Cliente</h2>
            {job.customer ? (
              <div className="space-y-3">
                <Link
                  href={`/dashboard/customers/${job.customer.id}`}
                  className="font-medium text-primary-600 hover:underline"
                >
                  {job.customer.name}
                </Link>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${job.customer.phone}`} className="hover:underline">
                    {job.customer.phone}
                  </a>
                  {/* WhatsApp button */}
                  <a
                    href={`https://wa.me/${job.customer.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hola ${job.customer.name}, le escribimos de CampoTech respecto al trabajo ${job.jobNumber} programado para el ${job.scheduledDate ? formatDate(job.scheduledDate) : 'próximamente'}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 inline-flex items-center justify-center h-7 w-7 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                    title="Enviar WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Cliente no disponible</p>
            )}
          </div>

          {/* Assignment - Multiple Technicians */}
          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-medium text-gray-900">
              <Users className="h-5 w-5" />
              Técnicos asignados
            </h2>
            {job.assignments && job.assignments.length > 0 ? (
              <div className="space-y-3">
                {job.assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{assignment.technician?.name}</p>
                      <p className="text-xs text-gray-500">
                        Asignado: {formatDate(assignment.assignedAt)}
                      </p>
                    </div>
                    {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleUnassign(assignment.technicianId, assignment.technician?.name || 'técnico')}
                        disabled={unassignMutation.isPending}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        title="Desasignar técnico"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : job.assignedTo ? (
              // Fallback to legacy single assignment
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{job.assignedTo.name}</p>
                  <p className="text-sm text-gray-500">{job.assignedTo.role}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-gray-500">Sin asignar</p>
                {!isEditing && job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                  <button
                    onClick={() => {
                      const select = document.querySelector('#technician-select') as HTMLSelectElement;
                      if (select) select.focus();
                    }}
                    className="btn-outline text-sm py-1.5 px-3"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Asignar
                  </button>
                )}
              </div>
            )}
            {!isEditing && job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
              <div className="mt-4">
                <label className="label mb-1 block text-sm">Agregar/cambiar asignación:</label>
                {job.scheduledDate && availabilityData?.data?.availableCount === 0 && (
                  <div className="mb-2 flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No hay técnicos disponibles para esta fecha/hora</span>
                  </div>
                )}
                <select
                  id="technician-select"
                  value=""
                  onChange={(e) => e.target.value && handleAssign(e.target.value)}
                  disabled={assignMutation.isPending}
                  className="input"
                >
                  <option value="">Seleccionar técnico...</option>
                  {getSortedTeamMembers().map((member) => {
                    const availability = availabilityMap.get(member.id);
                    const isAvailable = availability?.isAvailable ?? true;
                    const jobCount = availability?.currentJobCount || 0;

                    // Build status indicator
                    let status = '';
                    if (availability) {
                      if (isAvailable) {
                        status = jobCount > 0 ? ` ✓ (${jobCount} trabajos)` : ' ✓ Disponible';
                      } else {
                        status = ' ⚠ No disponible';
                      }
                    }

                    return (
                      <option key={member.id} value={member.id}>
                        {member.name}{status}
                      </option>
                    );
                  })}
                </select>
                {job.scheduledDate && (
                  <p className="mt-1 text-xs text-gray-500">
                    Disponibilidad para {formatDate(job.scheduledDate)}
                    {job.scheduledTimeStart && ` a las ${job.scheduledTimeStart}`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Acciones rápidas</h2>
            <div className="space-y-2">
              {!job.invoiceId && job.status === 'COMPLETED' && (
                <Link
                  href={`/dashboard/invoices/new?jobId=${job.id}&customerId=${job.customerId}`}
                  className="btn-primary w-full justify-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Crear factura
                </Link>
              )}

              {/* WhatsApp button */}
              {job.customer?.phone && (
                <a
                  href={`https://wa.me/${job.customer.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hola ${job.customer.name}, le escribimos de CampoTech respecto al trabajo ${job.jobNumber} programado para el ${job.scheduledDate ? formatDate(job.scheduledDate) : 'próximamente'}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline w-full justify-center"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Enviar WhatsApp
                </a>
              )}

              {/* Duplicate job */}
              <Link
                href={`/dashboard/jobs/new?customerId=${job.customerId}&serviceType=${job.serviceType}&description=${encodeURIComponent(job.description || '')}`}
                className="btn-outline w-full justify-center"
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicar trabajo
              </Link>

              {/* Print order */}
              <button
                onClick={() => window.print()}
                className="btn-outline w-full justify-center"
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir orden
              </button>

              <Link
                href={`/dashboard/jobs/new?customerId=${job.customerId}`}
                className="btn-outline w-full justify-center"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo trabajo para cliente
              </Link>

              {/* Cancel job option */}
              {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    if (confirm(`¿Estás seguro de cancelar el trabajo ${job.jobNumber}?`)) {
                      statusMutation.mutate('CANCELLED');
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="w-full rounded-lg border border-red-200 px-4 py-2 text-red-600 hover:bg-red-50 flex items-center justify-center"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar trabajo
                </button>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Historial</h2>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex justify-between">
                <span>Creado</span>
                <span>{formatDateTime(job.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Actualizado</span>
                <span>{formatDateTime(job.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


