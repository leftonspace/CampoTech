/**
 * Organization Language Settings API
 * ===================================
 * 
 * Phase 5.2: Translation Core
 * 
 * Manages organization-level language preferences:
 * - translationEnabled: Whether AI translation is enabled
 * - languagesSpoken: Languages the business team can handle
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const languageSettingsSchema = z.object({
    translationEnabled: z.boolean().optional(),
    languagesSpoken: z.array(z.string()).optional(),
});

// GET: Retrieve current language settings
export async function GET() {
    try {
        const session = await getSession();

        if (!session?.organizationId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const organization = await prisma.organization.findUnique({
            where: { id: session.organizationId },
            select: {
                translationEnabled: true,
                languagesSpoken: true,
            },
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: 'Organization not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                translationEnabled: organization.translationEnabled ?? false,
                languagesSpoken: organization.languagesSpoken ?? ['es'],
            },
        });
    } catch (error) {
        console.error('Error fetching language settings:', error);
        return NextResponse.json(
            { success: false, error: 'Error fetching language settings' },
            { status: 500 }
        );
    }
}

// PUT: Update language settings
export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session?.organizationId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only OWNER can change language settings
        if (session.role?.toUpperCase() !== 'OWNER') {
            return NextResponse.json(
                { success: false, error: 'Solo el dueño puede cambiar configuración de idiomas' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const validationResult = languageSettingsSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { success: false, error: 'Invalid request body', details: validationResult.error.errors },
                { status: 400 }
            );
        }

        const { translationEnabled, languagesSpoken } = validationResult.data;

        // Build update object
        const updateData: Record<string, unknown> = {};
        if (translationEnabled !== undefined) {
            updateData.translationEnabled = translationEnabled;
        }
        if (languagesSpoken !== undefined) {
            // Ensure 'es' (Spanish) is always included
            const languages = new Set(languagesSpoken);
            languages.add('es');
            updateData.languagesSpoken = Array.from(languages);
        }

        const organization = await prisma.organization.update({
            where: { id: session.organizationId },
            data: updateData,
            select: {
                translationEnabled: true,
                languagesSpoken: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                translationEnabled: organization.translationEnabled,
                languagesSpoken: organization.languagesSpoken,
            },
        });
    } catch (error) {
        console.error('Error updating language settings:', error);
        return NextResponse.json(
            { success: false, error: 'Error updating language settings' },
            { status: 500 }
        );
    }
}
