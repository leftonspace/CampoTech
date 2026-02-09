/**
 * Job Payment Link API Route
 * ===========================
 * 
 * POST /api/jobs/[id]/payment-link
 * 
 * Generates a MercadoPago payment link (Preferencia) for a job.
 * The link allows customers to pay directly to the business's MP account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    createPaymentWithFallback,
    isMPAvailable,
    type CreatePreferenceRequest,
} from '@/lib/integrations/mercadopago';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        const { id } = await params;

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { amount, description } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { success: false, error: 'Monto inválido' },
                { status: 400 }
            );
        }

        // First check if MP is available
        const availability = await isMPAvailable(session.organizationId);
        if (!availability.available) {
            return NextResponse.json(
                {
                    success: false,
                    error: availability.reason || 'MercadoPago no disponible',
                    retryAfter: availability.retryAfter,
                },
                { status: 503 }
            );
        }

        // Get job and organization
        const job = await prisma.job.findFirst({
            where: { id, organizationId: session.organizationId },
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                lineItems: true,
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Trabajo no encontrado' },
                { status: 404 }
            );
        }

        // Get organization with MP credentials
        // Try OrganizationSettings first
        let accessToken: string | null = null;
        try {
            const orgSettings = await prisma.organizationSettings.findFirst({
                where: { organizationId: session.organizationId },
                select: {
                    mercadoPagoAccessToken: true,
                },
            });
            accessToken = orgSettings?.mercadoPagoAccessToken || null;
        } catch {
            // Model might not exist
        }

        if (!accessToken) {
            return NextResponse.json(
                { success: false, error: 'MercadoPago no configurado' },
                { status: 400 }
            );
        }

        // Build line items from job materials/line items
        const items = job.lineItems.length > 0
            ? job.lineItems.map((item: { description: string; quantity: unknown; unitPrice: unknown }) => ({
                title: item.description,
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                currencyId: 'ARS' as const,
            }))
            : [{
                title: description || `Servicio - ${job.jobNumber}`,
                description: description || `Trabajo ${job.jobNumber}`,
                quantity: 1,
                unitPrice: Number(amount),
                currencyId: 'ARS' as const,
            }];

        // Build payer info if customer has email
        const payer = job.customer?.email ? {
            email: job.customer.email,
            name: job.customer.name || undefined,
            phone: job.customer.phone ? {
                areaCode: '',
                number: job.customer.phone,
            } : undefined,
        } : undefined;

        // Build the preference request
        const preferenceRequest: CreatePreferenceRequest = {
            items,
            payer,
            externalReference: `job:${job.id}:${session.organizationId}`,
            notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
            backUrls: {
                success: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
                pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment/pending`,
                failure: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failure`,
            },
            autoReturn: 'approved',
            paymentMethods: {
                installments: 12,
            },
            expires: true,
            expirationDateFrom: new Date().toISOString(),
            expirationDateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            metadata: {
                jobId: job.id,
                jobNumber: job.jobNumber,
                organizationId: session.organizationId,
                technicianId: session.userId,
                source: 'mobile_payment_step',
            },
        };

        // Create the preference with fallback support
        const result = await createPaymentWithFallback(
            session.organizationId,
            accessToken,
            preferenceRequest
        );

        if (!result.success) {
            // Return fallback instructions if MP failed
            return NextResponse.json({
                success: false,
                error: 'Error generando link de pago',
                fallback: result.fallbackInstructions,
                fallbackMessage: result.fallbackMessage,
            }, { status: 500 });
        }

        // Store the preference ID for tracking
        try {
            await prisma.job.update({
                where: { id },
                data: {
                    mpPreferenceId: result.preferenceId,
                },
            });
        } catch {
            // Non-critical - log and continue
            console.warn('[PaymentLink] Failed to store preference ID');
        }

        return NextResponse.json({
            success: true,
            data: {
                paymentUrl: result.preferenceUrl,
                preferenceId: result.preferenceId,
            },
        });
    } catch (error) {
        console.error('[PaymentLink] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al generar link de pago' },
            { status: 500 }
        );
    }
}
