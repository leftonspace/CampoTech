'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
    Banknote,
    FileText,
    Building2,
    Send,
    CheckCircle2,
    ArrowRight,
    AlertCircle,
    Clock,
    RefreshCw,
    TrendingUp,
    ExternalLink,
    Settings,
    Zap,
    Eye,
    X,
    ToggleLeft,
    ToggleRight,
    MessageSquare,
    ArrowUpDown,
    ChevronDown,
    HelpCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type PipelineStage = 'COBRADO' | 'FACTURAR' | 'EN_AFIP' | 'ENVIADA' | 'CERRADO';

type SortOption = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'customer_az' | 'most_urgent';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Más reciente' },
    { value: 'oldest', label: 'Más antiguo' },
    { value: 'amount_desc', label: 'Mayor monto' },
    { value: 'amount_asc', label: 'Menor monto' },
    { value: 'customer_az', label: 'Cliente A-Z' },
    { value: 'most_urgent', label: 'Más urgente' },
];

interface PipelinePayment {
    id: string;
    amount: number;
    method: string;
    status: string;
    paidAt?: string | null;
}

interface PipelineItem {
    id: string;
    stage: PipelineStage;
    jobId?: string | null;
    jobNumber?: string | null;
    serviceType?: string | null;
    completedAt?: string | null;
    customerId: string;
    customerName: string;
    customerPhone?: string | null;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    invoiceType?: string | null;
    invoiceStatus?: string | null;
    subtotal: number;
    taxAmount: number;
    total: number;
    totalPaid: number;
    balance: number;
    afipCae?: string | null;
    afipCaeExpiry?: string | null;
    afipQrCode?: string | null;
    paymentMethod?: string | null;
    payments: PipelinePayment[];
    createdAt: string;
    updatedAt: string;
    statusMessage: string;
    statusDetail?: string;
    timeInStage: number;
}

interface PipelineSummary {
    cobrado: { count: number; total: number };
    facturar: { count: number; total: number };
    enAfip: { count: number; total: number };
    enviada: { count: number; total: number };
    cerrado: { count: number; total: number };
    totalPendiente: number;
    totalFacturado: number;
    totalCobrado: number;
    afipConfigured: boolean;
    afipErrors: number;
}

