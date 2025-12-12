'use client';

import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

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
  isLoading?: boolean;
}

export function CalendarView({
  events,
  currentDate,
  view,
  onEventClick,
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

function MonthView({
  events,
  currentDate,
  onEventClick,
}: {
  events: CalendarEvent[];
  currentDate: Date;
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
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((event) => {
      const eventDate = event.start.split('T')[0];
      return eventDate === dateStr;
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
          <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-600">
            {day}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 grid grid-rows-6">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b">
            {week.map((date, dayIndex) => {
              const dateStr = date.toISOString().split('T')[0];
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isToday = dateStr === today;
              const dayEvents = getEventsForDate(date);

              return (
                <div
                  key={dayIndex}
                  className={`min-h-[80px] border-r p-1 ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div
                    className={`mb-1 text-right text-xs font-medium ${
                      isToday
                        ? 'inline-block rounded-full bg-primary-600 px-1.5 py-0.5 text-white'
                        : isCurrentMonth
                          ? 'text-gray-900'
                          : 'text-gray-400'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="w-full truncate rounded px-1 py-0.5 text-left text-xs text-white hover:opacity-80"
                        style={{ backgroundColor: event.backgroundColor }}
                      >
                        {event.extendedProps.jobNumber}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500 px-1">
                        +{dayEvents.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const hours = Array.from({ length: 24 }, (_, i) => i); // 0-23 (full 24 hours)

  const getEventsForDateAndHour = (date: Date, hour: number) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((event) => {
      const eventDate = event.start.split('T')[0];
      const eventHour = new Date(event.start).getHours();
      return eventDate === dateStr && eventHour === hour;
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-8 border-b bg-gray-50 flex-shrink-0">
        <div className="w-16 px-2 py-2 text-center text-xs font-semibold text-gray-600">
          Hora
        </div>
        {weekDays.map((day, i) => {
          const dateStr = day.toISOString().split('T')[0];
          const isToday = dateStr === today;
          return (
            <div
              key={i}
              className={`px-2 py-2 text-center ${isToday ? 'bg-primary-50' : ''}`}
            >
              <div className="text-xs text-gray-500">
                {day.toLocaleDateString('es-AR', { weekday: 'short' })}
              </div>
              <div
                className={`text-sm font-semibold ${
                  isToday ? 'text-primary-600' : 'text-gray-900'
                }`}
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
              const dateStr = day.toISOString().split('T')[0];
              const isToday = dateStr === today;
              const hourEvents = getEventsForDateAndHour(day, hour);

              return (
                <div
                  key={i}
                  className={`border-r p-0.5 ${isToday ? 'bg-primary-50/50' : ''}`}
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

function DayView({
  events,
  currentDate,
  onEventClick,
}: {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0-23 (full 24 hours)
  const dateStr = currentDate.toISOString().split('T')[0];

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
