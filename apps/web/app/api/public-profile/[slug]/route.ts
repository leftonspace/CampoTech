/**
 * Public Business Profile API
 *
 * Returns public profile information for a business by slug (organization ID or custom slug).
 * This is a public endpoint - no authentication required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Try to find by organization ID first, then by custom slug if implemented
    const profile = await prisma.businessPublicProfile.findFirst({
      where: {
        OR: [
          { organizationId: slug },
          // Future: Add slug field for custom URLs
        ],
        isActive: true,
      },
      select: {
        id: true,
        displayName: true,
        description: true,
        logo: true,
        coverPhoto: true,
        categories: true,
        services: true,
        serviceArea: true,
        address: true,
        whatsappNumber: true,
        phone: true,
        averageRating: true,
        totalReviews: true,
        totalJobs: true,
        responseRate: true,
        responseTime: true,
        cuitVerified: true,
        insuranceVerified: true,
        organization: {
          select: {
            id: true,
            name: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Perfil no encontrado' },
        { status: 404 }
      );
    }

    // Fetch recent reviews for this organization
    const reviews = await prisma.review.findMany({
      where: {
        organizationId: profile.organization.id,
        rating: { not: null },
        comment: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        recentReviews: reviews.map((r: { id: string; rating: number | null; comment: string | null; createdAt: Date; customer: { name: string } | null }) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          customerName: r.customer?.name || 'Cliente',
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Public profile fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al cargar el perfil' },
      { status: 500 }
    );
  }
}