interface PipelineData {
    items: PipelineItem[];
    summary: PipelineSummary;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const STAGE_CONFIG: Record<PipelineStage, {
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    borderColor: string;
    dotColor: string;
    glowColor: string;
}> = {
    COBRADO: {
        label: 'Cobrado',
        shortLabel: '💰 Cobrado',
        description: 'Trabajo completado, cobro recibido',
        icon: Banknote,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        dotColor: 'bg-amber-400',
        glowColor: 'shadow-amber-500/20',
    },
    FACTURAR: {
        label: 'Facturar',
        shortLabel: '📄 Facturar',
        description: 'Borrador listo para enviar a AFIP',
        icon: FileText,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        dotColor: 'bg-blue-400',
        glowColor: 'shadow-blue-500/20',
    },
    EN_AFIP: {
        label: 'En AFIP',
        shortLabel: '🏛️ En AFIP',
        description: 'Esperando autorización de AFIP',
        icon: Building2,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        dotColor: 'bg-purple-400',
        glowColor: 'shadow-purple-500/20',
    },
    ENVIADA: {
        label: 'Enviada',
        shortLabel: '📨 Enviada',
        description: 'Factura autorizada, enviada al cliente',
        icon: Send,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/30',
        dotColor: 'bg-cyan-400',
        glowColor: 'shadow-cyan-500/20',
    },
    CERRADO: {
        label: 'Cerrado',
        shortLabel: '✅ Cerrado',
        description: 'Pagado y conciliado',
        icon: CheckCircle2,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        dotColor: 'bg-emerald-400',
        glowColor: 'shadow-emerald-500/20',
    },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    CARD: 'Tarjeta',
    MERCADOPAGO: 'MercadoPago',
};

const STAGES: PipelineStage[] = ['COBRADO', 'FACTURAR', 'EN_AFIP', 'ENVIADA', 'CERRADO'];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Time formatting (human-readable)
// ═══════════════════════════════════════════════════════════════════════════════

function formatTimeInStage(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 7) return `${days} días ⚠️`;
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    const minutes = Math.floor(ms / (1000 * 60));
    return `${minutes}min`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Pipeline Header (the 5-stage indicator)
// ═══════════════════════════════════════════════════════════════════════════════

function PipelineHeader({
    summary,
    activeStage,
    onStageClick,
}: {
    summary: PipelineSummary;
    activeStage: PipelineStage | null;
    onStageClick: (stage: PipelineStage | null) => void;
}) {
    const stageCounts: Record<PipelineStage, { count: number; total: number }> = {
        COBRADO: summary.cobrado,
        FACTURAR: summary.facturar,
        EN_AFIP: summary.enAfip,
        ENVIADA: summary.enviada,
        CERRADO: summary.cerrado,
    };

    return (
        <div className="flex items-stretch gap-0 overflow-x-auto">
            {STAGES.map((stage, index) => {
                const config = STAGE_CONFIG[stage];
                const { count: _count, total } = stageCounts[stage];
                const isActive = activeStage === stage;
                const Icon = config.icon;

                return (
                    <button
                        key={stage}
                        onClick={() => onStageClick(isActive ? null : stage)}
                        className={cn(
                            'relative flex-1 min-w-[120px] flex flex-col items-center gap-1.5 py-3 px-3 transition-all duration-300 border-b-2',
                            isActive
                                ? `${config.bgColor} ${config.borderColor} border-b-current ${config.color}`
                                : 'border-b-transparent hover:bg-muted/50',
                            index === 0 && 'rounded-tl-lg',
                            index === STAGES.length - 1 && 'rounded-tr-lg'
                        )}
                    >
                        {/* Stage indicator */}
                        <div className="relative">
                            <Icon className={cn('w-6 h-6', isActive ? config.color : 'text-muted-foreground')} />
                        </div>

                        {/* Label */}
                        <span className={cn(
                            'text-sm font-medium',
                            isActive ? config.color : 'text-muted-foreground'
                        )}>
                            {config.label}
                        </span>

                        {/* Total */}
                        {total > 0 && (
                            <span className="text-sm font-semibold text-muted-foreground">
                                {formatCurrency(total)}
                            </span>
                        )}

                        {/* Arrow connector */}
                        {index < STAGES.length - 1 && (
                            <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 text-muted-foreground/30 z-10" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Pipeline Card (a single item in the pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

function PipelineCard({
    item,
    onSelect,
    isSelected,
}: {
    item: PipelineItem;
    onSelect: (item: PipelineItem) => void;
    isSelected: boolean;
}) {
    const config = STAGE_CONFIG[item.stage];
    const _Icon = config.icon;
    const isUrgent = item.timeInStage > 1000 * 60 * 60 * 48; // > 48 hours

    return (
        <button
            onClick={() => onSelect(item)}
            className={cn(
                'w-full text-left rounded-xl border p-4 transition-all duration-200 group',
                isSelected
                    ? `${config.bgColor} ${config.borderColor} ring-1 ring-current ${config.color}`
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                isUrgent && !isSelected && 'border-red-500/30 animate-pulse-subtle'
            )}
        >
            {/* Top row: Customer + Amount */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', config.dotColor)} />
                    <span className="font-semibold text-base truncate">{item.customerName}</span>
                </div>
                <span className="text-base font-bold tabular-nums text-foreground shrink-0">
                    {formatCurrency(item.total)}
                </span>
            </div>

            {/* Job/Invoice reference */}
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                {item.jobNumber && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 font-mono">
                        #{item.jobNumber}
                    </span>
                )}
                {item.invoiceNumber && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 font-mono">
                        {item.invoiceNumber}
                    </span>
                )}
                {item.invoiceType && (
                    <span className="text-xs uppercase tracking-wider text-muted-foreground/60">
                        {item.invoiceType.replace('FACTURA_', 'Fact. ')}
                    </span>
                )}
            </div>

            {/* Status message */}
            <div className="mt-2 flex items-center justify-between gap-2">
                <span className={cn('text-sm', config.color)}>{item.statusMessage}</span>
                <span className={cn(
                    'text-xs tabular-nums',
                    isUrgent ? 'text-red-400 font-medium' : 'text-muted-foreground'
                )}>
                    {formatTimeInStage(item.timeInStage)}
                </span>
            </div>

            {/* Payment status bar for ENVIADA stage */}
            {item.stage === 'ENVIADA' && item.total > 0 && (
                <div className="mt-2">
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (item.totalPaid / item.total) * 100)}%` }}
                        />
                    </div>
                    {item.totalPaid > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {formatCurrency(item.totalPaid)} de {formatCurrency(item.total)} cobrado
                        </p>
                    )}
                </div>
            )}
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Detail Panel (right side)
// ═══════════════════════════════════════════════════════════════════════════════

function DetailPanel({
    item,
    onClose,
}: {
    item: PipelineItem;
    onClose: () => void;
}) {
    const config = STAGE_CONFIG[item.stage];

    // Build timeline steps
    const timelineSteps = [
        {
            label: 'Trabajo completado',
            date: item.completedAt,
            done: !!item.completedAt,
            active: item.stage === 'COBRADO',
        },
        {
            label: item.stage === 'COBRADO' ? 'Crear factura' : 'Factura creada',
            date: item.invoiceId ? item.createdAt : null,
            done: !!item.invoiceId,
            active: item.stage === 'FACTURAR',
            detail: item.invoiceNumber || undefined,
        },
        {
            label: item.afipCae ? 'Autorizada por AFIP' : 'Autorización AFIP',
            date: item.afipCae ? item.updatedAt : null,
            done: !!item.afipCae,
            active: item.stage === 'EN_AFIP',
            detail: item.afipCae ? `CAE: ${item.afipCae}` : undefined,
        },
        {
            label: 'Enviada al cliente',
            date: item.invoiceStatus === 'SENT' || item.invoiceStatus === 'PAID' ? item.updatedAt : null,
            done: item.invoiceStatus === 'SENT' || item.invoiceStatus === 'PAID' || item.invoiceStatus === 'OVERDUE',
            active: item.stage === 'ENVIADA',
        },
        {
            label: 'Pago registrado',
            date: item.payments[0]?.paidAt || null,
            done: item.totalPaid >= item.total && item.total > 0,
            active: false,
            detail: item.totalPaid > 0
                ? `${formatCurrency(item.totalPaid)} de ${formatCurrency(item.total)}`
                : undefined,
        },
        {
            label: 'Conciliado',
            date: item.stage === 'CERRADO' ? item.updatedAt : null,
            done: item.stage === 'CERRADO',
            active: false,
        },
    ];

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className={cn(
                'px-5 py-4 border-b flex items-center justify-between',
                config.bgColor, config.borderColor
            )}>
                <div>
                    <h3 className="font-semibold text-foreground">{item.customerName}</h3>
                    <p className={cn('text-sm', config.color)}>{item.statusMessage}</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50">
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
                {/* Amount */}
                <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold tabular-nums">{formatCurrency(item.total)}</span>
                    {item.balance > 0 && item.balance !== item.total && (
                        <span className="text-sm text-amber-400">
                            Saldo: {formatCurrency(item.balance)}
                        </span>
                    )}
                </div>

                {/* Status detail */}
                {item.statusDetail && (
                    <div className={cn(
                        'rounded-lg p-3 text-sm',
                        config.bgColor, config.borderColor, 'border'
                    )}>
                        <p className={config.color}>{item.statusDetail}</p>
                    </div>
                )}

                {/* Progress Timeline */}
                <div className="space-y-0">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Progreso
                    </h4>
                    <div className="space-y-0">
                        {timelineSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                                {/* Vertical line + dot */}
                                <div className="flex flex-col items-center">
                                    <div className={cn(
                                        'w-3 h-3 rounded-full border-2 shrink-0 transition-all',
                                        step.done
                                            ? 'bg-emerald-400 border-emerald-400'
                                            : step.active
                                                ? `${config.dotColor} border-current ${config.color} animate-pulse`
                                                : 'bg-transparent border-muted-foreground/30'
                                    )} />
                                    {idx < timelineSteps.length - 1 && (
                                        <div className={cn(
                                            'w-0.5 h-8',
                                            step.done ? 'bg-emerald-400/40' : 'bg-muted-foreground/10'
                                        )} />
                                    )}
                                </div>

                                {/* Label + date */}
                                <div className="pb-4 -mt-0.5">
                                    <p className={cn(
                                        'text-sm font-medium',
                                        step.done ? 'text-foreground' : step.active ? config.color : 'text-muted-foreground/60'
                                    )}>
                                        {step.label}
                                    </p>
                                    {step.detail && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                                    )}
                                    {step.date && (
                                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                                            {formatRelativeTime(step.date)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    {item.jobNumber && (
                        <div>
                            <p className="text-xs text-muted-foreground">Trabajo</p>
                            <Link
                                href={`/dashboard/jobs?id=${item.jobId}`}
                                className="text-primary hover:underline font-mono"
                            >
                                #{item.jobNumber}
                            </Link>
                        </div>
                    )}
                    {item.serviceType && (
                        <div>
                            <p className="text-xs text-muted-foreground">Servicio</p>
                            <p className="font-medium">{item.serviceType}</p>
                        </div>
                    )}
                    {item.invoiceNumber && (
                        <div>
                            <p className="text-xs text-muted-foreground">Factura</p>
                            <Link
                                href={`/dashboard/invoices/${item.invoiceId}`}
                                className="text-primary hover:underline font-mono"
                            >
                                {item.invoiceNumber}
                            </Link>
                        </div>
                    )}
                    {item.invoiceType && (
                        <div>
                            <p className="text-xs text-muted-foreground">Tipo</p>
                            <p className="font-medium">{item.invoiceType.replace('FACTURA_', 'Factura ')}</p>
                        </div>
                    )}
                </div>

                {/* Payments */}
                {item.payments.length > 0 && (
                    <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Pagos
                        </h4>
                        <div className="space-y-2">
                            {item.payments.map((p) => (
                                <div
                                    key={p.id}
                                    className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            'w-2 h-2 rounded-full',
                                            p.status === 'COMPLETED' ? 'bg-emerald-400' :
                                                p.status === 'PENDING' ? 'bg-amber-400' : 'bg-red-400'
                                        )} />
                                        <span>{PAYMENT_METHOD_LABELS[p.method] || p.method}</span>
                                    </div>
                                    <span className="font-medium tabular-nums">{formatCurrency(p.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="pt-2 space-y-2">
                    {item.stage === 'COBRADO' && (
                        <Link
                            href={`/dashboard/invoices?action=create&customerId=${item.customerId}&jobId=${item.jobId}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Crear Factura
                        </Link>
                    )}
                    {item.stage === 'FACTURAR' && (
                        <Link
                            href={`/dashboard/invoices/${item.invoiceId}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                        >
                            <Zap className="w-4 h-4" />
                            Enviar a AFIP
                        </Link>
                    )}
                    {item.stage === 'ENVIADA' && item.balance > 0 && (
                        <Link
                            href={`/dashboard/invoices/${item.invoiceId}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                        >
                            <Banknote className="w-4 h-4" />
                            Registrar Pago
                        </Link>
                    )}
                    {item.invoiceId && (
                        <Link
                            href={`/dashboard/invoices/${item.invoiceId}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted/50 transition-colors"
                        >
                            <Eye className="w-4 h-4" />
                            Ver Factura Completa
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: AFIP Setup Banner
// ═══════════════════════════════════════════════════════════════════════════════

function AfipSetupBanner() {
    return (
        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5 p-4">
            <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-400">
                        AFIP no está configurada
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Para autorizar tus facturas electrónicas, necesitás subir tu certificado digital y configurar el punto de venta.
                    </p>
                    <Link
                        href="/dashboard/settings/afip"
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Configurar AFIP
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Auto-Invoicing Settings Panel
// ═══════════════════════════════════════════════════════════════════════════════

interface BillingSettingsData {
    autoInvoiceEnabled: boolean;
    autoAfipSubmit: boolean;
    autoWhatsappInvoice: boolean;
    defaultInvoiceType: 'C' | 'B' | 'A';
    afipConfigured: boolean;
    afipCuit: string | null;
    afipPuntoVenta: string | null;
    afipEnvironment: string | null;
    afipConnectedAt: string | null;
    whatsappConfigured: boolean;
}

function AutoInvoiceSettingsPanel({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ['billing-settings'],
        queryFn: async () => {
            const res = await apiRequest<BillingSettingsData>('/billing/settings');
            if (!res.success || !res.data) throw new Error(res.error?.message || 'Error');
            return res.data;
        },
    });

    const mutation = useMutation({
        mutationFn: async (updates: Partial<BillingSettingsData>) => {
            const res = await apiRequest('/billing/settings', { method: 'PUT', body: updates });
            if (!res.success) throw new Error(res.error?.message || (typeof res.error === 'string' ? (res.error as unknown as string) : 'Error'));
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['billing-settings'] });
        },
    });

    const handleToggle = useCallback((key: string, value: boolean) => {
        mutation.mutate({ [key]: value });
    }, [mutation]);

    if (isLoading) {
        return (
            <div className="rounded-xl border border-border bg-card p-6 animate-pulse space-y-4">
                <div className="h-6 w-48 bg-muted/30 rounded" />
                <div className="h-12 bg-muted/30 rounded" />
                <div className="h-12 bg-muted/30 rounded" />
                <div className="h-12 bg-muted/30 rounded" />
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-indigo-500/5 to-violet-500/5">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-semibold text-foreground">Facturación Automática</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>

            <div className="p-5 space-y-4">
                {/* Auto-invoice toggle */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium">Crear factura automáticamente</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Al completar un trabajo y cobrar, se crea un borrador de factura automáticamente.
                        </p>
                    </div>
                    <button
                        onClick={() => handleToggle('autoInvoiceEnabled', !settings.autoInvoiceEnabled)}
                        disabled={mutation.isPending}
                        className="shrink-0 mt-0.5"
                    >
                        {settings.autoInvoiceEnabled ? (
                            <ToggleRight className="w-10 h-10 text-emerald-400" />
                        ) : (
                            <ToggleLeft className="w-10 h-10 text-muted-foreground/40" />
                        )}
                    </button>
                </div>

                {/* Auto AFIP submit toggle */}
                <div className={cn(
                    'flex items-start justify-between gap-4 transition-opacity',
                    !settings.autoInvoiceEnabled && 'opacity-40 pointer-events-none'
                )}>
                    <div>
                        <p className="text-sm font-medium">Enviar a AFIP automáticamente</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            La factura se envía a AFIP para obtener CAE sin intervención manual.
                        </p>
                        {!settings.afipConfigured && (
                            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Configurá AFIP primero en Configuración
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => handleToggle('autoAfipSubmit', !settings.autoAfipSubmit)}
                        disabled={mutation.isPending || !settings.afipConfigured}
                        className={cn('shrink-0 mt-0.5', !settings.afipConfigured && 'opacity-30 cursor-not-allowed')}
                    >
                        {settings.autoAfipSubmit ? (
                            <ToggleRight className="w-10 h-10 text-emerald-400" />
                        ) : (
                            <ToggleLeft className="w-10 h-10 text-muted-foreground/40" />
                        )}
                    </button>
                </div>

                {/* Auto WhatsApp toggle */}
                <div className={cn(
                    'flex items-start justify-between gap-4 transition-opacity',
                    !settings.autoInvoiceEnabled && 'opacity-40 pointer-events-none'
                )}>
                    <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-emerald-400" />
                            Enviar factura por WhatsApp
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            El cliente recibe la factura por WhatsApp al momento de ser generada.
                        </p>
                        {!settings.whatsappConfigured && (
                            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Configurá WhatsApp primero en Configuración
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => handleToggle('autoWhatsappInvoice', !settings.autoWhatsappInvoice)}
                        disabled={mutation.isPending || !settings.whatsappConfigured}
                        className={cn('shrink-0 mt-0.5', !settings.whatsappConfigured && 'opacity-30 cursor-not-allowed')}
                    >
                        {settings.autoWhatsappInvoice ? (
                            <ToggleRight className="w-10 h-10 text-emerald-400" />
                        ) : (
                            <ToggleLeft className="w-10 h-10 text-muted-foreground/40" />
                        )}
                    </button>
                </div>

                {/* Default invoice type */}
                <div className={cn(
                    'flex items-start justify-between gap-4 transition-opacity',
                    !settings.autoInvoiceEnabled && 'opacity-40 pointer-events-none'
                )}>
                    <div>
                        <p className="text-sm font-medium">Tipo de factura por defecto</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Monotributistas usan Factura C. Responsables inscriptos pueden necesitar A o B.
                        </p>
                    </div>
                    <select
                        value={settings.defaultInvoiceType}
                        onChange={(e) => mutation.mutate({ defaultInvoiceType: e.target.value as 'A' | 'B' | 'C' })}
                        disabled={mutation.isPending}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="C">Factura C</option>
                        <option value="B">Factura B</option>
                        <option value="A">Factura A</option>
                    </select>
                </div>

                {/* AFIP Connection Status */}
                {settings.afipConfigured && (
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 mt-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-emerald-400">AFIP Conectada</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                            <div>
                                <span className="text-muted-foreground/60">CUIT: </span>
                                {settings.afipCuit}
                            </div>
                            <div>
                                <span className="text-muted-foreground/60">Punto Venta: </span>
                                {settings.afipPuntoVenta}
                            </div>
                        </div>
                    </div>
                )}

                {/* Saving indicator */}
                {mutation.isPending && (
                    <p className="text-xs text-muted-foreground animate-pulse">Guardando...</p>
                )}
                {mutation.isError && (
                    <p className="text-xs text-red-400">
                        {mutation.error instanceof Error ? mutation.error.message : 'Error al guardar'}
                    </p>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BillingHubPage() {
    const searchParams = useSearchParams();
    const searchQuery = searchParams.get('search') || '';
    const [activeStage, setActiveStage] = useState<PipelineStage | null>('COBRADO');
    const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const sortMenuRef = useRef<HTMLDivElement>(null);

    // Portal-based modal animation (matches EditJobModal pattern)
    const [modalMounted, setModalMounted] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        if (selectedItem) {
            setModalMounted(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setModalVisible(true);
                });
            });
            document.body.style.overflow = 'hidden';
        } else {
            setModalVisible(false);
            const timer = setTimeout(() => setModalMounted(false), 300);
            return () => clearTimeout(timer);
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedItem]);

    const handleCloseModal = useCallback(() => {
        setModalVisible(false);
        setTimeout(() => setSelectedItem(null), 300);
    }, []);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['billing-pipeline'],
        queryFn: async () => {
            const res = await apiRequest<PipelineData>('/billing/pipeline');
            if (!res.success || !res.data) throw new Error(res.error?.message || 'Error');
            return res.data;
        },
        refetchInterval: 30000, // Auto-refresh every 30s
    });

    // Close sort menu on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
                setShowSortMenu(false);
            }
        }
        if (showSortMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showSortMenu]);

    // Filter items by active stage and search query from global search bar
    const filteredItems = useMemo(() => {
        if (!data?.items) return [];
        let items = data.items;

        // Filter by active stage
        if (activeStage) {
            items = items.filter(i => i.stage === activeStage);
        } else {
            // By default, hide CERRADO items (user can click the Cerrado stage to see them)
            items = items.filter(i => i.stage !== 'CERRADO');
        }

        // Filter by search query (customer name) from global search bar
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(i =>
                i.customerName.toLowerCase().includes(q) ||
                (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(q)) ||
                (i.jobNumber && i.jobNumber.toLowerCase().includes(q))
            );
        }

        // Sort items — use completedAt for date sort (createdAt is often the seed timestamp)
        const sorted = [...items];
        const getDate = (item: PipelineItem) =>
            new Date(item.completedAt || item.createdAt).getTime();
        switch (sortBy) {
            case 'newest':
                sorted.sort((a, b) => getDate(b) - getDate(a));
                break;
            case 'oldest':
                sorted.sort((a, b) => getDate(a) - getDate(b));
                break;
            case 'amount_desc':
                sorted.sort((a, b) => b.total - a.total);
                break;
            case 'amount_asc':
                sorted.sort((a, b) => a.total - b.total);
                break;
            case 'customer_az':
                sorted.sort((a, b) => a.customerName.localeCompare(b.customerName, 'es-AR'));
                break;
            case 'most_urgent':
                sorted.sort((a, b) => b.timeInStage - a.timeInStage);
                break;
        }

        return sorted;
    }, [data?.items, activeStage, searchQuery, sortBy]);

    // Group items by stage for column view
    const _groupedItems = useMemo(() => {
        const groups: Record<PipelineStage, PipelineItem[]> = {
            COBRADO: [], FACTURAR: [], EN_AFIP: [], ENVIADA: [], CERRADO: [],
        };
        filteredItems.forEach(item => {
            groups[item.stage].push(item);
        });
        return groups;
    }, [filteredItems]);

    // Empty state
    if (!isLoading && !error && data && data.items.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Facturación</h1>
                        <p className="text-muted-foreground">Tu centro de control financiero</p>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                        <TrendingUp className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold">No hay actividad de facturación</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        Cuando completes trabajos y cobres a tus clientes, las facturas aparecerán acá organizadas por estado.
                    </p>
                    <Link
                        href="/dashboard/jobs"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        Ver Trabajos
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-foreground">Facturación</h1>
                        <button
                            onClick={() => setShowHelpModal(true)}
                            className="p-1 rounded-full text-muted-foreground/50 hover:text-amber-400 hover:bg-amber-400/10 transition-all duration-200"
                            title="¿Cómo funciona la facturación?"
                        >
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Desde el cobro hasta la factura autorizada — todo en un lugar
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={cn(
                            'p-2 rounded-lg border transition-colors',
                            showSettings
                                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                                : 'border-border hover:bg-muted/50'
                        )}
                        title="Configuración auto-facturación"
                    >
                        <Zap className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
                        ))}
                    </div>
                    <div className="h-16 rounded-lg bg-muted/30 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
                        ))}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-red-400">Error al cargar la facturación</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{(error as Error).message}</p>
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="ml-auto px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Help Modal */}
            {showHelpModal && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowHelpModal(false); }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

                    {/* Modal — full educational article */}
                    <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        {/* Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card/95 backdrop-blur-sm rounded-t-2xl">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-amber-400/10">
                                    <HelpCircle className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Guía de Facturación</h2>
                                    <p className="text-xs text-muted-foreground">Etapas, riesgos de demora, y cómo proteger tu negocio</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5 space-y-8">

                            {/* ── SECTION 1: Pipeline stages ── */}
                            <div>
                                <h3 className="text-lg font-bold text-foreground mb-1">📋 El camino de tu factura</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Cada trabajo pasa por 5 etapas hasta quedar 100% cerrado:
                                </p>
                                <div className="space-y-2">
                                    {[
                                        { emoji: '💰', label: 'Cobrado', desc: 'Trabajo listo, cobraste al cliente. La plata está en tu bolsillo.' },
                                        { emoji: '📄', label: 'Facturar', desc: 'Creás el borrador de la factura con los datos del trabajo.' },
                                        { emoji: '🏛️', label: 'En AFIP', desc: 'Se envía a AFIP para que autorice la factura electrónica (CAE).' },
                                        { emoji: '📨', label: 'Enviada', desc: 'Factura autorizada y enviada al cliente. Esperás confirmación de pago.' },
                                        { emoji: '✅', label: 'Cerrado', desc: 'Pagado y conciliado. Caso cerrado, todo en orden.' },
                                    ].map((step, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                                            <span className="text-xl shrink-0">{step.emoji}</span>
                                            <div>
                                                <span className="text-sm font-semibold text-foreground">{step.label}</span>
                                                <p className="text-sm text-muted-foreground">{step.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-border" />

                            {/* ── SECTION 2: Why invoice quickly ── */}
                            <div>
                                <h3 className="text-lg font-bold text-foreground mb-1">⏱️ ¿Por qué facturar rápido?</h3>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Ya cobraste — <strong className="text-foreground">la plata es tuya</strong> desde ese momento.
                                    La factura no cambia cuánto tenés. Pero es el <strong className="text-foreground">respaldo legal</strong> de tu cobro, y atrasarla trae problemas reales:
                                </p>
                            </div>

                            {/* Risk 1: AFIP */}
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl shrink-0">🏛️</span>
                                    <div>
                                        <p className="text-sm font-semibold text-red-400 mb-1">Riesgo 1: AFIP te puede multar</p>
                                        <p className="text-sm text-muted-foreground">
                                            AFIP espera que la factura se emita <strong className="text-foreground">cerca de la fecha del cobro</strong>.
                                            Si cobraste en febrero y recién facturás en abril, eso es una <strong className="text-red-400">señal de alerta</strong> en una auditoría.
                                        </p>
                                        <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/15 p-2.5 text-xs text-red-300 space-y-1">
                                            <p>• Multa por <strong>omisión de facturación</strong></p>
                                            <p>• Recategorización retroactiva de Monotributo</p>
                                            <p>• En casos extremos, puede ser considerado evasión fiscal</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Risk 2: Monotributo */}
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl shrink-0">📊</span>
                                    <div>
                                        <p className="text-sm font-semibold text-amber-400 mb-1">Riesgo 2: Trampa del Monotributo</p>
                                        <p className="text-sm text-muted-foreground">
                                            Si retrasás facturas, terminás <strong className="text-foreground">acumulando todo junto</strong> en un solo mes. AFIP mira tus facturas mensuales para determinar tu categoría:
                                        </p>
                                        <div className="mt-2 rounded-lg bg-background/50 border border-border p-3 space-y-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-emerald-400 shrink-0">✅</span>
                                                <span className="text-muted-foreground">Facturás <strong className="text-foreground">$ 200K por mes</strong> → Monotributo categoría D</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-red-400 shrink-0">❌</span>
                                                <span className="text-muted-foreground">Acumulás 3 meses y facturás <strong className="text-foreground">$ 600K de golpe</strong> → te pasan a categoría G o a Responsable Inscripto</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Una recategorización te cuesta <strong className="text-foreground">miles de pesos más por mes</strong> en aportes.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Risk 3: Records */}
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl shrink-0">🧮</span>
                                    <div>
                                        <p className="text-sm font-semibold text-blue-400 mb-1">Riesgo 3: Perdés el control de tus números</p>
                                        <p className="text-sm text-muted-foreground">
                                            Sin facturas al día, no sabés cuánto facturaste este mes, si tus precios cubren tus costos,
                                            ni qué información darle a tu contador. <strong className="text-foreground">Volás a ciegas.</strong>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Risk 4: Disputes */}
                            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl shrink-0">🤝</span>
                                    <div>
                                        <p className="text-sm font-semibold text-purple-400 mb-1">Riesgo 4: Disputas con clientes</p>
                                        <p className="text-sm text-muted-foreground">
                                            Si un cliente te dice <em>&quot;no acordamos ese monto&quot;</em> 2 meses después,
                                            sin factura es tu palabra contra la de él. <strong className="text-foreground">La factura es tu respaldo legal.</strong>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-border" />

                            {/* ── SECTION 3: Inflation awareness (correctly framed) ── */}
                            <div>
                                <h3 className="text-lg font-bold text-foreground mb-1">📈 La inflación y tus precios</h3>
                                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 mb-3">
                                    <p className="text-sm text-emerald-300">
                                        <strong>Aclaración importante:</strong> la inflación erosiona tu plata desde el momento que la recibís, <strong className="text-foreground">sin importar cuándo hacés la factura</strong>. Si cobraste hoy y gastás o cambiás la plata hoy, la factura no cambia nada de eso.
                                    </p>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Pero la inflación sí afecta algo clave: <strong className="text-amber-400">tus precios para el próximo trabajo</strong>. Si no los ajustás, cada mes ganás menos:
                                </p>

                                <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-4">
                                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">Ejemplo con inflación del 10% mensual:</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <p className="text-xs text-emerald-400/80 mb-1">Febrero — Hacés el trabajo</p>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Cobrás:</span>
                                                    <span className="font-bold text-foreground">$ 100.000</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Materiales:</span>
                                                    <span className="text-red-400">- $ 30.000</span>
                                                </div>
                                                <div className="flex justify-between border-t border-emerald-500/20 pt-1">
                                                    <span className="font-medium text-foreground">Ganancia:</span>
                                                    <span className="font-bold text-emerald-400">$ 70.000</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <p className="text-xs text-red-400/80 mb-1">Marzo — Mismo trabajo, mismo precio</p>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Si cobrás igual:</span>
                                                    <span className="font-bold text-foreground">$ 100.000</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Materiales (+10%):</span>
                                                    <span className="text-red-400">- $ 33.000</span>
                                                </div>
                                                <div className="flex justify-between border-t border-red-500/20 pt-1">
                                                    <span className="font-medium text-foreground">Ganancia:</span>
                                                    <span className="font-bold text-red-400">$ 67.000 ↓</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground text-center mt-3">
                                        Si no ajustás tus precios, <strong className="text-amber-400">cada mes ganás menos</strong> haciendo el mismo trabajo.
                                        Tener las facturas al día te ayuda a <strong className="text-foreground">ver el patrón y reaccionar a tiempo</strong>.
                                    </p>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-border" />

                            {/* ── SECTION 4: Actions ── */}
                            <div>
                                <h3 className="text-lg font-bold text-emerald-400 mb-1">💡 ¿Qué hacer? — 4 acciones concretas</h3>
                                <div className="space-y-3 mt-3">
                                    {[
                                        {
                                            num: '1',
                                            title: 'Facturá el mismo día que cobrás',
                                            desc: 'Es la forma más segura de mantenerte en regla con AFIP y evitar acumulaciones de Monotributo.',
                                            color: 'emerald',
                                        },
                                        {
                                            num: '2',
                                            title: 'Usá el filtro "Más urgente"',
                                            desc: 'Te muestra los cobros más viejos sin facturar. Son los que más riesgo tienen con AFIP.',
                                            color: 'amber',
                                        },
                                        {
                                            num: '3',
                                            title: 'Ajustá tus precios cada mes',
                                            desc: 'Revisá si tus materiales y nafta subieron. Si subieron, tus presupuestos también deberían subir.',
                                            color: 'blue',
                                        },
                                        {
                                            num: '4',
                                            title: 'Consultá con tu contador',
                                            desc: 'Tu contador puede ayudarte a elegir el mejor régimen fiscal y evitar sorpresas con AFIP.',
                                            color: 'purple',
                                        },
                                    ].map((action) => (
                                        <div key={action.num} className={cn('flex items-start gap-3 p-3 rounded-xl border', {
                                            'border-emerald-500/20 bg-emerald-500/5': action.color === 'emerald',
                                            'border-amber-500/20 bg-amber-500/5': action.color === 'amber',
                                            'border-blue-500/20 bg-blue-500/5': action.color === 'blue',
                                            'border-purple-500/20 bg-purple-500/5': action.color === 'purple',
                                        })}>
                                            <span className={cn('flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0', {
                                                'bg-emerald-400/20 text-emerald-400': action.color === 'emerald',
                                                'bg-amber-400/20 text-amber-400': action.color === 'amber',
                                                'bg-blue-400/20 text-blue-400': action.color === 'blue',
                                                'bg-purple-400/20 text-purple-400': action.color === 'purple',
                                            })}>
                                                {action.num}
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">{action.title}</p>
                                                <p className="text-sm text-muted-foreground mt-0.5">{action.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Key takeaway */}
                            <div className="rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5 text-center">
                                <p className="text-base font-bold text-foreground mb-1">
                                    🧠 Lo más importante para recordar:
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    La factura <strong className="text-foreground">no cambia cuánta plata tenés</strong> — ya la cobraste.{' '}
                                    Pero hacerla rápido te protege de <strong className="text-red-400">multas de AFIP</strong>,{' '}
                                    <strong className="text-amber-400">recategorizaciones de Monotributo</strong>,{' '}
                                    y te da <strong className="text-emerald-400">control real sobre tu negocio</strong>.
                                </p>
                            </div>

                            {/* Disclaimer */}
                            <p className="text-[11px] text-muted-foreground/50 text-center italic">
                                Información educativa general. No constituye asesoramiento fiscal, contable ni financiero.
                                Consultá siempre con tu contador para tu situación particular.
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="sticky bottom-0 px-6 py-4 border-t border-border bg-card/95 backdrop-blur-sm rounded-b-2xl">
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="w-full py-3 px-4 rounded-xl bg-amber-400 text-black font-bold text-sm hover:bg-amber-300 transition-colors"
                            >
                                ✅ Entendido
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Main Content */}
            {data && (
                <>
                    {/* Auto-Invoicing Settings Panel */}
                    {showSettings && (
                        <AutoInvoiceSettingsPanel onClose={() => setShowSettings(false)} />
                    )}

                    {/* AFIP Setup Banner */}
                    {!data.summary.afipConfigured && !showSettings && <AfipSetupBanner />}

                    {/* Pipeline Header */}
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <PipelineHeader
                            summary={data.summary}
                            activeStage={activeStage}
                            onStageClick={setActiveStage}
                        />
                    </div>

                    {/* Sort Bar */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                            {activeStage === 'COBRADO' && ' sin facturar'}
                            {activeStage === 'FACTURAR' && ' por enviar a AFIP'}
                            {activeStage === 'EN_AFIP' && ' en proceso'}
                            {activeStage === 'ENVIADA' && ' enviadas al cliente'}
                            {activeStage === 'CERRADO' && ' cerrados'}
                        </p>
                        <div className="relative" ref={sortMenuRef}>
                            <button
                                onClick={() => setShowSortMenu(!showSortMenu)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all duration-200',
                                    showSortMenu
                                        ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                                        : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/30'
                                )}
                            >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                                <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
                                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', showSortMenu && 'rotate-180')} />
                            </button>
                            {showSortMenu && (
                                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-card shadow-xl shadow-black/20 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                    {SORT_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setSortBy(option.value);
                                                setShowSortMenu(false);
                                            }}
                                            className={cn(
                                                'w-full text-left px-3 py-2 text-sm transition-colors',
                                                sortBy === option.value
                                                    ? 'bg-indigo-500/10 text-indigo-400 font-medium'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pipeline Content: Cards Grid */}
                    <div>
                        {filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center py-12 text-center">
                                <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    {activeStage
                                        ? `No hay items en "${STAGE_CONFIG[activeStage].label}"`
                                        : 'No hay items pendientes'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredItems.map((item) => (
                                    <PipelineCard
                                        key={item.id}
                                        item={item}
                                        onSelect={setSelectedItem}
                                        isSelected={selectedItem?.id === item.id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Detail Modal (portal-based, full viewport overlay) */}
                    {modalMounted && selectedItem && createPortal(
                        <div
                            className={cn(
                                'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-out',
                                modalVisible ? 'bg-black/60' : 'bg-transparent pointer-events-none'
                            )}
                            onClick={handleCloseModal}
                        >
                            <div
                                className={cn(
                                    'bg-card rounded-2xl shadow-xl w-full max-w-lg transform transition-all duration-300 ease-out overflow-hidden',
                                    modalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                                )}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="max-h-[92vh] overflow-y-auto">
                                    <DetailPanel item={selectedItem} onClose={handleCloseModal} />
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            )}
        </div>
    );
}
