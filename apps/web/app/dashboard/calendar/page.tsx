'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Users,
  Check,
} from 'lucide-react';
import { CalendarView, CalendarEvent } from '@/components/calendar/CalendarView';
import { JobCard } from '@/components/calendar/JobCard';
import NewJobModal from '@/components/jobs/NewJobModal';
import { getBuenosAiresNow, formatDisplayDate } from '@/lib/timezone';

interface Technician {
  id: string;
  name: string;
  avatar: string | null;
  specialty: string | null;
}

interface CalendarResponse {
  success: boolean;
  data: {
    events: CalendarEvent[];
    technicians: Technician[];
    range: { start: string; end: string };
  };
}

async function fetchCalendarEvents(
  start: Date,
  end: Date,
  technicianId?: string
): Promise<CalendarResponse> {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });
  if (technicianId) params.set('technicianId', technicianId);

  const res = await fetch(`/api/jobs/calendar?${params.toString()}`);
  if (!res.ok) throw new Error('Error cargando calendario');
  return res.json();
}

export default function CalendarPage() {
  // Initialize dates with Buenos Aires timezone
  const [currentDate, setCurrentDate] = useState(() => getBuenosAiresNow());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => getBuenosAiresNow());
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === 'month') {
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay());
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setDate(end.getDate() + (6 - end.getDay()));
    } else if (view === 'week') {
      start.setDate(start.getDate() - start.getDay());
      end.setDate(start.getDate() + 6);
    } else {
      // Day view
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [currentDate, view]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['calendar-events', dateRange.start.toISOString(), dateRange.end.toISOString(), selectedTechnicianId],
    queryFn: () => fetchCalendarEvents(dateRange.start, dateRange.end, selectedTechnicianId),
    staleTime: 30000,
  });

  const handlePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (view === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() - 1);
      }
      return newDate;
    });
  }, [view]);

  const handleNext = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (view === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    });
  }, [view]);

  const handleToday = useCallback(() => {
    setCurrentDate(getBuenosAiresNow());
    setSelectedDate(getBuenosAiresNow());
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const events = data?.data?.events || [];
  const technicians = data?.data?.technicians || [];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          <p className="text-sm text-gray-500">
            Gestión de trabajos programados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewJobModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo Trabajo
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white p-3 shadow-sm">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleToday}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Hoy
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="ml-2 text-lg font-semibold text-gray-900">
            {formatDisplayDate(currentDate, {
              month: 'long',
              year: 'numeric',
              ...(view === 'day' ? { weekday: 'long', day: 'numeric' } : {}),
            })}
          </h2>
        </div>

        {/* View switcher and filters */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${view === v
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>

          {/* Technician filter dropdown */}
          {technicians.length > 1 && (
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                className={`relative rounded-lg p-2 transition-colors ${selectedTechnicianId
                  ? 'bg-primary-100 text-primary-600'
                  : 'text-gray-500 hover:bg-gray-100'
                  }`}
                title="Filtrar por técnico"
              >
                <Users className="h-5 w-5" />
                {selectedTechnicianId && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary-600 border-2 border-white" />
                )}
              </button>

              {filterDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg bg-white shadow-lg border border-gray-200 py-2">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">Filtrar por técnico</span>
                      {selectedTechnicianId && (
                        <button
                          onClick={() => {
                            setSelectedTechnicianId(undefined);
                            setFilterDropdownOpen(false);
                          }}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedTechnicianId(undefined);
                        setFilterDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${!selectedTechnicianId
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {!selectedTechnicianId && <Check className="h-4 w-4 text-primary-600" />}
                      <span className={!selectedTechnicianId ? '' : 'ml-6'}>Todos los técnicos</span>
                    </button>
                    {technicians.map((tech) => (
                      <button
                        key={tech.id}
                        onClick={() => {
                          setSelectedTechnicianId(tech.id);
                          setFilterDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${selectedTechnicianId === tech.id
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        {selectedTechnicianId === tech.id && <Check className="h-4 w-4 text-primary-600" />}
                        <span className={selectedTechnicianId === tech.id ? '' : 'ml-6'}>{tech.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>



      {/* Calendar */}
      <div className="flex-1 rounded-lg bg-white shadow-sm overflow-hidden">
        <CalendarView
          events={events}
          currentDate={currentDate}
          view={view}
          selectedDate={view === 'month' ? selectedDate : undefined}
          onDateSelect={view === 'month' ? handleDateSelect : undefined}
          onEventClick={handleEventClick}
          isLoading={isLoading}
        />
      </div>

      {/* Job detail modal */}
      {selectedEvent && (
        <JobCard
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* New Job Modal */}
      <NewJobModal
        isOpen={isNewJobModalOpen}
        onClose={() => setIsNewJobModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        }}
      />
    </div>
  );
}
