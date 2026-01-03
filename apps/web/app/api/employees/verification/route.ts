/**
 * Employee Verification API
 * ==========================
 *
 * Endpoints for managing employee verification from owner's perspective:
 * - GET: List employees with verification status
 * - POST: Send verification reminders
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
// import { prisma } from '@/lib/prisma';
import {
  getEmployeesWithVerificationStatus,
  sendVerificationReminder,
} from '@/lib/services/employee-verification-notifications';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List employees with verification status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER and DISPATCHER can view employee verification status
    if (!['OWNER', 'DISPATCHER'].includes(session.role?.toUpperCase() || '')) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // all, verified, pending, blocked

    // Get employees with verification status
    let employees = await getEmployeesWithVerificationStatus(session.organizationId);

    // Apply filter
    if (filter && filter !== 'all') {
      employees = employees.filter((emp) => {
        switch (filter) {
          case 'verified':
            return emp.verificationStatus === 'verified';
          case 'pending':
            return ['not_started', 'pending', 'in_review'].includes(emp.verificationStatus);
          case 'blocked':
            return emp.verificationStatus === 'suspended' || !emp.canBeAssignedJobs;
          default:
            return true;
        }
      });
    }

    // Calculate summary
    const summary = {
      total: employees.length,
      verified: employees.filter((e) => e.verificationStatus === 'verified').length,
      pending: employees.filter((e) =>
        ['not_started', 'pending', 'in_review'].includes(e.verificationStatus)
      ).length,
      blocked: employees.filter((e) => e.verificationStatus === 'suspended').length,
      expiringDocuments: employees.reduce((sum, e) => sum + e.expiringDocuments, 0),
    };

    return NextResponse.json({
      success: true,
      data: employees,
      summary,
    });
  } catch (error) {
    console.error('[Employee Verification] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener empleados',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Send verification reminder or bulk action
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER can send reminders
    if (session.role?.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede enviar recordatorios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, employeeIds } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Acción no especificada' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'send_reminder': {
        // Single employee reminder
        const { employeeId } = body;
        if (!employeeId) {
          return NextResponse.json(
            { success: false, error: 'ID de empleado requerido' },
            { status: 400 }
          );
        }

        const result = await sendVerificationReminder(
          employeeId,
          session.organizationId,
          session.id
        );

        return NextResponse.json({
          success: result.success,
          emailSent: result.emailSent,
          error: result.error,
          lastReminderAt: result.lastReminderAt?.toISOString(),
        });
      }

      case 'bulk_reminder': {
        // Bulk send reminders to multiple employees
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Lista de empleados requerida' },
            { status: 400 }
          );
        }

        const results = await Promise.all(
          employeeIds.map((id) =>
            sendVerificationReminder(id, session.organizationId, session.id)
              .then((r) => ({ id, ...r }))
              .catch((e) => ({ id, success: false, emailSent: false, error: e.message }))
          )
        );

        const successCount = results.filter((r) => r.success).length;
        const failedCount = results.filter((r) => !r.success).length;

        return NextResponse.json({
          success: successCount > 0,
          sent: successCount,
          failed: failedCount,
          results,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Acción no reconocida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Employee Verification] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al procesar solicitud',
      },
      { status: 500 }
    );
  }
}
