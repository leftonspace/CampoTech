/**
 * Phase 7.3: Support Chat API Route
 * ===================================
 * 
 * POST /api/support/chat - Chat with AI support bot
 * 
 * This route proxies requests to the AI service's support bot.
 * If the AI service is unavailable, falls back to basic responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatRequest {
    messages: ChatMessage[];
    session_id?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK RESPONSES
// ═══════════════════════════════════════════════════════════════════════════════

const FALLBACK_RESPONSES: Record<string, string> = {
    facturacion: "Para problemas con facturación AFIP, revisá nuestra sección de ayuda en /ayuda#facturacion. Si necesitás asistencia personalizada, escribinos a soporte@campotech.com.ar",
    pagos: "Para temas de pagos y suscripciones, andá a Configuración > Suscripción. También podés ver las FAQs en /ayuda#pagos",
    whatsapp: "Para dudas sobre WhatsApp AI y créditos, visitá /ayuda#whatsapp. Si te quedaste sin créditos, tenés 50 de emergencia disponibles.",
    default: "Gracias por tu mensaje. Nuestro equipo de soporte te responderá pronto. Mientras tanto, podés revisar las preguntas frecuentes en /ayuda",
};

function classifyMessageLocally(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('factura') || lowerMessage.includes('afip') ||
        lowerMessage.includes('cuit') || lowerMessage.includes('certificado')) {
        return 'facturacion';
    }
    if (lowerMessage.includes('pago') || lowerMessage.includes('suscripci') ||
        lowerMessage.includes('plan') || lowerMessage.includes('mercado')) {
        return 'pagos';
    }
    if (lowerMessage.includes('whatsapp') || lowerMessage.includes('crédito') ||
        lowerMessage.includes('mensaje') || lowerMessage.includes('bot')) {
        return 'whatsapp';
    }

    return 'default';
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Chat with support bot
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const session = await getSession().catch(() => null);
        const body = await request.json() as ChatRequest;

        const { messages, session_id } = body;

        if (!messages || messages.length === 0) {
            return NextResponse.json(
                { error: 'Messages are required' },
                { status: 400 }
            );
        }

        // Try to call the AI service
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

        try {
            const response = await fetch(`${aiServiceUrl}/api/support/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages,
                    user_id: session?.userId,
                    organization_id: session?.organizationId,
                    session_id,
                }),
                signal: AbortSignal.timeout(15000), // 15 second timeout
            });

            if (response.ok) {
                const data = await response.json();
                return NextResponse.json(data);
            }

            // AI service returned an error, fall through to fallback
            console.warn('[Support Chat] AI service returned error:', response.status);

        } catch (error) {
            console.warn('[Support Chat] AI service unavailable, using fallback:', error);
        }

        // Fallback: use local classification and canned responses
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const category = classifyMessageLocally(lastUserMessage?.content || '');
        const fallbackResponse = FALLBACK_RESPONSES[category] || FALLBACK_RESPONSES.default;

        return NextResponse.json({
            response: fallbackResponse,
            category,
            escalated: false,
            resolved: false,
            session_id: session_id || crypto.randomUUID(),
            fallback: true,
        });

    } catch (error) {
        console.error('[Support Chat] Error:', error);

        return NextResponse.json(
            {
                error: 'Error processing chat message',
                response: 'Lo siento, hubo un error. Por favor intentá de nuevo o escribinos a soporte@campotech.com.ar',
            },
            { status: 500 }
        );
    }
}
