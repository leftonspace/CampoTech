/**
 * Support Conversations API
 * =========================
 * 
 * Phase 4: Task 4.2
 * 
 * GET /api/support/conversations - List all support tickets (admin)
 * POST /api/support/conversations - Create new conversation (public)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTicketNumber } from '@/lib/services/support-notification';

// =============================================================================
// GET - List conversations (Admin only)
// =============================================================================

export async function GET(request: NextRequest) {
    try {
        // Check admin auth
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'No autorizado - Solo administradores' },
                { status: 401 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const skip = (page - 1) * limit;

        // Build where clause
        const where: Record<string, unknown> = {};

        if (status && status !== 'all') {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { ticketNumber: { contains: search, mode: 'insensitive' } },
                { visitorName: { contains: search, mode: 'insensitive' } },
                { visitorEmail: { contains: search, mode: 'insensitive' } },
                { visitorPhone: { contains: search } },
            ];
        }

        // Fetch conversations with latest message
        const [conversations, total] = await Promise.all([
            prisma.publicSupportConversation.findMany({
                where,
                orderBy: [
                    { status: 'asc' }, // new_reply first
                    { lastActivityAt: 'desc' },
                ],
                skip,
                take: limit,
                include: {
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: {
                            content: true,
                            role: true,
                            createdAt: true,
                            readByAdmin: true,
                        },
                    },
                    _count: {
                        select: { messages: true },
                    },
                },
            }),
            prisma.publicSupportConversation.count({ where }),
        ]);

        // Count unread
        const unreadCount = await prisma.publicSupportConversation.count({
            where: { status: 'new_reply' },
        });

        // Transform for response
        type ConversationWithRelations = typeof conversations[number];
        const transformedConversations = conversations.map((conv: ConversationWithRelations) => ({
            id: conv.id,
            ticketNumber: conv.ticketNumber,
            visitorName: conv.visitorName || 'Visitante anónimo',
            visitorEmail: conv.visitorEmail,
            visitorPhone: conv.visitorPhone,
            status: conv.status,
            category: conv.category,
            aiDisabled: conv.aiDisabled,
            escalatedAt: conv.escalatedAt,
            createdAt: conv.createdAt,
            lastActivityAt: conv.lastActivityAt,
            closedAt: conv.closedAt,
            messageCount: conv._count.messages,
            lastMessage: conv.messages[0] || null,
            hasUnread: conv.messages[0]?.readByAdmin === false && conv.messages[0]?.role === 'user',
        }));

        return NextResponse.json({
            data: transformedConversations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            unreadCount,
        });
    } catch (error) {
        console.error('[Support API] Error listing conversations:', error);
        return NextResponse.json(
            { error: 'Error al obtener conversaciones' },
            { status: 500 }
        );
    }
}

// =============================================================================
// POST - Create new conversation (Public - no auth required)
// =============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, message, pageUrl, userAgent } = body;

        if (!sessionId || !message) {
            return NextResponse.json(
                { error: 'sessionId and message are required' },
                { status: 400 }
            );
        }

        // Check if conversation already exists for this session
        let conversation = await prisma.publicSupportConversation.findUnique({
            where: { sessionId },
        });

        if (!conversation) {
            // Create new conversation with ticket number
            const ticketNumber = generateTicketNumber();

            conversation = await prisma.publicSupportConversation.create({
                data: {
                    sessionId,
                    ticketNumber,
                    status: 'open',
                    pageUrl,
                    userAgent,
                    lastActivityAt: new Date(),
                },
            });
        }

        // Add the message
        const newMessage = await prisma.publicSupportMessage.create({
            data: {
                conversationId: conversation.id,
                role: 'user',
                content: message,
                readByAdmin: false,
                readByVisitor: true,
            },
        });

        // Update conversation activity and status if needed
        const updateData: Record<string, unknown> = {
            lastActivityAt: new Date(),
        };

        // If admin had responded and visitor is replying, mark as new_reply
        if (conversation.status === 'responded') {
            updateData.status = 'new_reply';
        }

        await prisma.publicSupportConversation.update({
            where: { id: conversation.id },
            data: updateData,
        });

        return NextResponse.json({
            conversationId: conversation.id,
            ticketNumber: conversation.ticketNumber,
            messageId: newMessage.id,
        });
    } catch (error) {
        console.error('[Support API] Error creating conversation:', error);
        return NextResponse.json(
            { error: 'Error al crear conversación' },
            { status: 500 }
        );
    }
}
