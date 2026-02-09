/**
 * AI Staff Assistant Service
 * ==========================
 *
 * Provides AI assistance to staff/owners during customer conversations.
 * Unlike the customer-facing AI responder, this service helps staff with:
 *
 * 1. **Draft Suggestions**: Generate response drafts based on conversation context
 * 2. **Quick Actions**: Help staff book, reschedule, or handle requests
 * 3. **Conflict Detection**: Alert staff about scheduling conflicts in real-time
 * 4. **Knowledge Lookup**: Answer staff questions about pricing, availability, etc.
 *
 * The staff member remains in control - AI only suggests, never sends directly.
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { formatDisplayDate, formatDisplayTime } from '@/lib/timezone';
import {
  getSchedulingIntelligenceService,
  SchedulingIntelligenceResult,
} from './scheduling-intelligence';
import {
  getBookingWorkflow,
  createWorkflowContext,
} from './workflows';
import { ExtractedEntities } from './workflows/base-workflow';
// Phase 8 Security: Prompt sanitization (P2)
import {
  sanitizeConversationHistory,
  sanitizeStaffQuery,
  logInjectionAttempt,
} from '@/lib/ai';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type StaffAssistantAction =
  | 'draft_response'    // Generate a response draft for the staff to edit
  | 'suggest_booking'   // Suggest booking based on conversation
  | 'check_availability' // Check technician availability
  | 'create_booking'    // Execute booking on staff request
  | 'analyze_customer'  // Get customer insights
  | 'detect_conflicts'  // Check for conflicts in current conversation
  | 'lookup_pricing'    // Get pricing for a service
  | 'general_help';     // Answer general question

export interface StaffAssistantRequest {
  organizationId: string;
  conversationId: string;
  userId: string; // Staff member making the request
  action: StaffAssistantAction;
  query?: string; // Staff's question or command
  context?: {
    customerMessage?: string;
    staffDraft?: string;
    additionalInfo?: Record<string, unknown>;
  };
}

export interface StaffAssistantResponse {
  success: boolean;
  action: StaffAssistantAction;
  /** Main result (draft text, booking info, etc.) */
  result: string;
  /** Additional data depending on action */
  data?: {
    suggestedResponse?: string;
    booking?: {
      id: string;
      jobNumber: string;
    };
    availability?: SchedulingIntelligenceResult;
    customerInsights?: CustomerInsights;
    conflicts?: ConflictInfo[];
    pricing?: PricingInfo[];
  };
  /** Warnings or notes for the staff */
  warnings?: string[];
}

export interface CustomerInsights {
  name: string;
  phone: string;
  totalJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  lastServiceDate: Date | null;
  totalSpent: number;
  averageRating: number | null;
  isRepeatCustomer: boolean;
  notes: string[];
}

export interface ConflictInfo {
  type: 'scheduling' | 'double_booking' | 'technician_overload' | 'outside_hours';
  message: string;
  suggestion: string;
}

