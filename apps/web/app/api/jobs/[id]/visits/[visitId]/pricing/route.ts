/**
 * Visit Pricing Update API
 * 
 * PUT /api/jobs/[id]/visits/[visitId]/pricing
 * Updates pricing for a specific visit
 * 
 * Phase 1 - January 2026
 * Phase 6 - Compliance validation integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validatePriceVariance } from '@/lib/services/pricing-calculator';
import {
    createPricingAuditEntry,
    hasBlockingViolations,
    validateJobModification,
    type JobComplianceData,
} from '@/lib/services/pricing-compliance';

interface PricingUpdatePayload {
    estimatedPrice?: number;
    actualPrice?: number;
    techProposedPrice?: number;
    priceVarianceReason?: string;
    requiresDeposit?: boolean;
    depositAmount?: number;
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; visitId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id: jobId, visitId } = await params;
        const body: PricingUpdatePayload = await request.json();
        const {
            estimatedPrice,
            actualPrice,
            techProposedPrice,
            priceVarianceReason,
            requiresDeposit,
            depositAmount,
        } = body;

        // Verify job belongs to organization
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            include: {
                organization: {
                    include: {
                        pricingSettings: true,
                    },
                },
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Job not found' },
                { status: 404 }
            );
        }

        // Verify visit exists and belongs to the job
        const visit = await prisma.jobVisit.findFirst({
            where: {
                id: visitId,
                jobId: jobId,
            },
        });

        if (!visit) {
            return NextResponse.json(
                { success: false, error: 'Visit not found' },
                { status: 404 }
            );
        }

        // Phase 6: Use compliance service for job modification validation
        const complianceData: JobComplianceData = {
            id: job.id,
            pricingMode: (job.pricingMode as 'FIXED_TOTAL' | 'PER_VISIT' | 'HYBRID') || 'FIXED_TOTAL',
            status: job.status,
            estimatedTotal: job.estimatedTotal,
            finalTotal: job.finalTotal,
            invoiceId: job.invoiceId,
            visits: [], // Not needed for this check
        };

        const modificationResult = validateJobModification(complianceData);
        if (hasBlockingViolations(modificationResult)) {
            // Log the compliance violation
            console.warn('Pricing compliance violation:', createPricingAuditEntry(
                'price_update',
                jobId,
                session.userId,
                { complianceResult: modificationResult }
            ));

            return NextResponse.json(
                {
                    success: false,
                    error: modificationResult.violations[0]?.message || 'No se puede modificar este trabajo',
                    complianceViolations: modificationResult.violations,
                },
                { status: 403 }
            );
        }

        // Validate pricing limits if technician is updating
        if (session.role === 'TECHNICIAN' && techProposedPrice !== undefined) {
            const settings = job.organization?.pricingSettings;

            // Check if technician can modify pricing
            if (settings && !settings.techCanModifyPricing) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Los técnicos no pueden modificar precios',
                    },
                    { status: 403 }
                );
            }

            // Validate variance if estimated price exists
            if (visit.estimatedPrice) {
                const maxVariance = settings?.techMaxAdjustmentPercent
                    ? Number(settings.techMaxAdjustmentPercent)
                    : 10; // Default to 10% per Argentine consumer law

                const validation = validatePriceVariance(
                    visit.estimatedPrice,
                    techProposedPrice,
                    maxVariance
                );

                if (!validation.valid && validation.requiresApproval) {
                    // Store proposed price but don't apply as actual
                    const updated = await prisma.jobVisit.update({
                        where: { id: visitId },
                        data: {
                            techProposedPrice,
                            priceVarianceReason: priceVarianceReason || null,
                        },
                    });

                    return NextResponse.json({
                        success: true,
                        requiresApproval: true,
                        proposedPrice: techProposedPrice,
                        variancePercent: validation.variancePercent,
                        message: validation.message,
                        visit: updated,
                    });
                }
            }
        }

        // Build update data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {};

        // Only dispatchers/owners can update estimated price
        if (estimatedPrice !== undefined && session.role !== 'TECHNICIAN') {
            updateData.estimatedPrice = estimatedPrice;
        }

        // Actual price can be set by technicians (subject to limits above)
        if (actualPrice !== undefined) {
            updateData.actualPrice = actualPrice;
        }

        // Tech proposed price
        if (techProposedPrice !== undefined) {
            updateData.techProposedPrice = techProposedPrice;
        }

        // Variance reason
        if (priceVarianceReason !== undefined) {
            updateData.priceVarianceReason = priceVarianceReason;
        }

        // Deposit fields (dispatcher only)
        if (session.role !== 'TECHNICIAN') {
            if (requiresDeposit !== undefined) {
                updateData.requiresDeposit = requiresDeposit;
            }
            if (depositAmount !== undefined) {
                updateData.depositAmount = depositAmount;
            }
        }

        // Update visit pricing
        const updated = await prisma.jobVisit.update({
            where: { id: visitId },
            data: updateData,
        });

        // Recalculate job total if in per-visit mode
        if (job.pricingMode !== 'FIXED_TOTAL') {
            await recalculateJobTotal(jobId, job.pricingMode);
        }

        return NextResponse.json({
            success: true,
            visit: updated,
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('Visit pricing update error:', err.message);
        return NextResponse.json(
            { success: false, error: err.message || 'Error updating visit pricing' },
            { status: 500 }
        );
    }
}

/**
 * Recalculate job total based on visit prices
 */
