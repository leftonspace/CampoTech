/**
 * MercadoPago OAuth - Get Auth URL
 * ================================
 * 
 * Phase 4.1 Task 4.1.1: Implement Mercado Pago OAuth
 * 
 * Generates the OAuth authorization URL for connecting a MercadoPago account.
 * Uses MercadoPago's OAuth flow to securely connect business accounts.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

// MercadoPago OAuth URLs
const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Only owners can connect MercadoPago
        if (session.role.toUpperCase() !== 'OWNER') {
            return NextResponse.json(
                { success: false, error: 'Solo el propietario puede conectar MercadoPago' },
                { status: 403 }
            );
        }

        // Validate required environment variables
        const clientId = process.env.MP_CLIENT_ID;
        if (!clientId) {
            console.error('[MercadoPago OAuth] MP_CLIENT_ID not configured');
            console.error('[MercadoPago OAuth] Get it from: MercadoPago Dashboard > Tu negocio > Aplicaciones');
            return NextResponse.json(
                {
                    success: false,
                    error: 'MercadoPago no está configurado. Contacta al administrador.',
                    hint: 'Falta MP_CLIENT_ID en variables de entorno',
                },
                { status: 500 }
            );
        }

        // Generate CSRF state token (orgId + random string for verification)
        const stateToken = `${session.organizationId}:${crypto.randomBytes(16).toString('hex')}`;

        // In production, store this in Redis/DB for verification
        // For now, we'll verify the orgId portion in the callback

        // Build OAuth URL
        const authUrl = new URL(MP_AUTH_URL);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('platform_id', 'mp');
        authUrl.searchParams.set('redirect_uri', `${APP_URL}/api/settings/mercadopago/callback`);
        authUrl.searchParams.set('state', stateToken);

        // Request necessary scopes
        // - read: Read user information
        // - offline_access: Get refresh token for token renewal
        authUrl.searchParams.set('scope', 'read offline_access');

        return NextResponse.json({
            success: true,
            data: {
                url: authUrl.toString(),
            },
        });
    } catch (error) {
        console.error('[MercadoPago OAuth] Error generating auth URL:', error);
        return NextResponse.json(
            { success: false, error: 'Error al generar URL de autorización' },
            { status: 500 }
        );
    }
}
