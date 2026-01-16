/**
 * Close Support Ticket API
 * =========================
 * 
 * Phase 4: Task 4.6
 * 
 * POST /api/support/conversations/[id]/close - Close ticket
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

        // Already closed?
        if (conversation.status === 'closed') {
            return NextResponse.json(
                { error: 'El ticket ya está cerrado' },
                { status: 400 }
            );
        }

        // Parse optional close message from body
        let closeMessage: string | null = null;
        try {
            const body = await request.json();
            closeMessage = body.message || null;
        } catch {
            // No body is fine
        }

        // If there's a close message, add it
        if (closeMessage) {
            await prisma.publicSupportMessage.create({
                data: {
                    conversationId: id,
                    role: 'admin',
                    content: closeMessage,
                    respondedBy: session.userId,
                    readByAdmin: true,
                    readByVisitor: false,
                    metadata: { type: 'close_message' },
                },
            });
        }

        // Close the conversation
        await prisma.publicSupportConversation.update({
            where: { id },
            data: {
                status: 'closed',
                closedAt: new Date(),
                lastActivityAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            ticketNumber: conversation.ticketNumber,
        });
    } catch (error) {
        console.error('[Support API] Error closing conversation:', error);
        return NextResponse.json(
            { error: 'Error al cerrar ticket' },
            { status: 500 }
        );
    }
}
