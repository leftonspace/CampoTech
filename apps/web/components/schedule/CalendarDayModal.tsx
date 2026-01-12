'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Calendar,
  User,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface CalendarDayModalProps {
  date: Date;
  employees: Employee[];
  schedules: ScheduleEntry[];
  exceptions: ScheduleException[];
  canEdit: boolean;
  onClose: () => void;
  onUpdate: () => void;
  preSelectedEmployee?: string; // Pre-fill employee when clicking from calendar row
}

// Exception reasons
const EXCEPTION_REASONS = [
  'Vacaciones',
  'Enfermedad',
  'Día personal',
  'Feriado',
  'Capacitación',
  'Otro',
];

// Reason to status mapping
const REASON_TO_STATUS: Record<string, string> = {
  'Vacaciones': 'vacation',
  'Enfermedad': 'sick',
  'Día personal': 'dayoff',
  'Feriado': 'dayoff',
  'Capacitación': 'available',
  'Otro': 'dayoff',
};

// Get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'available': return 'bg-green-100 text-green-700 border-green-200';
    case 'special': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'vacation': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'sick': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'dayoff': return 'bg-gray-100 text-gray-600 border-gray-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'available': return 'Disponible';
    case 'special': return 'Horario especial';
    case 'vacation': return 'Vacaciones';
    case 'sick': return 'Enfermedad';
    case 'dayoff': return 'Día libre';
    default: return 'No disponible';
  }
};

export default function CalendarDayModal({
  date,
  employees,
  schedules,
  exceptions,
  canEdit,
  onClose,
  onUpdate,
  preSelectedEmployee,
}: CalendarDayModalProps) {
  const queryClient = useQueryClient();
  // Auto-open exception form if preSelectedEmployee is provided
  const [showAddException, setShowAddException] = useState(!!preSelectedEmployee);
  const [selectedEmployee, setSelectedEmployee] = useState(preSelectedEmployee || '');
  const [exceptionReason, setExceptionReason] = useState('Vacaciones');
  const [exceptionIsAvailable, setExceptionIsAvailable] = useState(false);
  const [exceptionStartTime, setExceptionStartTime] = useState('09:00');
  const [exceptionEndTime, setExceptionEndTime] = useState('18:00');

  const dateStr = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay();
  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

  // Add exception mutation
  const addExceptionMutation = useMutation({
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
      if (!res.ok) throw new Error('Error adding exception');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['employee-schedule'] });
      setShowAddException(false);
      setSelectedEmployee('');
      onUpdate();
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
      queryClient.invalidateQueries({ queryKey: ['team-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['employee-schedule'] });
      onUpdate();
    },
  });

  // Get employee status for this day
  const getEmployeeStatus = (employeeId: string) => {
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
          isException: true,
          exceptionId: exception.id,
        };
      } else {
        return {
          status: 'special',
          reason: exception.reason,
          startTime: exception.startTime,
          endTime: exception.endTime,
          isException: true,
          exceptionId: exception.id,
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
        isException: false,
        exceptionId: null,
      };
    }

    return {
      status: 'dayoff',
      reason: null,
      startTime: null,
      endTime: null,
      isException: false,
      exceptionId: null,
    };
  };

  // Handle add exception
  const handleAddException = () => {
    if (!selectedEmployee) return;

    addExceptionMutation.mutate({
      userId: selectedEmployee,
      date: dateStr,
      isAvailable: exceptionIsAvailable,
      reason: exceptionReason,
      startTime: exceptionIsAvailable ? exceptionStartTime : undefined,
      endTime: exceptionIsAvailable ? exceptionEndTime : undefined,
    });
  };

  // Quick action to mark vacation/sick for employee
  const handleQuickAction = (employeeId: string, reason: string) => {
    addExceptionMutation.mutate({
      userId: employeeId,
      date: dateStr,
      isAvailable: false,
      reason,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary-600" />
            <div>
              <h3 className="font-semibold text-gray-900">
                {date.toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
              <p className="text-sm text-gray-500">
                {employees.length} empleado(s) en el equipo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Employee list */}
          <div className="space-y-2">
            {employees.map(emp => {
              const status = getEmployeeStatus(emp.id);
              return (
                <div
                  key={emp.id}
                  className={cn(
                    'p-3 rounded-lg border',
                    getStatusColor(status.status)
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/50">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-sm opacity-80">
                          {getStatusLabel(status.status)}
                          {status.reason && ` - ${status.reason}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {status.startTime && status.endTime && (
                        <span className="text-xs bg-white/50 px-2 py-1 rounded">
                          {status.startTime} - {status.endTime}
                        </span>
                      )}
                      {canEdit && status.isException && status.exceptionId && (
                        <button
                          onClick={() => deleteExceptionMutation.mutate(status.exceptionId!)}
                          disabled={deleteExceptionMutation.isPending}
                          className="p-1.5 hover:bg-white/50 rounded transition-colors"
                          title="Eliminar excepción"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick actions for available employees */}
                  {canEdit && !isPast && !status.isException && status.status === 'available' && (
                    <div className="mt-2 pt-2 border-t border-white/30 flex gap-2">
                      <button
                        onClick={() => handleQuickAction(emp.id, 'Vacaciones')}
                        disabled={addExceptionMutation.isPending}
                        className="text-xs px-2 py-1 bg-yellow-200/50 hover:bg-yellow-200 rounded transition-colors"
                      >
                        + Vacaciones
                      </button>
                      <button
                        onClick={() => handleQuickAction(emp.id, 'Enfermedad')}
                        disabled={addExceptionMutation.isPending}
                        className="text-xs px-2 py-1 bg-orange-200/50 hover:bg-orange-200 rounded transition-colors"
                      >
                        + Enfermedad
                      </button>
                      <button
                        onClick={() => handleQuickAction(emp.id, 'Día personal')}
                        disabled={addExceptionMutation.isPending}
                        className="text-xs px-2 py-1 bg-gray-200/50 hover:bg-gray-200 rounded transition-colors"
                      >
                        + Día libre
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add exception form */}
          {canEdit && !isPast && (
            <div className="border-t pt-4">
              {!showAddException ? (
                <button
                  onClick={() => setShowAddException(true)}
                  className="w-full btn-outline flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar excepción personalizada
                </button>
              ) : (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">Nueva excepción</h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Empleado
                    </label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Seleccionar empleado...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo
                    </label>
                    <select
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      className="input w-full"
                    >
                      {EXCEPTION_REASONS.map(reason => (
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
                        className="w-4 h-4 rounded border-gray-300 text-primary-600"
                      />
                      <span className="text-sm text-gray-700">
                        Disponible con horario especial
                      </span>
                    </label>
                  </div>

                  {exceptionIsAvailable && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Desde
                        </label>
                        <input
                          type="time"
                          value={exceptionStartTime}
                          onChange={(e) => setExceptionStartTime(e.target.value)}
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hasta
                        </label>
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
                        Este día quedará marcado como no disponible.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddException(false)}
                      className="btn-outline flex-1"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddException}
                      disabled={!selectedEmployee || addExceptionMutation.isPending}
                      className="btn-primary flex-1"
                    >
                      {addExceptionMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Past date notice */}
          {isPast && (
            <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-gray-500" />
              <p className="text-sm text-gray-600">
                No se pueden modificar fechas pasadas.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-outline w-full">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
