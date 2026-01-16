/**
 * Public Chat History API
 * =======================
 * 
 * Phase 4: Task 4.4
 * 
 * GET /api/support/public-chat/history - Load conversation history for a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json(
                { error: 'sessionId is required' },
                { status: 400 }
            );
        }

        // Find conversation by session ID
        const conversation = await prisma.publicSupportConversation.findUnique({
            where: { sessionId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        role: true,
                        content: true,
                        createdAt: true,
                        readByVisitor: true,
                    },
                },
            },
        });

        if (!conversation) {
            // No conversation found - this is okay, it means new visitor
            return NextResponse.json({
                messages: [],
                ticketNumber: null,
                hasUnreadAdmin: false,
            });
        }

        // Check for unread admin messages
        type MessageType = typeof conversation.messages[number];
        const hasUnreadAdmin = conversation.messages.some(
            (msg: MessageType) => msg.role === 'admin' && !msg.readByVisitor
        );

        // Mark admin messages as read by visitor
        if (hasUnreadAdmin) {
            await prisma.publicSupportMessage.updateMany({
                where: {
                    conversationId: conversation.id,
                    role: 'admin',
                    readByVisitor: false,
                },
                data: { readByVisitor: true },
            });
        }

        return NextResponse.json({
            messages: conversation.messages,
            ticketNumber: conversation.ticketNumber,
            hasUnreadAdmin,
            status: conversation.status,
            aiDisabled: conversation.aiDisabled,
        });
    } catch (error) {
        console.error('[Public Chat History] Error:', error);
        return NextResponse.json(
            { error: 'Error loading history' },
            { status: 500 }
        );
    }
}
