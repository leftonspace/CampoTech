'use client';

/**
 * WhatsApp Message Templates Page
 * ================================
 * 
 * Allows organizations to customize WhatsApp message templates.
 * Templates include job confirmations, reminders, tech en camino, etc.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    MessageCircle,
    Save,
    RotateCcw,
    Eye,
    CheckCircle,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Info,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MessageTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    defaultTemplate: string;
    variables: Variable[];
    category: 'job' | 'quote' | 'notification' | 'reminder';
}

interface Variable {
    name: string;
    description: string;
    example: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TEMPLATES: MessageTemplate[] = [
    {
        id: 'job_confirmation',
        name: 'Confirmación de Trabajo',
        description: 'Se envía al confirmar un trabajo con el cliente',
        category: 'job',
        defaultTemplate: `¡Hola {{customerName}}! 👋

Tu servicio de {{serviceType}} ha sido confirmado.

📅 Fecha: {{scheduledDate}}
⏰ Horario: {{scheduledTime}}
📍 Dirección: {{address}}
🔧 Técnico: {{technicianName}}

Número de orden: {{jobNumber}}

Si necesitas modificar o cancelar, responde a este mensaje.

{{businessName}}`,
        template: '',
        variables: [
            { name: 'customerName', description: 'Nombre del cliente', example: 'María García' },
            { name: 'serviceType', description: 'Tipo de servicio', example: 'Plomería' },
            { name: 'scheduledDate', description: 'Fecha programada', example: '25 de Enero' },
            { name: 'scheduledTime', description: 'Hora programada', example: '10:00 - 12:00' },
            { name: 'address', description: 'Dirección del trabajo', example: 'Av. Corrientes 1234' },
            { name: 'technicianName', description: 'Nombre del técnico', example: 'Juan Pérez' },
            { name: 'jobNumber', description: 'Número de orden', example: 'TR-2026-0042' },
            { name: 'businessName', description: 'Nombre del negocio', example: 'Servicios Express' },
        ],
    },
    {
        id: 'tech_on_way',
        name: 'Técnico en Camino',
        description: 'Se envía cuando el técnico sale hacia el domicilio',
        category: 'notification',
        defaultTemplate: `¡Hola {{customerName}}! 🚗

Tu técnico {{technicianName}} está en camino.

⏱️ Tiempo estimado: {{eta}} minutos
🔧 Servicio: {{serviceType}}

Puede rastrearlo en tiempo real aquí:
{{trackingLink}}

{{businessName}}`,
        template: '',
        variables: [
            { name: 'customerName', description: 'Nombre del cliente', example: 'María García' },
            { name: 'technicianName', description: 'Nombre del técnico', example: 'Juan Pérez' },
            { name: 'eta', description: 'Tiempo estimado en minutos', example: '15' },
            { name: 'serviceType', description: 'Tipo de servicio', example: 'Plomería' },
            { name: 'trackingLink', description: 'Link de rastreo', example: 'https://...' },
            { name: 'businessName', description: 'Nombre del negocio', example: 'Servicios Express' },
        ],
    },
    {
        id: 'job_completed',
        name: 'Trabajo Completado',
        description: 'Se envía cuando finaliza el trabajo',
        category: 'job',
        defaultTemplate: `¡Hola {{customerName}}! ✅

El trabajo ha sido completado.

🔧 Servicio: {{serviceType}}
👨‍🔧 Técnico: {{technicianName}}
📋 Orden: {{jobNumber}}

💰 Total: {{totalAmount}}

{{#if invoiceLink}}
📄 Ver factura: {{invoiceLink}}
{{/if}}

¿Todo en orden? Nos encantaría recibir tu feedback.

{{businessName}}`,
        template: '',
        variables: [
            { name: 'customerName', description: 'Nombre del cliente', example: 'María García' },
            { name: 'serviceType', description: 'Tipo de servicio', example: 'Plomería' },
            { name: 'technicianName', description: 'Nombre del técnico', example: 'Juan Pérez' },
            { name: 'jobNumber', description: 'Número de orden', example: 'TR-2026-0042' },
            { name: 'totalAmount', description: 'Monto total', example: '$15.500' },
            { name: 'invoiceLink', description: 'Link a la factura', example: 'https://...' },
            { name: 'businessName', description: 'Nombre del negocio', example: 'Servicios Express' },
        ],
    },
    {
        id: 'quote_sent',
        name: 'Presupuesto',
        description: 'Se envía con el detalle del presupuesto',
        category: 'quote',
        defaultTemplate: `¡Hola {{customerName}}! 📋

Aquí está tu presupuesto para {{serviceType}}:

{{#each lineItems}}
• {{description}}: {{total}}
{{/each}}

💰 Total: {{totalAmount}}
📅 Válido hasta: {{validUntil}}

Para aceptar, responde "ACEPTO" o llámanos al {{phoneNumber}}.

{{businessName}}`,
        template: '',
        variables: [
            { name: 'customerName', description: 'Nombre del cliente', example: 'María García' },
            { name: 'serviceType', description: 'Tipo de servicio', example: 'Instalación de grifo' },
            { name: 'lineItems', description: 'Desglose de items', example: '[items...]' },
            { name: 'totalAmount', description: 'Monto total', example: '$12.000' },
            { name: 'validUntil', description: 'Fecha de validez', example: '1 de Febrero, 2026' },
            { name: 'phoneNumber', description: 'Teléfono de contacto', example: '11-4567-8900' },
            { name: 'businessName', description: 'Nombre del negocio', example: 'Servicios Express' },
        ],
    },
    {
        id: 'job_reminder',
        name: 'Recordatorio de Trabajo',
        description: 'Se envía el día anterior al trabajo programado',
        category: 'reminder',
        defaultTemplate: `¡Hola {{customerName}}! 📆

Te recordamos que mañana tenés programado:

🔧 Servicio: {{serviceType}}
📅 Fecha: {{scheduledDate}}
⏰ Horario: {{scheduledTime}}
📍 Dirección: {{address}}

Si necesitas reprogramar, responde a este mensaje.

¡Hasta mañana!
{{businessName}}`,
        template: '',
        variables: [
            { name: 'customerName', description: 'Nombre del cliente', example: 'María García' },
            { name: 'serviceType', description: 'Tipo de servicio', example: 'Plomería' },
            { name: 'scheduledDate', description: 'Fecha programada', example: 'Mañana, 26 de Enero' },
            { name: 'scheduledTime', description: 'Hora programada', example: '10:00 - 12:00' },
            { name: 'address', description: 'Dirección del trabajo', example: 'Av. Corrientes 1234' },
            { name: 'businessName', description: 'Nombre del negocio', example: 'Servicios Express' },
        ],
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function WhatsAppTemplatesPage() {
    const queryClient = useQueryClient();
    const [templates, setTemplates] = useState<MessageTemplate[]>(DEFAULT_TEMPLATES);
    const [expandedId, setExpandedId] = useState<string | null>('job_confirmation');
    const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch saved templates
    const { data: savedTemplates, isLoading } = useQuery({
        queryKey: ['whatsapp-templates'],
        queryFn: async () => {
            const res = await fetch('/api/settings/whatsapp/templates');
            if (!res.ok) return null;
            return res.json();
        },
    });

    // Merge saved templates with defaults
    useEffect(() => {
        if (savedTemplates?.data) {
            setTemplates((prev) =>
                prev.map((t) => {
                    const saved = savedTemplates.data.find((s: { id: string; template: string }) => s.id === t.id);
                    return saved ? { ...t, template: saved.template || t.defaultTemplate } : t;
                })
            );
        }
    }, [savedTemplates]);

    // Save templates mutation
    const saveMutation = useMutation({
        mutationFn: async (updatedTemplates: { id: string; template: string }[]) => {
            const res = await fetch('/api/settings/whatsapp/templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templates: updatedTemplates }),
            });
            if (!res.ok) throw new Error('Failed to save');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
            setHasChanges(false);
        },
    });

    const handleTemplateChange = (templateId: string, newValue: string) => {
        setTemplates((prev) =>
            prev.map((t) => (t.id === templateId ? { ...t, template: newValue } : t))
        );
        setHasChanges(true);
    };

    const handleResetTemplate = (templateId: string) => {
        setTemplates((prev) =>
            prev.map((t) =>
                t.id === templateId ? { ...t, template: t.defaultTemplate } : t
            )
        );
        setHasChanges(true);
    };

    const handleSave = () => {
        const toSave = templates.map((t) => ({
            id: t.id,
            template: t.template || t.defaultTemplate,
        }));
        saveMutation.mutate(toSave);
    };

    const generatePreview = (template: MessageTemplate): string => {
        let preview = template.template || template.defaultTemplate;
        template.variables.forEach((v) => {
            const regex = new RegExp(`{{${v.name}}}`, 'g');
            preview = preview.replace(regex, v.example);
        });
        // Simple handlebar-like conditionals
        preview = preview.replace(/{{#if \w+}}([\s\S]*?){{\/if}}/g, '$1');
        preview = preview.replace(/{{#each \w+}}([\s\S]*?){{\/each}}/g, '$1');
        return preview;
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'job':
                return 'bg-blue-100 text-blue-700';
            case 'quote':
                return 'bg-emerald-100 text-emerald-700';
            case 'notification':
                return 'bg-amber-100 text-amber-700';
            case 'reminder':
                return 'bg-purple-100 text-purple-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'job':
                return 'Trabajo';
            case 'quote':
                return 'Presupuesto';
            case 'notification':
                return 'Notificación';
            case 'reminder':
                return 'Recordatorio';
            default:
                return category;
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <MessageCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Templates de WhatsApp
                        </h1>
                        <p className="text-sm text-gray-500">
                            Personaliza los mensajes automáticos que se envían a tus clientes
                        </p>
                    </div>
                </div>

                {hasChanges && (
                    <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        {saveMutation.isPending ? (
                            <>Guardando...</>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Guardar Cambios
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Success/Error Messages */}
            {saveMutation.isSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700">
                    <CheckCircle className="h-5 w-5" />
                    Templates guardados exitosamente
                </div>
            )}

            {saveMutation.isError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    Error al guardar. Por favor intenta de nuevo.
                </div>
            )}

            {/* Variable Info Box */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-blue-800">
                            Variables disponibles
                        </p>
                        <p className="text-sm text-blue-600 mt-1">
                            Usa <code className="bg-blue-100 px-1 rounded">{'{{variableName}}'}</code> para insertar datos dinámicos.
                            Las variables disponibles se muestran debajo de cada template.
                        </p>
                    </div>
                </div>
            </div>

            {/* Templates List */}
            <div className="space-y-4">
                {templates.map((template) => {
                    const isExpanded = expandedId === template.id;
                    const currentTemplate = template.template || template.defaultTemplate;
                    const isModified = template.template && template.template !== template.defaultTemplate;

                    return (
                        <div
                            key={template.id}
                            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm"
                        >
                            {/* Template Header */}
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : template.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                                            template.category
                                        )}`}
                                    >
                                        {getCategoryLabel(template.category)}
                                    </span>
                                    <div className="text-left">
                                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                            {template.name}
                                            {isModified && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                                    Modificado
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-sm text-gray-500">{template.description}</p>
                                    </div>
                                </div>
                                {isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-gray-400" />
                                ) : (
                                    <ChevronDown className="h-5 w-5 text-gray-400" />
                                )}
                            </button>

                            {/* Template Editor */}
                            {isExpanded && (
                                <div className="p-4 pt-0 space-y-4">
                                    {/* Editor */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium text-gray-700">
                                                Mensaje
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() =>
                                                        setPreviewTemplate(
                                                            previewTemplate === template.id ? null : template.id
                                                        )
                                                    }
                                                    className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    {previewTemplate === template.id ? 'Ocultar Vista Previa' : 'Vista Previa'}
                                                </button>
                                                {isModified && (
                                                    <button
                                                        onClick={() => handleResetTemplate(template.id)}
                                                        className="flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        Restaurar Default
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <textarea
                                            value={currentTemplate}
                                            onChange={(e) =>
                                                handleTemplateChange(template.id, e.target.value)
                                            }
                                            className="w-full h-48 p-3 border border-gray-200 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                            placeholder={template.defaultTemplate}
                                        />
                                    </div>

                                    {/* Preview */}
                                    {previewTemplate === template.id && (
                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                                                Vista Previa
                                            </p>
                                            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                                                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                                                    {generatePreview(template)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Variables Reference */}
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                                            Variables disponibles
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {template.variables.map((v) => (
                                                <code
                                                    key={v.name}
                                                    className="text-xs bg-gray-100 px-2 py-1 rounded cursor-help"
                                                    title={`${v.description} (ej: ${v.example})`}
                                                >
                                                    {'{{' + v.name + '}}'}
                                                </code>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-white/50 flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                </div>
            )}
        </div>
    );
}
