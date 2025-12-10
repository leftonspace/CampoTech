'use client';

/**
 * Track Jobs Page
 * ===============
 *
 * Shows list of trackable jobs (in_progress, en_route).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  User,
  Truck,
  CheckCircle,
  ArrowRight,
  Loader2,
  Calendar,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatDate, cn } from '@/lib/utils';

export default function TrackPage() {
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);

    // Load active (trackable) jobs
    const activeResult = await customerApi.getJobs({
      status: 'in_progress',
      limit: 10,
    });
    if (activeResult.success && activeResult.data) {
      setActiveJobs(activeResult.data.jobs || []);
    }

    // Load upcoming scheduled jobs
    const upcomingResult = await customerApi.getJobs({
      status: 'scheduled',
      limit: 5,
    });
    if (upcomingResult.success && upcomingResult.data) {
      setUpcomingJobs(upcomingResult.data.jobs || []);
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Seguimiento en tiempo real
        </h1>
        <p className="text-gray-600">
          Seguí la ubicación del técnico y el estado de tu servicio
        </p>
      </div>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            En curso ahora
          </h2>
          <div className="space-y-4">
            {activeJobs.map((job) => (
              <ActiveJobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming jobs */}
      {upcomingJobs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Próximos servicios
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {upcomingJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {job.serviceType}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(job.scheduledDate, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {job.scheduledTimeSlot && ` • ${job.scheduledTimeSlot}`}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeJobs.length === 0 && upcomingJobs.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay servicios activos
          </h3>
          <p className="text-gray-500 mb-6">
            Cuando tengas un servicio en curso, podrás seguir la ubicación del
            técnico en tiempo real.
          </p>
          <Link href="/book" className="btn-primary">
            Reservar servicio
          </Link>
        </div>
      )}
    </div>
  );
}

function ActiveJobCard({ job }: { job: any }) {
  const statusSteps = [
    { id: 'scheduled', label: 'Programado', icon: Calendar },
    { id: 'en_route', label: 'En camino', icon: Truck },
    { id: 'in_progress', label: 'En servicio', icon: Clock },
    { id: 'completed', label: 'Completado', icon: CheckCircle },
  ];

  const currentIndex = statusSteps.findIndex((s) => s.status === job.status);

  return (
    <Link
      href={`/track/${job.id}`}
      className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Map preview placeholder */}
      <div className="h-32 bg-gradient-to-br from-primary-100 to-primary-200 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur rounded-lg px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">
              Técnico en camino
            </span>
          </div>
        </div>
        <div className="absolute bottom-2 right-2 bg-white rounded-lg px-2 py-1 text-xs text-gray-600">
          Toca para ver el mapa
        </div>
      </div>

      <div className="p-4">
        {/* Service info */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">{job.serviceType}</h3>
            <p className="text-sm text-gray-500">{job.address}</p>
          </div>
          {job.eta && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Llegada estimada</p>
              <p className="font-semibold text-primary-600">{job.eta}</p>
            </div>
          )}
        </div>

        {/* Technician */}
        {job.technicianName && (
          <div className="flex items-center gap-3 mb-4 p-2 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {job.technicianName}
              </p>
              <p className="text-xs text-gray-500">Técnico asignado</p>
            </div>
          </div>
        )}

        {/* Status steps */}
        <div className="flex items-center justify-between">
          {statusSteps.map((step, index) => {
            const isCompleted =
              index <= currentIndex ||
              (job.status === 'in_progress' && step.id === 'en_route');
            const isCurrent = step.id === job.status;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                      isCompleted
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-400'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={cn(
                      'text-[10px] mt-1 text-center',
                      isCurrent
                        ? 'text-primary-600 font-medium'
                        : 'text-gray-400'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < statusSteps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-1',
                      index < currentIndex ? 'bg-primary-600' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
