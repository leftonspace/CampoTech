'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  X,
  Clock,
  MapPin,
  User,
  Phone,
  AlertCircle,
  ExternalLink,
  Edit,
  Navigation,
  Star,
  Repeat,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { CalendarEvent, ConfigSummary } from './CalendarView';

interface JobCardProps {
  event: CalendarEvent;
  onClose: () => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
  ASSIGNED: { label: 'Asignado', color: 'bg-purple-100 text-purple-700' },
  EN_ROUTE: { label: 'En Camino', color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Completado', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

const serviceTypeLabels: Record<string, string> = {
  INSTALACION_SPLIT: 'Instalación Split',
  REPARACION_SPLIT: 'Reparación Split',
  MANTENIMIENTO_SPLIT: 'Mantenimiento Split',
  INSTALACION_CALEFACTOR: 'Instalación Calefactor',
  REPARACION_CALEFACTOR: 'Reparación Calefactor',
  MANTENIMIENTO_CALEFACTOR: 'Mantenimiento Calefactor',
  OTRO: 'Otro',
};

function formatAddress(address: unknown): string {
  if (!address) return 'Sin dirección';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    const addr = address as Record<string, unknown>;
    const parts: string[] = [];
    if (addr.street) parts.push(String(addr.street));
    if (addr.number) parts.push(String(addr.number));
    if (addr.city) parts.push(String(addr.city));
    return parts.join(', ') || 'Sin dirección';
  }
  return 'Sin dirección';
}

function getGoogleMapsUrl(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null;
  const addr = address as Record<string, unknown>;
  if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
    return `https://www.google.com/maps?q=${addr.lat},${addr.lng}`;
  }
  const coords = addr.coordinates as Record<string, unknown> | undefined;
  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  }
  return null;
}

