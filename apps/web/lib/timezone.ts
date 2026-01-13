/**
 * Timezone utilities for CampoTech
 *
 * All dates/times in the application are displayed in Buenos Aires timezone
 * regardless of the user's local timezone.
 */

// Buenos Aires timezone (Argentina Standard Time, UTC-3)
export const TIMEZONE = 'America/Buenos_Aires';
export const LOCALE = 'es-AR';

/**
 * Get the current date/time in Buenos Aires timezone
 * Returns a Date object adjusted to Buenos Aires time
 */
export function getBuenosAiresNow(): Date {
  const now = new Date();
  const buenosAiresStr = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  return new Date(buenosAiresStr);
}

/**
 * Get today's date as YYYY-MM-DD string in Buenos Aires timezone
 */
export function getTodayStringBuenosAires(): string {
  return formatDateBuenosAires(new Date());
}

/**
 * Format a date as YYYY-MM-DD in Buenos Aires timezone
 */
export function formatDateBuenosAires(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Returns YYYY-MM-DD format
}

/**
 * Check if a date is today or in the future (Buenos Aires timezone)
 */
export function isDateTodayOrFutureBuenosAires(date: Date): boolean {
  const todayStr = getTodayStringBuenosAires();
  const dateStr = formatDateBuenosAires(date);
  return dateStr >= todayStr;
}

/**
 * Check if a date is today in Buenos Aires timezone
 */
export function isDateTodayBuenosAires(date: Date): boolean {
  const todayStr = getTodayStringBuenosAires();
  const dateStr = formatDateBuenosAires(date);
  return dateStr === todayStr;
}

/**
 * Format a date for display in Buenos Aires timezone
 */
export function formatDisplayDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    ...options,
  });
}

/**
 * Format a time for display in Buenos Aires timezone
 */
export function formatDisplayTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleTimeString(LOCALE, {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Get date parts in Buenos Aires timezone
 */
export function getDatePartsBuenosAires(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
  };
}

/**
 * Parse a date string with optional time as Argentina timezone.
 * 
 * This combines the selected date with the actual start time to create
 * an accurate datetime. If no time is provided, defaults to noon to prevent
 * timezone-related date shifts.
 * 
 * USE THIS for all user-selected dates to prevent day-shift bugs!
 * 
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Optional time in HH:MM format (24h)
 * @returns Date object representing the datetime in Argentina timezone
 * 
 * Examples:
 * - parseDateTimeAsArgentina("2026-01-12", "09:00") → 2026-01-12T09:00:00-03:00
 * - parseDateTimeAsArgentina("2026-01-12") → 2026-01-12T12:00:00-03:00 (noon fallback)
 */
export function parseDateTimeAsArgentina(dateStr: string, timeStr?: string | null): Date {
  const time = timeStr || '12:00'; // Default to noon if no time provided
  return new Date(`${dateStr}T${time}:00-03:00`);
}

