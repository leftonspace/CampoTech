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
} from 'lucide-react';
import { Job, User as UserType, Customer } from '@/types';

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
  const [editData, setEditData] = useState<Partial<Job>>({});

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

  // Fetch availability when job has a scheduled date
  const scheduledDateStr = data?.data?.scheduledDate?.split('T')[0];
  // Extract start time from scheduledTimeSlot JSON: { start: "09:00", end: "11:00" }
  const timeSlot = data?.data?.scheduledTimeSlot as { start?: string; end?: string } | null | undefined;
  const scheduledTimeStr = timeSlot?.start;

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
        title: job.title,
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
    updateMutation.mutate(editData);
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
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
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
          <p className="text-gray-500">#{job.jobNumber || job.id.slice(0, 8)}</p>
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
                  <label className="label mb-1 block">Título</label>
                  <input
                    type="text"
                    value={editData.title || ''}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    placeholder="Ej: Instalación de aire acondicionado"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Descripción</label>
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
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value as Job['priority'] })}
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

          {/* Completion info (if completed) */}
          {job.status === 'completed' && (
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
                {job.completionNotes && (
                  <div className="rounded-md bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-700">Notas de finalización:</p>
                    <p className="mt-1 text-gray-600">{job.completionNotes}</p>
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
                {job.signatureUrl && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">Firma del cliente:</p>
                    <div className="w-48 rounded-md border bg-white p-2">
                      <img
                        src={job.signatureUrl}
                        alt="Firma"
                        className="h-auto w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
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
                    {job.status !== 'completed' && job.status !== 'cancelled' && (
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
              <p className="text-gray-500">Sin asignar</p>
            )}
            {!isEditing && job.status !== 'completed' && job.status !== 'cancelled' && (
              <div className="mt-4">
                <label className="label mb-1 block text-sm">Agregar/cambiar asignación:</label>
                {job.scheduledDate && availabilityData?.data?.availableCount === 0 && (
                  <div className="mb-2 flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No hay técnicos disponibles para esta fecha/hora</span>
                  </div>
                )}
                <select
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
              {!job.invoiceId && job.status === 'completed' && (
                <Link
                  href={`/dashboard/invoices/new?jobId=${job.id}&customerId=${job.customerId}`}
                  className="btn-primary w-full justify-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Crear factura
                </Link>
              )}
              <Link
                href={`/dashboard/jobs/new?customerId=${job.customerId}`}
                className="btn-outline w-full justify-center"
              >
                Nuevo trabajo para cliente
              </Link>
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
