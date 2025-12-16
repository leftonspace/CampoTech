/**
 * Vehicle Documents API Route
 * GET /api/vehicles/[id]/documents - List vehicle documents
 * POST /api/vehicles/[id]/documents - Upload new document
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify vehicle belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    const documents = await prisma.vehicleDocument.findMany({
      where: { vehicleId: id },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Add expiry status
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const documentsWithStatus = documents.map((doc: typeof documents[number]) => {
      let expiryStatus: 'valid' | 'expiring_soon' | 'expired' | 'no_expiry' = 'no_expiry';

      if (doc.expiryDate) {
        if (doc.expiryDate < now) {
          expiryStatus = 'expired';
        } else if (doc.expiryDate < thirtyDaysFromNow) {
          expiryStatus = 'expiring_soon';
        } else {
          expiryStatus = 'valid';
        }
      }

      return {
        ...doc,
        expiryStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: documentsWithStatus,
    });
  } catch (error) {
    console.error('Vehicle documents list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error cargando documentos' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only owners and dispatchers can upload documents
    if (!['OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify vehicle belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      documentType,
      fileName,
      fileUrl,
      fileSize,
      mimeType,
      expiryDate,
      notes,
    } = body;

    // Validate required fields
    if (!documentType || !fileName || !fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Tipo, nombre y archivo son requeridos' },
        { status: 400 }
      );
    }

    // Validate document type
    const validTypes = ['INSURANCE', 'REGISTRATION', 'VTV', 'LICENSE', 'MANUAL', 'OTHER'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de documento inválido' },
        { status: 400 }
      );
    }

    // Create document
    const document = await prisma.vehicleDocument.create({
      data: {
        vehicleId: id,
        documentType,
        fileName,
        fileUrl,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes,
        uploadedById: session.userId,
      },
    });

    // Update vehicle expiry dates if relevant document type
    const updateData: Record<string, Date> = {};
    if (documentType === 'INSURANCE' && expiryDate) {
      updateData.insuranceExpiry = new Date(expiryDate);
    } else if (documentType === 'VTV' && expiryDate) {
      updateData.vtvExpiry = new Date(expiryDate);
    } else if (documentType === 'REGISTRATION' && expiryDate) {
      updateData.registrationExpiry = new Date(expiryDate);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.vehicle.update({
        where: { id },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Vehicle document upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Error subiendo documento' },
      { status: 500 }
    );
  }
}
