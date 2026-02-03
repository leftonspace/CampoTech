/**
 * Job Confirmation Code API
 * =========================
 * 
 * Phase 4.4: Customer Verification System
 * 
 * POST /api/jobs/[id]/confirmation-code - Generate and send code
 * PUT /api/jobs/[id]/confirmation-code - Verify code
 * GET /api/jobs/[id]/confirmation-code - Get code status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getConfirmationCodeService } from '@/lib/services/confirmation-code.service';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST - Generate and send confirmation code to customer
 * Called when technician starts navigation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        const { id } = await params;

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const service = getConfirmationCodeService();
        const result = await service.generateAndSendCode(id);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                codeSent: true,
                sentAt: result.sentAt
            }
        });
    } catch (error) {
        console.error('Error generating confirmation code:', error);
        return NextResponse.json(
            { success: false, error: 'Error generating confirmation code' },
            { status: 500 }
        );
    }
}

/**
 * PUT - Verify the confirmation code entered by technician
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        const { id } = await params;

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { code } = body;

        if (!code || typeof code !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Code is required' },
                { status: 400 }
            );
        }

        const service = getConfirmationCodeService();
        const result = await service.verifyCode(id, code);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    verified: false,
                    error: result.error,
                    attemptsRemaining: result.attemptsRemaining
                },
                { status: result.error === 'Incorrect code' ? 400 : 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                verified: result.verified
            }
        });
    } catch (error) {
        console.error('Error verifying confirmation code:', error);
        return NextResponse.json(
            { success: false, error: 'Error verifying confirmation code' },
            { status: 500 }
        );
    }
}

/**
 * GET - Get the confirmation code status for a job
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getSession();
        const { id } = await params;

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const service = getConfirmationCodeService();
        const status = await service.checkCodeStatus(id);

        return NextResponse.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting confirmation code status:', error);
        return NextResponse.json(
            { success: false, error: 'Error getting confirmation code status' },
            { status: 500 }
        );
    }
}
