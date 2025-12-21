/**
 * WhatsApp Number Verification API
 * ==================================
 *
 * POST /api/whatsapp/provision/verify - Verify provisioned number with code
 *
 * Request Body:
 * - code: Verification code received via SMS
 *
 * Also supports:
 * - POST with action: 'resend' to request a new verification code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Dialog360Provider } from '@/lib/integrations/whatsapp/providers/dialog360.provider';

function getDialog360Provider(): Dialog360Provider | null {
  const apiKey = process.env.DIALOG360_PARTNER_API_KEY;
  const partnerId = process.env.DIALOG360_PARTNER_ID;

  if (!apiKey || !partnerId) {
    return null;
  }

  return new Dialog360Provider({
    apiKey,
    partnerId,
    webhookSecret: process.env.DIALOG360_WEBHOOK_SECRET,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get user phone for verification
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { phone: true },
    });

    // Check if organization has a pending verification
    const account = await prisma.whatsAppBusinessAccount.findUnique({
      where: { organizationId: session.organizationId },
      select: {
        provisioningStatus: true,
        verificationExpiresAt: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'No tienes un número en proceso de aprovisionamiento' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { code, action, ownerPhone } = body;

    // Get provider
    const provider = getDialog360Provider();
    if (!provider) {
      return NextResponse.json(
        { error: 'Servicio de aprovisionamiento no configurado' },
        { status: 503 }
      );
    }

    // Handle resend action
    if (action === 'resend') {
      const phoneToVerify = ownerPhone || user?.phone;

      if (!phoneToVerify) {
        return NextResponse.json(
          { error: 'Número de teléfono del propietario requerido' },
          { status: 400 }
        );
      }

      const result = await provider.sendVerificationCode(session.organizationId, phoneToVerify);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Error al enviar código de verificación' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Código de verificación enviado',
      });
    }

    // Handle verification
    if (!code) {
      return NextResponse.json(
        { error: 'Código de verificación requerido' },
        { status: 400 }
      );
    }

    // Check if verification has expired
    if (account.verificationExpiresAt && new Date() > account.verificationExpiresAt) {
      return NextResponse.json(
        { error: 'El código de verificación ha expirado. Solicita uno nuevo.' },
        { status: 400 }
      );
    }

    // Verify the code
    const result = await provider.verifyCode(session.organizationId, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Código de verificación inválido' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      ready: result.ready,
      message: result.ready
        ? 'Número verificado correctamente. Ya puedes enviar mensajes.'
        : 'Verificación completada. Esperando activación.',
    });

  } catch (error) {
    console.error('[Verify API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
