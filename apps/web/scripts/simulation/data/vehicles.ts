/**
 * Vehicle Data
 * =============
 * 
 * Raw vehicle data for simulation.
 */

export interface VehicleTemplate {
    plateNumber: string;
    make: string;
    model: string;
    year: number;
    color: string;
    vin: string;
    fuelType: 'GASOLINE' | 'DIESEL' | 'GNC' | 'HYBRID' | 'ELECTRIC';
    currentMileage: number;
    isCompanyOwned: boolean;
    insuranceCompany: string;
    insurancePolicy: string;
    insuranceExpiry: string;
    vtvExpiry: string;
    registrationExpiry: string;
    notes: string;
}

/**
 * 8 Vehicles for medium company
 */
export const VEHICLES: VehicleTemplate[] = [
    // ═══════════════════════════════════════════════════════════════════════════════
    // COMPANY VEHICLES
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        plateNumber: 'AA 123 BB',
        make: 'Renault',
        model: 'Kangoo',
        year: 2022,
        color: 'Blanco',
        vin: 'VF1FC0JEF63456789',
        fuelType: 'DIESEL',
        currentMileage: 45000,
        isCompanyOwned: true,
        insuranceCompany: 'La Segunda',
        insurancePolicy: 'POL-2024-001234',
        insuranceExpiry: '2026-06-15',
        vtvExpiry: '2026-03-20',
        registrationExpiry: '2026-12-01',
        notes: 'Vehículo principal para trabajos de refrigeración. Equipado con herramientas.',
    },
    {
        plateNumber: 'AB 456 CD',
        make: 'Fiat',
        model: 'Fiorino',
        year: 2021,
        color: 'Blanco',
        vin: '9BD37400JA2345678',
        fuelType: 'GASOLINE',
        currentMileage: 62000,
        isCompanyOwned: true,
        insuranceCompany: 'Federación Patronal',
        insurancePolicy: 'POL-2024-002345',
        insuranceExpiry: '2026-08-01',
        vtvExpiry: '2026-05-15',
        registrationExpiry: '2026-10-20',
        notes: 'Utilitario compacto. Ideal para trabajos en zonas céntricas.',
    },
    {
        plateNumber: 'AC 789 EF',
        make: 'Volkswagen',
        model: 'Saveiro',
        year: 2023,
        color: 'Gris',
        vin: '9BWAB45U4PT123456',
        fuelType: 'GASOLINE',
        currentMileage: 28000,
        isCompanyOwned: true,
        insuranceCompany: 'La Segunda',
        insurancePolicy: 'POL-2024-003456',
        insuranceExpiry: '2026-09-10',
        vtvExpiry: '2026-07-01',
        registrationExpiry: '2027-01-15',
        notes: 'Pick-up para transporte de materiales grandes.',
    },
    {
        plateNumber: 'AD 012 GH',
        make: 'Renault',
        model: 'Kangoo',
        year: 2020,
        color: 'Azul',
        vin: 'VF1KC0JEF53456789',
        fuelType: 'GNC',
        currentMileage: 89000,
        isCompanyOwned: true,
        insuranceCompany: 'Sancor Seguros',
        insurancePolicy: 'POL-2024-004567',
        insuranceExpiry: '2026-04-20',
        vtvExpiry: '2026-02-28', // Expired!
        registrationExpiry: '2026-08-15',
        notes: 'Vehículo con GNC. Económico para viajes largos. VTV VENCIDA.',
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    // PERSONAL VEHICLES (authorized for work use)
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        plateNumber: 'AE 345 IJ',
        make: 'Ford',
        model: 'EcoSport',
        year: 2019,
        color: 'Negro',
        vin: '9BFZF55N9KB123456',
        fuelType: 'GASOLINE',
        currentMileage: 75000,
        isCompanyOwned: false,
        insuranceCompany: 'Allianz',
        insurancePolicy: 'POL-PERS-001234',
        insuranceExpiry: '2026-05-30',
        vtvExpiry: '2026-04-15',
        registrationExpiry: '2026-11-01',
        notes: 'Vehículo personal de Carlos Vega. Uso autorizado para trabajo.',
    },
    {
        plateNumber: 'AF 678 KL',
        make: 'Peugeot',
        model: 'Partner',
        year: 2022,
        color: 'Blanco',
        vin: 'VF3GJHFYXNB567890',
        fuelType: 'DIESEL',
        currentMileage: 38000,
        isCompanyOwned: true,
        insuranceCompany: 'La Segunda',
        insurancePolicy: 'POL-2024-005678',
        insuranceExpiry: '2026-07-20',
        vtvExpiry: '2026-06-01',
        registrationExpiry: '2026-12-31',
        notes: 'Furgoneta para trabajos comerciales e industriales.',
    },
    {
        plateNumber: 'AG 901 MN',
        make: 'Chevrolet',
        model: 'S10',
        year: 2021,
        color: 'Plata',
        vin: '9BG138CK0MC123456',
        fuelType: 'DIESEL',
        currentMileage: 52000,
        isCompanyOwned: true,
        insuranceCompany: 'Federación Patronal',
        insurancePolicy: 'POL-2024-006789',
        insuranceExpiry: '2026-10-15',
        vtvExpiry: '2026-08-20',
        registrationExpiry: '2027-02-01',
        notes: 'Camioneta 4x4 para trabajos en zonas rurales o de difícil acceso.',
    },
    {
        plateNumber: 'AH 234 OP',
        make: 'Toyota',
        model: 'Hilux',
        year: 2020,
        color: 'Rojo',
        vin: 'MR0FB8CD4G0123456',
        fuelType: 'DIESEL',
        currentMileage: 95000,
        isCompanyOwned: false,
        insuranceCompany: 'Mapfre',
        insurancePolicy: 'POL-PERS-002345',
        insuranceExpiry: '2026-03-15',
        vtvExpiry: '2026-01-30', // Expiring soon!
        registrationExpiry: '2026-09-01',
        notes: 'Vehículo personal de María Elena Castro. Alto kilometraje.',
    },
];
