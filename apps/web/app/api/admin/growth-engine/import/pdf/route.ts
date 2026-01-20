/**
 * PDF Import API
 * ===============
 * 
 * Phase 4.4: Growth Engine
 * POST /api/admin/growth-engine/import/pdf
 * 
 * Imports gasista profiles from uploaded PDF files (Gasnor/GasNEA).
 * Accepts multipart form data with PDF file and source type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGasPDFParser } from '@/lib/scrapers/gas-pdf-parser';

export async function POST(request: NextRequest) {
    try {
        // Auth check - SUPER_ADMIN only (platform admin, not org owner)
        const session = await getSession();
        if (!session || session.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Acceso no autorizado - Solo administradores de plataforma' },
                { status: 403 }
            );
        }

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const source = formData.get('source') as string | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No se proporcionó archivo PDF' },
                { status: 400 }
            );
        }

        if (!['GASNOR', 'GASNEA'].includes(source || '')) {
            return NextResponse.json(
                { error: 'Fuente inválida. Debe ser GASNOR o GASNEA' },
                { status: 400 }
            );
        }

        // Check file type
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json(
                { error: 'El archivo debe ser un PDF' },
                { status: 400 }
            );
        }

        // Check file size (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: 'El archivo debe ser menor a 10MB' },
                { status: 400 }
            );
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        // Parse and import
        const parser = getGasPDFParser();
        const result = await parser.parseFromBase64(
            base64,
            source as 'GASNOR' | 'GASNEA',
            file.name
        );

        console.log(`[PDFImport] Imported from ${file.name}: ${result.imported} new, ${result.updated} updated, ${result.errors} errors`);

        return NextResponse.json({
            success: true,
            fileName: file.name,
            source,
            ...result,
            message: `Se importaron ${result.imported} perfiles nuevos, ${result.updated} actualizados, ${result.errors} errores.`,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error('[PDFImport] Error:', errorMessage);
        console.error('[PDFImport] Stack:', errorStack);
        return NextResponse.json(
            { error: `Error al procesar el archivo PDF: ${errorMessage}` },
            { status: 500 }
        );
    }
}

