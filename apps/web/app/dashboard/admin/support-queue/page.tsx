'use client';

/**
 * Admin Support Queue Page
 * ========================
 * 
 * Phase 4: Task 4.3
 * 
 * Dashboard for managing public support conversations:
 * - List all tickets with status filters
 * - View full conversation history
 * - Respond with multi-channel notifications
 * - Close tickets
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
    ArrowLeft,
    MessageCircle,
    Search,
    RefreshCw,
    Send,
    X,
    Clock,
    User,
    Mail,
    Phone,
    Bell,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ChevronRight,
    Bot,
    Shield,
} from 'lucide-react';
import { formatDateTime, formatDate, cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

type SupportStatus = 'open' | 'pending_response' | 'responded' | 'new_reply' | 'closed';

interface SupportMessage {
    id: string;
    role: 'user' | 'assistant' | 'admin';
    content: string;
    createdAt: string;
    respondedBy?: string;
    notifiedVia?: string[];
    readByAdmin?: boolean;
    readByVisitor?: boolean;
}

interface SupportConversation {
    id: string;
    ticketNumber: string;
    visitorName: string;
    visitorEmail: string | null;
    visitorPhone: string | null;
    status: SupportStatus;
    category: string | null;
    aiDisabled: boolean;
    escalatedAt: string | null;
    createdAt: string;
    lastActivityAt: string;
    closedAt: string | null;
    messageCount: number;
    lastMessage: {
        content: string;
        role: string;
        createdAt: string;
        readByAdmin: boolean;
    } | null;
    hasUnread: boolean;
    messages?: SupportMessage[];
}

// =============================================================================
// STATUS HELPERS
// =============================================================================

const STATUS_CONFIG: Record<SupportStatus, { label: string; color: string; icon: React.ElementType }> = {
    open: { label: 'Abierto', color: 'bg-blue-100 text-blue-800', icon: MessageCircle },
    pending_response: { label: 'Esperando respuesta', color: 'bg-amber-100 text-amber-800', icon: Clock },
    responded: { label: 'Respondido', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
    new_reply: { label: 'Nueva respuesta', color: 'bg-red-100 text-red-800', icon: AlertCircle },
    closed: { label: 'Cerrado', color: 'bg-gray-100 text-gray-600', icon: CheckCircle2 },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SupportQueuePage() {
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedConversation, setSelectedConversation] = useState<SupportConversation | null>(null);
    const [responseText, setResponseText] = useState('');
    const [notifyChannels, setNotifyChannels] = useState<string[]>(['email']);

    // Fetch conversations list
    const { data: conversationsData, isLoading, refetch } = useQuery({
        queryKey: ['support-conversations', statusFilter, searchQuery],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (searchQuery) params.set('search', searchQuery);

            const response = await fetch(`/api/support/conversations?${params}`);
            if (!response.ok) throw new Error('Error fetching conversations');
            return response.json();
        },
        refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

    // Fetch single conversation detail
    const { data: conversationDetail, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['support-conversation', selectedConversation?.id],
        queryFn: async () => {
            if (!selectedConversation?.id) return null;
            const response = await fetch(`/api/support/conversations/${selectedConversation.id}`);
            if (!response.ok) throw new Error('Error fetching conversation');
            return response.json();
        },
        enabled: !!selectedConversation?.id,
    });

    // Update selected conversation with full messages when fetched
    useEffect(() => {
        if (conversationDetail?.data) {
            setSelectedConversation(prev => prev ? { ...prev, ...conversationDetail.data } : null);
        }
    }, [conversationDetail]);

    // Send response mutation
    const respondMutation = useMutation({
        mutationFn: async ({ conversationId, message, notifyVia }: { conversationId: string; message: string; notifyVia: string[] }) => {
            const response = await fetch(`/api/support/conversations/${conversationId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, notifyVia }),
            });
            if (!response.ok) throw new Error('Error sending response');
            return response.json();
        },
        onSuccess: () => {
            setResponseText('');
            queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
            queryClient.invalidateQueries({ queryKey: ['support-conversation', selectedConversation?.id] });
        },
    });

    // Close ticket mutation
    const closeMutation = useMutation({
        mutationFn: async (conversationId: string) => {
            const response = await fetch(`/api/support/conversations/${conversationId}/close`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Error closing ticket');
            return response.json();
        },
        onSuccess: () => {
            setSelectedConversation(null);
            queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
        },
    });

    const conversations: SupportConversation[] = conversationsData?.data || [];
    const unreadCount = conversationsData?.unreadCount || 0;

    const handleSendResponse = () => {
        if (!selectedConversation || !responseText.trim()) return;
        respondMutation.mutate({
            conversationId: selectedConversation.id,
            message: responseText.trim(),
            notifyVia: notifyChannels,
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/admin"
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <MessageCircle className="h-6 w-6 text-teal-600" />
                            Cola de Soporte
                            {unreadCount > 0 && (
                                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </h1>
                        <p className="text-gray-500">Gestionar consultas de visitantes públicos</p>
                    </div>
                </div>

                <button
                    onClick={() => refetch()}
                    className="btn-outline"
                    disabled={isLoading}
                >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                    Actualizar
                </button>
            </div>

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
                {/* Conversations List */}
                <div className="lg:col-span-1 bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col">
                    {/* Search & Filters */}
                    <div className="p-4 border-b space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por ticket, nombre, email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {[
                                { value: 'all', label: 'Todos' },
                                { value: 'new_reply', label: '🔴 Nuevos' },
                                { value: 'pending_response', label: 'Pendientes' },
                                { value: 'responded', label: 'Respondidos' },
                                { value: 'closed', label: 'Cerrados' },
                            ].map(filter => (
                                <button
                                    key={filter.value}
                                    onClick={() => setStatusFilter(filter.value)}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                                        statusFilter === filter.value
                                            ? "bg-teal-600 text-white"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    )}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p>No hay conversaciones</p>
                            </div>
                        ) : (
                            conversations.map(conv => {
                                const statusConfig = STATUS_CONFIG[conv.status];
                                const StatusIcon = statusConfig.icon;

                                return (
                                    <button
                                        key={conv.id}
                                        onClick={() => setSelectedConversation(conv)}
                                        className={cn(
                                            "w-full p-4 border-b hover:bg-gray-50 text-left transition-colors",
                                            selectedConversation?.id === conv.id && "bg-teal-50 border-l-4 border-l-teal-600",
                                            conv.status === 'new_reply' && "bg-red-50"
                                        )}
                                    >
                                        <div className="flex items-start justify-between mb-1">
                                            <span className="font-medium text-gray-900">
                                                #{conv.ticketNumber}
                                            </span>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
                                                statusConfig.color
                                            )}>
                                                <StatusIcon className="h-3 w-3" />
                                                {statusConfig.label}
                                            </span>
                                        </div>

                                        <p className="text-sm text-gray-600 mb-1">{conv.visitorName}</p>

                                        {conv.lastMessage && (
                                            <p className="text-xs text-gray-500 truncate">
                                                {conv.lastMessage.role === 'admin' && '👤 '}
                                                {conv.lastMessage.role === 'assistant' && '🤖 '}
                                                {conv.lastMessage.content.substring(0, 50)}...
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                                            <span>{formatDate(conv.lastActivityAt)}</span>
                                            <span>{conv.messageCount} mensajes</span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Conversation Detail */}
                <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col">
                    {!selectedConversation ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <ChevronRight className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p>Seleccioná una conversación para ver los detalles</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                            Ticket #{selectedConversation.ticketNumber}
                                            {selectedConversation.aiDisabled && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Shield className="h-3 w-3" />
                                                    Modo humano
                                                </span>
                                            )}
                                        </h2>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {selectedConversation.visitorName}
                                            </span>
                                            {selectedConversation.visitorEmail && (
                                                <span className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {selectedConversation.visitorEmail}
                                                </span>
                                            )}
                                            {selectedConversation.visitorPhone && (
                                                <span className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {selectedConversation.visitorPhone}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {selectedConversation.status !== 'closed' && (
                                        <button
                                            onClick={() => closeMutation.mutate(selectedConversation.id)}
                                            disabled={closeMutation.isPending}
                                            className="btn-outline text-sm text-red-600 hover:bg-red-50 hover:border-red-200"
                                        >
                                            {closeMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                            ) : (
                                                <X className="h-4 w-4 mr-1" />
                                            )}
                                            Cerrar ticket
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px] bg-gray-50">
                                {isLoadingDetail ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                                    </div>
                                ) : (
                                    selectedConversation.messages?.map((msg) => {
                                        const isUser = msg.role === 'user';
                                        const isAI = msg.role === 'assistant';
                                        const isAdmin = msg.role === 'admin';

                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex gap-2",
                                                    isUser ? "justify-start" : "justify-end"
                                                )}
                                            >
                                                {isUser && (
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                        <User className="h-4 w-4 text-gray-600" />
                                                    </div>
                                                )}

                                                <div className={cn(
                                                    "max-w-[70%] rounded-lg px-4 py-2 text-sm",
                                                    isUser && "bg-gray-200 text-gray-800",
                                                    isAI && "bg-blue-100 text-blue-900 border border-blue-200",
                                                    isAdmin && "bg-teal-600 text-white"
                                                )}>
                                                    {isAI && (
                                                        <span className="text-xs text-blue-600 block mb-1">🤖 Asistente AI</span>
                                                    )}
                                                    {isAdmin && (
                                                        <span className="text-xs text-teal-200 block mb-1">👤 Equipo soporte</span>
                                                    )}
                                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    <p className={cn(
                                                        "text-xs mt-1",
                                                        isUser ? "text-gray-500" : isAdmin ? "text-teal-200" : "text-blue-400"
                                                    )}>
                                                        {formatDateTime(msg.createdAt)}
                                                        {msg.notifiedVia && msg.notifiedVia.length > 0 && (
                                                            <span className="ml-2">• Notificado via {msg.notifiedVia.join(', ')}</span>
                                                        )}
                                                    </p>
                                                </div>

                                                {isAI && (
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                        <Bot className="h-4 w-4 text-blue-600" />
                                                    </div>
                                                )}
                                                {isAdmin && (
                                                    <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                                                        <Shield className="h-4 w-4 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Response Form */}
                            {selectedConversation.status !== 'closed' && (
                                <div className="p-4 border-t bg-white">
                                    <div className="space-y-3">
                                        <textarea
                                            value={responseText}
                                            onChange={(e) => setResponseText(e.target.value)}
                                            placeholder="Escribí tu respuesta..."
                                            rows={3}
                                            className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                                        />

                                        <div className="flex items-center justify-between">
                                            {/* Notification channels */}
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="text-gray-500 flex items-center gap-1">
                                                    <Bell className="h-4 w-4" />
                                                    Notificar via:
                                                </span>
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={notifyChannels.includes('email')}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setNotifyChannels([...notifyChannels, 'email']);
                                                            } else {
                                                                setNotifyChannels(notifyChannels.filter(c => c !== 'email'));
                                                            }
                                                        }}
                                                        className="rounded text-teal-600"
                                                        disabled={!selectedConversation.visitorEmail}
                                                    />
                                                    <Mail className="h-4 w-4 text-gray-400" />
                                                    <span className={!selectedConversation.visitorEmail ? 'text-gray-400' : ''}>
                                                        Email
                                                    </span>
                                                </label>
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={notifyChannels.includes('whatsapp')}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setNotifyChannels([...notifyChannels, 'whatsapp']);
                                                            } else {
                                                                setNotifyChannels(notifyChannels.filter(c => c !== 'whatsapp'));
                                                            }
                                                        }}
                                                        className="rounded text-teal-600"
                                                        disabled={!selectedConversation.visitorPhone}
                                                    />
                                                    <Phone className="h-4 w-4 text-gray-400" />
                                                    <span className={!selectedConversation.visitorPhone ? 'text-gray-400' : ''}>
                                                        WhatsApp
                                                    </span>
                                                </label>
                                            </div>

                                            <button
                                                onClick={handleSendResponse}
                                                disabled={!responseText.trim() || respondMutation.isPending}
                                                className="btn-primary"
                                            >
                                                {respondMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Send className="h-4 w-4 mr-2" />
                                                )}
                                                Enviar respuesta
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
