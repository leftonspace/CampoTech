'use client';

/**
 * Voice Invoice Review Component
 * ===============================
 * 
 * Phase 6: Voice-to-Invoice AI
 * 
 * This component allows technicians to:
 * 1. Record/transcribe voice memos
 * 2. Review AI-extracted line items
 * 3. Approve, edit, or reject items
 * 4. Apply approved items to the job
 */

import { useState } from 'react';
import {
    Mic,
    FileText,
    Check,
    AlertTriangle,
    Loader2,
    ChevronDown,
    ChevronUp,
    Package,
    Wrench,
    RefreshCw,
    CheckCircle,
    Info,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface LineItem {
    id?: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    total: number | null;
    sourceType: 'part' | 'service' | 'custom';
    sourceText: string;
    matchedPriceItemId: string | null;
    matchedPriceItemName: string | null;
    matchConfidence: number;
    alternativeMatches: Array<{ id: string; name: string; price: number }>;
    needsReview: boolean;
    reviewReason: string | null;
    approved?: boolean;
    edited?: boolean;
}

interface InvoiceSuggestion {
    jobId: string;
    lineItems: LineItem[];
    subtotal: number;
    taxAmount: number;
    total: number;
    extraction: {
        jobSummary: string | null;
        workPerformed: string | null;
        equipmentStatus: string | null;
        followUpRequired: boolean;
        recommendations: string | null;
    };
    transcription: string;
    processingTimeMs: number;
    requiresReview: boolean;
    reviewNotes: string[];
    overallMatchConfidence: number;
}

interface VoiceInvoiceReviewProps {
    jobId: string;
    onComplete?: (result: { lineItemCount: number; total: number }) => void;
    onCancel?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function VoiceInvoiceReview({
    jobId,
    onComplete,
    onCancel
}: VoiceInvoiceReviewProps) {
    // State
    const [step, setStep] = useState<'input' | 'processing' | 'review' | 'applying' | 'success'>('input');
    const [transcription, setTranscription] = useState('');
    const [suggestion, setSuggestion] = useState<InvoiceSuggestion | null>(null);
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

    // Extract invoice data from transcription
    const handleExtract = async () => {
        if (!transcription.trim()) {
            setError('Ingresá el texto del reporte de voz');
            return;
        }

        setError(null);
        setStep('processing');

        try {
            const response = await fetch(`/api/jobs/${jobId}/voice-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcription }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al extraer datos');
            }

            setSuggestion(data.suggestion);
            setLineItems(data.suggestion.lineItems.map((item: LineItem, idx: number) => ({
                ...item,
                id: `item-${idx}`,
                approved: !item.needsReview,
                edited: false,
            })));
            setStep('review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
            setStep('input');
        }
    };

    // Apply approved line items to job
    const handleApply = async () => {
        const approvedItems = lineItems.filter(item => item.approved && item.unitPrice !== null);

        if (approvedItems.length === 0) {
            setError('Aprobá al menos un item con precio para continuar');
            return;
        }

        setStep('applying');

        try {
            const response = await fetch(`/api/jobs/${jobId}/voice-invoice/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lineItems: approvedItems.map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        unit: item.unit,
                        unitPrice: item.unitPrice,
                        priceItemId: item.matchedPriceItemId,
                        sourceType: item.sourceType,
                        taxRate: 21.0,
                    })),
                    jobSummary: suggestion?.extraction.jobSummary,
                    workPerformed: suggestion?.extraction.workPerformed,
                    equipmentStatus: suggestion?.extraction.equipmentStatus,
                    followUpRequired: suggestion?.extraction.followUpRequired,
                    transcription,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al aplicar items');
            }

            setStep('success');
            onComplete?.({
                lineItemCount: data.lineItemCount,
                total: data.totals.total,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al aplicar');
            setStep('review');
        }
    };

    // Update a line item
    const updateLineItem = (index: number, updates: Partial<LineItem>) => {
        setLineItems(prev => prev.map((item, i) =>
            i === index ? { ...item, ...updates, edited: true } : item
        ));
    };

    // Toggle item approval
    const toggleApproval = (index: number) => {
        updateLineItem(index, { approved: !lineItems[index].approved });
    };

    // Select alternative match
    const selectAlternative = (itemIndex: number, alt: { id: string; name: string; price: number }) => {
        updateLineItem(itemIndex, {
            matchedPriceItemId: alt.id,
            matchedPriceItemName: alt.name,
            description: alt.name,
            unitPrice: alt.price,
            total: alt.price * lineItems[itemIndex].quantity,
            needsReview: false,
            approved: true,
        });
    };

    // Calculate totals
    const approvedItems = lineItems.filter(item => item.approved);
    const calculatedSubtotal = approvedItems.reduce(
        (sum, item) => sum + (item.total || 0),
        0
    );
    const calculatedTax = calculatedSubtotal * 0.21;
    const calculatedTotal = calculatedSubtotal + calculatedTax;

    // Toggle item expansion
    const toggleExpand = (index: number) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    // ==========================================================================
    // RENDER - INPUT STEP
    // ==========================================================================

    if (step === 'input') {
        return (
            <div className="p-6 bg-white rounded-xl border space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-100 rounded-lg">
                        <Mic className="h-6 w-6 text-teal-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Reporte de Voz a Factura</h3>
                        <p className="text-sm text-gray-500">Extrae partes y servicios automáticamente</p>
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transcripción del Reporte de Voz
                    </label>
                    <textarea
                        value={transcription}
                        onChange={(e) => setTranscription(e.target.value)}
                        className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                        placeholder="Pegá aquí la transcripción del reporte de voz del técnico...&#10;&#10;Ejemplo: &quot;Bueno, terminé el trabajo. Cambié el filtro, usé dos caños de cobre de medio metro, medio kilo de soldadura, y estuve dos horas. El equipo quedó funcionando perfecto.&quot;"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Tip: Mencioná partes, cantidades, tiempo trabajado y estado final del equipo
                    </p>
                </div>

                <div className="flex gap-3">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        onClick={handleExtract}
                        disabled={!transcription.trim()}
                        className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <FileText className="h-4 w-4" />
                        Extraer Items de Factura
                    </button>
                </div>
            </div>
        );
    }

    // ==========================================================================
    // RENDER - PROCESSING STEP
    // ==========================================================================

    if (step === 'processing') {
        return (
            <div className="p-8 bg-white rounded-xl border text-center">
                <Loader2 className="h-12 w-12 text-teal-600 animate-spin mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Analizando Reporte</h3>
                <p className="text-sm text-gray-500">
                    Extrayendo partes, servicios y costos...
                </p>
            </div>
        );
    }

    // ==========================================================================
    // RENDER - APPLYING STEP
    // ==========================================================================

    if (step === 'applying') {
        return (
            <div className="p-8 bg-white rounded-xl border text-center">
                <Loader2 className="h-12 w-12 text-teal-600 animate-spin mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Aplicando Items</h3>
                <p className="text-sm text-gray-500">
                    Guardando {approvedItems.length} items en el trabajo...
                </p>
            </div>
        );
    }

    // ==========================================================================
    // RENDER - SUCCESS STEP
    // ==========================================================================

    if (step === 'success') {
        return (
            <div className="p-8 bg-white rounded-xl border text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">¡Items Aplicados!</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Se agregaron {approvedItems.length} items al trabajo por ${calculatedTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <button
                    onClick={onCancel}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                    Cerrar
                </button>
            </div>
        );
    }

    // ==========================================================================
    // RENDER - REVIEW STEP
    // ==========================================================================

    return (
        <div className="bg-white rounded-xl border overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <div>
                            <h3 className="font-semibold text-gray-900">Revisar Items Extraídos</h3>
                            <p className="text-sm text-gray-500">
                                {lineItems.length} items • {approvedItems.length} aprobados
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className={`px-2 py-1 rounded-full ${(suggestion?.overallMatchConfidence || 0) > 0.7
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                            }`}>
                            {Math.round((suggestion?.overallMatchConfidence || 0) * 100)}% confianza
                        </span>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Summary from extraction */}
            {suggestion?.extraction.jobSummary && (
                <div className="px-6 py-3 bg-gray-50 border-b">
                    <p className="text-sm text-gray-600">
                        <span className="font-medium">Resumen:</span> {suggestion.extraction.jobSummary}
                    </p>
                </div>
            )}

            {/* Review Notes */}
            {suggestion?.reviewNotes && suggestion.reviewNotes.length > 0 && (
                <div className="px-6 py-3 bg-amber-50 border-b">
                    <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm text-amber-700">
                            <p className="font-medium">Notas de revisión:</p>
                            <ul className="list-disc list-inside mt-1">
                                {suggestion.reviewNotes.map((note, i) => (
                                    <li key={i}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Line Items */}
            <div className="divide-y">
                {lineItems.map((item, index) => (
                    <div
                        key={item.id || index}
                        className={`px-6 py-4 ${item.needsReview ? 'bg-amber-50/50' : ''} ${item.approved ? '' : 'opacity-60'}`}
                    >
                        <div className="flex items-start gap-4">
                            {/* Approval checkbox */}
                            <button
                                onClick={() => toggleApproval(index)}
                                className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${item.approved
                                    ? 'bg-teal-500 border-teal-500 text-white'
                                    : 'border-gray-300 hover:border-teal-400'
                                    }`}
                            >
                                {item.approved && <Check className="h-4 w-4" />}
                            </button>

                            {/* Item details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {item.sourceType === 'part' && (
                                                <Package className="h-4 w-4 text-blue-500" />
                                            )}
                                            {item.sourceType === 'service' && (
                                                <Wrench className="h-4 w-4 text-green-500" />
                                            )}
                                            <span className="font-medium text-gray-900">
                                                {item.description}
                                            </span>
                                            {item.needsReview && (
                                                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                                                    Revisar
                                                </span>
                                            )}
                                            {item.edited && (
                                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                                    Editado
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {item.quantity} {item.unit} × ${item.unitPrice?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '---'}
                                        </p>
                                        {item.reviewReason && (
                                            <p className="text-xs text-amber-600 mt-1">
                                                ⚠️ {item.reviewReason}
                                            </p>
                                        )}
                                    </div>

                                    {/* Price */}
                                    <div className="text-right">
                                        {item.total !== null ? (
                                            <span className="font-semibold text-gray-900">
                                                ${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                        ) : (
                                            <span className="text-amber-600 font-medium">Sin precio</span>
                                        )}
                                    </div>
                                </div>

                                {/* Expand/collapse for alternatives */}
                                {item.alternativeMatches.length > 0 && (
                                    <button
                                        onClick={() => toggleExpand(index)}
                                        className="mt-2 text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
                                    >
                                        {expandedItems.has(index) ? (
                                            <><ChevronUp className="h-4 w-4" /> Ocultar alternativas</>
                                        ) : (
                                            <><ChevronDown className="h-4 w-4" /> Ver {item.alternativeMatches.length} alternativas</>
                                        )}
                                    </button>
                                )}

                                {/* Alternative matches */}
                                {expandedItems.has(index) && item.alternativeMatches.length > 0 && (
                                    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                                        <p className="text-xs font-medium text-gray-500">Alternativas del catálogo:</p>
                                        {item.alternativeMatches.map((alt, altIndex) => (
                                            <button
                                                key={altIndex}
                                                onClick={() => selectAlternative(index, alt)}
                                                className="w-full text-left p-2 bg-white border rounded hover:border-teal-400 flex items-center justify-between gap-2"
                                            >
                                                <span className="text-sm">{alt.name}</span>
                                                <span className="text-sm font-medium text-teal-600">
                                                    ${alt.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Manual price input for items without price */}
                                {item.unitPrice === null && item.approved && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <label className="text-sm text-gray-600">Precio unitario:</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="w-32 pl-7 pr-3 py-1 border rounded text-sm"
                                                placeholder="0.00"
                                                onChange={(e) => {
                                                    const price = parseFloat(e.target.value) || 0;
                                                    updateLineItem(index, {
                                                        unitPrice: price,
                                                        total: price * item.quantity,
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Totals */}
            <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                        <p>Subtotal: ${calculatedSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                        <p>IVA (21%): ${calculatedTax.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Total Estimado</p>
                        <p className="text-2xl font-bold text-teal-600">
                            ${calculatedTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-white border-t flex justify-between gap-4">
                <button
                    onClick={() => {
                        setStep('input');
                        setSuggestion(null);
                        setLineItems([]);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    Volver a Extraer
                </button>

                <div className="flex gap-3">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        onClick={handleApply}
                        disabled={approvedItems.length === 0 || approvedItems.some(i => i.unitPrice === null)}
                        className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Check className="h-4 w-4" />
                        Aplicar {approvedItems.length} Items
                    </button>
                </div>
            </div>
        </div>
    );
}
