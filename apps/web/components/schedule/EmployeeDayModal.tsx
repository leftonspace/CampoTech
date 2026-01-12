'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    X,
    Palmtree,
    Thermometer,
    Coffee,
    Clock,
    Trash2,
    Check,
    User,
    Calendar,
    GraduationCap,
    Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/lib/timezone';

// Types
interface Employee {
    id: string;
    name: string;
    role: string;
}

interface EmployeeDayModalProps {
    employee: Employee;
    date: Date;
    currentStatus: string;
    currentReason: string | null;
    startTime: string | null;
    endTime: string | null;
    baseStartTime?: string | null; // Base schedule for comparison
    baseEndTime?: string | null;
    hasException: boolean;
    exceptionId?: string;
    onClose: () => void;
    onUpdate: () => void;
}

// Argentine Labor Law Exception Types
const EXCEPTION_TYPES = [
    {
        id: 'vacation',
        reason: 'Vacaciones',
        label: 'Vacaciones',
        description: 'Licencia por vacaciones (PTO)',
        icon: Palmtree,
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
        borderColor: 'border-yellow-200',
        hoverBg: 'hover:bg-yellow-50',
    },
    {
        id: 'sick',
        reason: 'Enfermedad',
        label: 'Enfermedad',
        description: 'Licencia por enfermedad',
        icon: Thermometer,
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        borderColor: 'border-orange-200',
        hoverBg: 'hover:bg-orange-50',
    },
    {
        id: 'study',
        reason: 'Examen / Estudio',
        label: 'Examen / Estudio',
        description: 'Licencia por examen o estudio',
        icon: GraduationCap,
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        borderColor: 'border-purple-200',
        hoverBg: 'hover:bg-purple-50',
    },
    {
        id: 'dayoff',
        reason: 'Franco / Ausente',
        label: 'Franco / Ausente',
        description: 'Franco o ausencia sin goce de sueldo',
        icon: Coffee,
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600',
        borderColor: 'border-gray-200',
        hoverBg: 'hover:bg-gray-50',
    },
];

// Status config for display
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    available: {
        label: 'Disponible',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
    },
    special: {
        label: 'Horario Modificado',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
    },
    vacation: {
        label: 'Vacaciones',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
    },
    sick: {
        label: 'Enfermedad',
        color: 'text-orange-700',
        bgColor: 'bg-orange-100',
    },
    study: {
        label: 'Examen / Estudio',
        color: 'text-purple-700',
        bgColor: 'bg-purple-100',
    },
    dayoff: {
        label: 'Franco / Ausente',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
    },
};

// Helper functions for 12h/24h conversion
const parse12hTime = (time24: string): { time: string; period: 'AM' | 'PM' } => {
    if (!time24) return { time: '9:00', period: 'AM' };
    const [hours, minutes] = time24.split(':').map(Number);
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
    let h = hours % 12;
    if (h === 0) h = 12;
    return { time: `${h}:${String(minutes).padStart(2, '0')}`, period };
};

const convertTo24h = (time12: string, period: 'AM' | 'PM'): string => {
    if (!time12) return '';
    const parts = time12.split(':');
    let hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    if (hours > 12) hours = hours % 12 || 12;
    let h = hours;
    if (period === 'PM' && hours !== 12) h += 12;
    if (period === 'AM' && hours === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Time Input Component (matching job creation form style)
interface TimeInputProps {
    label: string;
    time: string;
    period: 'AM' | 'PM';
    onTimeChange: (time: string) => void;
    onPeriodChange: (period: 'AM' | 'PM') => void;
}

function TimeInput({ label, time, period, onTimeChange, onPeriodChange }: TimeInputProps) {
    return (
        <div className="flex-1">
            <label className="label mb-1 block text-sm">{label}</label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="9:00"
                        value={time}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
                            onTimeChange(val);
                        }}
                        className="input pl-10"
                        maxLength={5}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => onPeriodChange(period === 'AM' ? 'PM' : 'AM')}
                    className="flex h-[42px] w-14 items-center justify-center rounded-lg border-2 border-primary-500 bg-primary-50 font-semibold text-primary-700 text-sm"
                >
                    {period}
                </button>
            </div>
        </div>
    );
}

