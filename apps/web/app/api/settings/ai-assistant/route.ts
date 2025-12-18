/**
 * AI Assistant Settings API
 *
 * GET - Retrieve AI configuration for the current organization
 * PUT - Update AI configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Retrieve AI Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const config = await prisma.aIConfiguration.findUnique({
      where: { organizationId: session.organizationId },
      include: {
        escalationUser: {
          select: { id: true, name: true },
        },
      },
    });

    // Default data access permissions
    const defaultDataAccessPermissions = {
      companyInfo: true,
      services: true,
      pricing: true,
      businessHours: true,
      serviceAreas: true,
      technicianNames: false, // Privacy: hide actual names by default
      technicianAvailability: true,
      scheduleSlots: true,
      faq: true,
      policies: true,
    };

    // Return default config if not found (for new organizations)
    if (!config) {
      return NextResponse.json({
        id: null,
        isEnabled: false,
        autoResponseEnabled: true,
        minConfidenceToRespond: 70,
        minConfidenceToCreateJob: 85,
        dataAccessPermissions: defaultDataAccessPermissions,
        companyName: '',
        companyDescription: '',
        servicesOffered: [],
        businessHours: {},
        serviceAreas: '',
        pricingInfo: '',
        cancellationPolicy: '',
        paymentMethods: '',
        warrantyInfo: '',
        faqItems: [],
        customInstructions: '',
        aiTone: 'friendly_professional',
        greetingMessage: '',
        awayMessage: '',
        transferKeywords: [],
        escalationUserId: '',
      });
    }

    return NextResponse.json({
      id: config.id,
      isEnabled: config.isEnabled,
      autoResponseEnabled: config.autoResponseEnabled,
      minConfidenceToRespond: config.minConfidenceToRespond,
      minConfidenceToCreateJob: config.minConfidenceToCreateJob,
      dataAccessPermissions: config.dataAccessPermissions || defaultDataAccessPermissions,
      companyName: config.companyName || '',
      companyDescription: config.companyDescription || '',
      servicesOffered: config.servicesOffered || [],
      businessHours: config.businessHours || {},
      serviceAreas: config.serviceAreas || '',
      pricingInfo: config.pricingInfo || '',
      cancellationPolicy: config.cancellationPolicy || '',
      paymentMethods: config.paymentMethods || '',
      warrantyInfo: config.warrantyInfo || '',
      faqItems: config.faqItems || [],
      customInstructions: config.customInstructions || '',
      aiTone: config.aiTone,
      greetingMessage: config.greetingMessage || '',
      awayMessage: config.awayMessage || '',
      transferKeywords: config.transferKeywords || [],
      escalationUserId: config.escalationUserId || '',
    });
  } catch (error) {
    console.error('Error fetching AI config:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT - Update AI Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Check user role - only OWNER and DISPATCHER can modify
    const userRole = session.role?.toUpperCase();
    if (userRole !== 'OWNER' && userRole !== 'DISPATCHER') {
      return NextResponse.json(
        { error: 'No tenés permisos para modificar esta configuración' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate confidence thresholds
    const minConfidenceToRespond = Math.min(100, Math.max(0, body.minConfidenceToRespond ?? 70));
    const minConfidenceToCreateJob = Math.min(100, Math.max(0, body.minConfidenceToCreateJob ?? 85));

    // Default data access permissions for PUT
    const defaultPerms = {
      companyInfo: true,
      services: true,
      pricing: true,
      businessHours: true,
      serviceAreas: true,
      technicianNames: false,
      technicianAvailability: true,
      scheduleSlots: true,
      faq: true,
      policies: true,
    };

    // Upsert configuration
    const config = await prisma.aIConfiguration.upsert({
      where: { organizationId: session.organizationId },
      create: {
        organizationId: session.organizationId,
        isEnabled: body.isEnabled ?? false,
        autoResponseEnabled: body.autoResponseEnabled ?? true,
        minConfidenceToRespond,
        minConfidenceToCreateJob,
        dataAccessPermissions: body.dataAccessPermissions || defaultPerms,
        companyName: body.companyName || null,
        companyDescription: body.companyDescription || null,
        servicesOffered: body.servicesOffered || [],
        businessHours: body.businessHours || {},
        serviceAreas: body.serviceAreas || null,
        pricingInfo: body.pricingInfo || null,
        cancellationPolicy: body.cancellationPolicy || null,
        paymentMethods: body.paymentMethods || null,
        warrantyInfo: body.warrantyInfo || null,
        faqItems: body.faqItems || [],
        customInstructions: body.customInstructions || null,
        aiTone: body.aiTone || 'friendly_professional',
        greetingMessage: body.greetingMessage || null,
        awayMessage: body.awayMessage || null,
        transferKeywords: body.transferKeywords || [],
        escalationUserId: body.escalationUserId || null,
      },
      update: {
        isEnabled: body.isEnabled ?? false,
        autoResponseEnabled: body.autoResponseEnabled ?? true,
        minConfidenceToRespond,
        minConfidenceToCreateJob,
        dataAccessPermissions: body.dataAccessPermissions || defaultPerms,
        companyName: body.companyName || null,
        companyDescription: body.companyDescription || null,
        servicesOffered: body.servicesOffered || [],
        businessHours: body.businessHours || {},
        serviceAreas: body.serviceAreas || null,
        pricingInfo: body.pricingInfo || null,
        cancellationPolicy: body.cancellationPolicy || null,
        paymentMethods: body.paymentMethods || null,
        warrantyInfo: body.warrantyInfo || null,
        faqItems: body.faqItems || [],
        customInstructions: body.customInstructions || null,
        aiTone: body.aiTone || 'friendly_professional',
        greetingMessage: body.greetingMessage || null,
        awayMessage: body.awayMessage || null,
        transferKeywords: body.transferKeywords || [],
        escalationUserId: body.escalationUserId || null,
      },
    });

    return NextResponse.json({
      id: config.id,
      isEnabled: config.isEnabled,
      autoResponseEnabled: config.autoResponseEnabled,
      minConfidenceToRespond: config.minConfidenceToRespond,
      minConfidenceToCreateJob: config.minConfidenceToCreateJob,
      dataAccessPermissions: config.dataAccessPermissions || defaultPerms,
      companyName: config.companyName || '',
      companyDescription: config.companyDescription || '',
      servicesOffered: config.servicesOffered || [],
      businessHours: config.businessHours || {},
      serviceAreas: config.serviceAreas || '',
      pricingInfo: config.pricingInfo || '',
      cancellationPolicy: config.cancellationPolicy || '',
      paymentMethods: config.paymentMethods || '',
      warrantyInfo: config.warrantyInfo || '',
      faqItems: config.faqItems || [],
      customInstructions: config.customInstructions || '',
      aiTone: config.aiTone,
      greetingMessage: config.greetingMessage || '',
      awayMessage: config.awayMessage || '',
      transferKeywords: config.transferKeywords || [],
      escalationUserId: config.escalationUserId || '',
    });
  } catch (error) {
    console.error('Error saving AI config:', error);
    return NextResponse.json(
      { error: 'Error guardando configuración' },
      { status: 500 }
    );
  }
}
