'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    X,
    Calendar,
    RefreshCw,
    Phone,
    Pencil,
    Check,
    Plus,
    Trash2,
    Bell,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Employee {
    id: string;
    name: string;
    role: string;
}

interface ScheduleEntry {
    id?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}

interface ScheduleConfigModalProps {
    members: Employee[];
    initialEmployeeId?: string;
    onClose: () => void;
    onSuccess: () => void;
}

// Schedule type definitions
const SCHEDULE_TYPES = [
    {
        id: 'base',
        name: 'Horario Base',
        description: 'Horario fijo semanal',
        icon: Calendar,
    },
    {
        id: 'rotating',
        name: 'Turnos Rotativos',
        description: 'Mañana/Tarde/Noche',
        icon: RefreshCw,
    },
    {
        id: 'ondemand',
        name: 'A Demanda',
        description: 'Disponible cuando se llame',
        icon: Phone,
    },
    {
        id: 'custom',
        name: 'Personalizado',
        description: 'Configurar individualmente',
        icon: Pencil,
    },
];

// Days of week
const DAYS = [
    { id: 0, name: 'Domingo', short: 'Dom' },
    { id: 1, name: 'Lunes', short: 'Lun' },
    { id: 2, name: 'Martes', short: 'Mar' },
    { id: 3, name: 'Miércoles', short: 'Mié' },
    { id: 4, name: 'Jueves', short: 'Jue' },
    { id: 5, name: 'Viernes', short: 'Vie' },
    { id: 6, name: 'Sábado', short: 'Sáb' },
];

// Shift presets for rotating schedules
const SHIFT_PRESETS = [
    { id: 'morning', name: 'Mañana', startTime: '06:00', endTime: '14:00', color: 'bg-yellow-100 border-yellow-400 text-yellow-700' },
    { id: 'afternoon', name: 'Tarde', startTime: '14:00', endTime: '22:00', color: 'bg-orange-100 border-orange-400 text-orange-700' },
    { id: 'night', name: 'Noche', startTime: '22:00', endTime: '06:00', color: 'bg-indigo-100 border-indigo-400 text-indigo-700' },
];

// Helper to format and validate time input as user types
function formatTimeInput(value: string): string {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    if (digits.length === 0) return '';

    // Single digit - just return it (will be completed on blur)
    if (digits.length === 1) return digits;

    // Two digits - validate as hours (01-23)
    if (digits.length === 2) {
        let hours = parseInt(digits, 10);
        // Clamp hours to 0-23
        if (hours > 23) hours = 23;
        return hours.toString().padStart(2, '0');
    }

    // Three or four digits - split into hours:minutes
    if (digits.length >= 3) {
        let hours = parseInt(digits.slice(0, 2), 10);
        let mins = parseInt(digits.slice(2, 4) || '0', 10);

        // Clamp hours to 0-23, minutes to 0-59
        if (hours > 23) hours = 23;
        if (mins > 59) mins = 59;

        const minStr = digits.length >= 4
            ? mins.toString().padStart(2, '0')
            : digits.slice(2);

        return `${hours.toString().padStart(2, '0')}:${minStr}`;
    }

    return digits;
}

