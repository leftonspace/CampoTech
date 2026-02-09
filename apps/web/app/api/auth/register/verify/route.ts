/**
 * Registration OTP Verification
 * ==============================
 *
 * POST /api/auth/register/verify
 *
 * Validates the OTP code for a pending registration.
 * Does NOT create the account — just confirms the phone number
 * and returns a `registrationTicket` (signed JWT) that can be
 * used with /api/auth/register/complete to finalize registration.
 *
 * This allows the checkout modal to be shown BEFORE account creation,
 * so users can close the modal and try again without a stuck account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyOTP } from '@/lib/otp';
import { SignJWT } from 'jose';

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

    // OTP verified! Create a registration ticket (signed JWT)
    // This ticket proves the user verified their phone and contains the registration data.
    // It does NOT create the account — that happens in /api/auth/register/complete.
    const secret = process.env.NEXTAUTH_SECRET || 'dev-fallback-secret-not-for-production';
    const jwtSecret = new TextEncoder().encode(secret);

    const registrationTicket = await new SignJWT({
      type: 'registration_ticket',
      pendingRegistrationId: pendingReg.id,
      phone: cleanPhone,
      selectedPlan: pendingReg.selectedPlan,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m') // Ticket valid for 30 minutes
      .sign(jwtSecret);

    return NextResponse.json({
      success: true,
      data: {
        registrationTicket,
        selectedPlan: pendingReg.selectedPlan,
        adminName: pendingReg.adminName,
      },
    });
  } catch (error: unknown) {
    console.error('Register verify error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Error al verificar el código' } },
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
