/**
 * WhatsApp AI Responder Service
 * ==============================
 *
 * Handles incoming WhatsApp messages with GPT-4o-mini powered responses.
 * Features:
 * - Intent detection (booking, question, complaint, greeting)
 * - Confidence-based routing (respond, confirm, or transfer to human)
 * - Context-aware responses using organization's AI configuration
 * - Voice note transcription via Whisper
 * - Argentinian Spanish natural language
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AIConfiguration {
  id: string;
  organizationId: string;
  isEnabled: boolean;
  autoResponseEnabled: boolean;
  minConfidenceToRespond: number;
  minConfidenceToCreateJob: number;
  companyName: string | null;
  companyDescription: string | null;
  servicesOffered: ServiceInfo[];
  businessHours: BusinessHours;
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

export interface ServiceInfo {
  name: string;
  description: string;
  priceRange?: string;
}

export interface BusinessHours {
  [day: string]: { open: string; close: string } | null;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface IncomingMessage {
  organizationId: string;
  conversationId: string;
  messageId: string;
  customerPhone: string;
  customerName?: string;
  messageType: 'text' | 'voice' | 'image';
  textContent?: string;
  audioUrl?: string;
  imageUrl?: string;
  imageCaption?: string;
}

export interface ConversationContext {
  recentMessages: Array<{
    role: 'customer' | 'assistant' | 'agent';
    content: string;
    timestamp: Date;
  }>;
  customer?: {
    name: string;
    phone: string;
    previousJobs?: number;
    lastServiceDate?: Date;
  };
  activeJob?: {
    id: string;
    status: string;
    serviceType: string;
    scheduledDate?: Date;
  };
}

export type DetectedIntent =
  | 'booking'      // Wants to schedule a service
  | 'question'     // Has a question about services/pricing/etc
  | 'status'       // Asking about existing job status
  | 'complaint'    // Unhappy about something
  | 'greeting'     // Just saying hi
  | 'confirmation' // Confirming something (yes/no response)
  | 'cancellation' // Wants to cancel
  | 'other';       // Unclear intent

export interface AIAnalysis {
  intent: DetectedIntent;
  confidence: number; // 0-100
  extractedEntities: {
    serviceType?: string;
    preferredDate?: string;
    preferredTime?: string;
    address?: string;
    urgency?: 'normal' | 'urgente';
    problemDescription?: string;
  };
  suggestedResponse: string;
  shouldCreateJob: boolean;
  shouldTransfer: boolean;
  transferReason?: string;
  warnings: string[];
}

export interface AIResponse {
  success: boolean;
  action: 'respond' | 'transfer' | 'confirm_job' | 'create_job' | 'blocked';
  response?: string;
  analysis: AIAnalysis;
  jobCreated?: {
    id: string;
    jobNumber: string;
  };
  transferTo?: string;
  logId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(config: AIConfiguration, context: ConversationContext): string {
  const toneInstructions = {
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

  const businessHoursText = Object.entries(config.businessHours)
    .filter(([, hours]) => hours !== null)
    .map(([day, hours]) => `${day}: ${hours!.open} - ${hours!.close}`)
    .join('\n') || 'Horarios no configurados';

  const customerContext = context.customer
    ? `
INFORMACIÓN DEL CLIENTE:
- Nombre: ${context.customer.name}
- Teléfono: ${context.customer.phone}
${context.customer.previousJobs ? `- Trabajos anteriores: ${context.customer.previousJobs}` : ''}
${context.customer.lastServiceDate ? `- Último servicio: ${context.customer.lastServiceDate.toLocaleDateString('es-AR')}` : ''}`
    : '';

  const activeJobContext = context.activeJob
    ? `
TRABAJO ACTIVO:
- ID: ${context.activeJob.id}
- Estado: ${context.activeJob.status}
- Tipo: ${context.activeJob.serviceType}
${context.activeJob.scheduledDate ? `- Fecha programada: ${context.activeJob.scheduledDate.toLocaleDateString('es-AR')}` : ''}`
    : '';

  return `Sos el asistente virtual de ${config.companyName || 'la empresa'} por WhatsApp.

SOBRE LA EMPRESA:
${config.companyDescription || 'Empresa de servicios técnicos.'}

SERVICIOS QUE OFRECEMOS:
${servicesText}

HORARIOS DE ATENCIÓN:
${businessHoursText}

ZONAS DE SERVICIO:
${config.serviceAreas || 'Consultar disponibilidad'}

INFORMACIÓN DE PRECIOS:
${config.pricingInfo || 'Los precios varían según el trabajo. Ofrecemos presupuesto sin cargo.'}

MÉTODOS DE PAGO:
${config.paymentMethods || 'Efectivo, transferencia bancaria'}

POLÍTICA DE CANCELACIÓN:
${config.cancellationPolicy || 'Cancelaciones con 24 horas de anticipación sin cargo.'}

GARANTÍA:
${config.warrantyInfo || 'Consultar según el servicio.'}

${faqText ? `PREGUNTAS FRECUENTES:\n${faqText}` : ''}

${customerContext}
${activeJobContext}

${config.customInstructions ? `INSTRUCCIONES ADICIONALES:\n${config.customInstructions}` : ''}

INSTRUCCIONES DE COMPORTAMIENTO:
1. ${toneInstructions[config.aiTone as keyof typeof toneInstructions] || toneInstructions.friendly_professional}
2. Respondé SIEMPRE en español argentino.
3. Sé conciso - los mensajes de WhatsApp deben ser cortos y claros.
4. Si el cliente quiere agendar un servicio, pedí: tipo de servicio, dirección, fecha/hora preferida.
5. Si no estás seguro de algo, preguntá para clarificar.
6. Nunca inventes información que no tengas.
7. Si el cliente está enojado o el tema es delicado, sugerí transferir a un humano.
8. Para crear un trabajo necesitás: tipo de servicio, dirección, y fecha aproximada.

FORMATO DE RESPUESTA:
Respondé en JSON con esta estructura:
{
  "intent": "booking|question|status|complaint|greeting|confirmation|cancellation|other",
  "confidence": 0-100,
  "extractedEntities": {
    "serviceType": "string o null",
    "preferredDate": "string o null",
    "preferredTime": "string o null",
    "address": "string o null",
    "urgency": "normal|urgente o null",
    "problemDescription": "string o null"
  },
  "suggestedResponse": "Tu respuesta al cliente en español argentino",
  "shouldCreateJob": true/false,
  "shouldTransfer": true/false,
  "transferReason": "razón si shouldTransfer es true",
  "warnings": ["lista de advertencias si hay"]
}`;
}

function buildConversationMessages(
  context: ConversationContext,
  currentMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Add recent conversation history (last 10 messages)
  for (const msg of context.recentMessages.slice(-10)) {
    if (msg.role === 'customer') {
      messages.push({ role: 'user', content: msg.content });
    } else {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Add current message
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP AI RESPONDER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class WhatsAppAIResponder {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = model;
  }

  /**
   * Process an incoming WhatsApp message and generate a response
   */
  async processMessage(
    message: IncomingMessage,
    config: AIConfiguration,
    context: ConversationContext
  ): Promise<AIResponse> {
    // Get the text content (transcribe if voice)
    let textContent = message.textContent || '';

    if (message.messageType === 'voice' && message.audioUrl) {
      try {
        textContent = await this.transcribeAudio(message.audioUrl);
      } catch (error) {
        console.error('Transcription failed:', error);
        return this.createTransferResponse(
          message,
          'Error al transcribir audio',
          config
        );
      }
    } else if (message.messageType === 'image') {
      textContent = message.imageCaption || '[Cliente envió una imagen]';
    }

    if (!textContent.trim()) {
      return this.createTransferResponse(
        message,
        'Mensaje vacío',
        config
      );
    }

    // Check for transfer keywords
    const shouldTransferByKeyword = this.checkTransferKeywords(
      textContent,
      config.transferKeywords
    );

    if (shouldTransferByKeyword) {
      return this.createTransferResponse(
        message,
        'Palabra clave de transferencia detectada',
        config,
        textContent
      );
    }

    // Analyze with GPT-4o-mini
    const analysis = await this.analyzeMessage(textContent, config, context);

    // Log the interaction
    const logId = await this.logInteraction(message, textContent, analysis);

    // Decide action based on confidence
    if (analysis.shouldTransfer) {
      return {
        success: true,
        action: 'transfer',
        analysis,
        transferTo: config.escalationUserId || undefined,
        logId,
      };
    }

    if (analysis.confidence < config.minConfidenceToRespond) {
      return {
        success: true,
        action: 'transfer',
        analysis,
        transferTo: config.escalationUserId || undefined,
        logId,
      };
    }

    if (analysis.shouldCreateJob) {
      if (analysis.confidence >= config.minConfidenceToCreateJob) {
        // Auto-create job
        const job = await this.createJob(message.organizationId, analysis, message.customerPhone);
        return {
          success: true,
          action: 'create_job',
          response: analysis.suggestedResponse,
          analysis,
          jobCreated: job,
          logId,
        };
      } else {
        // Ask for confirmation
        return {
          success: true,
          action: 'confirm_job',
          response: analysis.suggestedResponse,
          analysis,
          logId,
        };
      }
    }

    // Normal response
    return {
      success: true,
      action: 'respond',
      response: analysis.suggestedResponse,
      analysis,
      logId,
    };
  }

  /**
   * Analyze message with GPT-4o-mini
   */
  private async analyzeMessage(
    text: string,
    config: AIConfiguration,
    context: ConversationContext
  ): Promise<AIAnalysis> {
    const systemPrompt = buildSystemPrompt(config, context);
    const messages = buildConversationMessages(context, text);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
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
        throw new Error('Empty response from AI');
      }

      const parsed = JSON.parse(content) as AIAnalysis;

      // Validate and sanitize
      return {
        intent: parsed.intent || 'other',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        extractedEntities: parsed.extractedEntities || {},
        suggestedResponse: parsed.suggestedResponse || 'Disculpá, no pude procesar tu mensaje. ¿Podrías repetirlo?',
        shouldCreateJob: parsed.shouldCreateJob || false,
        shouldTransfer: parsed.shouldTransfer || false,
        transferReason: parsed.transferReason,
        warnings: parsed.warnings || [],
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
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

  /**
   * Transcribe audio using Whisper
   */
  private async transcribeAudio(audioUrl: string): Promise<string> {
    // Download audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' });

    const transcription = await this.client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'es',
      response_format: 'text',
    });

    return transcription;
  }

  /**
   * Check if message contains transfer keywords
   */
  private checkTransferKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
  }

  /**
   * Create a transfer response
   */
  private async createTransferResponse(
    message: IncomingMessage,
    reason: string,
    config: AIConfiguration,
    textContent?: string
  ): Promise<AIResponse> {
    const logId = await this.logInteraction(
      message,
      textContent || '[No text]',
      {
        intent: 'other',
        confidence: 0,
        extractedEntities: {},
        suggestedResponse: '',
        shouldCreateJob: false,
        shouldTransfer: true,
        transferReason: reason,
        warnings: [],
      }
    );

    return {
      success: true,
      action: 'transfer',
      analysis: {
        intent: 'other',
        confidence: 0,
        extractedEntities: {},
        suggestedResponse: '',
        shouldCreateJob: false,
        shouldTransfer: true,
        transferReason: reason,
        warnings: [],
      },
      transferTo: config.escalationUserId || undefined,
      logId,
    };
  }

  /**
   * Create a job from AI analysis
   */
  private async createJob(
    organizationId: string,
    analysis: AIAnalysis,
    customerPhone: string
  ): Promise<{ id: string; jobNumber: string } | undefined> {
    try {
      // Find or create customer
      let customer = await prisma.customer.findFirst({
        where: {
          organizationId,
          phone: customerPhone,
        },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            organizationId,
            phone: customerPhone,
            name: 'Cliente WhatsApp',
            source: 'whatsapp_ai',
          },
        });
      }

      // Generate job number
      const jobCount = await prisma.job.count({
        where: { organizationId },
      });
      const jobNumber = `JOB-${String(jobCount + 1).padStart(5, '0')}`;

      // Create the job
      const job = await prisma.job.create({
        data: {
          organizationId,
          customerId: customer.id,
          jobNumber,
          serviceType: analysis.extractedEntities.serviceType || 'otro',
          description: analysis.extractedEntities.problemDescription || 'Trabajo creado por AI',
          address: analysis.extractedEntities.address || customer.address,
          priority: analysis.extractedEntities.urgency === 'urgente' ? 'urgent' : 'normal',
          status: 'PENDING',
          source: 'whatsapp_ai',
          scheduledDate: analysis.extractedEntities.preferredDate
            ? new Date(analysis.extractedEntities.preferredDate)
            : undefined,
        },
      });

      return { id: job.id, jobNumber: job.jobNumber };
    } catch (error) {
      console.error('Failed to create job:', error);
      return undefined;
    }
  }

  /**
   * Log AI interaction
   */
  private async logInteraction(
    message: IncomingMessage,
    textContent: string,
    analysis: AIAnalysis
  ): Promise<string> {
    try {
      const log = await prisma.aIConversationLog.create({
        data: {
          organizationId: message.organizationId,
          conversationId: message.conversationId,
          messageId: message.messageId,
          customerMessage: textContent,
          messageType: message.messageType,
          transcription: message.messageType === 'voice' ? textContent : null,
          detectedIntent: analysis.intent,
          extractedEntities: analysis.extractedEntities,
          confidenceScore: analysis.confidence,
          aiResponse: analysis.suggestedResponse,
          responseStatus: analysis.shouldTransfer ? 'transferred' : 'sent',
          transferReason: analysis.transferReason,
        },
      });
      return log.id;
    } catch (error) {
      console.error('Failed to log interaction:', error);
      return 'log-failed';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

let responderInstance: WhatsAppAIResponder | null = null;

export function getWhatsAppAIResponder(): WhatsAppAIResponder {
  if (!responderInstance) {
    responderInstance = new WhatsAppAIResponder();
  }
  return responderInstance;
}

/**
 * Check if AI Assistant is available for an organization
 */
export async function isAIAssistantEnabled(organizationId: string): Promise<boolean> {
  try {
    const config = await prisma.aIConfiguration.findUnique({
      where: { organizationId },
    });
    return config?.isEnabled ?? false;
  } catch {
    return false;
  }
}

/**
 * Get AI configuration for an organization
 */
export async function getAIConfiguration(organizationId: string): Promise<AIConfiguration | null> {
  try {
    const config = await prisma.aIConfiguration.findUnique({
      where: { organizationId },
    });

    if (!config) return null;

    return {
      ...config,
      servicesOffered: (config.servicesOffered as ServiceInfo[]) || [],
      businessHours: (config.businessHours as BusinessHours) || {},
      faqItems: (config.faqItems as FAQItem[]) || [],
      transferKeywords: (config.transferKeywords as string[]) || [],
    };
  } catch {
    return null;
  }
}

/**
 * Get conversation context for AI
 */
export async function getConversationContext(
  conversationId: string
): Promise<ConversationContext> {
  try {
    const conversation = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        messages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!conversation) {
      return { recentMessages: [] };
    }

    // Get customer's job history
    const jobCount = conversation.customerId
      ? await prisma.job.count({
          where: { customerId: conversation.customerId },
        })
      : 0;

    const lastJob = conversation.customerId
      ? await prisma.job.findFirst({
          where: { customerId: conversation.customerId },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    // Get active job if any
    const activeJob = conversation.activeJobId
      ? await prisma.job.findUnique({
          where: { id: conversation.activeJobId },
        })
      : null;

    return {
      recentMessages: conversation.messages
        .reverse()
        .map((m: { direction: string; body: string | null; createdAt: Date }) => ({
          role: m.direction === 'inbound' ? 'customer' as const : 'assistant' as const,
          content: m.body || '',
          timestamp: m.createdAt,
        })),
      customer: conversation.customer
        ? {
            name: conversation.customer.name,
            phone: conversation.customer.phone,
            previousJobs: jobCount,
            lastServiceDate: lastJob?.completedAt || undefined,
          }
        : undefined,
      activeJob: activeJob
        ? {
            id: activeJob.id,
            status: activeJob.status,
            serviceType: activeJob.serviceType || '',
            scheduledDate: activeJob.scheduledDate || undefined,
          }
        : undefined,
    };
  } catch {
    return { recentMessages: [] };
  }
}
