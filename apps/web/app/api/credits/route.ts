/**
 * Phase 4.8: Credits API
 * ========================
 * 
 * API for managing WhatsApp AI credits.
 * 
 * GET - Get credit account info
 * POST - Initiate credit purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWhatsAppCreditsService, CREDIT_PACKAGES } from '@/lib/services/whatsapp-credits.service';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get credit account info
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const creditsService = getWhatsAppCreditsService();
        const accountInfo = await creditsService.getAccountInfo(session.organizationId);
        const purchaseHistory = await creditsService.getPurchaseHistory(session.organizationId);

        return NextResponse.json({
            success: true,
            account: accountInfo,
            purchases: purchaseHistory,
            packages: CREDIT_PACKAGES,
        });
    } catch (error) {
        console.error('[Credits API] GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Initiate credit purchase
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { packageName } = body;

        if (!packageName) {
            return NextResponse.json(
                { error: 'packageName is required' },
                { status: 400 }
            );
        }

        if (!CREDIT_PACKAGES[packageName]) {
            return NextResponse.json(
                { error: 'Invalid package. Valid packages: ' + Object.keys(CREDIT_PACKAGES).join(', ') },
                { status: 400 }
            );
        }

        const creditsService = getWhatsAppCreditsService();
        const { purchaseId, package: pkg } = await creditsService.initiatePurchase(
            session.organizationId,
            packageName
        );

        // TODO: Generate Mercado Pago preference and return checkout URL
        // For now, return the purchase ID for manual completion

        return NextResponse.json({
            success: true,
            purchaseId,
            package: pkg,
            message: 'Purchase initiated. Complete payment to receive credits.',
            // In production:
            // checkoutUrl: mercadoPagoPreference.init_point,
        });
    } catch (error) {
        console.error('[Credits API] POST error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
