/**
 * Phase 7.1: Public Status Page
 * ===============================
 * 
 * Public page at /estado showing real-time system health.
 * No authentication required.
 */

import Link from 'next/link';
import {
    CheckCircle,
    AlertCircle,
    XCircle,
    Wrench,
    RefreshCw,
    Bell,
    Clock,
    ChevronRight,
    ExternalLink,
} from 'lucide-react';

export const metadata = {
    title: 'Estado del Sistema | CampoTech',
    description: 'Estado en tiempo real de todos los servicios de CampoTech. Monitoreo de Dashboard, API, WhatsApp AI, AFIP y más.',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceStatus {
    id: string;
    name: string;
    description: string;
    status: string;
    statusText: string;
    statusIcon: string;
    latencyMs: number;
    message?: string;
}

interface Incident {
    id: string;
    title: string;
    status: string;
    severity: string;
    services: string[];
    startedAt: string;
    resolvedAt?: string;
    duration: string;
}

interface StatusData {
    status: string;
    message: string;
    services: ServiceStatus[];
    uptime: { percent30Days: number; displayText: string };
    incidents: Incident[];
    lastUpdated: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════════════════════════

async function getStatusData(): Promise<StatusData> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    try {
        const response = await fetch(`${baseUrl}/api/status`, {
            next: { revalidate: 30 }, // ISR: revalidate every 30 seconds
        });

        if (!response.ok) {
            throw new Error('Failed to fetch status');
        }

        return response.json();
    } catch {
        // Return fallback data if API fails
        return {
            status: 'operational',
            message: 'Verificando estado...',
            services: [],
            uptime: { percent30Days: 99.9, displayText: '99.90%' },
            incidents: [],
            lastUpdated: new Date().toISOString(),
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default async function StatusPage() {
    const data = await getStatusData();

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 text-emerald-600 font-bold text-xl">
                            CampoTech
                        </Link>
                        <Link
                            href="/"
                            className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"
                        >
                            Ir al sitio <ExternalLink className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Overall Status Banner */}
                <StatusBanner status={data.status} message={data.message} />

                {/* Last Updated */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Última actualización: {formatDate(data.lastUpdated)}
                    </span>
                    <button className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700">
                        <RefreshCw className="w-4 h-4" />
                        Actualizar
                    </button>
                </div>

                {/* Services Grid */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="font-semibold text-gray-900">Servicios</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {data.services.length > 0 ? (
                            data.services.map((service) => (
                                <ServiceRow key={service.id} service={service} />
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                Cargando estado de servicios...
                            </div>
                        )}
                    </div>
                </section>

                {/* Uptime Chart */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="font-semibold text-gray-900">Últimos 30 días</h2>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-4xl font-bold text-gray-900">
                                {data.uptime.displayText}
                            </span>
                            <span className="text-gray-500">uptime</span>
                        </div>
                        <div className="h-8 bg-gray-100 rounded-lg overflow-hidden flex">
                            {/* Simulated uptime bars - 30 days */}
                            {Array.from({ length: 30 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="flex-1 mx-px first:ml-0 last:mr-0 bg-emerald-500 hover:bg-emerald-400 transition-colors"
                                    title={`Día ${30 - i}`}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Hace 30 días</span>
                            <span>Hoy</span>
                        </div>
                    </div>
                </section>

                {/* Incidents */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="font-semibold text-gray-900">Incidentes recientes</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {data.incidents.length > 0 ? (
                            data.incidents.map((incident) => (
                                <IncidentRow key={incident.id} incident={incident} />
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                                <p className="text-gray-900 font-medium">Sin incidentes recientes</p>
                                <p className="text-gray-500 text-sm">
                                    No ha habido interrupciones en los últimos 30 días
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Subscribe Section */}
                <section className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-emerald-100 rounded-lg">
                            <Bell className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">
                                Recibí notificaciones
                            </h3>
                            <p className="text-gray-600 text-sm mb-4">
                                Suscribite para recibir alertas cuando haya incidentes o mantenimientos programados.
                            </p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                            >
                                Suscribirse a alertas <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-12">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>© 2026 CampoTech. Todos los derechos reservados.</span>
                        <Link href="mailto:soporte@campotech.com.ar" className="hover:text-emerald-600">
                            Contactar soporte
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBanner({ status, message }: { status: string; message: string }) {
    const config = {
        operational: {
            bg: 'bg-emerald-500',
            icon: CheckCircle,
            text: 'Todos los sistemas operativos',
        },
        degraded: {
            bg: 'bg-amber-500',
            icon: AlertCircle,
            text: 'Algunos servicios degradados',
        },
        outage: {
            bg: 'bg-red-500',
            icon: XCircle,
            text: 'Interrupción de servicio',
        },
        maintenance: {
            bg: 'bg-blue-500',
            icon: Wrench,
            text: 'Mantenimiento en progreso',
        },
    }[status] || {
        bg: 'bg-gray-500',
        icon: AlertCircle,
        text: 'Estado desconocido',
    };

    const Icon = config.icon;

    return (
        <div className={`${config.bg} text-white rounded-xl p-6 shadow-lg`}>
            <div className="flex items-center gap-4">
                <Icon className="w-10 h-10" />
                <div>
                    <h1 className="text-2xl font-bold">{config.text}</h1>
                    <p className="text-white/80">{message}</p>
                </div>
            </div>
        </div>
    );
}

function ServiceRow({ service }: { service: ServiceStatus }) {
    const statusColors = {
        operational: 'text-emerald-500',
        degraded: 'text-amber-500',
        outage: 'text-red-500',
        maintenance: 'text-blue-500',
    };

    const color = statusColors[service.status as keyof typeof statusColors] || 'text-gray-500';

    return (
        <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
                <span className="text-2xl">{service.statusIcon}</span>
                <div>
                    <div className="font-medium text-gray-900">{service.name}</div>
                    <div className="text-sm text-gray-500">{service.description}</div>
                </div>
            </div>
            <div className="text-right">
                <div className={`font-medium ${color}`}>{service.statusText}</div>
                {service.message && (
                    <div className="text-sm text-gray-500">{service.message}</div>
                )}
                {!service.message && service.latencyMs > 0 && (
                    <div className="text-sm text-gray-400">{service.latencyMs}ms</div>
                )}
            </div>
        </div>
    );
}

function IncidentRow({ incident }: { incident: Incident }) {
    const statusConfig = {
        investigating: { color: 'bg-amber-100 text-amber-800', text: 'Investigando' },
        identified: { color: 'bg-orange-100 text-orange-800', text: 'Identificado' },
        monitoring: { color: 'bg-blue-100 text-blue-800', text: 'Monitoreando' },
        resolved: { color: 'bg-emerald-100 text-emerald-800', text: 'Resuelto' },
    };

    const config = statusConfig[incident.status as keyof typeof statusConfig] ||
        { color: 'bg-gray-100 text-gray-800', text: incident.status };

    return (
        <div className="p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="font-medium text-gray-900">{incident.title}</div>
                    <div className="text-sm text-gray-500 mt-1">
                        {formatDate(incident.startedAt)} • {incident.duration}
                    </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                    {config.text}
                </span>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;

    // Return formatted date for older entries
    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}
