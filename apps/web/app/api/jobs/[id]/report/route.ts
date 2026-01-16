/**
 * Job Completion Report API Endpoint
 * ===================================
 * 
 * Phase 2: Task 2.2
 * 
 * GET /api/jobs/[id]/report
 * - Generates and downloads the job completion report PDF
 * 
 * POST /api/jobs/[id]/report/send
 * - Sends the report to the customer via email (future)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateJobCompletionReport, fetchJobReportData, generateReportHTML } from '@/lib/reports/job-completion-report';

// =============================================================================
// GET: Generate and download report
// =============================================================================

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

        const { id: jobId } = await params;
        const organizationId = session.organizationId;

        // Parse query params
        const searchParams = request.nextUrl.searchParams;
        const format = searchParams.get('format') || 'pdf'; // 'pdf' or 'html'
        const includePhotos = searchParams.get('includePhotos') !== 'false';
        const includeSignature = searchParams.get('includeSignature') !== 'false';

        // For HTML preview (faster, no Puppeteer required)
        if (format === 'html') {
            const data = await fetchJobReportData(jobId, organizationId);
            if (!data) {
                return NextResponse.json(
                    { error: 'Trabajo no encontrado' },
                    { status: 404 }
                );
            }

            const html = generateReportHTML(data, { includePhotos, includeSignature });
            return new NextResponse(html, {
                status: 200,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                },
            });
        }

        // Generate PDF report
        const { buffer, filename, contentType } = await generateJobCompletionReport({
            jobId,
            organizationId,
            includePhotos,
            includeSignature,
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
        console.error('Error generating job report:', error);

        if (error instanceof Error && error.message === 'Job not found') {
            return NextResponse.json(
                { error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { error: 'Error al generar el reporte', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
