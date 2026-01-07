/**
 * Profiles Browser Page
 * ======================
 * 
 * Phase 4.4: Growth Engine
 * /dashboard/admin/growth-engine/profiles
 * 
 * Admin interface to browse all imported unclaimed profiles.
 * Supports filtering by source, province, claim status, and search.
 */

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
    ArrowLeft,
    Users,
    Phone,
    Mail,
    CheckCircle2,
    Search,
    Filter,
    Download,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { ProfileRow } from './ProfileDetail';

interface PageProps {
    searchParams: Promise<{
        source?: string;
        province?: string;
        status?: string;
        search?: string;
        page?: string;
    }>;
}

const ITEMS_PER_PAGE = 50;

const SOURCE_LABELS: Record<string, string> = {
    ERSEP: 'ERSEP (Córdoba)',
    CACAAV: 'CACAAV (Nacional)',
    GASNOR: 'Gasnor (Norte)',
    GASNEA: 'GasNEA (NEA)',
    ENARGAS: 'ENARGAS (Nacional)',
    MANUAL: 'Manual',
};

interface FilterOption {
    value: string;
    count: number;
}

interface ProfileRecord {
    id: string;
    source: string;
    fullName: string;
    matricula: string | null;
    phone: string | null;
    phones: string[];
    email: string | null;
    profession: string | null;
    province: string | null;
    city: string | null;
    cuit: string | null;
    address: string | null;
    postalCode: string | null;
    category: string | null;
    categoryDesc: string | null;
    licenseExpiry: Date | null;
    claimedAt: Date | null;
    createdAt: Date;
}


