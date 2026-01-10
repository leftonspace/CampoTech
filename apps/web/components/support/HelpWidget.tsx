'use client';

/**
 * Phase 7.2: Help Widget
 * =======================
 * 
 * Floating help button that appears on all dashboard pages.
 * Provides quick access to:
 * - FAQ
 * - Report an issue
 * - Suggest a feature
 * - Contact support
 * - System status
 */

import { useState } from 'react';
import Link from 'next/link';
import {
    HelpCircle,
    MessageSquare,
    Bug,
    Lightbulb,
    Mail,
    Activity,
    X,
    ChevronRight,
    ExternalLink,
    Bot,
} from 'lucide-react';
import { AIChatWidget } from './AIChatWidget';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function HelpWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [showReportForm, setShowReportForm] = useState(false);
    const [showSuggestionForm, setShowSuggestionForm] = useState(false);
    const [showAIChat, setShowAIChat] = useState(false);

    const handleClose = () => {
        setIsOpen(false);
        setShowReportForm(false);
        setShowSuggestionForm(false);
        setShowAIChat(false);
    };

    return (
        <>
            {/* Floating Help Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white p-4 rounded-full shadow-lg hover:bg-emerald-700 hover:scale-110 transition-all duration-200 group"
                aria-label="Ayuda"
            >
                <HelpCircle className="h-6 w-6" />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ¿Necesitás ayuda?
                </span>
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-lg">¿En qué podemos ayudarte?</h2>
                                        <p className="text-emerald-100 text-sm">Soporte CampoTech</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            {showAIChat ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowAIChat(false)}
                                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <ChevronRight className="w-5 h-5 rotate-180 text-gray-500" />
                                        </button>
                                        <h3 className="font-semibold text-gray-900">Chat con IA</h3>
                                    </div>
                                    <AIChatWidget className="max-h-[450px]" />
                                </div>
                            ) : !showReportForm && !showSuggestionForm ? (
                                <div className="space-y-2">
                                    {/* AI Chat - Featured option */}
                                    <div
                                        onClick={() => setShowAIChat(true)}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 hover:from-emerald-100 hover:to-teal-100 transition-colors cursor-pointer group"
                                    >
                                        <div className="p-2.5 bg-emerald-600 rounded-lg text-white">
                                            <Bot className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900">Chatear con IA</div>
                                            <div className="text-sm text-emerald-600">Respuestas instantáneas</div>
                                        </div>
                                        <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">Nuevo</span>
                                    </div>

                                    <HelpOption
                                        icon={MessageSquare}
                                        title="Ver preguntas frecuentes"
                                        description="Respuestas a las dudas más comunes"
                                        href="/ayuda"
                                        onClick={handleClose}
                                    />
                                    <HelpOption
                                        icon={Bug}
                                        title="Reportar un problema"
                                        description="Algo no funciona como debería"
                                        onClick={() => setShowReportForm(true)}
                                    />
                                    <HelpOption
                                        icon={Lightbulb}
                                        title="Sugerir una mejora"
                                        description="Tenés ideas para mejorar CampoTech"
                                        onClick={() => setShowSuggestionForm(true)}
                                    />
                                    <HelpOption
                                        icon={Mail}
                                        title="Contactar soporte"
                                        description="Escribinos directamente"
                                        href="mailto:soporte@campotech.com.ar"
                                        external
                                    />
                                    <HelpOption
                                        icon={Activity}
                                        title="Ver estado del sistema"
                                        description="Verificá si hay problemas conocidos"
                                        href="/estado"
                                        onClick={handleClose}
                                        external
                                    />
                                </div>
                            ) : showReportForm ? (
                                <ReportIssueForm
                                    onBack={() => setShowReportForm(false)}
                                    onSuccess={handleClose}
                                />
                            ) : (
                                <SuggestionForm
                                    onBack={() => setShowSuggestionForm(false)}
                                    onSuccess={handleClose}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface HelpOptionProps {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    href?: string;
    onClick?: () => void;
    external?: boolean;
}

function HelpOption({ icon: Icon, title, description, href, onClick, external }: HelpOptionProps) {
    const content = (
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{title}</div>
                <div className="text-sm text-gray-500 truncate">{description}</div>
            </div>
            {external ? (
                <ExternalLink className="w-4 h-4 text-gray-400" />
            ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
        </div>
    );

    if (href) {
        if (external && href.startsWith('mailto:')) {
            return (
                <a href={href} onClick={onClick}>
                    {content}
                </a>
            );
        }
        return (
            <Link href={href} onClick={onClick} target={external ? '_blank' : undefined}>
                {content}
            </Link>
        );
    }

    return (
        <button onClick={onClick} className="w-full text-left">
            {content}
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT ISSUE FORM
// ═══════════════════════════════════════════════════════════════════════════════

interface FormProps {
    onBack: () => void;
    onSuccess: () => void;
}

function ReportIssueForm({ onBack, onSuccess }: FormProps) {
    const [description, setDescription] = useState('');
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!description.trim()) {
            setError('Por favor describí el problema');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // Collect context automatically
            const context = {
                userAgent: navigator.userAgent,
                url: window.location.href,
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
                timestamp: new Date().toISOString(),
            };

            // Create form data for file upload
            const formData = new FormData();
            formData.append('type', 'bug');
            formData.append('description', description);
            formData.append('context', JSON.stringify(context));
            if (screenshot) {
                formData.append('screenshot', screenshot);
            }

            const response = await fetch('/api/support/report', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Error al enviar el reporte');
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ChevronRight className="w-5 h-5 rotate-180 text-gray-500" />
                </button>
                <h3 className="font-semibold text-gray-900">Reportar un problema</h3>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Describí el problema
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="¿Qué pasó? ¿Qué esperabas que pase?"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                    disabled={isSubmitting}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Captura de pantalla (opcional)
                </label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    disabled={isSubmitting}
                />
                {screenshot && (
                    <div className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
                        ✓ {screenshot.name}
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                ✅ Automáticamente incluimos tu navegador, URL actual, y resolución de pantalla para resolver el problema más rápido.
            </p>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
            </button>
        </form>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUGGESTION FORM
// ═══════════════════════════════════════════════════════════════════════════════

function SuggestionForm({ onBack, onSuccess }: FormProps) {
    const [suggestion, setSuggestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!suggestion.trim()) {
            setError('Por favor describí tu sugerencia');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const context = {
                url: window.location.href,
                timestamp: new Date().toISOString(),
            };

            const response = await fetch('/api/support/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'suggestion',
                    description: suggestion,
                    context,
                }),
            });

            if (!response.ok) {
                throw new Error('Error al enviar la sugerencia');
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ChevronRight className="w-5 h-5 rotate-180 text-gray-500" />
                </button>
                <h3 className="font-semibold text-gray-900">Sugerir una mejora</h3>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    ¿Qué te gustaría que mejoremos?
                </label>
                <textarea
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    placeholder="Contanos tu idea para mejorar CampoTech..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                    disabled={isSubmitting}
                />
            </div>

            <p className="text-xs text-gray-500 bg-amber-50 p-3 rounded-lg border border-amber-100">
                💡 Leemos todas las sugerencias. Las mejores ideas las implementamos y te avisamos.
            </p>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isSubmitting ? 'Enviando...' : 'Enviar sugerencia'}
            </button>
        </form>
    );
}

export default HelpWidget;
