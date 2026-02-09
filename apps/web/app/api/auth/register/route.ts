import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCUIT } from '@/lib/cuit';
import { requestOTP } from '@/lib/otp';

// Registration expires in 15 minutes
const REGISTRATION_EXPIRY_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cuit,
      businessName,
      adminName,
      phone,
      email,
      selectedPlan,
      // Ley 25.326 consent fields (captured for future compliance use)
      dataTransferConsent: _dataTransferConsent,
      termsAccepted: _termsAccepted,
      consentTimestamp: _consentTimestamp,
    } = body;

    // Validate required fields (only name and phone are truly required)
    if (!adminName || !phone) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Tu nombre y teléfono son requeridos' }
        },
        { status: 400 }
      );
    }

    // Validate CUIT only if provided
    let cleanCuit: string | null = null;
    if (cuit && cuit.trim()) {
      const cuitValidation = validateCUIT(cuit);
      if (!cuitValidation.valid) {
        return NextResponse.json(
          { success: false, error: { message: cuitValidation.error, field: 'cuit' } },
          { status: 400 }
        );
      }
      cleanCuit = cuitValidation.digits!;
    }

    // Check if organization with this CUIT already exists (only if CUIT provided)
    if (cleanCuit) {
      const existingOrg = await prisma.organization.findFirst({
        where: {
          settings: {
            path: ['cuit'],
            equals: cleanCuit,
          },
        },
      });

      if (existingOrg) {
        console.log(`Registration blocked: CUIT ${cleanCuit} already exists (org ${existingOrg.id})`);
        return NextResponse.json(
          {
            success: false,
            error: { message: 'Ya existe una empresa registrada con este CUIT', field: 'cuit' }
          },
          { status: 409 }
        );
      }
    }

    // Clean and normalize phone
    const cleanPhone = normalizePhone(phone);
    const last10Digits = cleanPhone.slice(-10);

    // Check if user with this phone already exists
    // We check both exact phone and last 10 digits to be safe across different formatting
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: { contains: last10Digits } }
        ]
      },
    });

    if (existingUser) {
      console.log(`Registration blocked: Phone ${cleanPhone} already exists (matched user ${existingUser.id})`);
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Ya existe un usuario con este teléfono. Intentá iniciar sesión.', field: 'phone' }
        },
        { status: 409 }
      );
    }

    // Store or update pending registration
    const expiresAt = new Date(Date.now() + REGISTRATION_EXPIRY_MINUTES * 60 * 1000);

    // Validate selectedPlan if provided
    const validPlans = ['INICIAL', 'PROFESIONAL', 'EMPRESA'];
    const cleanPlan = selectedPlan && validPlans.includes(selectedPlan.toUpperCase())
      ? selectedPlan.toUpperCase()
      : null;

    await prisma.pendingRegistration.upsert({
      where: { phone: cleanPhone },
      update: {
        cuit: cleanCuit,
        businessName: businessName?.trim() || null,
        adminName: adminName.trim(),
        email: email?.trim() || null,
        selectedPlan: cleanPlan,
        expiresAt,
      },
      create: {
        phone: cleanPhone,
        cuit: cleanCuit,
        businessName: businessName?.trim() || null,
        adminName: adminName.trim(),
        email: email?.trim() || null,
        selectedPlan: cleanPlan,
        expiresAt,
      },
    });

    // Send OTP
    const otpResult = await requestOTP(cleanPhone);

    if (!otpResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: otpResult.error || 'Error al enviar el código de verificación',
            rateLimited: otpResult.rateLimited,
          }
        },
        { status: otpResult.rateLimited ? 429 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: true,
        devMode: otpResult.devMode,
        expiresInMinutes: REGISTRATION_EXPIRY_MINUTES,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    return NextResponse.json(
      { success: false, error: { message: 'Error al procesar el registro' } },
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