async function recalculateJobTotal(jobId: string, pricingMode: string) {
    // Get all visits for this job
    const visits = await prisma.jobVisit.findMany({
        where: { jobId },
        orderBy: { visitNumber: 'asc' },
    });

    // Get the job for default rate
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { defaultVisitRate: true },
    });

    let total = 0;

    visits.forEach((visit: typeof visits[number], index: number) => {
        // Use actual price if available, otherwise estimated
        let visitPrice = Number(visit.actualPrice || visit.estimatedPrice || 0);

        // For HYBRID mode, use default rate for non-first visits without specific price
        if (pricingMode === 'HYBRID' && index > 0) {
            if (!visit.estimatedPrice && !visit.actualPrice && job?.defaultVisitRate) {
                visitPrice = Number(job.defaultVisitRate);
            }
        }

        // For PER_VISIT mode, always use default rate if no specific price
        if (pricingMode === 'PER_VISIT') {
            if (!visit.estimatedPrice && !visit.actualPrice && job?.defaultVisitRate) {
                visitPrice = Number(job.defaultVisitRate);
            }
        }

        total += visitPrice;
    });

    // Update job estimated total
    await prisma.job.update({
        where: { id: jobId },
        data: { estimatedTotal: total },
    });
}

/**
 * GET /api/jobs/[id]/visits/[visitId]/pricing
 * Get pricing details for a specific visit
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; visitId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id: jobId, visitId } = await params;

        // Verify job belongs to organization
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            select: {
                id: true,
                pricingMode: true,
                defaultVisitRate: true,
                pricingLockedAt: true,
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Job not found' },
                { status: 404 }
            );
        }

        // Get visit with pricing info
        const visit = await prisma.jobVisit.findFirst({
            where: {
                id: visitId,
                jobId: jobId,
            },
            select: {
                id: true,
                visitNumber: true,
                scheduledDate: true,
                status: true,
                estimatedPrice: true,
                actualPrice: true,
                techProposedPrice: true,
                priceVarianceReason: true,
                requiresDeposit: true,
                depositAmount: true,
                depositPaidAt: true,
            },
        });

        if (!visit) {
            return NextResponse.json(
                { success: false, error: 'Visit not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            pricingMode: job.pricingMode,
            defaultVisitRate: job.defaultVisitRate,
            isLocked: !!job.pricingLockedAt,
            visit,
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('Visit pricing fetch error:', err.message);
        return NextResponse.json(
            { success: false, error: err.message || 'Error fetching visit pricing' },
            { status: 500 }
        );
    }
}
