/**
 * Admin Discount Detail API
 * =========================
 *
 * GET /api/admin/discounts/[id] - Get discount details
 * PUT /api/admin/discounts/[id] - Update discount
 * DELETE /api/admin/discounts/[id] - Delete discount
 * POST /api/admin/discounts/[id] - Actions (activate, deactivate, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'coupon';

    if (type === 'coupon') {
      const coupon = await prisma.couponCode.findUnique({
        where: { id },
        include: {
          usages: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { appliedAt: 'desc' },
            take: 50,
          },
        },
      });

      if (!coupon) {
        return NextResponse.json(
          { success: false, error: 'Coupon not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...coupon,
          percentageOff: coupon.percentageOff ? Number(coupon.percentageOff) : null,
          fixedAmountOff: coupon.fixedAmountOff ? Number(coupon.fixedAmountOff) : null,
          combinedPercentageOff: coupon.combinedPercentageOff ? Number(coupon.combinedPercentageOff) : null,
          usages: coupon.usages.map((u) => ({
            id: u.id,
            organizationId: u.organizationId,
            organizationName: u.organization.name,
            originalPrice: Number(u.originalPrice),
            discountedPrice: Number(u.discountedPrice),
            amountSaved: Number(u.amountSaved),
            appliedAt: u.appliedAt.toISOString(),
          })),
        },
      });
    } else if (type === 'global') {
      const globalDiscount = await prisma.globalDiscount.findUnique({
        where: { id },
      });

      if (!globalDiscount) {
        return NextResponse.json(
          { success: false, error: 'Global discount not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...globalDiscount,
          percentageOff: globalDiscount.percentageOff ? Number(globalDiscount.percentageOff) : null,
          fixedAmountOff: globalDiscount.fixedAmountOff ? Number(globalDiscount.fixedAmountOff) : null,
          combinedPercentageOff: globalDiscount.combinedPercentageOff ? Number(globalDiscount.combinedPercentageOff) : null,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get discount error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching discount' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session, 'manage_discounts')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'coupon') {
      // Check if code is being changed and if it's unique
      if (data.code) {
        const existing = await prisma.couponCode.findFirst({
          where: {
            code: data.code.toUpperCase(),
            id: { not: id },
          },
        });

        if (existing) {
          return NextResponse.json(
            { success: false, error: 'Coupon code already exists' },
            { status: 400 }
          );
        }
      }

      const coupon = await prisma.couponCode.update({
        where: { id },
        data: {
          ...(data.code && { code: data.code.toUpperCase() }),
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.discountType && { discountType: data.discountType }),
          ...(data.percentageOff !== undefined && { percentageOff: data.percentageOff }),
          ...(data.freeMonths !== undefined && { freeMonths: data.freeMonths }),
          ...(data.fixedAmountOff !== undefined && { fixedAmountOff: data.fixedAmountOff }),
          ...(data.combinedFreeMonths !== undefined && { combinedFreeMonths: data.combinedFreeMonths }),
          ...(data.combinedPercentageOff !== undefined && { combinedPercentageOff: data.combinedPercentageOff }),
          ...(data.combinedPercentageMonths !== undefined && { combinedPercentageMonths: data.combinedPercentageMonths }),
          ...(data.applicableTiers !== undefined && { applicableTiers: data.applicableTiers }),
          ...(data.applicableCycles !== undefined && { applicableCycles: data.applicableCycles }),
          ...(data.maxTotalUses !== undefined && { maxTotalUses: data.maxTotalUses }),
          ...(data.maxUsesPerOrg !== undefined && { maxUsesPerOrg: data.maxUsesPerOrg }),
          ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
          ...(data.validUntil && { validUntil: new Date(data.validUntil) }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      return NextResponse.json({
        success: true,
        data: coupon,
        message: 'Coupon updated successfully',
      });
    } else if (type === 'global') {
      // If activating, deactivate others
      if (data.isActive === true) {
        await prisma.globalDiscount.updateMany({
          where: {
            isActive: true,
            id: { not: id },
          },
          data: { isActive: false },
        });
      }

      const globalDiscount = await prisma.globalDiscount.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.discountType && { discountType: data.discountType }),
          ...(data.percentageOff !== undefined && { percentageOff: data.percentageOff }),
          ...(data.freeMonths !== undefined && { freeMonths: data.freeMonths }),
          ...(data.fixedAmountOff !== undefined && { fixedAmountOff: data.fixedAmountOff }),
          ...(data.combinedFreeMonths !== undefined && { combinedFreeMonths: data.combinedFreeMonths }),
          ...(data.combinedPercentageOff !== undefined && { combinedPercentageOff: data.combinedPercentageOff }),
          ...(data.combinedPercentageMonths !== undefined && { combinedPercentageMonths: data.combinedPercentageMonths }),
          ...(data.applicableTiers !== undefined && { applicableTiers: data.applicableTiers }),
          ...(data.applicableCycles !== undefined && { applicableCycles: data.applicableCycles }),
          ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
          ...(data.validUntil && { validUntil: new Date(data.validUntil) }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.bannerText !== undefined && { bannerText: data.bannerText }),
          ...(data.badgeText !== undefined && { badgeText: data.badgeText }),
        },
      });

      return NextResponse.json({
        success: true,
        data: globalDiscount,
        message: 'Global discount updated successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update discount error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating discount' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session, 'manage_discounts')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'coupon';

    if (type === 'coupon') {
      // Check if coupon has been used
      const usageCount = await prisma.couponUsage.count({
        where: { couponId: id },
      });

      if (usageCount > 0) {
        // Soft delete by deactivating instead
        await prisma.couponCode.update({
          where: { id },
          data: { isActive: false },
        });

        return NextResponse.json({
          success: true,
          message: 'Coupon deactivated (has usage history)',
          softDeleted: true,
        });
      }

      await prisma.couponCode.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: 'Coupon deleted successfully',
      });
    } else if (type === 'global') {
      await prisma.globalDiscount.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: 'Global discount deleted successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Delete discount error:', error);
    return NextResponse.json(
      { success: false, error: 'Error deleting discount' },
      { status: 500 }
    );
  }
}

// Actions (activate, deactivate, reset usage, etc.)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session, 'manage_discounts')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, type } = body;

    if (type === 'coupon') {
      switch (action) {
        case 'activate':
          await prisma.couponCode.update({
            where: { id },
            data: { isActive: true },
          });
          return NextResponse.json({
            success: true,
            message: 'Coupon activated',
          });

        case 'deactivate':
          await prisma.couponCode.update({
            where: { id },
            data: { isActive: false },
          });
          return NextResponse.json({
            success: true,
            message: 'Coupon deactivated',
          });

        case 'reset_usage':
          await prisma.couponCode.update({
            where: { id },
            data: { currentUses: 0 },
          });
          return NextResponse.json({
            success: true,
            message: 'Coupon usage count reset',
          });

        case 'duplicate':
          const original = await prisma.couponCode.findUnique({
            where: { id },
          });

          if (!original) {
            return NextResponse.json(
              { success: false, error: 'Coupon not found' },
              { status: 404 }
            );
          }

          const newCode = `${original.code}_COPY_${Date.now().toString(36).toUpperCase()}`;
          const duplicated = await prisma.couponCode.create({
            data: {
              code: newCode,
              name: `${original.name} (Copy)`,
              description: original.description,
              discountType: original.discountType,
              percentageOff: original.percentageOff,
              freeMonths: original.freeMonths,
              fixedAmountOff: original.fixedAmountOff,
              combinedFreeMonths: original.combinedFreeMonths,
              combinedPercentageOff: original.combinedPercentageOff,
              combinedPercentageMonths: original.combinedPercentageMonths,
              applicableTiers: original.applicableTiers,
              applicableCycles: original.applicableCycles,
              maxTotalUses: original.maxTotalUses,
              maxUsesPerOrg: original.maxUsesPerOrg,
              validFrom: original.validFrom,
              validUntil: original.validUntil,
              isActive: false,
              createdBy: session.id,
            },
          });

          return NextResponse.json({
            success: true,
            data: duplicated,
            message: 'Coupon duplicated',
          });

        default:
          return NextResponse.json(
            { success: false, error: 'Invalid action' },
            { status: 400 }
          );
      }
    } else if (type === 'global') {
      switch (action) {
        case 'activate':
          // Deactivate all others first
          await prisma.globalDiscount.updateMany({
            where: { isActive: true },
            data: { isActive: false },
          });

          await prisma.globalDiscount.update({
            where: { id },
            data: { isActive: true },
          });

          return NextResponse.json({
            success: true,
            message: 'Global discount activated (others deactivated)',
          });

        case 'deactivate':
          await prisma.globalDiscount.update({
            where: { id },
            data: { isActive: false },
          });
          return NextResponse.json({
            success: true,
            message: 'Global discount deactivated',
          });

        default:
          return NextResponse.json(
            { success: false, error: 'Invalid action' },
            { status: 400 }
          );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Discount action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error performing action' },
      { status: 500 }
    );
  }
}
