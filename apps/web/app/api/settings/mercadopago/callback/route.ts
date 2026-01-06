/**
 * MercadoPago OAuth - Callback Handler
 * =====================================
 * 
 * Phase 4.1 Task 4.1.1: Implement Mercado Pago OAuth
 * 
 * Handles the OAuth callback from MercadoPago after user authorization.
 * Exchanges the authorization code for access and refresh tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

interface MPTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    user_id: number;
    refresh_token: string;
    public_key: string;
    live_mode: boolean;
}

interface MPUserResponse {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
        console.error('[MercadoPago OAuth] Authorization error:', error, errorDescription);
        return NextResponse.redirect(
            new URL(`/dashboard/settings/mercadopago?error=${encodeURIComponent(error)}`, APP_URL)
        );
    }

    // Validate required parameters
    if (!code || !state) {
        console.error('[MercadoPago OAuth] Missing code or state');
        return NextResponse.redirect(
            new URL('/dashboard/settings/mercadopago?error=invalid_request', APP_URL)
        );
    }

    // Parse state to get organization ID
    // State format: orgId:randomHex
    const [organizationId] = state.split(':');
    if (!organizationId) {
        console.error('[MercadoPago OAuth] Invalid state format');
        return NextResponse.redirect(
            new URL('/dashboard/settings/mercadopago?error=invalid_state', APP_URL)
        );
    }

    // Validate environment variables
    const clientId = process.env.MP_CLIENT_ID;
    const clientSecret = process.env.MP_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('[MercadoPago OAuth] Missing MP_CLIENT_ID or MP_CLIENT_SECRET');
        return NextResponse.redirect(
            new URL('/dashboard/settings/mercadopago?error=server_config_error', APP_URL)
        );
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch(MP_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: `${APP_URL}/api/settings/mercadopago/callback`,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            console.error('[MercadoPago OAuth] Token exchange failed:', tokenResponse.status, errorData);
            return NextResponse.redirect(
                new URL('/dashboard/settings/mercadopago?error=token_exchange_failed', APP_URL)
            );
        }

        const tokens: MPTokenResponse = await tokenResponse.json();

        // Fetch user info for display
        let userInfo: MPUserResponse | null = null;
        try {
            const userResponse = await fetch('https://api.mercadopago.com/users/me', {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                },
            });
            if (userResponse.ok) {
                userInfo = await userResponse.json();
            }
        } catch (userError) {
            console.warn('[MercadoPago OAuth] Failed to fetch user info:', userError);
            // Non-fatal, continue with token storage
        }

        // Get current organization settings
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!organization) {
            console.error('[MercadoPago OAuth] Organization not found:', organizationId);
            return NextResponse.redirect(
                new URL('/dashboard/settings/mercadopago?error=org_not_found', APP_URL)
            );
        }

        // Parse existing settings
        const currentSettings = typeof organization.settings === 'string'
            ? JSON.parse(organization.settings)
            : organization.settings || {};

        // Store tokens in settings (encrypted storage recommended for production)
        // Note: In production, use encryption service for access_token and refresh_token
        const mpSettings = {
            // Connection info
            connected: true,
            connectedAt: new Date().toISOString(),
            // Token info (should be encrypted in production)
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in,
            tokenType: tokens.token_type,
            // Account info
            userId: tokens.user_id,
            publicKey: tokens.public_key,
            liveMode: tokens.live_mode,
            // User display info
            email: userInfo?.email || null,
            firstName: userInfo?.first_name || null,
            lastName: userInfo?.last_name || null,
        };

        // Update organization settings
        await prisma.organization.update({
            where: { id: organizationId },
            data: {
                settings: {
                    ...currentSettings,
                    mercadopago: mpSettings,
                },
            },
        });

        console.log(`[MercadoPago OAuth] Successfully connected org ${organizationId} with MP user ${tokens.user_id}`);

        // Redirect to settings page with success message
        return NextResponse.redirect(
            new URL('/dashboard/settings/mercadopago?success=connected', APP_URL)
        );

    } catch (error) {
        console.error('[MercadoPago OAuth] Callback error:', error);
        return NextResponse.redirect(
            new URL('/dashboard/settings/mercadopago?error=callback_failed', APP_URL)
        );
    }
}
