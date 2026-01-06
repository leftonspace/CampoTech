/**
 * Vehicle Schedule Management Page
 * ==================================
 *
 * Phase 2.1 Task 2.1.5: Create Vehicle Scheduling UI
 *
 * This page allows dispatchers and owners to manage vehicle assignments
 * for technicians with support for:
 * - Default (permanent) vehicle assignments
 * - Date-range specific assignments
 * - Recurring (day-of-week) assignments
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Truck, Plus, Calendar, Clock, Repeat, Trash2, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

// Days of week configuration (0=Sunday, 6=Saturday)
const DAYS_OF_WEEK = [
    { value: 0, label: 'Dom', fullLabel: 'Domingo' },
    { value: 1, label: 'Lun', fullLabel: 'Lunes' },
    { value: 2, label: 'Mar', fullLabel: 'Martes' },
    { value: 3, label: 'Mié', fullLabel: 'Miércoles' },
    { value: 4, label: 'Jue', fullLabel: 'Jueves' },
    { value: 5, label: 'Vie', fullLabel: 'Viernes' },
    { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

type ScheduleType = 'PERMANENT' | 'DATE_RANGE' | 'RECURRING';

interface VehicleSchedule {
    id: string;
    vehicleId: string;
    scheduleType: ScheduleType;
    startDate?: string;
    endDate?: string;
    timeStart?: string;
    timeEnd?: string;
    daysOfWeek: number[];
    priority: number;
    vehicle: {
        id: string;
        plateNumber: string;
        make: string;
        model: string;
    };
}

interface Vehicle {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    status: string;
}

export default function VehicleSchedulePage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const userId = params.userId as string;

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<VehicleSchedule | null>(null);
    const [error, setError] = useState('');

    // Fetch user info
    const { data: userData } = useQuery({
        queryKey: ['user', userId],
        queryFn: async () => {
            const res = await fetch(`/api/users/${userId}`);
            return res.json();
        },
    });

    // Fetch schedules for this user
    const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
        queryKey: ['vehicle-schedules', userId],
        queryFn: async () => {
            const res = await fetch(`/api/scheduling/vehicle-assignment?userId=${userId}`);
            return res.json();
        },
    });

    // Fetch available vehicles
    const { data: vehiclesData } = useQuery({
        queryKey: ['vehicles'],
        queryFn: async () => {
            const res = await fetch('/api/vehicles');
            return res.json();
        },
    });

    // Create schedule mutation
    const createSchedule = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            const res = await fetch('/api/scheduling/vehicle-assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, userId }),
            });
            return res.json();
        },
        onSuccess: (data) => {
            if (data.success) {
                queryClient.invalidateQueries({ queryKey: ['vehicle-schedules', userId] });
                setShowCreateModal(false);
                setError('');
            } else {
                setError(data.error || 'Error creando horario');
            }
        },
    });

    // Delete schedule mutation
    const deleteSchedule = useMutation({
        mutationFn: async (scheduleId: string) => {
            const res = await fetch(`/api/scheduling/vehicle-assignment?scheduleId=${scheduleId}`, {
                method: 'DELETE',
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vehicle-schedules', userId] });
        },
    });

    const user = userData?.data;
    const schedules = (schedulesData?.schedules || []) as VehicleSchedule[];
    const vehicles = (vehiclesData?.data || []) as Vehicle[];

    // Group schedules by type
    const permanentSchedule = schedules.find(s => s.scheduleType === 'PERMANENT');
    const dateRangeSchedules = schedules.filter(s => s.scheduleType === 'DATE_RANGE');
    const recurringSchedules = schedules.filter(s => s.scheduleType === 'RECURRING');

    const getScheduleTypeLabel = (type: ScheduleType) => {
        switch (type) {
            case 'PERMANENT': return 'Predeterminado';
            case 'DATE_RANGE': return 'Por fechas';
            case 'RECURRING': return 'Recurrente';
        }
    };

    const formatDaysOfWeek = (days: number[]) => {
        if (!days || days.length === 0) return '';
        if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) {
            return 'Lun-Vie';
        }
        if (days.length === 7) {
            return 'Todos los días';
        }
        return days.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).filter(Boolean).join(', ');
    };

    if (schedulesLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Horarios de Vehículo
                        </h1>
                        <p className="text-gray-500">
                            {user?.name || 'Técnico'} - Gestionar asignaciones de vehículos
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Nueva Asignación
                </button>
            </div>

            {/* Default Vehicle Section */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Truck className="h-5 w-5 text-gray-500" />
                    Vehículo Predeterminado
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    Este vehículo se asignará automáticamente a menos que haya una asignación más específica.
                </p>

                {permanentSchedule ? (
                    <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-green-200 p-2">
                                <Truck className="h-5 w-5 text-green-700" />
                            </div>
                            <div>
                                <p className="font-medium text-green-900">
                                    {permanentSchedule.vehicle.make} {permanentSchedule.vehicle.model}
                                </p>
                                <p className="text-sm text-green-700">
                                    Patente: {permanentSchedule.vehicle.plateNumber}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => deleteSchedule.mutate(permanentSchedule.id)}
                            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                        <Truck className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-gray-500 mb-3">No hay vehículo predeterminado asignado</p>
                        <button
                            onClick={() => {
                                setEditingSchedule(null);
                                setShowCreateModal(true);
                            }}
                            className="text-sm text-primary-600 hover:underline"
                        >
                            + Asignar vehículo predeterminado
                        </button>
                    </div>
                )}
            </div>

            {/* Schedule-Based Assignments */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    Asignaciones por Horario
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    Estas asignaciones tienen prioridad sobre el vehículo predeterminado.
                </p>

                {(dateRangeSchedules.length > 0 || recurringSchedules.length > 0) ? (
                    <div className="space-y-3">
                        {/* Date Range Schedules */}
                        {dateRangeSchedules.map((schedule) => (
                            <div
                                key={schedule.id}
                                className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full bg-blue-200 p-2">
                                        <Calendar className="h-5 w-5 text-blue-700" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-blue-900">
                                            {schedule.vehicle.make} {schedule.vehicle.model} - {schedule.vehicle.plateNumber}
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            {schedule.startDate && new Date(schedule.startDate).toLocaleDateString('es-AR')}
                                            {schedule.endDate ? ` - ${new Date(schedule.endDate).toLocaleDateString('es-AR')}` : ' (sin fecha fin)'}
                                            {schedule.timeStart && ` | ${schedule.timeStart} - ${schedule.timeEnd}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-800">
                                        Por fechas
                                    </span>
                                    <button
                                        onClick={() => deleteSchedule.mutate(schedule.id)}
                                        className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Recurring Schedules */}
                        {recurringSchedules.map((schedule) => (
                            <div
                                key={schedule.id}
                                className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="rounded-full bg-purple-200 p-2">
                                        <Repeat className="h-5 w-5 text-purple-700" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-purple-900">
                                            {schedule.vehicle.make} {schedule.vehicle.model} - {schedule.vehicle.plateNumber}
                                        </p>
                                        <p className="text-sm text-purple-700">
                                            {formatDaysOfWeek(schedule.daysOfWeek)}
                                            {schedule.timeStart && ` | ${schedule.timeStart} - ${schedule.timeEnd}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs font-medium text-purple-800">
                                        Recurrente
                                    </span>
                                    <button
                                        onClick={() => deleteSchedule.mutate(schedule.id)}
                                        className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                        <Calendar className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-gray-500">No hay asignaciones por horario</p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <CreateScheduleModal
                    vehicles={vehicles}
                    userId={userId}
                    onClose={() => {
                        setShowCreateModal(false);
                        setError('');
                    }}
                    onSubmit={(data) => createSchedule.mutate(data)}
                    isLoading={createSchedule.isPending}
                    error={error}
                />
            )}
        </div>
    );
}

// Create Schedule Modal Component
function CreateScheduleModal({
    vehicles,
    userId,
    onClose,
    onSubmit,
    isLoading,
    error,
}: {
    vehicles: Vehicle[];
    userId: string;
    onClose: () => void;
    onSubmit: (data: Record<string, unknown>) => void;
    isLoading: boolean;
    error: string;
}) {
    const [scheduleType, setScheduleType] = useState<ScheduleType>('PERMANENT');
    const [vehicleId, setVehicleId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [timeStart, setTimeStart] = useState('');
    const [timeEnd, setTimeEnd] = useState('');
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default

    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day].sort((a, b) => a - b)
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicleId) return;

        const data: Record<string, unknown> = {
            vehicleId,
            scheduleType,
        };

        if (scheduleType === 'DATE_RANGE' || scheduleType === 'RECURRING') {
            if (startDate) data.startDate = startDate;
            if (endDate) data.endDate = endDate;
            if (timeStart) data.timeStart = timeStart;
            if (timeEnd) data.timeEnd = timeEnd;
        }

        if (scheduleType === 'RECURRING') {
            data.daysOfWeek = selectedDays;
        }

        onSubmit(data);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Nueva Asignación de Vehículo
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Vehicle Selection */}
                    <div>
                        <label className="label mb-1 block">Vehículo *</label>
                        <select
                            value={vehicleId}
                            onChange={(e) => setVehicleId(e.target.value)}
                            className="input"
                            required
                        >
                            <option value="">Seleccionar vehículo...</option>
                            {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.make} {v.model} - {v.plateNumber}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Schedule Type */}
                    <div>
                        <label className="label mb-2 block">Tipo de horario</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['PERMANENT', 'DATE_RANGE', 'RECURRING'] as ScheduleType[]).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setScheduleType(type)}
                                    className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${scheduleType === type
                                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {type === 'PERMANENT' && <Truck className="mx-auto h-5 w-5 mb-1" />}
                                    {type === 'DATE_RANGE' && <Calendar className="mx-auto h-5 w-5 mb-1" />}
                                    {type === 'RECURRING' && <Repeat className="mx-auto h-5 w-5 mb-1" />}
                                    {type === 'PERMANENT' && 'Predeterminado'}
                                    {type === 'DATE_RANGE' && 'Por Fechas'}
                                    {type === 'RECURRING' && 'Recurrente'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date Range Fields */}
                    {(scheduleType === 'DATE_RANGE' || scheduleType === 'RECURRING') && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label mb-1 block text-sm">Desde</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="label mb-1 block text-sm">Hasta (opcional)</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={startDate}
                                    className="input"
                                />
                            </div>
                        </div>
                    )}

                    {/* Time Fields */}
                    {(scheduleType === 'DATE_RANGE' || scheduleType === 'RECURRING') && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label mb-1 block text-sm">Hora inicio</label>
                                <input
                                    type="time"
                                    value={timeStart}
                                    onChange={(e) => setTimeStart(e.target.value)}
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="label mb-1 block text-sm">Hora fin</label>
                                <input
                                    type="time"
                                    value={timeEnd}
                                    onChange={(e) => setTimeEnd(e.target.value)}
                                    className="input"
                                />
                            </div>
                        </div>
                    )}

                    {/* Days of Week */}
                    {scheduleType === 'RECURRING' && (
                        <div>
                            <label className="label mb-2 block">Días de la semana</label>
                            <div className="flex flex-wrap gap-2">
                                {DAYS_OF_WEEK.map((day) => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => toggleDay(day.value)}
                                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${selectedDays.includes(day.value)
                                                ? 'bg-primary-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-outline flex-1"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!vehicleId || isLoading}
                            className="btn-primary flex-1"
                        >
                            {isLoading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
