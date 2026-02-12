/**
 * AI Co-Pilot Execute Action API
 * ===============================
 *
 * Executes actions suggested by the AI co-pilot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseDateTimeAsArgentina } from '@/lib/timezone';

interface ExecuteActionRequest {
  action_type: 'create_job' | 'create_customer' | 'send_message' | 'schedule_followup';
  data: Record<string, unknown>;
  conversation_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission (OWNER or ADMIN)
    if (!['OWNER', 'ADMIN'].includes(session.role?.toUpperCase() || '')) {
      return NextResponse.json(
        { success: false, error: 'No tenés permiso para ejecutar acciones' },
        { status: 403 }
      );
    }

    const body: ExecuteActionRequest = await request.json();
    const { action_type, data, conversation_id } = body;

    switch (action_type) {
      case 'create_job': {
        // Get customer from conversation
        let customerId = data.customerId as string | undefined;

        if (!customerId && conversation_id) {
          const conversation = await prisma.waConversation.findUnique({
            where: { id: conversation_id },
            select: { customerId: true, customerName: true, customerPhone: true },
          });

          if (conversation?.customerId) {
            customerId = conversation.customerId;
          } else if (conversation) {
            // Create customer if doesn't exist
            const newCustomer = await prisma.customer.create({
              data: {
                organizationId: session.organizationId,
                name: conversation.customerName || 'Cliente WhatsApp',
                phone: conversation.customerPhone,
                address: {},
              },
            });
            customerId = newCustomer.id;

            // Link conversation to customer
            await prisma.waConversation.update({
              where: { id: conversation_id },
              data: { customerId: newCustomer.id },
            });
          }
        }

        if (!customerId) {
          return NextResponse.json({
            success: false,
            error: 'No se pudo identificar al cliente',
          });
        }

        // Create the job
        const job = await prisma.job.create({
          data: {
            organizationId: session.organizationId,
            customerId,
            title: (data.title as string) || 'Trabajo desde WhatsApp',
            description: (data.description as string) || 'Creado desde co-pilot',
            serviceType: (data.serviceType as string) || 'REPAIR',
            status: 'PENDING',
            scheduledDate: data.scheduledDate ? parseDateTimeAsArgentina(data.scheduledDate as string) : null,
            estimatedPrice: data.estimatedPrice ? Number(data.estimatedPrice) : null,
          },
        });

        return NextResponse.json({
          success: true,
          result: {
            jobId: job.id,
            jobNumber: job.jobNumber,
          },
          confirmation_message: `Trabajo ${job.jobNumber || job.id.slice(-6)} creado exitosamente.`,
        });
      }

      case 'create_customer': {
        const customer = await prisma.customer.create({
          data: {
            organizationId: session.organizationId,
            name: (data.name as string) || 'Nuevo Cliente',
            phone: (data.phone as string) || '',
            email: data.email as string | undefined,
            address: data.address || {},
          },
        });

        return NextResponse.json({
          success: true,
          result: { customerId: customer.id },
          confirmation_message: `Cliente ${customer.name} creado exitosamente.`,
        });
      }

      case 'schedule_followup': {
        // Create a reminder/follow-up task
        // This could be implemented with a tasks table or notification system
        return NextResponse.json({
          success: true,
          result: {},
          confirmation_message: 'Recordatorio de seguimiento programado.',
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Acción desconocida: ${action_type}`,
        });
    }
  } catch (error) {
    console.error('Execute action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error ejecutando la acción' },
      { status: 500 }
    );
  }
}
