/**
 * Rating Token API Route
 * GET /api/ratings/[token]
 *
 * Public endpoint - no auth required
 * Fetches rating data for a specific token
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: { token: string };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 400 }
      );
    }

    // Find review by token
    const review = await prisma.review.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            name: true,
            logo: true,
            phone: true,
          },
        },
        job: {
          select: {
            jobNumber: true,
            description: true,
            serviceType: true,
            completedAt: true,
            technician: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: 'Link de calificación no válido o expirado' },
        { status: 404 }
      );
    }

    // Check if token has expired (if expiration is set)
    if (review.tokenExpiresAt && new Date() > review.tokenExpiresAt) {
      return NextResponse.json(
        { success: false, error: 'Este link de calificación ha expirado' },
        { status: 410 }
      );
    }

    // Format service type for display
    const serviceTypeMap: Record<string, string> = {
      INSTALACION: 'Instalación',
      REPARACION: 'Reparación',
      MANTENIMIENTO: 'Mantenimiento',
      DIAGNOSTICO: 'Diagnóstico',
      PRESUPUESTO: 'Presupuesto',
      EMERGENCIA: 'Emergencia',
      REVISION: 'Revisión',
      INSTALACION_SPLIT: 'Instalación Split',
      INSTALACION_TERMOTANQUE: 'Instalación Termotanque',
      DESOBSTRUCCION: 'Desobstrucción',
      OTRO: 'Otro servicio',
    };

    const serviceType = review.job?.serviceType
      ? serviceTypeMap[review.job.serviceType] || review.job.serviceType
      : 'Servicio';

    return NextResponse.json({
      success: true,
      data: {
        organizationName: review.organization.name,
        organizationLogo: review.organization.logo,
        organizationPhone: review.organization.phone,
        serviceType,
        jobDescription: review.job?.description || '',
        technicianName: review.job?.technician?.name,
        completedAt: review.job?.completedAt?.toISOString(),
        alreadyRated: review.rating !== null,
        existingRating: review.rating,
        existingComment: review.comment,
      },
    });
  } catch (error) {
    console.error('Rating fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al cargar datos de calificación' },
      { status: 500 }
    );
  }
}