// Helper to complete partial time input (on blur) - keeps 24h format if entered
function completeTimeInput(value: string): string {
    if (!value || value === '') return '';

    // Remove non-digits for processing
    const digits = value.replace(/\D/g, '');

    if (digits.length === 0) return '';

    // Single digit → "0X:00"
    if (digits.length === 1) {
        const hour = parseInt(digits, 10);
        return `0${hour}:00`;
    }

    // Two digits → "XX:00" (keep 24h format)
    if (digits.length === 2) {
        let hours = parseInt(digits, 10);
        if (hours > 23) hours = 23;
        return `${hours.toString().padStart(2, '0')}:00`;
    }

    // Three digits → "XX:X0"
    if (digits.length === 3) {
        let hours = parseInt(digits.slice(0, 2), 10);
        let mins = parseInt(digits.slice(2) + '0', 10);
        if (hours > 23) hours = 23;
        if (mins > 59) mins = 59;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    // Four+ digits - already formatted, just validate (keep 24h format)
    if (value.includes(':')) {
        const [hourStr, minStr] = value.split(':');
        let hours = parseInt(hourStr, 10) || 0;
        let mins = parseInt(minStr, 10) || 0;
        if (hours > 23) hours = 23;
        if (mins > 59) mins = 59;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    return value;
}

// Helper to parse time and determine if it's PM (24h format)
// Does NOT convert display - keeps 24h as-is, just detects period
function parseTimeInfo(time: string): { display: string; is24Hour: boolean; period: 'AM' | 'PM' } {
    if (!time || !time.includes(':')) {
        return { display: time, is24Hour: false, period: 'AM' };
    }

    const [hourStr, _minStr] = time.split(':');
    const hour = parseInt(hourStr, 10);

    if (isNaN(hour)) {
        return { display: time, is24Hour: false, period: 'AM' };
    }

    // If hour is 13-23, it's 24h format (automatically PM) - keep display as-is
    if (hour >= 13 && hour <= 23) {
        return {
            display: time, // Keep original 24h format
            is24Hour: true,
            period: 'PM'
        };
    }

    // If hour is 0, it's 12 AM (midnight)
    if (hour === 0) {
        return {
            display: time, // Keep as 00:XX
            is24Hour: true,
            period: 'AM'
        };
    }

    // If hour is 12, check if it should be PM (noon)
    if (hour === 12) {
        return { display: time, is24Hour: false, period: 'PM' };
    }

    // 1-11 can be AM or PM (user toggles)
    return { display: time, is24Hour: false, period: 'AM' };
}

// Helper to convert display time + period to 24h format
function to24Hour(time: string, period: 'AM' | 'PM'): string {
    if (!time || !time.includes(':')) return '';

    const [hourStr, minStr] = time.split(':');
    let hour = parseInt(hourStr, 10);

    if (isNaN(hour)) return '';

    // If already in 24h (13-23), just return as-is
    if (hour >= 13 && hour <= 23) {
        return `${hour.toString().padStart(2, '0')}:${minStr || '00'}`;
    }

    // Convert 12h to 24h
    if (period === 'AM') {
        if (hour === 12) hour = 0;
    } else {
        if (hour !== 12) hour = hour + 12;
    }

    return `${hour.toString().padStart(2, '0')}:${minStr || '00'}`;
}

// Day schedule input component
interface DayScheduleRowProps {
    day: { id: number; name: string };
    startTime: string;
    startPeriod: 'AM' | 'PM';
    endTime: string;
    endPeriod: 'AM' | 'PM';
    onChange: (field: 'startTime' | 'startPeriod' | 'endTime' | 'endPeriod', value: string | 'AM' | 'PM') => void;
    isActive: boolean;
}

function DayScheduleRow({ day, startTime, startPeriod, endTime, endPeriod, onChange, isActive }: DayScheduleRowProps) {
    const startInfo = parseTimeInfo(startTime);
    const endInfo = parseTimeInfo(endTime);

    // Check if each field has input
    const hasStartInput = startTime && startTime.length > 0;
    const hasEndInput = endTime && endTime.length > 0;

    // Determine effective period (auto PM if 24h format)
    const effectiveStartPeriod = startInfo.is24Hour ? startInfo.period : startPeriod;
    const effectiveEndPeriod = endInfo.is24Hour ? endInfo.period : endPeriod;

    // Helper to convert time + period to total minutes for comparison
    const toMinutes = (time: string, period: 'AM' | 'PM'): number => {
        if (!time || !time.includes(':')) return -1;
        const [h, m] = time.split(':').map(Number);
        let hours = h;

        // Handle 24h format (13-23)
        if (hours >= 13 && hours <= 23) {
            return hours * 60 + (m || 0);
        }

        // Handle 12h format
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        return hours * 60 + (m || 0);
    };

    // Handle blur - complete partial time and detect 24h format
    const handleStartBlur = () => {
        if (!startTime) return;
        const completed = completeTimeInput(startTime);
        onChange('startTime', completed);

        // Check if we need to auto-set PM (for 13-23 hour input)
        const digits = startTime.replace(/\D/g, '');
        if (digits.length >= 2) {
            const hours = parseInt(digits.slice(0, 2), 10);
            if (hours >= 13 && hours <= 23) {
                onChange('startPeriod', 'PM');
            }
        }
    };

    const handleEndBlur = () => {
        if (!endTime) return;
        let completed = completeTimeInput(endTime);

        // Check if we need to auto-set PM (for 13-23 hour input)
        const digits = endTime.replace(/\D/g, '');
        let newEndPeriod = endPeriod;
        if (digits.length >= 2) {
            const hours = parseInt(digits.slice(0, 2), 10);
            if (hours >= 13 && hours <= 23) {
                newEndPeriod = 'PM';
                onChange('endPeriod', 'PM');
            }
        }

        // Validate: end time must be after start time
        if (startTime && startTime.includes(':') && completed.includes(':')) {
            const startMins = toMinutes(startTime, effectiveStartPeriod);
            const endMins = toMinutes(completed, newEndPeriod);

            if (startMins >= 0 && endMins >= 0 && endMins <= startMins) {
                // End time is before or equal to start time - auto-correct to start + 1 hour
                const newEndMins = Math.min(startMins + 60, 23 * 60 + 59); // Cap at 23:59
                const newEndHour = Math.floor(newEndMins / 60);
                const newEndMin = newEndMins % 60;
                completed = `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`;

                // Set PM if needed
                if (newEndHour >= 12) {
                    onChange('endPeriod', 'PM');
                }
            }
        }

        onChange('endTime', completed);
    };

    return (
        <div className={cn(
            "flex items-center gap-3 py-3 px-3 rounded-lg transition-all",
            isActive ? "bg-white" : "bg-gray-50/50"
        )}>
            {/* Day name - turns dark when there's input */}
            <div className={cn(
                "w-24 font-medium transition-colors",
                isActive ? "text-gray-900" : "text-gray-400"
            )}>
                {day.name}
            </div>

            {/* Start time */}
            <div className="flex items-center gap-1.5">
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={startTime}
                    onChange={(e) => {
                        const formatted = formatTimeInput(e.target.value);
                        onChange('startTime', formatted);

                        // Auto-set period if 24h format detected
                        const info = parseTimeInfo(formatted);
                        if (info.is24Hour) {
                            onChange('startPeriod', info.period);
                        }
                    }}
                    onBlur={handleStartBlur}
                    placeholder="--:--"
                    className={cn(
                        "w-16 px-2 py-1.5 border rounded-md text-center text-sm transition-colors",
                        hasStartInput
                            ? "border-gray-400 bg-white text-gray-900"
                            : "border-gray-200 bg-gray-50 text-gray-400"
                    )}
                />
                <button
                    onClick={() => !startInfo.is24Hour && onChange('startPeriod', startPeriod === 'AM' ? 'PM' : 'AM')}
                    disabled={startInfo.is24Hour}
                    className={cn(
                        "px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors border",
                        startInfo.is24Hour && "opacity-60 cursor-not-allowed",
                        // When no input - gray
                        !hasStartInput && "bg-gray-100 text-gray-400 border-gray-200",
                        // When has input - light green with teal border
                        hasStartInput && "bg-teal-50 text-teal-600 border-teal-400 hover:bg-teal-100"
                    )}
                >
                    {effectiveStartPeriod}
                </button>
            </div>

            {/* End time */}
            <div className="flex items-center gap-1.5">
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={endTime}
                    onChange={(e) => {
                        const formatted = formatTimeInput(e.target.value);
                        onChange('endTime', formatted);

                        // Auto-set period if 24h format detected
                        const info = parseTimeInfo(formatted);
                        if (info.is24Hour) {
                            onChange('endPeriod', info.period);
                        }
                    }}
                    onBlur={handleEndBlur}
                    placeholder="--:--"
                    className={cn(
                        "w-16 px-2 py-1.5 border rounded-md text-center text-sm transition-colors",
                        hasEndInput
                            ? "border-gray-400 bg-white text-gray-900"
                            : "border-gray-200 bg-gray-50 text-gray-400"
                    )}
                />
                <button
                    onClick={() => !endInfo.is24Hour && onChange('endPeriod', endPeriod === 'AM' ? 'PM' : 'AM')}
                    disabled={endInfo.is24Hour}
                    className={cn(
                        "px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors border",
                        endInfo.is24Hour && "opacity-60 cursor-not-allowed",
                        // When no input - gray
                        !hasEndInput && "bg-gray-100 text-gray-400 border-gray-200",
                        // When has input - light green with teal border
                        hasEndInput && "bg-teal-50 text-teal-600 border-teal-400 hover:bg-teal-100"
                    )}
                >
                    {effectiveEndPeriod}
                </button>
            </div>
        </div>
    );
}

export default function ScheduleConfigModal({
    members,
    initialEmployeeId,
    onClose,
    onSuccess,
}: ScheduleConfigModalProps) {
    const queryClient = useQueryClient();
    const [isVisible, setIsVisible] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || members[0]?.id || '');
    const [scheduleType, setScheduleType] = useState<string>('base');
    const [isSaving, setIsSaving] = useState(false);

    // Confirmation dialog for switching schedule types
    const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
    const [pendingScheduleType, setPendingScheduleType] = useState<string | null>(null);

    // State for each day's schedule (Horario Base)
    const [daySchedules, setDaySchedules] = useState<{
        [dayId: number]: {
            startTime: string;
            startPeriod: 'AM' | 'PM';
            endTime: string;
            endPeriod: 'AM' | 'PM';
        };
    }>({});

    // State for Turnos Rotativos - each day can have a different shift
    // All days start as null (grey) - user must click to assign shifts
    const [dayShifts, setDayShifts] = useState<{
        [dayId: number]: string | null; // shift ID or null for day off
    }>({
        1: null, // Monday - starts empty
        2: null, // Tuesday - starts empty
        3: null, // Wednesday - starts empty
        4: null, // Thursday - starts empty
        5: null, // Friday - starts empty
        6: null, // Saturday - starts empty
        0: null, // Sunday - starts empty
    });
    const [shiftTimes, setShiftTimes] = useState<{
        [shiftId: string]: { startTime: string; endTime: string };
    }>({
        morning: { startTime: '06:00', endTime: '14:00' },
        afternoon: { startTime: '14:00', endTime: '22:00' },
        night: { startTime: '22:00', endTime: '06:00' },
    });

    // State for A Demanda - day-by-day like Horario Base + advance notice
    const [onDemandSchedules, setOnDemandSchedules] = useState<{
        [dayId: number]: {
            startTime: string;
            startPeriod: 'AM' | 'PM';
            endTime: string;
            endPeriod: 'AM' | 'PM';
        };
    }>({});
    const [advanceNotice, setAdvanceNotice] = useState(24); // hours

    // State for Personalizado (custom - multiple blocks per day)
    const [customSchedule, setCustomSchedule] = useState<{
        [dayId: number]: Array<{ startTime: string; endTime: string }>;
    }>({});

    // Fetch current schedule for selected employee
    const { data: scheduleData, isLoading } = useQuery({
        queryKey: ['employee-schedule-config', selectedEmployeeId],
        queryFn: async () => {
            if (!selectedEmployeeId) return null;
            const res = await fetch(`/api/employees/schedule?userId=${selectedEmployeeId}`);
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!selectedEmployeeId,
    });

    // Initialize day schedules when data loads
    useEffect(() => {
        const schedules = scheduleData?.data?.schedules || [];
        const newDaySchedules: typeof daySchedules = {};

        DAYS.forEach(day => {
            const existing = schedules.find((s: ScheduleEntry) => s.dayOfWeek === day.id && s.isAvailable);
            if (existing) {
                // Parse start time
                const [startH, startM] = (existing.startTime || '09:00').split(':');
                const startHour = parseInt(startH, 10);
                const startPeriod: 'AM' | 'PM' = startHour >= 12 ? 'PM' : 'AM';
                const startDisplay = startHour > 12
                    ? `${(startHour - 12).toString().padStart(2, '0')}:${startM}`
                    : startHour === 0
                        ? `12:${startM}`
                        : `${startH}:${startM}`;

                // Parse end time
                const [endH, endM] = (existing.endTime || '18:00').split(':');
                const endHour = parseInt(endH, 10);
                const endPeriod: 'AM' | 'PM' = endHour >= 12 ? 'PM' : 'AM';
                const endDisplay = endHour > 12
                    ? `${(endHour - 12).toString().padStart(2, '0')}:${endM}`
                    : endHour === 0
                        ? `12:${endM}`
                        : `${endH}:${endM}`;

                newDaySchedules[day.id] = {
                    startTime: startDisplay,
                    startPeriod,
                    endTime: endDisplay,
                    endPeriod,
                };
            } else {
                // Default empty
                newDaySchedules[day.id] = {
                    startTime: '',
                    startPeriod: 'AM',
                    endTime: '',
                    endPeriod: 'PM',
                };
            }
        });

        setDaySchedules(newDaySchedules);
    }, [scheduleData]);

    // Lock body scroll when modal is open
    useEffect(() => {
        // Store original overflow value
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Restore on cleanup
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Animation
    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 200);
    };

    // Update a day's schedule
    const updateDaySchedule = (dayId: number, field: string, value: string | 'AM' | 'PM') => {
        setDaySchedules(prev => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                [field]: value,
            },
        }));
    };

    // Cycle day through shifts (null → morning → afternoon → night → null)
    const cycleDayShift = (dayId: number) => {
        setDayShifts(prev => {
            const currentShift = prev[dayId];
            let nextShift: string | null;

            if (currentShift === null) nextShift = 'morning';
            else if (currentShift === 'morning') nextShift = 'afternoon';
            else if (currentShift === 'afternoon') nextShift = 'night';
            else nextShift = null;

            return { ...prev, [dayId]: nextShift };
        });
    };

    // Set specific shift for a day
    const _setDayShift = (dayId: number, shiftId: string | null) => {
        setDayShifts(prev => ({ ...prev, [dayId]: shiftId }));
    };

    // Update shift time
    const updateShiftTime = (shiftId: string, field: 'startTime' | 'endTime', value: string) => {
        setShiftTimes(prev => ({
            ...prev,
            [shiftId]: {
                ...prev[shiftId],
                [field]: formatTimeInput(value),
            },
        }));
    };

    // Update on-demand day schedule
    const updateOnDemandSchedule = (dayId: number, field: string, value: string | 'AM' | 'PM') => {
        setOnDemandSchedules(prev => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                [field]: value,
            },
        }));
    };

    // Add time block to custom schedule
    const addCustomBlock = (dayId: number) => {
        setCustomSchedule(prev => ({
            ...prev,
            [dayId]: [...(prev[dayId] || []), { startTime: '09:00', endTime: '17:00' }],
        }));
    };

    // Remove time block from custom schedule
    const removeCustomBlock = (dayId: number, blockIndex: number) => {
        setCustomSchedule(prev => ({
            ...prev,
            [dayId]: (prev[dayId] || []).filter((_, i) => i !== blockIndex),
        }));
    };

    // Update custom block time
    const updateCustomBlock = (dayId: number, blockIndex: number, field: 'startTime' | 'endTime', value: string) => {
        setCustomSchedule(prev => ({
            ...prev,
            [dayId]: (prev[dayId] || []).map((block, i) =>
                i === blockIndex ? { ...block, [field]: formatTimeInput(value) } : block
            ),
        }));
    };

    // Check if the current schedule type has any data entered
    const hasDataInCurrentType = (): boolean => {
        if (scheduleType === 'base') {
            return Object.values(daySchedules).some(s =>
                (s.startTime && s.startTime.includes(':')) || (s.endTime && s.endTime.includes(':'))
            );
        } else if (scheduleType === 'rotating') {
            // Check if any day has a non-default shift assigned
            return Object.values(dayShifts).some(shift => shift !== null);
        } else if (scheduleType === 'ondemand') {
            return Object.values(onDemandSchedules).some(s =>
                (s.startTime && s.startTime.includes(':')) || (s.endTime && s.endTime.includes(':'))
            );
        } else if (scheduleType === 'custom') {
            return Object.values(customSchedule).some(blocks => blocks && blocks.length > 0);
        }
        return false;
    };

    // Get display name for schedule type
    const getScheduleTypeName = (typeId: string): string => {
        const type = SCHEDULE_TYPES.find(t => t.id === typeId);
        return type?.name || typeId;
    };

    // Handle attempting to switch schedule types
    const handleScheduleTypeClick = (newType: string) => {
        if (newType === scheduleType) return; // Same type, do nothing

        if (hasDataInCurrentType()) {
            // Show confirmation dialog
            setPendingScheduleType(newType);
            setShowSwitchConfirm(true);
        } else {
            // No data, switch directly
            setScheduleType(newType);
        }
    };

    // Confirm the schedule type switch
    const confirmScheduleTypeSwitch = () => {
        if (pendingScheduleType) {
            setScheduleType(pendingScheduleType);
            setPendingScheduleType(null);
        }
        setShowSwitchConfirm(false);
    };

    // Cancel the schedule type switch
    const cancelScheduleTypeSwitch = () => {
        setPendingScheduleType(null);
        setShowSwitchConfirm(false);
    };

    // Save mutation - handles all schedule types
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (scheduleType === 'base') {
                // Horario Base - save each day's schedule
                const promises = DAYS.map(day => {
                    const schedule = daySchedules[day.id];
                    const hasStart = schedule?.startTime && schedule.startTime.includes(':');
                    const hasEnd = schedule?.endTime && schedule.endTime.includes(':');
                    const isActive = hasStart && hasEnd;

                    const startTime24 = isActive ? to24Hour(schedule.startTime, schedule.startPeriod) : '09:00';
                    const endTime24 = isActive ? to24Hour(schedule.endTime, schedule.endPeriod) : '18:00';

                    return fetch('/api/employees/schedule', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: selectedEmployeeId,
                            dayOfWeek: day.id,
                            startTime: startTime24 || '09:00',
                            endTime: endTime24 || '18:00',
                            isAvailable: isActive,
                        }),
                    });
                });
                await Promise.all(promises);
            } else if (scheduleType === 'rotating') {
                // Turnos Rotativos - each day can have a different shift
                const promises = DAYS.map(day => {
                    const shiftId = dayShifts[day.id];
                    const isActive = shiftId !== null && shiftId !== undefined;
                    const shiftTime = isActive ? shiftTimes[shiftId] : null;

                    return fetch('/api/employees/schedule', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: selectedEmployeeId,
                            dayOfWeek: day.id,
                            startTime: shiftTime?.startTime || '09:00',
                            endTime: shiftTime?.endTime || '17:00',
                            isAvailable: isActive,
                        }),
                    });
                });
                await Promise.all(promises);
            } else if (scheduleType === 'ondemand') {
                // A Demanda - save day-by-day schedules like Horario Base
                const promises = DAYS.map(day => {
                    const schedule = onDemandSchedules[day.id];
                    const hasStart = schedule?.startTime && schedule.startTime.includes(':');
                    const hasEnd = schedule?.endTime && schedule.endTime.includes(':');
                    const isActive = hasStart && hasEnd;

                    const startTime24 = isActive ? to24Hour(schedule.startTime, schedule.startPeriod) : '09:00';
                    const endTime24 = isActive ? to24Hour(schedule.endTime, schedule.endPeriod) : '18:00';

                    return fetch('/api/employees/schedule', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: selectedEmployeeId,
                            dayOfWeek: day.id,
                            startTime: startTime24 || '09:00',
                            endTime: endTime24 || '18:00',
                            isAvailable: isActive,
                        }),
                    });
                });
                await Promise.all(promises);
            } else if (scheduleType === 'custom') {
                // Personalizado - save first block for each day (API currently supports 1 block)
                const promises = DAYS.map(day => {
                    const blocks = customSchedule[day.id] || [];
                    const firstBlock = blocks[0];
                    const isActive = !!firstBlock;
                    return fetch('/api/employees/schedule', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: selectedEmployeeId,
                            dayOfWeek: day.id,
                            startTime: firstBlock?.startTime || '09:00',
                            endTime: firstBlock?.endTime || '17:00',
                            isAvailable: isActive,
                        }),
                    });
                });
                await Promise.all(promises);
            }

            // Always save the schedule type and advance notice for the user
            await fetch('/api/employees/schedule', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedEmployeeId,
                    scheduleType,
                    advanceNoticeHours: scheduleType === 'ondemand' ? advanceNotice : 0,
                }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-schedules'] });
            queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['user-live-status'] });
            queryClient.invalidateQueries({ queryKey: ['team-members'] });
            onSuccess();
            handleClose();
        },
    });

    const handleSave = () => {
        setIsSaving(true);
        saveMutation.mutate();
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/50 transition-opacity duration-200",
                    isVisible ? "opacity-100" : "opacity-0"
                )}
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="flex h-full items-center justify-center p-4">
                <div
                    className={cn(
                        "relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden",
                        "transition-all duration-200 ease-out",
                        isVisible
                            ? "opacity-100 scale-100 translate-y-0"
                            : "opacity-0 scale-95 translate-y-4"
                    )}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Configurar Horarios</h2>
                        <button
                            onClick={handleClose}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    {/* Employee Selector - No bottom border */}
                    <div className="px-6 py-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Seleccionar Empleado
                        </label>
                        <select
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        >
                            {members.map(member => (
                                <option key={member.id} value={member.id}>
                                    {member.name} - {member.role === 'TECHNICIAN' ? 'Técnico' : member.role === 'ADMIN' ? 'Administrador' : member.role}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Schedule Type Selection - No top border */}
                    <div className="px-6 pb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Tipo de Horario
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {SCHEDULE_TYPES.map(type => {
                                const Icon = type.icon;
                                const isSelected = scheduleType === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => handleScheduleTypeClick(type.id)}
                                        className={cn(
                                            "flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all text-left",
                                            isSelected
                                                ? 'border-teal-500 bg-teal-50'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                        )}
                                    >
                                        <div className={cn(
                                            "p-1.5 rounded-md",
                                            isSelected ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-500"
                                        )}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                "font-medium text-sm",
                                                isSelected ? "text-teal-700" : "text-gray-700"
                                            )}>{type.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{type.description}</p>
                                        </div>
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-teal-500 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Schedule Details */}
                    <div className="flex-1 min-h-0 overflow-y-auto border-t">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
                            </div>
                        ) : scheduleType === 'base' ? (
                            <div className="px-6 py-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Horarios por Día
                                </label>

                                <div className="space-y-1">
                                    {/* Reorder to show Mon-Sun instead of Sun-Sat */}
                                    {[...DAYS.slice(1), DAYS[0]].map(day => {
                                        const schedule = daySchedules[day.id] || { startTime: '', startPeriod: 'AM', endTime: '', endPeriod: 'PM' };
                                        const isActive = schedule.startTime.includes(':') && schedule.endTime.includes(':');

                                        return (
                                            <DayScheduleRow
                                                key={day.id}
                                                day={day}
                                                startTime={schedule.startTime}
                                                startPeriod={schedule.startPeriod}
                                                endTime={schedule.endTime}
                                                endPeriod={schedule.endPeriod}
                                                isActive={isActive}
                                                onChange={(field, value) => updateDaySchedule(day.id, field, value)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ) : scheduleType === 'rotating' ? (
                            <div className="px-6 py-4">
                                {/* Shift Time Configuration */}
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Configurar Horarios de Turnos
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                    Edite los horarios de cada turno, luego asigne a cada día
                                </p>
                                <div className="space-y-2 mb-4">
                                    {SHIFT_PRESETS.map(shift => {
                                        const times = shiftTimes[shift.id];
                                        return (
                                            <div
                                                key={shift.id}
                                                className={cn("p-2 rounded-lg border flex items-center justify-between", shift.color)}
                                            >
                                                <span className="font-medium text-sm">{shift.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={times?.startTime || shift.startTime}
                                                        onChange={(e) => updateShiftTime(shift.id, 'startTime', e.target.value)}
                                                        onBlur={() => {
                                                            const completed = completeTimeInput(times?.startTime || '');
                                                            if (completed) updateShiftTime(shift.id, 'startTime', completed);
                                                        }}
                                                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm bg-white"
                                                    />
                                                    <span className="text-gray-600">-</span>
                                                    <input
                                                        type="text"
                                                        value={times?.endTime || shift.endTime}
                                                        onChange={(e) => updateShiftTime(shift.id, 'endTime', e.target.value)}
                                                        onBlur={() => {
                                                            const completed = completeTimeInput(times?.endTime || '');
                                                            if (completed) updateShiftTime(shift.id, 'endTime', completed);
                                                        }}
                                                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm bg-white"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Day-by-Day Shift Assignment */}
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Asignar Turno por Día
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                    Haga clic para cambiar el turno (Mañana → Tarde → Noche → Libre)
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {[...DAYS.slice(1), DAYS[0]].map(day => {
                                        const shiftId = dayShifts[day.id];
                                        const shift = SHIFT_PRESETS.find(s => s.id === shiftId);
                                        const times = shiftId ? shiftTimes[shiftId] : null;

                                        return (
                                            <button
                                                key={day.id}
                                                onClick={() => cycleDayShift(day.id)}
                                                className={cn(
                                                    "px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium min-w-[60px]",
                                                    shift
                                                        ? shift.color
                                                        : "border-gray-200 bg-gray-50 text-gray-400"
                                                )}
                                                title={shift ? `${shift.name}: ${times?.startTime} - ${times?.endTime}` : 'Día libre'}
                                            >
                                                <div className="text-center">
                                                    <div>{day.short}</div>
                                                    {shift && (
                                                        <div className="text-xs opacity-75">{shift.name.slice(0, 3)}</div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : scheduleType === 'ondemand' ? (
                            <div className="px-6 py-4">
                                {/* Info banner */}
                                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-blue-700 mb-4">
                                    <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm">
                                        Sin horario fijo. Configure las ventanas de disponibilidad para cuando lo puedan llamar.
                                    </p>
                                </div>

                                {/* Advance Notice */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Bell className="h-4 w-4 inline mr-1" />
                                        Aviso Anticipado
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={advanceNotice}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setAdvanceNotice(parseInt(val) || 0);
                                            }}
                                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center text-sm"
                                            placeholder="0"
                                        />
                                        <span className="text-sm text-gray-600">horas de anticipación</span>
                                    </div>
                                </div>

                                {/* Day-by-day availability like Horario Base */}
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Ventanas de Disponibilidad por Día
                                </label>
                                <div className="space-y-1">
                                    {[...DAYS.slice(1), DAYS[0]].map(day => {
                                        const schedule = onDemandSchedules[day.id] || { startTime: '', startPeriod: 'AM', endTime: '', endPeriod: 'PM' };
                                        const isActive = schedule.startTime.includes(':') && schedule.endTime.includes(':');

                                        return (
                                            <DayScheduleRow
                                                key={day.id}
                                                day={day}
                                                startTime={schedule.startTime}
                                                startPeriod={schedule.startPeriod}
                                                endTime={schedule.endTime}
                                                endPeriod={schedule.endPeriod}
                                                isActive={isActive}
                                                onChange={(field, value) => updateOnDemandSchedule(day.id, field, value)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="px-6 py-4">
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Horario Personalizado por Día
                                </label>
                                <p className="text-xs text-gray-500 mb-4">
                                    Agregue uno o más bloques de horario para cada día
                                </p>

                                <div className="space-y-3">
                                    {[...DAYS.slice(1), DAYS[0]].map(day => {
                                        const blocks = customSchedule[day.id] || [];
                                        return (
                                            <div key={day.id} className="border rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-sm text-gray-700">{day.name}</span>
                                                    <button
                                                        onClick={() => addCustomBlock(day.id)}
                                                        className="flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        Agregar
                                                    </button>
                                                </div>

                                                {blocks.length === 0 ? (
                                                    <p className="text-xs text-gray-400 italic">Día libre</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {blocks.map((block, idx) => (
                                                            <div key={idx} className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={block.startTime}
                                                                    onChange={(e) => updateCustomBlock(day.id, idx, 'startTime', e.target.value)}
                                                                    onBlur={() => {
                                                                        const completed = completeTimeInput(block.startTime);
                                                                        updateCustomBlock(day.id, idx, 'startTime', completed);
                                                                    }}
                                                                    placeholder="09:00"
                                                                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-center text-sm"
                                                                />
                                                                <span className="text-gray-400">-</span>
                                                                <input
                                                                    type="text"
                                                                    value={block.endTime}
                                                                    onChange={(e) => updateCustomBlock(day.id, idx, 'endTime', e.target.value)}
                                                                    onBlur={() => {
                                                                        const completed = completeTimeInput(block.endTime);
                                                                        updateCustomBlock(day.id, idx, 'endTime', completed);
                                                                    }}
                                                                    placeholder="17:00"
                                                                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-center text-sm"
                                                                />
                                                                <button
                                                                    onClick={() => removeCustomBlock(day.id, idx)}
                                                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-3">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={cn(
                                "px-5 py-2 bg-teal-500 text-white font-medium rounded-lg text-sm transition-colors",
                                "hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed",
                                "flex items-center gap-2"
                            )}
                        >
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog for Schedule Type Switch */}
            {showSwitchConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    {/* Dark overlay */}
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={cancelScheduleTypeSwitch}
                    />

                    {/* Dialog */}
                    <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded-full bg-amber-100">
                                <Info className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 mb-2">
                                    ¿Cambiar tipo de horario?
                                </h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Ya tienes datos ingresados en <strong>{getScheduleTypeName(scheduleType)}</strong>.
                                    Si cambias a <strong>{pendingScheduleType ? getScheduleTypeName(pendingScheduleType) : ''}</strong>,
                                    estos datos no se guardarán.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={cancelScheduleTypeSwitch}
                                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmScheduleTypeSwitch}
                                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                                    >
                                        Sí, cambiar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
