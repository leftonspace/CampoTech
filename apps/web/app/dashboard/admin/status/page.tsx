'use client';

import { useState } from 'react';
import {
    Activity,
    CheckCircle,
    AlertTriangle,
    XOctagon,
    ShieldAlert,
    RefreshCw,
    Power
} from 'lucide-react';

// System Status Types
type SystemStatus = 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';

interface ServiceHealth {
    id: string;
    name: string;
    status: SystemStatus;
    latency: number;
    lastCheck: string;
}

const MOCK_SERVICES: ServiceHealth[] = [
    { id: 'afip', name: 'AFIP Facturación', status: 'OPERATIONAL', latency: 450, lastCheck: 'Hace 1 min' },
    { id: 'whatsapp', name: 'WhatsApp Business API', status: 'OPERATIONAL', latency: 120, lastCheck: 'Hace 30 seg' },
    { id: 'payment', name: 'Mercado Pago', status: 'DEGRADED', latency: 2500, lastCheck: 'Hace 2 min' }, // Latency spike
    { id: 'maps', name: 'Google Maps / Geocoding', status: 'OPERATIONAL', latency: 80, lastCheck: 'Hace 5 min' },
];

export default function SystemStatusPage() {
    const [services, setServices] = useState<ServiceHealth[]>(MOCK_SERVICES);
    const [panicMode, setPanicMode] = useState(false);
    const [isConfirmingPanic, setIsConfirmingPanic] = useState(false);

    const getStatusColor = (status: SystemStatus) => {
        switch (status) {
            case 'OPERATIONAL': return 'text-green-600 bg-green-50 border-green-200';
            case 'DEGRADED': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'OUTAGE': return 'text-red-600 bg-red-50 border-red-200';
        }
    };

    const getStatusIcon = (status: SystemStatus) => {
        switch (status) {
            case 'OPERATIONAL': return <CheckCircle className="w-5 h-5" />;
            case 'DEGRADED': return <AlertTriangle className="w-5 h-5" />;
            case 'OUTAGE': return <XOctagon className="w-5 h-5" />;
        }
    };

    const handlePanicToggle = () => {
        if (panicMode) {
            // Disabling is instant/safer
            setPanicMode(false);
        } else {
            // Enabling requires confirmation
            setIsConfirmingPanic(true);
        }
    };

    const confirmPanicMode = () => {
        setPanicMode(true);
        setIsConfirmingPanic(false);
        // In real app: API call to trigger Panic Mode State Machine
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Estado del Sistema</h1>
                    <p className="text-gray-500">
                        Monitoreo en tiempo real y controles de emergencia
                    </p>
                </div>
                <button className="btn-outline flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Actualizar
                </button>
            </div>

            {/* Panic Mode Controller */}
            <div className={`card overflow-hidden transition-all border-2 ${panicMode ? 'border-red-500 shadow-red-100' : 'border-transparent'}`}>
                {/* Panic Mode Warning Overlay */}
                {panicMode && (
                    <div className="bg-red-600 text-white p-3 text-center font-bold animate-pulse">
                        ⚠️ PANIC MODE ACTIVADO: LOS SISTEMAS NO ESENCIALES ESTÁN PAUSADOS ⚠️
                    </div>
                )}

                <div className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <ShieldAlert className={`w-6 h-6 ${panicMode ? 'text-red-600' : 'text-gray-400'}`} />
                                Controles de Emergencia (Panic Mode)
                            </h2>
                            <p className="text-gray-500 mt-1 max-w-2xl">
                                Activar el Modo Pánico detendrá inmediatamente procesos no críticos (notificaciones push, sincronización de fondo, reportes)
                                para preservar la integridad del sistema principal durante fallas masivas.
                            </p>
                        </div>

                        <button
                            onClick={handlePanicToggle}
                            className={`flex items-center gap-3 px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 active:scale-95 ${panicMode
                                    ? 'bg-gray-800 text-white hover:bg-gray-900'
                                    : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200'
                                }`}
                        >
                            <Power className="w-5 h-5" />
                            {panicMode ? 'DESACTIVAR EMERGENCIA' : 'ACTIVAR EMERGENCIA'}
                        </button>
                    </div>

                    {/* Panic Features Status */}
                    <div className="mt-8 grid sm:grid-cols-3 gap-4">
                        <div className={`p-4 rounded-lg border flex items-center justify-between ${panicMode ? 'bg-red-50 border-red-100 opacity-50' : 'bg-white'}`}>
                            <span className="font-medium text-gray-700">Notificaciones Masivas</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${panicMode ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {panicMode ? 'PAUSADO' : 'ACTIVO'}
                            </span>
                        </div>
                        <div className={`p-4 rounded-lg border flex items-center justify-between ${panicMode ? 'bg-red-50 border-red-100 opacity-50' : 'bg-white'}`}>
                            <span className="font-medium text-gray-700">Sync Inventory Histórico</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${panicMode ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {panicMode ? 'PAUSADO' : 'ACTIVO'}
                            </span>
                        </div>
                        <div className={`p-4 rounded-lg border flex items-center justify-between bg-green-50 border-green-100`}>
                            <span className="font-medium text-gray-700">Gestión de Trabajos (Core)</span>
                            <span className="text-xs font-bold px-2 py-1 rounded bg-green-200 text-green-800">
                                PROTEGIDO
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {isConfirmingPanic && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">¿Activar Panic Mode?</h3>
                        <p className="text-center text-gray-500 mb-6">
                            Esta acción degradará la experiencia de usuario para proteger la integridad de los datos.
                            Solo usar en caso de falla crítica de infraestructura o ataque.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsConfirmingPanic(false)}
                                className="flex-1 btn-outline"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmPanicMode}
                                className="flex-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                            >
                                SÍ, ACTIVAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* System Health Grid */}
            <h2 className="text-lg font-semibold text-gray-900 mt-8">Estado de Servicios Integrados</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {services.map(service => (
                    <div key={service.id} className="card p-4">
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-2 rounded-lg ${getStatusColor(service.status).split(' ')[1]}`}>
                                <Activity className={`w-5 h-5 ${getStatusColor(service.status).split(' ')[0]}`} />
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(service.status)}`}>
                                {service.status}
                            </div>
                        </div>
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Latencia</span>
                                <span className={`font-mono ${service.latency > 1000 ? 'text-red-600' : 'text-gray-700'}`}>
                                    {service.latency}ms
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Último check</span>
                                <span className="text-gray-700">{service.lastCheck}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
