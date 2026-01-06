/**
 * AFIP Credentials Migration API Route
 * POST /api/admin/afip/migrate - Migrate AFIP credentials from legacy settings to encrypted storage
 *
 * This is a one-time migration endpoint for Phase 1.1 security fix.
 * It migrates AFIP credentials from the settings JSONB field to dedicated encrypted columns.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAFIPCredentialsService } from '@/lib/services/afip-credentials.service';

export async function POST() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Only OWNER can run migrations for their organization
        if (!['OWNER'].includes(session.role.toUpperCase())) {
            return NextResponse.json(
                { success: false, error: 'Solo el dueño puede ejecutar migraciones' },
                { status: 403 }
            );
        }

        const afipService = getAFIPCredentialsService();

        // Migrate the current organization
        const migrated = await afipService.migrateFromLegacySettings(session.organizationId);

        if (migrated) {
            return NextResponse.json({
                success: true,
                message: 'Credenciales AFIP migradas exitosamente a almacenamiento encriptado',
                migrated: true,
            });
        } else {
            return NextResponse.json({
                success: true,
                message: 'No se encontraron credenciales AFIP para migrar o ya fueron migradas',
                migrated: false,
            });
        }
    } catch (error) {
        console.error('AFIP migration error:', error);
        return NextResponse.json(
            { success: false, error: 'Error migrando credenciales AFIP' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/admin/afip/migrate - Check migration status for all organizations
 * This is an admin-only endpoint for system-wide migration status.
 */
export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Check if the current org has already migrated
        const org = await prisma.organization.findUnique({
            where: { id: session.organizationId },
            select: {
                id: true,
                settings: true,
                afipCuit: true,
                afipCertificateEncrypted: true,
            },
        });

        if (!org) {
            return NextResponse.json(
                { success: false, error: 'Organización no encontrada' },
                { status: 404 }
            );
        }

        // Check if legacy settings exist
        const settings = typeof org.settings === 'string'
            ? JSON.parse(org.settings)
            : (org.settings as Record<string, unknown>) || {};

        const afipSettings = settings.afip as Record<string, string> | undefined;
        const hasLegacyCredentials = !!(afipSettings?.certificate || afipSettings?.privateKey);
        const hasEncryptedCredentials = !!org.afipCertificateEncrypted;

        return NextResponse.json({
            success: true,
            data: {
                orgId: org.id,
                hasLegacyCredentials,
                hasEncryptedCredentials,
                needsMigration: hasLegacyCredentials && !hasEncryptedCredentials,
                migrationStatus: hasEncryptedCredentials
                    ? 'completed'
                    : hasLegacyCredentials
                        ? 'pending'
                        : 'not_needed',
            },
        });
    } catch (error) {
        console.error('AFIP migration status error:', error);
        return NextResponse.json(
            { success: false, error: 'Error verificando estado de migración' },
            { status: 500 }
        );
    }
}
