/**
 * Public Chat API Route
 * ======================
 * 
 * Phase 4 Enhanced: Database persistence + Escalation tracking
 * 
 * Handles AI chat for unauthenticated users on public pages.
 * Routes ALL questions to the LangGraph support bot workflow.
 * 
 * The LangGraph workflow has:
 * - Full business knowledge (pricing, features, 21-day trial)
 * - FAQ database for common questions
 * - Smart classification (ventas, caracteristicas, facturacion, etc.)
 * 
 * For public visitors:
 * - Collect contact info BEFORE escalating to human support
 * - Persist all conversations to database
 * - Generate ticket numbers for escalation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateTicketNumber } from '@/lib/services/support-notification';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || process.env.VOICE_AI_SERVICE_URL || 'http://localhost:8000';

// Session storage for collecting escalation info (in-memory for now)
const escalationSessions = new Map<string, {
    needsEscalation: boolean;
    collectingInfo: boolean;
    infoStage: 'name' | 'contact' | 'issue' | 'done';
    name?: string;
    email?: string;
    phone?: string;
    originalIssue?: string;
}>();

// Conversation history storage (in-memory for session persistence)
const conversationHistory = new Map<string, Array<{ role: string; content: string }>>();

/**
 * Get or create a database conversation for this session
 */
async function getOrCreateConversation(sessionId: string, pageUrl?: string): Promise<{
    id: string;
    ticketNumber: string;
    aiDisabled: boolean;
}> {
    let conversation = await prisma.publicSupportConversation.findUnique({
        where: { sessionId },
        select: { id: true, ticketNumber: true, aiDisabled: true },
    });

    if (!conversation) {
        const ticketNumber = generateTicketNumber();
        conversation = await prisma.publicSupportConversation.create({
            data: {
                sessionId,
                ticketNumber,
                status: 'open',
                pageUrl,
                lastActivityAt: new Date(),
            },
            select: { id: true, ticketNumber: true, aiDisabled: true },
        });
    }

    return conversation;
}

/**
 * Save a message to the database
 */
async function saveMessage(conversationId: string, role: string, content: string): Promise<void> {
    await prisma.publicSupportMessage.create({
        data: {
            conversationId,
            role,
            content,
            readByAdmin: role !== 'user',
            readByVisitor: role !== 'admin',
        },
    });

    // Update conversation activity
    await prisma.publicSupportConversation.update({
        where: { id: conversationId },
        data: { lastActivityAt: new Date() },
    });
}

