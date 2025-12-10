'use client';

/**
 * Job Detail Page
 * ===============
 *
 * Shows detailed information about a specific job.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  FileText,
  CreditCard,
  Star,
  MessageSquare,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Truck,
} from 'lucide-react';
import { customerApi } from '@/lib/customer-api';
import { formatDate, formatCurrency, getStatusColor, getStatusLabel, cn } from '@/lib/utils';

const statusTimeline = [
  { status: 'scheduled', label: 'Programado', icon: Calendar },
  { status: 'en_route', label: 'Técnico en camino', icon: Truck },
  { status: 'in_progress', label: 'En progreso', icon: Clock },
  { status: 'completed', label: 'Completado', icon: CheckCircle },
];

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadJob();
  }, [params.id]);

  const loadJob = async () => {
    setIsLoading(true);
    const result = await customerApi.getJob(params.id as string);

    if (result.success && result.data) {
      setJob(result.data.job);
    } else {
      setError(result.error?.message || 'Error al cargar el trabajo');
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

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600 mb-4">{error || 'Trabajo no encontrado'}</p>
        <button onClick={() => router.push('/jobs')} className="btn-primary">
          Volver a mis trabajos
        </button>
      </div>
    );
  }

  const currentStatusIndex = statusTimeline.findIndex(
    (s) => s.status === job.status
  );
  const isCancelled = job.status === 'cancelled';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/jobs')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {job.serviceType}
            </h1>
            <p className="text-gray-500">Trabajo #{job.jobNumber || job.id.slice(0, 8)}</p>
          </div>
          <span
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium',
              getStatusColor(job.status)
            )}
          >
            {getStatusLabel(job.status)}
          </span>
        </div>
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Estado del servicio</h2>
          <div className="flex items-center justify-between">
            {statusTimeline.map((step, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const Icon = step.icon;

              return (
                <div key={step.status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                        isCompleted
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={cn(
                        'text-xs mt-2 text-center',
                        isCurrent ? 'text-primary-600 font-medium' : 'text-gray-500'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < statusTimeline.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-1 mx-2',
                        index < currentStatusIndex ? 'bg-primary-600' : 'bg-gray-200'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Track button for in_progress status */}
          {(job.status === 'en_route' || job.status === 'in_progress') && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <Link href={`/track/${job.id}`} className="btn-primary w-full">
                <MapPin className="w-4 h-4 mr-2" />
                Seguir en tiempo real
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Job details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Detalles del servicio</h2>

        <div className="space-y-4">
          {/* Date/Time */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">Fecha programada</p>
              <p className="font-medium text-gray-900">
                {job.scheduledDate
                  ? formatDate(job.scheduledDate, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Por confirmar'}
              </p>
              {job.scheduledTimeSlot && (
                <p className="text-sm text-gray-600">{job.scheduledTimeSlot}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-500">Dirección</p>
              <p className="font-medium text-gray-900">{job.address}</p>
              {(job.city || job.province) && (
                <p className="text-sm text-gray-600">
                  {[job.city, job.province].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Technician */}
          {job.technicianName && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Técnico asignado</p>
                <p className="font-medium text-gray-900">{job.technicianName}</p>
                {job.technicianPhone && (
                  <a
                    href={`tel:${job.technicianPhone}`}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    {job.technicianPhone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Descripción</p>
                <p className="text-gray-900">{job.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pricing */}
      {(job.estimatedPrice || job.total) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Precio</h2>

          <div className="space-y-3">
            {job.estimatedPrice && (
              <div className="flex justify-between">
                <span className="text-gray-500">Precio estimado</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(job.estimatedPrice)}
                </span>
              </div>
            )}

            {job.lineItems && job.lineItems.length > 0 && (
              <div className="border-t border-gray-200 pt-3 space-y-2">
                {job.lineItems.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.description} x{item.quantity}
                    </span>
                    <span className="text-gray-900">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {job.total && (
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-gray-900 text-lg">
                  {formatCurrency(job.total)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        {/* Rate job */}
        {job.status === 'completed' && !job.hasFeedback && (
          <Link
            href={`/jobs/${job.id}/feedback`}
            className="btn-primary w-full flex items-center justify-center"
          >
            <Star className="w-4 h-4 mr-2" />
            Calificar servicio
          </Link>
        )}

        {/* View invoice */}
        {job.invoiceId && (
          <Link
            href={`/invoices/${job.invoiceId}`}
            className="btn-secondary w-full flex items-center justify-center"
          >
            <FileText className="w-4 h-4 mr-2" />
            Ver factura
          </Link>
        )}

        {/* Pay */}
        {job.paymentStatus === 'pending' && job.invoiceId && (
          <Link
            href={`/payments?invoice=${job.invoiceId}`}
            className="btn-primary w-full flex items-center justify-center"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Pagar ahora
          </Link>
        )}

        {/* Contact support */}
        <Link
          href={`/support/new?job=${job.id}`}
          className="btn-outline w-full flex items-center justify-center"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Contactar soporte
        </Link>
      </div>
    </div>
  );
}
