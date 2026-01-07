/**
 * Dev Seed Admin API
 * ===================
 * 
 * Creates a test admin account for development.
 * Only works in development mode.
 * 
 * POST /api/dev/seed-admin
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST() {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'Not available in production' },
            { status: 403 }
        );
    }

    try {
        console.log('🌱 Seeding admin account...');

        // Create test organization
        const org = await prisma.organization.upsert({
            where: { id: 'test-org-001' },
            update: {},
            create: {
                id: 'test-org-001',
                name: 'CampoTech Admin',
                phone: '+5491112345678',
                email: 'admin@campotech.ar',
                settings: {
                    cuit: '30123456789',
                    timezone: 'America/Argentina/Buenos_Aires',
                },
                subscriptionTier: 'EMPRESA',
                subscriptionStatus: 'active',
            },
        });

        // Hash password
        const passwordHash = await bcrypt.hash('admin123', 10);

        // Create admin user
        const user = await prisma.user.upsert({
            where: { phone: '+5491112345678' },
            update: {
                role: 'OWNER',
                passwordHash,
            },
            create: {
                phone: '+5491112345678',
                email: 'admin@campotech.ar',
                name: 'Admin Test',
                passwordHash,
                role: 'OWNER',
                organizationId: org.id,
                isActive: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Admin account created',
            credentials: {
                phone: '+5491112345678',
                password: 'admin123',
            },
            organization: {
                id: org.id,
                name: org.name,
            },
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Error seeding admin:', error);
        return NextResponse.json(
            { error: 'Failed to create admin account', details: String(error) },
            { status: 500 }
        );
    }
}

// Get status
export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'Not available in production' },
            { status: 403 }
        );
    }

    try {
        const user = await prisma.user.findFirst({
            where: { phone: '+5491112345678' },
            select: { id: true, name: true, phone: true, role: true },
        });

        if (user) {
            return NextResponse.json({
                exists: true,
                credentials: {
                    phone: '+5491112345678',
                    password: 'admin123',
                },
                user,
            });
        }

        return NextResponse.json({
            exists: false,
            message: 'No admin account. POST to this endpoint to create one.',
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to check admin status' },
            { status: 500 }
        );
    }
}
