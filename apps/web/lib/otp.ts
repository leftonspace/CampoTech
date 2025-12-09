import { prisma } from '@/lib/prisma';
import { getOrCreateSMSProvider } from '@/lib/sms';
import crypto from 'crypto';

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_MINUTES = 1; // Minimum time between OTP requests

// Generate a random numeric OTP
function generateOTP(): string {
  // Generate cryptographically secure random digits
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(OTP_LENGTH);
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  return otp;
}

// Hash OTP for secure storage (using SHA-256)
function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// Timing-safe comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Check if dev mode bypass is allowed
function isDevBypassAllowed(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.ALLOW_DEV_OTP === 'true';
}

// Dev bypass code
const DEV_OTP_CODE = '123456';

export interface OTPRequestResult {
  success: boolean;
  error?: string;
  rateLimited?: boolean;
  devMode?: boolean;
}

export interface OTPVerifyResult {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
  expired?: boolean;
}

// Request (send) an OTP
export async function requestOTP(phone: string): Promise<OTPRequestResult> {
  try {
    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);

    // Check rate limiting - find most recent OTP for this phone
    const recentOTP = await prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        createdAt: {
          gte: new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOTP) {
      const waitSeconds = Math.ceil(
        (RATE_LIMIT_MINUTES * 60 * 1000 - (Date.now() - recentOTP.createdAt.getTime())) / 1000
      );
      return {
        success: false,
        error: `Por favor esperá ${waitSeconds} segundos antes de solicitar otro código`,
        rateLimited: true,
      };
    }

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in database
    await prisma.otpCode.create({
      data: {
        phone: normalizedPhone,
        codeHash: hashedOTP,
        expiresAt,
        attempts: 0,
        verified: false,
      },
    });

    // Clean up old OTPs for this phone (keep only last 5)
    const oldOTPs = await prisma.otpCode.findMany({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: 'desc' },
      skip: 5,
    });
    if (oldOTPs.length > 0) {
      await prisma.otpCode.deleteMany({
        where: {
          id: { in: oldOTPs.map((o: { id: string }) => o.id) },
        },
      });
    }

    // In dev mode with bypass enabled, log the OTP
    if (isDevBypassAllowed()) {
      console.log(`🔐 DEV MODE OTP for ${normalizedPhone}: ${otp} (or use ${DEV_OTP_CODE})`);
      return { success: true, devMode: true };
    }

    // Send SMS
    const smsProvider = getOrCreateSMSProvider();
    const message = `Tu código de verificación de CampoTech es: ${otp}. Expira en ${OTP_EXPIRY_MINUTES} minutos.`;

    const smsResult = await smsProvider.sendSMS(normalizedPhone, message);

    if (!smsResult.success) {
      console.error(`Failed to send OTP SMS: ${smsResult.error}`);
      return {
        success: false,
        error: 'No pudimos enviar el SMS. Por favor intentá de nuevo.',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error requesting OTP:', error);
    return {
      success: false,
      error: 'Error al generar el código. Por favor intentá de nuevo.',
    };
  }
}

// Verify an OTP
export async function verifyOTP(phone: string, code: string): Promise<OTPVerifyResult> {
  try {
    const normalizedPhone = normalizePhone(phone);

    // Dev bypass check
    if (isDevBypassAllowed() && code === DEV_OTP_CODE) {
      console.log(`🔓 DEV MODE: Accepting bypass code for ${normalizedPhone}`);
      return { success: true };
    }

    // Find the most recent unverified OTP for this phone
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return {
        success: false,
        error: 'No hay código pendiente. Solicitá uno nuevo.',
      };
    }

    // Check if expired
    if (otpRecord.expiresAt < new Date()) {
      return {
        success: false,
        error: 'El código expiró. Solicitá uno nuevo.',
        expired: true,
      };
    }

    // Check attempts
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return {
        success: false,
        error: 'Demasiados intentos fallidos. Solicitá un código nuevo.',
        attemptsRemaining: 0,
      };
    }

    // Verify the code
    const hashedInput = hashOTP(code);
    const isValid = safeCompare(hashedInput, otpRecord.codeHash);

    if (!isValid) {
      // Increment attempts
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });

      const attemptsRemaining = MAX_ATTEMPTS - otpRecord.attempts - 1;
      return {
        success: false,
        error: `Código incorrecto. ${attemptsRemaining > 0 ? `Te quedan ${attemptsRemaining} intentos.` : 'Solicitá un código nuevo.'}`,
        attemptsRemaining,
      };
    }

    // Mark as verified
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    return { success: true };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      error: 'Error al verificar el código. Por favor intentá de nuevo.',
    };
  }
}

// Normalize phone number to E.164 format
function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with +, keep it
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Argentine number normalization
  if (cleaned.startsWith('54')) {
    return '+' + cleaned;
  }

  // US/Canada number (starts with 1)
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+' + cleaned;
  }

  // Assume Argentine local number if 10-11 digits
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    // Remove leading 0 if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }
    // Add Argentina country code
    return '+54' + cleaned;
  }

  // Default: add + prefix
  return '+' + cleaned;
}

// Clean up expired OTPs (can be called by a cron job)
export async function cleanupExpiredOTPs(): Promise<number> {
  const result = await prisma.otpCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { verified: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Verified OTPs older than 24h
      ],
    },
  });
  return result.count;
}
