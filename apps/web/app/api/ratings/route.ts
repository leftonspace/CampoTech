/**
 * Ratings API Route
 * POST /api/ratings
 *
 * Public endpoint - no auth required
 * Submits a rating for a job using a secure token
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, rating, comment } = body;

    // Validate token
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 400 }
      );
    }

    // Validate rating (1-5)
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Calificación debe ser entre 1 y 5' },
        { status: 400 }
      );
    }

    // Validate comment (optional, max 500 chars)
    if (comment && typeof comment !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Comentario inválido' },
        { status: 400 }
      );
    }

    const trimmedComment = comment?.trim().slice(0, 500) || null;

    // Find review by token
    const review = await prisma.review.findUnique({
      where: { token },
      include: {
        job: {
          select: {
            id: true,
            technicianId: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: 'Link de calificación no válido' },
        { status: 404 }
      );
    }

    // Check if token has expired
    if (review.tokenExpiresAt && new Date() > review.tokenExpiresAt) {
      return NextResponse.json(
        { success: false, error: 'Este link de calificación ha expirado' },
        { status: 410 }
      );
    }

    // Check if already rated
    if (review.rating !== null) {
      return NextResponse.json(
        { success: false, error: 'Este servicio ya fue calificado' },
        { status: 409 }
      );
    }

    // Update review with rating
    await prisma.review.update({
      where: { id: review.id },
      data: {
        rating: Math.round(rating),
        comment: trimmedComment,
        submittedAt: new Date(),
        // Link to technician if job has one
        technicianId: review.job?.technicianId || undefined,
      },
    });

    // Update organization average rating (async, don't wait)
    updateOrganizationRating(review.organizationId).catch(console.error);

    return NextResponse.json({
      success: true,
      message: 'Calificación enviada exitosamente',
    });
  } catch (error) {
    console.error('Rating submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al enviar calificación' },
      { status: 500 }
    );
  }
}

/**
 * Update organization's average rating
 * This runs asynchronously after rating submission
 */
async function updateOrganizationRating(organizationId: string) {
  try {
    // Calculate average rating
    const result = await prisma.review.aggregate({
      where: {
        organizationId,
        rating: { not: null },
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const avgRating = result._avg.rating;
    const totalReviews = result._count.rating;

    // Update organization with new average
    // Note: You may need to add these fields to the Organization model
    // For now, we'll just log the update
    console.log(
      `[Rating] Organization ${organizationId}: avg=${avgRating?.toFixed(2)}, count=${totalReviews}`
    );

    // TODO: If Organization model has rating fields, update them:
    // await prisma.organization.update({
    //   where: { id: organizationId },
    //   data: {
    //     averageRating: avgRating,
    //     totalReviews,
    //   },
    // });
  } catch (error) {
    console.error('Error updating organization rating:', error);
  }
}
