'use client';

import Image from 'next/image';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  UserCheck,
  AlertCircle,
  Check,
  Loader2,
  Wrench,
  MapPin,
  Clock,
} from 'lucide-react';

interface Technician {
  id: string;
  name: string;
  status: string;
  currentJobCount: number;
  specialty: string | null;
  avatarUrl: string | null;
}

interface Job {
  id: string;
  jobNumber: string;
  customerName: string;
  address: string;
  technicianId: string | null;
  technicianName: string | null;
  scheduledTime: string | null;
  status: string;
}

interface ReassignJobDialogProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  technicians: Technician[];
  onReassignSuccess?: () => void;
}

async function reassignJob(jobId: string, technicianId: string | null): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/jobs/${jobId}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: technicianId }),
  });
  return res.json();
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'en_linea':
      return 'bg-green-100 text-green-700';
    case 'en_camino':
      return 'bg-blue-100 text-blue-700';
    case 'trabajando':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'en_linea':
      return 'En línea';
    case 'en_camino':
      return 'En camino';
    case 'trabajando':
      return 'Trabajando';
    default:
      return 'Sin conexión';
  }
}

export function ReassignJobDialog({
  isOpen,
  onClose,
  job,
  technicians,
  onReassignSuccess,
}: ReassignJobDialogProps) {
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Reset selection when dialog opens with new job
  useEffect(() => {
    if (isOpen && job) {
      setSelectedTechnicianId(job.technicianId);
    }
  }, [isOpen, job]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!job) throw new Error('No job selected');
      return reassignJob(job.id, selectedTechnicianId);
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['map-data'] });
        onReassignSuccess?.();
        onClose();
      }
    },
  });

  if (!isOpen || !job) return null;

  // Sort technicians: available first, then by current job count
  const sortedTechnicians = [...technicians].sort((a, b) => {
    // Available technicians first
    const aAvailable = a.status === 'en_linea' && a.currentJobCount === 0;
    const bAvailable = b.status === 'en_linea' && b.currentJobCount === 0;
    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;

    // Then by status (online > working > en_camino > offline)
    const statusOrder = { en_linea: 0, trabajando: 1, en_camino: 2, sin_conexion: 3 };
    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // Then by job count
    return a.currentJobCount - b.currentJobCount;
  });

  const hasChanged = selectedTechnicianId !== job.technicianId;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Reasignar Trabajo
            </h3>
            <p className="text-sm text-gray-500">#{job.jobNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Job Info */}
        <div className="px-4 py-3 bg-gray-50 border-b">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wrench className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{job.customerName}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {job.address}
              </p>
              {job.scheduledTime && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {job.scheduledTime}
                </p>
              )}
            </div>
          </div>
          {job.technicianName && (
            <div className="mt-2 text-sm">
              <span className="text-gray-500">Asignado a:</span>{' '}
              <span className="font-medium text-gray-700">{job.technicianName}</span>
            </div>
          )}
        </div>

        {/* Technician List */}
        <div className="flex-1 overflow-y-auto p-2">
          <p className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
            Seleccionar técnico
          </p>

          {/* Unassign option */}
          <button
            onClick={() => setSelectedTechnicianId(null)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg mb-1 transition-colors ${selectedTechnicianId === null
                ? 'bg-primary-50 border-2 border-primary-500'
                : 'hover:bg-gray-50 border-2 border-transparent'
              }`}
          >
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-700">Sin asignar</p>
              <p className="text-xs text-gray-500">Dejar trabajo sin técnico</p>
            </div>
            {selectedTechnicianId === null && (
              <Check className="h-5 w-5 text-primary-600" />
            )}
          </button>

          {/* Technicians */}
          {sortedTechnicians.map((tech) => {
            const isSelected = selectedTechnicianId === tech.id;
            const isAvailable = tech.status === 'en_linea' && tech.currentJobCount === 0;

            return (
              <button
                key={tech.id}
                onClick={() => setSelectedTechnicianId(tech.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg mb-1 transition-colors ${isSelected
                    ? 'bg-primary-50 border-2 border-primary-500'
                    : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
              >
                <div className="relative">
                  {tech.avatarUrl ? (
                    <Image
                      src={tech.avatarUrl}
                      alt={tech.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {tech.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Status indicator */}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${tech.status === 'en_linea'
                        ? 'bg-green-500'
                        : tech.status === 'en_camino'
                          ? 'bg-blue-500'
                          : tech.status === 'trabajando'
                            ? 'bg-amber-500'
                            : 'bg-gray-400'
                      }`}
                  />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{tech.name}</p>
                    {isAvailable && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Disponible
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`px-1.5 py-0.5 rounded ${getStatusColor(tech.status)}`}>
                      {getStatusLabel(tech.status)}
                    </span>
                    <span>•</span>
                    <span>{tech.currentJobCount} trabajos hoy</span>
                    {tech.specialty && (
                      <>
                        <span>•</span>
                        <span className="truncate">{tech.specialty}</span>
                      </>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-primary-600 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
          {mutation.error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Error al reasignar</span>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!hasChanged || mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Confirmar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReassignJobDialog;
