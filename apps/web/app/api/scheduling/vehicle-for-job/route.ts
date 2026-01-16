/**
 * Vehicle for Job API
 * ====================
 *
 * Phase 2.1: Vehicle Scheduling
 *
 * GET - Get the vehicle assigned to a technician for a specific date/time
 *
 * This endpoint is used by the job creation form to auto-populate
 * the vehicle field based on the technician's schedule.
 * 
 * Priority order:
 * 1. VehicleSchedule (DATE_RANGE > RECURRING > PERMANENT)
 * 2. VehicleAssignment with isPrimaryDriver = true (legacy/fleet page)
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { vehicleScheduleService } from '@/lib/services/vehicle-schedule.service';
import { prisma } from '@/lib/prisma';

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
        const technicianId = searchParams.get('technicianId');
        const dateParam = searchParams.get('date'); // ISO date string
        const timeParam = searchParams.get('time'); // HH:mm format

        if (!technicianId) {
            return NextResponse.json(
                { success: false, error: 'Se requiere technicianId' },
                { status: 400 }
            );
        }

        if (!dateParam) {
            return NextResponse.json(
                { success: false, error: 'Se requiere date (formato ISO)' },
                { status: 400 }
            );
        }

        // Parse date
        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
            return NextResponse.json(
                { success: false, error: 'Formato de fecha inválido' },
                { status: 400 }
            );
        }

        // Validate time format if provided
        if (timeParam && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeParam)) {
            return NextResponse.json(
                { success: false, error: 'Formato de hora inválido (use HH:mm)' },
                { status: 400 }
            );
        }

        // First, try to get vehicle from VehicleSchedule (the newer, more flexible system)
        const scheduleResult = await vehicleScheduleService.getVehicleForDateTime(
            technicianId,
            date,
            timeParam || undefined
        );

        // If found in VehicleSchedule, return it
        if (scheduleResult.vehicle) {
            return NextResponse.json({
                success: true,
                vehicle: scheduleResult.vehicle,
                schedule: scheduleResult.schedule,
                matchType: scheduleResult.matchType,
                info: {
                    message: `Vehículo asignado según horario ${getMatchTypeLabel(scheduleResult.matchType)}`,
                    vehicleName: `${scheduleResult.vehicle.make} ${scheduleResult.vehicle.model} - ${scheduleResult.vehicle.plateNumber}`,
                },
            });
        }

        // Fallback: Check VehicleAssignment with isPrimaryDriver = true
        // This is the legacy system used by the Fleet page
        const primaryAssignment = await prisma.vehicleAssignment.findFirst({
            where: {
                userId: technicianId,
                isPrimaryDriver: true,
                // Check if assignment is currently active (no end date or end date in future)
                OR: [
                    { assignedUntil: null },
                    { assignedUntil: { gte: new Date() } },
                ],
            },
            include: {
                vehicle: {
                    select: {
                        id: true,
                        plateNumber: true,
                        make: true,
                        model: true,
                        status: true,
                    },
                },
            },
        });

        if (primaryAssignment?.vehicle) {
            return NextResponse.json({
                success: true,
                vehicle: primaryAssignment.vehicle,
                schedule: null,
                matchType: 'permanent' as const, // Treat primary driver as permanent
                info: {
                    message: 'Vehículo asignado como conductor principal',
                    vehicleName: `${primaryAssignment.vehicle.make} ${primaryAssignment.vehicle.model} - ${primaryAssignment.vehicle.plateNumber}`,
                },
            });
        }

        // No vehicle found
        return NextResponse.json({
            success: true,
            vehicle: null,
            schedule: null,
            matchType: null,
            info: {
                message: 'No hay vehículo asignado para esta fecha/hora',
            },
        });
    } catch (error) {
        console.error('[VehicleForJob] GET error:', error);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo vehículo asignado' },
            { status: 500 }
        );
    }
}

/**
 * Get human-readable label for match type
 */
function getMatchTypeLabel(
    matchType: 'permanent' | 'date_range' | 'recurring' | null
): string {
    switch (matchType) {
        case 'permanent':
            return '(predeterminado)';
        case 'date_range':
            return '(por fechas)';
        case 'recurring':
            return '(por día de semana)';
        default:
            return '';
    }
}
