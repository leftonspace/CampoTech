'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import {
  Calendar,
  Clock,
  Plus,
  X,
  Save,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Day of week names in Spanish
const DAYS_OF_WEEK = [
  { id: 0, name: 'Domingo', short: 'Dom' },
  { id: 1, name: 'Lunes', short: 'Lun' },
  { id: 2, name: 'Martes', short: 'Mar' },
  { id: 3, name: 'Miércoles', short: 'Mié' },
  { id: 4, name: 'Jueves', short: 'Jue' },
  { id: 5, name: 'Viernes', short: 'Vie' },
  { id: 6, name: 'Sábado', short: 'Sáb' },
];

// Exception reasons
const EXCEPTION_REASONS = [
  'Vacaciones',
  'Enfermedad',
  'Día personal',
  'Feriado',
  'Capacitación',
  'Otro',
];

interface Schedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface ScheduleException {
  id: string;
  date: string;
  isAvailable: boolean;
  reason: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface ScheduleData {
  schedules: Schedule[];
  exceptions: ScheduleException[];
  userId: string;
}

// Default schedule times
const DEFAULT_START = '09:00';
const DEFAULT_END = '18:00';

export default function SchedulePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionReason, setExceptionReason] = useState('Vacaciones');
  const [exceptionIsAvailable, setExceptionIsAvailable] = useState(false);
  const [exceptionStartTime, setExceptionStartTime] = useState('09:00');
  const [exceptionEndTime, setExceptionEndTime] = useState('18:00');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Determine which user's schedule to show
  const targetUserId = selectedUserId || user?.id;
  const isOwnerOrDispatcher = user?.role?.toUpperCase() === 'OWNER' || user?.role?.toUpperCase() === 'DISPATCHER';

  // Fetch team members if owner/dispatcher
  const { data: teamData } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Error fetching team');
      return res.json();
    },
    enabled: isOwnerOrDispatcher,
  });

  const teamMembers = teamData?.data || [];

  // Fetch schedule data
  const { data: scheduleData, isLoading } = useQuery<{ success: boolean; data: ScheduleData }>({
    queryKey: ['employee-schedule', targetUserId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/schedule?userId=${targetUserId}`);
      if (!res.ok) throw new Error('Error fetching schedule');
      return res.json();
    },
    enabled: !!targetUserId,
  });

  const schedules = scheduleData?.data?.schedules || [];
  const exceptions = scheduleData?.data?.exceptions || [];

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async (data: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }) => {
      const res = await fetch('/api/employees/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: targetUserId }),
      });
      if (!res.ok) throw new Error('Error updating schedule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-schedule', targetUserId] });
    },
  });

  // Add exception mutation
  const addExceptionMutation = useMutation({
    mutationFn: async (data: { date: string; isAvailable: boolean; reason: string; startTime?: string; endTime?: string }) => {
      const res = await fetch('/api/employees/schedule/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: targetUserId }),
      });
      if (!res.ok) throw new Error('Error adding exception');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-schedule', targetUserId] });
      setShowExceptionModal(false);
      setExceptionDate('');
      setExceptionReason('Vacaciones');
      setExceptionIsAvailable(false);
    },
  });

  // Delete exception mutation
  const deleteExceptionMutation = useMutation({
    mutationFn: async (exceptionId: string) => {
      const res = await fetch(`/api/employees/schedule/exceptions?id=${exceptionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error deleting exception');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-schedule', targetUserId] });
    },
  });

  // Get schedule for a specific day
  const getScheduleForDay = (dayOfWeek: number): Schedule | null => {
    return schedules.find((s) => s.dayOfWeek === dayOfWeek) || null;
  };

  // Handle schedule toggle
  const handleToggleDay = (dayOfWeek: number, currentSchedule: Schedule | null) => {
    updateScheduleMutation.mutate({
      dayOfWeek,
      startTime: currentSchedule?.startTime || DEFAULT_START,
      endTime: currentSchedule?.endTime || DEFAULT_END,
      isAvailable: !currentSchedule?.isAvailable,
    });
  };

  // Handle time change
  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    const currentSchedule = getScheduleForDay(dayOfWeek);
    updateScheduleMutation.mutate({
      dayOfWeek,
      startTime: field === 'startTime' ? value : (currentSchedule?.startTime || DEFAULT_START),
      endTime: field === 'endTime' ? value : (currentSchedule?.endTime || DEFAULT_END),
      isAvailable: currentSchedule?.isAvailable ?? true,
    });
  };

  // Handle add exception
  const handleAddException = () => {
    if (!exceptionDate) return;
    addExceptionMutation.mutate({
      date: exceptionDate,
      isAvailable: exceptionIsAvailable,
      reason: exceptionReason,
      startTime: exceptionIsAvailable ? exceptionStartTime : undefined,
      endTime: exceptionIsAvailable ? exceptionEndTime : undefined,
    });
  };

  // Get exceptions for current month view
  const getMonthExceptions = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    return exceptions.filter((e) => {
      const date = new Date(e.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  };

  // Generate calendar grid for current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];

    // Add padding for days before first of month
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  // Check if a date has an exception
  const getExceptionForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return exceptions.find((e) => e.date.split('T')[0] === dateStr);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Horario</h1>
          <p className="text-gray-500">Configura tu disponibilidad semanal y días libres</p>
        </div>
        <button
          onClick={() => setShowExceptionModal(true)}
          className="btn-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar día libre
        </button>
      </div>

      {/* Team member selector for owners/dispatchers */}
      {isOwnerOrDispatcher && teamMembers.length > 0 && (
        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ver horario de:
          </label>
          <select
            value={selectedUserId || user?.id || ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className="input w-full sm:w-auto"
          >
            <option value={user?.id}>Mi horario</option>
            {teamMembers
              .filter((m: any) => m.id !== user?.id)
              .map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role === 'TECHNICIAN' ? 'Técnico' : member.role === 'DISPATCHER' ? 'Despachador' : 'Propietario'})
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Weekly schedule */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Horario Semanal</h2>
          </div>
        </div>
        <div className="divide-y">
          {DAYS_OF_WEEK.map((day) => {
            const schedule = getScheduleForDay(day.id);
            const isAvailable = schedule?.isAvailable ?? false;

            return (
              <div
                key={day.id}
                className={cn(
                  'flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4',
                  !isAvailable && 'bg-gray-50'
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleDay(day.id, schedule)}
                    disabled={updateScheduleMutation.isPending}
                    className={cn(
                      'w-12 h-6 rounded-full transition-colors relative',
                      isAvailable ? 'bg-green-500' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                        isAvailable ? 'translate-x-6' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                  <span className={cn('font-medium w-24', !isAvailable && 'text-gray-400')}>
                    {day.name}
                  </span>
                </div>

                {isAvailable ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={schedule?.startTime || DEFAULT_START}
                      onChange={(e) => handleTimeChange(day.id, 'startTime', e.target.value)}
                      className="input w-32 text-sm"
                    />
                    <span className="text-gray-500">a</span>
                    <input
                      type="time"
                      value={schedule?.endTime || DEFAULT_END}
                      onChange={(e) => handleTimeChange(day.id, 'endTime', e.target.value)}
                      className="input w-32 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">No disponible</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Exceptions calendar */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Excepciones</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1))}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-medium min-w-[140px] text-center">
              {currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1))}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mini calendar */}
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
              <div key={i} className="text-xs font-medium text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((date, i) => {
              if (!date) {
                return <div key={i} className="aspect-square" />;
              }

              const exception = getExceptionForDate(date);
              const isToday = date.toDateString() === new Date().toDateString();
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (!isPast) {
                      setExceptionDate(date.toISOString().split('T')[0]);
                      setShowExceptionModal(true);
                    }
                  }}
                  disabled={isPast}
                  className={cn(
                    'aspect-square flex items-center justify-center text-sm rounded-lg transition-colors relative',
                    isToday && 'ring-2 ring-primary-500',
                    isPast && 'text-gray-300 cursor-not-allowed',
                    !isPast && !exception && 'hover:bg-gray-100',
                    exception && !exception.isAvailable && 'bg-red-100 text-red-700',
                    exception && exception.isAvailable && 'bg-yellow-100 text-yellow-700'
                  )}
                  title={exception ? `${exception.reason || 'Excepción'}: ${exception.isAvailable ? 'Horario especial' : 'No disponible'}` : ''}
                >
                  {date.getDate()}
                  {exception && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Exceptions list */}
        {exceptions.length > 0 && (
          <div className="border-t p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Días con excepciones</h3>
            <div className="space-y-2">
              {exceptions.slice(0, 10).map((exception) => (
                <div
                  key={exception.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    exception.isAvailable ? 'bg-yellow-50' : 'bg-red-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        exception.isAvailable ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(exception.date).toLocaleDateString('es-AR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {exception.reason || 'Sin motivo'} -{' '}
                        {exception.isAvailable
                          ? `${exception.startTime} - ${exception.endTime}`
                          : 'No disponible'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteExceptionMutation.mutate(exception.id)}
                    disabled={deleteExceptionMutation.isPending}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add exception modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Agregar excepción</h3>
              <button
                onClick={() => setShowExceptionModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
              <select
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                className="input w-full"
              >
                {EXCEPTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exceptionIsAvailable}
                  onChange={(e) => setExceptionIsAvailable(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Disponible con horario especial</span>
              </label>
            </div>

            {exceptionIsAvailable && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input
                    type="time"
                    value={exceptionStartTime}
                    onChange={(e) => setExceptionStartTime(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input
                    type="time"
                    value={exceptionEndTime}
                    onChange={(e) => setExceptionEndTime(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>
            )}

            {!exceptionIsAvailable && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  Este día quedará marcado como no disponible para asignaciones de trabajo.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowExceptionModal(false)}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddException}
                disabled={!exceptionDate || addExceptionMutation.isPending}
                className="btn-primary flex-1"
              >
                {addExceptionMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
