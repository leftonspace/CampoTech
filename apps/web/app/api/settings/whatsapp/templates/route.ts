/**
 * WhatsApp Templates API
 * ======================
 * GET /api/settings/whatsapp/templates - Get organization's custom templates
 * PUT /api/settings/whatsapp/templates - Save organization's custom templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Fetch organization's WhatsApp templates
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch organization's message template settings
        const org = await prisma.organization.findUnique({
            where: { id: session.organizationId },
            select: {
                whatsappTemplates: true,
            },
        });

        // Parse JSON if stored as string, or return as-is if already parsed
        let templates = [];
        if (org?.whatsappTemplates) {
            try {
                templates = typeof org.whatsappTemplates === 'string'
                    ? JSON.parse(org.whatsappTemplates)
                    : org.whatsappTemplates;
            } catch {
                templates = [];
            }
        }

        return NextResponse.json({
            success: true,
            data: templates,
        });
    } catch (error) {
        console.error('Get WhatsApp templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Error fetching templates' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT - Save organization's WhatsApp templates
// ═══════════════════════════════════════════════════════════════════════════════

interface TemplateInput {
    id: string;
    template: string;
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Only OWNER can update templates
        const role = session.role?.toUpperCase();
        if (role !== 'OWNER') {
            return NextResponse.json(
                { success: false, error: 'Solo el propietario puede editar templates' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { templates } = body as { templates: TemplateInput[] };

        if (!templates || !Array.isArray(templates)) {
            return NextResponse.json(
                { success: false, error: 'Templates array required' },
                { status: 400 }
            );
        }

        // Validate template structure
        const validTemplates = templates.filter(
            (t) => t.id && typeof t.id === 'string' && typeof t.template === 'string'
        );

        // Save to organization
        await prisma.organization.update({
            where: { id: session.organizationId },
            data: {
                whatsappTemplates: JSON.stringify(validTemplates),
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Templates guardados',
            data: validTemplates,
        });
    } catch (error) {
        console.error('Save WhatsApp templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Error saving templates' },
            { status: 500 }
        );
    }
}
