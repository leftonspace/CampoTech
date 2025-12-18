/**
 * AI Responder Integration
 * ========================
 *
 * Integrates the WhatsApp AI Responder with the message processing pipeline.
 * Handles tier-based feature gating, confidence routing, and response sending.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { sendTextMessage } from '../messages/text.sender';
import { getWhatsAppConfig } from '../whatsapp.service';
import { InboundMessage } from '../whatsapp.types';
import OpenAI from 'openai';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AIConfiguration {
  id: string;
  organizationId: string;
  isEnabled: boolean;
  autoResponseEnabled: boolean;
  minConfidenceToRespond: number;
  minConfidenceToCreateJob: number;
  companyName: string | null;
  companyDescription: string | null;
  servicesOffered: ServiceInfo[];
  businessHours: Record<string, { open: string; close: string } | null>;
  serviceAreas: string | null;
  pricingInfo: string | null;
  cancellationPolicy: string | null;
  paymentMethods: string | null;
  warrantyInfo: string | null;
  faqItems: FAQItem[];
  customInstructions: string | null;
  aiTone: string;
  greetingMessage: string | null;
  awayMessage: string | null;
  transferKeywords: string[];
  escalationUserId: string | null;
}

interface ServiceInfo {
  name: string;
  description: string;
  priceRange?: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface ConversationMessage {
  role: 'customer' | 'assistant' | 'agent';
  content: string;
  timestamp: Date;
}

interface AIAnalysis {
  intent: string;
  confidence: number;
  extractedEntities: Record<string, unknown>;
  suggestedResponse: string;
  shouldCreateJob: boolean;
  shouldTransfer: boolean;
  transferReason?: string;
  warnings: string[];
}

// Rate limiting
const recentAIResponses = new Map<string, number>();
const AI_RESPONSE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes between AI responses

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PROCESSING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process incoming message with AI and send response if appropriate
 */
export async function processAIResponse(
  organizationId: string,
  conversationId: string,
  message: InboundMessage,
  textContent: string,
  contactName?: string
): Promise<void> {
  // Check if AI is enabled for this organization
  const aiConfig = await getAIConfiguration(organizationId);
  if (!aiConfig || !aiConfig.isEnabled) {
    return;
  }

  // Check tier-based feature access
  const hasAIAccess = await checkTierAccess(organizationId);
  if (!hasAIAccess) {
    log.debug('Organization does not have AI access', { organizationId });
    return;
  }

  // Check rate limiting
  if (isRateLimited(message.from)) {
    log.debug('AI response rate limited', { phone: message.from });
    return;
  }

  // Get WhatsApp config for sending responses
  const waConfig = await getWhatsAppConfig(organizationId);
  if (!waConfig) {
    log.warn('No WhatsApp config for AI responder', { organizationId });
    return;
  }

  // Get conversation context
  const context = await getConversationContext(conversationId, organizationId);

  // Check for transfer keywords first
  if (shouldTransferByKeyword(textContent, aiConfig.transferKeywords)) {
    await handleTransfer(
      organizationId,
      conversationId,
      message.from,
      'Palabra clave de transferencia detectada',
      aiConfig.escalationUserId
    );
    return;
  }

  // Process with AI
  const analysis = await analyzeWithAI(textContent, aiConfig, context);

  // Log the interaction
  await logAIInteraction(
    organizationId,
    conversationId,
    message.id,
    textContent,
    message.type,
    analysis
  );

  // Decide action based on confidence
  if (analysis.shouldTransfer || analysis.confidence < aiConfig.minConfidenceToRespond) {
    await handleTransfer(
      organizationId,
      conversationId,
      message.from,
      analysis.transferReason || 'Confianza insuficiente',
      aiConfig.escalationUserId
    );
    return;
  }

  // Auto-respond if enabled
  if (aiConfig.autoResponseEnabled && analysis.suggestedResponse) {
    // Handle job creation if needed
    if (analysis.shouldCreateJob) {
      if (analysis.confidence >= aiConfig.minConfidenceToCreateJob) {
        // Auto-create job
        const job = await createJobFromAI(
          organizationId,
          message.from,
          analysis,
          contactName
        );
        if (job) {
          const responseWithJob = `${analysis.suggestedResponse}\n\n✅ Tu trabajo fue registrado con el número ${job.jobNumber}. Te contactaremos pronto para confirmar el horario.`;
          await sendAIResponse(waConfig, message.from, responseWithJob);
        } else {
          await sendAIResponse(waConfig, message.from, analysis.suggestedResponse);
        }
      } else {
        // Ask for confirmation
        const confirmationResponse = `${analysis.suggestedResponse}\n\n¿Querés que agendemos este servicio?`;
        await sendAIResponse(waConfig, message.from, confirmationResponse);
      }
    } else {
      // Normal response
      await sendAIResponse(waConfig, message.from, analysis.suggestedResponse);
    }

    // Mark as responded and set cooldown
    markResponded(message.from);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

async function analyzeWithAI(
  text: string,
  config: AIConfiguration,
  context: ConversationMessage[]
): Promise<AIAnalysis> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = buildSystemPrompt(config);
  const messages = buildConversationMessages(context, text);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty AI response');
    }

    const parsed = JSON.parse(content) as AIAnalysis;
    return {
      intent: parsed.intent || 'other',
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      extractedEntities: parsed.extractedEntities || {},
      suggestedResponse: parsed.suggestedResponse || '',
      shouldCreateJob: parsed.shouldCreateJob || false,
      shouldTransfer: parsed.shouldTransfer || false,
      transferReason: parsed.transferReason,
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    log.error('AI analysis failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return {
      intent: 'other',
      confidence: 0,
      extractedEntities: {},
      suggestedResponse: '',
      shouldCreateJob: false,
      shouldTransfer: true,
      transferReason: 'Error en análisis AI',
      warnings: ['AI analysis failed'],
    };
  }
}

