'use client';

/**
 * WhatsApp Simulation Panel
 * =========================
 * 
 * Phase 3: Test Simulation UI
 * 
 * A modal/panel for injecting fake customer messages to test the AI Copilot.
 * Development only - hidden in production.
 */

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    X,
    Zap,
    Send,
    User,
    Phone,
    Loader2,
    CheckCircle,
    AlertTriangle,
    Bot,
    Sparkles,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerForSimulation {
    id: string;
    name: string;
    phone: string;
    hasActiveConversation: boolean;
    lastJobType?: string;
}

interface SimulationData {
    customers: CustomerForSimulation[];
    organizationId: string;
    aiEnabled: boolean;
    autoResponseEnabled: boolean;
    sampleMessages: string[];
}

interface SimulationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onConversationCreated?: (conversationId: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SimulationPanel({
    isOpen,
    onClose,
    onConversationCreated,
}: SimulationPanelProps) {
    const queryClient = useQueryClient();

    // Form state
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerForSimulation | null>(null);
    const [customPhone, setCustomPhone] = useState('');
    const [customName, setCustomName] = useState('');
    const [message, setMessage] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [recentSimulations, setRecentSimulations] = useState<Array<{
        id: string;
        phone: string;
        name: string;
        message: string;
        success: boolean;
        timestamp: Date;
    }>>([]);

    // Fetch customers and config
    const { data: simData, isLoading } = useQuery<SimulationData>({
        queryKey: ['whatsapp-simulation-data'],
        queryFn: async () => {
            const res = await fetch('/api/dev/whatsapp-simulate');
            if (!res.ok) throw new Error('Failed to fetch simulation data');
            return res.json();
        },
        enabled: isOpen,
        staleTime: 30000, // Cache for 30 seconds
    });

    // Simulation mutation
    const simulateMutation = useMutation({
        mutationFn: async (data: { phone: string; text: string; customerName?: string }) => {
            const res = await fetch('/api/dev/whatsapp-simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Simulation failed');
            }
            return res.json();
        },
        onSuccess: (result) => {
            // Add to recent simulations
            const phone = useCustom ? customPhone : selectedCustomer?.phone || '';
            const name = useCustom ? (customName || 'Custom') : (selectedCustomer?.name || 'Unknown');

            setRecentSimulations(prev => [{
                id: result.data?.messageId || `sim-${Date.now()}`,
                phone,
                name,
                message: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                success: true,
                timestamp: new Date(),
            }, ...prev.slice(0, 4)]);

            // Clear message input
            setMessage('');

            // Invalidate conversations to refresh the list
            queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });

            // Notify parent if conversation was created
            if (result.data?.conversationId && onConversationCreated) {
                onConversationCreated(result.data.conversationId);
            }
        },
        onError: () => {
            const phone = useCustom ? customPhone : selectedCustomer?.phone || '';
            setRecentSimulations(prev => [{
                id: `error-${Date.now()}`,
                phone,
                name: 'Error',
                message: message.substring(0, 30),
                success: false,
                timestamp: new Date(),
            }, ...prev.slice(0, 4)]);
        },
    });

    // Handle send
    const handleSend = useCallback(() => {
        const phone = useCustom ? customPhone : selectedCustomer?.phone;
        if (!phone || !message.trim()) return;

        simulateMutation.mutate({
            phone,
            text: message.trim(),
            customerName: useCustom ? customName : selectedCustomer?.name,
        });
    }, [useCustom, customPhone, customName, selectedCustomer, message, simulateMutation]);

    // Handle sample message click
    const handleSampleClick = useCallback((sample: string) => {
        setMessage(sample);
    }, []);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setMessage('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Don't render in production
    if (process.env.NODE_ENV === 'production') return null;

    const canSend = (useCustom ? customPhone.length > 5 : !!selectedCustomer) && message.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                                <Zap className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">Simulador WhatsApp</h2>
                                <p className="text-xs text-gray-500">Inyectar mensajes de prueba</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* AI Status */}
                    {simData && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                            <Bot className="h-4 w-4 text-gray-400" />
                            <span className={simData.aiEnabled ? 'text-green-600' : 'text-gray-500'}>
                                IA: {simData.aiEnabled ? 'Activa' : 'Desactivada'}
                            </span>
                            {simData.aiEnabled && simData.autoResponseEnabled && (
                                <>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-teal-600 flex items-center gap-1">
                                        <Sparkles className="h-3 w-3" />
                                        Auto-respuesta
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Customer Selection */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                            Simular como cliente
                        </label>

                        {/* Toggle between existing and custom */}
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => setUseCustom(false)}
                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${!useCustom
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Cliente existente
                            </button>
                            <button
                                onClick={() => setUseCustom(true)}
                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${useCustom
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Número nuevo
                            </button>
                        </div>

                        {!useCustom ? (
                            // Existing customer selector
                            <div className="space-y-2">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8 text-gray-400">
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Cargando clientes...
                                    </div>
                                ) : simData?.customers.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>No hay clientes. Usá un número nuevo.</p>
                                    </div>
                                ) : (
                                    <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                                        {simData?.customers.slice(0, 10).map((customer) => (
                                            <button
                                                key={customer.id}
                                                onClick={() => setSelectedCustomer(customer)}
                                                className={`w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-teal-50 border-l-2 border-teal-500' : ''
                                                    }`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    <User className="h-4 w-4 text-gray-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {customer.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {customer.phone}
                                                        {customer.hasActiveConversation && (
                                                            <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-[10px]">
                                                                Chat activo
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Custom phone input
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
                                    <div className="flex items-center border rounded-lg overflow-hidden">
                                        <span className="px-3 py-2 bg-gray-50 text-gray-500 text-sm border-r">
                                            +54
                                        </span>
                                        <input
                                            type="tel"
                                            value={customPhone}
                                            onChange={(e) => setCustomPhone(e.target.value.replace(/\D/g, ''))}
                                            placeholder="1155556666"
                                            className="flex-1 px-3 py-2 text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Nombre (opcional)</label>
                                    <input
                                        type="text"
                                        value={customName}
                                        onChange={(e) => setCustomName(e.target.value)}
                                        placeholder="Juan Pérez"
                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Message Input */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                            Mensaje a simular
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Escribe el mensaje que enviaría el cliente..."
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />

                        {/* Sample messages */}
                        <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1.5">Mensajes de ejemplo:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {simData?.sampleMessages.slice(0, 4).map((sample, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSampleClick(sample)}
                                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                    >
                                        {sample.substring(0, 25)}...
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recent Simulations */}
                    {recentSimulations.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 mb-2">Simulaciones recientes</p>
                            <div className="space-y-2">
                                {recentSimulations.map((sim) => (
                                    <div
                                        key={sim.id}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${sim.success ? 'bg-green-50' : 'bg-red-50'
                                            }`}
                                    >
                                        {sim.success ? (
                                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                        ) : (
                                            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-gray-700 truncate">{sim.message}</p>
                                            <p className="text-xs text-gray-500">
                                                {sim.name} • {sim.phone}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                            Solo desarrollo
                        </span>
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={!canSend || simulateMutation.isPending}
                            className="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {simulateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Simular mensaje
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
