import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * WhatsApp Redirect Route
 * =======================
 * 
 * Phase 3.2: Marketplace Attribution Tracking
 * 
 * Tracks clicks from the marketplace to WhatsApp and provides attribution
 * for later conversion matching.
 */

/**
 * Generate fingerprint for tracking (Privacy-safe)
 */
function generateFingerprint(ip: string | null, ua: string | null): string {
    const data = `${ip || 'unknown'}:${ua || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        if (!slug) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        // Find the business profile and organization
        const profile = await prisma.businessPublicProfile.findUnique({
            where: { slug },
            include: {
                organization: {
                    select: {
                        id: true,
                        whatsappPersonalNumber: true,
                    },
                },
            },
        });

        if (!profile || !profile.organization) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        const organizationId = profile.organization.id;
        const targetNumber = profile.organization.whatsappPersonalNumber || profile.whatsappNumber;

        if (!targetNumber) {
            return NextResponse.redirect(new URL(`/p/${slug}`, request.url));
        }

        // Clean number (must be digits only for wa.me)
        let cleanNumber = targetNumber.replace(/\D/g, '');
        if (cleanNumber.length === 10) {
            cleanNumber = '54' + cleanNumber;
        }

        // Redirect to WhatsApp (Task 3.2.2: No pre-filled message)
        const waUrl = `https://wa.me/${cleanNumber}`;

        // Analytics data
        const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-real-ip') ||
            null;
        const referrer = request.headers.get('referer') || null;
        const userAgent = request.headers.get('user-agent') || null;
        const source = userAgent?.includes('Mobile') ? 'marketplace_mobile' : 'marketplace_web';

        // Log the click for attribution (Non-blocking)
        prisma.marketplaceClick.create({
            data: {
                organizationId,
                businessSlug: slug,
                consumerIp: clientIP,
                consumerUserAgent: userAgent?.substring(0, 500),
                consumerFingerprint: generateFingerprint(clientIP, userAgent),
                source,
                referrer,
            },
        }).catch((err: unknown) => {
            console.error('[MarketplaceAttribution] Failed to track click:', err);
        });

        return NextResponse.redirect(waUrl);
    } catch (error) {
        console.error('[MarketplaceAttribution] Redirect error:', error);
        return NextResponse.redirect(new URL('/', request.url));
    }
}