export interface PricingInfo {
  serviceName: string;
  priceRange: string;
  description: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROMPTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function buildStaffAssistantPrompt(
  action: StaffAssistantAction,
  conversationHistory: string,
  businessContext: string,
  staffQuery?: string
): string {
  // Phase 8 Security: Sanitize user-controlled inputs (P2)
  const sanitizedHistory = sanitizeConversationHistory(conversationHistory);
  const sanitizedQuery = staffQuery ? sanitizeStaffQuery(staffQuery) : undefined;
  if (staffQuery) logInjectionAttempt(staffQuery, 'staff');

  const baseInstructions = `Sos un asistente de IA para el personal de la empresa.
Tu rol es AYUDAR al staff, no reemplazarlo. Todo lo que sugieras será revisado antes de enviarse.

CONTEXTO DE LA EMPRESA:
${businessContext}

HISTORIAL DE CONVERSACIÍ“N CON EL CLIENTE:
${sanitizedHistory}

${sanitizedQuery ? `CONSULTA DEL STAFF: "${sanitizedQuery}"` : ''}`;

  const actionInstructions: Record<StaffAssistantAction, string> = {
    draft_response: `
TAREA: Generar un borrador de respuesta para que el staff revise y envíe.

INSTRUCCIONES:
- Analiza la conversación y genera una respuesta apropiada
- Usa un tono profesional pero amigable (español argentino)
- Si hay información faltante, inclui preguntas relevantes
- Sé conciso - es WhatsApp

RESPONDE EN JSON:
{
  "suggestedResponse": "Texto del borrador",
  "confidence": 0-100,
  "notes": "Notas para el staff sobre la respuesta"
}`,

    suggest_booking: `
TAREA: Analizar la conversación y sugerir cómo procesar una reserva.

INSTRUCCIONES:
- Extrae la información de reserva mencionada
- Identifica qué datos faltan
- Sugiere el próximo paso

RESPONDE EN JSON:
{
  "hasEnoughInfo": true/false,
  "extractedInfo": {
    "serviceType": "string o null",
    "preferredDate": "string o null",
    "preferredTime": "string o null",
    "address": "string o null"
  },
  "missingInfo": ["lista de lo que falta"],
  "suggestedAction": "descripción del próximo paso"
}`,

    check_availability: `
TAREA: Ayudar al staff a verificar disponibilidad.

INSTRUCCIONES:
- La información de disponibilidad real será provista por el sistema
- Tu rol es formatear y explicar los datos
- Sugiere el mejor horario basado en la conversación`,

    create_booking: `
TAREA: Confirmar los datos para crear una reserva.

INSTRUCCIONES:
- Verifica que todos los datos necesarios estén presentes
- Advierte sobre posibles problemas
- Confirma antes de proceder`,

    analyze_customer: `
TAREA: Proporcionar insights sobre el cliente.

INSTRUCCIONES:
- Los datos del cliente serán provistos por el sistema
- Destaca información relevante para esta conversación
- Sugiere cómo personalizar la atención`,

    detect_conflicts: `
TAREA: Detectar conflictos potenciales en la conversación.

INSTRUCCIONES:
- Busca inconsistencias (fechas, horarios, servicios)
- Detecta si el cliente tiene expectativas irreales
- Advierte sobre problemas de disponibilidad`,

    lookup_pricing: `
TAREA: Buscar información de precios.

INSTRUCCIONES:
- Los precios serán provistos por el sistema
- Formatea la información de manera clara
- Incluye notas relevantes (condiciones, extras, etc.)`,

    general_help: `
TAREA: Responder la consulta general del staff.

INSTRUCCIONES:
- Usa el contexto de la conversación para dar una respuesta útil
- Si no sabés algo, indicalo claramente
- Sugiere acciones concretas`,
  };

  return `${baseInstructions}

${actionInstructions[action]}`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN SERVICE CLASS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export class AIStaffAssistant {
  private client: OpenAI;
  private model: string;
  private schedulingService = getSchedulingIntelligenceService();

  constructor(apiKey?: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = model;
  }

  /**
   * Process a staff assistance request
   */
  async processRequest(request: StaffAssistantRequest): Promise<StaffAssistantResponse> {
    try {
      // Get conversation context
      const conversationHistory = await this.getConversationHistory(request.conversationId);
      const businessContext = await this.getBusinessContext(request.organizationId);

      switch (request.action) {
        case 'draft_response':
          return this.generateDraftResponse(request, conversationHistory, businessContext);

        case 'suggest_booking':
          return this.suggestBooking(request, conversationHistory, businessContext);

        case 'check_availability':
          return this.checkAvailability(request);

        case 'create_booking':
          return this.createBooking(request, conversationHistory);

        case 'analyze_customer':
          return this.analyzeCustomer(request);

        case 'detect_conflicts':
          return this.detectConflicts(request, conversationHistory, businessContext);

        case 'lookup_pricing':
          return this.lookupPricing(request);

        case 'general_help':
          return this.generalHelp(request, conversationHistory, businessContext);

        default:
          return {
            success: false,
            action: request.action,
            result: 'Acción no soportada',
          };
      }
    } catch (error) {
      console.error('[AI Staff Assistant] Error:', error);
      return {
        success: false,
        action: request.action,
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Generate a draft response for the staff to review
   */
  private async generateDraftResponse(
    request: StaffAssistantRequest,
    conversationHistory: string,
    businessContext: string
  ): Promise<StaffAssistantResponse> {
    const prompt = buildStaffAssistantPrompt(
      'draft_response',
      conversationHistory,
      businessContext,
      request.query
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 500,
      temperature: 0.4,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: request.context?.customerMessage || 'Genera un borrador de respuesta' },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        action: 'draft_response',
        result: 'No se pudo generar el borrador',
      };
    }

    const parsed = JSON.parse(content);

    return {
      success: true,
      action: 'draft_response',
      result: parsed.suggestedResponse || '',
      data: {
        suggestedResponse: parsed.suggestedResponse,
      },
      warnings: parsed.notes ? [parsed.notes] : undefined,
    };
  }

  /**
   * Suggest how to process a booking from conversation
   */
  private async suggestBooking(
    request: StaffAssistantRequest,
    conversationHistory: string,
    businessContext: string
  ): Promise<StaffAssistantResponse> {
    const prompt = buildStaffAssistantPrompt(
      'suggest_booking',
      conversationHistory,
      businessContext
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Analiza la conversación y sugiere cómo proceder con la reserva' },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        action: 'suggest_booking',
        result: 'No se pudo analizar la reserva',
      };
    }

    const parsed = JSON.parse(content);

    // If we have enough info, check availability
    let availability: SchedulingIntelligenceResult | undefined;
    if (parsed.hasEnoughInfo && parsed.extractedInfo?.preferredDate) {
      availability = await this.schedulingService.getSchedulingContext({
        organizationId: request.organizationId,
        date: parsed.extractedInfo.preferredDate,
        requestedTime: parsed.extractedInfo.preferredTime,
        serviceType: parsed.extractedInfo.serviceType,
      });
    }

    const resultText = parsed.hasEnoughInfo
      ? `Datos completos para reserva:\n- Servicio: ${parsed.extractedInfo.serviceType || 'No especificado'}\n- Fecha: ${parsed.extractedInfo.preferredDate || 'No especificada'}\n- Hora: ${parsed.extractedInfo.preferredTime || 'No especificada'}\n- Dirección: ${parsed.extractedInfo.address || 'No especificada'}\n\n${parsed.suggestedAction}`
      : `Faltan datos:\n${parsed.missingInfo?.map((m: string) => `- ${m}`).join('\n') || 'Información incompleta'}\n\n${parsed.suggestedAction}`;

    return {
      success: true,
      action: 'suggest_booking',
      result: resultText,
      data: {
        availability,
      },
      warnings: availability?.hasConflict ? [availability.conflictReason || 'Conflicto detectado'] : undefined,
    };
  }

  /**
   * Check technician availability
   */
  private async checkAvailability(
    request: StaffAssistantRequest
  ): Promise<StaffAssistantResponse> {
    const date = (request.context?.additionalInfo?.date as string) || new Date().toISOString().split('T')[0];
    const time = request.context?.additionalInfo?.time as string | undefined;

    const availability = await this.schedulingService.getSchedulingContext({
      organizationId: request.organizationId,
      date,
      requestedTime: time,
    });

    let result = `ðŸ“… Disponibilidad para ${formatDisplayDate(new Date(date), { weekday: 'long', day: 'numeric', month: 'long' })}:\n\n`;

    if (!availability.isWorkingDay) {
      result += 'âš ï¸ No es día laborable\n';
    } else {
      result += `â° Horario: ${availability.businessHours?.open} - ${availability.businessHours?.close}\n\n`;

      result += 'ðŸ‘· Técnicos:\n';
      for (const tech of availability.technicians) {
        const icon = tech.isAvailable
          ? { low: 'ðŸŸ¢', medium: 'ðŸŸ¡', high: 'ðŸŸ ', full: 'ðŸ”´' }[tech.workloadLevel]
          : 'âš«';
        result += `${icon} ${tech.name}: ${tech.currentJobCount}/${tech.maxDailyJobs} trabajos`;
        if (tech.specialty) result += ` (${tech.specialty})`;
        result += '\n';
      }

      if (availability.bestSlot) {
        result += `\nâœ¨ Mejor horario: ${availability.bestSlot.start}`;
        if (availability.bestSlot.bestTechnician) {
          result += ` con ${availability.bestSlot.bestTechnician.name}`;
        }
      }
    }

    return {
      success: true,
      action: 'check_availability',
      result,
      data: { availability },
    };
  }

  /**
   * Create a booking (staff-initiated)
   */
  private async createBooking(
    request: StaffAssistantRequest,
    _conversationHistory: string
  ): Promise<StaffAssistantResponse> {
    // Get conversation to extract customer info
    const conversation = await prisma.waConversation.findUnique({
      where: { id: request.conversationId },
      include: { customer: true },
    });

    if (!conversation) {
      return {
        success: false,
        action: 'create_booking',
        result: 'Conversación no encontrada',
      };
    }

    const additionalInfo = request.context?.additionalInfo as ExtractedEntities | undefined;
    if (!additionalInfo?.serviceType && !additionalInfo?.preferredDate) {
      return {
        success: false,
        action: 'create_booking',
        result: 'Faltan datos para la reserva. Especificá al menos el tipo de servicio o fecha.',
      };
    }

    // Create workflow context
    const workflow = getBookingWorkflow();
    const workflowContext = createWorkflowContext({
      organizationId: request.organizationId,
      conversationId: request.conversationId,
      customerPhone: conversation.customerPhone,
      customerName: conversation.customer?.name,
      extractedEntities: additionalInfo || {},
      aiConfidence: 100, // Staff-initiated = 100% confidence
      originalMessage: `Reserva creada por staff: ${request.query || ''}`,
      messageType: 'text',
    });

    // Execute booking workflow
    const result = await workflow.execute(workflowContext);

    if (result.success && result.jobCreated) {
      return {
        success: true,
        action: 'create_booking',
        result: `✅ Reserva creada exitosamente\n\nðŸ“‹ Número: ${result.jobCreated.jobNumber}\n\n${result.response || ''}`,
        data: {
          booking: result.jobCreated,
        },
      };
    } else {
      return {
        success: false,
        action: 'create_booking',
        result: `âŒ No se pudo crear la reserva: ${result.error || 'Error desconocido'}`,
        warnings: result.failedStep ? [`Falló en: ${result.failedStep}`] : undefined,
      };
    }
  }

  /**
   * Analyze customer insights
   */
  private async analyzeCustomer(
    request: StaffAssistantRequest
  ): Promise<StaffAssistantResponse> {
    const conversation = await prisma.waConversation.findUnique({
      where: { id: request.conversationId },
      include: { customer: true },
    });

    if (!conversation?.customer) {
      return {
        success: false,
        action: 'analyze_customer',
        result: 'Cliente no encontrado',
      };
    }

    const customer = conversation.customer;

    // Get job statistics
    const jobs = await prisma.job.findMany({
      where: { customerId: customer.id },
      select: {
        status: true,
        completedAt: true,
        totalAmount: true,
      },
    });

    type JobEntry = typeof jobs[number];
    const completedJobs = jobs.filter((j: JobEntry) => j.status === 'COMPLETED').length;
    const cancelledJobs = jobs.filter((j: JobEntry) => j.status === 'CANCELLED').length;
    const totalSpent = jobs.reduce((sum: number, j: JobEntry) => sum + (Number(j.totalAmount) || 0), 0);
    const lastService = jobs
      .filter((j: JobEntry) => j.completedAt)
      .sort((a: JobEntry, b: JobEntry) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0];

    const insights: CustomerInsights = {
      name: customer.name,
      phone: customer.phone,
      totalJobs: jobs.length,
      completedJobs,
      cancelledJobs,
      lastServiceDate: lastService?.completedAt || null,
      totalSpent,
      averageRating: null, // TODO: implement rating system
      isRepeatCustomer: completedJobs > 1,
      notes: [],
    };

    // Build result text
    let result = `ðŸ‘¤ **${insights.name}**\nðŸ“± ${insights.phone}\n\n`;

    if (insights.isRepeatCustomer) {
      result += `â­ Cliente frecuente (${insights.completedJobs} trabajos completados)\n`;
    } else if (insights.totalJobs === 0) {
      result += `ðŸ†• Cliente nuevo\n`;
    }

    if (insights.totalSpent > 0) {
      result += `ðŸ’° Total gastado: $${insights.totalSpent.toLocaleString('es-AR')}\n`;
    }

    if (insights.lastServiceDate) {
      result += `ðŸ“… Íšltimo servicio: ${formatDisplayDate(insights.lastServiceDate)}\n`;
    }

    if (insights.cancelledJobs > 0) {
      result += `âš ï¸ ${insights.cancelledJobs} cancelaciones\n`;
    }

    return {
      success: true,
      action: 'analyze_customer',
      result,
      data: { customerInsights: insights },
    };
  }

  /**
   * Detect conflicts in conversation
   */
  private async detectConflicts(
    request: StaffAssistantRequest,
    conversationHistory: string,
    businessContext: string
  ): Promise<StaffAssistantResponse> {
    const prompt = buildStaffAssistantPrompt(
      'detect_conflicts',
      conversationHistory,
      businessContext
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Detecta conflictos o problemas potenciales en esta conversación' },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        action: 'detect_conflicts',
        result: 'No se pudo analizar conflictos',
      };
    }

    const parsed = JSON.parse(content);
    const conflicts = (parsed.conflicts || []).map((c: { type: string; message: string; suggestion: string }) => ({
      type: c.type || 'scheduling',
      message: c.message,
      suggestion: c.suggestion,
    }));

    if (conflicts.length === 0) {
      return {
        success: true,
        action: 'detect_conflicts',
        result: '✅ No se detectaron conflictos',
        data: { conflicts: [] },
      };
    }

    let result = `âš ï¸ Conflictos detectados:\n\n`;
    for (const conflict of conflicts) {
      result += `• ${conflict.message}\n  ←’ ${conflict.suggestion}\n\n`;
    }

    return {
      success: true,
      action: 'detect_conflicts',
      result,
      data: { conflicts },
    };
  }

  /**
   * Look up pricing information
   */
  private async lookupPricing(
    request: StaffAssistantRequest
  ): Promise<StaffAssistantResponse> {
    const config = await prisma.aIConfiguration.findUnique({
      where: { organizationId: request.organizationId },
      select: {
        servicesOffered: true,
        pricingInfo: true,
      },
    });

    if (!config) {
      return {
        success: false,
        action: 'lookup_pricing',
        result: 'Configuración no encontrada',
      };
    }

    type ServiceInfo = { name: string; description?: string; priceRange?: string };
    const services = (config.servicesOffered as ServiceInfo[]) || [];
    const searchTerm = request.query?.toLowerCase();

    // Filter services if search term provided
    const filteredServices = searchTerm
      ? services.filter(s =>
        s.name.toLowerCase().includes(searchTerm) ||
        (s.description?.toLowerCase().includes(searchTerm))
      )
      : services;

    let result = 'ðŸ’° **Precios de Servicios**\n\n';

    if (filteredServices.length === 0) {
      result += 'No se encontraron servicios con ese criterio.\n';
    } else {
      for (const service of filteredServices) {
        result += `• **${service.name}**`;
        if (service.priceRange) result += `: ${service.priceRange}`;
        result += '\n';
        if (service.description) result += `  ${service.description}\n`;
        result += '\n';
      }
    }

    if (config.pricingInfo) {
      result += `\nðŸ“‹ Información general:\n${config.pricingInfo}`;
    }

    return {
      success: true,
      action: 'lookup_pricing',
      result,
      data: {
        pricing: filteredServices.map(s => ({
          serviceName: s.name,
          priceRange: s.priceRange || 'Consultar',
          description: s.description || '',
        })),
      },
    };
  }

  /**
   * General help - answer any staff question
   */
  private async generalHelp(
    request: StaffAssistantRequest,
    conversationHistory: string,
    businessContext: string
  ): Promise<StaffAssistantResponse> {
    const prompt = buildStaffAssistantPrompt(
      'general_help',
      conversationHistory,
      businessContext,
      request.query
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 600,
      temperature: 0.5,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: request.query || '¿Cómo puedo ayudar?' },
      ],
    });

    const content = response.choices[0]?.message?.content;

    return {
      success: true,
      action: 'general_help',
      result: content || 'No pude procesar tu consulta',
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HELPERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Get conversation history as formatted text
   */
  private async getConversationHistory(conversationId: string): Promise<string> {
    const messages = await prisma.waMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        direction: true,
        body: true,
        createdAt: true,
      },
    });

    if (messages.length === 0) {
      return 'Sin mensajes previos';
    }

    type MessageEntry = typeof messages[number];
    return messages
      .map((m: MessageEntry) => {
        const sender = m.direction === 'inbound' ? 'CLIENTE' : 'EMPRESA';
        const time = formatDisplayTime(m.createdAt);
        return `[${time}] ${sender}: ${m.body || '[Sin texto]'}`;;
      })
      .join('\n');
  }

  /**
   * Get business context for prompts
   */
  private async getBusinessContext(organizationId: string): Promise<string> {
    const config = await prisma.aIConfiguration.findUnique({
      where: { organizationId },
      select: {
        companyName: true,
        companyDescription: true,
        servicesOffered: true,
        pricingInfo: true,
        businessHours: true,
        serviceAreas: true,
      },
    });

    if (!config) {
      return 'Configuración no disponible';
    }

    type ServiceInfo = { name: string; priceRange?: string };
    const services = (config.servicesOffered as ServiceInfo[]) || [];

    return `
Empresa: ${config.companyName || 'No especificada'}
Descripción: ${config.companyDescription || 'Sin descripción'}
Servicios: ${services.map(s => `${s.name}${s.priceRange ? ` (${s.priceRange})` : ''}`).join(', ')}
Precios: ${config.pricingInfo || 'Consultar'}
Zonas: ${config.serviceAreas || 'Consultar'}`;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SINGLETON
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let staffAssistantInstance: AIStaffAssistant | null = null;

export function getAIStaffAssistant(): AIStaffAssistant {
  if (!staffAssistantInstance) {
    staffAssistantInstance = new AIStaffAssistant();
  }
  return staffAssistantInstance;
}
