/**
 * WhatsApp Simulation API
 * =======================
 * 
 * Phase 3: Test Simulation
 * 
 * Allows injecting fake customer messages to test the AI Copilot
 * without requiring a real WhatsApp connection.
 * 
 * DEVELOPMENT ONLY - Returns 403 in production.
 * 
 * POST /api/dev/whatsapp-simulate
 * Body: { phone: string, text: string, organizationId?: string, customerName?: string }
 * 
 * GET /api/dev/whatsapp-simulate/customers?organizationId=xxx
 * Returns: List of customers that can be used for simulation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SimulateRequest {
    phone: string;
    text: string;
    organizationId?: string;
    customerName?: string;
    messageType?: 'text' | 'audio';
}

interface SimulateResponse {
    success: boolean;
    message: string;
    data?: {
        conversationId: string;
        messageId: string;
        customerName: string;
        customerPhone: string;
        aiProcessing: boolean;
    };
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST: Simulate Inbound Message
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<SimulateResponse>> {
    console.log('[SIMULATION POST] Handler start');

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { success: false, message: 'Not available in production', error: 'PRODUCTION_BLOCKED' },
            { status: 403 }
        );
    }

    try {
        // Get session to determine organization
        console.log('[SIMULATION POST] Getting session...');
        const session = await getSession();
        console.log('[SIMULATION POST] Session:', session ? 'exists' : 'null');

        // Parse request body
        console.log('[SIMULATION POST] Parsing body...');
        const body = await request.json() as SimulateRequest;
        console.log('[SIMULATION POST] Body:', JSON.stringify(body));
        const { phone, text, organizationId: providedOrgId, customerName, messageType = 'text' } = body;

        // Validate required fields
        if (!phone || !text) {
            return NextResponse.json(
                { success: false, message: 'Phone and text are required', error: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Normalize phone number (ensure it has country code)
        const normalizedPhone = phone.startsWith('+') ? phone : `+54${phone.replace(/^0/, '')}`;

        // Determine organization ID
        let organizationId = providedOrgId;

        if (!organizationId && session?.organizationId) {
            organizationId = session.organizationId;
        }

        if (!organizationId) {
            // Try to find the first organization (dev mode fallback)
            const firstOrg = await prisma.organization.findFirst({
                select: { id: true },
            });
            organizationId = firstOrg?.id;
        }

        if (!organizationId) {
            return NextResponse.json(
                { success: false, message: 'No organization found', error: 'NO_ORG' },
                { status: 400 }
            );
        }

        // Check if AI is enabled for this organization
        const aiConfig = await prisma.aIConfiguration.findUnique({
            where: { organizationId },
            select: { isEnabled: true, autoResponseEnabled: true },
        });

        // Try to find existing customer by phone
        let resolvedCustomerName = customerName;
        const existingCustomer = await prisma.customer.findFirst({
            where: {
                organizationId,
                phone: normalizedPhone,
            },
            select: { id: true, name: true },
        });

        if (existingCustomer && !resolvedCustomerName) {
            resolvedCustomerName = existingCustomer.name;
        }

        // Generate a unique message ID for simulation
        const simulatedMessageId = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        console.log('📱 [SIMULATION] Injecting fake WhatsApp message:', {
            organizationId,
            phone: normalizedPhone,
            customerName: resolvedCustomerName,
            messageType,
            textPreview: text.substring(0, 50),
        });

        // Instead of calling the full pipeline (which requires Redis/realtime),
        // create the conversation and message directly in the database for simulation
        console.log('[SIMULATION] Creating/updating conversation and message directly...');

        // Get or create conversation
        let conversation = await prisma.waConversation.findFirst({
            where: {
                organizationId,
                customerPhone: normalizedPhone,
            },
        });

        if (!conversation) {
            conversation = await prisma.waConversation.create({
                data: {
                    organizationId,
                    customerId: existingCustomer?.id || '',
                    customerPhone: normalizedPhone,
                    customerName: resolvedCustomerName || 'Cliente Simulado',
                    lastMessageAt: new Date(),
                    lastMessagePreview: text.substring(0, 100),
                    lastMessageDirection: 'inbound',
                    lastMessageStatus: 'received',
                    unreadCount: 1,
                    isActive: true,
                },
            });
        } else {
            conversation = await prisma.waConversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: new Date(),
                    lastMessagePreview: text.substring(0, 100),
                    lastMessageDirection: 'inbound',
                    lastMessageStatus: 'received',
                    unreadCount: { increment: 1 },
                },
            });
        }

        // Create the message
        const waMessage = await prisma.waMessage.create({
            data: {
                organizationId,
                conversationId: conversation.id,
                customerId: existingCustomer?.id || '',
                waMessageId: simulatedMessageId,
                direction: 'inbound',
                type: messageType,
                from: normalizedPhone,
                to: organizationId, // org is the recipient
                content: text,
                status: 'received',
            },
        });

        console.log('✅ [SIMULATION] Message created:', waMessage.id);

        console.log('✅ [SIMULATION] Message processed successfully:', {
            conversationId: conversation?.id,
            messageId: simulatedMessageId,
            aiEnabled: aiConfig?.isEnabled,
        });

        return NextResponse.json({
            success: true,
            message: 'Simulated message processed successfully',
            data: {
                conversationId: conversation?.id || 'unknown',
                messageId: simulatedMessageId,
                customerName: resolvedCustomerName || 'Cliente Simulado',
                customerPhone: normalizedPhone,
                aiProcessing: aiConfig?.isEnabled && aiConfig?.autoResponseEnabled || false,
            },
        });

    } catch (error) {
        console.error('❌ [SIMULATION] Error processing simulated message:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to process simulated message',
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET: List Customers for Simulation
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerForSimulation {
    id: string;
    name: string;
    phone: string;
    hasActiveConversation: boolean;
    lastJobType?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    console.log('[SIMULATION GET] Handler invoked');

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'Not available in production' },
            { status: 403 }
        );
    }

    try {
        // Get organization ID - from query param, session, or first org as fallback
        const searchParams = request.nextUrl.searchParams;
        let organizationId = searchParams.get('organizationId');

        // Try to get from session if not in query param
        if (!organizationId) {
            try {
                const session = await getSession();
                if (session?.organizationId) {
                    organizationId = session.organizationId;
                    console.log('[SIMULATION GET] Using session org:', organizationId);
                }
            } catch (_e) {
                console.log('[SIMULATION GET] No session found');
            }
        }

        // Fallback to first org
        if (!organizationId) {
            const firstOrg = await prisma.organization.findFirst({
                select: { id: true }
            });
            organizationId = firstOrg?.id || null;
            console.log('[SIMULATION GET] Using fallback org:', organizationId);
        }

        if (!organizationId) {
            return NextResponse.json({
                customers: [],
                organizationId: null,
                aiEnabled: false,
                autoResponseEnabled: false,
                sampleMessages: ['Hola, necesito un plomero'],
                debug: 'No organization found'
            });
        }

        // Fetch customers (filter nulls in JS due to Prisma edge case)
        const rawCustomers = await prisma.customer.findMany({
            where: {
                organizationId,
            },
            select: {
                id: true,
                name: true,
                phone: true,
                jobs: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { serviceType: true },
                },
            },
            take: 50,
            orderBy: { updatedAt: 'desc' },
        });

        // Get active conversation phones - filter out null phones
        type CustomerWithJobs = { id: string; name: string; phone: string | null; jobs: Array<{ serviceType: unknown }> };
        const customers = (rawCustomers as CustomerWithJobs[]).filter((c: CustomerWithJobs) => c.phone !== null);
        const customerPhones = customers.map((c: CustomerWithJobs) => c.phone!);

        const activeConversations = customerPhones.length > 0
            ? await prisma.waConversation.findMany({
                where: {
                    organizationId,
                    customerPhone: { in: customerPhones },
                },
                select: { customerPhone: true },
            })
            : [];

        const activePhones = new Set(activeConversations.map((c: { customerPhone: string }) => c.customerPhone));

        // Map to result format
        const result: CustomerForSimulation[] = customers.map((c: CustomerWithJobs) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            hasActiveConversation: activePhones.has(c.phone || ''),
            lastJobType: c.jobs[0]?.serviceType ? String(c.jobs[0].serviceType) : undefined,
        }));

        // AI configuration status
        const aiConfig = await prisma.aIConfiguration.findUnique({
            where: { organizationId },
            select: { isEnabled: true, autoResponseEnabled: true },
        });

        return NextResponse.json({
            customers: result,
            organizationId,
            aiEnabled: aiConfig?.isEnabled || false,
            autoResponseEnabled: aiConfig?.autoResponseEnabled || false,
            sampleMessages: [
                'Hola, necesito un plomero para mañana',
                'Tengo una pérdida de agua en el baño',
                '¿Cuánto sale la instalación de un split?',
                'Quiero programar un turno para el lunes',
                '¿Tienen disponibilidad esta semana?',
                'Necesito urgente un técnico de gas',
            ],
        });

    } catch (error) {
        console.error('[SIMULATION GET] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch simulation data',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
