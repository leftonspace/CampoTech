/**
 * Validate Technician Assignment API
 * POST /api/employees/schedule/validate-assignment
 * 
 * Checks if assigning a job to a technician would violate their on-call advance notice requirements.
 * Returns warnings (soft blocks) that the UI can display for confirmation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getBuenosAiresNow } from '@/lib/timezone';

interface ValidationResult {
    isValid: boolean;
    warnings: {
        type: 'advance_notice' | 'outside_availability' | 'day_off' | 'exception';
        message: string;
        details: {
            technicianId: string;
            technicianName: string;
            scheduleType: string;
            advanceNoticeRequired?: number;
            actualNoticeHours?: number;
            exceptionId?: string;
            exceptionReason?: string;
            exceptionDate?: string;
            exceptionStartTime?: string | null;
            exceptionEndTime?: string | null;
        };
    }[];
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { technicianId, scheduledDate, scheduledTimeStart } = body;

        if (!technicianId) {
            return NextResponse.json(
                { success: false, error: 'ID de técnico requerido' },
                { status: 400 }
            );
        }

        // Fetch technician with schedule info
        const technician = await prisma.user.findFirst({
            where: {
                id: technicianId,
                organizationId: session.organizationId,
            },
            select: {
                id: true,
                name: true,
                scheduleType: true,
                advanceNoticeHours: true,
                schedules: {
                    select: {
                        dayOfWeek: true,
                        startTime: true,
                        endTime: true,
                        isAvailable: true,
                    },
                },
            },
        });

        if (!technician) {
            return NextResponse.json(
                { success: false, error: 'Técnico no encontrado' },
                { status: 404 }
            );
        }

        const result: ValidationResult = {
            isValid: true,
            warnings: [],
        };

        // Check for schedule exceptions on this date (vacation, sick day, etc.)
        if (scheduledDate) {
            const exceptionDate = new Date(scheduledDate);
            exceptionDate.setHours(0, 0, 0, 0);

            const exceptions = await prisma.scheduleException.findMany({
                where: {
                    userId: technicianId,
                    date: exceptionDate,
                    isAvailable: false, // Only absence exceptions, not work hour modifications
                },
            });

            for (const exception of exceptions) {
                // Full day exception - always conflicts
                if (!exception.startTime || !exception.endTime) {
                    result.isValid = false;
                    result.warnings.push({
                        type: 'exception',
                        message: `${technician.name} tiene "${exception.reason || 'Excepción'}" el ${scheduledDate} (día completo).`,
                        details: {
                            technicianId: technician.id,
                            technicianName: technician.name,
                            scheduleType: technician.scheduleType,
                            exceptionId: exception.id,
                            exceptionReason: exception.reason || 'Excepción',
                            exceptionDate: scheduledDate,
                            exceptionStartTime: null,
                            exceptionEndTime: null,
                        },
                    });
                } else {
                    // Partial exception - check if job time range overlaps with exception time range
                    // Get job start and end times (use end time from body if provided)
                    const jobStartStr = scheduledTimeStart;
                    const jobEndStr = body.scheduledTimeEnd || null;

                    if (jobStartStr) {
                        const [jobStartH, jobStartM] = jobStartStr.split(':').map(Number);
                        const [excStartH, excStartM] = exception.startTime.split(':').map(Number);
                        const [excEndH, excEndM] = exception.endTime.split(':').map(Number);

                        const jobStartMinutes = jobStartH * 60 + (jobStartM || 0);
                        const excStartMinutes = excStartH * 60 + excStartM;
                        const excEndMinutes = excEndH * 60 + excEndM;

                        // If job end time provided, use it; otherwise assume job extends for at least 1 hour
                        let jobEndMinutes = jobStartMinutes + 60; // Default 1 hour
                        if (jobEndStr) {
                            const [jobEndH, jobEndM] = jobEndStr.split(':').map(Number);
                            jobEndMinutes = jobEndH * 60 + (jobEndM || 0);
                        }

                        // Time ranges overlap if: jobStart < excEnd AND jobEnd > excStart
                        const hasOverlap = jobStartMinutes < excEndMinutes && jobEndMinutes > excStartMinutes;

                        if (hasOverlap) {
                            result.isValid = false;
                            result.warnings.push({
                                type: 'exception',
                                message: `${technician.name} tiene "${exception.reason || 'Ausencia'}" el ${scheduledDate} de ${exception.startTime} a ${exception.endTime}.`,
                                details: {
                                    technicianId: technician.id,
                                    technicianName: technician.name,
                                    scheduleType: technician.scheduleType,
                                    exceptionId: exception.id,
                                    exceptionReason: exception.reason || 'Ausencia',
                                    exceptionDate: scheduledDate,
                                    exceptionStartTime: exception.startTime,
                                    exceptionEndTime: exception.endTime,
                                },
                            });
                        }
                    }
                }
            }
        }

        // Only check on-call constraints if schedule type is 'ondemand'
        if (technician.scheduleType === 'ondemand' && technician.advanceNoticeHours > 0) {
            // Calculate hours until scheduled time
            if (scheduledDate && scheduledTimeStart) {
                const now = getBuenosAiresNow();

                // Parse scheduled date and time
                const [year, month, day] = scheduledDate.split('-').map(Number);
                const [hours, minutes] = scheduledTimeStart.split(':').map(Number);
                const scheduledDateTime = new Date(year, month - 1, day, hours, minutes);

                // Calculate hours difference
                const diffMs = scheduledDateTime.getTime() - now.getTime();
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

                if (diffHours < technician.advanceNoticeHours) {
                    result.isValid = false;
                    result.warnings.push({
                        type: 'advance_notice',
                        message: `${technician.name} requiere ${technician.advanceNoticeHours}h de anticipación (modalidad A Demanda). El trabajo está programado en ${diffHours < 0 ? 'el pasado' : `${diffHours}h`}.`,
                        details: {
                            technicianId: technician.id,
                            technicianName: technician.name,
                            scheduleType: 'ondemand',
                            advanceNoticeRequired: technician.advanceNoticeHours,
                            actualNoticeHours: Math.max(0, diffHours),
                        },
                    });
                }
            }

            // Check if scheduled day is in their availability window
            if (scheduledDate) {
                const scheduledDateObj = new Date(scheduledDate);
                const dayOfWeek = scheduledDateObj.getDay();
                const daySchedule = technician.schedules.find((s: { dayOfWeek: number }) => s.dayOfWeek === dayOfWeek);

                if (!daySchedule || !daySchedule.isAvailable) {
                    result.isValid = false;
                    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                    result.warnings.push({
                        type: 'day_off',
                        message: `${technician.name} no tiene disponibilidad configurada para ${dayNames[dayOfWeek]}.`,
                        details: {
                            technicianId: technician.id,
                            technicianName: technician.name,
                            scheduleType: 'ondemand',
                        },
                    });
                } else if (scheduledTimeStart) {
                    // Check if time is within availability window
                    const [jobHour, jobMin] = scheduledTimeStart.split(':').map(Number);
                    const [schedStartH, schedStartM] = daySchedule.startTime.split(':').map(Number);
                    const [schedEndH, schedEndM] = daySchedule.endTime.split(':').map(Number);

                    const jobMinutes = jobHour * 60 + jobMin;
                    const schedStartMinutes = schedStartH * 60 + schedStartM;
                    const schedEndMinutes = schedEndH * 60 + schedEndM;

                    if (jobMinutes < schedStartMinutes || jobMinutes > schedEndMinutes) {
                        result.isValid = false;
                        result.warnings.push({
                            type: 'outside_availability',
                            message: `${technician.name} solo está disponible de ${daySchedule.startTime} a ${daySchedule.endTime}. El trabajo está programado para las ${scheduledTimeStart}.`,
                            details: {
                                technicianId: technician.id,
                                technicianName: technician.name,
                                scheduleType: 'ondemand',
                            },
                        });
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error validating assignment:', error);
        return NextResponse.json(
            { success: false, error: 'Error al validar asignación' },
            { status: 500 }
        );
    }
}
