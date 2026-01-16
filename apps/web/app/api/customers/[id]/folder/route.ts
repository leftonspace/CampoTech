/**
 * Customer Folder API Endpoint
 * ============================
 * 
 * Phase 3: Task 3.2
 * 
 * GET /api/customers/[id]/folder
 * - Returns complete customer folder data including summary, jobs, invoices, payments
 * 
 * Query params:
 * - include: comma-separated list of sections to include (jobs,invoices,payments,whatsapp)
 *            Default: all sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerFolderData, getCustomerWhatsAppHistory } from '@/lib/services/customer-folder';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authenticate
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id: customerId } = await params;
        const organizationId = session.organizationId;

        // Parse query params
        const searchParams = request.nextUrl.searchParams;
        const includeParam = searchParams.get('include');
        const includeWhatsApp = searchParams.get('includeWhatsApp') === 'true';

        // Pagination for WhatsApp
        const whatsappLimit = parseInt(searchParams.get('whatsappLimit') || '50', 10);
        const whatsappOffset = parseInt(searchParams.get('whatsappOffset') || '0', 10);

        // Determine which sections to include
        const includeSections = includeParam
            ? includeParam.split(',').map(s => s.trim().toLowerCase())
            : ['jobs', 'invoices', 'payments'];

        // Fetch main folder data
        const folderData = await getCustomerFolderData(customerId, organizationId);

        if (!folderData) {
            return NextResponse.json(
                { error: 'Cliente no encontrado' },
                { status: 404 }
            );
        }

        // Build response based on requested sections
        const response: Record<string, unknown> = {
            customer: folderData.customer,
            summary: folderData.summary,
        };

        if (includeSections.includes('jobs')) {
            response.jobs = folderData.jobs;
        }

        if (includeSections.includes('invoices')) {
            response.invoices = folderData.invoices;
        }

        if (includeSections.includes('payments')) {
            response.payments = folderData.payments;
        }

        // Optionally include WhatsApp history
        if (includeWhatsApp || includeSections.includes('whatsapp')) {
            const whatsappData = await getCustomerWhatsAppHistory(
                customerId,
                organizationId,
                { limit: whatsappLimit, offset: whatsappOffset }
            );
            response.whatsapp = whatsappData;
        }

        return NextResponse.json({ data: response });
    } catch (error) {
        console.error('Error fetching customer folder:', error);
        return NextResponse.json(
            { error: 'Error al obtener la carpeta del cliente', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
