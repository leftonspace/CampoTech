/**
 * AI Co-Pilot Chat API
 * ====================
 *
 * Handles chat messages between the owner/ADMIN and the AI co-pilot.
 * The AI can see the current WhatsApp conversation and help with tasks.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// Phase 8 Security: Prompt sanitization and rate limiting (P2, P3)
import { checkCombinedAILimits, getRateLimitHeaders } from '@/lib/ai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for the co-pilot
const SYSTEM_PROMPT = `Eres un asistente de IA que ayuda al dueño/Administrador de un negocio de servicios de campo (climatización, plomería, electricidad, etc.) a gestionar sus conversaciones de WhatsApp con clientes.

Tu rol es INTERNO - nunca te comunicas directamente con los clientes. Solo ayudas al operador humano.

Podés ver la conversación actual y ayudar con:
- Crear trabajos y citas
- Sugerir respuestas profesionales
- Verificar disponibilidad de agenda
- Extraer información de los mensajes
- Alertar sobre posibles problemas (conflictos de agenda, etc.)

IMPORTANTE:
- Siempre respondé en español de Argentina (vos, tenés, podés, etc.)
- Sé conciso y directo - el operador está ocupado
- Cuando sugierAs acciones, proporcioná opciones claras
- Siempre confirmá antes de ejecutar acciones que crean/modifican datos
- Si detectás que el cliente menciona un problema o necesita un servicio, ofrecé crear un trabajo
- Si el operador menciona una fecha/hora, verificá si hay conflictos de agenda

Formato de respuesta:
- Para sugerencias de respuesta, ofrecé 2-3 opciones con diferentes tonos
- Para crear trabajos, mostrá un resumen antes de confirmar
- Para alertas, usá emojis ⚠️ o ✅ para llamar la atención`;

// Phase 5.3: Language-aware prompt addition
const getLanguageAwarePrompt = (customerLanguage?: string, customerLanguageName?: string) => {
  if (!customerLanguage || customerLanguage === 'es') {
    return '';
  }

  return `

CONTEXTO DE IDIOMA:
El cliente habla ${customerLanguageName || customerLanguage} (código: ${customerLanguage}).
- Cuando sugieras respuestas para enviar al cliente, redactalas en ${customerLanguageName || customerLanguage}
- Los mensajes del cliente que ves ya están traducidos al español para tu referencia
- Manteneme informado en español de Argentina, pero las respuestas que deben ir al cliente van en ${customerLanguageName || customerLanguage}`;
};

interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    messages?: Array<{
      content: string;
      direction: 'inbound' | 'outbound';
      senderType?: 'customer' | 'ai' | 'human';
      timestamp?: string;
    }>;
    customer?: {
      name?: string;
      phone?: string;
    };
    customer_history?: {
      jobs?: unknown[];
      invoices?: unknown[];
    };
    // Phase 5.3: Customer language context
    customerLanguage?: string;      // ISO code
    customerLanguageName?: string;  // Full name
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    console.log('[COPILOT] Session:', session ? {
      userId: session.userId,
      organizationId: session.organizationId,
      role: session.role
    } : 'null');

    if (!session?.organizationId) {
      console.log('[COPILOT] Unauthorized - no session or org');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Phase 5.4: Allow OWNER, ADMIN, and TECHNICIAN roles
    const userRole = session.role?.toUpperCase() || '';
    const allowedRoles = ['OWNER', 'ADMIN', 'TECHNICIAN'];
    console.log('[COPILOT] Role check:', { userRole, allowed: allowedRoles.includes(userRole) });
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tenés permiso para usar el co-pilot' },
        { status: 403 }
      );
    }

    const body: ChatRequest = await request.json();
    const { message, conversationId, context } = body;
    console.log('[COPILOT] Request body:', { message, conversationId, hasContext: !!context });

    // Phase 8 Security: Rate limit AI requests (P3)
    const rateLimit = await checkCombinedAILimits(session.userId, session.organizationId, 'copilot');
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: rateLimit.error || 'Rate limit exceeded' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Phase 5.4: For TECHNICIAN role, verify they are assigned to the conversation
    if (userRole === 'TECHNICIAN' && conversationId) {
      const conversation = await prisma.waConversation.findFirst({
        where: {
          id: conversationId,
          organizationId: session.organizationId,
          assignedToId: session.userId,
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { success: false, error: 'No estás asignado a esta conversación' },
          { status: 403 }
        );
      }
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build context messages for the AI
    const contextMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add conversation context if available
    if (context?.messages && context.messages.length > 0) {
      const conversationContext = context.messages
        .map((m) => {
          const sender = m.direction === 'inbound'
            ? `Cliente (${context.customer?.name || 'Desconocido'})`
            : m.senderType === 'ai' ? 'AI' : 'Operador';
          return `${sender}: ${m.content}`;
        })
        .join('\n');

      contextMessages.push({
        role: 'system',
        content: `Contexto de la conversación actual de WhatsApp con ${context.customer?.name || 'cliente desconocido'} (${context.customer?.phone || ''}):\n\n${conversationContext}`,
      });
    }

    // Fetch additional context from database
    let customerHistory = '';
    if (conversationId) {
      const conversation = await prisma.waConversation.findUnique({
        where: { id: conversationId },
        include: {
          customer: {
            include: {
              jobs: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  serviceType: true,
                  description: true,
                  status: true,
                  scheduledDate: true,
                  estimatedTotal: true,
                },
              },
              invoices: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  invoiceNumber: true,
                  status: true,
                  total: true,
                },
              },
            },
          },
        },
      });

      if (conversation?.customer) {
        const customer = conversation.customer;
        const jobs = customer.jobs || [];
        const invoices = customer.invoices || [];

        if (jobs.length > 0 || invoices.length > 0) {
          customerHistory = `\n\nHistorial del cliente ${customer.name}:`;
          if (jobs.length > 0) {
            customerHistory += `\nTrabajos recientes: ${jobs.map((j: { serviceType: string; status: string }) => `${j.serviceType} (${j.status})`).join(', ')}`;
          }
          if (invoices.length > 0) {
            const totalPaid = invoices
              .filter((i: { status: string }) => i.status === 'PAID')
              .reduce((sum: number, i: { total: number | null }) => sum + Number(i.total || 0), 0);
            customerHistory += `\nTotal facturado: $${totalPaid.toLocaleString('es-AR')}`;
          }
        }
      }
    }

    if (customerHistory) {
      contextMessages.push({
        role: 'system',
        content: customerHistory,
      });
    }

    // Detect intent and provide appropriate response
    const isJobRequest = /crear?.* trabajo|agenda|cita|visita|mandar a alguien/i.test(message);
    const isReplyRequest = /respuesta|responder|contestar|qué le digo/i.test(message);
    const isSummaryRequest = /resumen|resumí|de qué se trata/i.test(message);
    const isScheduleRequest = /horario|disponib|agenda|libre|turno|verificar/i.test(message);

    // Phase 4: Integration with scheduling intelligence
    let scheduleContext = '';
    if (isScheduleRequest || isJobRequest) {
      try {
        // Get AI configuration for business hours
        const aiConfig = await prisma.aIConfiguration.findUnique({
          where: { organizationId: session.organizationId },
          select: {
            businessHours: true,
          },
        });

        // Parse target date from message (default: tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        // Check for "mañana", "hoy", specific dates in message
        let targetDate = tomorrow;
        if (/hoy/i.test(message)) {
          targetDate = new Date();
          targetDate.setHours(0, 0, 0, 0);
        }

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Get all technicians
        const technicians = await prisma.user.findMany({
          where: {
            organizationId: session.organizationId,
            role: 'TECHNICIAN',
            isActive: true,
          },
          select: { id: true, name: true },
        });

        // Get all jobs for that day
        const jobs = await prisma.job.findMany({
          where: {
            organizationId: session.organizationId,
            scheduledDate: {
              gte: targetDate,
              lte: endOfDay,
            },
          },
          select: {
            id: true,
            serviceType: true,
            scheduledDate: true,
            estimatedDuration: true,
            technicianId: true,
          },
        });

        // Determine business hours (default 9-18)
        const businessHours = (aiConfig?.businessHours as { start?: number; end?: number }) || {};
        const workStart = businessHours.start || 9;
        const workEnd = businessHours.end || 18;

        // Calculate available slots
        const availableSlots: string[] = [];
        const occupiedSlots: string[] = [];

        for (let hour = workStart; hour < workEnd; hour += 2) {
          const slotStart = new Date(targetDate);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(targetDate);
          slotEnd.setHours(hour + 2, 0, 0, 0);

          const isOccupied = jobs.some((job: { scheduledDate: Date | null; estimatedDuration: number | null }) => {
            if (!job.scheduledDate) return false;
            const jobStart = new Date(job.scheduledDate);
            const jobEnd = new Date(job.scheduledDate);
            jobEnd.setHours(jobEnd.getHours() + (job.estimatedDuration || 2));
            return jobStart < slotEnd && jobEnd > slotStart;
          });

          const slotStr = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 2).toString().padStart(2, '0')}:00`;
          if (isOccupied) {
            occupiedSlots.push(slotStr);
          } else {
            availableSlots.push(slotStr);
          }
        }

        const dateLabel = targetDate.toDateString() === new Date().toDateString() ? 'hoy' : 'mañana';
        scheduleContext = `
DATOS REALES DE AGENDA (${dateLabel}, ${targetDate.toLocaleDateString('es-AR')}):
- Horario de trabajo: ${workStart}:00 a ${workEnd}:00
- Técnicos disponibles: ${technicians.length > 0 ? technicians.map((t: { name: string }) => t.name).join(', ') : 'Ninguno registrado'}
- Trabajos programados: ${jobs.length}
- Horarios DISPONIBLES: ${availableSlots.length > 0 ? availableSlots.join(', ') : 'No hay horarios disponibles'}
- Horarios OCUPADOS: ${occupiedSlots.length > 0 ? occupiedSlots.join(', ') : 'Ninguno'}

IMPORTANTE: Usá SOLO estos horarios reales, NO inventes horarios.`;
      } catch (err) {
        console.error('Error fetching schedule:', err);
        scheduleContext = '\n(No se pudo obtener información de agenda)';
      }
    }

    // Phase 5.3: Build language-aware system prompt
    const languageAddendum = getLanguageAwarePrompt(
      context?.customerLanguage,
      context?.customerLanguageName
    );
    const fullSystemPrompt = SYSTEM_PROMPT + languageAddendum + scheduleContext;

    // Get AI response
    console.log('[COPILOT] Calling OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...contextMessages,
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    console.log('[COPILOT] OpenAI response received');

    const aiResponse = completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu solicitud.';

    // Determine response type and actions based on intent
    let responseType: 'message' | 'suggestion' | 'warning' | 'action_result' = 'message';
    const actions: Array<{
      id: string;
      label: string;
      action: string;
      variant: 'primary' | 'secondary' | 'ghost';
      data?: Record<string, unknown>;
    }> = [];

    if (isReplyRequest) {
      responseType = 'suggestion';
      // Parse suggested replies from the AI response and add action buttons
      const replyMatch = aiResponse.match(/(?:Opción \d+|💬|"([^"]+)")/gi);
      if (replyMatch) {
        actions.push({
          id: 'use-reply-1',
          label: 'Usar respuesta',
          action: 'use_reply',
          variant: 'primary',
          data: { text: aiResponse.split('\n')[0] },
        });
        actions.push({
          id: 'regenerate',
          label: 'Regenerar',
          action: 'regenerate',
          variant: 'secondary',
        });
      }
    }

    if (isJobRequest) {
      responseType = 'suggestion';
      actions.push({
        id: 'create-job',
        label: 'Confirmar y crear',
        action: 'create_job',
        variant: 'primary',
        data: {
          customerId: conversationId,
          customerName: context?.customer?.name,
        },
      });
      actions.push({
        id: 'modify',
        label: 'Modificar',
        action: 'modify',
        variant: 'secondary',
      });
      actions.push({
        id: 'cancel',
        label: 'Cancelar',
        action: 'dismiss',
        variant: 'ghost',
      });
    }

    // Phase 4: Wire AIConversationLog to log copilot interactions
    const intent = isJobRequest ? 'create_job' : isReplyRequest ? 'suggest_reply' : isSummaryRequest ? 'summary' : isScheduleRequest ? 'check_schedule' : 'general';

    try {
      await prisma.aIConversationLog.create({
        data: {
          organizationId: session.organizationId,
          conversationId: conversationId || 'copilot-direct',
          customerMessage: message,
          messageType: 'copilot_request',
          detectedIntent: intent,
          confidenceScore: 100, // Copilot requests are explicit
          aiResponse: aiResponse,
          responseStatus: 'sent',
          feedbackType: 'response',
        },
      });
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('Error logging copilot interaction:', logError);
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      type: responseType,
      actions: actions.length > 0 ? actions : undefined,
      metadata: {
        intent,
      },
    });
  } catch (error) {
    console.error('Copilot chat error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');
    return NextResponse.json(
      { success: false, error: 'Error processing copilot request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
