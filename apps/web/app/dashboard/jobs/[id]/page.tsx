'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import {
  cn,
  formatDate,
  formatDateTime,
  formatCurrency,
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
} from 'lucide-react';
import { Job, User as UserType } from '@/types';

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

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['scheduled', 'cancelled'],
  scheduled: ['en_camino', 'pending', 'cancelled'],
  en_camino: ['working', 'scheduled'],
  working: ['completed', 'en_camino'],
  completed: [],
  cancelled: ['pending'],
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const jobId = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Job>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.jobs.get(jobId),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.users.list(),
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

  const job = data?.data as Job | undefined;
  const teamMembers = usersData?.data as UserType[] | undefined;

  const handleEdit = () => {
    if (job) {
      setEditData({
        title: job.title,
        description: job.description || '',
        address: job.address,
        priority: job.priority,
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
    assignMutation.mutate(userId);
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
      case 'scheduled':
        return Calendar;
      case 'en_camino':
        return Truck;
      case 'working':
        return Wrench;
      case 'completed':
        return CheckCircle;
      case 'cancelled':
        return XCircle;
      case 'pending':
        return Pause;
      default:
        return Play;
    }
  };

  const getStatusButtonColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'btn-primary';
      case 'cancelled':
        return 'btn-danger';
      case 'en_camino':
        return 'bg-purple-600 text-white hover:bg-purple-700';
      case 'working':
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
          <p className="text-gray-500">#{job.id.slice(0, 8)}</p>
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
      {nextActions.length > 0 && !isEditing && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Acciones:</span>
            {nextActions.map(({ status, label, icon: Icon, color }) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={statusMutation.isPending}
                className={cn('inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium', color)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
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
                    className="input"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Descripción</label>
                  <textarea
                    value={editData.description || ''}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Dirección</label>
                  <input
                    type="text"
                    value={editData.address || ''}
                    onChange={(e) => setEditData({ ...editData, address: e.target.value })}
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
                {job.description && (
                  <div>
                    <p className="text-gray-700">{job.description}</p>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-gray-400" />
                  <span className="text-gray-700">{job.address}</span>
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

          {/* Assignment */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Asignación</h2>
            {job.assignedTo ? (
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
                <label className="label mb-1 block text-sm">Reasignar a:</label>
                <select
                  value={job.assignedToId || ''}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={assignMutation.isPending}
                  className="input"
                >
                  <option value="">Sin asignar</option>
                  {teamMembers?.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                </select>
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
