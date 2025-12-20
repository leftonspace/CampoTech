'use client';

import { useMemo } from 'react';
import { RefreshCw, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateBuenosAires, getBuenosAiresNow, TIMEZONE } from '@/lib/timezone';

// Use the shared timezone utilities
const formatLocalDate = formatDateBuenosAires;

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor?: string;
  extendedProps: {
    jobNumber: string;
    status: string;
    urgency: string;
    serviceType?: string;
    description?: string;
    customer?: {
      id: string;
      name: string;
      phone: string;
      address: unknown;
    };
    technician: {
      id: string;
      name: string;
      avatar?: string | null;
      specialty?: string | null;
    } | null;
    assignments?: Array<{
      id: string;
      technician?: {
        id: string;
        name: string;
        avatar?: string | null;
        specialty?: string | null;
      };
    }>;
    estimatedDuration?: number | null;
    scheduledTimeSlot?: { start?: string; end?: string } | null;
  };
}

interface CalendarViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  view: 'month' | 'week' | 'day';
  onEventClick: (event: CalendarEvent) => void;
  selectedDate?: Date | null;
  onDateSelect?: (date: Date) => void;
  isLoading?: boolean;
}

// Status dot colors matching the design
const STATUS_DOT_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-400',
  ASSIGNED: 'bg-purple-500',
  EN_ROUTE: 'bg-teal-500',
  IN_PROGRESS: 'bg-orange-500',
  COMPLETED: 'bg-green-500',
  CANCELLED: 'bg-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignado',
  EN_ROUTE: 'En Camino',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  INSTALACION_SPLIT: 'Instalación Split',
  REPARACION_SPLIT: 'Reparación Split',
  MANTENIMIENTO_SPLIT: 'Mantenimiento Split',
  INSTALACION_CALEFACTOR: 'Instalación Calefactor',
  REPARACION_CALEFACTOR: 'Reparación Calefactor',
  MANTENIMIENTO_CALEFACTOR: 'Mantenimiento Calefactor',
  INSTALACION: 'Instalación',
  REPARACION: 'Reparación',
  MANTENIMIENTO: 'Mantenimiento',
  DIAGNOSTICO: 'Diagnóstico',
  EMERGENCIA: 'Emergencia',
  OTRO: 'Otro',
};

