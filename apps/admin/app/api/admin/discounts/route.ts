/**
 * Admin Discounts API
 * ===================
 *
 * GET /api/admin/discounts - List all discounts (coupons + global)
 * POST /api/admin/discounts - Create new discount
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all'; // 'coupon', 'global', 'all'
    const status = searchParams.get('status') || 'all'; // 'active', 'inactive', 'expired', 'all'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const results: any = {
      coupons: null,
      globalDiscounts: null,
      pricingSettings: null,
    };

    // Get pricing settings
    results.pricingSettings = await prisma.pricingSettings.findFirst();
    if (!results.pricingSettings) {
      // Create default pricing settings if none exist
      results.pricingSettings = await prisma.pricingSettings.create({
        data: {
          defaultAnnualDiscount: 17,
          showDiscountsPublicly: true,
        },
      });
    }

    // Build coupon where clause
    if (type === 'coupon' || type === 'all') {
      const couponWhere: Prisma.CouponCodeWhereInput = {};

      if (status === 'active') {
        couponWhere.isActive = true;
        couponWhere.validUntil = { gte: new Date() };
      } else if (status === 'inactive') {
        couponWhere.isActive = false;
      } else if (status === 'expired') {
        couponWhere.validUntil = { lt: new Date() };
      }

      if (search) {
        couponWhere.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [coupons, couponTotal] = await Promise.all([
        prisma.couponCode.findMany({
          where: couponWhere,
          include: {
            _count: {
              select: { usages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.couponCode.count({ where: couponWhere }),
      ]);

      results.coupons = {
        items: coupons.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          description: c.description,
          discountType: c.discountType,
          percentageOff: c.percentageOff ? Number(c.percentageOff) : null,
          freeMonths: c.freeMonths,
          fixedAmountOff: c.fixedAmountOff ? Number(c.fixedAmountOff) : null,
          combinedFreeMonths: c.combinedFreeMonths,
          combinedPercentageOff: c.combinedPercentageOff ? Number(c.combinedPercentageOff) : null,
          combinedPercentageMonths: c.combinedPercentageMonths,
          applicableTiers: c.applicableTiers,
          applicableCycles: c.applicableCycles,
          maxTotalUses: c.maxTotalUses,
          maxUsesPerOrg: c.maxUsesPerOrg,
          currentUses: c.currentUses,
          usageCount: c._count.usages,
          validFrom: c.validFrom.toISOString(),
          validUntil: c.validUntil.toISOString(),
          isActive: c.isActive,
          isExpired: c.validUntil < new Date(),
          createdAt: c.createdAt.toISOString(),
        })),
        total: couponTotal,
        page,
        limit,
        totalPages: Math.ceil(couponTotal / limit),
      };
    }

    // Build global discount where clause
    if (type === 'global' || type === 'all') {
      const globalWhere: Prisma.GlobalDiscountWhereInput = {};

      if (status === 'active') {
        globalWhere.isActive = true;
        globalWhere.validUntil = { gte: new Date() };
      } else if (status === 'inactive') {
        globalWhere.isActive = false;
      } else if (status === 'expired') {
        globalWhere.validUntil = { lt: new Date() };
      }

      if (search) {
        globalWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [globalDiscounts, globalTotal] = await Promise.all([
        prisma.globalDiscount.findMany({
          where: globalWhere,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.globalDiscount.count({ where: globalWhere }),
      ]);

      results.globalDiscounts = {
        items: globalDiscounts.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          discountType: g.discountType,
          percentageOff: g.percentageOff ? Number(g.percentageOff) : null,
          freeMonths: g.freeMonths,
          fixedAmountOff: g.fixedAmountOff ? Number(g.fixedAmountOff) : null,
          combinedFreeMonths: g.combinedFreeMonths,
          combinedPercentageOff: g.combinedPercentageOff ? Number(g.combinedPercentageOff) : null,
          combinedPercentageMonths: g.combinedPercentageMonths,
          applicableTiers: g.applicableTiers,
          applicableCycles: g.applicableCycles,
          validFrom: g.validFrom.toISOString(),
          validUntil: g.validUntil.toISOString(),
          isActive: g.isActive,
          isExpired: g.validUntil < new Date(),
          bannerText: g.bannerText,
          badgeText: g.badgeText,
          createdAt: g.createdAt.toISOString(),
        })),
        total: globalTotal,
      };

      // Get currently active global discount
      results.activeGlobalDiscount = globalDiscounts.find(
        (g) => g.isActive && g.validFrom <= new Date() && g.validUntil >= new Date()
      );
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Admin discounts error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching discounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session, 'manage_discounts')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'coupon') {
      // Validate required fields
      if (!data.code || !data.name || !data.discountType || !data.validFrom || !data.validUntil) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      // Check for duplicate code
      const existing = await prisma.couponCode.findUnique({
        where: { code: data.code.toUpperCase() },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Coupon code already exists' },
          { status: 400 }
        );
      }

      const coupon = await prisma.couponCode.create({
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          description: data.description || null,
          discountType: data.discountType,
          percentageOff: data.percentageOff || null,
          freeMonths: data.freeMonths || null,
          fixedAmountOff: data.fixedAmountOff || null,
          combinedFreeMonths: data.combinedFreeMonths || null,
          combinedPercentageOff: data.combinedPercentageOff || null,
          combinedPercentageMonths: data.combinedPercentageMonths || null,
          applicableTiers: data.applicableTiers || [],
          applicableCycles: data.applicableCycles || [],
          maxTotalUses: data.maxTotalUses || null,
          maxUsesPerOrg: data.maxUsesPerOrg || 1,
          validFrom: new Date(data.validFrom),
          validUntil: new Date(data.validUntil),
          isActive: data.isActive ?? true,
          createdBy: session.id,
        },
      });

      return NextResponse.json({
        success: true,
        data: coupon,
        message: 'Coupon created successfully',
      });
    } else if (type === 'global') {
      // Validate required fields
      if (!data.name || !data.discountType || !data.validFrom || !data.validUntil) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      // If activating, deactivate any other active global discounts
      if (data.isActive) {
        await prisma.globalDiscount.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      const globalDiscount = await prisma.globalDiscount.create({
        data: {
          name: data.name,
          description: data.description || null,
          discountType: data.discountType,
          percentageOff: data.percentageOff || null,
          freeMonths: data.freeMonths || null,
          fixedAmountOff: data.fixedAmountOff || null,
          combinedFreeMonths: data.combinedFreeMonths || null,
          combinedPercentageOff: data.combinedPercentageOff || null,
          combinedPercentageMonths: data.combinedPercentageMonths || null,
          applicableTiers: data.applicableTiers || [],
          applicableCycles: data.applicableCycles || [],
          validFrom: new Date(data.validFrom),
          validUntil: new Date(data.validUntil),
          isActive: data.isActive ?? false,
          bannerText: data.bannerText || null,
          badgeText: data.badgeText || null,
          createdBy: session.id,
        },
      });

      return NextResponse.json({
        success: true,
        data: globalDiscount,
        message: 'Global discount created successfully',
      });
    } else if (type === 'pricing_settings') {
      // Update pricing settings
      const settings = await prisma.pricingSettings.upsert({
        where: { id: data.id || 'default' },
        update: {
          defaultAnnualDiscount: data.defaultAnnualDiscount,
          showDiscountsPublicly: data.showDiscountsPublicly,
          updatedBy: session.id,
        },
        create: {
          defaultAnnualDiscount: data.defaultAnnualDiscount || 17,
          showDiscountsPublicly: data.showDiscountsPublicly ?? true,
          updatedBy: session.id,
        },
      });

      return NextResponse.json({
        success: true,
        data: settings,
        message: 'Pricing settings updated successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid discount type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Create discount error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creating discount' },
      { status: 500 }
    );
  }
}
