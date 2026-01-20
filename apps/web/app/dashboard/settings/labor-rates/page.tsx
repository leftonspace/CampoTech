'use client';

/**
 * Labor Rates Settings Page
 * 
 * Phase 6.2 - Technician Hourly Wages (Jan 2026)
 * 
 * Allows organization owners to configure hourly rates for each
 * specialty/category combination. Supports all 12 trades with
 * their respective level systems.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
    ArrowLeft,
    Save,
    Users,
    ChevronDown,
    ChevronRight,
    Info,
    CheckCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS - Trade Categories (Updated Jan 2026)
// VALIDITY: Rates valid until 28/02/2026 (Check for March updates)
// ═══════════════════════════════════════════════════════════════════════════════

// 1. UOCRA SCALES (EMPLOYEES)
// Based on Acuerdo UOCRA Enero 2026 (Approx +2% over late 2025 base)
// Zone A reference values.
const UOCRA_CATEGORIES = [
    { value: 'AYUDANTE', label: 'Ayudante', referenceRate: 3900 },
    { value: 'MEDIO_OFICIAL', label: 'Medio Oficial', referenceRate: 4250 },
    { value: 'OFICIAL', label: 'Oficial', referenceRate: 4600 },
    { value: 'OFICIAL_ESPECIALIZADO', label: 'Oficial Especializado', referenceRate: 5400 },
];

// Reference notes
const UOCRA_NOTE = 'Valores Hora UOCRA Zona A - Enero 2026. Verificar actualizaciones Mar 2026.';
const UOCRA_URL = 'https://www.uocra.org/escala-salarial';

// 2. TECHNICAL/PROFESSIONAL SCALES (CONTRACTORS)
// Independent professionals (Gas, Elec, HVAC) charge "Hora Técnica"
// which covers tools, insurance, expertise (~2-3x employee wage)
const TECH_HOUR_BASE = 9800;       // Base technical hour
const TECH_HOUR_SPECIALIST = 12500; // Specialist/High voltage/Industrial

// All specialties with their category options, descriptions, and references
interface CategoryWithRef {
    value: string;
    label: string;
    referenceRate?: number; // Optional reference hourly rate in ARS
}

interface SpecialtyConfig {
    label: string;
    icon: string;
    description?: string;
    referenceUrl?: string;
    referenceNote?: string;
    categories: CategoryWithRef[];
}

const SPECIALTY_CATEGORIES: Record<string, SpecialtyConfig> = {
    GASISTA: {
        label: 'Gasista',
        icon: '🔥',
        description: 'Instaladores habilitados (Tarifas por Hora Técnica sugeridas por CAGP).',
        referenceNote: 'Valores ref. Hora Técnica. Trabajos por boca ver lista CAGP.',
        referenceUrl: 'https://www.enargas.gob.ar/secciones/matriculados/matriculados.php',
        categories: [
            { value: '1RA', label: '1ra Categoría (Industrial / Edificios)', referenceRate: TECH_HOUR_SPECIALIST },
            { value: '2DA', label: '2da Categoría (Doméstico / Comercial)', referenceRate: TECH_HOUR_BASE },
            { value: '3RA', label: '3ra Categoría (Unifuncional / Domiciliario)', referenceRate: 8500 },
        ],
    },
    ELECTRICISTA: {
        label: 'Electricista',
        icon: '⚡',
        description: 'Instaladores matriculados (Tarifas sugeridas AAIERIC/APSE).',
        referenceNote: 'Valores ref. Hora Técnica de Trabajo (sin materiales).',
        referenceUrl: 'https://www.aaieric.org.ar/costos-mano-de-obra',
        categories: [
            { value: 'CAT_A', label: 'Categoría A (Profesional - Potencia Ilimitada)', referenceRate: TECH_HOUR_SPECIALIST },
            { value: 'CAT_B', label: 'Categoría B (Técnico - Hasta 2000 kVA)', referenceRate: TECH_HOUR_BASE },
            { value: 'CAT_C', label: 'Categoría C (Idóneo - Hasta 10 kW)', referenceRate: 9000 },
        ],
    },
    PLOMERO: {
        label: 'Plomero',
        icon: '🔧',
        description: 'Plomería e instalaciones sanitarias.',
        referenceNote: UOCRA_NOTE,
        referenceUrl: UOCRA_URL,
        categories: [
            ...UOCRA_CATEGORIES,
            { value: 'DESTAPACIONES', label: 'Especialista en Destapaciones', referenceRate: 10000 },
        ],
    },
    CALEFACCIONISTA: {
        label: 'Calefaccionista',
        icon: '🌡️',
        description: 'Instalación y reparación de sistemas de calefacción.',
        referenceNote: 'Valores ref. Hora Técnica para técnicos independientes.',
        categories: [
            { value: 'CALDERISTA', label: 'Calderista (Vapor/Agua Caliente)', referenceRate: TECH_HOUR_SPECIALIST },
            { value: 'RADIADORES', label: 'Instalador de Radiadores/Piso Radiante', referenceRate: TECH_HOUR_BASE },
            { value: 'ESTUFAS', label: 'Reparador de Estufas/Tiro Balanceado', referenceRate: 8500 },
        ],
    },
    REFRIGERACION: {
        label: 'Refrigeración',
        icon: '❄️',
        description: 'Técnicos en aire acondicionado y refrigeración.',
        referenceNote: 'Técnicos matriculados CACAAV. Valores Hora Técnica service/reparación.',
        referenceUrl: 'https://cacaav.org.ar/',
        categories: [
            { value: 'MATRICULADO_CACAAV', label: 'Matriculado CACAAV / IRAM', referenceRate: TECH_HOUR_SPECIALIST },
            { value: 'INSTALADOR_SPLIT', label: 'Instalador de Splits', referenceRate: TECH_HOUR_BASE },
            { value: 'TECNICO_CENTRAL', label: 'Técnico en Sistemas Centrales / VRF', referenceRate: TECH_HOUR_SPECIALIST },
            { value: 'HELADERAS', label: 'Reparador de Heladeras / Línea Blanca', referenceRate: 8500 },
        ],
    },
    ALBANIL: {
        label: 'Albañil',
        icon: '🧱',
        description: 'Trabajos de construcción y albañilería general.',
        referenceNote: UOCRA_NOTE,
        referenceUrl: UOCRA_URL,
        categories: UOCRA_CATEGORIES,
    },
    PINTOR: {
        label: 'Pintor',
        icon: '🎨',
        description: 'Pintura de interiores y trabajos de altura.',
        referenceNote: UOCRA_NOTE,
        referenceUrl: UOCRA_URL,
        categories: [
            ...UOCRA_CATEGORIES,
            { value: 'ALTURA', label: 'Pintor de Altura / Silletero', referenceRate: 6500 },
        ],
    },
    CARPINTERO: {
        label: 'Carpintero',
        icon: '🪚',
        description: 'Carpintería de obra y muebles.',
        referenceNote: UOCRA_NOTE,
        referenceUrl: UOCRA_URL,
        categories: [
            ...UOCRA_CATEGORIES,
            { value: 'EBANISTA', label: 'Ebanista (Muebles a medida)', referenceRate: 5800 },
            { value: 'OBRA', label: 'Carpintero de Obra / Encofrador', referenceRate: 4600 },
        ],
    },
    TECHISTA: {
        label: 'Techista',
        icon: '🏠',
        description: 'Techos, cubiertas y zinguería.',
        referenceNote: UOCRA_NOTE,
        referenceUrl: UOCRA_URL,
        categories: [
            ...UOCRA_CATEGORIES,
            { value: 'ZINGUERO', label: 'Zinguero (Canaletas)', referenceRate: 4800 },
            { value: 'MEMBRANERO', label: 'Colocador de Membranas', referenceRate: 4600 },
        ],
    },
    HERRERO: {
        label: 'Herrero',
        icon: '⚒️',
        description: 'Herrería y estructuras metálicas.',
        referenceNote: UOCRA_NOTE,
        referenceUrl: UOCRA_URL,
        categories: UOCRA_CATEGORIES,
    },
    SOLDADOR: {
        label: 'Soldador',
        icon: '🔩',
        description: 'Soldadura general y de alta presión.',
        referenceNote: 'Soldadores calificados (ASME/API/AWS) perciben diferencial sobre UOCRA.',
        categories: [
            { value: 'BASICO', label: 'Herrero de Obra', referenceRate: 4600 },
            { value: 'CALIFICADO_ASME', label: 'Calificado ASME IX (Alta Presión)', referenceRate: 7500 },
            { value: 'CALIFICADO_API', label: 'Calificado API 1104 (Gasoductos)', referenceRate: 7500 },
            { value: 'CALIFICADO_AWS', label: 'Calificado AWS D1.1 (Estructural)', referenceRate: 6800 },
            { value: 'ARGONISTA', label: 'Argonista / TIG', referenceRate: 7200 },
        ],
    },
    OTRO: {
        label: 'Otro / Sin categoría formal',
        icon: '🛠️',
        description: '¿Tu empleado no tiene categoría formal? Usá esta opción.',
        referenceNote: '⚠️ Para trabajadores sin título habilitante. Vos decidís la tarifa.',
        categories: [
            { value: 'GENERAL', label: 'Tarifa General', referenceRate: 3900 },
            { value: 'APRENDIZ', label: 'Aprendiz / En formación', referenceRate: 3200 },
            { value: 'MULTIOFICIO', label: 'Multioficio (varias tareas)', referenceRate: 5000 },
        ],
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LaborRate {
    id?: string;
    specialty: string;
    category: string;
    hourlyRate: number;
    notes?: string;
    updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LaborRatesSettingsPage() {
    const queryClient = useQueryClient();
    const [expandedSpecialties, setExpandedSpecialties] = useState<Set<string>>(new Set());
    const [editingRates, setEditingRates] = useState<Record<string, string>>({});
    const [isSaved, setIsSaved] = useState(false);

    // Fetch current rates
    const { data: ratesData, isLoading } = useQuery({
        queryKey: ['labor-rates'],
        queryFn: async () => {
            const res = await fetch('/api/settings/labor-rates');
            if (!res.ok) throw new Error('Error fetching rates');
            const json = await res.json();
            return json.data as LaborRate[];
        },
    });

    // Index rates by specialty_category for quick lookup
    const ratesMap = new Map<string, LaborRate>();
    ratesData?.forEach((rate) => {
        ratesMap.set(`${rate.specialty}_${rate.category}`, rate);
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (rates: LaborRate[]) => {
            const res = await fetch('/api/settings/labor-rates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rates }),
            });
            if (!res.ok) throw new Error('Error saving rates');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['labor-rates'] });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        },
    });

    // Toggle specialty expansion
    const toggleSpecialty = (specialty: string) => {
        setExpandedSpecialties((prev) => {
            const next = new Set(prev);
            if (next.has(specialty)) {
                next.delete(specialty);
            } else {
                next.add(specialty);
            }
            return next;
        });
    };

    // Expand all specialties that have rates configured
    useEffect(() => {
        if (ratesData && ratesData.length > 0) {
            const specialtiesWithRates = new Set(ratesData.map((r) => r.specialty));
            setExpandedSpecialties(specialtiesWithRates);
        }
    }, [ratesData]);

    // Get rate for specialty/category
    const getRate = (specialty: string, category: string): string => {
        const key = `${specialty}_${category}`;
        if (editingRates[key] !== undefined) {
            return editingRates[key];
        }
        const rate = ratesMap.get(key);
        return rate ? rate.hourlyRate.toString() : '';
    };

    // Update rate in local state
    const updateRate = (specialty: string, category: string, value: string) => {
        const key = `${specialty}_${category}`;
        setEditingRates((prev) => ({ ...prev, [key]: value }));
    };

    // Save all rates
    const handleSaveAll = () => {
        const ratesToSave: LaborRate[] = [];

        Object.entries(SPECIALTY_CATEGORIES).forEach(([specialty, config]) => {
            config.categories.forEach((cat) => {
                const key = `${specialty}_${cat.value}`;
                const value = editingRates[key] !== undefined
                    ? editingRates[key]
                    : ratesMap.get(key)?.hourlyRate?.toString();

                if (value && parseFloat(value) > 0) {
                    ratesToSave.push({
                        specialty,
                        category: cat.value,
                        hourlyRate: parseFloat(value),
                    });
                }
            });
        });

        saveMutation.mutate(ratesToSave);
    };

    // Count configured rates per specialty
    const getConfiguredCount = (specialty: string): number => {
        const config = SPECIALTY_CATEGORIES[specialty];
        if (!config) return 0;

        return config.categories.filter((cat) => {
            const key = `${specialty}_${cat.value}`;
            const editValue = editingRates[key];
            const savedValue = ratesMap.get(key)?.hourlyRate;
            return (editValue && parseFloat(editValue) > 0) || (savedValue && savedValue > 0);
        }).length;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/settings"
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">Tarifas de Mano de Obra</h1>
                    <p className="text-gray-500">Configurá el valor hora por especialidad y categoría</p>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-3">
                    {isSaved && (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="h-4 w-4" />
                            Guardado
                        </span>
                    )}
                    <button
                        onClick={handleSaveAll}
                        disabled={saveMutation.isPending}
                        className="btn-primary"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saveMutation.isPending ? 'Guardando...' : 'Guardar todo'}
                    </button>
                </div>
            </div>

            {/* Info Banner - How it works */}
            <div className="card p-4 bg-blue-50 border-blue-200">
                <div className="space-y-3">
                    <div>
                        <h3 className="text-sm font-semibold text-blue-900 mb-1">¿Cómo funciona?</h3>
                        <p className="text-sm text-blue-800">
                            Cuando un técnico reporte horas trabajadas (por voz o manualmente), el sistema usará la tarifa
                            correspondiente a su especialidad y nivel para calcular automáticamente el costo de mano de obra.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-blue-900 mb-1">Dos tipos de tarifas de referencia</h3>
                        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                            <li>
                                <strong>Escala UOCRA (empleados):</strong> Albañil, pintor, plomero, etc. → ~$3,900-$5,400/hora
                            </li>
                            <li>
                                <strong>Hora Técnica (matriculados):</strong> Gasista, electricista, refrigeración → ~$9,000-$12,500/hora
                                <span className="text-blue-600"> (incluye herramientas, seguro y expertise)</span>
                            </li>
                        </ul>
                    </div>
                    <div className="pt-2 border-t border-blue-200">
                        <p className="text-xs text-blue-700">
                            ⚠️ <strong>Nota:</strong> No disponemos de información oficial para todas las especialidades.
                            Los valores de referencia se muestran cuando están disponibles y verificados.
                            {' '}
                            <span className="text-blue-600">
                                Referencias: Enero 2026 (válido hasta 28/02/2026).
                                {' '}
                                <a
                                    href="https://www.uocra.org/escala-salarial"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:text-primary-700 underline"
                                >
                                    Verificar actualizaciones →
                                </a>
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Disclaimer - User discretion */}
            <div className="card p-4 bg-gray-50 border-gray-200">
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900">📋 Importante: Vos decidís tus tarifas</h3>
                    <p className="text-sm text-gray-700">
                        Los valores de referencia son <strong>orientativos</strong> basados en fuentes públicas (UOCRA, AAIERIC, CAGP, CACAAV).
                        <strong> Podés ingresar cualquier monto que consideres apropiado para tu organización.</strong>
                    </p>
                    <p className="text-sm text-gray-600">
                        CampoTech no establece ni recomienda tarifas específicas. La definición de salarios y costos laborales
                        es responsabilidad exclusiva de tu organización según la legislación vigente y tus acuerdos con los trabajadores.
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="card p-8">
                    <div className="flex items-center justify-center text-gray-500">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500" />
                        <span className="ml-2">Cargando tarifas...</span>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {Object.entries(SPECIALTY_CATEGORIES).map(([specialty, config]) => {
                        const isExpanded = expandedSpecialties.has(specialty);
                        const configuredCount = getConfiguredCount(specialty);
                        const totalCategories = config.categories.length;

                        return (
                            <div key={specialty} className="card overflow-hidden">
                                {/* Specialty Header */}
                                <button
                                    onClick={() => toggleSpecialty(specialty)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{config.icon}</span>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-900">{config.label}</h3>
                                            <p className="text-sm text-gray-500">
                                                {configuredCount > 0 ? (
                                                    <span className="text-green-600">
                                                        {configuredCount} de {totalCategories} categorías configuradas
                                                    </span>
                                                ) : (
                                                    <span>Sin tarifas configuradas</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {configuredCount > 0 && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                {configuredCount} activas
                                            </span>
                                        )}
                                        {isExpanded ? (
                                            <ChevronDown className="h-5 w-5 text-gray-400" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5 text-gray-400" />
                                        )}
                                    </div>
                                </button>

                                {/* Categories Table */}
                                {isExpanded && (
                                    <div className="border-t">
                                        {/* Description & Reference Info */}
                                        {(config.description || config.referenceNote) && (
                                            <div className="px-4 py-3 bg-gray-50 border-b space-y-2">
                                                {config.description && (
                                                    <p className="text-sm text-gray-600">
                                                        {config.description}
                                                    </p>
                                                )}
                                                {config.referenceNote && (
                                                    <div className="flex items-start gap-2">
                                                        <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                        <p className="text-sm text-amber-700">
                                                            {config.referenceNote}
                                                            {config.referenceUrl && (
                                                                <>
                                                                    {' '}
                                                                    <a
                                                                        href={config.referenceUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 underline"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        Ver fuente oficial →
                                                                    </a>
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="divide-y">
                                            {config.categories.map((cat) => {
                                                const rate = getRate(specialty, cat.value);
                                                const hasRate = rate && parseFloat(rate) > 0;
                                                const refRate = cat.referenceRate;

                                                return (
                                                    <div
                                                        key={cat.value}
                                                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                                                    >
                                                        <div className="flex-1">
                                                            <span className="text-sm font-medium text-gray-700">
                                                                {cat.label}
                                                            </span>
                                                            {/* Reference rate hint */}
                                                            {refRate && (
                                                                <span className="ml-2 text-xs text-gray-400" title="Valor de referencia UOCRA">
                                                                    (ref: ${refRate.toLocaleString('es-AR')}/h)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-gray-500">$</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="100"
                                                                value={rate}
                                                                onChange={(e) => updateRate(specialty, cat.value, e.target.value)}
                                                                placeholder={refRate ? refRate.toString() : '0'}
                                                                className={`w-28 px-3 py-1.5 text-right rounded-md border text-sm
                                                                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                                                                    ${hasRate
                                                                        ? 'border-green-300 bg-green-50 focus:border-green-500 focus:ring-green-500'
                                                                        : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                                                                    }`}
                                                            />
                                                            <span className="text-sm text-gray-500 w-16">/hora</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Summary Footer */}
            <div className="card p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-600">
                        <Users className="h-5 w-5" />
                        <span className="text-sm">
                            Total: {ratesData?.length || 0} tarifas configuradas en tu organización
                        </span>
                    </div>
                    <button
                        onClick={handleSaveAll}
                        disabled={saveMutation.isPending}
                        className="btn-primary"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Guardar todo
                    </button>
                </div>
            </div>
        </div>
    );
}