export function JobCard({ event, onClose }: JobCardProps) {
  const { extendedProps: job } = event;

  // Get all configs for navigation
  const allConfigs: ConfigSummary[] = job.allConfigs || [];
  const hasMultipleConfigs = allConfigs.length > 1;

  // State for which config is currently being viewed
  const initialConfigIndex = job.visitConfigIndex || 1;
  const [selectedConfigIndex, setSelectedConfigIndex] = useState(initialConfigIndex);

  // Get the currently selected config's data
  const selectedConfig = allConfigs.find(c => c.configIndex === selectedConfigIndex);
  const isViewingOriginalConfig = selectedConfigIndex === initialConfigIndex;

  // Navigation handlers
  const canGoPrev = selectedConfigIndex > 1;
  const canGoNext = selectedConfigIndex < (job.totalConfigs || 1);

  const handlePrevConfig = () => {
    if (canGoPrev) setSelectedConfigIndex(selectedConfigIndex - 1);
  };

  const handleNextConfig = () => {
    if (canGoNext) setSelectedConfigIndex(selectedConfigIndex + 1);
  };

  // Use selected config's data when viewing a different config
  const displayTechnician = isViewingOriginalConfig
    ? job.technician
    : selectedConfig?.technician || job.technician;

  const displayTimeSlot = isViewingOriginalConfig
    ? job.scheduledTimeSlot
    : selectedConfig?.timeSlot || job.scheduledTimeSlot;

  const displayConfigDates = isViewingOriginalConfig
    ? (job.configTotalDates || 1)
    : (selectedConfig?.totalDates || 1);

  // Format time from the selected config's time slot
  let displayStartTime = '';
  let displayEndTime = '';
  if (displayTimeSlot) {
    if (displayTimeSlot.start) displayStartTime = displayTimeSlot.start;
    if (displayTimeSlot.end) displayEndTime = displayTimeSlot.end;
  }

  // Format date range for selected config
  let displayDateRange = '';
  if (!isViewingOriginalConfig && selectedConfig) {
    const firstDate = new Date(selectedConfig.firstDate).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    });
    const lastDate = new Date(selectedConfig.lastDate).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    });
    displayDateRange = firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;
  }

  const status = statusLabels[job.status] || statusLabels.PENDING;
  const startTime = new Date(event.start).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = new Date(event.end).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Date(event.start).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const mapsUrl = job.customer ? getGoogleMapsUrl(job.customer.address) : null;

  // Visit type info
  const isRecurring = job.durationType === 'RECURRING';
  const isMultiVisit = job.durationType === 'MULTIPLE_VISITS' || (job.totalVisits && job.totalVisits > 1);
  const visitNumber = job.visitNumber || 1;
  const totalVisits = job.totalVisits || 1;
  const isFirstVisit = job.isFirstVisit;

  // Visita config info (for multi-config jobs)
  const visitConfigIndex = job.visitConfigIndex || 1;
  const totalConfigs = job.totalConfigs || 1;
  const configTotalDates = job.configTotalDates || 1;
  const visitNumberInConfig = job.visitNumberInConfig || 1;

  // Get the actual job ID for links (not the event ID which might be "visit-xxx")
  const jobId = job.jobId || event.id.replace('visit-', '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div
          className="flex items-center justify-between rounded-t-lg px-4 py-3 text-white"
          style={{ backgroundColor: event.backgroundColor }}
        >
          <div>
            <h3 className="font-semibold">{job.jobNumber}</h3>
            <p className="text-sm opacity-90">
              {job.serviceType ? (serviceTypeLabels[job.serviceType] || job.serviceType) : 'Servicio'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status and urgency */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            {job.urgency === 'URGENTE' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                <AlertCircle className="h-3 w-3" />
                Urgente
              </span>
            )}

            {/* First visit badge */}
            {isFirstVisit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                <Star className="h-3 w-3" />
                Primera visita
              </span>
            )}

            {/* Recurring badge */}
            {isRecurring && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                <Repeat className="h-3 w-3" />
                Recurrente
              </span>
            )}

            {/* Visita config navigation (when there are multiple configs) */}
            {hasMultipleConfigs && (
              <div className="inline-flex items-center gap-1 px-1 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700 border border-primary-200">
                <button
                  onClick={handlePrevConfig}
                  disabled={!canGoPrev}
                  className={`p-0.5 rounded hover:bg-primary-200 ${!canGoPrev ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="flex items-center gap-1 px-1">
                  <CalendarDays className="h-3 w-3" />
                  Visita {selectedConfigIndex}/{totalConfigs}
                </span>
                <button
                  onClick={handleNextConfig}
                  disabled={!canGoNext}
                  className={`p-0.5 rounded hover:bg-primary-200 ${!canGoNext ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Date count within this config */}
            {configTotalDates > 1 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                <CalendarDays className="h-3 w-3" />
                {visitNumberInConfig}/{configTotalDates}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600">{job.description}</p>

          {/* Date and time */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="capitalize">{date}</span>
            <span className="text-gray-400">|</span>
            <span>{startTime} - {endTime}</span>
            {job.estimatedDuration && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">~{job.estimatedDuration} min</span>
              </>
            )}
          </div>

          {/* Customer */}
          {job.customer ? (
            <div className="rounded-lg bg-gray-50 p-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Cliente
              </h4>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium">
                  {getInitials(job.customer.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{job.customer.name}</p>
                  <a
                    href={`tel:${job.customer.phone}`}
                    className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {job.customer.phone}
                  </a>
                </div>
              </div>
              <div className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>{formatAddress(job.customer.address)}</span>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-primary-600 hover:text-primary-700"
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Cliente
              </h4>
              <p className="text-sm text-gray-500">Sin información de cliente</p>
            </div>
          )}

          {/* Viewing different config indicator */}
          {hasMultipleConfigs && !isViewingOriginalConfig && selectedConfig && (
            <div className="rounded-lg bg-primary-50 border border-primary-200 p-3">
              <p className="text-xs font-medium text-primary-700 mb-1">
                Viendo información de Visita {selectedConfigIndex}
              </p>
              <p className="text-sm text-primary-600">
                {displayDateRange} • {displayConfigDates} fecha{displayConfigDates > 1 ? 's' : ''}
              </p>
              {displayStartTime && (
                <p className="text-sm text-primary-600">
                  Horario: {displayStartTime}{displayEndTime ? ` - ${displayEndTime}` : ''}
                </p>
              )}
            </div>
          )}

          {/* Technicians (multiple support) */}
          {job.assignments && job.assignments.length > 0 && isViewingOriginalConfig ? (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Técnico{job.assignments.length > 1 ? 's' : ''}:
              </h4>
              <div className="space-y-2">
                {job.assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center gap-3">
                    {assignment.technician?.avatar ? (
                      <img
                        src={assignment.technician.avatar}
                        alt={assignment.technician.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                        {getInitials(assignment.technician?.name || '')}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{assignment.technician?.name}</p>
                      {assignment.technician?.specialty && (
                        <p className="text-xs text-gray-500">{assignment.technician.specialty}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : displayTechnician ? (
            <div className="flex items-center gap-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Técnico:
              </h4>
              {displayTechnician.avatar ? (
                <img
                  src={displayTechnician.avatar}
                  alt={displayTechnician.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                  {getInitials(displayTechnician.name)}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">{displayTechnician.name}</p>
                {displayTechnician.specialty && (
                  <p className="text-xs text-gray-500">{displayTechnician.specialty}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <User className="h-4 w-4" />
              <span>Sin técnico asignado</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cerrar
          </button>
          <Link
            href={`/dashboard/jobs/${jobId}?edit=true`}
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            <Edit className="h-4 w-4" />
            Editar
          </Link>
          <Link
            href={`/dashboard/jobs/${jobId}`}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Ver detalles
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
