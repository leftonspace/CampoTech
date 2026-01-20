/**
 * Admin Registry Search API
 * =========================
 *
 * Allows CampoTech admins to search the verification registry while
 * reviewing badge submissions. Helps identify near-matches when
 * auto-verification didn't find an exact match.
 *
 * GET /api/admin/verification-queue/registry-search?q=matricula&specialty=GASISTA
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        // Auth check - must be SUPER_ADMIN
        const session = await requireAuth();

        if (!session?.userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        if (session.role?.toUpperCase() !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Solo administradores pueden acceder' },
                { status: 403 }
            );
        }

        // Parse search params
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q')?.trim() || '';
        const specialty = searchParams.get('specialty')?.trim().toUpperCase();
        const source = searchParams.get('source')?.trim().toUpperCase();
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

        // Require at least 2 characters for search
        if (query.length < 2) {
            return NextResponse.json({
                results: [],
                total: 0,
                message: 'Ingrese al menos 2 caracteres para buscar',
            });
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            status: 'active',
            OR: [
                {
                    matricula: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
                {
                    fullName: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
            ],
        };

        // Optional filters
        if (specialty) {
            where.specialty = specialty;
        }
        if (source) {
            where.source = source;
        }

        // Execute search
        const [results, total] = await Promise.all([
            prisma.verificationRegistry.findMany({
                where,
                take: limit,
                orderBy: [
                    { matricula: 'asc' },
                    { fullName: 'asc' },
                ],
                select: {
                    id: true,
                    matricula: true,
                    specialty: true,
                    source: true,
                    fullName: true,
                    province: true,
                    status: true,
                    scrapedAt: true,
                    lastVerified: true,
                },
            }),
            prisma.verificationRegistry.count({ where }),
        ]);

        // Get distinct values for filter dropdowns
        const [specialties, sources] = await Promise.all([
            prisma.verificationRegistry.groupBy({
                by: ['specialty'],
                _count: { id: true },
                orderBy: { specialty: 'asc' },
            }),
            prisma.verificationRegistry.groupBy({
                by: ['source'],
                _count: { id: true },
                orderBy: { source: 'asc' },
            }),
        ]);

        return NextResponse.json({
            results: results.map((r: typeof results[0]) => ({
                ...r,
                scrapedAt: r.scrapedAt?.toISOString(),
                lastVerified: r.lastVerified?.toISOString(),
            })),
            total,
            query,
            filters: {
                specialty,
                source,
            },
            availableFilters: {
                specialties: specialties.map((s: typeof specialties[0]) => ({
                    value: s.specialty,
                    count: s._count.id,
                })),
                sources: sources.map((s: typeof sources[0]) => ({
                    value: s.source,
                    count: s._count.id,
                })),
            },
        });
    } catch (error) {
        console.error('[Registry Search] Error:', error);
        return NextResponse.json(
            { error: 'Error al buscar en el registro' },
            { status: 500 }
        );
    }
}
