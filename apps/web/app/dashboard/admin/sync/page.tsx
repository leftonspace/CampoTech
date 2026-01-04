'use client';

import { useState } from 'react';
import {
    AlertTriangle,
    RefreshCw,
    Server,
    Smartphone,
    ArrowRight,
    Check,
    Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Mock Conflict Data
interface Conflict {
    id: string;
    entity: string; // 'Job', 'Inventory', 'Note'
    entityId: string;
    technicianName: string;
    timestamp: string;
    serverValue: Record<string, unknown>;
    clientValue: Record<string, unknown>;
    status: 'PENDING' | 'RESOLVED';
}

const MOCK_CONFLICTS: Conflict[] = [
    {
        id: 'CONF-001',
        entity: 'Job',
        entityId: 'JOB-9821',
        technicianName: 'Juan Pérez',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
        serverValue: { status: 'ASSIGNED', notes: 'Cliente confirma horario 15hs' },
        clientValue: { status: 'IN_PROGRESS', notes: 'Llegué al domicilio, cliente no contesta' },
        status: 'PENDING'
    },
    {
        id: 'CONF-002',
        entity: 'Inventory',
        entityId: 'ITEM-552',
        technicianName: 'Carlos Ruiz',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
        serverValue: { quantity: 15 },
        clientValue: { quantity: 12 }, // Technician used 3 offline
        status: 'PENDING'
    }
];

export default function SyncConflictsPage() {
    const [conflicts, setConflicts] = useState<Conflict[]>(MOCK_CONFLICTS);

    const handleResolve = (id: string, _strategy: 'server' | 'client') => {
        // In real app: call API to resolve conflict
        setConflicts(prev => prev.filter(c => c.id !== id));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Conflictos de Sincronización</h1>
                    <p className="text-gray-500">
                        Resolución de diferencias de datos entre dispositivos offline y el servidor
                    </p>
                </div>
                <button
                    onClick={() => setConflicts(MOCK_CONFLICTS)} // Reset for demo
                    className="btn-outline flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" /> Actualizar
                </button>
            </div>

            {conflicts.length === 0 ? (
                <div className="card p-12 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                        <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Todo sincronizado</h3>
                    <p className="text-gray-500 max-w-sm mt-2">
                        No hay conflictos pendientes. Todos los dispositivos están al día con el servidor central.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {conflicts.map(conflict => (
                        <div key={conflict.id} className="card overflow-hidden">
                            {/* Header */}
                            <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                                    <span className="font-medium text-orange-900">Conflicto en {conflict.entity} #{conflict.entityId}</span>
                                    <span className="text-sm text-orange-700 mx-2">•</span>
                                    <span className="text-sm text-orange-700 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDistanceToNow(new Date(conflict.timestamp), { addSuffix: true, locale: es })}
                                    </span>
                                </div>
                                <div className="text-sm text-orange-800 bg-orange-100 px-3 py-1 rounded-full font-medium">
                                    Dispositivo de: {conflict.technicianName}
                                </div>
                            </div>

                            {/* Comparison Grid */}
                            <div className="p-6 grid md:grid-cols-2 gap-8 relative">
                                {/* Server Side */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                                        <Server className="w-4 h-4" />
                                        <span className="text-xs uppercase font-bold tracking-wider">Valor en Servidor (Actual)</span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono text-sm h-full">
                                        <pre>{JSON.stringify(conflict.serverValue, null, 2)}</pre>
                                    </div>
                                    <button
                                        onClick={() => handleResolve(conflict.id, 'server')}
                                        className="w-full btn-outline border-gray-300 hover:bg-gray-50 text-gray-700 flex justify-center items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" /> Mantener Servidor
                                    </button>
                                </div>

                                {/* Arrow */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
                                    <div className="bg-white border rounded-full p-2 shadow-sm text-gray-400">
                                        <ArrowRight className="w-6 h-6" />
                                    </div>
                                </div>

                                {/* Client Side */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                                        <Smartphone className="w-4 h-4" />
                                        <span className="text-xs uppercase font-bold tracking-wider">Valor Entrante (Dispositivo)</span>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 font-mono text-sm h-full text-blue-900">
                                        <pre>{JSON.stringify(conflict.clientValue, null, 2)}</pre>
                                    </div>
                                    <button
                                        onClick={() => handleResolve(conflict.id, 'client')}
                                        className="w-full btn-primary flex justify-center items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" /> Aceptar Cambio del Dispositivo
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
