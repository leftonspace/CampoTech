/**
 * Email Service for CampoTech
 * Uses Resend for transactional emails
 *
 * Required environment variables:
 * - RESEND_API_KEY: Your Resend API key
 * - EMAIL_FROM: Sender email (e.g., "CampoTech <noreply@campotech.com>")
 */

export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<EmailResult>;
}

export interface EmailAttachment {
  /** Filename to display */
  filename: string;
  /** URL to fetch the file from (Resend will download it) */
  path?: string;
  /** Base64 encoded content (alternative to path) */
  content?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Resend Email Provider
class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    // Use Resend's free testing domain if no custom domain is configured
    // This works without domain verification: onboarding@resend.dev
    const from = process.env.EMAIL_FROM || 'CampoTech <onboarding@resend.dev>';

    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    this.apiKey = apiKey;
    this.from = from;
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
          // Resend supports attachments via URL (path) or base64 (content)
          attachments: options.attachments?.map((att) => ({
            filename: att.filename,
            path: att.path,
            content: att.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Resend API error:', data);
        return {
          success: false,
          error: data.message || 'Failed to send email',
        };
      }

      console.log(`Email sent successfully to ${options.to}, ID: ${data.id}`);
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send email:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// Console Email Provider for development/testing
class ConsoleEmailProvider implements EmailProvider {
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    console.log('========================================');
    console.log('EMAIL (DEV MODE - NOT ACTUALLY SENT)');
    console.log(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('----------------------------------------');
    console.log(options.text || 'See HTML content below');
    console.log('========================================');

    return {
      success: true,
      messageId: `dev-email-${Date.now()}`,
    };
  }
}

// Factory function to get the appropriate email provider
export function getEmailProvider(): EmailProvider {
  // In development without Resend API key, use console provider
  if (process.env.NODE_ENV === 'development' && !process.env.RESEND_API_KEY) {
    console.log('Using ConsoleEmailProvider (dev mode - emails will be logged to console)');
    return new ConsoleEmailProvider();
  }

  // Check if Resend is configured
  if (process.env.RESEND_API_KEY) {
    console.log('Using ResendEmailProvider');
    return new ResendEmailProvider();
  }

  // Fallback to console provider
  console.warn('Email not configured. Using ConsoleEmailProvider. Emails will only be logged to console.');
  return new ConsoleEmailProvider();
}

// Singleton instance
let emailProviderInstance: EmailProvider | null = null;

export function getOrCreateEmailProvider(): EmailProvider {
  if (!emailProviderInstance) {
    emailProviderInstance = getEmailProvider();
  }
  return emailProviderInstance;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

interface WelcomeEmailData {
  employeeName: string;
  organizationName: string;
  role: string;
  loginUrl: string;
  adminName?: string;
}

export function generateWelcomeEmailHTML(data: WelcomeEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 30px 20px;
      background: #ffffff;
    }
    .content h2 {
      color: #16a34a;
      margin-top: 0;
    }
    .info-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-item {
      display: flex;
      margin: 10px 0;
    }
    .info-label {
      font-weight: bold;
      color: #15803d;
      min-width: 100px;
    }
    .button {
      display: inline-block;
      background: #16a34a;
      color: white !important;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      margin: 20px 0;
    }
    .button:hover {
      background: #15803d;
    }
    .footer {
      background: #f8fafc;
      padding: 20px;
      border-radius: 0 0 8px 8px;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
    .steps {
      background: #fafafa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .step {
      display: flex;
      align-items: flex-start;
      margin: 15px 0;
    }
    .step-number {
      background: #16a34a;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 15px;
      flex-shrink: 0;
    }
    .step-text {
      flex: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bienvenido a CampoTech</h1>
      <p>Sistema de Gestion para Servicios de Campo</p>
    </div>
    <div class="content">
      <h2>Hola ${data.employeeName}!</h2>

      <p>Te damos la bienvenida al equipo de <strong>${data.organizationName}</strong>. Tu cuenta ha sido creada exitosamente.</p>

      <div class="info-box">
        <div class="info-item">
          <span class="info-label">Empresa:</span>
          <span>${data.organizationName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Tu Rol:</span>
          <span>${data.role}</span>
        </div>
      </div>

      <h3>Proximos pasos:</h3>
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-text">Recibiras un codigo de verificacion por WhatsApp para activar tu cuenta.</div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-text">Ingresa el codigo en la aplicacion para completar tu registro.</div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-text">Comenza a recibir y gestionar ordenes de trabajo asignadas.</div>
        </div>
      </div>

      <p style="text-align: center;">
        <a href="${data.loginUrl}" class="button">Ingresar a CampoTech</a>
      </p>

      <p><strong>Necesitas ayuda?</strong> Contacta a tu administrador${data.adminName ? ` (${data.adminName})` : ''} o responde a este correo.</p>
    </div>
    <div class="footer">
      <p>Este correo fue enviado automaticamente. Por favor no respondas directamente a este mensaje.</p>
      <p>&copy; ${new Date().getFullYear()} CampoTech - Sistema de Gestion para Servicios de Campo</p>
    </div>
  </div>
</body>
</html>`;
}

export function generateWelcomeEmailText(data: WelcomeEmailData): string {
  return `
Bienvenido a CampoTech!

Hola ${data.employeeName},

Te damos la bienvenida al equipo de ${data.organizationName}. Tu cuenta ha sido creada exitosamente.

DETALLES DE TU CUENTA:
- Empresa: ${data.organizationName}
- Tu Rol: ${data.role}

PROXIMOS PASOS:
1. Recibiras un codigo de verificacion por WhatsApp para activar tu cuenta.
2. Ingresa el codigo en la aplicacion para completar tu registro.
3. Comenza a recibir y gestionar ordenes de trabajo asignadas.

Para ingresar, visita: ${data.loginUrl}

Necesitas ayuda? Contacta a tu administrador${data.adminName ? ` (${data.adminName})` : ''}.

---
CampoTech - Sistema de Gestion para Servicios de Campo
`;
}

// Helper function to send welcome email
export async function sendWelcomeEmail(
  email: string,
  employeeName: string,
  organizationName: string,
  role: string,
  adminName?: string
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com';

  const roleDisplay: Record<string, string> = {
    'OWNER': 'Propietario',
    'DISPATCHER': 'Despachador',
    'TECHNICIAN': 'Técnico',
  };

  const data: WelcomeEmailData = {
    employeeName,
    organizationName,
    role: roleDisplay[role] || role,
    loginUrl,
    adminName,
  };

  return provider.sendEmail({
    to: email,
    subject: `Bienvenido a ${organizationName} - CampoTech`,
    html: generateWelcomeEmailHTML(data),
    text: generateWelcomeEmailText(data),
  });
}
