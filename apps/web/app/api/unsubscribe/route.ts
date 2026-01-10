/**
 * Phase 4.6: Unsubscribe API
 * ===========================
 * 
 * Handles unsubscribe requests from email links.
 * Required for email compliance (CAN-SPAM, GDPR).
 * 
 * GET - Handle unsubscribe link click
 * POST - API-based unsubscribe
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEmailOutreachService } from '@/lib/services/email-outreach.service';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Unsubscribe via link
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const profileId = searchParams.get('id');

        if (!profileId) {
            return new NextResponse(generateUnsubscribePage(false, 'ID de perfil no encontrado'), {
                status: 400,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }

        const emailService = getEmailOutreachService();
        await emailService.handleUnsubscribe(profileId);

        return new NextResponse(generateUnsubscribePage(true), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    } catch (error) {
        console.error('[Unsubscribe API] Error:', error);
        return new NextResponse(
            generateUnsubscribePage(false, 'Error al procesar la solicitud'),
            {
                status: 500,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Unsubscribe via API
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { profileId, email } = body;

        if (!profileId && !email) {
            return NextResponse.json(
                { error: 'profileId or email is required' },
                { status: 400 }
            );
        }

        const emailService = getEmailOutreachService();

        if (profileId) {
            await emailService.handleUnsubscribe(profileId);
        }

        return NextResponse.json({
            success: true,
            message: 'Successfully unsubscribed',
        });
    } catch (error) {
        console.error('[Unsubscribe API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function generateUnsubscribePage(success: boolean, errorMessage?: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com.ar';

    if (success) {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Baja Exitosa - CampoTech</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f6f9fc 0%, #e5e7eb 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 48px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .icon {
            font-size: 64px;
            margin-bottom: 24px;
        }
        h1 {
            color: #059669;
            font-size: 24px;
            margin: 0 0 16px;
        }
        p {
            color: #6b7280;
            font-size: 16px;
            line-height: 26px;
            margin: 0 0 24px;
        }
        a {
            color: #059669;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✅</div>
        <h1>Baja Exitosa</h1>
        <p>
            Ya no recibirás más emails de CampoTech.
            <br><br>
            Si fue un error, podés <a href="mailto:hola@campotech.com.ar">contactarnos</a> para reactivar tu suscripción.
        </p>
        <p>
            <a href="${baseUrl}">← Volver a CampoTech</a>
        </p>
    </div>
</body>
</html>`;
    }

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - CampoTech</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f6f9fc 0%, #e5e7eb 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 48px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .icon {
            font-size: 64px;
            margin-bottom: 24px;
        }
        h1 {
            color: #dc2626;
            font-size: 24px;
            margin: 0 0 16px;
        }
        p {
            color: #6b7280;
            font-size: 16px;
            line-height: 26px;
            margin: 0 0 24px;
        }
        a {
            color: #059669;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">❌</div>
        <h1>Error</h1>
        <p>
            ${errorMessage || 'No pudimos procesar tu solicitud.'}
            <br><br>
            Por favor, contactanos a <a href="mailto:hola@campotech.com.ar">hola@campotech.com.ar</a> para darte de baja manualmente.
        </p>
        <p>
            <a href="${baseUrl}">← Volver a CampoTech</a>
        </p>
    </div>
</body>
</html>`;
}