function buildSystemPrompt(config: AIConfiguration): string {
  const toneInstructions: Record<string, string> = {
    friendly_professional: 'Sé amigable pero profesional. Usá "vos" en lugar de "tú". Sé cálido pero eficiente.',
    formal: 'Mantené un tono formal y respetuoso. Usá "usted" para dirigirte al cliente.',
    casual: 'Sé relajado y cercano, como hablando con un vecino. Usá expresiones argentinas naturales.',
  };

  const servicesText = config.servicesOffered.length > 0
    ? config.servicesOffered.map(s => `- ${s.name}: ${s.description}${s.priceRange ? ` (${s.priceRange})` : ''}`).join('\n')
    : 'No hay servicios configurados específicamente.';

  const faqText = config.faqItems.length > 0
    ? config.faqItems.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n')
    : '';

  return `Sos el asistente virtual de ${config.companyName || 'la empresa'} por WhatsApp.

SOBRE LA EMPRESA:
${config.companyDescription || 'Empresa de servicios técnicos.'}

SERVICIOS:
${servicesText}

ZONAS DE SERVICIO:
${config.serviceAreas || 'Consultar disponibilidad'}

PRECIOS:
${config.pricingInfo || 'Los precios varían según el trabajo.'}

MÉTODOS DE PAGO:
${config.paymentMethods || 'Efectivo, transferencia'}

${faqText ? `PREGUNTAS FRECUENTES:\n${faqText}` : ''}

${config.customInstructions ? `INSTRUCCIONES:\n${config.customInstructions}` : ''}

COMPORTAMIENTO:
1. ${toneInstructions[config.aiTone] || toneInstructions.friendly_professional}
2. Respondé SIEMPRE en español argentino.
3. Sé conciso - mensajes cortos para WhatsApp.
4. Si quieren agendar, pedí: servicio, dirección, fecha/hora.
5. Si no estás seguro, preguntá.
6. Si el cliente está enojado, sugerí transferir a humano.

RESPUESTA JSON:
{
  "intent": "booking|question|status|complaint|greeting|confirmation|cancellation|other",
  "confidence": 0-100,
  "extractedEntities": {"serviceType": null, "preferredDate": null, "address": null, "urgency": null, "problemDescription": null},
  "suggestedResponse": "Tu respuesta al cliente",
  "shouldCreateJob": true/false,
  "shouldTransfer": true/false,
  "transferReason": "razón si shouldTransfer",
  "warnings": []
}`;
}

