'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { cn, JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@/lib/utils';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
  Clock,
  User,
} from 'lucide-react';
import { Job } from '@/types';

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  jobs: Job[];
}

export default function JobsCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Calculate date range for the current month view
  const { startDate, endDate } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Start from the beginning of the week of the first day of the month
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const start = new Date(year, month, 1 - startOffset);

    // End at the end of the week of the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const endOffset = 6 - lastDay.getDay();
    const end = new Date(year, month + 1, endOffset);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [currentDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['jobs-calendar', startDate, endDate],
    queryFn: () => api.jobs.calendar(startDate, endDate),
  });

  const jobs = (data?.data as Job[]) || [];

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        jobs: jobs.filter((job) => isSameDay(job.scheduledDate, date)),
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        jobs: jobs.filter((job) => isSameDay(job.scheduledDate, date)),
      });
    }

    // Next month days (fill to 42 days = 6 weeks)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        jobs: jobs.filter((job) => isSameDay(job.scheduledDate, date)),
      });
    }

    return days;
  }, [currentDate, jobs]);

  const selectedDayJobs = useMemo(() => {
    if (!selectedDate) return [];
    return jobs.filter((job) => isSameDay(job.scheduledDate, selectedDate));
  }, [selectedDate, jobs]);

  const navigateMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/jobs"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendario de trabajos</h1>
            <p className="text-gray-500">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/jobs" className="btn-outline">
            <List className="mr-2 h-4 w-4" />
            Vista lista
          </Link>
          <Link href="/dashboard/jobs/new" className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo trabajo
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="card">
            {/* Calendar header */}
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="rounded-md p-2 hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => navigateMonth(1)}
                  className="rounded-md p-2 hover:bg-gray-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="ml-2 text-lg font-semibold">
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
              </div>
              <button onClick={goToToday} className="btn-outline text-sm">
                Hoy
              </button>
            </div>

            {/* Calendar grid */}
            <div className="p-4">
              {/* Day headers */}
              <div className="mb-2 grid grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-xs font-medium uppercase text-gray-500"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              {isLoading ? (
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square animate-pulse rounded-lg bg-gray-100"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(day.date)}
                      className={cn(
                        'relative aspect-square rounded-lg p-1 text-left transition-colors',
                        day.isCurrentMonth ? 'bg-white' : 'bg-gray-50',
                        day.isToday && 'ring-2 ring-primary-500',
                        selectedDate && isSameDay(selectedDate, day.date) && 'bg-primary-50',
                        'hover:bg-gray-100'
                      )}
                    >
                      <span
                        className={cn(
                          'text-sm font-medium',
                          day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                          day.isToday && 'text-primary-600'
                        )}
                      >
                        {day.date.getDate()}
                      </span>
                      {day.jobs.length > 0 && (
                        <div className="absolute bottom-1 left-1 right-1">
                          <div className="flex flex-wrap gap-0.5">
                            {day.jobs.slice(0, 3).map((job, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full',
                                  getJobDotColor(job.status)
                                )}
                              />
                            ))}
                            {day.jobs.length > 3 && (
                              <span className="text-[10px] text-gray-500">
                                +{day.jobs.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="border-t p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span>Pendiente</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span>Programado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-purple-500" />
                  <span>En camino</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                  <span>En trabajo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span>Completado</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected day sidebar */}
        <div className="lg:col-span-1">
          <div className="card sticky top-4">
            <div className="border-b p-4">
              <h2 className="font-medium text-gray-900">
                {selectedDate
                  ? formatFullDate(selectedDate)
                  : 'Seleccioná un día'}
              </h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {selectedDate ? (
                selectedDayJobs.length > 0 ? (
                  <div className="divide-y">
                    {selectedDayJobs.map((job) => (
                      <Link
                        key={job.id}
                        href={`/dashboard/jobs/${job.id}`}
                        className="block p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'mt-1 h-2 w-2 shrink-0 rounded-full',
                              getJobDotColor(job.status)
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-900">
                              {job.title}
                            </p>
                            {job.customer && (
                              <p className="truncate text-sm text-gray-500">
                                {job.customer.name}
                              </p>
                            )}
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                              {job.scheduledTimeStart && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {job.scheduledTimeStart}
                                </span>
                              )}
                              {job.assignedTo && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {job.assignedTo.name}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                'mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                JOB_STATUS_COLORS[job.status]
                              )}
                            >
                              {JOB_STATUS_LABELS[job.status]}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">Sin trabajos programados</p>
                    <Link
                      href={`/dashboard/jobs/new?date=${selectedDate.toISOString().split('T')[0]}`}
                      className="btn-primary mt-4 inline-flex"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agendar trabajo
                    </Link>
                  </div>
                )
              ) : (
                <div className="p-8 text-center text-gray-500">
                  Hacé clic en un día para ver los trabajos
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function isSameDay(dateStr: string | Date | null | undefined, date: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function getJobDotColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500';
    case 'scheduled':
      return 'bg-blue-500';
    case 'en_camino':
      return 'bg-purple-500';
    case 'working':
      return 'bg-orange-500';
    case 'completed':
      return 'bg-green-500';
    case 'cancelled':
      return 'bg-gray-500';
    default:
      return 'bg-gray-400';
  }
}