export async function POST(request: NextRequest) {
    try {
        const { message, sessionId, context, pageUrl } = await request.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        const session = sessionId || `anon_${Date.now()}`;

        // Get or create database conversation
        const conversation = await getOrCreateConversation(session, pageUrl);

        // Check if we're collecting escalation info for this session
        const escSession = escalationSessions.get(session);
        if (escSession?.collectingInfo) {
            return handleEscalationInfoCollection(session, message, escSession, conversation);
        }

        // If AI is disabled for this conversation (admin has taken over), just save message
        if (conversation.aiDisabled) {
            await saveMessage(conversation.id, 'user', message);

            // Update status to new_reply
            await prisma.publicSupportConversation.update({
                where: { id: conversation.id },
                data: { status: 'new_reply' },
            });

            return NextResponse.json({
                response: '📨 Tu mensaje fue enviado. Nuestro equipo lo revisará pronto.',
                ticketNumber: conversation.ticketNumber,
                aiDisabled: true,
            });
        }

        // Get or create conversation history
        const history = conversationHistory.get(session) || [];

        // Add user message to history
        history.push({ role: 'user', content: message });
        await saveMessage(conversation.id, 'user', message);

        // Call the LangGraph AI service
        try {
            const response = await fetch(`${AI_SERVICE_URL}/api/support/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: history,
                    session_id: session,
                    context: context || 'public_website',
                    is_public: true,
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (response.ok) {
                const data = await response.json();

                // Add AI response to history
                const aiResponse = data.response || data.message || 'Lo siento, no pude procesar tu consulta.';
                history.push({ role: 'assistant', content: aiResponse });
                conversationHistory.set(session, history);
                await saveMessage(conversation.id, 'assistant', aiResponse);

                // If AI wants to escalate, start collecting info first
                if (data.escalated || data.escalate_to_human) {
                    escalationSessions.set(session, {
                        needsEscalation: true,
                        collectingInfo: true,
                        infoStage: 'name',
                        originalIssue: message,
                    });

                    const collectInfoMessage = 'Entiendo que necesitás hablar con alguien de nuestro equipo. 🤝\n\nPara poder contactarte, ¿podés decirme tu nombre?';
                    history.push({ role: 'assistant', content: collectInfoMessage });
                    conversationHistory.set(session, history);
                    await saveMessage(conversation.id, 'assistant', collectInfoMessage);

                    return NextResponse.json({
                        response: collectInfoMessage,
                        collectingInfo: true,
                        ticketNumber: conversation.ticketNumber,
                    });
                }

                return NextResponse.json({
                    response: aiResponse,
                    category: data.category,
                    ticketNumber: conversation.ticketNumber,
                });
            } else {
                console.error('[Public Chat] AI service returned error:', response.status);
                throw new Error(`AI service error: ${response.status}`);
            }
        } catch (aiError) {
            console.error('[Public Chat] AI service error:', aiError);

            // Simple fallback if AI service is completely down
            const fallbackMessage = `¡Gracias por tu mensaje! 😊

Parece que nuestro asistente AI está ocupado en este momento. 

Mientras tanto, podés:
• **Explorar nuestros planes**: Ver la sección "Precios" arriba
• **Prueba gratis de 21 días**: Hacer click en "Empezar ahora"
• **Contactarnos**: soporte@campotech.com.ar

¿Hay algo específico que pueda ayudarte?`;

            history.push({ role: 'assistant', content: fallbackMessage });
            conversationHistory.set(session, history);
            await saveMessage(conversation.id, 'assistant', fallbackMessage);

            return NextResponse.json({
                response: fallbackMessage,
                fallback: true,
                ticketNumber: conversation.ticketNumber,
            });
        }
    } catch (error) {
        console.error('[Public Chat] Error:', error);

        return NextResponse.json({
            response: 'Lo siento, hubo un error técnico. Por favor intentá de nuevo o escribinos a soporte@campotech.com.ar',
            error: true,
        });
    }
}

/**
 * Handle collecting info before escalation
 */
async function handleEscalationInfoCollection(
    sessionId: string,
    message: string,
    session: NonNullable<ReturnType<typeof escalationSessions.get>>,
    conversation: { id: string; ticketNumber: string }
) {
    const text = message.trim();
    const history = conversationHistory.get(sessionId) || [];

    // Add user message to history
    history.push({ role: 'user', content: text });
    await saveMessage(conversation.id, 'user', text);

    let responseMessage = '';

    switch (session.infoStage) {
        case 'name':
            session.name = text;
            session.infoStage = 'contact';
            escalationSessions.set(sessionId, session);
            responseMessage = `Gracias ${text}! 😊\n\n¿Cuál es tu email o teléfono para que podamos contactarte?`;
            break;

        case 'contact':
            // Detect if email or phone
            if (text.includes('@')) {
                session.email = text;
            } else {
                session.phone = text.replace(/\D/g, '');
            }
            session.infoStage = 'issue';
            escalationSessions.set(sessionId, session);
            responseMessage = '¡Perfecto! ¿Podrías contarnos brevemente cuál es tu consulta o problema? Así nuestro equipo puede prepararse mejor para ayudarte.';
            break;

        case 'issue':
            session.infoStage = 'done';
            session.collectingInfo = false;
            escalationSessions.set(sessionId, session);

            // Update conversation with contact info and escalate
            await prisma.publicSupportConversation.update({
                where: { id: conversation.id },
                data: {
                    visitorName: session.name,
                    visitorEmail: session.email,
                    visitorPhone: session.phone,
                    status: 'pending_response',
                    escalatedAt: new Date(),
                    category: 'escalated',
                },
            });

            const contact = session.email || session.phone;
            responseMessage = `¡Gracias ${session.name}! 🎉\n\nTu consulta fue registrada con el **ticket #${conversation.ticketNumber}** y nuestro equipo te contactará a ${contact} en las próximas 24 horas hábiles.\n\n📝 Consulta: "${text}"\n\n¿Hay algo más en lo que pueda ayudarte mientras tanto?`;
            break;

        default:
            responseMessage = '¿En qué puedo ayudarte?';
    }

    // Add AI response to history and save
    history.push({ role: 'assistant', content: responseMessage });
    conversationHistory.set(sessionId, history);
    await saveMessage(conversation.id, 'assistant', responseMessage);

    return NextResponse.json({
        response: responseMessage,
        collectingInfo: session.infoStage !== 'done',
        ticketNumber: conversation.ticketNumber,
        leadCollected: session.infoStage === 'done' ? {
            name: session.name,
            email: session.email,
            phone: session.phone,
            issue: text,
        } : undefined,
    });
}

