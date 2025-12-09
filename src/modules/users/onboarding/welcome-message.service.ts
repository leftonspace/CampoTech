/**
 * Welcome Message Service
 * =======================
 *
 * Phase 9.5: Employee Onboarding & Verification
 * Handles sending welcome messages to new employees via WhatsApp (preferred) or SMS.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { sendTemplateMessage } from '../../../integrations/whatsapp/messages/template.sender';
import { getWhatsAppConfig } from '../../../integrations/whatsapp/whatsapp.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WelcomeMessageResult {
  success: boolean;
  channel: 'whatsapp' | 'sms' | 'none';
  error?: string;
}

export interface WelcomeMessageParams {
  userId: string;
  organizationId: string;
  userName: string;
  userPhone: string;
  userRole: string;
  verificationCode?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WELCOME MESSAGE SENDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send welcome message to new employee
 * Uses WhatsApp first (Argentine market preference), falls back to SMS
 */
export async function sendWelcomeMessage(
  params: WelcomeMessageParams
): Promise<WelcomeMessageResult> {
  const { userId, organizationId, userName, userPhone, userRole, verificationCode } = params;

  try {
    // Get organization details
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        businessName: true,
        name: true,
      },
    });

    if (!organization) {
      return { success: false, channel: 'none', error: 'Organización no encontrada' };
    }

    const orgName = organization.businessName || organization.name || 'CampoTech';
    const roleName = getRoleDisplayName(userRole);

    // Try WhatsApp first (Argentine preference)
    const whatsappResult = await sendWhatsAppWelcome({
      phone: userPhone,
      organizationId,
      userName,
      orgName,
      roleName,
      verificationCode,
    });

    if (whatsappResult.success) {
      log.info('Welcome message sent via WhatsApp', { userId, phone: userPhone });
      return { success: true, channel: 'whatsapp' };
    }

    // Fallback to SMS
    const smsResult = await sendSmsWelcome({
      phone: userPhone,
      userName,
      orgName,
      verificationCode,
    });

    if (smsResult.success) {
      log.info('Welcome message sent via SMS', { userId, phone: userPhone });
      return { success: true, channel: 'sms' };
    }

    log.warn('Failed to send welcome message via any channel', { userId, phone: userPhone });
    return { success: false, channel: 'none', error: 'No se pudo enviar el mensaje de bienvenida' };
  } catch (error) {
    log.error('Error sending welcome message', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, channel: 'none', error: 'Error enviando mensaje de bienvenida' };
  }
}

/**
 * Send welcome message via WhatsApp using template
 */
async function sendWhatsAppWelcome(params: {
  phone: string;
  organizationId: string;
  userName: string;
  orgName: string;
  roleName: string;
  verificationCode?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getWhatsAppConfig(params.organizationId);

    if (!config) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    // Use employee_welcome template with verification code
    await sendTemplateMessage(config, params.phone, 'employee_welcome', {
      '1': params.userName,
      '2': params.orgName,
      '3': params.roleName,
      '4': params.verificationCode || '------',
    });

    return { success: true };
  } catch (error) {
    log.warn('WhatsApp welcome failed', {
      phone: params.phone,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send welcome message via SMS (fallback)
 */
async function sendSmsWelcome(params: {
  phone: string;
  userName: string;
  orgName: string;
  verificationCode?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Dynamic import to avoid circular dependencies
    const { getOrCreateSMSProvider } = await import('../../../lib/sms');
    const smsProvider = getOrCreateSMSProvider();

    let message = `¡Hola ${params.userName}! Fuiste agregado al equipo de ${params.orgName}. `;
    message += 'Descargá la app CampoTech para gestionar tus trabajos.';

    if (params.verificationCode) {
      message += ` Tu código de verificación es: ${params.verificationCode}`;
    }

    const result = await smsProvider.sendSMS(params.phone, message);
    return { success: result.success, error: result.error };
  } catch (error) {
    log.warn('SMS welcome failed', {
      phone: params.phone,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get human-readable role name in Spanish
 */
function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    DISPATCHER: 'Despachador',
    TECHNICIAN: 'Técnico',
    VIEWER: 'Visualizador',
  };
  return roleNames[role] || role;
}

/**
 * Send welcome message with verification code (combined flow)
 */
export async function sendWelcomeWithVerification(
  userId: string,
  organizationId: string,
  userName: string,
  userPhone: string,
  userRole: string
): Promise<WelcomeMessageResult & { verificationCode?: string; expiresAt?: Date }> {
  try {
    // Import verification service dynamically to avoid circular deps
    const { sendVerificationCode } = await import('./employee-verification.service');

    // Send verification code first (this also generates the code)
    const verificationResult = await sendVerificationCode(userId, organizationId, true);

    if (verificationResult.success) {
      // Verification code was sent via WhatsApp or SMS by the verification service
      return {
        success: true,
        channel: 'whatsapp', // Assumed WhatsApp-first
        expiresAt: verificationResult.expiresAt,
      };
    }

    // Fallback: Send just welcome message without verification
    const welcomeResult = await sendWelcomeMessage({
      userId,
      organizationId,
      userName,
      userPhone,
      userRole,
    });

    return welcomeResult;
  } catch (error) {
    log.error('Error in welcome with verification flow', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, channel: 'none', error: 'Error en flujo de bienvenida' };
  }
}
