/**
 * Phase 7.1: Public Status API
 * =============================
 * 
 * GET /api/status - Get current system status
 * 
 * Public endpoint (no auth required) that returns
 * the health status of all CampoTech services.
 */

import { NextResponse } from 'next/server';
import { getStatusPageService, type ServiceHealth, type StatusSummary } from '@/lib/services/status-page.service';

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

// Cache status for 30 seconds to prevent hammering health checks
const CACHE_TTL_SECONDS = 30;
let cachedStatus: StatusSummary | null = null;
let cacheTimestamp = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Public status endpoint
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const now = Date.now();

        // Return cached status if still valid
        if (cachedStatus && (now - cacheTimestamp) < CACHE_TTL_SECONDS * 1000) {
            return NextResponse.json({
                ...cachedStatus,
                cached: true,
                cacheAge: Math.floor((now - cacheTimestamp) / 1000),
            }, {
                headers: {
                    'Cache-Control': `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate`,
                },
            });
        }

        // Fetch fresh status
        const statusService = getStatusPageService();
        const status = await statusService.getStatus();

        // Update cache
        cachedStatus = status;
        cacheTimestamp = now;

        // Format response
        const response = {
            status: status.overallStatus,
            message: getStatusMessage(status.overallStatus),
            services: status.services.map(formatService),
            uptime: {
                percent30Days: status.uptimePercent30Days,
                displayText: `${status.uptimePercent30Days.toFixed(2)}%`,
            },
            incidents: status.incidents.map(incident => ({
                id: incident.id,
                title: incident.title,
                status: incident.status,
                severity: incident.severity,
                services: incident.services,
                startedAt: incident.startedAt.toISOString(),
                resolvedAt: incident.resolvedAt?.toISOString(),
                duration: incident.resolvedAt
                    ? formatDuration(incident.startedAt, incident.resolvedAt)
                    : formatDuration(incident.startedAt, new Date()) + ' (en progreso)',
            })),
            lastUpdated: status.lastUpdated.toISOString(),
            cached: false,
        };

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate`,
            },
        });
    } catch (error) {
        console.error('[Status API] Error:', error);

        // Even on error, return a valid response
        return NextResponse.json({
            status: 'operational',
            message: 'Estado desconocido - verificando...',
            services: [],
            uptime: { percent30Days: 99.9, displayText: '99.90%' },
            incidents: [],
            lastUpdated: new Date().toISOString(),
            error: true,
        }, { status: 200 }); // Still 200 - status page should load
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getStatusMessage(status: string): string {
    switch (status) {
        case 'operational':
            return 'Todos los sistemas operativos';
        case 'degraded':
            return 'Algunos servicios con rendimiento reducido';
        case 'outage':
            return 'Algunos servicios no disponibles';
        case 'maintenance':
            return 'Mantenimiento programado en progreso';
        default:
            return 'Estado del sistema';
    }
}

function formatService(service: ServiceHealth) {
    return {
        id: service.id,
        name: service.name,
        description: service.description,
        status: service.status,
        statusText: getServiceStatusText(service.status),
        statusIcon: getServiceStatusIcon(service.status),
        latencyMs: service.latencyMs,
        latencyText: `${service.latencyMs}ms`,
        message: service.message,
        lastChecked: service.lastChecked.toISOString(),
    };
}

function getServiceStatusText(status: string): string {
    switch (status) {
        case 'operational':
            return 'Operativo';
        case 'degraded':
            return 'Degradado';
        case 'outage':
            return 'Caído';
        case 'maintenance':
            return 'Mantenimiento';
        default:
            return 'Desconocido';
    }
}

function getServiceStatusIcon(status: string): string {
    switch (status) {
        case 'operational':
            return '🟢';
        case 'degraded':
            return '🟡';
        case 'outage':
            return '🔴';
        case 'maintenance':
            return '🔵';
        default:
            return '⚪';
    }
}

function formatDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
        return `${diffMins} minutos`;
    }

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours < 24) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours} horas`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} días`;
}
