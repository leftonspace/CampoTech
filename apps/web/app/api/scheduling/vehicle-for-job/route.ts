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
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { vehicleScheduleService } from '@/lib/services/vehicle-schedule.service';

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

        // Get the assigned vehicle for this date/time
        const result = await vehicleScheduleService.getVehicleForDateTime(
            technicianId,
            date,
            timeParam || undefined
        );

        return NextResponse.json({
            success: true,
            vehicle: result.vehicle,
            schedule: result.schedule,
            matchType: result.matchType,
            // Helpful info for the UI
            info: result.vehicle
                ? {
                    message: `Vehículo asignado según horario ${getMatchTypeLabel(result.matchType)}`,
                    vehicleName: `${result.vehicle.make} ${result.vehicle.model} - ${result.vehicle.plateNumber}`,
                }
                : {
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
