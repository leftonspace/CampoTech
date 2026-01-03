/**
 * CampoTech Queue Processors (Phase 6.2.1)
 * =========================================
 *
 * Job processors that integrate the queue system with existing services:
 * - Email: Send emails via Resend
 * - WhatsApp: Send messages via Meta Cloud API
 * - WhatsApp AI: Process incoming messages with GPT-4o-mini
 * - Voice Transcription: Transcribe audio with Whisper
 * - AFIP Invoice: Generate electronic invoices (stub)
 * - Notifications: Job status notifications
 *
 * Usage:
 * ```typescript
 * import { registerAllProcessors } from '@/lib/queue/processors';
 *
 * // Register all processors before starting workers
 * registerAllProcessors();
 * await startWorkers(['realtime', 'background']);
 * ```
 */

import { type JobResult } from './config';
import { registerHandler, type JobHandler } from './workers';
import { getOrCreateEmailProvider, type EmailOptions } from '../email';
import { getOrCreateWhatsAppProvider } from '../whatsapp';
import {
  getWhatsAppAIResponder,
  getAIConfiguration,
  getConversationContext,
  type IncomingMessage,
} from '../services/whatsapp-ai-responder';
import { prisma } from '../prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL PROCESSORS
// ═══════════════════════════════════════════════════════════════════════════════

interface EmailJobData {
  to: string | string[];
  subject: string;
  html?: string;
  body?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
  replyTo?: string;
}

/**
 * Send single email
 */
