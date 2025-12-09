/**
 * Business Hours Service
 * ======================
 *
 * Phase 9.7: Argentine Communication Localization
 * Manages business hours, auto-responder logic, and holiday handling for Argentina.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS - Argentine Defaults
// ═══════════════════════════════════════════════════════════════════════════════

export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

// Default business hours for Argentine service companies
export const DEFAULT_BUSINESS_HOURS = {
  monday: { open: '08:00', close: '18:00', enabled: true },
  tuesday: { open: '08:00', close: '18:00', enabled: true },
  wednesday: { open: '08:00', close: '18:00', enabled: true },
  thursday: { open: '08:00', close: '18:00', enabled: true },
  friday: { open: '08:00', close: '18:00', enabled: true },
  saturday: { open: '09:00', close: '13:00', enabled: true },
  sunday: { open: null, close: null, enabled: false },
};

// Argentine national holidays 2025 (fixed and movable)
export const ARGENTINA_HOLIDAYS_2025 = [
  { date: '2025-01-01', name: 'Año Nuevo' },
  { date: '2025-02-24', name: 'Carnaval' },
  { date: '2025-02-25', name: 'Carnaval' },
  { date: '2025-03-24', name: 'Día de la Memoria' },
  { date: '2025-04-02', name: 'Día del Veterano y de los Caídos en Malvinas' },
  { date: '2025-04-18', name: 'Viernes Santo' },
  { date: '2025-05-01', name: 'Día del Trabajador' },
  { date: '2025-05-25', name: 'Día de la Revolución de Mayo' },
  { date: '2025-06-16', name: 'Paso a la Inmortalidad del Gral. Güemes' },
  { date: '2025-06-20', name: 'Paso a la Inmortalidad del Gral. Belgrano' },
  { date: '2025-07-09', name: 'Día de la Independencia' },
  { date: '2025-08-18', name: 'Paso a la Inmortalidad del Gral. San Martín' },
  { date: '2025-10-12', name: 'Día del Respeto a la Diversidad Cultural' },
  { date: '2025-11-20', name: 'Día de la Soberanía Nacional' },
  { date: '2025-12-08', name: 'Inmaculada Concepción' },
  { date: '2025-12-25', name: 'Navidad' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DayHours {
  open: string | null;
  close: string | null;
  enabled: boolean;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface BusinessHoursConfig {
  hours: BusinessHours;
  timezone: string;
  holidaysEnabled: boolean;
  customHolidays?: string[];
  autoResponderEnabled: boolean;
  emergencyPhone?: string;
}

export interface BusinessHoursCheck {
  isOpen: boolean;
  currentDay: string;
  currentTime: string;
  todayHours: DayHours | null;
  nextOpenTime?: string;
  reason: 'open' | 'closed' | 'holiday' | 'after_hours' | 'before_hours';
  holidayName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS HOURS CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if business is currently open
 */
export async function isBusinessOpen(organizationId: string): Promise<BusinessHoursCheck> {
  const config = await getBusinessHoursConfig(organizationId);
  return checkBusinessHours(config);
}

/**
 * Check business hours given a config
 */
export function checkBusinessHours(config: BusinessHoursConfig): BusinessHoursCheck {
  const now = new Date();
  const argentinaTime = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const parts = Object.fromEntries(argentinaTime.map((p) => [p.type, p.value]));
  const currentDay = parts.weekday.toLowerCase() as keyof BusinessHours;
  const currentTime = `${parts.hour}:${parts.minute}`;

  // Check for holiday
  if (config.holidaysEnabled) {
    const holidayCheck = checkHoliday(now, config);
    if (holidayCheck.isHoliday) {
      return {
        isOpen: false,
        currentDay,
        currentTime,
        todayHours: null,
        reason: 'holiday',
        holidayName: holidayCheck.name,
        nextOpenTime: getNextOpenTime(config, now),
      };
    }
  }

  // Get today's hours
  const todayHours = config.hours[currentDay];

  if (!todayHours || !todayHours.enabled) {
    return {
      isOpen: false,
      currentDay,
      currentTime,
      todayHours: null,
      reason: 'closed',
      nextOpenTime: getNextOpenTime(config, now),
    };
  }

  // Check if within business hours
  const openTime = todayHours.open!;
  const closeTime = todayHours.close!;

  if (currentTime < openTime) {
    return {
      isOpen: false,
      currentDay,
      currentTime,
      todayHours,
      reason: 'before_hours',
      nextOpenTime: openTime,
    };
  }

  if (currentTime >= closeTime) {
    return {
      isOpen: false,
      currentDay,
      currentTime,
      todayHours,
      reason: 'after_hours',
      nextOpenTime: getNextOpenTime(config, now),
    };
  }

  return {
    isOpen: true,
    currentDay,
    currentTime,
    todayHours,
    reason: 'open',
  };
}

/**
 * Check if date is a holiday
 */
function checkHoliday(
  date: Date,
  config: BusinessHoursConfig
): { isHoliday: boolean; name?: string } {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
  }).format(date);

  // Check national holidays
  const nationalHoliday = ARGENTINA_HOLIDAYS_2025.find((h) => h.date === dateStr);
  if (nationalHoliday) {
    return { isHoliday: true, name: nationalHoliday.name };
  }

  // Check custom holidays
  if (config.customHolidays?.includes(dateStr)) {
    return { isHoliday: true, name: 'Feriado especial' };
  }

  return { isHoliday: false };
}

