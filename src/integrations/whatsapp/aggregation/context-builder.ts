/**
 * Context Builder for AI/GPT Processing
 * ======================================
 *
 * Phase 9.8: Message Aggregation System
 * Builds rich context prompts from aggregated messages and conversation history.
 * Used to create structured prompts for AI-assisted message processing.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { ConversationContext, AggregationResult } from './message-aggregator.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnhancedContext {
  // Customer info
  customer: {
    id?: string;
    name?: string;
    phone: string;
    isKnown: boolean;
  };

  // Current message
  currentMessage: {
    content: string;
    messageCount: number;
    triggerReason?: string;
  };

  // Conversation history
  history: {
    recentMessages: Array<{
      role: 'customer' | 'business';
      content: string;
      timestamp: Date;
    }>;
    previousRequests: string[];
  };

  // Business context
  business: {
    activeJob?: {
      id: string;
      description: string;
      status: string;
      scheduledDate?: Date;
      technicianName?: string;
    };
    recentJobs: Array<{
      id: string;
      serviceType: string;
      completedAt?: Date;
    }>;
  };

  // Organization info
  organization: {
    id: string;
    name: string;
    serviceTypes: string[];
  };
}

export interface GPTPrompt {
  systemPrompt: string;
  userPrompt: string;
  context: EnhancedContext;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT BUILDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build enhanced context from aggregation result
 */