export default function EmployeeDayModal({
    employee,
    date,
    currentStatus,
    currentReason,
    startTime,
    endTime,
    baseStartTime,
    baseEndTime,
    hasException,
    exceptionId,
    onClose,
    onUpdate,
}: EmployeeDayModalProps) {
    const queryClient = useQueryClient();
    const [isVisible, setIsVisible] = useState(false);
    const [isEditingHours, setIsEditingHours] = useState(false);

    // Full day toggle for exceptions
    const [isFullDay, setIsFullDay] = useState(true);
    const [selectedExceptionType, setSelectedExceptionType] = useState<string | null>(null);

    // 12h format state for available status editing
    const [editTime, setEditTime] = useState(() => parse12hTime(startTime || baseStartTime || '09:00'));
    const [editEndTimeState, setEditEndTimeState] = useState(() => parse12hTime(endTime || baseEndTime || '18:00'));

    // 12h format state for partial absence - hours ABSENT (simpler than tracking work hours)
    const [absentStartTime, setAbsentStartTime] = useState({ time: '10:00', period: 'AM' as 'AM' | 'PM' });
    const [absentEndTime, setAbsentEndTime] = useState({ time: '2:00', period: 'PM' as 'AM' | 'PM' });

    // Check if hours are modified from base schedule
    const isHoursModified = useMemo(() => {
        if (!baseStartTime || !baseEndTime) return false;
        const currentStart = convertTo24h(editTime.time, editTime.period);
        const currentEnd = convertTo24h(editEndTimeState.time, editEndTimeState.period);
        return currentStart !== baseStartTime || currentEnd !== baseEndTime;
    }, [editTime, editEndTimeState, baseStartTime, baseEndTime]);

    // Determine if time can be edited (only when available/working)
    const isTimeEditable = currentStatus === 'available' || currentStatus === 'special';

    // Check if current status is an exception (not available)
    const isExceptionStatus = ['vacation', 'sick', 'study', 'dayoff'].includes(currentStatus);

    // Animation and scroll lock
    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Initialize times when props change
    useEffect(() => {
        const start = startTime || baseStartTime || '09:00';
        const end = endTime || baseEndTime || '18:00';
        setEditTime(parse12hTime(start));
        setEditEndTimeState(parse12hTime(end));
        // Check if current exception has hours (partial absence)
        if (hasException && startTime && endTime) {
            setIsFullDay(false);
            setAbsentStartTime(parse12hTime(startTime));
            setAbsentEndTime(parse12hTime(endTime));
        }
    }, [startTime, endTime, baseStartTime, baseEndTime, hasException]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 200);
    };

    // Create/Update exception mutation
    const createExceptionMutation = useMutation({
        mutationFn: async (data: {
            userId: string;
            date: string;
            isAvailable: boolean;
            reason: string;
            startTime?: string;
            endTime?: string;
        }) => {
            const res = await fetch('/api/employees/schedule/exceptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Error al crear excepción');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
            onUpdate();
        },
    });

    // Delete exception mutation
    const deleteExceptionMutation = useMutation({
        mutationFn: async (exceptionIdToDelete: string) => {
            const res = await fetch(`/api/employees/schedule/exceptions?id=${exceptionIdToDelete}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Error al eliminar excepción');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
            onUpdate();
        },
    });

    const dateStr = date.toISOString().split('T')[0];
    const isLoading = createExceptionMutation.isPending || deleteExceptionMutation.isPending;

    // Handle exception type selection
    const handleSetException = (reason: string) => {
        if (isFullDay) {
            // Full day absence - no hours
            createExceptionMutation.mutate({
                userId: employee.id,
                date: dateStr,
                isAvailable: false,
                reason,
            });
        } else {
            // Partial absence - include hours absent
            createExceptionMutation.mutate({
                userId: employee.id,
                date: dateStr,
                isAvailable: false,
                reason,
                startTime: convertTo24h(absentStartTime.time, absentStartTime.period),
                endTime: convertTo24h(absentEndTime.time, absentEndTime.period),
            });
        }
        setSelectedExceptionType(null);
    };

    // Handle clicking an exception type button
    const handleExceptionClick = (reason: string) => {
        if (currentReason === reason) return; // Already selected
        setSelectedExceptionType(reason);
        setIsFullDay(true); // Default to full day
    };

    // Confirm exception after setting full day toggle
    const handleConfirmException = () => {
        if (selectedExceptionType) {
            handleSetException(selectedExceptionType);
        }
    };

    // Handle saving modified hours (for available status)
    const handleSaveHours = () => {
        createExceptionMutation.mutate({
            userId: employee.id,
            date: dateStr,
            isAvailable: true,
            reason: 'Horario Modificado',
            startTime: convertTo24h(editTime.time, editTime.period),
            endTime: convertTo24h(editEndTimeState.time, editEndTimeState.period),
        });
        setIsEditingHours(false);
    };

    const handleCancelEdit = () => {
        const start = startTime || baseStartTime || '09:00';
        const end = endTime || baseEndTime || '18:00';
        setEditTime(parse12hTime(start));
        setEditEndTimeState(parse12hTime(end));
        setIsEditingHours(false);
    };

    const handleCancelException = () => {
        setSelectedExceptionType(null);
        setIsFullDay(true);
    };

    const handleDeleteException = () => {
        if (exceptionId) {
            deleteExceptionMutation.mutate(exceptionId);
        }
    };

    const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.dayoff;
    const displayStartTime = startTime || baseStartTime || '09:00';
    const displayEndTime = endTime || baseEndTime || '18:00';
    const displayStart12h = parse12hTime(displayStartTime);
    const displayEnd12h = parse12hTime(displayEndTime);

    return (
        <div
            className={cn(
                'fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200',
                isVisible ? 'bg-black/50' : 'bg-transparent pointer-events-none'
            )}
            onClick={handleClose}
        >
            <div
                className={cn(
                    'bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-200 overflow-hidden',
                    isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Scrollable content wrapper */}
                <div className="max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">{employee.name}</h2>
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDisplayDate(date, {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                    })}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Current Status */}
                    <div className="p-4 border-b border-gray-100">
                        <p className="text-sm text-gray-500 mb-2">Estado actual</p>
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className={cn('px-3 py-1.5 rounded-full text-sm font-medium', statusConfig.bgColor, statusConfig.color)}>
                                {/* Show partial indicator or just the label */}
                                {isExceptionStatus && startTime && endTime
                                    ? `Parcial - ${statusConfig.label}`
                                    : statusConfig.label
                                }
                            </span>

                            {/* Inline time display with edit button */}
                            {baseStartTime && baseEndTime && !isEditingHours && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600 flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        {parse12hTime(baseStartTime).time} {parse12hTime(baseStartTime).period} - {parse12hTime(baseEndTime).time} {parse12hTime(baseEndTime).period}
                                    </span>
                                    <button
                                        onClick={() => setIsEditingHours(true)}
                                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        Editar
                                    </button>
                                </div>
                            )}

                            {hasException && currentStatus === 'special' && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    Horario Modificado
                                </span>
                            )}
                        </div>

                        {/* Inline time editor */}
                        {isEditingHours && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="grid gap-4 sm:grid-cols-2 mb-4">
                                    <TimeInput
                                        label="Entrada"
                                        time={editTime.time}
                                        period={editTime.period}
                                        onTimeChange={(t) => setEditTime({ ...editTime, time: t })}
                                        onPeriodChange={(p) => setEditTime({ ...editTime, period: p })}
                                    />
                                    <TimeInput
                                        label="Salida"
                                        time={editEndTimeState.time}
                                        period={editEndTimeState.period}
                                        onTimeChange={(t) => setEditEndTimeState({ ...editEndTimeState, time: t })}
                                        onPeriodChange={(p) => setEditEndTimeState({ ...editEndTimeState, period: p })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveHours}
                                        disabled={isLoading}
                                        className="flex-1 px-3 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                        <Check className="h-4 w-4" />
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Exception Types */}
                    <div className="p-4">
                        <p className="text-sm font-medium text-gray-700 mb-3">Marcar como ausente</p>

                        <div className="space-y-2">
                            {EXCEPTION_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isCurrentReason = currentReason === type.reason;
                                const isSelected = selectedExceptionType === type.reason;

                                // Determine description text: show absence hours if this is the active exception
                                const descriptionText = isCurrentReason && startTime && endTime
                                    ? `Ausente: ${parse12hTime(startTime).time} ${parse12hTime(startTime).period} - ${parse12hTime(endTime).time} ${parse12hTime(endTime).period}`
                                    : isCurrentReason && hasException
                                        ? 'Todo el día'
                                        : type.description;

                                return (
                                    <div key={type.id}>
                                        <button
                                            onClick={() => handleExceptionClick(type.reason)}
                                            disabled={isLoading || isCurrentReason}
                                            className={cn(
                                                'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors disabled:opacity-50',
                                                isCurrentReason
                                                    ? 'border-2 border-gray-400 bg-gray-50'
                                                    : isSelected
                                                        ? `border-2 ${type.borderColor} ${type.iconBg}`
                                                        : `${type.borderColor} ${type.hoverBg}`
                                            )}
                                        >
                                            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', type.iconBg)}>
                                                <Icon className={cn('h-5 w-5', type.iconColor)} />
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-medium text-gray-900">{type.label}</p>
                                                <p className={cn(
                                                    'text-sm',
                                                    isCurrentReason ? 'text-gray-700 font-medium' : 'text-gray-500'
                                                )}>
                                                    {descriptionText}
                                                </p>
                                            </div>
                                            {isCurrentReason && (
                                                <Check className="h-5 w-5 text-green-600" />
                                            )}
                                        </button>

                                        {/* Full Day Toggle + Hours Worked (when this exception is selected) */}
                                        {isSelected && (
                                            <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                {/* Full Day Toggle */}
                                                <label className="flex items-center justify-between cursor-pointer">
                                                    <span className="text-sm font-medium text-gray-700">Todo el día</span>
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={isFullDay}
                                                            onChange={(e) => setIsFullDay(e.target.checked)}
                                                            className="sr-only"
                                                        />
                                                        <div className={cn(
                                                            'w-11 h-6 rounded-full transition-colors',
                                                            isFullDay ? 'bg-teal-600' : 'bg-gray-300'
                                                        )}>
                                                            <div className={cn(
                                                                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                                                                isFullDay ? 'translate-x-5' : 'translate-x-0'
                                                            )} />
                                                        </div>
                                                    </div>
                                                </label>

                                                {/* Hours Absent (if not full day) */}
                                                {!isFullDay && (
                                                    <div className="mt-4">
                                                        <p className="text-sm font-medium text-gray-700 mb-2">Horas de ausencia</p>
                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <TimeInput
                                                                label="Salió a las"
                                                                time={absentStartTime.time}
                                                                period={absentStartTime.period}
                                                                onTimeChange={(t) => setAbsentStartTime({ ...absentStartTime, time: t })}
                                                                onPeriodChange={(p) => setAbsentStartTime({ ...absentStartTime, period: p })}
                                                            />
                                                            <TimeInput
                                                                label="Regresó a las"
                                                                time={absentEndTime.time}
                                                                period={absentEndTime.period}
                                                                onTimeChange={(t) => setAbsentEndTime({ ...absentEndTime, time: t })}
                                                                onPeriodChange={(p) => setAbsentEndTime({ ...absentEndTime, period: p })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Confirm/Cancel */}
                                                <div className="flex gap-2 mt-4">
                                                    <button
                                                        onClick={handleCancelException}
                                                        className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={handleConfirmException}
                                                        disabled={isLoading}
                                                        className="flex-1 px-3 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                                    >
                                                        <Check className="h-4 w-4" />
                                                        Confirmar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Delete Exception (if exists) */}
                    {hasException && exceptionId && (
                        <div className="p-4 border-t border-gray-100">
                            <button
                                onClick={handleDeleteException}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                <Trash2 className="h-4 w-4" />
                                Eliminar excepción
                            </button>
                            <p className="text-xs text-gray-500 text-center mt-2">
                                Volver al horario base configurado
                            </p>
                        </div>
                    )}
                </div>

                {/* Loading indicator */}
                {isLoading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                )}
            </div>
        </div >
    );
}