/**
 * Get next time the business opens
 */
function getNextOpenTime(config: BusinessHoursConfig, from: Date): string {
  const days: (keyof BusinessHours)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  const currentDayIndex = from.getDay();

  // Check remaining days this week and next
  for (let i = 1; i <= 7; i++) {
    const checkDayIndex = (currentDayIndex + i) % 7;
    const dayName = days[checkDayIndex];
    const dayHours = config.hours[dayName];

    if (dayHours.enabled && dayHours.open) {
      const targetDate = new Date(from);
      targetDate.setDate(targetDate.getDate() + i);

      const weekdayNames: Record<number, string> = {
        0: 'Domingo',
        1: 'Lunes',
        2: 'Martes',
        3: 'Miércoles',
        4: 'Jueves',
        5: 'Viernes',
        6: 'Sábado',
      };

      return `${weekdayNames[checkDayIndex]} a las ${dayHours.open} hs`;
    }
  }

  return 'Próximamente';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get business hours config for organization
 */
export async function getBusinessHoursConfig(
  organizationId: string
): Promise<BusinessHoursConfig> {
  try {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        businessHours: true,
        timezone: true,
        phone: true,
      },
    });

    if (!org?.businessHours) {
      return getDefaultConfig();
    }

    const stored = org.businessHours as Record<string, unknown>;

    return {
      hours: (stored.hours as BusinessHours) || DEFAULT_BUSINESS_HOURS,
      timezone: org.timezone || ARGENTINA_TIMEZONE,
      holidaysEnabled: (stored.holidaysEnabled as boolean) ?? true,
      customHolidays: (stored.customHolidays as string[]) || [],
      autoResponderEnabled: (stored.autoResponderEnabled as boolean) ?? true,
      emergencyPhone: org.phone || undefined,
    };
  } catch (error) {
    log.error('Error getting business hours config', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return getDefaultConfig();
  }
}

/**
 * Update business hours config
 */
export async function updateBusinessHoursConfig(
  organizationId: string,
  updates: Partial<BusinessHoursConfig>
): Promise<BusinessHoursConfig> {
  const current = await getBusinessHoursConfig(organizationId);

  const updated: BusinessHoursConfig = {
    ...current,
    ...updates,
  };

  await db.organization.update({
    where: { id: organizationId },
    data: {
      businessHours: {
        hours: updated.hours,
        holidaysEnabled: updated.holidaysEnabled,
        customHolidays: updated.customHolidays,
        autoResponderEnabled: updated.autoResponderEnabled,
      },
      timezone: updated.timezone,
    },
  });

  log.info('Updated business hours config', { organizationId });

  return updated;
}

/**
 * Get default config for new organizations
 */
function getDefaultConfig(): BusinessHoursConfig {
  return {
    hours: DEFAULT_BUSINESS_HOURS,
    timezone: ARGENTINA_TIMEZONE,
    holidaysEnabled: true,
    customHolidays: [],
    autoResponderEnabled: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-RESPONDER MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get auto-responder message based on business hours status
 */
export function getAutoResponderMessage(
  check: BusinessHoursCheck,
  config: BusinessHoursConfig
): string {
  const emergencyLine = config.emergencyPhone
    ? `\n\nPara emergencias llamá al ${config.emergencyPhone}.`
    : '';

  switch (check.reason) {
    case 'holiday':
      return (
        `¡Hola! 👋 Hoy ${check.holidayName ? `(${check.holidayName}) ` : ''}` +
        `no estamos atendiendo.\n\n` +
        `Volvemos ${check.nextOpenTime}.${emergencyLine}`
      );

    case 'after_hours':
      return (
        `¡Hola! 👋 Gracias por escribirnos.\n\n` +
        `Nuestro horario de atención terminó a las ${check.todayHours?.close} hs.\n` +
        `Volvemos ${check.nextOpenTime}.\n\n` +
        `Te respondemos a la brevedad cuando retomemos.${emergencyLine}`
      );

    case 'before_hours':
      return (
        `¡Hola! 👋 Gracias por escribirnos.\n\n` +
        `Todavía no arrancamos, abrimos a las ${check.nextOpenTime} hs.\n` +
        `Te respondemos cuando estemos online.${emergencyLine}`
      );

    case 'closed':
      return (
        `¡Hola! 👋 Hoy no estamos atendiendo.\n\n` +
        `Volvemos ${check.nextOpenTime}.${emergencyLine}`
      );

    default:
      return '';
  }
}

/**
 * Format business hours for display
 */
export function formatBusinessHoursForDisplay(hours: BusinessHours): string {
  const dayNames: Record<keyof BusinessHours, string> = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  const lines: string[] = [];

  for (const [day, schedule] of Object.entries(hours) as [keyof BusinessHours, DayHours][]) {
    if (schedule.enabled && schedule.open && schedule.close) {
      lines.push(`${dayNames[day]}: ${schedule.open} - ${schedule.close} hs`);
    } else {
      lines.push(`${dayNames[day]}: Cerrado`);
    }
  }

  return lines.join('\n');
}
