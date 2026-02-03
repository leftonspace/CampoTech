/**
 * Company Profile Configuration
 * ==============================
 * 
 * Central configuration for the simulated business.
 * Edit this file to change the company being simulated.
 */

export interface CompanyConfig {
    // Organization reference (existing org to populate)
    organizationId: string;

    // Company info
    companyName: string;
    ownerName: string;
    ownerPhone: string;

    // Business size (affects how much data is generated)
    size: 'small' | 'medium' | 'large';

    // Industry focus
    primaryTrades: string[];

    // Location (for realistic addresses)
    region: 'buenos_aires' | 'cordoba' | 'rosario' | 'mendoza';

    // Timeline for historical data
    historyStartDate: Date;
    historyEndDate: Date;
}

/**
 * Size configurations
 */
export const SIZE_CONFIG = {
    small: {
        technicians: 5,
        vehicles: 3,
        customers: 30,
        historicalJobs: 150,
        pendingJobs: 15,
        inventoryProducts: 50,
    },
    medium: {
        technicians: 15,
        vehicles: 8,
        customers: 100,
        historicalJobs: 500,
        pendingJobs: 40,
        inventoryProducts: 150,
    },
    large: {
        technicians: 40,
        vehicles: 20,
        customers: 300,
        historicalJobs: 1500,
        pendingJobs: 100,
        inventoryProducts: 400,
    },
};

/**
 * Default company config for Kevin Conta's organization
 */
export const DEFAULT_CONFIG: CompanyConfig = {
    // Your organization ID
    organizationId: 'cmkzp66wa000bpvvd805x5ewo',

    // Company details
    companyName: 'Kevin Conta',
    ownerName: 'Kevin Conta',
    ownerPhone: '+18199685685',

    // Medium-sized business for realistic demo
    size: 'medium',

    // Multi-trade company
    primaryTrades: ['REFRIGERACION', 'ELECTRICISTA', 'PLOMERO', 'GASISTA'],

    // Buenos Aires region
    region: 'buenos_aires',

    // 6 months of history
    historyStartDate: new Date('2025-07-01'),
    historyEndDate: new Date('2026-01-29'),
};

export function getConfig(): CompanyConfig {
    return DEFAULT_CONFIG;
}

export function getSizeConfig(size: CompanyConfig['size']) {
    return SIZE_CONFIG[size];
}
