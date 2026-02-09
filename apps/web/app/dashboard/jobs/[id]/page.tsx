'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
  MapPin,
  Calendar,
  Clock,
  User,
  Users,
  Phone,
  FileText,
  Camera,
  CheckCircle,
  Truck,
  Wrench,
  XCircle,
  MessageCircle,

  Printer,
  Package,
  Plus,
} from 'lucide-react';
import { Job } from '@/types';
import { MultiVisitProgress } from '@/components/jobs/MultiVisitProgress';
import { PerVisitQuoteBreakdown } from '@/components/jobs/PerVisitQuoteBreakdown';
import { PriceVarianceAlert } from '@/components/jobs/PriceVarianceAlert';
import { generateQuoteWhatsAppLink } from '@/lib/whatsapp-links';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT - READ-ONLY JOB DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;

  // Fetch job details
  const { data, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.jobs.get(jobId),
  });

  // Fetch line items for quote display
  const { data: lineItemsData } = useQuery({
    queryKey: ['job-line-items', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/line-items`);
      return res.json();
    },
    enabled: !!jobId,
  });

  const job = data?.data as Job | undefined;
  const lineItems = lineItemsData?.data?.items || [];
  const lineItemsSummary = lineItemsData?.data?.summary || { subtotal: 0, tax: 0, total: 0, itemCount: 0 };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

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
          <div className="flex items-center gap-3 flex-wrap">
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

        {/* Info badge about read-only status */}
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
          <span className="text-xs">📱 Las actualizaciones se realizan desde la app móvil</span>
        </div>
      </div>

      {/* Multi-Visit Progress (for MULTI_VISIT jobs) */}
      {(job as Job & { durationType?: string; visits?: unknown[] }).durationType === 'MULTIPLE_VISITS' &&
        (job as Job & { visits?: unknown[] }).visits &&
        (job as Job & { visits?: unknown[] }).visits!.length > 1 && (
          <MultiVisitProgress jobId={job.id} />
        )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Per-Visit Quote Breakdown (for MULTI_VISIT jobs) */}
          {(job as Job & { durationType?: string }).durationType === 'MULTIPLE_VISITS' && (
            <PerVisitQuoteBreakdown jobId={job.id} />
          )}

          {/* Job details - READ ONLY */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Detalles del trabajo</h2>
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
          </div>

          {/* Completion info (if completed) */}
          {job.status === 'COMPLETED' && (
            <div className="card p-6">
              <h2 className="mb-4 font-medium text-gray-900 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Información de finalización
              </h2>
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

          {/* Cancelled info (if cancelled) */}
          {job.status === 'CANCELLED' && (
            <div className="card p-6 border-red-200 bg-red-50">
              <h2 className="mb-2 font-medium text-red-900 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Trabajo Cancelado
              </h2>
              <p className="text-sm text-red-700">
                Este trabajo fue cancelado y no puede ser modificado.
              </p>
            </div>
          )}

          {/* Materials Used Section */}
          {job.status === 'COMPLETED' && job.materialsUsed && Array.isArray(job.materialsUsed) && job.materialsUsed.length > 0 && (
            <div className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-medium text-gray-900">
                <Package className="h-5 w-5" />
                Materiales Utilizados
              </h2>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-gray-700">Material</th>
                    <th className="text-right py-2 font-medium text-gray-700">Cantidad</th>
                    <th className="text-right py-2 font-medium text-gray-700">Costo Unit.</th>
                    <th className="text-right py-2 font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {job.materialsUsed.map((material: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 text-gray-900">{material.name || material.productName}</td>
                      <td className="text-right py-2 text-gray-600">{material.quantity}</td>
                      <td className="text-right py-2 text-gray-600">{formatCurrency(material.unitCost || 0)}</td>
                      <td className="text-right py-2 text-gray-900 font-medium">
                        {formatCurrency((material.quantity || 0) * (material.unitCost || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Line Items (Pricebook) */}
          {lineItems.length > 0 && (
            <div className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-medium text-gray-900">
                <FileText className="h-5 w-5" />
                Servicios y Productos
              </h2>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-gray-700">Descripción</th>
                    <th className="text-right py-2 font-medium text-gray-700">Cant.</th>
                    <th className="text-right py-2 font-medium text-gray-700">Precio</th>
                    <th className="text-right py-2 font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {lineItems.map((item: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 text-gray-900">{item.description}</td>
                      <td className="text-right py-2 text-gray-600">{item.quantity}</td>
                      <td className="text-right py-2 text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right py-2 text-gray-900 font-medium">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-medium">
                    <td colSpan={3} className="py-2 text-right text-gray-700">Subtotal</td>
                    <td className="py-2 text-right">{formatCurrency(lineItemsSummary.subtotal)}</td>
                  </tr>
                  {lineItemsSummary.tax > 0 && (
                    <tr>
                      <td colSpan={3} className="py-1 text-right text-gray-500">IVA</td>
                      <td className="py-1 text-right text-gray-600">{formatCurrency(lineItemsSummary.tax)}</td>
                    </tr>
                  )}
                  <tr className="text-lg font-bold">
                    <td colSpan={3} className="py-2 text-right text-gray-900">Total</td>
                    <td className="py-2 text-right text-primary-600">{formatCurrency(lineItemsSummary.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Vehicle Trip Info (if vehicle was assigned) */}
          {job.vehicleMileageStart && (
            <div className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-medium text-gray-900">
                <Truck className="h-5 w-5" />
                Información del Viaje
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-500">Km inicial</p>
                  <p className="text-xl font-bold text-gray-900">{job.vehicleMileageStart.toLocaleString()}</p>
                </div>
                {job.vehicleMileageEnd && (
                  <>
                    <div className="rounded-lg bg-gray-50 p-4 text-center">
                      <p className="text-sm text-gray-500">Km final</p>
                      <p className="text-xl font-bold text-gray-900">{job.vehicleMileageEnd.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-primary-50 p-4 text-center">
                      <p className="text-sm text-primary-600">Km recorridos</p>
                      <p className="text-xl font-bold text-primary-600">
                        {(job.vehicleMileageEnd - job.vehicleMileageStart).toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer info - READ ONLY */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Cliente</h2>
            {job.customer ? (
              <div className="space-y-3">
                <Link
                  href={`/dashboard/customers/${job.customerId}`}
                  className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{job.customer.name}</p>
                    <p className="text-sm text-primary-600">Ver perfil →</p>
                  </div>
                </Link>
                {job.customer.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a
                      href={`https://wa.me/${job.customer.phone?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600"
                    >
                      {job.customer.phone}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Sin cliente asignado</p>
            )}
          </div>

          {/* Assigned technicians - READ ONLY */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900 flex items-center gap-2">
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
                  </div>
                ))}
              </div>
            ) : job.assignedTo ? (
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
          </div>

          {/* Vehicle - READ ONLY */}
          {job.vehicle && (
            <div className="card p-6">
              <h2 className="mb-4 font-medium text-gray-900 flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehículo asignado
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {job.vehicle.make} {job.vehicle.model}
                  </p>
                  <p className="text-sm text-gray-500">{job.vehicle.plateNumber}</p>
                </div>
              </div>
            </div>
          )}

          {/* Price Variance Alert */}
          <PriceVarianceAlert
            jobId={job.id}
            estimatedTotal={Number(job.estimatedTotal || 0)}
            techProposedTotal={Number(job.techProposedTotal || 0)}
            finalTotal={Number(job.finalTotal || 0)}
            varianceApprovedAt={job.varianceApprovedAt}
            varianceRejectedAt={job.varianceRejectedAt}
            pricingLockedAt={job.pricingLockedAt}
            priceVarianceReason={job.priceVarianceReason}
          />

          {/* Quick actions - LIMITED */}
          <div className="card p-6">
            <h2 className="mb-4 font-medium text-gray-900">Acciones rápidas</h2>
            <div className="space-y-2">
              {/* View invoice if exists */}
              {job.invoiceId && (
                <Link
                  href={`/dashboard/invoices/${job.invoiceId}`}
                  className="btn-primary w-full justify-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Ver factura
                </Link>
              )}

              {/* Send Quote via WhatsApp */}
              {job.customer?.phone && lineItemsSummary.itemCount > 0 && job.status === 'PENDING' && (
                <a
                  href={generateQuoteWhatsAppLink(
                    job.customer.phone,
                    job.customer.name || 'Cliente',
                    job.jobNumber,
                    lineItems.map((item: { description: string; quantity: number; unitPrice: number; total: number }) => ({
                      description: item.description,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      total: item.total,
                    })),
                    lineItemsSummary.subtotal,
                    lineItemsSummary.tax,
                    lineItemsSummary.total,
                    'CampoTech'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full justify-center bg-green-600 hover:bg-green-700"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Enviar Presupuesto
                </a>
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

              {/* Print order */}
              <button
                onClick={() => window.print()}
                className="btn-outline w-full justify-center"
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir orden
              </button>

              <Link
                href="/dashboard/jobs"
                className="btn-outline w-full justify-center"
              >
                <Plus className="mr-2 h-4 w-4" />
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
              {job.completedAt && (
                <div className="flex justify-between">
                  <span>Completado</span>
                  <span>{formatDateTime(job.completedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
