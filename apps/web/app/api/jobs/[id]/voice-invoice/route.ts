/**
 * Voice-to-Invoice API Endpoint
 * ==============================
 * 
 * Phase 6: Extracts invoice data from voice memo transcriptions
 * 
 * POST /api/jobs/[id]/voice-invoice
 * - Takes transcription or audio URL
 * - Returns matched line items for review
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

interface ExtractedLineItem {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    total: number | null;
    sourceType: 'part' | 'service' | 'custom';
    sourceText: string;
    matchedPriceItemId: string | null;
    matchedPriceItemName: string | null;
    matchConfidence: number;
    alternativeMatches: Array<{
        id: string;
        name: string;
        price: number;
    }>;
    needsReview: boolean;
    reviewReason: string | null;
}

interface InvoiceSuggestion {
    jobId: string;
    lineItems: ExtractedLineItem[];
    subtotal: number;
    taxAmount: number;
    total: number;
    extraction: {
        jobSummary: string | null;
        workPerformed: string | null;
        equipmentStatus: string | null;
        followUpRequired: boolean;
        recommendations: string | null;
    };
    transcription: string;
    processingTimeMs: number;
    requiresReview: boolean;
    reviewNotes: string[];
    overallMatchConfidence: number;
}

// =============================================================================
// VALIDATION
// =============================================================================

const requestSchema = z.object({
    transcription: z.string().min(10, 'La transcripción es muy corta'),
    serviceType: z.string().optional(),
    equipmentInfo: z.string().optional(),
});

// =============================================================================
// POST - Extract invoice data from voice report
// =============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authenticate
        const session = await getSession();
        if (!session?.userId || !session.organizationId) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id: jobId } = await params;

        // Verify job exists and belongs to organization
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            select: {
                id: true,
                serviceType: true,
                description: true,
                customer: { select: { name: true } },
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        // Parse request
        const body = await request.json();
        const validationResult = requestSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Datos inválidos',
                    details: validationResult.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const { transcription, serviceType, equipmentInfo } = validationResult.data;

        // Call AI service for extraction
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

        try {
            const aiResponse = await fetch(`${aiServiceUrl}/invoice/extract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-organization-id': session.organizationId,
                },
                body: JSON.stringify({
                    transcription,
                    organization_id: session.organizationId,
                    job_id: jobId,
                    service_type: serviceType || job.serviceType,
                    equipment_info: equipmentInfo || job.description,
                }),
            });

            if (!aiResponse.ok) {
                throw new Error(`AI service error: ${aiResponse.status}`);
            }

            const aiData = await aiResponse.json();

            if (!aiData.success) {
                return NextResponse.json(
                    { success: false, error: aiData.error || 'Error en la extracción' },
                    { status: 500 }
                );
            }

            // Transform the response for frontend
            const suggestion: InvoiceSuggestion = transformAISuggestion(aiData.suggestion, jobId);

            return NextResponse.json({
                success: true,
                suggestion,
                job: {
                    id: job.id,
                    serviceType: job.serviceType,
                    description: job.description,
                    customerName: job.customer?.name,
                },
            });
        } catch (aiError) {
            console.error('AI service error:', aiError);

            // Fallback: return basic extraction without AI
            return NextResponse.json({
                success: true,
                suggestion: createFallbackSuggestion(jobId, transcription),
                job: {
                    id: job.id,
                    serviceType: job.serviceType,
                    description: job.description,
                    customerName: job.customer?.name,
                },
                warning: 'Servicio AI no disponible, extracción básica aplicada',
            });
        }
    } catch (error) {
        console.error('Voice-invoice error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al procesar el reporte de voz' },
            { status: 500 }
        );
    }
}

// =============================================================================
// HELPERS
// =============================================================================

function transformAISuggestion(aiSuggestion: Record<string, unknown>, jobId: string): InvoiceSuggestion {
    const lineItems = (aiSuggestion.line_items as Array<Record<string, unknown>> || []).map(item => ({
        description: String(item.description || ''),
        quantity: Number(item.quantity || 1),
        unit: String(item.unit || 'unidad'),
        unitPrice: item.unit_price ? Number(item.unit_price) : null,
        total: item.total ? Number(item.total) : null,
        sourceType: String(item.source_type || 'custom') as 'part' | 'service' | 'custom',
        sourceText: String(item.source_text || ''),
        matchedPriceItemId: item.matched_price_item_id ? String(item.matched_price_item_id) : null,
        matchedPriceItemName: item.matched_price_item_name ? String(item.matched_price_item_name) : null,
        matchConfidence: Number(item.match_confidence || 0),
        alternativeMatches: (item.alternative_matches as Array<Record<string, unknown>> || []).map(alt => ({
            id: String(alt.id || ''),
            name: String(alt.name || ''),
            price: Number(alt.price || 0),
        })),
        needsReview: Boolean(item.needs_review),
        reviewReason: item.review_reason ? String(item.review_reason) : null,
    }));

    const extraction = aiSuggestion.extraction as Record<string, unknown> || {};

    return {
        jobId,
        lineItems,
        subtotal: Number(aiSuggestion.subtotal || 0),
        taxAmount: Number(aiSuggestion.tax_amount || 0),
        total: Number(aiSuggestion.total || 0),
        extraction: {
            jobSummary: extraction.job_summary ? String(extraction.job_summary) : null,
            workPerformed: extraction.work_performed ? String(extraction.work_performed) : null,
            equipmentStatus: extraction.equipment_status ? String(extraction.equipment_status) : null,
            followUpRequired: Boolean(extraction.follow_up_required),
            recommendations: extraction.recommendations ? String(extraction.recommendations) : null,
        },
        transcription: String(aiSuggestion.transcription || ''),
        processingTimeMs: Number(aiSuggestion.processing_duration_ms || 0),
        requiresReview: Boolean(aiSuggestion.requires_review),
        reviewNotes: (aiSuggestion.review_notes as string[]) || [],
        overallMatchConfidence: Number(aiSuggestion.overall_match_confidence || 0),
    };
}

function createFallbackSuggestion(jobId: string, transcription: string): InvoiceSuggestion {
    // Basic fallback - create a single custom line item with the transcription
    return {
        jobId,
        lineItems: [{
            description: 'Servicio técnico (revisar detalles)',
            quantity: 1,
            unit: 'servicio',
            unitPrice: null,
            total: null,
            sourceType: 'custom',
            sourceText: transcription,
            matchedPriceItemId: null,
            matchedPriceItemName: null,
            matchConfidence: 0,
            alternativeMatches: [],
            needsReview: true,
            reviewReason: 'Extracción automática no disponible - revisar manualmente',
        }],
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        extraction: {
            jobSummary: transcription.slice(0, 200),
            workPerformed: transcription,
            equipmentStatus: null,
            followUpRequired: false,
            recommendations: null,
        },
        transcription,
        processingTimeMs: 0,
        requiresReview: true,
        reviewNotes: ['Servicio AI no disponible - revisar todos los items manualmente'],
        overallMatchConfidence: 0,
    };
}
