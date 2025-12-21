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
 * - **Scheduling Intelligence**: Consults employee schedules, workload, and
 *   distance to make informed booking decisions
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import {
  getSchedulingIntelligenceService,
  SchedulingIntelligenceResult,
  TechnicianAvailability,
} from './scheduling-intelligence';

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
  /** Scheduling intelligence data - populated when booking intent is detected */
  schedulingContext?: SchedulingIntelligenceResult;
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

/**
 * Build scheduling intelligence section of the prompt
 * This gives the AI real-time data about technician availability, workload, and scheduling
 */
function buildSchedulingPrompt(schedulingData: SchedulingIntelligenceResult): string {
  if (!schedulingData.isWorkingDay) {
    return `
INFORMACIÓN DE AGENDA:
⚠️ ${schedulingData.summary}
${schedulingData.alternativeSuggestions.length > 0
  ? `Días alternativos disponibles: ${schedulingData.alternativeSuggestions.join(', ')}`
  : ''}`;
  }

  // Build technician availability summary
  const technicianSummary = schedulingData.technicians
    .filter(t => t.isAvailable)
    .map(t => {
      const workloadIcon = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        full: '🔴'
      }[t.workloadLevel];
      return `  - ${t.name}${t.specialty ? ` (${t.specialty})` : ''}: ${workloadIcon} ${t.currentJobCount}/${t.maxDailyJobs} trabajos${t.distanceKm ? `, ${t.distanceKm}km` : ''}`;
    })
    .join('\n');

  // Build available time slots
  const availableSlots = schedulingData.availableSlots
    .filter(s => s.availableTechnicians > 0)
    .slice(0, 6)
    .map(s => `  - ${s.start}-${s.end}: ${s.availableTechnicians} técnico(s) ${s.confidence === 'high' ? '✓' : ''}`)
    .join('\n');

  // Build conflict info if any
  const conflictInfo = schedulingData.hasConflict
    ? `\n⚠️ CONFLICTO DETECTADO: ${schedulingData.conflictReason}
${schedulingData.alternativeSuggestions.length > 0
  ? `Alternativas sugeridas: ${schedulingData.alternativeSuggestions.join(', ')}`
  : ''}`
    : '';

  return `
INFORMACIÓN DE AGENDA EN TIEMPO REAL:
${schedulingData.summary}

Horario de atención: ${schedulingData.businessHours?.open || '?'} - ${schedulingData.businessHours?.close || '?'}

TÉCNICOS DISPONIBLES (carga de trabajo actual):
${technicianSummary || '  No hay técnicos disponibles'}

HORARIOS CON DISPONIBILIDAD:
${availableSlots || '  Sin horarios disponibles'}

${schedulingData.bestSlot ? `MEJOR HORARIO RECOMENDADO: ${schedulingData.bestSlot.start}${schedulingData.bestSlot.bestTechnician ? ` con ${schedulingData.bestSlot.bestTechnician.name}` : ''}` : ''}
${conflictInfo}

INSTRUCCIONES DE AGENDA:
- Usá esta información para ofrecer horarios REALES con disponibilidad.
- NO inventes horarios que no estén en la lista de disponibilidad.
- Si el cliente pide un horario sin disponibilidad, sugerí las alternativas.
- Mencioná el nombre del técnico cuando sea relevante.
- Si hay conflicto, explicá amablemente y ofrecé alternativas.`;
}

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

  // Build scheduling intelligence context
  const schedulingContext = context.schedulingContext
    ? buildSchedulingPrompt(context.schedulingContext)
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