export function CalendarView({
  events,
  currentDate,
  view,
  onEventClick,
  selectedDate,
  onDateSelect,
  isLoading,
}: CalendarViewProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Cargando calendario...</span>
      </div>
    );
  }

  if (view === 'month') {
    return (
      <MonthView
        events={events}
        currentDate={currentDate}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        onEventClick={onEventClick}
      />
    );
  }

  if (view === 'week') {
    return (
      <WeekView
        events={events}
        currentDate={currentDate}
        onEventClick={onEventClick}
      />
    );
  }

  return (
    <DayView
      events={events}
      currentDate={currentDate}
      onEventClick={onEventClick}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONTH VIEW - Lovable-style with dots and side panel support
// ═══════════════════════════════════════════════════════════════════════════════

function MonthView({
  events,
  currentDate,
  selectedDate,
  onDateSelect,
  onEventClick,
}: {
  events: CalendarEvent[];
  currentDate: Date;
  selectedDate?: Date | null;
  onDateSelect?: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const weeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

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
  }, [currentDate]);

  const getEventsForDate = (date: Date) => {
    const dateStr = formatLocalDate(date);
    return events.filter((event) => {
      const eventDate = event.start.split('T')[0];
      return eventDate === dateStr;
    });
  };

  const today = formatLocalDate(getBuenosAiresNow());
  const selectedDateStr = selectedDate ? formatLocalDate(selectedDate) : undefined;
  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="h-full flex">
      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
            <div key={day} className="px-2 py-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Weeks Grid */}
        <div className="flex-1 grid grid-rows-6">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-50">
              {week.map((date, dayIndex) => {
                const dateStr = formatLocalDate(date);
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDateStr;
                const dayEvents = getEventsForDate(date);

                return (
                  <button
                    key={dayIndex}
                    onClick={() => onDateSelect?.(date)}
                    className={cn(
                      'min-h-[90px] border-r border-gray-50 p-2 text-left transition-colors hover:bg-gray-50',
                      isCurrentMonth ? 'bg-white' : 'bg-gray-50/50',
                      isSelected && 'bg-teal-500 hover:bg-teal-600'
                    )}
                  >
                    {/* Day number */}
                    <div className="flex justify-end mb-2">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium',
                          isSelected
                            ? 'text-white'
                            : isToday
                              ? 'bg-teal-500 text-white'
                              : isCurrentMonth
                                ? 'text-gray-900'
                                : 'text-gray-400'
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Event dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {dayEvents.slice(0, 4).map((event) => (
                          <span
                            key={event.id}
                            className={cn(
                              'h-2.5 w-2.5 rounded-full',
                              isSelected ? 'bg-white/80' : STATUS_DOT_COLORS[event.extendedProps.status] || 'bg-gray-400'
                            )}
                          />
                        ))}
                        {dayEvents.length > 4 && (
                          <span className={cn(
                            'text-xs font-medium',
                            isSelected ? 'text-white/80' : 'text-gray-500'
                          )}>
                            +{dayEvents.length - 4}
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

      {/* Side Panel - Selected Day Details */}
      {selectedDate && (
        <div className="w-80 border-l border-gray-100 bg-white overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedDate.toLocaleDateString('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedEvents.length} trabajo{selectedEvents.length !== 1 ? 's' : ''} programado{selectedEvents.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="p-4 space-y-3">
            {selectedEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No hay trabajos para este día</p>
              </div>
            ) : (
              selectedEvents.map((event) => (
                <SidePanelJobCard
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDE PANEL JOB CARD
// ═══════════════════════════════════════════════════════════════════════════════

function SidePanelJobCard({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  const { extendedProps: job } = event;
  const startTime = new Date(event.start).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const statusDotColor = STATUS_DOT_COLORS[job.status] || 'bg-gray-400';
  const statusLabel = STATUS_LABELS[job.status] || job.status;
  const serviceLabel = job.serviceType
    ? SERVICE_TYPE_LABELS[job.serviceType] || job.serviceType
    : job.description || 'Servicio';

  // Get technician name abbreviation (first name + last initial)
  const getTechnicianAbbrev = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1][0]}.`;
    }
    return name;
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Header row: dot + time + status badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', statusDotColor)} />
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-sm">{startTime}</span>
          </div>
        </div>
        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
          {statusLabel}
        </span>
      </div>

      {/* Service type / description */}
      <h4 className="font-medium text-gray-900 mb-1.5">{serviceLabel}</h4>

      {/* Technician */}
      {job.technician ? (
        <div className="flex items-center gap-1.5 text-gray-500">
          <User className="h-3.5 w-3.5" />
          <span className="text-sm">{getTechnicianAbbrev(job.technician.name)}</span>
        </div>
      ) : job.assignments && job.assignments.length > 0 && job.assignments[0].technician ? (
        <div className="flex items-center gap-1.5 text-gray-500">
          <User className="h-3.5 w-3.5" />
          <span className="text-sm">{getTechnicianAbbrev(job.assignments[0].technician.name)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-amber-600">
          <User className="h-3.5 w-3.5" />
          <span className="text-sm">Sin asignar</span>
        </div>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function WeekView({
  events,
  currentDate,
  onEventClick,
}: {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentDate]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDateAndHour = (date: Date, hour: number) => {
    const dateStr = formatLocalDate(date);
    return events.filter((event) => {
      const eventDate = event.start.split('T')[0];
      const eventHour = new Date(event.start).getHours();
      return eventDate === dateStr && eventHour === hour;
    });
  };

  const today = formatLocalDate(getBuenosAiresNow());

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-8 border-b bg-gray-50 flex-shrink-0">
        <div className="w-16 px-2 py-2 text-center text-xs font-semibold text-gray-600">
          Hora
        </div>
        {weekDays.map((day, i) => {
          const dateStr = formatLocalDate(day);
          const isToday = dateStr === today;
          return (
            <div
              key={i}
              className={cn('px-2 py-2 text-center', isToday && 'bg-teal-50')}
            >
              <div className="text-xs text-gray-500">
                {day.toLocaleDateString('es-AR', { weekday: 'short' })}
              </div>
              <div
                className={cn(
                  'text-sm font-semibold',
                  isToday ? 'text-teal-600' : 'text-gray-900'
                )}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b min-h-[60px]">
            <div className="w-16 border-r px-2 py-1 text-right text-xs text-gray-500">
              {hour.toString().padStart(2, '0')}:00
            </div>
            {weekDays.map((day, i) => {
              const dateStr = formatLocalDate(day);
              const isToday = dateStr === today;
              const hourEvents = getEventsForDateAndHour(day, hour);

              return (
                <div
                  key={i}
                  className={cn('border-r p-0.5', isToday && 'bg-teal-50/50')}
                >
                  {hourEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      className="w-full mb-0.5 truncate rounded px-1 py-0.5 text-left text-xs text-white hover:opacity-80"
                      style={{ backgroundColor: event.backgroundColor }}
                    >
                      <span className="font-medium">{event.extendedProps.jobNumber}</span>
                      {event.extendedProps.technician && (
                        <span className="ml-1 opacity-80">
                          - {event.extendedProps.technician.name.split(' ')[0]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function DayView({
  events,
  currentDate,
  onEventClick,
}: {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dateStr = formatLocalDate(currentDate);

  const getEventsForHour = (hour: number) => {
    return events.filter((event) => {
      const eventDate = event.start.split('T')[0];
      const eventHour = new Date(event.start).getHours();
      return eventDate === dateStr && eventHour === hour;
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      {hours.map((hour) => {
        const hourEvents = getEventsForHour(hour);

        return (
          <div key={hour} className="flex border-b min-h-[80px]">
            <div className="w-20 flex-shrink-0 border-r px-3 py-2 text-right text-sm text-gray-500">
              {hour.toString().padStart(2, '0')}:00
            </div>
            <div className="flex-1 p-1">
              {hourEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="w-full mb-1 rounded-lg p-2 text-left text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: event.backgroundColor }}
                >
                  <div className="font-semibold">{event.extendedProps.jobNumber}</div>
                  <div className="text-sm opacity-90">{event.title.split(' - ')[1]}</div>
                  {event.extendedProps.technician && (
                    <div className="text-xs opacity-75 mt-1">
                      Técnico: {event.extendedProps.technician.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
