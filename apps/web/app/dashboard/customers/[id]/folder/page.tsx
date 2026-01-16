'use client';

/**
 * Customer Data Folder Page
 * =========================
 * 
 * Phase 3: Task 3.1 & 3.3
 * 
 * Unified view of all customer-related data:
 * - Summary statistics
 * - Complete job history with snapshot data
 * - Invoice and payment history
 * - Export functionality
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatDate, formatDateTime, formatCurrency, formatPhone } from '@/lib/utils';
import {
    ArrowLeft,
    Download,
    FileText,
    Briefcase,
    CreditCard,
    Calendar,
    Camera,
    PenTool,
    User,
    Truck,
    MapPin,
    Star,
    MessageCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    Eye,
    ExternalLink,
    Mail,
    X,
    CheckCircle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface CustomerFolderSummary {
    totalJobs: number;
    completedJobs: number;
    pendingJobs: number;
    totalInvoiced: number;
    totalPaid: number;
    averageRating: number | null;
    whatsappMessages: number;
    firstServiceDate: string | null;
    lastServiceDate: string | null;
}

interface CustomerFolderJob {
    id: string;
    jobNumber: string;
    serviceType: string;
    serviceTypeCode: string | null;
    description: string;
    status: string;
    scheduledDate: string | null;
    completedAt: string | null;
    resolution: string | null;
    photos: string[];
    hasSignature: boolean;
    estimatedTotal: number | null;
    finalTotal: number | null;
    technicianName: string | null;
    vehiclePlate: string | null;
    vehicleInfo: string | null;
    mileageStart: number | null;
    mileageEnd: number | null;
    visitsCount: number;
    visitsCompleted: number;
}

interface CustomerFolderInvoice {
    id: string;
    invoiceNumber: string;
    type: string;
    status: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    issuedAt: string | null;
    afipCae: string | null;
    jobId: string | null;
}

interface CustomerFolderPayment {
    id: string;
    amount: number;
    method: string;
    status: string;
    reference: string | null;
    paidAt: string | null;
    invoiceNumber: string;
}

interface CustomerFolder {
    customer: {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        address: string;
        cuit: string | null;
        ivaCondition: string | null;
        notes: string | null;
        isVip: boolean;
        createdAt: string;
    };
    summary: CustomerFolderSummary;
    jobs: CustomerFolderJob[];
    invoices: CustomerFolderInvoice[];
    payments: CustomerFolderPayment[];
}

// =============================================================================
// LABEL MAPPINGS
// =============================================================================

const SERVICE_TYPE_LABELS: Record<string, string> = {
    INSTALACION_SPLIT: 'Instalación Split',
    REPARACION_SPLIT: 'Reparación Split',
    MANTENIMIENTO_SPLIT: 'Mantenimiento Split',
    INSTALACION_CALEFACTOR: 'Instalación Calefactor',
    REPARACION_CALEFACTOR: 'Reparación Calefactor',
    MANTENIMIENTO_CALEFACTOR: 'Mantenimiento Calefactor',
    OTRO: 'Otro',
};

const JOB_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendiente',
    SCHEDULED: 'Programado',
    IN_PROGRESS: 'En Progreso',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
};

const JOB_STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
    FACTURA_A: 'Factura A',
    FACTURA_B: 'Factura B',
    FACTURA_C: 'Factura C',
    PRESUPUESTO: 'Presupuesto',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    CARD: 'Tarjeta',
    MERCADOPAGO: 'MercadoPago',
    CHECK: 'Cheque',
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({
    label,
    value,
    icon: Icon,
    colorClass = 'text-teal-600'
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    colorClass?: string;
}) {
    return (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-gray-100 p-2 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                </div>
            </div>
        </div>
    );
}

function JobCard({ job, onViewReport }: { job: CustomerFolderJob; onViewReport: (jobId: string) => void }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const serviceLabel = job.serviceType === 'OTRO' && job.serviceTypeCode
        ? job.serviceTypeCode.replace(/_/g, ' ')
        : SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType;

    const tripDistance = job.mileageStart && job.mileageEnd
        ? job.mileageEnd - job.mileageStart
        : null;

    return (
        <div className={`rounded-lg border bg-white shadow-sm overflow-hidden ${job.status === 'COMPLETED' ? 'border-l-4 border-l-green-500' : ''
            }`}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{job.jobNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${JOB_STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-800'
                                }`}>
                                {JOB_STATUS_LABELS[job.status] || job.status}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">{serviceLabel}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm text-gray-500">
                            {job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha'}
                        </p>
                        {job.finalTotal && (
                            <p className="font-medium text-teal-600">{formatCurrency(job.finalTotal)}</p>
                        )}
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t bg-gray-50 p-4 space-y-3">
                    {/* Description */}
                    {job.description && (
                        <p className="text-sm text-gray-600">
                            {job.description.split('\n\n')[0]}
                        </p>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {job.technicianName && (
                            <div className="flex items-center gap-2 text-gray-600">
                                <User className="h-4 w-4 text-gray-400" />
                                <span>Técnico: <strong>{job.technicianName}</strong></span>
                            </div>
                        )}

                        {job.vehiclePlate && (
                            <div className="flex items-center gap-2 text-gray-600">
                                <Truck className="h-4 w-4 text-gray-400" />
                                <span>{job.vehiclePlate} {job.vehicleInfo && `(${job.vehicleInfo})`}</span>
                            </div>
                        )}

                        {tripDistance !== null && (
                            <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span>{job.mileageStart?.toLocaleString()} → {job.mileageEnd?.toLocaleString()} km ({tripDistance} km)</span>
                            </div>
                        )}

                        {job.visitsCount > 1 && (
                            <div className="flex items-center gap-2 text-gray-600">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span>{job.visitsCompleted} de {job.visitsCount} visitas</span>
                            </div>
                        )}
                    </div>

                    {/* Indicators */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        {job.photos.length > 0 && (
                            <span className="flex items-center gap-1">
                                <Camera className="h-3 w-3" />
                                {job.photos.length} fotos
                            </span>
                        )}
                        {job.hasSignature && (
                            <span className="flex items-center gap-1">
                                <PenTool className="h-3 w-3" />
                                Firmado
                            </span>
                        )}
                        {job.completedAt && (
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Completado: {formatDateTime(job.completedAt)}
                            </span>
                        )}
                    </div>

                    {/* Resolution */}
                    {job.resolution && (
                        <div className="rounded-md bg-green-50 border border-green-200 p-3">
                            <p className="text-sm text-green-800">
                                <strong>Resolución:</strong> {job.resolution}
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                        <Link
                            href={`/dashboard/jobs/${job.id}`}
                            className="btn-outline text-xs"
                        >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver Detalles
                        </Link>
                        {job.status === 'COMPLETED' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewReport(job.id);
                                }}
                                className="btn-outline text-xs"
                            >
                                <FileText className="h-3 w-3 mr-1" />
                                Descargar Reporte
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CustomerFolderPage() {
    const params = useParams();
    const customerId = params.id as string;

    const [isExporting, setIsExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<'jobs' | 'invoices' | 'payments'>('jobs');
    const [showEmailExport, setShowEmailExport] = useState(false);
    const [exportEmail, setExportEmail] = useState('');
    const [emailExportStatus, setEmailExportStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [emailExportMessage, setEmailExportMessage] = useState('');

    // Fetch customer folder data
    const { data, isLoading, error } = useQuery({
        queryKey: ['customer-folder', customerId],
        queryFn: async () => {
            const response = await fetch(`/api/customers/${customerId}/folder`);
            if (!response.ok) {
                throw new Error('Error al cargar la carpeta del cliente');
            }
            return response.json();
        },
    });

    const folder: CustomerFolder | undefined = data?.data;

    // Download job report
    const handleDownloadJobReport = async (jobId: string) => {
        window.open(`/api/jobs/${jobId}/report`, '_blank');
    };

    // Download full customer folder export
    const handleExportFolder = async () => {
        setIsExporting(true);
        try {
            window.open(`/api/customers/${customerId}/folder/export`, '_blank');
        } finally {
            // Small delay before resetting state
            setTimeout(() => setIsExporting(false), 1000);
        }
    };

    // Send export via email (Phase 3.4)
    const handleEmailExport = async () => {
        if (!exportEmail) return;

        setEmailExportStatus('sending');
        try {
            const response = await fetch('/api/exports/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exportType: 'customer_folder',
                    targetId: customerId,
                    targetName: folder?.customer.name,
                    deliveryMethod: 'email',
                    deliveryEmail: exportEmail,
                    options: {
                        includeJobs: true,
                        includeInvoices: true,
                        includePayments: true,
                    },
                }),
            });

            const data = await response.json();

            if (data.success) {
                setEmailExportStatus('success');
                setEmailExportMessage(data.message || 'El reporte será enviado a tu email.');
            } else {
                setEmailExportStatus('error');
                setEmailExportMessage(data.error || 'Error al enviar');
            }
        } catch {
            setEmailExportStatus('error');
            setEmailExportMessage('Error de conexión');
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
        );
    }

    // Error state
    if (error || !folder) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/customers"
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Carpeta no encontrada</h1>
                    </div>
                </div>
                <div className="card p-8 text-center">
                    <p className="text-gray-500">Este cliente no existe o no tenés acceso.</p>
                    <Link href="/dashboard/customers" className="btn-primary mt-4 inline-flex">
                        Volver a clientes
                    </Link>
                </div>
            </div>
        );
    }

    const { customer, summary, jobs, invoices, payments } = folder;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/dashboard/customers/${customerId}`}
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-900">
                                📁 Carpeta de Datos
                            </h1>
                            {customer.isVip && (
                                <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                                    ⭐ VIP
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500">{customer.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setShowEmailExport(true);
                            setEmailExportStatus('idle');
                            setExportEmail(customer.email || '');
                        }}
                        className="btn-outline"
                        title="Enviar por email"
                    >
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                    </button>
                    <button
                        onClick={handleExportFolder}
                        disabled={isExporting}
                        className="btn-primary"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Exportando...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4 mr-2" />
                                Exportar PDF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Customer Quick Info */}
            <div className="rounded-lg bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500">📞 Teléfono:</span>
                        <p className="font-medium">{formatPhone(customer.phone)}</p>
                    </div>
                    {customer.email && (
                        <div>
                            <span className="text-gray-500">📧 Email:</span>
                            <p className="font-medium">{customer.email}</p>
                        </div>
                    )}
                    {customer.address && (
                        <div>
                            <span className="text-gray-500">📍 Dirección:</span>
                            <p className="font-medium">{customer.address}</p>
                        </div>
                    )}
                    <div>
                        <span className="text-gray-500">📅 Cliente desde:</span>
                        <p className="font-medium">{formatDate(customer.createdAt)}</p>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Total Trabajos"
                    value={summary.totalJobs}
                    icon={Briefcase}
                />
                <StatCard
                    label="Completados"
                    value={summary.completedJobs}
                    icon={Calendar}
                    colorClass="text-green-600"
                />
                <StatCard
                    label="Total Facturado"
                    value={formatCurrency(summary.totalInvoiced)}
                    icon={FileText}
                    colorClass="text-blue-600"
                />
                <StatCard
                    label="Rating Promedio"
                    value={summary.averageRating ? `${summary.averageRating.toFixed(1)} ⭐` : '-'}
                    icon={Star}
                    colorClass="text-amber-600"
                />
            </div>

            {/* Tabs */}
            <div className="border-b">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('jobs')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'jobs'
                            ? 'border-teal-600 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        🔧 Trabajos ({jobs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'invoices'
                            ? 'border-teal-600 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        📄 Facturas ({invoices.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payments'
                            ? 'border-teal-600 text-teal-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        💳 Pagos ({payments.length})
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {/* Jobs Tab */}
                {activeTab === 'jobs' && (
                    <div className="space-y-3">
                        {jobs.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p>No hay trabajos registrados para este cliente</p>
                            </div>
                        ) : (
                            jobs.map(job => (
                                <JobCard
                                    key={job.id}
                                    job={job}
                                    onViewReport={handleDownloadJobReport}
                                />
                            ))
                        )}
                    </div>
                )}

                {/* Invoices Tab */}
                {activeTab === 'invoices' && (
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        {invoices.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p>No hay facturas para este cliente</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Número</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Subtotal</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-600">IVA</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                                        <th className="px-4 py-3 text-center font-medium text-gray-600">Estado</th>
                                        <th className="px-4 py-3 text-center font-medium text-gray-600">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {invoices.map(invoice => (
                                        <tr key={invoice.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                                            <td className="px-4 py-3">{INVOICE_TYPE_LABELS[invoice.type] || invoice.type}</td>
                                            <td className="px-4 py-3">{invoice.issuedAt ? formatDate(invoice.issuedAt) : '-'}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(invoice.subtotal)}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(invoice.taxAmount)}</td>
                                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(invoice.total)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                                    invoice.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {invoice.status}
                                                </span>
                                                {invoice.afipCae && (
                                                    <span className="ml-1 text-xs text-gray-400" title="CAE AFIP">✓</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Link
                                                    href={`/dashboard/invoices/${invoice.id}`}
                                                    className="text-teal-600 hover:text-teal-700"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && (
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        {payments.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p>No hay pagos registrados para este cliente</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Factura</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Método</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Referencia</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Monto</th>
                                        <th className="px-4 py-3 text-center font-medium text-gray-600">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {payments.map(payment => (
                                        <tr key={payment.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">{payment.invoiceNumber}</td>
                                            <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</td>
                                            <td className="px-4 py-3">{payment.paidAt ? formatDate(payment.paidAt) : '-'}</td>
                                            <td className="px-4 py-3 text-gray-500">{payment.reference || '-'}</td>
                                            <td className="px-4 py-3 text-right font-medium text-green-600">
                                                {formatCurrency(payment.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${payment.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                    payment.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                    {payment.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Documents Section */}
            <div className="card p-6">
                <h2 className="font-medium text-gray-900 mb-4">📄 Documentos Disponibles</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={handleExportFolder}
                        disabled={isExporting}
                        className="flex items-center gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors text-left"
                    >
                        <FileText className="h-8 w-8 text-teal-600" />
                        <div>
                            <p className="font-medium text-gray-900">Reporte Completo</p>
                            <p className="text-sm text-gray-500">Todos los trabajos y facturas</p>
                        </div>
                    </button>

                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-gray-50 text-left opacity-60 cursor-not-allowed">
                        <MessageCircle className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="font-medium text-gray-900">Historial WhatsApp</p>
                            <p className="text-sm text-gray-500">Próximamente</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-gray-50 text-left opacity-60 cursor-not-allowed">
                        <Download className="h-8 w-8 text-blue-600" />
                        <div>
                            <p className="font-medium text-gray-900">Exportar JSON</p>
                            <p className="text-sm text-gray-500">Próximamente</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Email Export Modal - Phase 3.4 */}
            {showEmailExport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Mail className="h-5 w-5 text-teal-600" />
                                Enviar por Email
                            </h3>
                            <button
                                onClick={() => setShowEmailExport(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            {emailExportStatus === 'success' ? (
                                <div className="text-center py-4">
                                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                                    <p className="font-medium text-gray-900">¡Exportación en proceso!</p>
                                    <p className="text-sm text-gray-600 mt-1">{emailExportMessage}</p>
                                    <button
                                        onClick={() => setShowEmailExport(false)}
                                        className="btn-primary mt-4"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Ingresá el email donde querés recibir el reporte PDF de {customer.name}.
                                    </p>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={exportEmail}
                                            onChange={(e) => setExportEmail(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                            placeholder="nombre@empresa.com"
                                        />
                                    </div>

                                    {emailExportStatus === 'error' && (
                                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                            {emailExportMessage}
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowEmailExport(false)}
                                            className="flex-1 btn-outline"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleEmailExport}
                                            disabled={!exportEmail || emailExportStatus === 'sending'}
                                            className="flex-1 btn-primary"
                                        >
                                            {emailExportStatus === 'sending' ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Enviando...
                                                </>
                                            ) : (
                                                <>
                                                    <Mail className="h-4 w-4 mr-2" />
                                                    Enviar
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
