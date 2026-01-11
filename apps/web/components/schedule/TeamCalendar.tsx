'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import {
  ChevronLeft,
  ChevronRight,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CalendarDayModal from './CalendarDayModal';

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

// Status filter options
const STATUS_FILTERS = [
  { id: 'all', label: 'Todos', color: 'bg-gray-100 text-gray-700' },
  { id: 'available', label: 'Disponible', color: 'bg-green-100 text-green-700' },
  { id: 'vacation', label: 'Vacaciones', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'sick', label: 'Enfermedad', color: 'bg-orange-100 text-orange-700' },
  { id: 'dayoff', label: 'Día libre', color: 'bg-gray-100 text-gray-500' },
];

// Reason to status mapping
const REASON_TO_STATUS: Record<string, string> = {
  'Vacaciones': 'vacation',
  'Enfermedad': 'sick',
  'Día personal': 'dayoff',
  'Feriado': 'dayoff',
  'Capacitación': 'available',
  'Otro': 'dayoff'
};

// Day names
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface TeamCalendarProps {
  canEdit: boolean;
}

export default function TeamCalendar({ canEdit }: TeamCalendarProps) {
  const { user: _user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Fetch calendar data
  const { data: calendarData, isLoading, refetch } = useQuery<{ success: boolean; data: CalendarData }>({
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
    setCurrentMonth(new Date());
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];

    // Padding for days before first of month
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentMonth]);

  // Get employee status for a specific day
  const getEmployeeStatusForDay = (employeeId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Check for exception first
    const exception = exceptions.find(
      e => e.userId === employeeId && e.date.split('T')[0] === dateStr
    );

    if (exception) {
      if (!exception.isAvailable) {
        const status = REASON_TO_STATUS[exception.reason || ''] || 'dayoff';
        return {
          status,
          reason: exception.reason,
          startTime: null,
          endTime: null,
          isException: true
        };
      } else {
        return {
          status: 'special',
          reason: exception.reason,
          startTime: exception.startTime,
          endTime: exception.endTime,
          isException: true
        };
      }
    }

    // Check regular schedule
    const schedule = schedules.find(
      s => s.userId === employeeId && s.dayOfWeek === dayOfWeek
    );

    if (schedule?.isAvailable) {
      return {
        status: 'available',
        reason: null,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        isException: false
      };
    }

    return {
      status: 'dayoff',
      reason: null,
      startTime: null,
      endTime: null,
      isException: false
    };
  };

  // Get aggregated status for a day (all selected employees)
  const getDayAggregatedStatus = (date: Date) => {
    const filteredEmployees = selectedEmployees.length > 0
      ? employees.filter(e => selectedEmployees.includes(e.id))
      : employees;

    const statuses = filteredEmployees.map(emp => ({
      employee: emp,
      ...getEmployeeStatusForDay(emp.id, date)
    }));

    // Apply status filter
    const filtered = statusFilter === 'all'
      ? statuses
      : statuses.filter(s => s.status === statusFilter || (statusFilter === 'available' && s.status === 'special'));

    const availableCount = statuses.filter(s => s.status === 'available' || s.status === 'special').length;
    const vacationCount = statuses.filter(s => s.status === 'vacation').length;
    const sickCount = statuses.filter(s => s.status === 'sick').length;
    const dayoffCount = statuses.filter(s => s.status === 'dayoff').length;

    return {
      statuses: filtered,
      allStatuses: statuses,
      counts: {
        available: availableCount,
        vacation: vacationCount,
        sick: sickCount,
        dayoff: dayoffCount,
        total: statuses.length
      }
    };
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

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'special': return 'bg-blue-500';
      case 'vacation': return 'bg-yellow-500';
      case 'sick': return 'bg-orange-500';
      case 'dayoff': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold min-w-[180px] text-center text-lg">
              {currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button onClick={goToToday} className="btn-outline text-sm ml-2">
              Hoy
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
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                statusFilter === filter.id
                  ? filter.color + ' ring-2 ring-offset-1 ring-gray-400'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DAY_NAMES.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={index} className="min-h-[100px] bg-gray-50 border-b border-r" />;
            }

            const dayData = getDayAggregatedStatus(date);
            const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <button
                key={index}
                onClick={() => setSelectedDay(date)}
                className={cn(
                  'min-h-[100px] p-2 border-b border-r text-left transition-colors hover:bg-gray-50',
                  isToday(date) && 'bg-primary-50',
                  isPast && 'opacity-60'
                )}
              >
                {/* Date number */}
                <div className={cn(
                  'text-sm font-medium mb-2',
                  isToday(date) && 'text-primary-600'
                )}>
                  {date.getDate()}
                </div>

                {/* Status indicators */}
                {dayData.statuses.length > 0 && (
                  <div className="space-y-1">
                    {/* Show individual employees if <= 3, otherwise show summary */}
                    {dayData.statuses.length <= 3 ? (
                      dayData.statuses.map((s, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', getStatusColor(s.status))} />
                          <span className="text-xs truncate">{s.employee.name.split(' ')[0]}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        {dayData.counts.available > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs text-gray-600">{dayData.counts.available} disponibles</span>
                          </div>
                        )}
                        {dayData.counts.vacation > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-xs text-gray-600">{dayData.counts.vacation} vacaciones</span>
                          </div>
                        )}
                        {dayData.counts.sick > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-xs text-gray-600">{dayData.counts.sick} enfermo(s)</span>
                          </div>
                        )}
                        {dayData.counts.dayoff > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-gray-300" />
                            <span className="text-xs text-gray-600">{dayData.counts.dayoff} libre(s)</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Horario especial</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Vacaciones</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Enfermedad</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-300" />
            <span>Día libre</span>
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <CalendarDayModal
          date={selectedDay}
          employees={employees}
          schedules={schedules}
          exceptions={exceptions}
          canEdit={canEdit}
          onClose={() => setSelectedDay(null)}
          onUpdate={() => {
            refetch();
            setSelectedDay(null);
          }}
        />
      )}
    </div>
  );
}