async function getProfiles(params: {
    source?: string;
    province?: string;
    status?: string;
    search?: string;
    page: number;
}) {
    const where: Record<string, unknown> = {};

    if (params.source) {
        where.source = params.source;
    }

    if (params.province) {
        where.province = params.province;
    }

    if (params.status === 'claimed') {
        where.claimedAt = { not: null };
    } else if (params.status === 'unclaimed') {
        where.claimedAt = null;
    }

    if (params.search) {
        where.OR = [
            { fullName: { contains: params.search, mode: 'insensitive' } },
            { matricula: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
            { phone: { contains: params.search, mode: 'insensitive' } },
        ];
    }

    const [profiles, total] = await Promise.all([
        prisma.unclaimedProfile.findMany({
            where: where as never,
            orderBy: { createdAt: 'desc' },
            skip: (params.page - 1) * ITEMS_PER_PAGE,
            take: ITEMS_PER_PAGE,
            select: {
                id: true,
                source: true,
                fullName: true,
                matricula: true,
                phone: true,
                phones: true,
                email: true,
                profession: true,
                province: true,
                city: true,
                cuit: true,
                address: true,
                postalCode: true,
                category: true,
                categoryDesc: true,
                licenseExpiry: true,
                claimedAt: true,
                createdAt: true,
            },
        }),
        prisma.unclaimedProfile.count({ where: where as never }),
    ]);

    return {
        profiles,
        total,
        totalPages: Math.ceil(total / ITEMS_PER_PAGE),
    };
}

async function getFilterOptions() {
    const [sources, provinces] = await Promise.all([
        prisma.unclaimedProfile.groupBy({
            by: ['source'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        }),
        prisma.unclaimedProfile.groupBy({
            by: ['province'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        }),
    ]);

    return {
        sources: sources.map((s: { source: string; _count: { id: number } }) => ({
            value: s.source,
            count: s._count.id
        })),
        provinces: provinces
            .filter((p: { province: string | null }) => p.province)
            .map((p: { province: string | null; _count: { id: number } }) => ({
                value: p.province!,
                count: p._count.id
            })),
    };
}


export default async function ProfilesPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const page = parseInt(params.page || '1', 10);

    const [{ profiles, total, totalPages }, filters] = await Promise.all([
        getProfiles({
            source: params.source,
            province: params.province,
            status: params.status,
            search: params.search,
            page,
        }),
        getFilterOptions(),
    ]);

    // Build query string for pagination links
    function buildQueryString(newPage: number) {
        const query = new URLSearchParams();
        if (params.source) query.set('source', params.source);
        if (params.province) query.set('province', params.province);
        if (params.status) query.set('status', params.status);
        if (params.search) query.set('search', params.search);
        query.set('page', newPage.toString());
        return query.toString();
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/dashboard/admin/growth-engine"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver al Growth Engine
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Perfiles Importados</h1>
                    <p className="text-gray-500 mt-1">
                        {total.toLocaleString()} perfiles en total
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/dashboard/admin/growth-engine/scrapers"
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Ejecutar Scrapers
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <form method="GET" className="flex flex-wrap gap-4">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                name="search"
                                placeholder="Buscar por nombre, matrícula, email..."
                                defaultValue={params.search}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Source Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            name="source"
                            defaultValue={params.source}
                            className="pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 appearance-none cursor-pointer focus:outline-none focus:border-emerald-500"
                        >
                            <option value="">Todas las fuentes</option>
                            {filters.sources.map((s: FilterOption) => (
                                <option key={s.value} value={s.value}>
                                    {SOURCE_LABELS[s.value] || s.value} ({s.count.toLocaleString()})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Province Filter */}
                    <select
                        name="province"
                        defaultValue={params.province}
                        className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 appearance-none cursor-pointer focus:outline-none focus:border-emerald-500"
                    >
                        <option value="">Todas las provincias</option>
                        {filters.provinces.map((p: FilterOption) => (
                            <option key={p.value} value={p.value}>
                                {p.value} ({p.count.toLocaleString()})
                            </option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        name="status"
                        defaultValue={params.status}
                        className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 appearance-none cursor-pointer focus:outline-none focus:border-emerald-500"
                    >
                        <option value="">Todos los estados</option>
                        <option value="unclaimed">Sin reclamar</option>
                        <option value="claimed">Reclamados</option>
                    </select>

                    <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                    >
                        Filtrar
                    </button>

                    {(params.source || params.province || params.status || params.search) && (
                        <Link
                            href="/dashboard/admin/growth-engine/profiles"
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                        >
                            Limpiar
                        </Link>
                    )}
                </form>
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                    Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, total)} de {total.toLocaleString()}
                </span>
                <div className="flex gap-4">
                    <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4 text-emerald-500" />
                        Con teléfono
                    </span>
                    <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4 text-blue-500" />
                        Con email
                    </span>
                    <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-purple-500" />
                        Reclamado
                    </span>
                </div>
            </div>

            {/* Profiles Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Fuente</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Profesión</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Ubicación</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Contacto</th>
                                <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {profiles.map((profile: ProfileRecord) => (
                                <ProfileRow
                                    key={profile.id}
                                    profile={profile}
                                    sourceLabel={SOURCE_LABELS[profile.source] || profile.source}
                                />
                            ))}
                            {profiles.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No se encontraron perfiles</p>
                                        <p className="text-sm mt-1">
                                            {total === 0
                                                ? 'Ejecutá los scrapers para importar perfiles'
                                                : 'Probá con otros filtros de búsqueda'}
                                        </p>
                                        {total === 0 && (
                                            <Link
                                                href="/dashboard/admin/growth-engine/scrapers"
                                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                                            >
                                                <Download className="w-4 h-4" />
                                                Ir a Scrapers
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Link
                        href={page > 1 ? `/dashboard/admin/growth-engine/profiles?${buildQueryString(page - 1)}` : '#'}
                        className={`p-2 rounded-lg transition-colors ${page > 1
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                            }`}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 7) {
                                pageNum = i + 1;
                            } else if (page <= 4) {
                                pageNum = i + 1;
                            } else if (page >= totalPages - 3) {
                                pageNum = totalPages - 6 + i;
                            } else {
                                pageNum = page - 3 + i;
                            }

                            return (
                                <Link
                                    key={pageNum}
                                    href={`/dashboard/admin/growth-engine/profiles?${buildQueryString(pageNum)}`}
                                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${pageNum === page
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                        }`}
                                >
                                    {pageNum}
                                </Link>
                            );
                        })}
                    </div>

                    <Link
                        href={page < totalPages ? `/dashboard/admin/growth-engine/profiles?${buildQueryString(page + 1)}` : '#'}
                        className={`p-2 rounded-lg transition-colors ${page < totalPages
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                            }`}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </Link>
                </div>
            )}
        </div>
    );
}