${schedulingContext}

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
  private schedulingService = getSchedulingIntelligenceService();

  // Keywords that suggest booking intent
  private static BOOKING_KEYWORDS = [
    'turno', 'cita', 'reservar', 'agendar', 'programar', 'fecha', 'horario',
    'disponibilidad', 'mañana', 'tarde', 'lunes', 'martes', 'miércoles',
    'jueves', 'viernes', 'sábado', 'semana', 'próximo', 'hoy', 'disponible',
    'cuándo', 'cuando', 'puedo', 'pueden', 'venir', 'ir', 'visita'
  ];

  constructor(apiKey?: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = model;
  }

  /**
   * Check if message might be about booking/scheduling
   */
  private mightBeBookingRelated(text: string): boolean {
    const lowerText = text.toLowerCase();
    return WhatsAppAIResponder.BOOKING_KEYWORDS.some(keyword =>
      lowerText.includes(keyword)
    );
  }

  /**
   * Extract date from message text (simple extraction)
   */
  private extractDateFromText(text: string): Date | null {
    const today = new Date();
    const lowerText = text.toLowerCase();

    // Check for "hoy" (today)
    if (lowerText.includes('hoy')) {
      return today;
    }

    // Check for "mañana" (tomorrow)
    if (lowerText.includes('mañana')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    // Check for day names
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    for (let i = 0; i < dayNames.length; i++) {
      if (lowerText.includes(dayNames[i])) {
        const targetDay = i;
        const currentDay = today.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7; // Next week
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntil);
        return targetDate;
      }
    }

    // Check for "próxima semana" or "semana que viene"
    if (lowerText.includes('próxima semana') || lowerText.includes('semana que viene')) {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return nextWeek;
    }

    // Default to tomorrow for general availability questions
    if (lowerText.includes('disponibilidad') || lowerText.includes('disponible')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    return null;
  }

  /**
   * Extract time from message text (simple extraction)
   */
  private extractTimeFromText(text: string): string | undefined {
    const lowerText = text.toLowerCase();

    // Check for specific time mentions (e.g., "a las 10", "10:30", "14hs")
    const timePattern = /(\d{1,2})[:\s]?(\d{2})?\s*(hs|hrs|horas|am|pm)?/i;
    const match = text.match(timePattern);

    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const period = match[3]?.toLowerCase();

      // Adjust for PM
      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      // Assume PM for typical business hours if not specified
      if (!period && hours >= 1 && hours <= 7) hours += 12;

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Check for morning/afternoon
    if (lowerText.includes('mañana') && !lowerText.includes('mañana temprano')) {
      // "mañana" could mean tomorrow or morning - context dependent
      if (lowerText.includes('a la mañana') || lowerText.includes('por la mañana')) {
        return '09:00';
      }
    }

    if (lowerText.includes('tarde') || lowerText.includes('por la tarde')) {
      return '14:00';
    }

    if (lowerText.includes('mediodía') || lowerText.includes('mediodia')) {
      return '12:00';
    }

    return undefined;
  }

  /**
   * Fetch scheduling context if message seems booking-related
   */
  private async fetchSchedulingContext(
    text: string,
    organizationId: string,
    serviceType?: string
  ): Promise<SchedulingIntelligenceResult | undefined> {
    if (!this.mightBeBookingRelated(text)) {
      return undefined;
    }

    const extractedDate = this.extractDateFromText(text);
    if (!extractedDate) {
      // Default to tomorrow if booking-related but no date detected
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      extractedDate || tomorrow;
    }

    const dateStr = (extractedDate || new Date()).toISOString().split('T')[0];
    const requestedTime = this.extractTimeFromText(text);

    try {
      return await this.schedulingService.getSchedulingContext({
        organizationId,
        date: dateStr,
        requestedTime,
        serviceType,
      });
    } catch (error) {
      console.error('Failed to fetch scheduling context:', error);
      return undefined;
    }
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

    // Fetch scheduling context if message seems booking-related
    // This gives the AI real-time data about technician availability, workload, etc.
    const schedulingContext = await this.fetchSchedulingContext(
      textContent,
      message.organizationId
    );

    // Enrich context with scheduling intelligence
    const enrichedContext: ConversationContext = {
      ...context,
      schedulingContext,
    };

    // Analyze with GPT-4o-mini (now with scheduling intelligence)
    const analysis = await this.analyzeMessage(textContent, config, enrichedContext);

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
