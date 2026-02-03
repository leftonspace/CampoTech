import { NextRequest, NextResponse } from 'next/server';
import { prisma, TransactionClient } from '@/lib/prisma';
import { createToken } from '@/lib/auth';
import { verifyOTP } from '@/lib/otp';
import { trialManager, TRIAL_DAYS } from '@/lib/services/trial-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, error: { message: 'Teléfono y código son requeridos' } },
        { status: 400 }
      );
    }

    // Normalize phone
    const cleanPhone = normalizePhone(phone);

    // Find pending registration
    const pendingReg = await prisma.pendingRegistration.findUnique({
      where: { phone: cleanPhone },
    });

    if (!pendingReg) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'No hay registro pendiente para este número. Por favor comenzá de nuevo.' }
        },
        { status: 404 }
      );
    }

    // Check if registration expired
    if (pendingReg.expiresAt < new Date()) {
      // Clean up expired registration
      await prisma.pendingRegistration.delete({ where: { id: pendingReg.id } });
      return NextResponse.json(
        {
          success: false,
          error: { message: 'El registro expiró. Por favor comenzá de nuevo.', expired: true }
        },
        { status: 410 }
      );
    }

    // Verify OTP
    const otpResult = await verifyOTP(cleanPhone, code);

    if (!otpResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: otpResult.error || 'Código incorrecto',
            expired: otpResult.expired,
            attemptsRemaining: otpResult.attemptsRemaining,
          }
        },
        { status: 401 }
      );
    }

    // Double-check CUIT not taken (race condition protection) - only if CUIT was provided
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
      // Use businessName if provided, otherwise use adminName as org name
      const orgName = pendingReg.businessName || pendingReg.adminName;

      // Create organization
      const org = await tx.organization.create({
        data: {
          name: orgName,
          phone: cleanPhone,
          email: pendingReg.email,
          settings: {
            // Only include CUIT fields if provided
            ...(pendingReg.cuit ? {
              cuit: pendingReg.cuit,
              cuitFormatted: formatCUIT(pendingReg.cuit),
            } : {}),
            // Ley 25.326 consent record
            consent: {
              dataTransferConsent: true,  // Required to register
              termsAccepted: true,         // Required to register
              consentTimestamp: new Date().toISOString(),
              ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
              userAgent: request.headers.get('user-agent') || 'unknown',
            },
          },
        },
      });

      // Generate email from CUIT if available, otherwise from phone
      const email = pendingReg.email || (pendingReg.cuit
        ? `admin-${pendingReg.cuit}@campotech.app`
        : `admin-${cleanPhone.replace(/\+/g, '')}@campotech.app`);

      // Create admin user
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

    // Create 14-day trial subscription for the new organization
    const trialResult = await trialManager.createTrial(organization.id);
    if (!trialResult.success) {
      console.error('Failed to create trial for organization:', organization.id, trialResult.error);
      // Don't fail registration if trial creation fails - organization can still use the app
    }

    // Create JWT tokens
    const accessToken = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      subscriptionTier: trialResult.success ? 'INICIAL' : 'FREE',
      subscriptionStatus: trialResult.success ? 'trialing' : 'none',
    });

    const refreshToken = accessToken;

    // Create response
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

    // Set auth cookie
    response.cookies.set('auth-token', accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    console.error('Register verify error:', error);

    // Handle unique constraint violation (phone or email already exists)
    // Prisma error code for unique constraint violation is P2002
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

// Normalize phone number to E.164 format
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  if (cleaned.startsWith('54')) {
    return '+' + cleaned;
  }

  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+' + cleaned;
  }

  if (cleaned.length >= 10 && cleaned.length <= 11) {
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }
    return '+54' + cleaned;
  }

  return '+' + cleaned;
}

// Format CUIT as XX-XXXXXXXX-X
function formatCUIT(cuit: string): string {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) return cuit;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}
