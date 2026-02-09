/**
 * Complete Registration API
 * =========================
 *
 * POST /api/auth/register/complete
 *
 * Finalizes account creation after OTP verification.
 * Called when user either:
 *   - Chooses a payment method in the checkout modal
 *   - Clicks "Continuar sin pagar" to start free trial
 *
 * Expects a `registrationTicket` (signed JWT) containing the
 * pending registration ID from the OTP verification step.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, TransactionClient } from '@/lib/prisma';
import { createToken, verifyToken } from '@/lib/auth';
import { trialManager, TRIAL_DAYS } from '@/lib/services/trial-manager';
import type { SubscriptionTier } from '@/lib/config/tier-limits';
import { consentService, CURRENT_POLICY_VERSIONS } from '@/lib/services/consent-service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { registrationTicket } = body;

        if (!registrationTicket) {
            return NextResponse.json(
                { success: false, error: { message: 'Ticket de registro requerido' } },
                { status: 400 }
            );
        }

        // Verify the registration ticket
        const ticketPayload = await verifyToken(registrationTicket);
        if (!ticketPayload || ticketPayload.type !== 'registration_ticket') {
            return NextResponse.json(
                { success: false, error: { message: 'Ticket de registro inválido o expirado. Por favor comenzá de nuevo.' } },
                { status: 401 }
            );
        }

        const pendingRegId = ticketPayload.pendingRegistrationId as string;
        const cleanPhone = ticketPayload.phone as string;
        const _ticketSelectedPlan = ticketPayload.selectedPlan as string | undefined;

        // ── IDEMPOTENCY CHECK ────────────────────────────────────────
        // Check if user already exists FIRST (e.g., payment flow already
        // created the account but checkout failed, user then clicks "skip").
        // This must run BEFORE the pending registration lookup because the
        // first call may have already deleted the pending registration.
        const existingUser = await prisma.user.findFirst({
            where: { phone: cleanPhone },
            include: { organization: true },
        });

        if (existingUser && existingUser.organization) {
            // User already exists — just return tokens (idempotent)
            // Always INICIAL for trial — tier upgrades only happen after payment
            const accessToken = await createToken({
                userId: existingUser.id,
                email: existingUser.email,
                role: existingUser.role,
                organizationId: existingUser.organizationId,
                subscriptionTier: 'INICIAL',
                subscriptionStatus: 'trialing',
            });

            // Clean up pending registration if it still exists
            await prisma.pendingRegistration.delete({ where: { id: pendingRegId } }).catch(() => { });

            const response = NextResponse.json({
                success: true,
                data: {
                    accessToken,
                    refreshToken: accessToken,
                    user: {
                        id: existingUser.id,
                        name: existingUser.name,
                        email: existingUser.email,
                        phone: existingUser.phone,
                        role: existingUser.role,
                        organization: {
                            id: existingUser.organization.id,
                            name: existingUser.organization.name,
                        },
                    },
                },
            });

            response.cookies.set('auth-token', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24,
                path: '/',
            });

            return response;
        }

        // ── PENDING REGISTRATION LOOKUP ──────────────────────────────
        // User doesn't exist yet — we need the pending registration data
        const pendingReg = await prisma.pendingRegistration.findUnique({
            where: { id: pendingRegId },
        });

        if (!pendingReg) {
            return NextResponse.json(
                {
                    success: false,
                    error: { message: 'Registro no encontrado. Por favor comenzá de nuevo.' }
                },
                { status: 404 }
            );
        }

        // Double-check CUIT not taken (race condition protection)
        if (pendingReg.cuit) {
            const existingOrg = await prisma.organization.findFirst({
                where: {
                    settings: {
                        path: ['cuit'],
                        equals: pendingReg.cuit,
                    },
                },
            });

            if (existingOrg) {
                await prisma.pendingRegistration.delete({ where: { id: pendingReg.id } });
                return NextResponse.json(
                    {
                        success: false,
                        error: { message: 'Este CUIT ya fue registrado. Intentá iniciar sesión.' }
                    },
                    { status: 409 }
                );
            }
        }

        // Create organization and user in a transaction
        const { organization, user } = await prisma.$transaction(async (tx: TransactionClient) => {
            const orgName = pendingReg.businessName || pendingReg.adminName;

            const org = await tx.organization.create({
                data: {
                    name: orgName,
                    phone: cleanPhone,
                    email: pendingReg.email,
                    settings: {
                        ...(pendingReg.cuit ? {
                            cuit: pendingReg.cuit,
                            cuitFormatted: formatCUIT(pendingReg.cuit),
                        } : {}),
                        consent: {
                            dataTransferConsent: true,
                            termsAccepted: true,
                            consentTimestamp: new Date().toISOString(),
                            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
                            userAgent: request.headers.get('user-agent') || 'unknown',
                        },
                    },
                },
            });

            const email = pendingReg.email || (pendingReg.cuit
                ? `admin-${pendingReg.cuit}@campotech.app`
                : `admin-${cleanPhone.replace(/\+/g, '')}@campotech.app`);

            const adminUser = await tx.user.create({
                data: {
                    name: pendingReg.adminName,
                    phone: cleanPhone,
                    email,
                    role: 'OWNER',
                    isActive: true,
                    organizationId: org.id,
                },
            });

            // Delete pending registration
            await tx.pendingRegistration.delete({ where: { id: pendingReg.id } });

            return { organization: org, user: adminUser };
        });

        // Create trial — always at INICIAL tier
        // The selectedPlan is stored in org settings for the checkout/webhook flow
        // to upgrade the tier ONLY after payment is confirmed.
        const trialTier: SubscriptionTier = 'INICIAL';

        const trialResult = await trialManager.createTrial(organization.id, trialTier);
        if (!trialResult.success) {
            console.error('Failed to create trial for organization:', organization.id, trialResult.error);
        }

        // Log consent
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const userAgent = request.headers.get('user-agent') || undefined;

        await consentService.grantMultipleConsents(
            user.id,
            [
                { type: 'privacy_policy', version: CURRENT_POLICY_VERSIONS.privacy_policy },
                { type: 'terms_of_service', version: CURRENT_POLICY_VERSIONS.terms_of_service },
                { type: 'data_processing', version: CURRENT_POLICY_VERSIONS.data_processing },
            ],
            ipAddress,
            userAgent
        ).catch((err) => {
            console.error('Failed to log consent for user:', user.id, err);
        });

        // Create business profile (non-blocking)
        import('@/lib/services/business-profile.service').then(({ createBusinessProfile }) => {
            createBusinessProfile({
                organizationId: organization.id,
                displayName: organization.name,
                whatsappNumber: organization.phone || '',
                phone: organization.phone || undefined,
            }).catch((err) => {
                console.error('Failed to create business profile:', organization.id, err);
            });
        });

        // Create JWT tokens — always INICIAL for trial
        // Tier upgrade happens only when payment is confirmed via webhook
        const accessToken = await createToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            subscriptionTier: trialResult.success ? 'INICIAL' : 'FREE',
            subscriptionStatus: trialResult.success ? 'trialing' : 'none',
        });

        const refreshToken = accessToken;

        const response = NextResponse.json({
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    organization: {
                        id: organization.id,
                        name: organization.name,
                    },
                },
                isNewUser: true,
                trial: trialResult.success && trialResult.subscription ? {
                    trialEndsAt: trialResult.subscription.currentPeriodEnd,
                    daysRemaining: TRIAL_DAYS,
                } : null,
            },
        });

        response.cookies.set('auth-token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24,
            path: '/',
        });

        return response;
    } catch (error: unknown) {
        console.error('Complete registration error:', error);

        const isPrismaError = error && typeof error === 'object' && 'code' in error;
        if ((isPrismaError && (error as { code: string }).code === 'P2002') || (error instanceof Error && error.message.includes('Unique constraint'))) {
            return NextResponse.json(
                {
                    success: false,
                    error: { message: 'Este teléfono o email ya está registrado. Intentá iniciar sesión.' }
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, error: { message: 'Error al completar el registro' } },
            { status: 500 }
        );
    }
}

function formatCUIT(cuit: string): string {
    const digits = cuit.replace(/\D/g, '');
    if (digits.length !== 11) return cuit;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}
