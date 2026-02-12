/**
 * Employee Verification API
 * ==========================
 * 
 * Phase 4.3 Task 4.3.5: ART Certificate Upload Flow
 * 
 * PUT /api/verification/employee - Update ART certificate and background check
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDigitalBadgeService } from '@/lib/services/digital-badge.service';
import { prisma } from '@/lib/prisma';

interface UpdateVerificationBody {
    userId: string;
    // ART Certificate
    artCertificateUrl?: string;
    artExpiryDate?: string; // ISO date string
    artProvider?: string;
    artPolicyNumber?: string;
    // Background Check
    backgroundCheckStatus?: 'pending' | 'approved' | 'rejected' | 'expired';
    backgroundCheckProvider?: string;
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Only owners can update employee verification documents
        if (session.role.toUpperCase() !== 'OWNER') {
            return NextResponse.json(
                { success: false, error: 'Solo el propietario puede actualizar documentos de verificación' },
                { status: 403 }
            );
        }

        const body: UpdateVerificationBody = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId es requerido' },
                { status: 400 }
            );
        }

        // Verify user belongs to the organization
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { organizationId: true, name: true },
        });

        if (!user || user.organizationId !== session.organizationId) {
            return NextResponse.json(
                { success: false, error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        const badgeService = getDigitalBadgeService();
        const updates: string[] = [];

        // Update ART Certificate if provided
        if (body.artCertificateUrl || body.artExpiryDate || body.artProvider || body.artPolicyNumber) {
            // Validate expiry date if provided
            if (body.artExpiryDate) {
                const expiryDate = new Date(body.artExpiryDate);
                if (isNaN(expiryDate.getTime())) {
                    return NextResponse.json(
                        { success: false, error: 'Fecha de vencimiento de ART inválida' },
                        { status: 400 }
                    );
                }

                // Update ART fields
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        artCertificateUrl: body.artCertificateUrl,
                        artExpiryDate: expiryDate,
                        artProvider: body.artProvider,
                        artPolicyNumber: body.artPolicyNumber,
                    },
                });
                updates.push('Certificado ART');
            } else {
                // Update only non-date ART fields
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        artCertificateUrl: body.artCertificateUrl,
                        artProvider: body.artProvider,
                        artPolicyNumber: body.artPolicyNumber,
                    },
                });
                updates.push('Datos de ART');
            }
        }

        // Update Background Check if provided
        if (body.backgroundCheckStatus) {
            await badgeService.updateBackgroundCheck(userId, {
                status: body.backgroundCheckStatus,
                provider: body.backgroundCheckProvider,
            });
            updates.push('Verificación de antecedentes');
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No se proporcionaron datos para actualizar' },
                { status: 400 }
            );
        }

        // Get updated user data
        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                artCertificateUrl: true,
                artExpiryDate: true,
                artProvider: true,
                artPolicyNumber: true,
                backgroundCheckStatus: true,
                backgroundCheckDate: true,
                backgroundCheckProvider: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: updatedUser,
            message: `Actualizado: ${updates.join(', ')}`,
        });
    } catch (error) {
        console.error('[Employee Verification API] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error actualizando documentos de verificación' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'userId es requerido' },
                { status: 400 }
            );
        }

        // Users can view their own data, or owners/Admins can view team data
        const isOwnData = session.userId === userId;
        const canViewTeamData = ['OWNER', 'ADMIN'].includes(session.role.toUpperCase());

        if (!isOwnData && !canViewTeamData) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para ver estos datos' },
                { status: 403 }
            );
        }

        // Verify user belongs to same organization
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                organizationId: true,
                name: true,
                artCertificateUrl: true,
                artExpiryDate: true,
                artProvider: true,
                artPolicyNumber: true,
                backgroundCheckStatus: true,
                backgroundCheckDate: true,
                backgroundCheckProvider: true,
            },
        });

        if (!user || (!isOwnData && user.organizationId !== session.organizationId)) {
            return NextResponse.json(
                { success: false, error: 'Usuario no encontrado' },
                { status: 404 }
            );
        }

        // Calculate ART status
        const _badgeService = getDigitalBadgeService();
        let artStatus: 'valid' | 'expiring' | 'expired' | 'missing' = 'missing';
        let daysUntilExpiry: number | null = null;

        if (user.artExpiryDate) {
            const now = new Date();
            const expiry = new Date(user.artExpiryDate);
            const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            daysUntilExpiry = diffDays;

            if (diffDays < 0) {
                artStatus = 'expired';
            } else if (diffDays < 30) {
                artStatus = 'expiring';
            } else {
                artStatus = 'valid';
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...user,
                artStatus,
                daysUntilExpiry,
            },
        });
    } catch (error) {
        console.error('[Employee Verification API] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo datos de verificación' },
            { status: 500 }
        );
    }
}