const emailSendHandler: JobHandler<EmailJobData> = async (job) => {
  const { to, subject, html, body, text, replyTo } = job.data;

  try {
    const emailProvider = getOrCreateEmailProvider();

    const emailOptions: EmailOptions = {
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || body || '<p>No content</p>',
      text,
      replyTo,
    };

    const result = await emailProvider.sendEmail(emailOptions);

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    return {
      success: true,
      jobId: job.id,
      data: { messageId: result.messageId },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

/**
 * Send bulk emails
 */
const emailBulkHandler: JobHandler<EmailJobData> = async (job) => {
  const { to, subject, html, body, text, replyTo } = job.data;
  const recipients = Array.isArray(to) ? to : [to];

  try {
    const emailProvider = getOrCreateEmailProvider();
    const results: { email: string; success: boolean; messageId?: string; error?: string }[] = [];

    // Send emails in batches of 10
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await emailProvider.sendEmail({
            to: [email],
            subject,
            html: html || body || '<p>No content</p>',
            text,
            replyTo,
          });
          return { email, ...result };
        })
      );
      results.push(...batchResults);
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      success: failCount === 0,
      jobId: job.id,
      data: {
        total: recipients.length,
        sent: successCount,
        failed: failCount,
        results,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP PROCESSORS
// ═══════════════════════════════════════════════════════════════════════════════

interface WhatsAppSendData {
  to: string;
  message: string;
  organizationId?: string;
}

interface WhatsAppTemplateData {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: { type: string; text?: string; image?: { link: string } }[];
  }>;
  organizationId?: string;
}

/**
 * Send WhatsApp text message
 */
const whatsappSendHandler: JobHandler<WhatsAppSendData> = async (job) => {
  const { to, message } = job.data;

  try {
    const provider = getOrCreateWhatsAppProvider();
    const result = await provider.sendMessage(to, message);

    if (!result.success) {
      throw new Error(result.error || 'Failed to send WhatsApp message');
    }

    return {
      success: true,
      jobId: job.id,
      data: { messageId: result.messageId },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

/**
 * Send WhatsApp template message
 */
const whatsappTemplateHandler: JobHandler<WhatsAppTemplateData> = async (job) => {
  const { to, templateName, languageCode = 'es_AR', components } = job.data;

  try {
    const provider = getOrCreateWhatsAppProvider();
    const result = await provider.sendTemplate(to, templateName, languageCode, components);

    if (!result.success) {
      throw new Error(result.error || 'Failed to send WhatsApp template');
    }

    return {
      success: true,
      jobId: job.id,
      data: { messageId: result.messageId },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP AI PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * WhatsApp AI process data matches IncomingMessage
 */
type WhatsAppAIProcessData = IncomingMessage;

/**
 * Process incoming WhatsApp message with AI
 */
const whatsappAIProcessHandler: JobHandler<WhatsAppAIProcessData> = async (job) => {
  const message = job.data;

  try {
    // Get AI configuration for the organization
    const config = await getAIConfiguration(message.organizationId);
    if (!config || !config.isEnabled) {
      return {
        success: true,
        jobId: job.id,
        data: { action: 'skipped', reason: 'AI not enabled' },
      };
    }

    // Get conversation context
    const context = await getConversationContext(message.conversationId);

    // Process message with AI
    const responder = getWhatsAppAIResponder();
    const aiResponse = await responder.processMessage(message, config, context);

    // If AI generated a response, send it
    if (aiResponse.action === 'respond' && aiResponse.response) {
      const provider = getOrCreateWhatsAppProvider();
      await provider.sendMessage(message.customerPhone, aiResponse.response);
    }

    return {
      success: true,
      jobId: job.id,
      data: {
        action: aiResponse.action,
        intent: aiResponse.analysis.intent,
        confidence: aiResponse.analysis.confidence,
        jobCreated: aiResponse.jobCreated,
        logId: aiResponse.logId,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE TRANSCRIPTION PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

interface VoiceTranscribeData {
  audioUrl: string;
  language?: string;
  organizationId?: string;
  conversationId?: string;
  messageId?: string;
}

/**
 * Transcribe voice message with Whisper
 */
const voiceTranscribeHandler: JobHandler<VoiceTranscribeData> = async (job) => {
  const { audioUrl, language = 'es' } = job.data;

  try {
    // Import OpenAI dynamically
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Download audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' });

    // Transcribe with Whisper
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language,
      response_format: 'text',
    });

    return {
      success: true,
      jobId: job.id,
      data: {
        text: transcription,
        language,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE PROCESSORS
// ═══════════════════════════════════════════════════════════════════════════════

interface InvoiceGenerateData {
  invoiceId: string;
  organizationId: string;
  customerId?: string;
  format?: 'pdf' | 'html';
}

interface AFIPInvoiceData {
  invoiceId: string;
  organizationId: string;
  invoiceType: 'A' | 'B' | 'C';
  cuit: string;
  pointOfSale: number;
  // Add more AFIP-specific fields as needed
}

/**
 * Generate invoice PDF
 */
const invoiceGenerateHandler: JobHandler<InvoiceGenerateData> = async (job) => {
  const { invoiceId, organizationId } = job.data;

  try {
    // TODO: Implement actual PDF generation
    // For now, this is a stub that logs the operation
    console.log(`[Invoice] Generating invoice ${invoiceId} for org ${organizationId}`);

    // Fetch invoice data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    // TODO: Generate PDF using pdfkit or similar
    // For now, just return success with invoice data
    return {
      success: true,
      jobId: job.id,
      data: {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        status: 'generated',
        // pdfUrl: 'https://...' // Would contain actual PDF URL
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

/**
 * Generate AFIP electronic invoice
 */
const afipInvoiceHandler: JobHandler<AFIPInvoiceData> = async (job) => {
  const { invoiceId, organizationId: _organizationId, invoiceType, cuit, pointOfSale } = job.data;

  try {
    // TODO: Implement actual AFIP integration
    // This requires:
    // 1. AFIP certificates (stored in organization settings)
    // 2. WSAA authentication (web service de autenticación)
    // 3. WSFE or WSFEX call (web service de facturación electrónica)

    console.log(`[AFIP] Generating electronic invoice ${invoiceId}`);
    console.log(`[AFIP] Type: ${invoiceType}, CUIT: ${cuit}, POS: ${pointOfSale}`);

    // Fetch invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: true,
        organization: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    // TODO: Implement AFIP WSFE call
    // For now, return stub success
    return {
      success: true,
      jobId: job.id,
      data: {
        invoiceId,
        cae: 'STUB_CAE_12345678901234', // Would be actual CAE from AFIP
        caeExpirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'approved',
        message: 'STUB: AFIP integration pending implementation',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// JOB STATUS NOTIFICATION PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

interface JobStatusNotifyData {
  jobId: string;
  oldStatus: string;
  newStatus: string;
  organizationId: string;
  customerId?: string;
  technicianId?: string;
  customerPhone?: string;
  technicianPhone?: string;
}

/**
 * Send notifications when job status changes
 */
const jobStatusNotifyHandler: JobHandler<JobStatusNotifyData> = async (job) => {
  const {
    jobId,
    oldStatus,
    newStatus,
    customerPhone,
    technicianPhone,
  } = job.data;

  try {
    const provider = getOrCreateWhatsAppProvider();
    const notifications: { to: string; message: string; sent: boolean }[] = [];

    // Get job details for notification message
    const jobRecord = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        organization: true,
        assignedTo: true,
      },
    });

    if (!jobRecord) {
      throw new Error(`Job ${jobId} not found`);
    }

    const companyName = jobRecord.organization?.name || 'CampoTech';

    // Define status messages
    const statusMessages: Record<string, { customer?: string; technician?: string }> = {
      ASSIGNED: {
        customer: `Tu servicio con ${companyName} ha sido asignado a un técnico. Te avisaremos cuando esté en camino.`,
        technician: `Se te ha asignado un nuevo trabajo. Revisa los detalles en la app.`,
      },
      EN_ROUTE: {
        customer: `¡Buenas noticias! El técnico de ${companyName} está en camino. Llegará en breve.`,
      },
      ARRIVED: {
        customer: `El técnico ha llegado a tu ubicación.`,
      },
      IN_PROGRESS: {
        customer: `El trabajo está en progreso. Te notificaremos cuando esté completado.`,
      },
      COMPLETED: {
        customer: `Tu servicio con ${companyName} ha sido completado. ¡Gracias por elegirnos! ¿Te gustaría calificar el servicio?`,
      },
      CANCELLED: {
        customer: `Tu servicio con ${companyName} ha sido cancelado. Si tenés dudas, contactanos.`,
        technician: `El trabajo ha sido cancelado.`,
      },
    };

    const messages = statusMessages[newStatus];

    // Send customer notification
    if (messages?.customer && customerPhone) {
      const result = await provider.sendMessage(customerPhone, messages.customer);
      notifications.push({
        to: customerPhone,
        message: messages.customer,
        sent: result.success,
      });
    }

    // Send technician notification
    if (messages?.technician && technicianPhone) {
      const result = await provider.sendMessage(technicianPhone, messages.technician);
      notifications.push({
        to: technicianPhone,
        message: messages.technician,
        sent: result.success,
      });
    }

    return {
      success: true,
      jobId: job.id,
      data: {
        jobId,
        transition: `${oldStatus} -> ${newStatus}`,
        notificationsSent: notifications.filter((n) => n.sent).length,
        notifications,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATION PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

interface PushNotificationData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  organizationId?: string;
}

/**
 * Send push notification
 */
const pushNotificationHandler: JobHandler<PushNotificationData> = async (job) => {
  const { userId, title, body, data } = job.data;

  try {
    // TODO: Implement actual push notification via Firebase/OneSignal
    console.log(`[Push] Sending notification to user ${userId}`);
    console.log(`[Push] Title: ${title}`);
    console.log(`[Push] Body: ${body}`);
    console.log(`[Push] Data: ${JSON.stringify(data)}`);

    // For now, create in-app notification in database
    await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: 'push',
        data: data ? JSON.stringify(data) : null,
        read: false,
      },
    });

    return {
      success: true,
      jobId: job.id,
      data: { userId, notified: true },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

/**
 * Create in-app notification
 */
const inAppNotificationHandler: JobHandler<PushNotificationData> = async (job) => {
  const { userId, title, body, data } = job.data;

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: 'in_app',
        data: data ? JSON.stringify(data) : null,
        read: false,
      },
    });

    return {
      success: true,
      jobId: job.id,
      data: { notificationId: notification.id },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

interface WebhookData {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body: unknown;
  timeout?: number;
}

/**
 * Send webhook to external service
 */
const webhookHandler: JobHandler<WebhookData> = async (job) => {
  const { url, method = 'POST', headers = {}, body, timeout = 30000 } = job.data;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.text();

    return {
      success: true,
      jobId: job.id,
      data: {
        status: response.status,
        response: responseData.substring(0, 1000), // Limit response size
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      jobId: job.id,
      error: errorMessage,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register all job processors
 * Call this before starting workers
 */
export function registerAllProcessors(): void {
  // Email
  registerHandler('email.send', emailSendHandler);
  registerHandler('email.bulk', emailBulkHandler);

  // WhatsApp
  registerHandler('whatsapp.send', whatsappSendHandler);
  registerHandler('whatsapp.template', whatsappTemplateHandler);
  registerHandler('whatsapp.aiProcess', whatsappAIProcessHandler);

  // Voice
  registerHandler('voice.transcribe', voiceTranscribeHandler);

  // Invoices
  registerHandler('invoice.generate', invoiceGenerateHandler);
  registerHandler('invoice.afip', afipInvoiceHandler);

  // Notifications
  registerHandler('notification.push', pushNotificationHandler);
  registerHandler('notification.inApp', inAppNotificationHandler);
  registerHandler('job.statusNotify', jobStatusNotifyHandler);

  // Webhooks
  registerHandler('webhook.send', webhookHandler);

  console.log('[Queue] All processors registered');
}

// Export individual handlers for testing
export {
  emailSendHandler,
  emailBulkHandler,
  whatsappSendHandler,
  whatsappTemplateHandler,
  whatsappAIProcessHandler,
  voiceTranscribeHandler,
  invoiceGenerateHandler,
  afipInvoiceHandler,
  pushNotificationHandler,
  inAppNotificationHandler,
  jobStatusNotifyHandler,
  webhookHandler,
};

// Export types for use in dispatch calls
export type {
  EmailJobData,
  WhatsAppSendData,
  WhatsAppTemplateData,
  WhatsAppAIProcessData,
  VoiceTranscribeData,
  InvoiceGenerateData,
  AFIPInvoiceData,
  JobStatusNotifyData,
  PushNotificationData,
  WebhookData,
};
