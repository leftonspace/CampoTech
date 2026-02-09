/**
 * Organization Payment Info API Route
 * ====================================
 * 
 * GET /api/organization/payment-info
 * 
 * Returns payment configuration for the organization:
 * - Bank transfer details (CBU, Alias, Titular) from settings JSON
 * - MercadoPago connection status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Type for the settings JSON
interface OrganizationPaymentSettings {
    bankCbu?: string;
    bankAlias?: string;
    bankAccountHolder?: string;
    bankName?: string;
}

export async function GET(_request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const organization = await prisma.organization.findUnique({
            where: { id: session.organizationId },
            select: {
                id: true,
                name: true,
                settings: true,
                // Check MercadoPago OAuth connection on Organization model
                // These may exist on Organization or OrganizationSettings
            },
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: 'Organización no encontrada' },
                { status: 404 }
            );
        }

        // Parse settings JSON
        const settings = (organization.settings || {}) as OrganizationPaymentSettings;

        // Also try to check OrganizationSettings if it exists
        let hasMercadoPago = false;
        try {
            const orgSettings = await prisma.organizationSettings.findFirst({
                where: { organizationId: session.organizationId },
                select: {
                    mercadoPagoAccessToken: true,
                    mercadoPagoEnabled: true,
                },
            });
            hasMercadoPago = !!(orgSettings?.mercadoPagoAccessToken && orgSettings?.mercadoPagoEnabled);
        } catch {
            // Model might not exist, that's okay
        }

        return NextResponse.json({
            success: true,
            data: {
                cbu: settings.bankCbu || null,
                alias: settings.bankAlias || null,
                titular: settings.bankAccountHolder || organization.name,
                hasMercadoPago,
            },
        });
    } catch (error) {
        console.error('[PaymentInfo] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo información de pago' },
            { status: 500 }
        );
    }
}
