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
  status: string;
  reason: string | null;
  startTime: string | null;  // For exceptions: absence times. For available: work times
  endTime: string | null;
  baseStartTime: string | null;  // Base schedule times (for reference)
  baseEndTime: string | null;
  isException: boolean;
  isPartialAbsence: boolean;  // True if exception has specific hours (not full day)
  exceptionId?: string;
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

interface TeamCalendarProps {
  canEdit: boolean;
  onOpenScheduleConfig?: () => void;
}

export default function TeamCalendar({ canEdit, onOpenScheduleConfig }: TeamCalendarProps) {
  const { user: _user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Selected date for side panel (defaults to today in Argentina timezone)
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => getBuenosAiresNow());

  // Selected employee for edit modal
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState<EmployeeStatus | null>(null);

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

  const goToToday = () => {
    const today = getBuenosAiresNow();
    setCurrentMonth(today);
    setSelectedDate(today);
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

  // Get employee status for a specific day
  const getEmployeeStatusForDay = (employeeId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Get base schedule for reference
    const schedule = schedules.find(
      s => s.userId === employeeId && s.dayOfWeek === dayOfWeek
    );
    const baseStartTime = schedule?.isAvailable ? schedule.startTime : null;
    const baseEndTime = schedule?.isAvailable ? schedule.endTime : null;

    // Check for exception first
    const exception = exceptions.find(
      e => e.userId === employeeId && e.date.split('T')[0] === dateStr
    );

    if (exception) {
      const hasExceptionHours = !!(exception.startTime && exception.endTime);

      if (!exception.isAvailable) {
        // Absence exception (vacation, sick, etc.)
        const status = REASON_TO_STATUS[exception.reason || ''] || 'dayoff';
        return {
          status,
          reason: exception.reason,
          startTime: exception.startTime || null,  // Absence hours (if partial)
          endTime: exception.endTime || null,
          baseStartTime,  // Original schedule for reference
          baseEndTime,
          isException: true,
          isPartialAbsence: hasExceptionHours,
          exceptionId: exception.id,
        };
      } else {
        // Modified hours exception (still working, different times)
        return {
          status: 'special',
          reason: exception.reason,
          startTime: exception.startTime,
          endTime: exception.endTime,
          baseStartTime,
          baseEndTime,
          isException: true,
          isPartialAbsence: false,
          exceptionId: exception.id,
        };
      }
    }

    // Check regular schedule
    if (schedule?.isAvailable) {
      return {
        status: 'available',
        reason: null,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        baseStartTime: schedule.startTime,
        baseEndTime: schedule.endTime,
        isException: false,
        isPartialAbsence: false,
      };
    }

    return {
      status: 'dayoff',
      reason: null,
      startTime: null,
      endTime: null,
      baseStartTime: null,
      baseEndTime: null,
      isException: false,
      isPartialAbsence: false,
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

    return filteredEmployees.map(emp => ({
      employeeId: emp.id,
      employeeName: emp.name,
      ...getEmployeeStatusForDay(emp.id, date)
    }));
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
          <button onClick={prevMonth} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={goToToday} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Hoy
          </button>
          <button onClick={nextMonth} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="ml-2 text-lg font-semibold text-gray-900 capitalize">
            {formatDisplayDate(currentMonth, { month: 'long', year: 'numeric' })}
          </h2>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
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
                'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                statusFilter === filter.id
                  ? filter.color
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Calendar Area - Split View Layout with Gap */}
      <div className="flex gap-4">
        {/* Calendar Grid - Separate Card */}
        <div className="flex-1 rounded-lg bg-white shadow-sm overflow-hidden">
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
        </div>

        {/* Side Panel - Employee Details for Selected Day - Separate Card */}
        {selectedDate && (
          <AvailabilitySidePanel
            selectedDate={selectedDate}
            statuses={selectedDayStatuses}
            canEdit={canEdit}
            onEmployeeClick={(empStatus) => setSelectedEmployeeForEdit(empStatus)}
          />
        )}
      </div>

      {/* Employee Day Edit Modal */}
      {selectedEmployeeForEdit && selectedDate && (
        <EmployeeDayModal
          employee={selectedEmployeeForEdit.employee}
          date={selectedDate}
          currentStatus={selectedEmployeeForEdit.status}
          currentReason={selectedEmployeeForEdit.reason}
          startTime={selectedEmployeeForEdit.startTime}
          endTime={selectedEmployeeForEdit.endTime}
          baseStartTime={selectedEmployeeForEdit.baseStartTime}
          baseEndTime={selectedEmployeeForEdit.baseEndTime}
          hasException={selectedEmployeeForEdit.isException}
          exceptionId={selectedEmployeeForEdit.exceptionId}
          onClose={() => setSelectedEmployeeForEdit(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
            setSelectedEmployeeForEdit(null);
          }}
        />
      )}
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
  // Group by status
  const availableCount = statuses.filter(s => s.status === 'available' || s.status === 'special').length;
  const unavailableCount = statuses.length - availableCount;

  return (
    <div className="w-80 rounded-lg bg-white shadow-sm overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">
          {formatDisplayDate(selectedDate, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </h3>
        <p className="text-sm text-gray-500 mt-0.5">
          {availableCount} disponible{availableCount !== 1 ? 's' : ''} · {unavailableCount} ausente{unavailableCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Employee List */}
      <div className="p-4 space-y-3">
        {statuses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No hay empleados para este filtro</p>
          </div>
        ) : (
          statuses.map((empStatus) => (
            <EmployeeStatusCard
              key={empStatus.employee.id}
              empStatus={empStatus}
              canEdit={canEdit}
              onClick={() => onEmployeeClick(empStatus)}
            />
          ))
        )}
      </div>

      {/* Hint for editing */}
      {canEdit && statuses.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-400 text-center">
            Haz clic en un empleado para editar
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE STATUS CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeStatusCardProps {
  empStatus: EmployeeStatus;
  canEdit: boolean;
  onClick: () => void;
}

function EmployeeStatusCard({ empStatus, canEdit, onClick }: EmployeeStatusCardProps) {
  const { employee, status, reason, startTime, endTime, isException, isPartialAbsence } = empStatus;

  const statusLabel = STATUS_LABELS[status] || status;
  const statusDotColor = STATUS_DOT_COLORS[status] || 'bg-gray-400';
  const statusBadgeColor = STATUS_BADGE_COLORS[status] || 'bg-gray-100 text-gray-600';

  // Check if this is an exception status (absence type)
  const isAbsenceStatus = ['vacation', 'sick', 'study', 'dayoff'].includes(status);

  // Format time display
  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [h, m] = time.split(':');
    return `${h}:${m}`;
  };

  const timeDisplay = startTime && endTime
    ? `${formatTime(startTime)} - ${formatTime(endTime)}`
    : null;

  return (
    <button
      onClick={canEdit ? onClick : undefined}
      className={cn(
        'w-full text-left bg-white border border-gray-100 rounded-xl p-4 shadow-sm transition-all',
        canEdit && 'hover:shadow-md hover:border-gray-200 cursor-pointer'
      )}
    >
      {/* Header: Employee name + status badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', statusDotColor)} />
          <span className="font-medium text-gray-900">{employee.name}</span>
        </div>
        <span className={cn(
          'text-xs font-medium px-2.5 py-1 rounded-full',
          statusBadgeColor
        )}>
          {statusLabel}{isPartialAbsence ? ' (parcial)' : ''}
        </span>
      </div>

      {/* Time info - differentiate between work hours and absence hours */}
      {timeDisplay && (
        <div className="flex items-center gap-1.5 text-gray-500 mb-1">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-sm">
            {isAbsenceStatus && isPartialAbsence ? `Ausente: ${timeDisplay}` : timeDisplay}
          </span>
        </div>
      )}

      {/* Role */}
      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
        <User className="h-3.5 w-3.5" />
        <span className="text-sm">
          {employee.role === 'TECHNICIAN' ? 'Técnico' : employee.role === 'DISPATCHER' ? 'Despachador' : employee.role}
        </span>
      </div>

      {/* Exception indicator - only show full reason for full-day absences */}
      {isException && reason && !isPartialAbsence && (
        <div className="mt-2 text-xs text-gray-500 italic">
          Motivo: {reason}
        </div>
      )}
    </button>
  );
}

