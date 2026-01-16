/**
 * Customer Folder Export API Endpoint
 * ====================================
 * 
 * Phase 3: Task 3.4
 * 
 * POST /api/customers/[id]/folder/export
 * - Generates complete customer folder PDF
 * 
 * Query params:
 * - format: 'pdf' (default) or 'html' (for preview)
 * - includeJobs: 'true' (default) or 'false'
 * - includeInvoices: 'true' (default) or 'false'
 * - includePayments: 'true' (default) or 'false'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomerFolderData } from '@/lib/services/customer-folder';
import { generateCustomerFolderReport, generateCustomerReportHTML } from '@/lib/reports/customer-report';
import { prisma } from '@/lib/prisma';

export async function POST(
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
        const format = searchParams.get('format') || 'pdf';
        const includeJobs = searchParams.get('includeJobs') !== 'false';
        const includeInvoices = searchParams.get('includeInvoices') !== 'false';
        const includePayments = searchParams.get('includePayments') !== 'false';

        // For HTML preview (faster, no Puppeteer required)
        if (format === 'html') {
            const folderData = await getCustomerFolderData(customerId, organizationId);
            if (!folderData) {
                return NextResponse.json(
                    { error: 'Cliente no encontrado' },
                    { status: 404 }
                );
            }

            // Fetch organization for header
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: { name: true, phone: true, logo: true, afipCuit: true }
            });

            if (!org) {
                return NextResponse.json(
                    { error: 'Organización no encontrada' },
                    { status: 404 }
                );
            }

            const organization = {
                name: org.name,
                phone: org.phone,
                logo: org.logo,
                cuit: org.afipCuit
            };

            const html = generateCustomerReportHTML(folderData, organization, {
                includeJobs,
                includeInvoices,
                includePayments
            });

            return new NextResponse(html, {
                status: 200,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                },
            });
        }

        // Generate PDF report
        const { buffer, filename, contentType } = await generateCustomerFolderReport({
            customerId,
            organizationId,
            includeJobs,
            includeInvoices,
            includePayments,
        });

        // Create a Uint8Array from the buffer for NextResponse compatibility
        const uint8Array = new Uint8Array(buffer);

        // Return the PDF as a downloadable file
        return new NextResponse(uint8Array, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Error generating customer folder export:', error);

        if (error instanceof Error && error.message === 'Customer not found') {
            return NextResponse.json(
                { error: 'Cliente no encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { error: 'Error al generar el reporte', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// GET method for direct download links
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Redirect GET to POST for consistency
    return POST(request, { params });
}
