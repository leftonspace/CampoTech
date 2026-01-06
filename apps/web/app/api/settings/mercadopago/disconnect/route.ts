/**
 * MercadoPago OAuth - Disconnect
 * ==============================
 * 
 * Phase 4.1 Task 4.1.1: Implement Mercado Pago OAuth
 * 
 * Disconnects the MercadoPago account by clearing stored credentials.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Only owners can disconnect MercadoPago
        if (session.role.toUpperCase() !== 'OWNER') {
            return NextResponse.json(
                { success: false, error: 'Solo el propietario puede desconectar MercadoPago' },
                { status: 403 }
            );
        }

        // Get current organization settings
        const organization = await prisma.organization.findUnique({
            where: { id: session.organizationId },
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: 'Organización no encontrada' },
                { status: 404 }
            );
        }

        // Parse existing settings
        const currentSettings = typeof organization.settings === 'string'
            ? JSON.parse(organization.settings)
            : organization.settings || {};

        // Remove MercadoPago settings
        const { mercadopago: _removed, ...restSettings } = currentSettings;

        // Update organization settings
        await prisma.organization.update({
            where: { id: session.organizationId },
            data: {
                settings: restSettings,
            },
        });

        console.log(`[MercadoPago] Disconnected org ${session.organizationId}`);

        return NextResponse.json({
            success: true,
            message: 'MercadoPago desconectado correctamente',
        });

    } catch (error) {
        console.error('[MercadoPago] Disconnect error:', error);
        return NextResponse.json(
            { success: false, error: 'Error al desconectar MercadoPago' },
            { status: 500 }
        );
    }
}
