/**
 * Pricing Rules API Route
 * GET /api/settings/pricing-rules - Get organization pricing settings
 * PUT /api/settings/pricing-rules - Update organization pricing settings
 * 
 * Phase 1.9: Multi-Trade Pricing Foundation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { validateBody, pricingRulesSchema } from '@/lib/validation/api-schemas';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Try to get existing settings
        const settings = await prisma.organizationPricingSettings.findUnique({
            where: { organizationId: session.organizationId },
        });

        // If no settings exist, return defaults (don't create yet - lazy creation on first update)
        if (!settings) {
            return NextResponse.json({
                success: true,
                data: {
                    // Technician Adjustment Controls
                    techCanModifyPricing: true,
                    techMaxAdjustmentPercent: null,
                    techMaxAdjustmentAmount: null,
                    requireApprovalOverLimit: true,
                    // Invoice Generation Controls
                    invoiceGeneration: 'MANUAL',
                    autoLockOnInvoice: true,
                    // Deposit (Seña) Settings
                    enableDeposits: true,
                    defaultDepositPercent: null,
                    requireDepositToStart: false,
                    // Price Book Settings
                    usePriceBook: true,
                    priceBookMandatory: false,
                },
                _isDefault: true,
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                techCanModifyPricing: settings.techCanModifyPricing,
                techMaxAdjustmentPercent: settings.techMaxAdjustmentPercent
                    ? Number(settings.techMaxAdjustmentPercent)
                    : null,
                techMaxAdjustmentAmount: settings.techMaxAdjustmentAmount
                    ? Number(settings.techMaxAdjustmentAmount)
                    : null,
                requireApprovalOverLimit: settings.requireApprovalOverLimit,
                invoiceGeneration: settings.invoiceGeneration,
                autoLockOnInvoice: settings.autoLockOnInvoice,
                enableDeposits: settings.enableDeposits,
                defaultDepositPercent: settings.defaultDepositPercent
                    ? Number(settings.defaultDepositPercent)
                    : null,
                requireDepositToStart: settings.requireDepositToStart,
                usePriceBook: settings.usePriceBook,
                priceBookMandatory: settings.priceBookMandatory,
            },
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('Get pricing rules error:', err.message);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo reglas de precios' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Only OWNER can modify pricing rules
        if (!['OWNER'].includes(session.role.toUpperCase())) {
            return NextResponse.json(
                { success: false, error: 'Solo el dueño puede modificar las reglas de precios' },
                { status: 403 }
            );
        }

        const body = await request.json();

        // Validate request body with Zod
        const validation = validateBody(body, pricingRulesSchema);
        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        const {
            techCanModifyPricing,
            techMaxAdjustmentPercent,
            techMaxAdjustmentAmount,
            requireApprovalOverLimit,
            invoiceGeneration,
            autoLockOnInvoice,
            enableDeposits,
            defaultDepositPercent,
            requireDepositToStart,
            usePriceBook,
            priceBookMandatory,
        } = validation.data;

        // Upsert the settings (create if doesn't exist, update if exists)
        const settings = await prisma.organizationPricingSettings.upsert({
            where: { organizationId: session.organizationId },
            update: {
                techCanModifyPricing: techCanModifyPricing ?? true,
                techMaxAdjustmentPercent: techMaxAdjustmentPercent !== null && techMaxAdjustmentPercent !== undefined
                    ? new Decimal(techMaxAdjustmentPercent)
                    : null,
                techMaxAdjustmentAmount: techMaxAdjustmentAmount !== null && techMaxAdjustmentAmount !== undefined
                    ? new Decimal(techMaxAdjustmentAmount)
                    : null,
                requireApprovalOverLimit: requireApprovalOverLimit ?? true,
                invoiceGeneration: invoiceGeneration ?? 'MANUAL',
                autoLockOnInvoice: autoLockOnInvoice ?? true,
                enableDeposits: enableDeposits ?? true,
                defaultDepositPercent: defaultDepositPercent !== null && defaultDepositPercent !== undefined
                    ? new Decimal(defaultDepositPercent)
                    : null,
                requireDepositToStart: requireDepositToStart ?? false,
                usePriceBook: usePriceBook ?? true,
                priceBookMandatory: priceBookMandatory ?? false,
            },
            create: {
                organizationId: session.organizationId,
                techCanModifyPricing: techCanModifyPricing ?? true,
                techMaxAdjustmentPercent: techMaxAdjustmentPercent !== null && techMaxAdjustmentPercent !== undefined
                    ? new Decimal(techMaxAdjustmentPercent)
                    : null,
                techMaxAdjustmentAmount: techMaxAdjustmentAmount !== null && techMaxAdjustmentAmount !== undefined
                    ? new Decimal(techMaxAdjustmentAmount)
                    : null,
                requireApprovalOverLimit: requireApprovalOverLimit ?? true,
                invoiceGeneration: invoiceGeneration ?? 'MANUAL',
                autoLockOnInvoice: autoLockOnInvoice ?? true,
                enableDeposits: enableDeposits ?? true,
                defaultDepositPercent: defaultDepositPercent !== null && defaultDepositPercent !== undefined
                    ? new Decimal(defaultDepositPercent)
                    : null,
                requireDepositToStart: requireDepositToStart ?? false,
                usePriceBook: usePriceBook ?? true,
                priceBookMandatory: priceBookMandatory ?? false,
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                techCanModifyPricing: settings.techCanModifyPricing,
                techMaxAdjustmentPercent: settings.techMaxAdjustmentPercent
                    ? Number(settings.techMaxAdjustmentPercent)
                    : null,
                techMaxAdjustmentAmount: settings.techMaxAdjustmentAmount
                    ? Number(settings.techMaxAdjustmentAmount)
                    : null,
                requireApprovalOverLimit: settings.requireApprovalOverLimit,
                invoiceGeneration: settings.invoiceGeneration,
                autoLockOnInvoice: settings.autoLockOnInvoice,
                enableDeposits: settings.enableDeposits,
                defaultDepositPercent: settings.defaultDepositPercent
                    ? Number(settings.defaultDepositPercent)
                    : null,
                requireDepositToStart: settings.requireDepositToStart,
                usePriceBook: settings.usePriceBook,
                priceBookMandatory: settings.priceBookMandatory,
            },
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        console.error('Update pricing rules error:', err.message);
        return NextResponse.json(
            { success: false, error: 'Error actualizando reglas de precios' },
            { status: 500 }
        );
    }
}
