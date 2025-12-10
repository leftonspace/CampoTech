/**
 * Customer Portal Auth Provider Adapters
 * =======================================
 *
 * Email and SMS provider implementations for customer authentication.
 */

import {
  CustomerEmailProvider,
  CustomerSMSProvider,
} from '../customer-auth.types';

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL PROVIDER (NODEMAILER)
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Nodemailer-based email provider for magic links
 */
export class NodemailerEmailProvider implements CustomerEmailProvider {
  private config: EmailConfig;
  private transporter: any; // nodemailer transporter

  constructor(config: EmailConfig) {
    this.config = config;
    // Lazy load nodemailer to avoid issues if not installed
    try {
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });
    } catch (error) {
      console.warn('[EmailProvider] Nodemailer not available, using mock provider');
      this.transporter = null;
    }
  }

  async sendMagicLinkEmail(
    email: string,
    magicLinkUrl: string,
    orgName: string,
    expiresInMinutes: number
  ): Promise<boolean> {
    const subject = `Ingresá a tu cuenta de ${orgName}`;
    const html = this.buildMagicLinkEmailHtml(magicLinkUrl, orgName, expiresInMinutes);
    const text = this.buildMagicLinkEmailText(magicLinkUrl, orgName, expiresInMinutes);

    if (!this.transporter) {
      // Mock mode - log and return success
      console.log(`[EmailProvider][MOCK] Sending magic link to ${email}`);
      console.log(`[EmailProvider][MOCK] Link: ${magicLinkUrl}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: email,
        subject,
        text,
        html,
      });
      return true;
    } catch (error) {
      console.error('[EmailProvider] Failed to send magic link email:', error);
      return false;
    }
  }

  private buildMagicLinkEmailHtml(
    magicLinkUrl: string,
    orgName: string,
    expiresInMinutes: number
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ingresá a tu cuenta</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin-bottom: 10px;">${orgName}</h1>
  </div>

  <div style="background-color: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
    <h2 style="margin-top: 0; color: #111827;">¡Hola!</h2>
    <p>Recibimos una solicitud para ingresar a tu cuenta en ${orgName}.</p>
    <p>Hacé clic en el botón de abajo para ingresar:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLinkUrl}"
         style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">
        Ingresar a mi cuenta
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Este enlace expira en ${expiresInMinutes} minutos.
    </p>
  </div>

  <div style="color: #6b7280; font-size: 12px; text-align: center;">
    <p>Si no solicitaste este enlace, podés ignorar este email.</p>
    <p>Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
    <p style="word-break: break-all; color: #2563eb;">${magicLinkUrl}</p>
  </div>
</body>
</html>
    `.trim();
  }

  private buildMagicLinkEmailText(
    magicLinkUrl: string,
    orgName: string,
    expiresInMinutes: number
  ): string {
    return `
¡Hola!

Recibimos una solicitud para ingresar a tu cuenta en ${orgName}.

Usá este enlace para ingresar:
${magicLinkUrl}

Este enlace expira en ${expiresInMinutes} minutos.

Si no solicitaste este enlace, podés ignorar este email.

- El equipo de ${orgName}
    `.trim();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMS PROVIDER (TWILIO)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * Twilio-based SMS provider for OTPs
 */
export class TwilioSMSProvider implements CustomerSMSProvider {
  private config: TwilioConfig;
  private client: any; // Twilio client

  constructor(config: TwilioConfig) {
    this.config = config;
    // Lazy load Twilio to avoid issues if not installed
    try {
      const twilio = require('twilio');
      this.client = twilio(config.accountSid, config.authToken);
    } catch (error) {
      console.warn('[SMSProvider] Twilio not available, using mock provider');
      this.client = null;
    }
  }

  async sendOTP(phone: string, code: string, orgName: string): Promise<boolean> {
    const message = `Tu código de verificación de ${orgName} es: ${code}. Válido por 5 minutos.`;

    if (!this.client) {
      // Mock mode - log and return success
      console.log(`[SMSProvider][MOCK] Sending OTP to ${phone}`);
      console.log(`[SMSProvider][MOCK] Code: ${code}`);
      return true;
    }

    try {
      await this.client.messages.create({
        body: message,
        from: this.config.fromNumber,
        to: phone,
      });
      return true;
    } catch (error) {
      console.error('[SMSProvider] Failed to send OTP SMS:', error);
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP PROVIDER (ALTERNATIVE TO SMS)
// ═══════════════════════════════════════════════════════════════════════════════

export interface WhatsAppConfig {
  apiUrl: string;
  accessToken: string;
  phoneNumberId: string;
}

/**
 * WhatsApp-based provider for OTPs (preferred in Argentina)
 */
export class WhatsAppOTPProvider implements CustomerSMSProvider {
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  async sendOTP(phone: string, code: string, orgName: string): Promise<boolean> {
    // Format phone for WhatsApp (remove + prefix)
    const formattedPhone = phone.replace(/^\+/, '');

    try {
      const response = await fetch(
        `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'template',
            template: {
              name: 'customer_otp',
              language: { code: 'es_AR' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: code },
                    { type: 'text', text: '5' }, // minutes
                  ],
                },
                {
                  type: 'button',
                  sub_type: 'url',
                  index: 0,
                  parameters: [
                    { type: 'text', text: code },
                  ],
                },
              ],
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[WhatsAppOTP] Failed to send OTP:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[WhatsAppOTP] Failed to send OTP:', error);
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK PROVIDERS (FOR TESTING)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mock email provider for testing
 */
export class MockEmailProvider implements CustomerEmailProvider {
  private sentEmails: Array<{
    email: string;
    magicLinkUrl: string;
    orgName: string;
    sentAt: Date;
  }> = [];

  async sendMagicLinkEmail(
    email: string,
    magicLinkUrl: string,
    orgName: string,
    expiresInMinutes: number
  ): Promise<boolean> {
    this.sentEmails.push({
      email,
      magicLinkUrl,
      orgName,
      sentAt: new Date(),
    });
    console.log(`[MockEmailProvider] Magic link sent to ${email}`);
    return true;
  }

  getSentEmails() {
    return this.sentEmails;
  }

  clearSentEmails() {
    this.sentEmails = [];
  }
}

/**
 * Mock SMS provider for testing
 */
export class MockSMSProvider implements CustomerSMSProvider {
  private sentMessages: Array<{
    phone: string;
    code: string;
    orgName: string;
    sentAt: Date;
  }> = [];

  async sendOTP(phone: string, code: string, orgName: string): Promise<boolean> {
    this.sentMessages.push({
      phone,
      code,
      orgName,
      sentAt: new Date(),
    });
    console.log(`[MockSMSProvider] OTP ${code} sent to ${phone}`);
    return true;
  }

  getSentMessages() {
    return this.sentMessages;
  }

  clearSentMessages() {
    this.sentMessages = [];
  }

  getLastOTPForPhone(phone: string): string | null {
    const messages = this.sentMessages.filter(m => m.phone === phone);
    if (messages.length === 0) return null;
    return messages[messages.length - 1].code;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function createEmailProvider(config?: EmailConfig): CustomerEmailProvider {
  if (config) {
    return new NodemailerEmailProvider(config);
  }
  return new MockEmailProvider();
}

export function createSMSProvider(
  type: 'twilio' | 'whatsapp' | 'mock',
  config?: TwilioConfig | WhatsAppConfig
): CustomerSMSProvider {
  switch (type) {
    case 'twilio':
      return new TwilioSMSProvider(config as TwilioConfig);
    case 'whatsapp':
      return new WhatsAppOTPProvider(config as WhatsAppConfig);
    case 'mock':
    default:
      return new MockSMSProvider();
  }
}
