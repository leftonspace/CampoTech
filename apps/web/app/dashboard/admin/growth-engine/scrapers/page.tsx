'use client';

/**
 * Scraper Management Page
 * ========================
 * 
 * Phase 4.4: Growth Engine
 * /dashboard/admin/growth-engine/scrapers
 * 
 * Admin interface for running and monitoring web scrapers.
 * Allows triggering ERSEP and CACAAV scrapers with progress indicators.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Zap,
    Snowflake,
    Play,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Clock,
    Database,
    ExternalLink
} from 'lucide-react';

interface ScraperResult {
    success: boolean;
    source: string;
    scrape: {
        records: number;
        pages?: number;
        errors: number;
        errorDetails: string[];
    };
    import: {
        imported: number;
        updated: number;
        errors: number;
        total: number;
    } | null;
    message: string;
}

interface ScraperConfig {
    id: string;
    name: string;
    url: string;
    region: string;
    profession: string;
    estimatedRecords: number;
    icon: React.ReactNode;
    color: 'amber' | 'cyan';
    description: string;
}

const SCRAPERS: ScraperConfig[] = [
    {
        id: 'ersep',
        name: 'ERSEP Córdoba',
        url: 'https://volta.net.ar/matriculados',
        region: 'Córdoba',
        profession: 'Electricista',
        estimatedRecords: 33000,
        icon: <Zap className="w-6 h-6" />,
        color: 'amber',
        description: 'Registro de electricistas matriculados de Córdoba (ERSEP)',
    },
    {
        id: 'cacaav',
        name: 'CACAAV Nacional',
        url: 'https://cacaav.com.ar/matriculados/listado',
        region: 'Nacional',
        profession: 'HVAC/Refrigeración',
        estimatedRecords: 23000,
        icon: <Snowflake className="w-6 h-6" />,
        color: 'cyan',
        description: 'Cámara Argentina de Calefacción, Aire y Ventilación',
    },
];

const colorConfig = {
    amber: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        iconBg: 'bg-amber-100',
        iconText: 'text-amber-600',
        buttonBg: 'bg-amber-500 hover:bg-amber-600',
        buttonText: 'text-white',
    },
    cyan: {
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        iconBg: 'bg-cyan-100',
        iconText: 'text-cyan-600',
        buttonBg: 'bg-cyan-500 hover:bg-cyan-600',
        buttonText: 'text-white',
    },
};

export default function ScrapersPage() {
    const [runningScrapers, setRunningScrapers] = useState<Set<string>>(new Set());
    const [results, setResults] = useState<Record<string, ScraperResult>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    async function runScraper(scraperId: string, maxPages?: number) {
        if (runningScrapers.has(scraperId)) return;

        setRunningScrapers(prev => new Set([...prev, scraperId]));
        setErrors(prev => ({ ...prev, [scraperId]: '' }));

        try {
            const response = await fetch(`/api/admin/growth-engine/scrape/${scraperId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    maxPages: maxPages || 10,
                    import: true
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error executing scraper');
            }

            setResults(prev => ({ ...prev, [scraperId]: data }));
        } catch (error) {
            setErrors(prev => ({
                ...prev,
                [scraperId]: error instanceof Error ? error.message : 'Unknown error',
            }));
        } finally {
            setRunningScrapers(prev => {
                const newSet = new Set(prev);
                newSet.delete(scraperId);
                return newSet;
            });
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <Link
                    href="/dashboard/admin/growth-engine"
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al Growth Engine
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Web Scrapers</h1>
                <p className="text-gray-500 mt-1">
                    Ejecutar scrapers para importar perfiles de registros públicos
                </p>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-amber-800">Respeta los términos de servicio</p>
                    <p className="text-amber-700 mt-1">
                        Los scrapers incluyen rate limiting para no sobrecargar los sitios fuente.
                        Ejecutar solo cuando sea necesario para actualizar los datos.
                    </p>
                </div>
            </div>

            {/* Scrapers Grid */}
            <div className="space-y-4">
                {SCRAPERS.map(scraper => {
                    const isRunning = runningScrapers.has(scraper.id);
                    const result = results[scraper.id];
                    const error = errors[scraper.id];
                    const colors = colorConfig[scraper.color];

                    return (
                        <div
                            key={scraper.id}
                            className={`${colors.bg} border ${colors.border} rounded-xl overflow-hidden`}
                        >
                            {/* Scraper Header */}
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-lg ${colors.iconBg}`}>
                                            <span className={colors.iconText}>
                                                {scraper.icon}
                                            </span>
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-lg text-gray-900">{scraper.name}</h2>
                                            <p className="text-sm text-gray-600 mt-1">{scraper.description}</p>
                                            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <Database className="w-3 h-3" />
                                                    <span>~{scraper.estimatedRecords.toLocaleString()} registros</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{scraper.profession}</span>
                                                </div>
                                                <a
                                                    href={scraper.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    <span>Ver fuente</span>
                                                </a>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => runScraper(scraper.id)}
                                        disabled={isRunning}
                                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${isRunning
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : `${colors.buttonBg} ${colors.buttonText}`
                                            }`}
                                    >
                                        {isRunning ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Ejecutando...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4" />
                                                Ejecutar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Result Section */}
                            {(result || error) && (
                                <div className={`border-t ${error ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'} p-4`}>
                                    {error ? (
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium text-red-800">Error</p>
                                                <p className="text-sm text-red-700">{error}</p>
                                            </div>
                                        </div>
                                    ) : result && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                                <span className="font-medium text-emerald-800">{result.message}</span>
                                            </div>

                                            <div className="grid grid-cols-4 gap-4 text-center">
                                                <div className="bg-white rounded-lg p-3 shadow-sm">
                                                    <p className="text-2xl font-bold text-gray-900">{result.scrape.records}</p>
                                                    <p className="text-xs text-gray-500">Encontrados</p>
                                                </div>
                                                {result.import && (
                                                    <>
                                                        <div className="bg-white rounded-lg p-3 shadow-sm">
                                                            <p className="text-2xl font-bold text-emerald-600">{result.import.imported}</p>
                                                            <p className="text-xs text-gray-500">Nuevos</p>
                                                        </div>
                                                        <div className="bg-white rounded-lg p-3 shadow-sm">
                                                            <p className="text-2xl font-bold text-blue-600">{result.import.updated}</p>
                                                            <p className="text-xs text-gray-500">Actualizados</p>
                                                        </div>
                                                        <div className="bg-white rounded-lg p-3 shadow-sm">
                                                            <p className="text-2xl font-bold text-red-600">{result.import.errors}</p>
                                                            <p className="text-xs text-gray-500">Errores</p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {result.scrape.errorDetails.length > 0 && (
                                                <details className="text-sm">
                                                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                                                        Ver {result.scrape.errors} errores de scraping
                                                    </summary>
                                                    <ul className="mt-2 space-y-1 text-gray-600 max-h-32 overflow-auto bg-white rounded p-2">
                                                        {result.scrape.errorDetails.map((err, i) => (
                                                            <li key={i} className="font-mono text-xs">{err}</li>
                                                        ))}
                                                    </ul>
                                                </details>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => {
                            SCRAPERS.forEach(s => runScraper(s.id));
                        }}
                        disabled={runningScrapers.size > 0}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg text-sm transition-colors"
                    >
                        Ejecutar Todos los Scrapers
                    </button>
                    <Link
                        href="/dashboard/admin/growth-engine"
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                    >
                        Ver Estadísticas
                    </Link>
                    <Link
                        href="/dashboard/admin/growth-engine/import"
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                    >
                        Importar PDF
                    </Link>
                </div>
            </div>
        </div>
    );
}
