'use client';

/**
 * Shared Job Form Types, Constants & Utilities
 * =============================================
 * 
 * Extracted from NewJobModal and EditJobModal to eliminate duplication.
 * Both modals import from this single source of truth.
 */

// ─── Interfaces ──────────────────────────────────────────────────

/** Customer address structure */
export interface CustomerAddress {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    fullAddress?: string;
}

/** Customer record used in job form */
export interface Customer {
    id: string;
    name: string;
    phone: string;
    address?: CustomerAddress;
    customerType?: string;
}

/** Visit structure for multi-visit jobs */
export interface JobVisit {
    id: string;
    date: string;
    endDate: string; // Optional: if set, creates visits for each day in range
    timeStart: string;
    timeEnd: string;
    timePeriodStart: 'AM' | 'PM';
    timePeriodEnd: 'AM' | 'PM';
    technicianIds: string[];
    vehicleId: string | null; // Legacy - kept for compatibility
    vehicleAssignments: { vehicleId: string; driverIds: string[] }[]; // Multiple vehicles with drivers
    // Recurrence settings per visit
    isRecurring: boolean;
    recurrencePattern: string;
    recurrenceCount: number;
    // Per-visit pricing (Phase 1 - Jan 2026)
    estimatedPrice: string;
    requiresDeposit: boolean;
    depositAmount: string;
}

/** Pricing mode type (Phase 1 - Jan 2026) */
export type PricingMode = 'FIXED_TOTAL' | 'PER_VISIT' | 'HYBRID';

// ─── Constants ───────────────────────────────────────────────────

/** Customer type labels for display */
export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
    PARTICULAR: 'Particular',
    CONSORCIO: 'Consorcio',
    COUNTRY: 'Country',
    COMERCIO: 'Comercio',
    INDUSTRIAL: 'Industrial',
    INSTITUCIONAL: 'Institucional',
    ADMINISTRADORA: 'Administradora',
    CONSTRUCTORA: 'Constructora',
};

/** Recurrence pattern options for visit scheduling */
export const RECURRENCE_PATTERNS = [
    { value: 'WEEKLY', label: 'Semanal' },
    { value: 'BIWEEKLY', label: 'Quincenal' },
    { value: 'MONTHLY', label: 'Mensual' },
    { value: 'QUARTERLY', label: 'Trimestral' },
    { value: 'BIANNUAL', label: 'Semestral' },
    { value: 'ANNUAL', label: 'Anual' },
] as const;

// ─── Factory Functions ───────────────────────────────────────────

/** Creates a new empty visit with sensible defaults */
export const createEmptyVisit = (): JobVisit => ({
    id: Math.random().toString(36).substring(7),
    date: '',
    endDate: '',
    timeStart: '',
    timeEnd: '',
    timePeriodStart: 'AM',
    timePeriodEnd: 'PM',
    technicianIds: [],
    vehicleId: null,
    vehicleAssignments: [],
    isRecurring: false,
    recurrencePattern: 'MONTHLY',
    recurrenceCount: 6,
    // Per-visit pricing (Phase 1 - Jan 2026)
    estimatedPrice: '',
    requiresDeposit: false,
    depositAmount: '',
});

// ─── Utility Functions ───────────────────────────────────────────

/**
 * Expands a date range into an array of individual date strings (YYYY-MM-DD).
 * Max 30 days to prevent runaway loops.
 */
export const expandDateRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Ensure we don't create too many dates (max 30 days)
    const maxDays = 30;
    const current = new Date(start);
    let count = 0;

    while (current <= end && count < maxDays) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
        count++;
    }

    return dates;
};

/**
 * Converts 12-hour time format to 24-hour format string for API calls.
 * Handles flexible input: "1", "11", "1:30", "11:30"
 */
export const convertTo24h = (time12h: string, period: 'AM' | 'PM'): string => {
    if (!time12h) return '';
    // Handle flexible input: "1", "11", "1:30", "11:30"
    const parts = time12h.split(':');
    let hours = parseInt(parts[0]) || 0;
    const minutes = parts[1] ? parseInt(parts[1]) || 0 : 0;

    // Normalize hours > 12 to valid 12h format (e.g., 15 -> 3)
    // This handles cases where user types in 24h format by mistake
    if (hours > 12) {
        hours = hours % 12 || 12;
    }

    let h = hours;
    if (period === 'PM' && hours !== 12) h += 12;
    if (period === 'AM' && hours === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Parses a 24h time string into 12h format with AM/PM period.
 * Used when loading existing job data into the form.
 */
export const parseTimeTo12h = (t: string | undefined): { time: string; period: 'AM' | 'PM' } => {
    if (!t) return { time: '', period: 'AM' };
    const [h, m] = t.split(':').map(Number);
    const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return { time: `${hour12}${m ? `:${String(m).padStart(2, '0')}` : ''}`, period };
};
