/**
 * Support Conversation Response API
 * ==================================
 * 
 * Phase 4: Task 4.6
 * 
 * POST /api/support/conversations/[id]/respond - Admin responds to ticket
 * GET /api/support/conversations/[id] - Get conversation with messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSupportNotification, NotificationChannel } from '@/lib/services/support-notification';

// =============================================================================
// GET - Get single conversation with all messages
// =============================================================================

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check admin auth
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const conversation = await prisma.publicSupportConversation.findUnique({
            where: { id },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!conversation) {
            return NextResponse.json(
                { error: 'Conversación no encontrada' },
                { status: 404 }
            );
        }

        // Mark all user messages as read by admin
        await prisma.publicSupportMessage.updateMany({
            where: {
                conversationId: id,
                role: 'user',
                readByAdmin: false,
            },
            data: { readByAdmin: true },
        });

        // If status was new_reply, change to pending_response since admin is viewing
        if (conversation.status === 'new_reply') {
            await prisma.publicSupportConversation.update({
                where: { id },
                data: { status: 'pending_response' },
            });
        }

        return NextResponse.json({ data: conversation });
    } catch (error) {
        console.error('[Support API] Error getting conversation:', error);
        return NextResponse.json(
            { error: 'Error al obtener conversación' },
            { status: 500 }
        );
    }
}

// =============================================================================
// POST - Admin responds to conversation
// =============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check admin auth
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { message, notifyVia = [] } = body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json(
                { error: 'El mensaje es requerido' },
                { status: 400 }
            );
        }

        // Get conversation
        const conversation = await prisma.publicSupportConversation.findUnique({
            where: { id },
        });

        if (!conversation) {
            return NextResponse.json(
                { error: 'Conversación no encontrada' },
                { status: 404 }
            );
        }

        // Create admin message
        const adminMessage = await prisma.publicSupportMessage.create({
            data: {
                conversationId: id,
                role: 'admin',
                content: message.trim(),
                respondedBy: session.userId,
                readByAdmin: true,
                readByVisitor: false,
                notifiedVia: [],
            },
        });

        // Update conversation status
        await prisma.publicSupportConversation.update({
            where: { id },
            data: {
                status: 'responded',
                aiDisabled: true, // Once admin responds, AI is disabled
                lastActivityAt: new Date(),
            },
        });

        // Send notifications
        const channels = notifyVia.filter((c: string) => ['push', 'email', 'whatsapp'].includes(c)) as NotificationChannel[];

        if (channels.length > 0) {
            const notificationResults = await sendSupportNotification({
                ticketNumber: conversation.ticketNumber,
                ticketId: conversation.id,
                message: message.trim(),
                channels,
                recipient: {
                    email: conversation.visitorEmail || undefined,
                    phone: conversation.visitorPhone || undefined,
                    pushSubscription: conversation.pushSubscription || undefined,
                },
                adminName: typeof session.name === 'string' ? session.name : 'Equipo CampoTech',
            });

            // Update message with notification status
            const sentChannels = Object.entries(notificationResults)
                .filter(([_, v]) => v.sent)
                .map(([k]) => k);

            if (sentChannels.length > 0) {
                await prisma.publicSupportMessage.update({
                    where: { id: adminMessage.id },
                    data: {
                        notifiedVia: sentChannels,
                        notifiedAt: new Date(),
                    },
                });
            }

            return NextResponse.json({
                messageId: adminMessage.id,
                notifications: notificationResults,
            });
        }

        return NextResponse.json({
            messageId: adminMessage.id,
            notifications: null,
        });
    } catch (error) {
        console.error('[Support API] Error responding to conversation:', error);
        return NextResponse.json(
            { error: 'Error al enviar respuesta' },
            { status: 500 }
        );
    }
}
