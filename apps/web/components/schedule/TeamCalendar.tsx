'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Settings,
  Clock,
  User,
  Calendar,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBuenosAiresNow, formatDisplayDate } from '@/lib/timezone';
import EmployeeDayModal from './EmployeeDayModal';

// Types
interface Employee {
  id: string;
  name: string;
  role: string;
}

interface ScheduleEntry {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
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

interface CalendarData {
  employees: Employee[];
  schedules: ScheduleEntry[];
  exceptions: ScheduleException[];
}

interface EmployeeStatus {
  employee: Employee;
  status: string;           // Primary status for display (worst case)
  exceptions: ScheduleException[];  // All exceptions for this day
  baseStartTime: string | null;  // Base schedule times (for reference)
  baseEndTime: string | null;
  hasExceptions: boolean;
}

// Status filter options - Argentine Labor Law categories
const STATUS_FILTERS = [
  { id: 'all', label: 'Todos', color: 'bg-gray-100 text-gray-700' },
  { id: 'available', label: 'Disponible', color: 'bg-green-100 text-green-700' },
  { id: 'vacation', label: 'Vacaciones', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'sick', label: 'Enfermedad', color: 'bg-orange-100 text-orange-700' },
  { id: 'study', label: 'Examen', color: 'bg-purple-100 text-purple-700' },
  { id: 'dayoff', label: 'Franco', color: 'bg-gray-100 text-gray-500' },
];

// Reason to status mapping
const REASON_TO_STATUS: Record<string, string> = {
  'Vacaciones': 'vacation',
  'Enfermedad': 'sick',
  'Examen / Estudio': 'study',
  'Franco / Ausente': 'dayoff',
  'Día personal': 'dayoff',
  'Feriado': 'dayoff',
  'Horario Modificado': 'special',
  'Capacitación': 'available',
  'Otro': 'dayoff'
};

// Day names
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Status labels
const STATUS_LABELS: Record<string, string> = {
  'available': 'Disponible',
  'special': 'Horario Modificado',
  'vacation': 'Vacaciones',
  'sick': 'Enfermedad',
  'study': 'Examen / Estudio',
  'dayoff': 'Franco / Ausente',
};

// Status colors for dots
const STATUS_DOT_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  special: 'bg-blue-500',
  vacation: 'bg-yellow-500',
  sick: 'bg-orange-500',
  study: 'bg-purple-500',
  dayoff: 'bg-gray-300',
};

// Status colors for badges/chips
const STATUS_BADGE_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  special: 'bg-blue-100 text-blue-700',
  vacation: 'bg-yellow-100 text-yellow-700',
  sick: 'bg-orange-100 text-orange-700',
  study: 'bg-purple-100 text-purple-700',
  dayoff: 'bg-gray-100 text-gray-500',
};

// Status colors for week view chips (lighter bg + visible border)
const STATUS_CHIP_STYLES: Record<string, string> = {
  available: 'bg-green-50 border-green-300 text-green-800',
  special: 'bg-blue-50 border-blue-300 text-blue-800',
  vacation: 'bg-amber-50 border-amber-300 text-amber-800',
  sick: 'bg-orange-50 border-orange-300 text-orange-800',
  study: 'bg-purple-50 border-purple-300 text-purple-800',
  dayoff: 'bg-gray-50 border-gray-200 text-gray-500',
};

interface TeamCalendarProps {
  canEdit: boolean;
  onOpenScheduleConfig?: () => void;
}

