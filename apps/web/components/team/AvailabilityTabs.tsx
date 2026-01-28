'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn, getInitials } from '@/lib/utils';
import { Clock, Calendar } from 'lucide-react';
import TeamCalendar from '@/components/schedule/TeamCalendar';
import ScheduleConfigModal from '@/components/schedule/ScheduleConfigModal';
import type { TeamMember, ScheduleEntry } from './types';
import { ROLE_CONFIG } from './EmployeeListTab';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const DAYS_OF_WEEK = [
    { id: 1, name: 'Lunes', short: 'LUN' },
    { id: 2, name: 'Martes', short: 'MAR' },
    { id: 3, name: 'Miércoles', short: 'MIÉ' },
    { id: 4, name: 'Jueves', short: 'JUE' },
    { id: 5, name: 'Viernes', short: 'VIE' },
    { id: 6, name: 'Sábado', short: 'SÁB' },
    { id: 0, name: 'Domingo', short: 'DOM' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY SCHEDULES TAB (Read-Only Visualizer)
// Updated: Cleaner grid without repetitive orange warnings
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function WeeklySchedulesTab({ members }: { members: TeamMember[] }) {
    const { data: schedulesData, isLoading } = useQuery({
        queryKey: ['all-schedules'],
        queryFn: async () => {
            const res = await fetch('/api/employees/schedule/all');
            if (!res.ok) throw new Error('Error fetching schedules');
            return res.json();
        },
    });

    const schedules: ScheduleEntry[] = schedulesData?.data?.schedules || [];

    // Check if a user has ANY schedule records defined
    const userHasSchedule = (userId: string): boolean => {
        return schedules.some((s: ScheduleEntry) => s.userId === userId);
    };

    // Get schedule for a specific day
    const getScheduleForDay = (userId: string, dayOfWeek: number): { text: string; isAvailable: boolean } => {
        const schedule = schedules.find(
            (s: ScheduleEntry) => s.userId === userId && s.dayOfWeek === dayOfWeek
        );

        if (schedule?.isAvailable) {
            return { text: `${schedule.startTime} - ${schedule.endTime}`, isAvailable: true };
        }

        // If we are here, it's either "Libre" (Day Off) or "Sin Horario" (No setup)
        // We handle the visual distinction in the render loop, not here.
        return { text: 'Libre', isAvailable: false };
    };

    if (isLoading) {
        return (
            <div className="card overflow-hidden">
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Cargando horarios...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                    Vista de solo lectura. Para modificar horarios, haga clic en el día específico en la pestaña <strong>Disponibilidad</strong>.
                </p>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Empleado
                                </th>
                                {DAYS_OF_WEEK.map((day) => (
                                    <th
                                        key={day.id}
                                        className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                                    >
                                        {day.short}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {members.map((member) => {
                                const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.TECHNICIAN;
                                const hasAnySchedule = userHasSchedule(member.id);

                                return (
                                    <tr key={member.id} className="hover:bg-gray-50">
                                        {/* NAME COLUMN - Keep the warning here if needed */}
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-medium">
                                                    {getInitials(member.name)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn('px-1.5 py-0.5 text-xs font-medium rounded', roleConfig.color)}>
                                                            {roleConfig.label}
                                                        </span>
                                                        {!hasAnySchedule && (
                                                            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700 border border-orange-200">
                                                                ⚠️ Sin Configurar
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* DAYS COLUMNS - Clean Look */}
                                        {DAYS_OF_WEEK.map((day) => {
                                            const scheduleInfo = getScheduleForDay(member.id, day.id);

                                            // VISUAL LOGIC:
                                            // 1. If user has NO schedule set up at all -> Show clean Dash "-"
                                            // 2. If user has schedule but is off today -> Show "Libre"
                                            // 3. If user is working -> Show Time

                                            let cellContent = <span className="text-gray-400">-</span>;
                                            let cellClass = "bg-gray-50/30"; // Default empty feel

                                            if (hasAnySchedule) {
                                                if (scheduleInfo.isAvailable) {
                                                    cellContent = <span>{scheduleInfo.text}</span>;
                                                    cellClass = "text-gray-900 font-medium bg-green-50/30"; // Subtle green tint for working days
                                                } else {
                                                    cellContent = <span className="italic">Libre</span>;
                                                    cellClass = "text-gray-400 bg-gray-50"; // Dimmed for days off
                                                }
                                            }

                                            return (
                                                <td
                                                    key={day.id}
                                                    className={cn('px-3 py-3 text-center text-xs border-l border-gray-100', cellClass)}
                                                >
                                                    {cellContent}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY SCHEDULE TAB (TECHNICIAN VIEW)
// ═══════════════════════════════════════════════════════════════════════════════

export function MyScheduleTab({ userId }: { userId?: string }) {
    const { data: scheduleData, isLoading } = useQuery({
        queryKey: ['my-schedule', userId],
        queryFn: async () => {
            const res = await fetch(`/api/employees/schedule?userId=${userId}`);
            if (!res.ok) throw new Error('Error fetching schedule');
            return res.json();
        },
        enabled: !!userId,
    });

    const schedules = scheduleData?.data?.schedules || [];
    const exceptions = scheduleData?.data?.exceptions || [];

    if (isLoading) {
        return (
            <div className="card p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Cargando tu horario...</p>
            </div>
        );
    }

    const getScheduleForDay = (dayOfWeek: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const schedule = schedules.find((s: any) => s.dayOfWeek === dayOfWeek);
        if (schedule?.isAvailable) {
            return `${schedule.startTime} - ${schedule.endTime}`;
        }
        return 'No disponible';
    };

    return (
        <div className="space-y-6">
            {/* Weekly Schedule */}
            <div className="card overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-600" />
                        <h2 className="font-semibold text-gray-900">Mi Horario Semanal</h2>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        Tu horario es administrado por tu supervisor
                    </p>
                </div>
                <div className="divide-y">
                    {DAYS_OF_WEEK.map((day) => {
                        const schedule = getScheduleForDay(day.id);
                        const isAvailable = schedule !== 'No disponible';
                        return (
                            <div
                                key={day.id}
                                className={cn(
                                    'flex items-center justify-between px-4 py-3',
                                    !isAvailable && 'bg-gray-50'
                                )}
                            >
                                <span className={cn('font-medium', !isAvailable && 'text-gray-400')}>
                                    {day.name}
                                </span>
                                <span className={cn('text-sm', isAvailable ? 'text-gray-700' : 'text-gray-400')}>
                                    {schedule}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Upcoming Exceptions */}
            {exceptions.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-gray-600" />
                            <h2 className="font-semibold text-gray-900">Mis Excepciones Próximas</h2>
                        </div>
                    </div>
                    <div className="divide-y">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {exceptions.slice(0, 5).map((exception: any) => (
                            <div key={exception.id} className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {new Date(exception.date).toLocaleDateString('es-AR', {
                                                weekday: 'long',
                                                day: 'numeric',
                                                month: 'long',
                                            })}
                                        </p>
                                        <p className="text-sm text-gray-500">{exception.reason || 'Sin motivo'}</p>
                                    </div>
                                    <span
                                        className={cn(
                                            'px-2 py-1 rounded text-xs font-medium',
                                            exception.isAvailable
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-red-100 text-red-700'
                                        )}
                                    >
                                        {exception.isAvailable ? 'Horario especial' : 'No disponible'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPONIBILIDAD TAB (The Manager)
// Control center for Schedule & Exceptions
// ═══════════════════════════════════════════════════════════════════════════════

interface DisponibilidadTabProps {
    canEdit: boolean;
    members: TeamMember[];
}

export function DisponibilidadTab({ canEdit, members }: DisponibilidadTabProps) {
    const queryClient = useQueryClient();
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    return (
        <div className="space-y-4">
            {/* Control Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Gestión de Disponibilidad</h2>
                    <p className="text-sm text-gray-500">Configura horarios base y marca excepciones (vacaciones, enfermedades).</p>
                </div>
            </div>

            {/* Team Calendar for Exceptions - includes the schedule config button */}
            <TeamCalendar
                canEdit={canEdit}
                onOpenScheduleConfig={() => setShowScheduleModal(true)}
            />

            {/* Schedule Config Modal */}
            {showScheduleModal && (
                <ScheduleConfigModal
                    members={members}
                    onClose={() => setShowScheduleModal(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['all-schedules'] });
                        queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
                        queryClient.invalidateQueries({ queryKey: ['user-live-status'] });
                        setShowScheduleModal(false);
                    }}
                />
            )}
        </div>
    );
}

export default DisponibilidadTab;
