/**
 * Single Invoice API Route
 * GET /api/invoices/[id] - Get invoice details
 * PUT /api/invoices/[id] - Update invoice (with CAE lock logic)
 * DELETE /api/invoices/[id] - Delete invoice (only if no CAE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateInvoiceUpdate,
  canAccessModule,
  UserRole,
} from '@/lib/middleware/field-filter';

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

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'VIEWER') as UserRole;

    // Check module access
    if (!canAccessModule('invoices', userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver facturas' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
      include: {
        customer: true,
        lineItems: true,
        job: {
          select: {
            id: true,
            jobNumber: true,
            description: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      );
    }

    // Filter data based on user role
    const filteredData = filterEntityByRole(invoice, 'invoice', userRole);
    const fieldMeta = getEntityFieldMetadata('invoice', userRole);

    // Add CAE lock indicator
    const hasCae = !!invoice.afipCae;

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
      _locked: hasCae,
      _lockedMessage: hasCae
        ? 'Esta factura tiene CAE asignado y no puede ser modificada. Para correcciones, emita una Nota de Credito.'
        : null,
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo factura' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Normalize user role
    const userRole = (session.role?.toUpperCase() || 'VIEWER') as UserRole;

    // Only ADMIN and OWNER can update invoices
    if (!['ADMIN', 'OWNER'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar facturas' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Verify invoice exists and belongs to organization
    const existing = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      );
    }

    // Special validation for invoices with CAE
    const validation = validateInvoiceUpdate(
      { afipCae: existing.afipCae },
      body,
      userRole
    );

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

    // Build update data - if invoice has CAE, only allow specific fields
    const updateData: Record<string, unknown> = {};

    if (existing.afipCae) {
      // Invoice with CAE - only allow status, paidAt, and paymentMethod updates
      if (body.status !== undefined) updateData.status = body.status;
      if (body.paidAt !== undefined) updateData.paidAt = body.paidAt ? new Date(body.paidAt) : null;
      if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    } else {
      // Invoice without CAE - allow all edits (it's still a draft or pending CAE)
      if (body.status !== undefined) updateData.status = body.status;
      if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.paidAt !== undefined) updateData.paidAt = body.paidAt ? new Date(body.paidAt) : null;
      if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
      // Note: invoice number, type, customer, line items, totals should go through proper workflow
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        lineItems: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: invoice,
      _locked: !!invoice.afipCae,
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando factura' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Normalize user role
    const userRole = (session.role?.toUpperCase() || 'VIEWER') as UserRole;

    // Only ADMIN and OWNER can delete invoices
    if (!['ADMIN', 'OWNER'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar facturas' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify invoice exists and belongs to organization
    const existing = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      );
    }

    // Cannot delete invoice with CAE - it's a legal document
    if (existing.afipCae) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar una factura con CAE. Es un documento legal. Emita una Nota de Credito para anulacion.',
        },
        { status: 403 }
      );
    }

    // Only allow deletion of DRAFT invoices
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo se pueden eliminar facturas en estado borrador. Use Nota de Credito para facturas emitidas.',
        },
        { status: 403 }
      );
    }

    // Delete line items first
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: id },
    });

    await prisma.invoice.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Factura eliminada correctamente',
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando factura' },
      { status: 500 }
    );
  }
}
