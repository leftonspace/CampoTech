/**
 * Timezone utilities for CampoTech
 *
 * All dates/times in the application should be displayed in Buenos Aires timezone
 * regardless of the user's local timezone (note: this is not the case we need a solution)
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
