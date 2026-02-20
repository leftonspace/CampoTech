/**
 * Auto-Invoicing Settings API
 * ===========================
 *
 * GET  /api/billing/settings — Get current auto-invoicing settings
 * PUT  /api/billing/settings — Update auto-invoicing settings
 *
 * Owner-only. Settings are stored in Organization.settings JSON field.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canAccessModule, UserRole } from '@/lib/middleware/field-filter';
import { prisma } from '@/lib/prisma';
import {
    getAutoInvoiceSettings,
    updateAutoInvoiceSettings,
    type AutoInvoiceSettings,
} from '@/lib/services/auto-invoicing.service';

// ═══════════════════════════════════════════════════════════════════════════════
// GET — Retrieve auto-invoicing settings + AFIP readiness status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;
        if (!canAccessModule('invoices', userRole)) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para ver configuración de facturación' },
                { status: 403 }
            );
        }

        const orgId = session.organizationId;
        const [settings, orgStatus] = await Promise.all([
            getAutoInvoiceSettings(orgId),
            prisma.organization.findUnique({
                where: { id: orgId },
                select: {
                    afipCertificateEncrypted: true,
                    afipCuit: true,
                    afipPuntoVenta: true,
                    afipEnvironment: true,
                    afipConnectedAt: true,
                    whatsappIntegrationType: true,
                    whatsappPhoneNumberId: true,
                },
            }),
        ]);

        const afipConfigured = !!(
            orgStatus?.afipCertificateEncrypted &&
            orgStatus?.afipCuit &&
            orgStatus?.afipPuntoVenta
        );

        const whatsappConfigured = !!(orgStatus?.whatsappIntegrationType && orgStatus.whatsappIntegrationType !== 'NONE');

        return NextResponse.json({
            success: true,
            data: {
                ...settings,
                // AFIP readiness info for the UI
                afipConfigured,
                afipCuit: orgStatus?.afipCuit || null,
                afipPuntoVenta: orgStatus?.afipPuntoVenta || null,
                afipEnvironment: orgStatus?.afipEnvironment || null,
                afipConnectedAt: orgStatus?.afipConnectedAt?.toISOString() || null,
                // WhatsApp readiness info for the UI
                whatsappConfigured,
            },
        });
    } catch (error) {
        console.error('Billing settings GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al cargar configuración de facturación' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT — Update auto-invoicing settings
// ═══════════════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;
        if (!canAccessModule('invoices', userRole)) {
            return NextResponse.json(
                { success: false, error: 'Solo el dueño puede cambiar la configuración de facturación' },
                { status: 403 }
            );
        }

        const body = await request.json();

        // Validate input
        const validTypes = ['A', 'B', 'C'];
        const updates: Record<string, unknown> = {};

        if (typeof body.autoInvoiceEnabled === 'boolean') {
            updates.autoInvoiceEnabled = body.autoInvoiceEnabled;
        }
        if (typeof body.autoAfipSubmit === 'boolean') {
            // Can only enable auto-AFIP if AFIP is configured
            if (body.autoAfipSubmit) {
                const org = await prisma.organization.findUnique({
                    where: { id: session.organizationId },
                    select: {
                        afipCertificateEncrypted: true,
                        afipCuit: true,
                        afipPuntoVenta: true,
                    },
                });

                if (!org?.afipCertificateEncrypted || !org?.afipCuit || !org?.afipPuntoVenta) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: 'No se puede activar el envío automático a AFIP sin tener AFIP configurado. ' +
                                'Configurá tu certificado en Configuración → AFIP.',
                        },
                        { status: 400 }
                    );
                }
            }
            updates.autoAfipSubmit = body.autoAfipSubmit;
        }
        if (typeof body.autoWhatsappInvoice === 'boolean') {
            // Can only enable auto-WhatsApp if WhatsApp is configured
            if (body.autoWhatsappInvoice) {
                const org = await prisma.organization.findUnique({
                    where: { id: session.organizationId },
                    select: { whatsappIntegrationType: true },
                });

                if (!org?.whatsappIntegrationType || org.whatsappIntegrationType === 'NONE') {
                    return NextResponse.json(
                        {
                            success: false,
                            error: 'No se puede activar el envío automático por WhatsApp sin tener WhatsApp configurado. ' +
                                'Configurá tu integración en Configuración → WhatsApp.',
                        },
                        { status: 400 }
                    );
                }
            }
            updates.autoWhatsappInvoice = body.autoWhatsappInvoice;
        }
        if (typeof body.defaultInvoiceType === 'string' && validTypes.includes(body.defaultInvoiceType)) {
            updates.defaultInvoiceType = body.defaultInvoiceType;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { success: false, error: 'No se proporcionaron cambios válidos' },
                { status: 400 }
            );
        }

        const newSettings = await updateAutoInvoiceSettings(session.organizationId, updates as Partial<AutoInvoiceSettings>);

        console.log(
            `[AutoInvoice Settings] Updated for org=${session.organizationId}:`,
            JSON.stringify(newSettings)
        );

        return NextResponse.json({
            success: true,
            data: newSettings,
        });
    } catch (error) {
        console.error('Billing settings PUT error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al guardar configuración de facturación' },
            { status: 500 }
        );
    }
}
