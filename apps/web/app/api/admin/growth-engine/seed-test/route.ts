/**
 * Seed Test Profiles API
 * =======================
 * 
 * Phase 4.4: Growth Engine
 * POST /api/admin/growth-engine/seed-test
 * 
 * Seeds the database with fake test profiles for UI testing.
 * Only available in development mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Sample test data
const TEST_PROFILES = [
    // ERSEP - Electricistas Córdoba
    { source: 'ERSEP', fullName: 'Juan Carlos Rodríguez', matricula: 'ERSEP-12345', phone: '+54 351 456 7890', email: 'jcrodriguez@gmail.com', profession: 'Electricista Cat. I', province: 'Córdoba', city: 'Capital' },
    { source: 'ERSEP', fullName: 'María Elena Fernández', matricula: 'ERSEP-12346', phone: '+54 351 789 0123', email: 'mefernandez@hotmail.com', profession: 'Electricista Cat. II', province: 'Córdoba', city: 'Villa María' },
    { source: 'ERSEP', fullName: 'Pedro Martínez López', matricula: 'ERSEP-12347', phone: '+54 351 234 5678', email: null, profession: 'Electricista Cat. III', province: 'Córdoba', city: 'Río Cuarto' },
    { source: 'ERSEP', fullName: 'Roberto García Sánchez', matricula: 'ERSEP-12348', phone: null, email: 'rgarcia@outlook.com', profession: 'Electricista Cat. I', province: 'Córdoba', city: 'Carlos Paz' },
    { source: 'ERSEP', fullName: 'Ana Lucía Romero', matricula: 'ERSEP-12349', phone: '+54 351 567 8901', email: 'aromero.elec@gmail.com', profession: 'Electricista Cat. II', province: 'Córdoba', city: 'Alta Gracia' },

    // CACAAV - HVAC Nacional
    { source: 'CACAAV', fullName: 'Carlos Alberto Pérez', matricula: 'CACAAV-78901', phone: '+54 11 4567 8901', email: 'caperez.hvac@gmail.com', profession: 'HVAC/Refrigeración', province: 'CABA', city: 'Buenos Aires' },
    { source: 'CACAAV', fullName: 'Martín Eduardo Silva', matricula: 'CACAAV-78902', phone: '+54 341 234 5678', email: null, profession: 'HVAC/Refrigeración', province: 'Santa Fe', city: 'Rosario' },
    { source: 'CACAAV', fullName: 'Diego Fernando Gómez', matricula: 'CACAAV-78903', phone: '+54 261 456 7890', email: 'dfgomez@yahoo.com.ar', profession: 'HVAC/Refrigeración', province: 'Mendoza', city: 'Capital' },
    { source: 'CACAAV', fullName: 'Patricia Beatriz Luna', matricula: 'CACAAV-78904', phone: '+54 221 789 0123', email: 'pbluna.refri@gmail.com', profession: 'HVAC/Refrigeración', province: 'Buenos Aires', city: 'La Plata' },
    { source: 'CACAAV', fullName: 'Fernando José Torres', matricula: 'CACAAV-78905', phone: null, email: 'fjtorres@hotmail.com', profession: 'HVAC/Refrigeración', province: 'Buenos Aires', city: 'Mar del Plata' },

    // GASNOR - Gasistas Norte
    { source: 'GASNOR', fullName: 'Ricardo Alejandro Ruiz', matricula: 'GASNOR-45678', phone: '+54 387 123 4567', email: 'raruiz.gas@gmail.com', profession: 'Gasista Cat. I', province: 'Salta', city: 'Capital' },
    { source: 'GASNOR', fullName: 'Gabriela Inés Molina', matricula: 'GASNOR-45679', phone: '+54 388 234 5678', email: null, profession: 'Gasista Cat. II', province: 'Jujuy', city: 'San Salvador de Jujuy' },
    { source: 'GASNOR', fullName: 'Alejandro Miguel Paz', matricula: 'GASNOR-45680', phone: '+54 381 345 6789', email: 'ampaz.gasista@yahoo.com', profession: 'Gasista Cat. I', province: 'Tucumán', city: 'San Miguel de Tucumán' },

    // GASNEA - Gasistas NEA
    { source: 'GASNEA', fullName: 'Laura Cristina Benítez', matricula: 'GASNEA-23456', phone: '+54 379 456 7890', email: 'lcbenitez@gmail.com', profession: 'Gasista', province: 'Corrientes', city: 'Capital' },
    { source: 'GASNEA', fullName: 'Hugo Daniel Acosta', matricula: 'GASNEA-23457', phone: '+54 362 567 8901', email: null, profession: 'Gasista', province: 'Chaco', city: 'Resistencia' },
    { source: 'GASNEA', fullName: 'Silvia Marcela Vega', matricula: 'GASNEA-23458', phone: '+54 370 678 9012', email: 'smvega.gas@hotmail.com', profession: 'Gasista', province: 'Formosa', city: 'Capital' },

    // MANUAL - Manual Import
    { source: 'MANUAL', fullName: 'Test Profile Reclamado', matricula: 'MANUAL-99999', phone: '+54 11 9999 9999', email: 'test.claimed@example.com', profession: 'Electricista', province: 'CABA', city: 'Buenos Aires' },
];

export async function POST(request: NextRequest) {
    try {
        // Check if in development
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json(
                { error: 'Solo disponible en desarrollo' },
                { status: 403 }
            );
        }

        // Auth check - SUPER_ADMIN only (platform admin, not org owner)
        const session = await getSession();
        if (!session || session.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Acceso no autorizado - Solo administradores de plataforma' },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const count = Math.min(body.count || TEST_PROFILES.length, 100);
        const clearExisting = body.clearExisting === true;

        // Optionally clear existing test data
        if (clearExisting) {
            await prisma.unclaimedProfile.deleteMany({
                where: {
                    matricula: {
                        startsWith: 'TEST-',
                    },
                },
            });
        }

        // Create test profiles
        let created = 0;
        for (let i = 0; i < count; i++) {
            const template = TEST_PROFILES[i % TEST_PROFILES.length];
            const uniqueId = `${i}-${Date.now()}`;

            try {
                await prisma.unclaimedProfile.create({
                    data: {
                        source: template.source as never,
                        sourceUrl: `https://test.campotech.ar/seed/${template.source.toLowerCase()}`,
                        fullName: template.fullName + (i >= TEST_PROFILES.length ? ` #${Math.floor(i / TEST_PROFILES.length) + 1}` : ''),
                        matricula: template.matricula.replace(/\d+$/, uniqueId),
                        phone: template.phone,
                        email: template.email?.replace('@', `+${uniqueId}@`),
                        profession: template.profession,
                        province: template.province,
                        city: template.city,
                        scrapedAt: new Date(),
                        // Mark last one as claimed for testing
                        claimedAt: i === count - 1 ? new Date() : null,
                        claimedByUserId: i === count - 1 ? session.userId : null,
                    },
                });
                created++;
            } catch (error) {
                console.error(`[SeedTest] Error creating profile ${i}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            created,
            message: `Se crearon ${created} perfiles de prueba`,
        });
    } catch (error) {
        console.error('[SeedTest] Error:', error);
        return NextResponse.json(
            { error: 'Error al crear perfiles de prueba' },
            { status: 500 }
        );
    }
}

// Delete test profiles
export async function DELETE() {
    try {
        // Check if in development
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json(
                { error: 'Solo disponible en desarrollo' },
                { status: 403 }
            );
        }

        const session = await getSession();
        if (!session || session.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Acceso no autorizado - Solo administradores de plataforma' },
                { status: 403 }
            );
        }

        // Delete all unclaimed profiles (for testing cleanup)
        const result = await prisma.unclaimedProfile.deleteMany({});

        return NextResponse.json({
            success: true,
            deleted: result.count,
            message: `Se eliminaron ${result.count} perfiles`,
        });
    } catch (error) {
        console.error('[SeedTest] Error:', error);
        return NextResponse.json(
            { error: 'Error al eliminar perfiles' },
            { status: 500 }
        );
    }
}

