/**
 * Optimized Global Search API v2
 * 
 * Uses v_global_search view for unified cross-entity search
 * Phase 3: Query Optimization (Feb 2026)
 * 
 * Performance: Single query vs 7 separate queries in v1
 * Supports AI Copilot natural language search
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { JobService, GlobalSearchResult } from '@/src/services/job.service';

// Entity configuration for search UI (matches v1 for compatibility)
const SEARCH_ENTITIES: Record<string, {
    label: string;
    path: string;
    queryParam: string;
    openParam: string;
}> = {
    jobs: {
        label: 'Trabajos',
        path: '/dashboard/jobs',
        queryParam: 'search',
        openParam: 'job',
    },
    customers: {
        label: 'Clientes',
        path: '/dashboard/customers',
        queryParam: 'search',
        openParam: 'customer',
    },
    team: {
        label: 'Equipo',
        path: '/dashboard/team',
        queryParam: 'search',
        openParam: 'member',
    },
    vehicles: {
        label: 'Vehículos',
        path: '/dashboard/fleet',
        queryParam: 'search',
        openParam: 'vehicle',
    },
    inventory: {
        label: 'Inventario',
        path: '/dashboard/inventory',
        queryParam: 'search',
        openParam: 'item',
    },
    invoices: {
        label: 'Facturas',
        path: '/dashboard/invoices',
        queryParam: 'search',
        openParam: 'invoice',
    },
    payments: {
        label: 'Pagos',
        path: '/dashboard/payments',
        queryParam: 'search',
        openParam: 'payment',
    },
};

// Status badge colors (reused from v1)
const STATUS_COLORS: Record<string, string> = {
    // Job statuses
    'PENDING': 'yellow',
    'ASSIGNED': 'blue',
    'SCHEDULED': 'indigo',
    'IN_PROGRESS': 'orange',
    'COMPLETED': 'green',
    'CANCELLED': 'gray',
    // Invoice statuses
    'DRAFT': 'gray',
    'SENT': 'blue',
    'PAID': 'green',
    'OVERDUE': 'red',
    'PARTIAL': 'yellow',
    // Payment statuses
    'APPROVED': 'green',
    'REJECTED': 'red',
    // Vehicle statuses
    'ACTIVE': 'green',
    'MAINTENANCE': 'yellow',
    'INACTIVE': 'gray',
    // User roles
    'OWNER': 'purple',
    'ADMIN': 'blue',
    'TECHNICIAN': 'green',
    // Inventory categories
    'PARTS': 'blue',
    'CONSUMABLES': 'green',
    'EQUIPMENT': 'purple',
    'TOOLS': 'orange',
    // Special badges
    'VIP': 'purple',
};

// Maximum results per category for grouped display
const MAX_PER_CATEGORY = 5;

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.trim() || '';
        const category = searchParams.get('category') || 'all';
        const limit = parseInt(searchParams.get('limit') || '35');

        if (query.length < 2) {
            return NextResponse.json({
                success: true,
                data: { results: [], query, totalCount: 0 },
                _optimized: true,
            });
        }

        // Use optimized view-based search
        const searchResults = await JobService.globalSearch(
            session.organizationId,
            query,
            {
                entityType: category !== 'all' ? category : undefined,
                limit,
            }
        );

        // Group results by entity type (matching v1 format)
        const groupedResults = groupResultsByEntity(searchResults);

        // Calculate total count
        const totalCount = searchResults.length;

        return NextResponse.json({
            success: true,
            data: {
                results: groupedResults,
                query,
                totalCount,
            },
            _optimized: true, // Flag to indicate v2 optimized response
        });
    } catch (error) {
        console.error('Global search v2 error:', error);
        return NextResponse.json(
            { success: false, error: 'Error performing search' },
            { status: 500 }
        );
    }
}

/**
 * Groups flat search results into categories for UI display
 * Matches v1 response format for backward compatibility
 */
function groupResultsByEntity(results: GlobalSearchResult[]) {
    const grouped: Record<string, {
        category: string;
        label: string;
        path: string;
        queryParam: string;
        openParam: string;
        items: Array<{
            id: string;
            title: string;
            subtitle: string;
            badge?: string;
            badgeColor?: string;
        }>;
    }> = {};

    for (const result of results) {
        const entityType = result.entity_type;
        const entityConfig = SEARCH_ENTITIES[entityType];

        if (!entityConfig) continue;

        // Initialize category if not exists
        if (!grouped[entityType]) {
            grouped[entityType] = {
                category: entityType,
                label: entityConfig.label,
                path: entityConfig.path,
                queryParam: entityConfig.queryParam,
                openParam: entityConfig.openParam,
                items: [],
            };
        }

        // Limit items per category
        if (grouped[entityType].items.length >= MAX_PER_CATEGORY) continue;

        // Add item to category
        grouped[entityType].items.push({
            id: result.id,
            title: result.title || '',
            subtitle: result.subtitle || '',
            badge: result.badge || undefined,
            badgeColor: result.badge ? (STATUS_COLORS[result.badge] || 'gray') : undefined,
        });
    }

    // Return as array, ordered by entity priority
    const order = ['jobs', 'customers', 'team', 'vehicles', 'inventory', 'invoices', 'payments'];
    return order
        .filter(key => grouped[key]?.items.length > 0)
        .map(key => grouped[key]);
}