export async function buildEnhancedContext(
  organizationId: string,
  phone: string,
  result: AggregationResult
): Promise<EnhancedContext> {
  // Get organization info
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      businessName: true,
    },
  });

  // Get customer info if known
  let customer = null;
  let recentJobs: any[] = [];
  let activeJob = null;

  if (result.context?.customerId) {
    customer = await db.customer.findUnique({
      where: { id: result.context.customerId },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    // Get recent jobs for this customer
    recentJobs = await db.job.findMany({
      where: {
        customerId: result.context.customerId,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        serviceType: true,
        completedAt: true,
      },
    });
  }

  // Get active job if exists
  if (result.context?.activeJobId) {
    const job = await db.job.findUnique({
      where: { id: result.context.activeJobId },
      include: {
        technician: { select: { name: true } },
      },
    });

    if (job) {
      activeJob = {
        id: job.id,
        description: job.description,
        status: job.status,
        scheduledDate: job.scheduledDate || undefined,
        technicianName: job.technician?.name,
      };
    }
  }

  // Get available service types from organization's jobs
  const serviceTypesResult = await db.job.findMany({
    where: { organizationId },
    select: { serviceType: true },
    distinct: ['serviceType'],
  });
  const serviceTypes = serviceTypesResult.map((j) => j.serviceType);

  // Build recent messages from context
  const recentMessages = (result.context?.messages || []).map((m) => ({
    role: m.sender as 'customer' | 'business',
    content: m.content,
    timestamp: new Date(m.timestamp),
  }));

  return {
    customer: {
      id: customer?.id,
      name: customer?.name || result.context?.customerName,
      phone,
      isKnown: !!customer,
    },
    currentMessage: {
      content: result.combinedContent,
      messageCount: result.messageCount,
      triggerReason: result.triggerReason,
    },
    history: {
      recentMessages,
      previousRequests: result.context?.previousRequests || [],
    },
    business: {
      activeJob: activeJob || undefined,
      recentJobs,
    },
    organization: {
      id: organizationId,
      name: organization?.businessName || organization?.name || 'Unknown',
      serviceTypes,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GPT PROMPT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a GPT prompt for message classification
 */
export function buildClassificationPrompt(context: EnhancedContext): GPTPrompt {
  const systemPrompt = `Sos un asistente de atención al cliente para una empresa de servicios técnicos en Argentina.
Tu rol es analizar mensajes de WhatsApp de clientes y clasificarlos para ayudar a los operadores.

Empresa: ${context.organization.name}
Servicios disponibles: ${context.organization.serviceTypes.join(', ')}

Debés clasificar cada mensaje en una de estas categorías:
- SOLICITUD_SERVICIO: El cliente quiere agendar un servicio nuevo
- CONSULTA_PRECIO: Pregunta sobre precios o presupuestos
- CONSULTA_TURNO: Pregunta sobre un turno ya agendado
- RECLAMO: Queja o problema con un servicio
- AGRADECIMIENTO: Mensaje de agradecimiento
- SALUDO: Saludo o mensaje informal
- OTRO: No encaja en ninguna categoría

También debés extraer:
- Tipo de servicio mencionado (si aplica)
- Dirección (si menciona)
- Fecha/hora preferida (si menciona)
- Urgencia (NORMAL, URGENTE)
- Sentimiento (POSITIVO, NEUTRO, NEGATIVO)

Respondé en JSON con el formato:
{
  "categoria": "...",
  "servicio": "...",
  "direccion": "...",
  "fechaPreferida": "...",
  "urgencia": "...",
  "sentimiento": "...",
  "resumen": "Breve resumen del pedido en 1-2 oraciones"
}`;

  // Build user prompt with context
  let userPrompt = `Mensaje del cliente:\n"${context.currentMessage.content}"\n\n`;

  if (context.customer.isKnown) {
    userPrompt += `Cliente conocido: ${context.customer.name}\n`;
  } else {
    userPrompt += `Cliente nuevo (no registrado)\n`;
  }

  if (context.business.activeJob) {
    userPrompt += `\nTiene un trabajo activo:\n`;
    userPrompt += `- Estado: ${context.business.activeJob.status}\n`;
    userPrompt += `- Servicio: ${context.business.activeJob.description}\n`;
    if (context.business.activeJob.scheduledDate) {
      userPrompt += `- Fecha: ${context.business.activeJob.scheduledDate.toLocaleDateString('es-AR')}\n`;
    }
  }

  if (context.history.recentMessages.length > 0) {
    userPrompt += `\nHistorial reciente de la conversación:\n`;
    for (const msg of context.history.recentMessages.slice(-5)) {
      const role = msg.role === 'customer' ? 'Cliente' : 'Negocio';
      userPrompt += `[${role}]: ${msg.content}\n`;
    }
  }

  return {
    systemPrompt,
    userPrompt,
    context,
  };
}

/**
 * Build a GPT prompt for response suggestion
 */
export function buildResponseSuggestionPrompt(context: EnhancedContext): GPTPrompt {
  const systemPrompt = `Sos un asistente de atención al cliente para ${context.organization.name}, una empresa de servicios técnicos en Argentina.
Usá "vos" en lugar de "tú". Sé amable pero profesional.

Tu rol es sugerir una respuesta apropiada para el mensaje del cliente.
La respuesta debe ser breve (máximo 2-3 oraciones) y en español argentino.

Si el cliente solicita un servicio, ofrecé agendar un turno.
Si pregunta por precios, indicá que un representante lo contactará.
Si tiene un reclamo, mostrá empatía y ofrecé solución.

Servicios disponibles: ${context.organization.serviceTypes.join(', ')}`;

  let userPrompt = `Mensaje del cliente:\n"${context.currentMessage.content}"\n`;

  if (context.customer.isKnown) {
    userPrompt += `\nNombre del cliente: ${context.customer.name}\n`;
  }

  if (context.business.activeJob) {
    userPrompt += `\nTrabajo activo: ${context.business.activeJob.description} (${context.business.activeJob.status})\n`;
  }

  userPrompt += `\nSugerí una respuesta apropiada:`;

  return {
    systemPrompt,
    userPrompt,
    context,
  };
}

/**
 * Build a GPT prompt for service request extraction
 */
export function buildServiceExtractionPrompt(context: EnhancedContext): GPTPrompt {
  const systemPrompt = `Sos un asistente que extrae información de solicitudes de servicio de mensajes de WhatsApp.
Analizá el mensaje y extraé la siguiente información en JSON:

{
  "tipoServicio": "string o null",
  "direccion": {
    "calle": "string o null",
    "numero": "string o null",
    "piso": "string o null",
    "departamento": "string o null",
    "localidad": "string o null",
    "entreCalles": "string o null"
  },
  "fechaPreferida": {
    "fecha": "YYYY-MM-DD o null",
    "horario": "mañana|tarde|noche o null",
    "horaEspecifica": "HH:MM o null",
    "flexible": true/false
  },
  "urgencia": "NORMAL|URGENTE|EMERGENCIA",
  "detalles": "descripción del problema o requerimiento",
  "confianza": 0.0-1.0
}

Servicios conocidos: ${context.organization.serviceTypes.join(', ')}
Si no podés extraer algún dato, usá null.`;

  const userPrompt = `Mensaje del cliente:\n"${context.currentMessage.content}"`;

  return {
    systemPrompt,
    userPrompt,
    context,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format context for logging/debugging
 */
export function formatContextForLog(context: EnhancedContext): string {
  const lines: string[] = [];

  lines.push(`=== Contexto de Mensaje ===`);
  lines.push(`Cliente: ${context.customer.name || 'Desconocido'} (${context.customer.phone})`);
  lines.push(`Conocido: ${context.customer.isKnown ? 'Sí' : 'No'}`);
  lines.push(`Mensajes: ${context.currentMessage.messageCount}`);
  lines.push(`Trigger: ${context.currentMessage.triggerReason || 'N/A'}`);

  if (context.business.activeJob) {
    lines.push(`Trabajo activo: ${context.business.activeJob.description}`);
  }

  lines.push(`Historial: ${context.history.recentMessages.length} mensajes recientes`);
  lines.push(`===========================`);

  return lines.join('\n');
}

/**
 * Estimate token count for context (rough approximation)
 */
export function estimateTokenCount(context: EnhancedContext): number {
  // Rough estimate: ~4 characters per token
  const contentLength =
    context.currentMessage.content.length +
    context.history.recentMessages.reduce((sum, m) => sum + m.content.length, 0);

  return Math.ceil(contentLength / 4);
}
