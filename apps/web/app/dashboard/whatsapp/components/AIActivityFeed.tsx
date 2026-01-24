'use client';

/**
 * AI Activity Feed Component
 * ==========================
 * 
 * Phase 2: Real-time activity cards showing AI actions and suggestions.
 * Replaces the chat-based interface with actionable cards.
 */

import {
    useState
} from 'react';
import {
    CheckCircle,
    UserPlus,
    AlertTriangle,
    Mic,
    MessageSquare,
    Calendar,
    Clock,
    ExternalLink,
    ChevronRight,
    Sparkles,
    Copy,
    Check,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ActivityType =
    | 'job_created'
    | 'customer_created'
    | 'conflict_detected'
    | 'audio_transcribed'
    | 'response_suggested'
    | 'availability_checked'
    | 'ai_response_sent';

export interface ActivityItem {
    id: string;
    type: ActivityType;
    timestamp: Date;
    title: string;
    description: string;
    metadata?: {
        jobId?: string;
        jobNumber?: string;
        customerId?: string;
        customerName?: string;
        conflictDate?: string;
        conflictDetails?: string;
        transcription?: string;
        suggestedResponse?: string;
        availableSlots?: string[];
        confidence?: number;
    };
    actions?: ActivityAction[];
}

export interface ActivityAction {
    id: string;
    label: string;
    variant: 'primary' | 'secondary' | 'ghost';
    onClick: () => void;
}

interface AIActivityFeedProps {
    activities: ActivityItem[];
    onUseResponse?: (response: string) => void;
    onViewJob?: (jobId: string) => void;
    onViewCustomer?: (customerId: string) => void;
    onViewCalendar?: (date?: string) => void;
    isLoading?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY CARD CONFIGS
// ═══════════════════════════════════════════════════════════════════════════════

const ACTIVITY_CONFIG: Record<ActivityType, {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    borderColor: string;
}> = {
    job_created: {
        icon: CheckCircle,
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        borderColor: 'border-l-green-500',
    },
    customer_created: {
        icon: UserPlus,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        borderColor: 'border-l-blue-500',
    },
    conflict_detected: {
        icon: AlertTriangle,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        borderColor: 'border-l-amber-500',
    },
    audio_transcribed: {
        icon: Mic,
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        borderColor: 'border-l-purple-500',
    },
    response_suggested: {
        icon: MessageSquare,
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600',
        borderColor: 'border-l-teal-500',
    },
    availability_checked: {
        icon: Calendar,
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        borderColor: 'border-l-indigo-500',
    },
    ai_response_sent: {
        icon: Sparkles,
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600',
        borderColor: 'border-l-gray-400',
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIActivityFeed({
    activities,
    onUseResponse,
    onViewJob,
    onViewCustomer,
    onViewCalendar,
    isLoading = false,
}: AIActivityFeedProps) {
    if (activities.length === 0 && !isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Sparkles className="h-6 w-6 text-gray-400" />
                </div>
                <p className="font-medium text-gray-900 mb-1">Sin actividad todavía</p>
                <p className="text-sm text-gray-500">
                    Las acciones de la IA aparecerán aquí mientras monitorea la conversación
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Loading state */}
            {isLoading && (
                <div className="px-4 py-3 bg-teal-50 border-b flex items-center gap-2">
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                    <span className="text-sm text-teal-700">Analizando conversación...</span>
                </div>
            )}

            {/* Activity list */}
            <div className="divide-y divide-gray-100">
                {activities.map((activity) => (
                    <ActivityCard
                        key={activity.id}
                        activity={activity}
                        onUseResponse={onUseResponse}
                        onViewJob={onViewJob}
                        onViewCustomer={onViewCustomer}
                        onViewCalendar={onViewCalendar}
                    />
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface ActivityCardProps {
    activity: ActivityItem;
    onUseResponse?: (response: string) => void;
    onViewJob?: (jobId: string) => void;
    onViewCustomer?: (customerId: string) => void;
    onViewCalendar?: (date?: string) => void;
}

function ActivityCard({
    activity,
    onUseResponse,
    onViewJob,
    onViewCustomer,
    onViewCalendar,
}: ActivityCardProps) {
    const [copied, setCopied] = useState(false);
    const config = ACTIVITY_CONFIG[activity.type];
    const Icon = config.icon;

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `Hace ${minutes}m`;

        return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`p-4 border-l-4 ${config.borderColor} hover:bg-gray-50 transition-colors`}>
            {/* Header */}
            <div className="flex items-start gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${config.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-gray-900 text-sm truncate">{activity.title}</h4>
                        <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                            <Clock className="h-3 w-3" />
                            {formatTime(activity.timestamp)}
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                </div>
            </div>

            {/* Type-specific content */}
            {activity.type === 'response_suggested' && activity.metadata?.suggestedResponse && (
                <div className="ml-11 mt-2">
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-sm text-gray-700 line-clamp-3">
                            &quot;{activity.metadata.suggestedResponse}&quot;
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                onClick={() => onUseResponse?.(activity.metadata!.suggestedResponse!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                            >
                                <Check className="h-3.5 w-3.5" />
                                Usar respuesta
                            </button>
                            <button
                                onClick={() => handleCopy(activity.metadata!.suggestedResponse!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activity.type === 'audio_transcribed' && activity.metadata?.transcription && (
                <div className="ml-11 mt-2">
                    <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                        <p className="text-sm text-gray-700 italic">
                            &quot;{activity.metadata.transcription}&quot;
                        </p>
                    </div>
                </div>
            )}

            {activity.type === 'conflict_detected' && activity.metadata?.conflictDetails && (
                <div className="ml-11 mt-2">
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                        <p className="text-sm text-amber-800">{activity.metadata.conflictDetails}</p>
                        {onViewCalendar && (
                            <button
                                onClick={() => onViewCalendar(activity.metadata?.conflictDate)}
                                className="flex items-center gap-1 mt-2 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
                            >
                                <Calendar className="h-3.5 w-3.5" />
                                Ver agenda
                                <ChevronRight className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {activity.type === 'availability_checked' && activity.metadata?.availableSlots && (
                <div className="ml-11 mt-2">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                        <p className="text-xs font-medium text-indigo-700 mb-2">Horarios disponibles:</p>
                        <div className="flex flex-wrap gap-2">
                            {activity.metadata.availableSlots.slice(0, 4).map((slot, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-1 text-xs bg-white border border-indigo-200 rounded text-indigo-700"
                                >
                                    {slot}
                                </span>
                            ))}
                            {activity.metadata.availableSlots.length > 4 && (
                                <span className="px-2 py-1 text-xs text-indigo-500">
                                    +{activity.metadata.availableSlots.length - 4} más
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Action links */}
            {(activity.type === 'job_created' || activity.type === 'customer_created') && (
                <div className="ml-11 mt-2 flex items-center gap-3">
                    {activity.type === 'job_created' && activity.metadata?.jobId && onViewJob && (
                        <button
                            onClick={() => onViewJob(activity.metadata!.jobId!)}
                            className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver turno #{activity.metadata.jobNumber}
                        </button>
                    )}
                    {activity.type === 'customer_created' && activity.metadata?.customerId && onViewCustomer && (
                        <button
                            onClick={() => onViewCustomer(activity.metadata!.customerId!)}
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver ficha de {activity.metadata.customerName}
                        </button>
                    )}
                </div>
            )}

            {/* Confidence indicator for AI responses */}
            {activity.metadata?.confidence && (
                <div className="ml-11 mt-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${activity.metadata.confidence >= 80 ? 'bg-green-500' :
                                    activity.metadata.confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${activity.metadata.confidence}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-500">{activity.metadata.confidence}% confianza</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA GENERATOR (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateDemoActivities(): ActivityItem[] {
    const now = new Date();

    return [
        {
            id: '1',
            type: 'response_suggested',
            timestamp: new Date(now.getTime() - 30000), // 30 seconds ago
            title: 'Respuesta Sugerida',
            description: 'La IA generó una respuesta basada en la consulta del cliente',
            metadata: {
                suggestedResponse: 'Hola! Sí, tenemos disponibilidad para el lunes a las 14hs. El costo de la instalación del split es de $45.000 e incluye mano de obra y materiales básicos. ¿Te confirmo el turno?',
                confidence: 92,
            },
        },
        {
            id: '2',
            type: 'job_created',
            timestamp: new Date(now.getTime() - 120000), // 2 minutes ago
            title: 'Turno Creado',
            description: 'Instalación de aire acondicionado - Lunes 15:00',
            metadata: {
                jobId: 'job_abc123',
                jobNumber: '2024-0156',
            },
        },
        {
            id: '3',
            type: 'audio_transcribed',
            timestamp: new Date(now.getTime() - 180000), // 3 minutes ago
            title: 'Audio Transcripto',
            description: 'Se transcribió un mensaje de voz del cliente',
            metadata: {
                transcription: 'Hola, quería consultar si tienen disponibilidad para instalar un aire acondicionado split esta semana. Soy de Palermo.',
            },
        },
        {
            id: '4',
            type: 'conflict_detected',
            timestamp: new Date(now.getTime() - 300000), // 5 minutes ago
            title: 'Conflicto Detectado',
            description: 'Se detectó un posible conflicto de agenda',
            metadata: {
                conflictDate: '2024-01-22',
                conflictDetails: 'El técnico Juan ya tiene 2 trabajos programados el lunes 22/01 a las 14hs. Considerar asignar a otro técnico.',
            },
        },
        {
            id: '5',
            type: 'customer_created',
            timestamp: new Date(now.getTime() - 600000), // 10 minutes ago
            title: 'Cliente Creado',
            description: 'Se agregó un nuevo cliente a la base de datos',
            metadata: {
                customerId: 'cust_xyz789',
                customerName: 'María García',
            },
        },
        {
            id: '6',
            type: 'availability_checked',
            timestamp: new Date(now.getTime() - 900000), // 15 minutes ago
            title: 'Disponibilidad Consultada',
            description: 'Se verificó la agenda para esta semana',
            metadata: {
                availableSlots: [
                    'Lun 22/01 - 09:00',
                    'Lun 22/01 - 14:00',
                    'Mar 23/01 - 10:00',
                    'Mar 23/01 - 15:00',
                    'Mié 24/01 - 09:00',
                    'Mié 24/01 - 11:00',
                ],
            },
        },
    ];
}
