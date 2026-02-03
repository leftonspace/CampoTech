'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  X,
  Phone,
  MapPin,
  Clock,
  Navigation,
  Briefcase,
  User,
  ChevronRight,
  ExternalLink,
  Truck,
  CheckCircle
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { TechnicianLocation } from './LiveTechnicianMap';

interface TechnicianPanelProps {
  technician: TechnicianLocation;
  onClose: () => void;
}

const specialtyLabels: Record<string, string> = {
  PLOMERO: 'Plomero',
  ELECTRICISTA: 'Electricista',
  GASISTA: 'Gasista',
  CALEFACCIONISTA: 'Calefaccionista',
  REFRIGERACION: 'Refrigeración',
  ALBANIL: 'Albañil',
  PINTOR: 'Pintor',
  CARPINTERO: 'Carpintero',
  TECHISTA: 'Techista',
  HERRERO: 'Herrero',
  SOLDADOR: 'Soldador',
  OTRO: 'Otro'
};

const skillLabels: Record<string, string> = {
  AYUDANTE: 'Ayudante',
  MEDIO_OFICIAL: 'Medio Oficial',
  OFICIAL: 'Oficial',
  OFICIAL_ESPECIALIZADO: 'Oficial Especializado'
};

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  EN_ROUTE: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: <Truck className="h-4 w-4" />
  },
  IN_PROGRESS: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: <CheckCircle className="h-4 w-4" />
  },
  ASSIGNED: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    icon: <Briefcase className="h-4 w-4" />
  }
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

export function TechnicianPanel({ technician, onClose }: TechnicianPanelProps) {
  const [_showItinerary, setShowItinerary] = useState(false);

  const statusInfo = technician.currentJob?.status
    ? statusColors[technician.currentJob.status]
    : null;

  return (
    <div className="h-full bg-white shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-gray-50">
        <h2 className="font-semibold text-gray-900">Detalles del Técnico</h2>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Technician Info */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="relative">
              {technician.avatar ? (
                <Image
                  src={technician.avatar}
                  alt={technician.name}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-semibold text-lg">
                  {getInitials(technician.name)}
                </div>
              )}
              {/* Online indicator */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white ${technician.isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`}
              />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{technician.name}</h3>
              <p className="text-sm text-gray-500">
                {technician.specialty
                  ? specialtyLabels[technician.specialty] || technician.specialty
                  : 'Técnico'}
                {technician.skillLevel &&
                  ` - ${skillLabels[technician.skillLevel] || technician.skillLevel}`}
              </p>
              <p className="text-xs text-gray-400">
                {technician.isOnline
                  ? 'En línea'
                  : technician.lastSeen
                    ? `Visto ${new Date(technician.lastSeen).toLocaleTimeString()}`
                    : 'Sin conexión'}
              </p>
            </div>
          </div>

          {/* Contact button */}
          <a
            href={`tel:${technician.phone}`}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-100"
          >
            <Phone className="h-4 w-4" />
            {technician.phone}
          </a>
        </div>

        {/* Location Info */}
        {technician.location && (
          <div className="p-4 border-b">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Ubicación Actual</h4>
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
              <div>
                <p>
                  {technician.location.lat.toFixed(6)}, {technician.location.lng.toFixed(6)}
                </p>
                {technician.location.speed != null && technician.location.speed > 0 && (
                  <p className="text-xs text-gray-400">
                    {Math.round(technician.location.speed)} km/h
                  </p>
                )}
              </div>
            </div>

            {/* Movement mode */}
            {technician.tracking && (
              <div className="mt-2 flex items-center gap-2">
                <Navigation className="h-4 w-4 text-blue-500" />
                <span className="text-sm capitalize text-gray-600">
                  {technician.tracking.movementMode === 'driving'
                    ? 'Conduciendo'
                    : technician.tracking.movementMode === 'walking'
                      ? 'Caminando'
                      : 'Estacionario'}
                </span>
                {technician.tracking.etaMinutes && (
                  <span className="ml-auto text-sm font-medium text-blue-600">
                    ETA: {technician.tracking.etaMinutes} min
                  </span>
                )}
              </div>
            )}

            {/* Google Maps link */}
            <a
              href={`https://www.google.com/maps?q=${technician.location.lat},${technician.location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
            >
              Ver en Google Maps
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Current Job */}
        {technician.currentJob ? (
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Trabajo Actual</h4>
              {statusInfo && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}
                >
                  {statusInfo.icon}
                  {technician.currentJob.status === 'EN_ROUTE'
                    ? 'En Camino'
                    : technician.currentJob.status === 'IN_PROGRESS'
                      ? 'Trabajando'
                      : 'Asignado'}
                </span>
              )}
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {technician.currentJob.jobNumber}
                </span>
                <Link
                  href={`/dashboard/jobs/${technician.currentJob.id}`}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Ver detalles
                </Link>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {technician.currentJob.description}
              </p>
              <div className="mt-2 flex items-start gap-2 text-xs text-gray-500">
                <User className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{technician.currentJob.customerName}</span>
              </div>
              <div className="mt-1 flex items-start gap-2 text-xs text-gray-500">
                <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{formatAddress(technician.currentJob.address)}</span>
              </div>
              {technician.currentJob.scheduledDate && (
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {new Date(technician.currentJob.scheduledDate).toLocaleDateString()}
                    {technician.currentJob.scheduledTimeSlot?.start &&
                      ` ${technician.currentJob.scheduledTimeSlot.start}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 border-b">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Estado</h4>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
              <p className="mt-1 text-sm font-medium text-green-700">Disponible</p>
              <p className="text-xs text-green-600">Sin trabajo asignado actualmente</p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Acciones Rápidas</h4>
          <div className="space-y-2">
            <Link
              href="/dashboard/jobs"
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400" />
                Asignar nuevo trabajo
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
            <button
              onClick={() => setShowItinerary(true)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                Ver itinerario del día
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
            <a
              href={`https://wa.me/${technician.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                </svg>
                Enviar WhatsApp
              </span>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
