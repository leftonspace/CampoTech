'use client';

/**
 * Claim Profile Landing Page
 * ==========================
 * 
 * Phase 4.4: Growth Engine
 * /claim
 * 
 * Marketing page where professionals can search for and claim their profile.
 * This is the primary landing page for outreach campaigns.
 */

import { useState } from 'react';
import { Search, Shield, Star, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ProfileResult {
    id: string;
    fullName: string;
    profession: string | null;
    source: string;
    province: string | null;
    city: string | null;
    matricula: string | null;
    maskedPhone: string | null;
    maskedEmail: string | null;
    isClaimed: boolean;
}

export default function ClaimProfilePage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<ProfileResult[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sources = [
        { value: '', label: 'Todos los entes' },
        { value: 'ERSEP', label: 'ERSEP (Córdoba - Electricistas)' },
        { value: 'CACAAV', label: 'CACAAV (Nacional - HVAC)' },
        { value: 'GASNOR', label: 'Gasnor (Salta, Jujuy, Tucumán)' },
        { value: 'GASNEA', label: 'GasNEA (Corrientes, Chaco)' },
        { value: 'ENARGAS', label: 'ENARGAS (Nacional)' },
    ];

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (!searchQuery || searchQuery.length < 2) return;

        setIsSearching(true);
        setError(null);
        setHasSearched(true);

        try {
            const params = new URLSearchParams({ q: searchQuery });
            if (selectedSource) params.append('source', selectedSource);

            const response = await fetch(`/api/claim-profile/search?${params}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al buscar');
            }

            setResults(data.profiles || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al buscar perfiles');
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }

    function getSourceLabel(source: string): string {
        const found = sources.find(s => s.value === source);
        return found ? found.label.split(' (')[0] : source;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

                <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-12">
                    {/* Logo */}
                    <div className="flex justify-center mb-8">
                        <Link href="/" className="text-2xl font-bold text-white flex items-center gap-2">
                            <span className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center text-lg">
                                C
                            </span>
                            CampoTech
                        </Link>
                    </div>

                    {/* Headline */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent">
                            ¿Sos profesional matriculado?
                        </h1>
                        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                            Tu perfil profesional ya está listo para recibir clientes.
                            Buscá tu matrícula y activá tu presencia digital gratis.
                        </p>
                    </div>

                    {/* Search Card */}
                    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 md:p-8 shadow-2xl">
                        <form onSubmit={handleSearch} className="space-y-4">
                            {/* Source Selector */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Ente regulador
                                </label>
                                <select
                                    value={selectedSource}
                                    onChange={(e) => setSelectedSource(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                >
                                    {sources.map(source => (
                                        <option key={source.value} value={source.value}>
                                            {source.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Search Input */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Número de matrícula o nombre completo
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Ej: 12345 o Juan Pérez"
                                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-12 pr-4 py-4 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSearching || searchQuery.length < 2}
                                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg text-lg transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                {isSearching ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Buscando...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-5 h-5" />
                                        Buscar mi perfil
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Error */}
                        {error && (
                            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-200">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Results */}
                        {hasSearched && !isSearching && (
                            <div className="mt-6 space-y-3">
                                {results.length > 0 ? (
                                    <>
                                        <p className="text-sm text-gray-400">
                                            {results.length} perfil{results.length !== 1 ? 'es' : ''} encontrado{results.length !== 1 ? 's' : ''}
                                        </p>
                                        {results.map(profile => (
                                            <div
                                                key={profile.id}
                                                className={`p-4 rounded-lg border ${profile.isClaimed
                                                        ? 'bg-gray-800/30 border-gray-700/50 opacity-75'
                                                        : 'bg-gray-800/50 border-gray-700/50 hover:border-emerald-500/50'
                                                    } transition-colors`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-lg text-white truncate">
                                                            {profile.fullName}
                                                        </h3>
                                                        <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-400">
                                                            {profile.matricula && (
                                                                <span>Mat. {profile.matricula}</span>
                                                            )}
                                                            {profile.profession && (
                                                                <span>• {profile.profession}</span>
                                                            )}
                                                            {profile.city && profile.province && (
                                                                <span>• {profile.city}, {profile.province}</span>
                                                            )}
                                                        </div>
                                                        <div className="mt-2 text-xs text-gray-500">
                                                            {getSourceLabel(profile.source)}
                                                            {profile.maskedPhone && ` • Tel: ${profile.maskedPhone}`}
                                                            {profile.maskedEmail && ` • Email: ${profile.maskedEmail}`}
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {profile.isClaimed ? (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700/50 text-gray-400 rounded-full text-sm">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                Reclamado
                                                            </span>
                                                        ) : (
                                                            <Link
                                                                href={`/claim/${profile.id}`}
                                                                className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                                                            >
                                                                Reclamar
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-lg">No se encontraron perfiles</p>
                                        <p className="text-sm mt-1">
                                            Verificá que el número de matrícula o nombre sea correcto
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Benefits Section */}
            <div className="py-16 px-4 bg-gradient-to-b from-transparent to-gray-900/50">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-8">
                        Tu perfil ya tiene
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-center">
                            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="font-semibold mb-2">Matrícula Verificada</h3>
                            <p className="text-sm text-gray-400">
                                Tu número de matrícula profesional ya está cargado y verificado
                            </p>
                        </div>
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-center">
                            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Star className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="font-semibold mb-2">Datos Profesionales</h3>
                            <p className="text-sm text-gray-400">
                                Tu información del registro oficial ya está precargada
                            </p>
                        </div>
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-center">
                            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="font-semibold mb-2">Listo para Trabajos</h3>
                            <p className="text-sm text-gray-400">
                                Recibí solicitudes de clientes apenas actives tu perfil
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="py-8 px-4 border-t border-gray-800">
                <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
                    <p>© 2026 CampoTech. Todos los derechos reservados.</p>
                    <p className="mt-2">
                        Los datos mostrados provienen de registros públicos de organismos reguladores.
                    </p>
                </div>
            </footer>
        </div>
    );
}
