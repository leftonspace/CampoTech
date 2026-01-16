/**
 * AI Feedback API
 * ================
 * 
 * Phase 5.1: Feedback Collection
 * 
 * Allows users to submit feedback on AI actions (positive/negative)
 * for training data collection and AI improvement.
 * 
 * POST /api/ai/feedback
 * - messageId: Optional - feedback on a specific WaMessage
 * - conversationLogId: Optional - feedback on an AIConversationLog
 * - feedback: "positive" | "negative"
 * - feedbackType: "response" | "action" | "translation"
 * - modifiedContent: Optional - user's corrected version
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

interface FeedbackRequest {
    messageId?: string;
    conversationLogId?: string;
    feedback: 'positive' | 'negative';
    feedbackType: 'response' | 'action' | 'translation';
    modifiedContent?: string;
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate the request
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json(
                { success: false, error: 'No autenticado' },
                { status: 401 }
            );
        }

        // Parse the request body
        const body = (await request.json()) as FeedbackRequest;
        const { messageId, conversationLogId, feedback, feedbackType, modifiedContent } = body;

        // Validate required fields
        if (!feedback || !['positive', 'negative'].includes(feedback)) {
            return NextResponse.json(
                { success: false, error: 'Feedback debe ser "positive" o "negative"' },
                { status: 400 }
            );
        }

        if (!feedbackType || !['response', 'action', 'translation'].includes(feedbackType)) {
            return NextResponse.json(
                { success: false, error: 'feedbackType debe ser "response", "action" o "translation"' },
                { status: 400 }
            );
        }

        // At least one ID must be provided
        if (!messageId && !conversationLogId) {
            return NextResponse.json(
                { success: false, error: 'Se requiere messageId o conversationLogId' },
                { status: 400 }
            );
        }

        // Update WaMessage feedback if messageId provided
        if (messageId) {
            const message = await prisma.waMessage.findUnique({
                where: { id: messageId },
                select: { organizationId: true },
            });

            if (!message) {
                return NextResponse.json(
                    { success: false, error: 'Mensaje no encontrado' },
                    { status: 404 }
                );
            }

            // Verify user belongs to the organization
            if (message.organizationId !== session.organizationId) {
                return NextResponse.json(
                    { success: false, error: 'No autorizado para este mensaje' },
                    { status: 403 }
                );
            }

            await prisma.waMessage.update({
                where: { id: messageId },
                data: {
                    aiFeedback: feedback,
                    aiFeedbackAt: new Date(),
                    aiFeedbackUserId: session.userId,
                },
            });
        }

        // Update AIConversationLog feedback if conversationLogId provided
        if (conversationLogId) {
            const log = await prisma.aIConversationLog.findUnique({
                where: { id: conversationLogId },
                select: { organizationId: true },
            });

            if (!log) {
                return NextResponse.json(
                    { success: false, error: 'Log de conversación no encontrado' },
                    { status: 404 }
                );
            }

            // Verify user belongs to the organization
            if (log.organizationId !== session.organizationId) {
                return NextResponse.json(
                    { success: false, error: 'No autorizado para este log' },
                    { status: 403 }
                );
            }

            await prisma.aIConversationLog.update({
                where: { id: conversationLogId },
                data: {
                    wasHelpful: feedback === 'positive',
                    feedbackType,
                    userModified: !!modifiedContent,
                    modifiedContent: modifiedContent || null,
                    reviewedAt: new Date(),
                    reviewedById: session.userId,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Feedback registrado correctamente',
        });
    } catch (error) {
        console.error('Error saving AI feedback:', error);
        return NextResponse.json(
            { success: false, error: 'Error al guardar feedback' },
            { status: 500 }
        );
    }
}
