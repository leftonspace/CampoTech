/**
 * Export Download API
 * ====================
 * 
 * Phase 3.4: Secure download endpoint for async exports
 * 
 * GET /api/exports/[token]/download
 * - Downloads the exported file using a secure token
 * - Rate limited and tracks download count
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExportByToken } from '@/lib/services/async-export';
import { generateCustomerFolderReport } from '@/lib/reports/customer-report';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // Get export by token
        const result = await getExportByToken(token);

        if ('error' in result) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: result.status || 400 }
            );
        }

        const { exportRequest } = result;

        // Check status
        if (exportRequest.status !== 'COMPLETED') {
            return NextResponse.json(
                { success: false, error: 'Export not ready yet' },
                { status: 400 }
            );
        }

        // Regenerate the file (in production, this would be fetched from storage)
        const options = exportRequest.options as { includeJobs?: boolean; includeInvoices?: boolean; includePayments?: boolean };

        const { buffer, filename, contentType } = await generateCustomerFolderReport({
            customerId: exportRequest.targetId,
            organizationId: exportRequest.organizationId,
            includeJobs: options.includeJobs !== false,
            includeInvoices: options.includeInvoices !== false,
            includePayments: options.includePayments !== false,
        });

        // Return the file
        const uint8Array = new Uint8Array(buffer);

        return new NextResponse(uint8Array, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error) {
        console.error('Error downloading export:', error);
        return NextResponse.json(
            { success: false, error: 'Error al descargar el archivo' },
            { status: 500 }
        );
    }
}
