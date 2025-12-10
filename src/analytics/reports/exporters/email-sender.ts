/**
 * Email Sender for Report Delivery
 * =================================
 *
 * Phase 10.3: Report Generation Engine
 * Multi-provider email delivery for scheduled reports.
 */

import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmailConfig {
  provider: 'resend' | 'sendgrid' | 'ses' | 'smtp' | 'mock';
  apiKey?: string;
  from: string;
  replyTo?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendReportEmailInput {
  to: string | string[];
  subject: string;
  reportName: string;
  reportPeriod: string;
  organizationName: string;
  attachment: EmailAttachment;
  customMessage?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: EmailConfig = {
  provider: 'mock',
  from: 'reportes@campotech.com',
  replyTo: 'soporte@campotech.com',
};

let emailConfig: EmailConfig = { ...DEFAULT_CONFIG };

export function configureEmailSender(config: Partial<EmailConfig>): void {
  emailConfig = { ...emailConfig, ...config };
  log.info('Email sender configured', { provider: emailConfig.provider });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

function generateReportEmailHTML(input: SendReportEmailInput): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .footer { background: #f1f5f9; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #64748b; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; }
    .info-box { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📊 ${input.reportName}</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Informe Automático - ${input.organizationName}</p>
    </div>
    <div class="content">
      <p>Hola,</p>
      <p>Se ha generado un nuevo informe para el período <strong>${input.reportPeriod}</strong>.</p>

      ${input.customMessage ? `<div class="info-box"><p>${input.customMessage}</p></div>` : ''}

      <div class="info-box">
        <p><strong>📎 Archivo adjunto:</strong> ${input.attachment.filename}</p>
        <p><strong>📅 Período:</strong> ${input.reportPeriod}</p>
        <p><strong>🕐 Generado:</strong> ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</p>
      </div>

      <p>Este informe fue generado automáticamente por el sistema de reportes de CampoTech.</p>
    </div>
    <div class="footer">
      <p>Este es un correo automático. Por favor no responda a este mensaje.</p>
      <p>© ${new Date().getFullYear()} CampoTech - Sistema de Gestión para Servicios de Campo</p>
    </div>
  </div>
</body>
</html>`;
}

function generateReportEmailText(input: SendReportEmailInput): string {
  return `
${input.reportName}
Informe Automático - ${input.organizationName}

Hola,

Se ha generado un nuevo informe para el período ${input.reportPeriod}.

${input.customMessage ? `Nota: ${input.customMessage}\n` : ''}

Detalles:
- Archivo adjunto: ${input.attachment.filename}
- Período: ${input.reportPeriod}
- Generado: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}

Este informe fue generado automáticamente por el sistema de reportes de CampoTech.

---
Este es un correo automático. Por favor no responda a este mensaje.
© ${new Date().getFullYear()} CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendWithResend(input: SendReportEmailInput): Promise<EmailResult> {
  try {
    const Resend = await import('resend').then(m => m.Resend).catch(() => null);
    if (!Resend || !emailConfig.apiKey) {
      throw new Error('Resend not available or API key not configured');
    }

    const resend = new Resend(emailConfig.apiKey);
    const recipients = Array.isArray(input.to) ? input.to : [input.to];

    const response = await resend.emails.send({
      from: emailConfig.from,
      to: recipients,
      replyTo: emailConfig.replyTo,
      subject: input.subject,
      html: generateReportEmailHTML(input),
      text: generateReportEmailText(input),
      attachments: [{
        filename: input.attachment.filename,
        content: input.attachment.content.toString('base64'),
      }],
    });

    return {
      success: true,
      messageId: response.data?.id,
      provider: 'resend',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'resend',
    };
  }
}

async function sendWithSendGrid(input: SendReportEmailInput): Promise<EmailResult> {
  try {
    const sgMail = await import('@sendgrid/mail').then(m => m.default).catch(() => null);
    if (!sgMail || !emailConfig.apiKey) {
      throw new Error('SendGrid not available or API key not configured');
    }

    sgMail.setApiKey(emailConfig.apiKey);
    const recipients = Array.isArray(input.to) ? input.to : [input.to];

    const response = await sgMail.send({
      from: emailConfig.from,
      to: recipients,
      replyTo: emailConfig.replyTo,
      subject: input.subject,
      html: generateReportEmailHTML(input),
      text: generateReportEmailText(input),
      attachments: [{
        filename: input.attachment.filename,
        content: input.attachment.content.toString('base64'),
        type: input.attachment.contentType,
        disposition: 'attachment',
      }],
    });

    return {
      success: true,
      messageId: response[0]?.headers?.['x-message-id'],
      provider: 'sendgrid',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'sendgrid',
    };
  }
}

async function sendWithSES(input: SendReportEmailInput): Promise<EmailResult> {
  try {
    const { SESClient, SendRawEmailCommand } = await import('@aws-sdk/client-ses').catch(() => ({ SESClient: null, SendRawEmailCommand: null }));
    if (!SESClient) {
      throw new Error('AWS SES SDK not available');
    }

    const client = new SESClient({});
    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    const boundary = `----=_Part_${Date.now()}`;

    const rawEmail = [
      `From: ${emailConfig.from}`,
      `To: ${recipients.join(', ')}`,
      `Subject: ${input.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      '',
      generateReportEmailHTML(input),
      '',
      `--${boundary}`,
      `Content-Type: ${input.attachment.contentType}; name="${input.attachment.filename}"`,
      `Content-Disposition: attachment; filename="${input.attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      '',
      input.attachment.content.toString('base64'),
      '',
      `--${boundary}--`,
    ].join('\r\n');

    const command = new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawEmail) },
    });

    const response = await client.send(command);

    return {
      success: true,
      messageId: response.MessageId,
      provider: 'ses',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'ses',
    };
  }
}

async function sendWithMock(input: SendReportEmailInput): Promise<EmailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];

  log.info('Mock email sent', {
    to: recipients,
    subject: input.subject,
    attachmentSize: input.attachment.content.length,
  });

  return {
    success: true,
    messageId: `mock_${Date.now()}`,
    provider: 'mock',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendReportEmail(input: SendReportEmailInput): Promise<EmailResult> {
  const startTime = Date.now();
  const recipients = Array.isArray(input.to) ? input.to : [input.to];

  log.info('Sending report email', {
    provider: emailConfig.provider,
    to: recipients,
    reportName: input.reportName,
  });

  let result: EmailResult;

  switch (emailConfig.provider) {
    case 'resend':
      result = await sendWithResend(input);
      break;
    case 'sendgrid':
      result = await sendWithSendGrid(input);
      break;
    case 'ses':
      result = await sendWithSES(input);
      break;
    case 'mock':
    default:
      result = await sendWithMock(input);
      break;
  }

  log.info('Report email result', {
    success: result.success,
    provider: result.provider,
    messageId: result.messageId,
    duration: Date.now() - startTime,
    error: result.error,
  });

  return result;
}

export function getEmailConfig(): EmailConfig {
  return { ...emailConfig };
}
