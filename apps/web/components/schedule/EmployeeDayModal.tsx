'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    Plus,
    AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/lib/timezone';

// Types
interface Employee {
    id: string;
    name: string;
    role: string;
}

interface ScheduleException {
    id: string;
    userId: string;
    date: string;
    isAvailable: boolean;
    reason: string | null;
    startTime: string | null;
    endTime: string | null;
}

interface EmployeeDayModalProps {
    employee: Employee;
    date: Date;
    exceptions: ScheduleException[];  // All exceptions for this day
    baseStartTime?: string | null;    // Base work schedule
    baseEndTime?: string | null;
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

const format12h = (time24: string): string => {
    const parsed = parse12hTime(time24);
    return `${parsed.time} ${parsed.period}`;
};

// Time Input Component
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
    exceptions,
    baseStartTime,
    baseEndTime,
    onClose,
    onUpdate,
}: EmployeeDayModalProps) {
    const queryClient = useQueryClient();
    const [isVisible, setIsVisible] = useState(false);

    // Mode: 'view' | 'add' | 'edit-work' | 'edit-exception'
    const [mode, setMode] = useState<'view' | 'add' | 'edit-work' | 'edit-exception'>('view');
    const [editingExceptionId, setEditingExceptionId] = useState<string | null>(null);

    // Full day toggle for new exceptions
    const [isFullDay, setIsFullDay] = useState(true);
    const [selectedExceptionType, setSelectedExceptionType] = useState<string | null>(null);

    // Error message from API
    const [apiError, setApiError] = useState<string | null>(null);

    // 12h format state for work schedule editing
    const [workStartTime, setWorkStartTime] = useState(() => parse12hTime(baseStartTime || '09:00'));
    const [workEndTime, setWorkEndTime] = useState(() => parse12hTime(baseEndTime || '18:00'));

    // 12h format state for exception time editing
    const [exceptionStartTime, setExceptionStartTime] = useState({ time: '10:00', period: 'AM' as 'AM' | 'PM' });
    const [exceptionEndTime, setExceptionEndTime] = useState({ time: '2:00', period: 'PM' as 'AM' | 'PM' });

    // Track if component is mounted (for SSR safety with portal)
    const [mounted, setMounted] = useState(false);

    // Animation and scroll lock
    useEffect(() => {
        setMounted(true);
        requestAnimationFrame(() => setIsVisible(true));
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Reset times when props change
    useEffect(() => {
        setWorkStartTime(parse12hTime(baseStartTime || '09:00'));
        setWorkEndTime(parse12hTime(baseEndTime || '18:00'));
    }, [baseStartTime, baseEndTime]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 200);
    };

    // Create exception mutation
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
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || 'Error al crear excepción');
            }
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
            onUpdate();
            setMode('view');
            setSelectedExceptionType(null);
            setEditingExceptionId(null);
            setApiError(null);
        },
        onError: (error: Error) => {
            setApiError(error.message);
        },
    });

    // Delete exception mutation
    const deleteExceptionMutation = useMutation({
        mutationFn: async (exceptionId: string) => {
            const res = await fetch(`/api/employees/schedule/exceptions?id=${exceptionId}`, {
                method: 'DELETE',
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || 'Error al eliminar excepción');
            }
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
            onUpdate();
            setApiError(null);
        },
        onError: (error: Error) => {
            setApiError(error.message);
        },
    });

    const dateStr = date.toISOString().split('T')[0];
    const isLoading = createExceptionMutation.isPending || deleteExceptionMutation.isPending;

    // Check if there's a full-day exception
    const fullDayException = exceptions.find(e => !e.startTime || !e.endTime);
    const partialExceptions = exceptions.filter(e => e.startTime && e.endTime);

    // Handle adding new exception
    const handleAddException = () => {
        if (!selectedExceptionType) return;

        setApiError(null);

        if (isFullDay) {
            createExceptionMutation.mutate({
                userId: employee.id,
                date: dateStr,
                isAvailable: false,
                reason: selectedExceptionType,
            });
        } else {
            createExceptionMutation.mutate({
                userId: employee.id,
                date: dateStr,
                isAvailable: false,
                reason: selectedExceptionType,
                startTime: convertTo24h(exceptionStartTime.time, exceptionStartTime.period),
                endTime: convertTo24h(exceptionEndTime.time, exceptionEndTime.period),
            });
        }
    };

    // Handle saving work hours modification
    const handleSaveWorkHours = () => {
        setApiError(null);
        createExceptionMutation.mutate({
            userId: employee.id,
            date: dateStr,
            isAvailable: true,
            reason: 'Horario Modificado',
            startTime: convertTo24h(workStartTime.time, workStartTime.period),
            endTime: convertTo24h(workEndTime.time, workEndTime.period),
        });
    };

    // Handle updating existing exception times
    const handleUpdateException = (exc: ScheduleException) => {
        setApiError(null);

        // First delete the old exception, then create new one
        deleteExceptionMutation.mutate(exc.id, {
            onSuccess: () => {
                if (isFullDay) {
                    createExceptionMutation.mutate({
                        userId: employee.id,
                        date: dateStr,
                        isAvailable: false,
                        reason: exc.reason || 'Franco / Ausente',
                    });
                } else {
                    createExceptionMutation.mutate({
                        userId: employee.id,
                        date: dateStr,
                        isAvailable: false,
                        reason: exc.reason || 'Franco / Ausente',
                        startTime: convertTo24h(exceptionStartTime.time, exceptionStartTime.period),
                        endTime: convertTo24h(exceptionEndTime.time, exceptionEndTime.period),
                    });
                }
            },
        });
    };

    const handleDeleteException = (exceptionId: string) => {
        setApiError(null);
        deleteExceptionMutation.mutate(exceptionId);
    };

    // Start editing an exception
    const startEditException = (exc: ScheduleException) => {
        setEditingExceptionId(exc.id);
        if (exc.startTime && exc.endTime) {
            setExceptionStartTime(parse12hTime(exc.startTime));
            setExceptionEndTime(parse12hTime(exc.endTime));
            setIsFullDay(false);
        } else {
            setIsFullDay(true);
        }
        setMode('edit-exception');
    };

    // Get exception type config
    const getExceptionTypeConfig = (reason: string | null) => {
        return EXCEPTION_TYPES.find(t => t.reason === reason) || EXCEPTION_TYPES[3]; // default to dayoff
    };

    // Don't render until mounted (SSR safety)
    if (!mounted) return null;

    return createPortal(
        <div
            className={cn(
                'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200',
                isVisible ? 'bg-black/60' : 'bg-transparent pointer-events-none'
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

                    {/* Error Message */}
                    {apiError && (
                        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{apiError}</p>
                        </div>
                    )}

                    {/* Work Schedule Section */}
                    {baseStartTime && baseEndTime && mode !== 'edit-work' && (
                        <div className="p-4 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-700 mb-2">Horario de trabajo</p>
                            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                <span className="text-sm text-gray-700 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    {format12h(baseStartTime)} - {format12h(baseEndTime)}
                                </span>
                                <button
                                    onClick={() => setMode('edit-work')}
                                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors"
                                >
                                    <Pencil className="h-3 w-3" />
                                    Modificar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Work Schedule Edit Mode */}
                    {mode === 'edit-work' && (
                        <div className="p-4 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-700 mb-3">Modificar horario de trabajo</p>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="grid gap-4 sm:grid-cols-2 mb-4">
                                    <TimeInput
                                        label="Entrada"
                                        time={workStartTime.time}
                                        period={workStartTime.period}
                                        onTimeChange={(t) => setWorkStartTime({ ...workStartTime, time: t })}
                                        onPeriodChange={(p) => setWorkStartTime({ ...workStartTime, period: p })}
                                    />
                                    <TimeInput
                                        label="Salida"
                                        time={workEndTime.time}
                                        period={workEndTime.period}
                                        onTimeChange={(t) => setWorkEndTime({ ...workEndTime, time: t })}
                                        onPeriodChange={(p) => setWorkEndTime({ ...workEndTime, period: p })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setMode('view'); setApiError(null); }}
                                        className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveWorkHours}
                                        disabled={isLoading}
                                        className="flex-1 px-3 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                        <Check className="h-4 w-4" />
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Current Exceptions List - always show when not editing a specific exception */}
                    {exceptions.length > 0 && mode !== 'edit-exception' && (
                        <div className="p-4 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-700 mb-3">
                                Excepciones activas ({exceptions.length})
                            </p>
                            <div className="space-y-2">
                                {exceptions.map((exc) => {
                                    const typeConfig = getExceptionTypeConfig(exc.reason);
                                    const Icon = typeConfig.icon;
                                    const isPartial = exc.startTime && exc.endTime;

                                    return (
                                        <div
                                            key={exc.id}
                                            className={cn(
                                                'p-3 rounded-lg border flex items-center gap-3',
                                                typeConfig.borderColor,
                                                typeConfig.iconBg
                                            )}
                                        >
                                            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center bg-white/50')}>
                                                <Icon className={cn('h-5 w-5', typeConfig.iconColor)} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">{typeConfig.label}</p>
                                                <p className="text-sm text-gray-600">
                                                    {isPartial ? `${format12h(exc.startTime!)} - ${format12h(exc.endTime!)}` : 'Todo el día'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => startEditException(exc)}
                                                    className="p-2 text-gray-500 hover:text-teal-600 hover:bg-white rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteException(exc.id)}
                                                    disabled={isLoading}
                                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Edit Exception Mode */}
                    {mode === 'edit-exception' && editingExceptionId && (
                        <div className="p-4 border-b border-gray-100">
                            {(() => {
                                const exc = exceptions.find(e => e.id === editingExceptionId);
                                if (!exc) return null;
                                const typeConfig = getExceptionTypeConfig(exc.reason);

                                return (
                                    <>
                                        <p className="text-sm font-medium text-gray-700 mb-3">
                                            Editar {typeConfig.label}
                                        </p>
                                        <div className={cn('p-4 rounded-lg border', typeConfig.borderColor, typeConfig.iconBg)}>
                                            {/* Full Day Toggle */}
                                            <label className="flex items-center justify-between cursor-pointer mb-4">
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

                                            {/* Hours Editor */}
                                            {!isFullDay && (
                                                <div className="mb-4">
                                                    <p className="text-sm font-medium text-gray-700 mb-2">Horas de ausencia</p>
                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        <TimeInput
                                                            label="Desde"
                                                            time={exceptionStartTime.time}
                                                            period={exceptionStartTime.period}
                                                            onTimeChange={(t) => setExceptionStartTime({ ...exceptionStartTime, time: t })}
                                                            onPeriodChange={(p) => setExceptionStartTime({ ...exceptionStartTime, period: p })}
                                                        />
                                                        <TimeInput
                                                            label="Hasta"
                                                            time={exceptionEndTime.time}
                                                            period={exceptionEndTime.period}
                                                            onTimeChange={(t) => setExceptionEndTime({ ...exceptionEndTime, time: t })}
                                                            onPeriodChange={(p) => setExceptionEndTime({ ...exceptionEndTime, period: p })}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setMode('view'); setEditingExceptionId(null); setApiError(null); }}
                                                    className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateException(exc)}
                                                    disabled={isLoading}
                                                    className="flex-1 px-3 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    Guardar
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* Add Exception Mode */}
                    {mode === 'add' && (
                        <div className="p-4 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-700 mb-3">Agregar excepción</p>

                            {/* Exception Type Selection */}
                            <div className="space-y-2 mb-4">
                                {EXCEPTION_TYPES.map((type) => {
                                    const Icon = type.icon;
                                    const isSelected = selectedExceptionType === type.reason;

                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => setSelectedExceptionType(type.reason)}
                                            className={cn(
                                                'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors',
                                                isSelected
                                                    ? `border-2 ${type.borderColor} ${type.iconBg}`
                                                    : `${type.borderColor} ${type.hoverBg}`
                                            )}
                                        >
                                            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', type.iconBg)}>
                                                <Icon className={cn('h-5 w-5', type.iconColor)} />
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-medium text-gray-900">{type.label}</p>
                                                <p className="text-sm text-gray-500">{type.description}</p>
                                            </div>
                                            {isSelected && <Check className="h-5 w-5 text-green-600" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Time Configuration */}
                            {selectedExceptionType && (
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
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

                                    {/* Hours Selection */}
                                    {!isFullDay && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium text-gray-700 mb-2">Horas de ausencia</p>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <TimeInput
                                                    label="Desde"
                                                    time={exceptionStartTime.time}
                                                    period={exceptionStartTime.period}
                                                    onTimeChange={(t) => setExceptionStartTime({ ...exceptionStartTime, time: t })}
                                                    onPeriodChange={(p) => setExceptionStartTime({ ...exceptionStartTime, period: p })}
                                                />
                                                <TimeInput
                                                    label="Hasta"
                                                    time={exceptionEndTime.time}
                                                    period={exceptionEndTime.period}
                                                    onTimeChange={(t) => setExceptionEndTime({ ...exceptionEndTime, time: t })}
                                                    onPeriodChange={(p) => setExceptionEndTime({ ...exceptionEndTime, period: p })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setMode('view'); setSelectedExceptionType(null); setApiError(null); }}
                                    className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddException}
                                    disabled={isLoading || !selectedExceptionType}
                                    className="flex-1 px-3 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    <Check className="h-4 w-4" />
                                    Agregar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Add Exception Button (in view mode) */}
                    {mode === 'view' && !fullDayException && (
                        <div className="p-4">
                            <button
                                onClick={() => { setMode('add'); setApiError(null); }}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Agregar excepción
                            </button>
                            {partialExceptions.length > 0 && (
                                <p className="text-xs text-gray-500 text-center mt-2">
                                    Las excepciones no pueden superponerse en horario
                                </p>
                            )}
                        </div>
                    )}

                    {/* Full day exception notice */}
                    {mode === 'view' && fullDayException && (
                        <div className="p-4">
                            <p className="text-sm text-gray-500 text-center">
                                Elimine la excepción de día completo para agregar ausencias parciales
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
        </div>,
        document.body
    );
}
