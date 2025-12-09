/**
 * Employee Verification Service
 * ==============================
 *
 * Phase 9.5: Employee Onboarding & Verification
 * Handles SMS/WhatsApp verification for new employees.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { sendTemplateMessage } from '../../../integrations/whatsapp/messages/template.sender';
import { getWhatsAppConfig } from '../../../integrations/whatsapp/whatsapp.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerificationResult {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
  cooldownUntil?: Date;
}

export interface SendVerificationResult {
  success: boolean;
  expiresAt?: Date;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_CODE_EXPIRY_MINUTES = 15;
const MAX_VERIFICATION_ATTEMPTS = 3;
const COOLDOWN_DURATION_HOURS = 1;

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION CODE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create and send verification code to employee
 */
export async function sendVerificationCode(
  userId: string,
  organizationId: string,
  preferWhatsApp: boolean = true
): Promise<SendVerificationResult> {
  try {
    // Get user details
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        whatsappNumber: true,
        name: true,
        isVerified: true,
      },
    });

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    if (user.isVerified) {
      return { success: false, error: 'Usuario ya está verificado' };
    }

    // Check for existing valid token or cooldown
    const existingToken = await db.employeeVerificationToken.findFirst({
      where: {
        userId,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingToken?.cooldownUntil && existingToken.cooldownUntil > new Date()) {
      return {
        success: false,
        error: 'Demasiados intentos. Intenta de nuevo más tarde.',
        cooldownUntil: existingToken.cooldownUntil,
      };
    }

    // Invalidate any existing tokens
    await db.employeeVerificationToken.updateMany({
      where: { userId, isUsed: false },
      data: { isUsed: true },
    });

    // Generate new code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    // Create verification token
    await db.employeeVerificationToken.create({
      data: {
        userId,
        organizationId,
        code,
        expiresAt,
      },
    });

    // Get organization for WhatsApp config
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { businessName: true },
    });

    const phone = user.whatsappNumber || user.phone;

    // Try WhatsApp first (Argentine preference)
    if (preferWhatsApp) {
      const waConfig = await getWhatsAppConfig(organizationId);
      if (waConfig) {
        try {
          await sendTemplateMessage(waConfig, phone, 'employee_verification', {
            '1': user.name || 'Equipo',
            '2': code,
            '3': VERIFICATION_CODE_EXPIRY_MINUTES.toString(),
          });

          log.info('Verification code sent via WhatsApp', { userId, phone });
          return { success: true, expiresAt };
        } catch (waError) {
          log.warn('WhatsApp send failed, falling back to SMS', { error: waError });
        }
      }
    }

    // Fallback to SMS (for OTP, SMS is acceptable)
    // Note: SMS implementation would use Twilio or similar
    // For now, log the code (in production, send via SMS service)
    log.info('Verification code generated (SMS fallback)', {
      userId,
      phone,
      code: process.env.NODE_ENV === 'development' ? code : '[REDACTED]',
    });

    return { success: true, expiresAt };
  } catch (error) {
    log.error('Error sending verification code', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Error enviando código de verificación' };
  }
}

/**
 * Verify employee code
 */
export async function verifyCode(
  userId: string,
  code: string
): Promise<VerificationResult> {
  try {
    // Find valid token
    const token = await db.employeeVerificationToken.findFirst({
      where: {
        userId,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!token) {
      return { success: false, error: 'Código expirado o inválido' };
    }

    // Check cooldown
    if (token.cooldownUntil && token.cooldownUntil > new Date()) {
      return {
        success: false,
        error: 'Demasiados intentos. Intenta de nuevo más tarde.',
        cooldownUntil: token.cooldownUntil,
      };
    }

    // Check if code matches
    if (token.code !== code) {
      const newAttempts = token.attempts + 1;
      const attemptsRemaining = MAX_VERIFICATION_ATTEMPTS - newAttempts;

      // Update attempt count
      const updateData: any = {
        attempts: newAttempts,
        lastAttemptAt: new Date(),
      };

      // Apply cooldown if max attempts reached
      if (newAttempts >= MAX_VERIFICATION_ATTEMPTS) {
        updateData.cooldownUntil = new Date(Date.now() + COOLDOWN_DURATION_HOURS * 60 * 60 * 1000);
      }

      await db.employeeVerificationToken.update({
        where: { id: token.id },
        data: updateData,
      });

      return {
        success: false,
        error: 'Código incorrecto',
        attemptsRemaining: Math.max(0, attemptsRemaining),
      };
    }

    // Code is valid - mark as used and verify user
    await db.$transaction([
      db.employeeVerificationToken.update({
        where: { id: token.id },
        data: { isUsed: true },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
        },
      }),
      db.onboardingProgress.upsert({
        where: { userId },
        create: {
          userId,
          organizationId: token.organizationId,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
        },
        update: {
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
        },
      }),
    ]);

    log.info('Employee verified successfully', { userId });
    return { success: true };
  } catch (error) {
    log.error('Error verifying code', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Error verificando código' };
  }
}

/**
 * Resend verification code
 */
export async function resendVerificationCode(
  userId: string
): Promise<SendVerificationResult> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    return sendVerificationCode(userId, user.organizationId);
  } catch (error) {
    log.error('Error resending verification code', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Error reenviando código' };
  }
}

/**
 * Check if user needs verification
 */
export async function checkVerificationStatus(userId: string): Promise<{
  needsVerification: boolean;
  isVerified: boolean;
  onboardingStep?: string;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isVerified: true,
      onboardingStep: true,
      onboardingCompleted: true,
    },
  });

  if (!user) {
    return { needsVerification: false, isVerified: false };
  }

  return {
    needsVerification: !user.isVerified,
    isVerified: user.isVerified || false,
    onboardingStep: user.onboardingStep || 'pending',
  };
}

/**
 * Get pending verifications for an organization (admin view)
 */
export async function getPendingVerifications(organizationId: string) {
  return db.user.findMany({
    where: {
      organizationId,
      isVerified: false,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Manually verify user (admin action)
 */
export async function manualVerify(
  userId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
        },
      }),
      db.auditLog.create({
        data: {
          organizationId: (await db.user.findUnique({ where: { id: userId } }))?.organizationId || '',
          userId: adminUserId,
          action: 'MANUAL_VERIFICATION',
          entityType: 'user',
          entityId: userId,
          changes: { verifiedBy: adminUserId },
        },
      }),
    ]);

    log.info('User manually verified', { userId, adminUserId });
    return { success: true };
  } catch (error) {
    log.error('Error in manual verification', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Error en verificación manual' };
  }
}
