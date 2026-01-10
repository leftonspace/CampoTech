/**
 * Phase 4.8: Credit Alert Email Templates
 * =========================================
 * 
 * Email templates for WhatsApp credit notifications:
 * - Low balance warnings (75%, 90%, 100%)
 * - Grace period activation
 * - Purchase confirmation
 */

import { getOrCreateEmailProvider } from '@/lib/email';

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate credit warning email HTML
 */
function generateCreditWarningHTML(data: {
    organizationName: string;
    threshold: string;
    remaining: number;
    buyUrl: string;
}): string {
    const { organizationName, threshold, remaining, buyUrl } = data;

    const urgency = threshold === '100%' ? 'URGENTE' : threshold === '90%' ? 'Importante' : 'Aviso';
    const color = threshold === '100%' ? '#dc2626' : threshold === '90%' ? '#ea580c' : '#d97706';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px;">
                            <h1 style="margin: 0; font-size: 24px; color: ${color};">
                                ⚠️ ${urgency}: Créditos de WhatsApp AI
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 20px;">
                                Hola ${organizationName},
                            </p>
                            
                            <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 20px;">
                                ${threshold === '100%'
            ? `<strong style="color: ${color};">Te quedaste sin créditos de WhatsApp AI.</strong>`
            : `Ya usaste el <strong style="color: ${color};">${threshold}</strong> de tus créditos de WhatsApp AI.`
        }
                            </p>
                            
                            <!-- Stats Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="color: #92400e; font-size: 20px; font-weight: 700; margin: 0 0 8px;">
                                            ${remaining} créditos restantes
                                        </p>
                                        <p style="color: #92400e; font-size: 14px; margin: 0;">
                                            ${threshold === '100%'
            ? remaining === 0
                ? '💡 Se activarán 50 créditos de emergencia (uso único) en la próxima conversación.'
                : 'Estás usando los créditos de emergencia (uso único).'
            : '1 crédito = 1 conversación de WhatsApp con IA'
        }
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            ${threshold === '100%' ? `
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fee2e2; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 22px;">
                                            <strong>⚠️ Importante:</strong> Los créditos de emergencia se activan <strong>una sola vez</strong>. 
                                            Cuando se agoten, tu WhatsApp volverá al modo gratuito (link directo a tu número personal).
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            ` : ''}
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 32px 0;">
                                        <a href="${buyUrl}" 
                                           style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; font-size: 18px; font-weight: 700; text-decoration: none; padding: 16px 48px; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                                            💳 Comprar más créditos
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6b7280; font-size: 14px; line-height: 22px; margin: 0;">
                                Los créditos no vencen y podés comprarlos cuando quieras. 
                                Paquetes desde 200 créditos.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 40px; border-top: 1px solid #e5e7eb; margin-top: 40px;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                © 2026 CampoTech. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/**
 * Generate grace period activation email HTML
 */
function generateGraceActivatedHTML(data: {
    organizationName: string;
    graceCredits: number;
    buyUrl: string;
}): string {
    const { organizationName, graceCredits, buyUrl } = data;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f9fc; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px;">
                            <h1 style="margin: 0; font-size: 24px; color: #059669;">
                                🎁 Créditos de Emergencia Activados
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 20px;">
                                Hola ${organizationName},
                            </p>
                            
                            <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 20px;">
                                Te quedaste sin créditos de WhatsApp AI, pero <strong>no te preocupes</strong> — activamos automáticamente <strong>${graceCredits} créditos de emergencia</strong> para que sigas trabajando sin interrupciones.
                            </p>
                            
                            <!-- Stats Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="color: #059669; font-size: 20px; font-weight: 700; margin: 0 0 12px;">
                                            ✅ ${graceCredits} créditos de emergencia disponibles
                                        </p>
                                        <p style="color: #047857; font-size: 14px; margin: 0 0 8px;">
                                            • Tu AI WhatsApp sigue funcionando normalmente
                                        </p>
                                        <p style="color: #047857; font-size: 14px; margin: 0 0 8px;">
                                            • Podés seguir recibiendo y respondiendo mensajes
                                        </p>
                                        <p style="color: #047857; font-size: 14px; margin: 0;">
                                            • No perdés ninguna conversación
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Warning Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px;">
                                            ⚠️ Importante - Léelo con atención:
                                        </p>
                                        <p style="color: #92400e; font-size: 14px; margin: 0 0 8px; line-height: 22px;">
                                            • <strong>Estos créditos se pueden usar UNA SOLA VEZ.</strong> No se renuevan.
                                        </p>
                                        <p style="color: #92400e; font-size: 14px; margin: 0 0 8px; line-height: 22px;">
                                            • Si comprás créditos antes de usar todos los de emergencia, los que queden se pierden.
                                        </p>
                                        <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 22px;">
                                            • Cuando se agoten, tu WhatsApp volverá al modo gratuito (link a tu número personal).
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 32px 0;">
                                        <a href="${buyUrl}" 
                                           style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; font-size: 18px; font-weight: 700; text-decoration: none; padding: 16px 48px; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                                            💳 Comprar créditos ahora
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6b7280; font-size: 14px; line-height: 22px; margin: 0; text-align: center;">
                                Paquetes desde $12.000 (200 créditos) • Sin vencimiento
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 40px; border-top: 1px solid #e5e7eb; margin-top: 40px;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                © 2026 CampoTech. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL SENDING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreditWarningEmailData {
    to: string;
    organizationName: string;
    threshold: string;
    remaining: number;
}

export interface GraceActivatedEmailData {
    to: string;
    organizationName: string;
    graceCredits: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com.ar';
const BUY_CREDITS_URL = `${BASE_URL}/dashboard/configuracion/creditos`;

/**
 * Send credit warning email
 */
export async function sendCreditWarningEmail(data: CreditWarningEmailData) {
    const emailProvider = getOrCreateEmailProvider();

    const html = generateCreditWarningHTML({
        organizationName: data.organizationName,
        threshold: data.threshold,
        remaining: data.remaining,
        buyUrl: BUY_CREDITS_URL,
    });

    const subject = data.threshold === '100%'
        ? '🚨 Sin créditos de WhatsApp AI - Activando emergencia'
        : `⚠️ Créditos de WhatsApp AI: ${data.threshold} usado`;

    return emailProvider.sendEmail({
        to: data.to,
        subject,
        html,
        text: `Hola ${data.organizationName},\n\nYa usaste el ${data.threshold} de tus créditos de WhatsApp AI. Te quedan ${data.remaining} créditos.\n\nPodés comprar más créditos en: ${BUY_CREDITS_URL}\n\n© 2026 CampoTech`,
    });
}

/**
 * Send grace period activation email
 */
export async function sendGraceActivatedEmail(data: GraceActivatedEmailData) {
    const emailProvider = getOrCreateEmailProvider();

    const html = generateGraceActivatedHTML({
        organizationName: data.organizationName,
        graceCredits: data.graceCredits,
        buyUrl: BUY_CREDITS_URL,
    });

    return emailProvider.sendEmail({
        to: data.to,
        subject: '🎁 Créditos de Emergencia Activados - WhatsApp AI',
        html,
        text: `Hola ${data.organizationName},\n\nActivamos ${data.graceCredits} créditos de emergencia para tu WhatsApp AI (uso único).\n\nTu AI sigue funcionando normalmente. Podés comprar más créditos en: ${BUY_CREDITS_URL}\n\n⚠️ Importante: Estos créditos se pueden usar UNA SOLA VEZ. No se renuevan.\n\n© 2026 CampoTech`,
    });
}
