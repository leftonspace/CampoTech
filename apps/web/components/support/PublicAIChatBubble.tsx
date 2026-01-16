'use client';

/**
 * Public AI Chat Bubble
 * =====================
 * 
 * Phase 4 Enhanced: Session persistence + Support Queue integration
 * 
 * Floating AI chat bubble for public pages (landing, pricing, etc.)
 * - Appears in bottom-right corner
 * - Fixed position (follows scroll)
 * - Opens/closes on click
 * - Connects to LangGraph AI support workflow
 * - Persists session in localStorage for 14 days
 * - Shows ticket number after escalation
 * - Displays admin responses
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, User, Sparkles, Loader2, Shield, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY_SESSION = 'campotech_support_session';
const STORAGE_KEY_CREATED = 'campotech_support_created';
const STORAGE_KEY_TICKET = 'campotech_support_ticket';
const SESSION_EXPIRY_DAYS = 14;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'admin';
    content: string;
    timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getStoredSession(): { sessionId: string | null; ticketNumber: string | null; isExpired: boolean } {
    if (typeof window === 'undefined') {
        return { sessionId: null, ticketNumber: null, isExpired: false };
    }

    const sessionId = localStorage.getItem(STORAGE_KEY_SESSION);
    const created = localStorage.getItem(STORAGE_KEY_CREATED);
    const ticketNumber = localStorage.getItem(STORAGE_KEY_TICKET);

    if (!sessionId || !created) {
        return { sessionId: null, ticketNumber: null, isExpired: false };
    }

    // Check if session has expired (14 days)
    const createdDate = new Date(created);
    const now = new Date();
    const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > SESSION_EXPIRY_DAYS) {
        // Clear expired session
        localStorage.removeItem(STORAGE_KEY_SESSION);
        localStorage.removeItem(STORAGE_KEY_CREATED);
        localStorage.removeItem(STORAGE_KEY_TICKET);
        return { sessionId: null, ticketNumber: null, isExpired: true };
    }

    return { sessionId, ticketNumber, isExpired: false };
}

function saveSession(sessionId: string, ticketNumber?: string): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
    localStorage.setItem(STORAGE_KEY_CREATED, new Date().toISOString());
    if (ticketNumber) {
        localStorage.setItem(STORAGE_KEY_TICKET, ticketNumber);
    }
}

function saveTicketNumber(ticketNumber: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_TICKET, ticketNumber);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PublicAIChatBubble() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const [ticketNumber, setTicketNumber] = useState<string | null>(null);
    const [hasUnread, setHasUnread] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasLoadedHistory = useRef(false);

    // Initialize session from localStorage
    useEffect(() => {
        const stored = getStoredSession();
        if (stored.sessionId) {
            setSessionId(stored.sessionId);
            if (stored.ticketNumber) {
                setTicketNumber(stored.ticketNumber);
            }
        } else {
            const newSessionId = generateSessionId();
            setSessionId(newSessionId);
            saveSession(newSessionId);
        }
    }, []);

    // Load conversation history when opening if we have a session
    useEffect(() => {
        if (isOpen && sessionId && !hasLoadedHistory.current) {
            hasLoadedHistory.current = true;
            loadConversationHistory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, sessionId]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Clear unread indicator when opened
    useEffect(() => {
        if (isOpen && hasUnread) {
            setHasUnread(false);
        }
    }, [isOpen, hasUnread]);

    const loadConversationHistory = async () => {
        if (!sessionId) return;

        setIsLoadingHistory(true);
        try {
            // Try to load from our support API
            const response = await fetch(`/api/support/public-chat/history?sessionId=${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.messages && data.messages.length > 0) {
                    const loadedMessages: ChatMessage[] = data.messages.map((msg: { id: string; role: string; content: string; createdAt: string }) => ({
                        id: msg.id,
                        role: msg.role as 'user' | 'assistant' | 'admin',
                        content: msg.content,
                        timestamp: new Date(msg.createdAt),
                    }));
                    setMessages(loadedMessages);

                    if (data.ticketNumber) {
                        setTicketNumber(data.ticketNumber);
                        saveTicketNumber(data.ticketNumber);
                    }

                    // Check for unread admin messages
                    const hasUnreadAdmin = data.hasUnreadAdmin || false;
                    if (hasUnreadAdmin) {
                        setHasUnread(true);
                    }
                    return;
                }
            }
        } catch (error) {
            console.log('[Chat] No history found or error loading:', error);
        } finally {
            setIsLoadingHistory(false);
        }

        // If no history, show welcome message
        if (messages.length === 0) {
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: '¡Hola! 👋 Soy el asistente de CampoTech. ¿En qué puedo ayudarte hoy?\n\nPodés preguntarme sobre:\n• Cómo funciona CampoTech\n• Precios y planes\n• Características\n• Integraciones (AFIP, WhatsApp, etc.)',
                timestamp: new Date(),
            }]);
        }
    };

    const sendMessage = useCallback(async () => {
        const text = inputValue.trim();
        if (!text || isLoading || !sessionId) return;

        // Add user message
        const userMessage: ChatMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Call the AI support API
            const response = await fetch('/api/support/public-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    sessionId,
                    context: 'landing_page',
                    pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();

            // Add AI response
            const aiMessage: ChatMessage = {
                id: `ai_${Date.now()}`,
                role: 'assistant',
                content: data.response || 'Lo siento, hubo un error. Por favor intentá de nuevo.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMessage]);

            // If we got a ticket number, save it
            if (data.ticketNumber) {
                setTicketNumber(data.ticketNumber);
                saveTicketNumber(data.ticketNumber);
            }
        } catch (error) {
            console.error('Chat error:', error);
            // Add error message
            setMessages(prev => [...prev, {
                id: `error_${Date.now()}`,
                role: 'assistant',
                content: 'Lo siento, tuve un problema técnico. ¿Podrías intentar de nuevo? Si el problema persiste, escribinos a soporte@campotech.com.ar',
                timestamp: new Date(),
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [inputValue, isLoading, sessionId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[600px]">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold text-sm">Asistente CampoTech</h3>
                                    <p className="text-white/80 text-xs">
                                        {ticketNumber ? `Ticket #${ticketNumber}` : 'Respuestas instantáneas con IA'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Ticket Banner */}
                        {ticketNumber && (
                            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-sm">
                                <Ticket className="w-4 h-4 text-amber-600" />
                                <span className="text-amber-800">
                                    Ticket <strong>#{ticketNumber}</strong> - Nuestro equipo te responderá pronto
                                </span>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[350px] max-h-[450px] bg-gray-50">
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center h-40">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            'flex gap-2',
                                            message.role === 'user' ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        {(message.role === 'assistant' || message.role === 'admin') && (
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                                message.role === 'admin' ? "bg-teal-600" : "bg-emerald-100"
                                            )}>
                                                {message.role === 'admin' ? (
                                                    <Shield className="w-4 h-4 text-white" />
                                                ) : (
                                                    <Bot className="w-4 h-4 text-emerald-600" />
                                                )}
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                'max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap',
                                                message.role === 'user'
                                                    ? 'bg-emerald-500 text-white rounded-br-md'
                                                    : message.role === 'admin'
                                                        ? 'bg-teal-600 text-white rounded-bl-md shadow-sm'
                                                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                                            )}
                                        >
                                            {message.role === 'admin' && (
                                                <span className="text-xs text-teal-200 block mb-1">👤 Equipo soporte</span>
                                            )}
                                            {message.content}
                                        </div>
                                        {message.role === 'user' && (
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                <User className="w-4 h-4 text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}

                            {/* Loading indicator */}
                            {isLoading && (
                                <div className="flex gap-2 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                                            <span className="text-sm text-gray-500">Pensando...</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-gray-200 bg-white">
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Escribí tu pregunta..."
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all disabled:opacity-50"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!inputValue.trim() || isLoading}
                                    className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 text-center mt-2">
                                Powered by IA • Respuestas 24/7
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110',
                    isOpen
                        ? 'bg-gray-600 hover:bg-gray-700'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                )}
                aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat con IA'}
            >
                {isOpen ? (
                    <X className="w-6 h-6 text-white" />
                ) : (
                    <>
                        <MessageCircle className="w-6 h-6 text-white" />
                        {/* Notification indicator */}
                        {(hasUnread || ticketNumber) && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                {hasUnread ? (
                                    <>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </>
                                ) : (
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                )}
                            </span>
                        )}
                    </>
                )}
            </button>
        </>
    );
}

export default PublicAIChatBubble;