export default function TeamCalendar({ canEdit, onOpenScheduleConfig }: TeamCalendarProps) {
  const { user: _user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start of current week (Monday)
    const today = getBuenosAiresNow();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is start of week
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday;
  });
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Selected date for side panel (defaults to today in Argentina timezone)
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => getBuenosAiresNow());

  // Selected employee ID for edit modal (store ID only, derive status from query data)
  const [selectedEmployeeIdForEdit, setSelectedEmployeeIdForEdit] = useState<string | null>(null);

  // Fetch calendar data
  const { data: calendarData, isLoading } = useQuery<{ success: boolean; data: CalendarData }>({
    queryKey: ['team-calendar', currentMonth.getMonth(), currentMonth.getFullYear()],
    queryFn: async () => {
      const params = new URLSearchParams({
        month: String(currentMonth.getMonth() + 1),
        year: String(currentMonth.getFullYear())
      });
      const res = await fetch(`/api/employees/schedule/calendar?${params}`);
      if (!res.ok) throw new Error('Error fetching calendar');
      return res.json();
    }
  });

  const schedules = calendarData?.data?.schedules || [];
  const exceptions = calendarData?.data?.exceptions || [];

  // Initialize selected employees to all when data loads
  useMemo(() => {
    const employees = calendarData?.data?.employees || [];
    if (employees.length > 0 && selectedEmployees.length === 0) {
      setSelectedEmployees(employees.map(e => e.id));
    }
  }, [calendarData?.data?.employees, selectedEmployees.length]);

  const employees = calendarData?.data?.employees || [];

  // Navigate months
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Navigate weeks
  const prevWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
    // Also update month if we crossed into previous month
    if (newWeekStart.getMonth() !== currentMonth.getMonth()) {
      setCurrentMonth(new Date(newWeekStart.getFullYear(), newWeekStart.getMonth()));
    }
  };

  const nextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
    // Also update month if we crossed into next month
    if (newWeekStart.getMonth() !== currentMonth.getMonth()) {
      setCurrentMonth(new Date(newWeekStart.getFullYear(), newWeekStart.getMonth()));
    }
  };

  const goToToday = () => {
    const today = getBuenosAiresNow();
    setCurrentMonth(today);
    setSelectedDate(today);
    // Also reset week to current week
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    setCurrentWeekStart(monday);
  };

  // Generate calendar weeks (like CalendarView)
  const weeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      currentWeek.push(new Date(current));
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      current.setDate(current.getDate() + 1);
    }

    return weeks;
  }, [currentMonth]);

  // Generate the 7 days of the current week (for week view)
  const currentWeekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  // Format week date range for header (e.g., "12 - 18 ene 2026")
  const weekDateRange = useMemo(() => {
    const start = currentWeekDays[0];
    const end = currentWeekDays[6];
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = formatDisplayDate(start, { month: 'short' });
    const endMonth = formatDisplayDate(end, { month: 'short' });
    const year = end.getFullYear();

    if (start.getMonth() === end.getMonth()) {
      return `${startDay} - ${endDay} ${startMonth} ${year}`;
    }
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
  }, [currentWeekDays]);

  // Get primary status for an employee on a specific day
  const getPrimaryStatusForDay = (employeeId: string, date: Date): string => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Get all exceptions for this employee on this date
    const dayExceptions = exceptions.filter(
      e => e.userId === employeeId && e.date.split('T')[0] === dateStr
    );

    // Check for full-day exception first
    const fullDayException = dayExceptions.find(e => !e.startTime || !e.endTime);
    if (fullDayException) {
      return REASON_TO_STATUS[fullDayException.reason || ''] || 'dayoff';
    }

    // If there are partial exceptions, show "mixed" indicator
    if (dayExceptions.length > 0) {
      // Return the "worst" status for display purposes
      const statuses = dayExceptions.map(e => REASON_TO_STATUS[e.reason || ''] || 'dayoff');
      // Priority: sick > vacation > study > dayoff > special
      if (statuses.includes('sick')) return 'sick';
      if (statuses.includes('vacation')) return 'vacation';
      if (statuses.includes('study')) return 'study';
      if (statuses.includes('dayoff')) return 'dayoff';
      if (statuses.includes('special')) return 'special';
    }

    // Fall back to regular schedule
    const schedule = schedules.find(
      s => s.userId === employeeId && s.dayOfWeek === dayOfWeek
    );

    if (schedule?.isAvailable) {
      return 'available';
    }

    return 'dayoff';
  };

  // Get full employee status including all exceptions
  const getEmployeeStatusForDay = (employeeId: string, date: Date): Omit<EmployeeStatus, 'employee'> => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Get base schedule
    const schedule = schedules.find(
      s => s.userId === employeeId && s.dayOfWeek === dayOfWeek
    );
    const baseStartTime = schedule?.isAvailable ? schedule.startTime : null;
    const baseEndTime = schedule?.isAvailable ? schedule.endTime : null;

    // Get all exceptions for this day
    const dayExceptions = exceptions.filter(
      e => e.userId === employeeId && e.date.split('T')[0] === dateStr
    );

    // Determine primary status
    const status = getPrimaryStatusForDay(employeeId, date);

    return {
      status,
      exceptions: dayExceptions,
      baseStartTime,
      baseEndTime,
      hasExceptions: dayExceptions.length > 0,
    };
  };

  // Get all employee statuses for a day
  const getEmployeeStatusesForDay = (date: Date): EmployeeStatus[] => {
    const filteredEmployees = selectedEmployees.length > 0
      ? employees.filter(e => selectedEmployees.includes(e.id))
      : employees;

    const statuses = filteredEmployees.map(emp => ({
      employee: emp,
      ...getEmployeeStatusForDay(emp.id, date)
    }));

    // Apply status filter
    if (statusFilter === 'all') return statuses;
    return statuses.filter(s => s.status === statusFilter || (statusFilter === 'available' && s.status === 'special'));
  };

  // Get individual employee statuses for dots display (one dot per employee)
  const getEmployeeDotsForDay = (date: Date) => {
    const filteredEmployees = selectedEmployees.length > 0
      ? employees.filter(e => selectedEmployees.includes(e.id))
      : employees;
    const dayOfWeek = date.getDay();

    return filteredEmployees.map(emp => {
      const status = getPrimaryStatusForDay(emp.id, date);
      const schedule = schedules.find(
        s => s.userId === emp.id && s.dayOfWeek === dayOfWeek
      );
      const startTime = schedule?.isAvailable ? schedule.startTime : null;
      const endTime = schedule?.isAvailable ? schedule.endTime : null;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        status,
        startTime,
        endTime,
      };
    });
  };

  // Toggle employee selection
  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAllEmployees = () => {
    setSelectedEmployees(employees.map(e => e.id));
  };

  const deselectAllEmployees = () => {
    setSelectedEmployees([]);
  };

  const formatDateStr = (date: Date) => date.toISOString().split('T')[0];
  const today = formatDateStr(new Date());
  const selectedDateStr = selectedDate ? formatDateStr(selectedDate) : undefined;

  // Get employee statuses for the selected day
  const selectedDayStatuses = selectedDate ? getEmployeeStatusesForDay(selectedDate) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar - matches CalendarView */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white p-3 shadow-sm">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={viewMode === 'week' ? prevWeek : prevMonth}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={goToToday} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Hoy
          </button>
          <button
            onClick={viewMode === 'week' ? nextWeek : nextMonth}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="ml-2 text-lg font-semibold text-gray-900 capitalize">
            {viewMode === 'week'
              ? weekDateRange
              : formatDisplayDate(currentMonth, { month: 'long', year: 'numeric' })
            }
          </h2>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Semana</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Mes</span>
            </button>
          </div>

          {/* Employee selector */}
          <div className="relative">
            <button
              onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
              className="btn-outline flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span>
                {selectedEmployees.length === employees.length
                  ? 'Todos los empleados'
                  : selectedEmployees.length === 0
                    ? 'Ninguno seleccionado'
                    : `${selectedEmployees.length} seleccionado(s)`}
              </span>
            </button>

            {showEmployeeDropdown && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-white shadow-lg">
                <div className="p-2 border-b">
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllEmployees}
                      className="flex-1 text-sm text-primary-600 hover:underline"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={deselectAllEmployees}
                      className="flex-1 text-sm text-gray-500 hover:underline"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto p-2">
                  {employees.map(emp => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600"
                      />
                      <span className="flex-1">{emp.name}</span>
                      <span className="text-xs text-gray-500">
                        {emp.role === 'TECHNICIAN' ? 'Técnico' : emp.role === 'DISPATCHER' ? 'Desp.' : ''}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="p-2 border-t">
                  <button
                    onClick={() => setShowEmployeeDropdown(false)}
                    className="w-full text-center text-sm text-primary-600 hover:underline"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Config Button */}
          {onOpenScheduleConfig && (
            <button
              onClick={onOpenScheduleConfig}
              className="btn-outline flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurar Horarios</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Filters */}
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                statusFilter === filter.id
                  ? filter.color.replace('100', '200').replace('700', '800')
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid + Side Panel - Split Layout */}
      <div className="flex gap-4">
        {/* Calendar Grid - Separate Card */}
        <div className="flex-1 rounded-lg bg-white shadow-sm overflow-hidden">
          {viewMode === 'week' ? (
            /* ═══════════════════════════════════════════════════════════════════════════════
               WEEK VIEW - Table with dates in headers
               ═══════════════════════════════════════════════════════════════════════════════ */
            <>
              {/* Day Headers with Dates */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {currentWeekDays.map((date, idx) => {
                  const dateStr = formatDateStr(date);
                  const isToday = dateStr === today;
                  const isSelected = dateStr === selectedDateStr;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        'px-2 py-3 text-center transition-colors hover:bg-gray-50',
                        isSelected && 'bg-teal-50'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-medium uppercase',
                        isToday ? 'text-teal-600' : 'text-gray-500'
                      )}>
                        {DAY_NAMES[date.getDay()]}
                      </div>
                      <div className={cn(
                        'text-lg font-semibold',
                        isToday ? 'text-teal-600' : 'text-gray-900'
                      )}>
                        {date.getDate()}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Week Row - Employee schedule chips for each day */}
              <div className="grid grid-cols-7">
                {currentWeekDays.map((date, dayIdx) => {
                  const dateStr = formatDateStr(date);
                  const isToday = dateStr === today;
                  const employeeStatuses = getEmployeeDotsForDay(date);

                  // Helper to format time display (simplified)
                  const formatTimeShort = (time: string | null) => {
                    if (!time) return '';
                    return time.substring(0, 5); // Just "HH:MM"
                  };

                  return (
                    <div
                      key={dayIdx}
                      className={cn(
                        'border-r border-gray-100 last:border-r-0 p-2 min-h-[280px]',
                        isToday && 'bg-teal-50/20'
                      )}
                    >
                      {/* Employee Chips */}
                      <div className="space-y-1.5">
                        {employeeStatuses.map((emp) => {
                          const chipStyle = STATUS_CHIP_STYLES[emp.status] || STATUS_CHIP_STYLES.dayoff;
                          const hasHours = emp.startTime && emp.endTime;
                          const timeDisplay = hasHours
                            ? `${formatTimeShort(emp.startTime)}-${formatTimeShort(emp.endTime)}`
                            : (emp.status === 'dayoff' ? 'Libre' : STATUS_LABELS[emp.status] || '');

                          return (
                            <button
                              key={emp.employeeId}
                              onClick={() => {
                                setSelectedDate(date);
                                setSelectedEmployeeIdForEdit(emp.employeeId);
                              }}
                              className={cn(
                                'w-full px-3 py-2 rounded-md border text-left transition-all',
                                'hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]',
                                chipStyle
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-base font-medium truncate">
                                  {emp.employeeName.split(' ')[0]}
                                </span>
                                <span className="text-sm opacity-80 flex-shrink-0">
                                  {timeDisplay}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════════════════
               MONTH VIEW - Original calendar grid
               ═══════════════════════════════════════════════════════════════════════════════ */
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAY_NAMES.map((day) => (
                  <div key={day} className="px-2 py-3 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Weeks Grid */}
              <div className="grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(90px, 1fr))` }}>
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
                    {week.map((date, dayIndex) => {
                      const dateStr = formatDateStr(date);
                      const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                      const isToday = dateStr === today;
                      const isSelected = dateStr === selectedDateStr;
                      const employeeDots = getEmployeeDotsForDay(date);

                      return (
                        <button
                          key={dayIndex}
                          onClick={() => setSelectedDate(date)}
                          className={cn(
                            'min-h-[90px] border-r border-gray-50 last:border-r-0 p-2 pb-4 text-left transition-all hover:bg-gray-50 flex flex-col',
                            isCurrentMonth ? 'bg-white' : 'bg-gray-50/50',
                            // Selected: thick teal border, keep white bg
                            isSelected && 'ring-2 ring-inset ring-teal-600 bg-white hover:bg-white'
                          )}
                        >
                          {/* Day number - fixed at top-right */}
                          <div className="flex justify-end">
                            <span
                              className={cn(
                                'flex h-6 w-6 items-center justify-center text-sm',
                                // Today: bold + teal color (no circle)
                                isToday && 'font-bold text-teal-600',
                                // Not today: normal weight
                                !isToday && (isCurrentMonth ? 'font-medium text-gray-900' : 'font-medium text-gray-400')
                              )}
                            >
                              {date.getDate()}
                            </span>
                          </div>

                          {/* Status dots - positioned at ~75% height */}
                          <div className="flex-grow" />
                          {employeeDots.length > 0 && (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {employeeDots.slice(0, 4).map((empDot) => (
                                <span
                                  key={empDot.employeeId}
                                  className={cn(
                                    'h-2.5 w-2.5 rounded-full',
                                    STATUS_DOT_COLORS[empDot.status] || 'bg-gray-400'
                                  )}
                                  title={`${empDot.employeeName}: ${STATUS_LABELS[empDot.status] || empDot.status}`}
                                />
                              ))}
                              {employeeDots.length > 4 && (
                                <span className="text-xs font-medium text-gray-500">
                                  +{employeeDots.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Side Panel - Employee Details for Selected Day - Only in Month View */}
        {viewMode === 'month' && selectedDate && (
          <AvailabilitySidePanel
            selectedDate={selectedDate}
            statuses={selectedDayStatuses}
            canEdit={canEdit}
            onEmployeeClick={(empStatus) => setSelectedEmployeeIdForEdit(empStatus.employee.id)}
          />
        )}
      </div>

      {/* Employee Day Edit Modal - derive fresh data from query each render */}
      {selectedEmployeeIdForEdit && selectedDate && (() => {
        // Find employee and derive current status from latest query data
        const employee = employees.find(e => e.id === selectedEmployeeIdForEdit);
        if (!employee) return null;

        const status = getEmployeeStatusForDay(selectedEmployeeIdForEdit, selectedDate);

        return (
          <EmployeeDayModal
            employee={employee}
            date={selectedDate}
            exceptions={status.exceptions}
            baseStartTime={status.baseStartTime}
            baseEndTime={status.baseEndTime}
            onClose={() => setSelectedEmployeeIdForEdit(null)}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
            }}
          />
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDE PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface AvailabilitySidePanelProps {
  selectedDate: Date;
  statuses: EmployeeStatus[];
  canEdit: boolean;
  onEmployeeClick: (empStatus: EmployeeStatus) => void;
}

function AvailabilitySidePanel({ selectedDate, statuses, canEdit, onEmployeeClick }: AvailabilitySidePanelProps) {
  // Format time for display
  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const dateLabel = formatDisplayDate(selectedDate, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Count by status
  const countByStatus = statuses.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="w-80 flex-shrink-0 rounded-lg bg-white shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 capitalize">{dateLabel}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {statuses.length} empleado{statuses.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Status Summary */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2">
        {Object.entries(countByStatus).map(([status, count]) => (
          <span
            key={status}
            className={cn('px-2 py-1 rounded-full text-xs font-medium', STATUS_BADGE_COLORS[status])}
          >
            {count} {STATUS_LABELS[status] || status}
          </span>
        ))}
      </div>

      {/* Employee List */}
      <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-50">
        {statuses.map((empStatus) => {
          const hasExceptions = empStatus.exceptions.length > 0;
          const hasFullDayException = empStatus.exceptions.some(e => !e.startTime || !e.endTime);
          const hasPartialException = empStatus.exceptions.some(e => e.startTime && e.endTime);

          // Get the primary exception type for display
          const primaryException = empStatus.exceptions[0];
          const exceptionLabel = primaryException
            ? (STATUS_LABELS[REASON_TO_STATUS[primaryException.reason || ''] || 'dayoff'] || primaryException.reason)
            : null;

          return (
            <button
              key={empStatus.employee.id}
              onClick={() => canEdit && onEmployeeClick(empStatus)}
              disabled={!canEdit}
              className={cn(
                'w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3',
                !canEdit && 'cursor-default'
              )}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-gray-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{empStatus.employee.name}</p>

                {/* Row 1: Work schedule (if available) OR status badge for full-day absence */}
                {empStatus.baseStartTime && empStatus.baseEndTime && !hasFullDayException ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      {formatTime(empStatus.baseStartTime)} - {formatTime(empStatus.baseEndTime)}
                    </span>
                  </div>
                ) : !hasExceptions && !empStatus.baseStartTime ? (
                  <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium inline-block mt-0.5', STATUS_BADGE_COLORS['dayoff'])}>
                    Franco / Ausente
                  </span>
                ) : null}

                {/* Row 2: Exception indicator */}
                {hasExceptions && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {hasFullDayException ? (
                      <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', STATUS_BADGE_COLORS[empStatus.status])}>
                        {exceptionLabel} (día completo)
                      </span>
                    ) : hasPartialException ? (
                      <>
                        <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', STATUS_BADGE_COLORS[empStatus.status])}>
                          {exceptionLabel}
                        </span>
                        <span className="text-xs text-amber-600">
                          ({empStatus.exceptions.length === 1 ? 'parcial' : `${empStatus.exceptions.length} parciales`})
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {statuses.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No hay empleados para mostrar</p>
          </div>
        )}
      </div>
    </div>
  );
}
