/**
 * Global Search API
 * 
 * Searches across multiple entities (jobs, customers, team members, invoices)
 * with PostgreSQL full-text search for performance.
 * 
 * Returns grouped results by category with limited items per category.
 * Supports accent-insensitive search for Argentine names (Pérez, González, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { normalizeForSearch } from '@/lib/text.utils';

// Maximum results per category
const MAX_PER_CATEGORY = 5;
// Maximum records to fetch for client-side filtering (must be large enough for datasets)
const MAX_FETCH_FOR_FILTER = 500;

// Entity configuration for search
const SEARCH_ENTITIES = {
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
} as const;

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.trim() || '';
        const category = searchParams.get('category') || 'all'; // 'all', 'jobs', 'customers', etc.

        if (query.length < 2) {
            return NextResponse.json({
                success: true,
                data: { results: [], query, totalCount: 0 },
            });
        }

        const orgId = session.organizationId;
        const _searchTerm = `%${query}%`;
        const normalizedQuery = normalizeForSearch(query);

        const results: {
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
        }[] = [];

        // Search Jobs (with accent-insensitive support for customer names)
        if (category === 'all' || category === 'jobs') {
            // Fetch more results for client-side accent-insensitive filtering
            const allJobs = await prisma.job.findMany({
                where: {
                    organizationId: orgId,
                },
                include: {
                    customer: { select: { name: true } },
                },
                take: MAX_FETCH_FOR_FILTER,
                orderBy: { createdAt: 'desc' },
            });
            type JobResult = typeof allJobs[0];

            // Filter using accent-insensitive matching
            const jobs = allJobs.filter((job: JobResult) => {
                const searchableTexts = [
                    job.jobNumber,
                    job.description || '',
                    job.serviceTypeCode || '',
                    job.customer?.name || '',
                ];
                return searchableTexts.some(text =>
                    text && normalizeForSearch(text).includes(normalizedQuery)
                );
            }).slice(0, MAX_PER_CATEGORY);

            if (jobs.length > 0) {
                results.push({
                    category: 'jobs',
                    ...SEARCH_ENTITIES.jobs,
                    items: jobs.map((job: JobResult) => ({
                        id: job.id,
                        title: job.description || 'Sin descripción',
                        subtitle: `${job.jobNumber} • ${job.customer?.name || 'Sin cliente'}`,
                        badge: job.status,
                        badgeColor: getJobStatusColor(job.status),
                    })),
                });
            }
        }

        // Search Customers (with accent-insensitive support)
        if (category === 'all' || category === 'customers') {
            // Fetch more results to allow for accent-insensitive filtering
            const allCustomers = await prisma.customer.findMany({
                where: {
                    organizationId: orgId,
                },
                take: MAX_FETCH_FOR_FILTER, // Fetch all to support accent-insensitive filtering
                orderBy: { name: 'asc' },
            });
            type CustomerResult = typeof allCustomers[0];

            // Filter using accent-insensitive matching
            const customers = allCustomers.filter((customer: CustomerResult) => {
                const searchableTexts = [customer.name, customer.email || '', customer.phone || ''];
                return searchableTexts.some(text =>
                    text && normalizeForSearch(text).includes(normalizedQuery)
                );
            }).slice(0, MAX_PER_CATEGORY);

            if (customers.length > 0) {
                results.push({
                    category: 'customers',
                    ...SEARCH_ENTITIES.customers,
                    items: customers.map((customer: CustomerResult) => ({
                        id: customer.id,
                        title: customer.name,
                        subtitle: customer.email || customer.phone || (typeof customer.address === 'string' ? customer.address : '') || '',
                    })),
                });
            }
        }

        // Search Team Members (with accent-insensitive support)
        if (category === 'all' || category === 'team') {
            const allMembers = await prisma.user.findMany({
                where: {
                    organizationId: orgId,
                },
                take: MAX_FETCH_FOR_FILTER,
                orderBy: { name: 'asc' },
            });
            type MemberResult = typeof allMembers[0];

            // Filter using accent-insensitive matching
            const members = allMembers.filter((member: MemberResult) => {
                const searchableTexts = [member.name || '', member.email || ''];
                return searchableTexts.some(text =>
                    text && normalizeForSearch(text).includes(normalizedQuery)
                );
            }).slice(0, MAX_PER_CATEGORY);

            if (members.length > 0) {
                results.push({
                    category: 'team',
                    ...SEARCH_ENTITIES.team,
                    items: members.map((member: MemberResult) => ({
                        id: member.id,
                        title: member.name || 'Sin nombre',
                        subtitle: member.email || '',
                        badge: member.role,
                        badgeColor: getRoleColor(member.role),
                    })),
                });
            }
        }

        // Search Vehicles (with accent-insensitive support)
        if (category === 'all' || category === 'vehicles') {
            const allVehicles = await prisma.vehicle.findMany({
                where: {
                    organizationId: orgId,
                },
                take: MAX_FETCH_FOR_FILTER,
                orderBy: { plateNumber: 'asc' },
            });
            type VehicleResult = typeof allVehicles[0];

            // Filter using accent-insensitive matching
            const vehicles = allVehicles.filter((vehicle: VehicleResult) => {
                const searchableTexts = [
                    vehicle.plateNumber,
                    vehicle.make,
                    vehicle.model,
                    vehicle.color || '',
                ];
                return searchableTexts.some(text =>
                    text && normalizeForSearch(text).includes(normalizedQuery)
                );
            }).slice(0, MAX_PER_CATEGORY);

            if (vehicles.length > 0) {
                results.push({
                    category: 'vehicles',
                    ...SEARCH_ENTITIES.vehicles,
                    items: vehicles.map((vehicle: VehicleResult) => ({
                        id: vehicle.id,
                        title: `${vehicle.make} ${vehicle.model}`,
                        subtitle: `${vehicle.plateNumber} • ${vehicle.year}`,
                        badge: vehicle.status,
                        badgeColor: getVehicleStatusColor(vehicle.status),
                    })),
                });
            }
        }

        // Search Inventory (with accent-insensitive support)
        if (category === 'all' || category === 'inventory') {
            const allItems = await prisma.inventoryItem.findMany({
                where: {
                    organizationId: orgId,
                    isActive: true,
                },
                take: MAX_FETCH_FOR_FILTER,
                orderBy: { name: 'asc' },
            });
            type InventoryResult = typeof allItems[0];

            // Filter using accent-insensitive matching
            const items = allItems.filter((item: InventoryResult) => {
                const searchableTexts = [
                    item.name,
                    item.sku,
                    item.description || '',
                ];
                return searchableTexts.some(text =>
                    text && normalizeForSearch(text).includes(normalizedQuery)
                );
            }).slice(0, MAX_PER_CATEGORY);

            if (items.length > 0) {
                results.push({
                    category: 'inventory',
                    ...SEARCH_ENTITIES.inventory,
                    items: items.map((item: InventoryResult) => ({
                        id: item.id,
                        title: item.name,
                        subtitle: `SKU: ${item.sku} • ${item.category}`,
                        badge: item.category,
                        badgeColor: getInventoryCategoryColor(item.category),
                    })),
                });
            }
        }

        // Search Invoices (with accent-insensitive support)
        if (category === 'all' || category === 'invoices') {
            const allInvoices = await prisma.invoice.findMany({
                where: {
                    organizationId: orgId,
                },
                include: {
                    customer: { select: { name: true } },
                },
                take: MAX_FETCH_FOR_FILTER,
                orderBy: { createdAt: 'desc' },
            });
            type InvoiceResult = typeof allInvoices[0];

            // Filter using accent-insensitive matching
            const invoices = allInvoices.filter((invoice: InvoiceResult) => {
                const searchableTexts = [
                    invoice.invoiceNumber || '',
                    invoice.customer?.name || '',
                ];
                return searchableTexts.some(text =>
                    text && normalizeForSearch(text).includes(normalizedQuery)
                );
            }).slice(0, MAX_PER_CATEGORY);

            if (invoices.length > 0) {
                results.push({
                    category: 'invoices',
                    ...SEARCH_ENTITIES.invoices,
                    items: invoices.map((invoice: InvoiceResult) => ({
                        id: invoice.id,
                        title: invoice.invoiceNumber || 'Sin número',
                        subtitle: invoice.customer?.name || 'Sin cliente',
                        badge: invoice.status,
                        badgeColor: getInvoiceStatusColor(invoice.status),
                    })),
                });
            }
        }

        // Search Payments (with accent-insensitive support)
        if (category === 'all' || category === 'payments') {
            const allPayments = await prisma.payment.findMany({
                where: {
                    organizationId: orgId,
                },
                include: {
                    invoice: {
                        select: {
                            invoiceNumber: true,
                            customer: { select: { name: true } },
                        },
                    },
                },
                take: MAX_FETCH_FOR_FILTER,
                orderBy: { createdAt: 'desc' },
            });
            type PaymentResult = typeof allPayments[0];

            // Filter using accent-insensitive matching
            const payments = allPayments.filter((payment: PaymentResult) => {
                const searchableTexts = [
                    payment.invoice?.invoiceNumber || '',
                    payment.invoice?.customer?.name || '',
                    payment.reference || '',
                ];
                return searchableTexts.some(text =>
                    text && normalizeForSearch(text).includes(normalizedQuery)
                );
            }).slice(0, MAX_PER_CATEGORY);

            if (payments.length > 0) {
                results.push({
                    category: 'payments',
                    ...SEARCH_ENTITIES.payments,
                    items: payments.map((payment: PaymentResult) => ({
                        id: payment.id,
                        title: `$${payment.amount.toString()}`,
                        subtitle: `${payment.invoice?.invoiceNumber || 'Sin factura'} • ${payment.invoice?.customer?.name || ''}`,
                        badge: payment.status,
                        badgeColor: getPaymentStatusColor(payment.status),
                    })),
                });
            }
        }

        const totalCount = results.reduce((sum, cat) => sum + cat.items.length, 0);

        return NextResponse.json({
            success: true,
            data: {
                results,
                query,
                totalCount,
                entities: SEARCH_ENTITIES,
            },
        });
    } catch (error) {
        console.error('[Search API] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Search failed' },
            { status: 500 }
        );
    }
}

// Helper functions for badge colors
function getJobStatusColor(status: string): string {
    const colors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-700',
        SCHEDULED: 'bg-blue-100 text-blue-700',
        IN_PROGRESS: 'bg-purple-100 text-purple-700',
        COMPLETED: 'bg-green-100 text-green-700',
        CANCELLED: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
}

function getRoleColor(role: string): string {
    const colors: Record<string, string> = {
        OWNER: 'bg-purple-100 text-purple-700',
        ADMIN: 'bg-blue-100 text-blue-700',
        TECHNICIAN: 'bg-green-100 text-green-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
}

function getInvoiceStatusColor(status: string): string {
    const colors: Record<string, string> = {
        DRAFT: 'bg-gray-100 text-gray-700',
        SENT: 'bg-blue-100 text-blue-700',
        PAID: 'bg-green-100 text-green-700',
        OVERDUE: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
}

function getVehicleStatusColor(status: string): string {
    const colors: Record<string, string> = {
        ACTIVE: 'bg-green-100 text-green-700',
        INACTIVE: 'bg-gray-100 text-gray-700',
        MAINTENANCE: 'bg-yellow-100 text-yellow-700',
        OUT_OF_SERVICE: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
}

function getInventoryCategoryColor(category: string): string {
    const colors: Record<string, string> = {
        PARTS: 'bg-blue-100 text-blue-700',
        TOOLS: 'bg-purple-100 text-purple-700',
        SUPPLIES: 'bg-green-100 text-green-700',
        EQUIPMENT: 'bg-orange-100 text-orange-700',
        CONSUMABLES: 'bg-teal-100 text-teal-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
}

function getPaymentStatusColor(status: string): string {
    const colors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-700',
        COMPLETED: 'bg-green-100 text-green-700',
        FAILED: 'bg-red-100 text-red-700',
        REFUNDED: 'bg-purple-100 text-purple-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
}