function buildConversationMessages(
  context: ConversationMessage[],
  currentMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of context.slice(-10)) {
    if (msg.role === 'customer') {
      messages.push({ role: 'user', content: msg.content });
    } else {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }

  messages.push({ role: 'user', content: currentMessage });
  return messages;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function getAIConfiguration(organizationId: string): Promise<AIConfiguration | null> {
  try {
    const config = await db.aIConfiguration.findUnique({
      where: { organizationId },
    });
    if (!config) return null;

    return {
      ...config,
      servicesOffered: (config.servicesOffered as ServiceInfo[]) || [],
      businessHours: (config.businessHours as Record<string, { open: string; close: string } | null>) || {},
      faqItems: (config.faqItems as FAQItem[]) || [],
      transferKeywords: (config.transferKeywords as string[]) || [],
    };
  } catch (error) {
    log.error('Error getting AI config', { organizationId, error });
    return null;
  }
}

async function checkTierAccess(organizationId: string): Promise<boolean> {
  // Check subscription tier for AI access
  try {
    const subscription = await db.subscription.findFirst({
      where: { organizationId, status: 'ACTIVE' },
    });

    if (!subscription) return false;

    // AI is available for PROFESIONAL and EMPRESARIAL tiers
    return ['PROFESIONAL', 'EMPRESARIAL'].includes(subscription.tier);
  } catch {
    // If no subscription table or error, check feature flags
    return true; // Default to allowing for development
  }
}

async function getConversationContext(
  conversationId: string,
  organizationId: string
): Promise<ConversationMessage[]> {
  try {
    const messages = await db.waMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return messages.reverse().map((m: { direction: string; content: string | null; createdAt: Date }) => ({
      role: m.direction === 'inbound' ? 'customer' as const : 'assistant' as const,
      content: m.content || '',
      timestamp: m.createdAt,
    }));
  } catch {
    return [];
  }
}

function shouldTransferByKeyword(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

async function handleTransfer(
  organizationId: string,
  conversationId: string,
  customerPhone: string,
  reason: string,
  escalationUserId: string | null
): Promise<void> {
  log.info('Transferring conversation to human', {
    organizationId,
    conversationId,
    reason,
  });

  // Update conversation status
  await db.waConversation.update({
    where: { id: conversationId },
    data: {
      assignedToId: escalationUserId,
      // Mark as needing attention
    },
  });

  // Create notification for escalation user
  if (escalationUserId) {
    try {
      await db.notification.create({
        data: {
          userId: escalationUserId,
          type: 'ai_transfer',
          title: 'AI transfirió una conversación',
          message: `Motivo: ${reason}`,
          data: { conversationId, customerPhone, reason },
        },
      });
    } catch (error) {
      log.error('Failed to create transfer notification', { error });
    }
  }
}

async function createJobFromAI(
  organizationId: string,
  customerPhone: string,
  analysis: AIAnalysis,
  contactName?: string
): Promise<{ id: string; jobNumber: string } | null> {
  try {
    // Find or create customer
    let customer = await db.customer.findFirst({
      where: { organizationId, phone: customerPhone },
    });

    if (!customer) {
      customer = await db.customer.create({
        data: {
          organizationId,
          phone: customerPhone,
          name: contactName || 'Cliente WhatsApp',
          source: 'whatsapp_ai',
        },
      });
    }

    // Generate job number
    const jobCount = await db.job.count({ where: { organizationId } });
    const jobNumber = `JOB-${String(jobCount + 1).padStart(5, '0')}`;

    const entities = analysis.extractedEntities as {
      serviceType?: string;
      address?: string;
      problemDescription?: string;
      urgency?: string;
      preferredDate?: string;
    };

    // Create job
    const job = await db.job.create({
      data: {
        organizationId,
        customerId: customer.id,
        jobNumber,
        serviceType: entities.serviceType || 'otro',
        description: entities.problemDescription || 'Trabajo creado por AI',
        address: entities.address || customer.address,
        priority: entities.urgency === 'urgente' ? 'urgent' : 'normal',
        status: 'PENDING',
        source: 'whatsapp_ai',
        scheduledDate: entities.preferredDate ? new Date(entities.preferredDate) : undefined,
      },
    });

    log.info('Job created by AI', { jobId: job.id, jobNumber });
    return { id: job.id, jobNumber: job.jobNumber };
  } catch (error) {
    log.error('Failed to create job from AI', { error });
    return null;
  }
}

async function sendAIResponse(
  waConfig: {
    phoneNumberId: string;
    accessToken: string;
    businessAccountId?: string;
    webhookVerifyToken?: string;
    appSecret?: string;
    apiVersion?: string;
  },
  to: string,
  message: string
): Promise<void> {
  try {
    const config = {
      phoneNumberId: waConfig.phoneNumberId,
      accessToken: waConfig.accessToken,
      businessAccountId: waConfig.businessAccountId || '',
      webhookVerifyToken: waConfig.webhookVerifyToken || '',
      appSecret: waConfig.appSecret || '',
      apiVersion: waConfig.apiVersion || 'v18.0',
    };
    await sendTextMessage(config, to, message);
    log.info('AI response sent', { to, messageLength: message.length });
  } catch (error) {
    log.error('Failed to send AI response', { to, error });
  }
}

async function logAIInteraction(
  organizationId: string,
  conversationId: string,
  messageId: string,
  customerMessage: string,
  messageType: string,
  analysis: AIAnalysis
): Promise<void> {
  try {
    await db.aIConversationLog.create({
      data: {
        organizationId,
        conversationId,
        messageId,
        customerMessage,
        messageType,
        detectedIntent: analysis.intent,
        extractedEntities: analysis.extractedEntities,
        confidenceScore: analysis.confidence,
        aiResponse: analysis.suggestedResponse,
        responseStatus: analysis.shouldTransfer ? 'transferred' : 'sent',
        transferReason: analysis.transferReason,
      },
    });
  } catch (error) {
    log.error('Failed to log AI interaction', { error });
  }
}

function isRateLimited(phone: string): boolean {
  const lastResponse = recentAIResponses.get(phone);
  if (!lastResponse) return false;
  return Date.now() - lastResponse < AI_RESPONSE_COOLDOWN_MS;
}

function markResponded(phone: string): void {
  recentAIResponses.set(phone, Date.now());
  // Clean up old entries periodically
  if (recentAIResponses.size > 1000) {
    const cutoff = Date.now() - AI_RESPONSE_COOLDOWN_MS;
    for (const [key, value] of recentAIResponses.entries()) {
      if (value < cutoff) {
        recentAIResponses.delete(key);
      }
    }
  }
}
