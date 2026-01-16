/**
 * AI Co-Pilot Chat API
 * ====================
 *
 * Handles chat messages between the owner/dispatcher and the AI co-pilot.
 * The AI can see the current WhatsApp conversation and help with tasks.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for the co-pilot
const SYSTEM_PROMPT = `Eres un asistente de IA que ayuda al dueño/despachador de un negocio de servicios de campo (climatización, plomería, electricidad, etc.) a gestionar sus conversaciones de WhatsApp con clientes.

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

    if (!session?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Phase 5.4: Allow OWNER, DISPATCHER, and TECHNICIAN roles
    const userRole = session.role?.toUpperCase() || '';
    const allowedRoles = ['OWNER', 'DISPATCHER', 'TECHNICIAN'];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tenés permiso para usar el co-pilot' },
        { status: 403 }
      );
    }

    const body: ChatRequest = await request.json();
    const { message, conversationId, context } = body;

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
                  title: true,
                  status: true,
                  scheduledDate: true,
                  total: true,
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
            customerHistory += `\nTrabajos recientes: ${jobs.map((j: { title: string; status: string }) => `${j.title} (${j.status})`).join(', ')}`;
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
    const isScheduleRequest = /horario|disponib|agenda|libre/i.test(message);

    // Phase 5.3: Build language-aware system prompt
    const languageAddendum = getLanguageAwarePrompt(
      context?.customerLanguage,
      context?.customerLanguageName
    );
    const fullSystemPrompt = SYSTEM_PROMPT + languageAddendum;

    // Get AI response
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

    return NextResponse.json({
      success: true,
      response: aiResponse,
      type: responseType,
      actions: actions.length > 0 ? actions : undefined,
      metadata: {
        intent: isJobRequest ? 'create_job' : isReplyRequest ? 'suggest_reply' : isSummaryRequest ? 'summary' : isScheduleRequest ? 'check_schedule' : 'general',
      },
    });
  } catch (error) {
    console.error('Copilot chat error:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing copilot request' },
      { status: 500 }
    );
  }
}
