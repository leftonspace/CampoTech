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
        // Verification badges
        cuitVerified: true,
        insuranceVerified: true,
        backgroundCheck: true,
        professionalLicense: true,
        optionalBadges: true,
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

    // Fetch recent reviews for this organization (only submitted reviews with ratings)
    const reviews = await prisma.review.findMany({
      where: {
        organizationId: profile.organization.id,
        rating: { not: null },
        submittedAt: { not: null }, // Only show submitted reviews
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        rating: true,
        comment: true,
        submittedAt: true,
        customer: {
          select: {
            name: true,
          },
        },
        job: {
          select: {
            serviceType: true,
          },
        },
      },
    });

    // Build verification object for consumer-mobile compatibility
    const verification = {
      cuitVerified: profile.cuitVerified,
      insuranceVerified: profile.insuranceVerified,
      backgroundCheck: profile.backgroundCheck,
      professionalLicense: profile.professionalLicense,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        // Add verification object for consumer-mobile
        verification,
        // Parse optionalBadges if it's a string
        optionalBadges: typeof profile.optionalBadges === 'string'
          ? JSON.parse(profile.optionalBadges)
          : profile.optionalBadges,
        recentReviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          customerName: r.customer?.name || 'Cliente',
          serviceType: r.job?.serviceType || null,
          submittedAt: r.submittedAt,
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
