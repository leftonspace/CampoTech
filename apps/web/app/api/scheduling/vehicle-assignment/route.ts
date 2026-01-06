/**
 * Vehicle Assignment API
 * =======================
 *
 * Phase 2.1: Vehicle Scheduling
 *
 * POST - Create a new vehicle schedule
 * PUT  - Update an existing schedule
 * DELETE - Remove a schedule
 * GET - List schedules for a user or organization
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { vehicleScheduleService, VehicleScheduleType } from '@/lib/services/vehicle-schedule.service';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create Vehicle Schedule
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Only OWNER and DISPATCHER can manage vehicle schedules
        if (!['OWNER', 'DISPATCHER'].includes(session.role)) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para gestionar horarios de vehículos' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            userId,
            vehicleId,
            scheduleType,
            startDate,
            endDate,
            timeStart,
            timeEnd,
            daysOfWeek,
            priority,
        } = body;

        // Validate required fields
        if (!userId || !vehicleId || !scheduleType) {
            return NextResponse.json(
                { success: false, error: 'Se requieren userId, vehicleId y scheduleType' },
                { status: 400 }
            );
        }

        // Validate schedule type
        if (!['PERMANENT', 'DATE_RANGE', 'RECURRING'].includes(scheduleType)) {
            return NextResponse.json(
                { success: false, error: 'Tipo de horario inválido' },
                { status: 400 }
            );
        }

        // Check for conflicts
        const conflicts = await vehicleScheduleService.checkForConflicts(
            vehicleId,
            scheduleType as VehicleScheduleType,
            startDate ? new Date(startDate) : null,
            endDate ? new Date(endDate) : null,
            daysOfWeek
        );

        if (conflicts.hasConflict) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'El vehículo ya está asignado en este horario',
                    conflictingSchedules: conflicts.conflictingSchedules,
                },
                { status: 409 }
            );
        }

        // Create the schedule
        const result = await vehicleScheduleService.createSchedule({
            organizationId: session.organizationId,
            userId,
            vehicleId,
            scheduleType: scheduleType as VehicleScheduleType,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            timeStart: timeStart || null,
            timeEnd: timeEnd || null,
            daysOfWeek: daysOfWeek || [],
            priority: priority || undefined,
            createdById: session.userId,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            schedule: result.schedule,
            message: 'Horario de vehículo creado correctamente',
        });
    } catch (error) {
        console.error('[VehicleAssignment] POST error:', error);
        return NextResponse.json(
            { success: false, error: 'Error creando horario de vehículo' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT - Update Vehicle Schedule
// ═══════════════════════════════════════════════════════════════════════════════

export async function PUT(request: Request): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        if (!['OWNER', 'DISPATCHER'].includes(session.role)) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para gestionar horarios de vehículos' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { scheduleId, ...updates } = body;

        if (!scheduleId) {
            return NextResponse.json(
                { success: false, error: 'Se requiere scheduleId' },
                { status: 400 }
            );
        }

        // If changing vehicle or dates, check for conflicts
        if (updates.vehicleId || updates.startDate || updates.endDate || updates.daysOfWeek) {
            const conflicts = await vehicleScheduleService.checkForConflicts(
                updates.vehicleId || body.vehicleId,
                updates.scheduleType || body.scheduleType,
                updates.startDate ? new Date(updates.startDate) : null,
                updates.endDate ? new Date(updates.endDate) : null,
                updates.daysOfWeek || body.daysOfWeek,
                scheduleId // Exclude current schedule from conflict check
            );

            if (conflicts.hasConflict) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'El vehículo ya está asignado en este horario',
                        conflictingSchedules: conflicts.conflictingSchedules,
                    },
                    { status: 409 }
                );
            }
        }

        const result = await vehicleScheduleService.updateSchedule(scheduleId, {
            ...updates,
            startDate: updates.startDate ? new Date(updates.startDate) : undefined,
            endDate: updates.endDate ? new Date(updates.endDate) : undefined,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            schedule: result.schedule,
            message: 'Horario de vehículo actualizado correctamente',
        });
    } catch (error) {
        console.error('[VehicleAssignment] PUT error:', error);
        return NextResponse.json(
            { success: false, error: 'Error actualizando horario de vehículo' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Remove Vehicle Schedule
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(request: Request): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        if (!['OWNER', 'DISPATCHER'].includes(session.role)) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para gestionar horarios de vehículos' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const scheduleId = searchParams.get('scheduleId');

        if (!scheduleId) {
            return NextResponse.json(
                { success: false, error: 'Se requiere scheduleId' },
                { status: 400 }
            );
        }

        const result = await vehicleScheduleService.deleteSchedule(scheduleId);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Horario de vehículo eliminado correctamente',
        });
    } catch (error) {
        console.error('[VehicleAssignment] DELETE error:', error);
        return NextResponse.json(
            { success: false, error: 'Error eliminando horario de vehículo' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List Vehicle Schedules
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const vehicleId = searchParams.get('vehicleId');

        // Fetch schedules based on filters
        const schedules = await vehicleScheduleService.getOrganizationSchedules(
            session.organizationId,
            {
                userId: userId || undefined,
                vehicleId: vehicleId || undefined,
            }
        );

        return NextResponse.json({
            success: true,
            schedules,
        });
    } catch (error) {
        console.error('[VehicleAssignment] GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo horarios de vehículos' },
            { status: 500 }
        );
    }
}
