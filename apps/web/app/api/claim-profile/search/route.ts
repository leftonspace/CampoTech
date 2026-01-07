/**
 * Claim Profile Search API
 * ========================
 * 
 * Phase 4.4: Growth Engine
 * GET /api/claim-profile/search?q=<query>&source=<source>
 * 
 * Allows professionals to search for their unclaimed profile by matricula or name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUnclaimedProfileService } from '@/lib/services/unclaimed-profile.service';

type UnclaimedSource = 'ERSEP' | 'CACAAV' | 'GASNOR' | 'GASNEA' | 'ENARGAS' | 'MANUAL';

export async function GET(request: NextRequest) {

    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');
        const source = searchParams.get('source') as UnclaimedSource | null;

        if (!query || query.length < 2) {
            return NextResponse.json(
                { error: 'La búsqueda debe tener al menos 2 caracteres' },
                { status: 400 }
            );
        }

        const service = getUnclaimedProfileService();
        const profiles = await service.searchProfiles(query, source || undefined);

        return NextResponse.json({
            success: true,
            profiles,
            count: profiles.length,
        });
    } catch (error) {
        console.error('[ClaimProfile/Search] Error:', error);
        return NextResponse.json(
            { error: 'Error al buscar perfiles' },
            { status: 500 }
        );
    }
}
