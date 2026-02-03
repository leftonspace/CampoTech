/**
 * Technician Data
 * ================
 * 
 * Raw technician data for simulation.
 * These are templates - actual records are created with real IDs.
 * 
 * MAIN 5 TECHNICIANS: Alex, Erik, Adara, Marcelo, Mathieu
 */

export interface TechnicianTemplate {
    phone: string;
    name: string;
    email: string;
    specialties: string[];
    certifications: {
        enargasMatricula?: string;
        enargasCategory?: string;
        enargasExpiry?: string;
    };
    hasLicense: boolean;
    licenseNumber: string | null;
    licenseCategory: string | null;
    licenseExpiry: string | null;
    uocraLevel: string;
    vehicleIndex: number | null; // Index into VEHICLES array, null = no assigned vehicle
}

/**
 * 15 Technicians with realistic Argentine data
 */
export const TECHNICIANS: TechnicianTemplate[] = [
    // ═══════════════════════════════════════════════════════════════════════════════
    // MAIN 5 TECHNICIANS (Senior Team)
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        phone: '+543516000001',
        name: 'Alex Conta',
        email: 'alex.conta@demo.campotech.com',
        specialties: ['REFRIGERACION', 'ELECTRICISTA'],
        certifications: {
            enargasMatricula: 'MAT-HVAC-2019-0456',
            enargasCategory: 'Instalador de Equipos de Refrigeración',
            enargasExpiry: '2027-03-15',
        },
        hasLicense: true,
        licenseNumber: 'B-0234567',
        licenseCategory: 'B1',
        licenseExpiry: '2027-08-15',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 0,
    },
    {
        phone: '+543516000002',
        name: 'Erik Rodríguez',
        email: 'erik.rodriguez@demo.campotech.com',
        specialties: ['ELECTRICISTA', 'PLOMERO'],
        certifications: {
            enargasMatricula: 'MAT-ELEC-2018-0123',
            enargasCategory: 'Electricista Matriculado',
            enargasExpiry: '2027-05-20',
        },
        hasLicense: true,
        licenseNumber: 'B-0123456',
        licenseCategory: 'B1',
        licenseExpiry: '2027-02-10',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 1,
    },
    {
        phone: '+543516000003',
        name: 'Adara Esber',
        email: 'adara.esber@demo.campotech.com',
        specialties: ['REFRIGERACION'],
        certifications: {
            enargasMatricula: 'MAT-HVAC-2020-0789',
            enargasCategory: 'Instalador de Equipos de Refrigeración',
            enargasExpiry: '2028-06-20',
        },
        hasLicense: true,
        licenseNumber: 'B-0345678',
        licenseCategory: 'B1',
        licenseExpiry: '2026-12-01',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 2,
    },
    {
        phone: '+543516000004',
        name: 'Marcelo Gutiérrez',
        email: 'marcelo.gutierrez@demo.campotech.com',
        specialties: ['GASISTA', 'PLOMERO'],
        certifications: {
            enargasMatricula: 'MAT-GAS-2017-0890',
            enargasCategory: 'Gasista de 2da Categoría',
            enargasExpiry: '2027-09-15',
        },
        hasLicense: true,
        licenseNumber: 'B-0456789',
        licenseCategory: 'B2',
        licenseExpiry: '2027-06-20',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 3,
    },
    {
        phone: '+543516000005',
        name: 'Mathieu Dupont',
        email: 'mathieu.dupont@demo.campotech.com',
        specialties: ['REFRIGERACION', 'ELECTRICISTA', 'PLOMERO'],
        certifications: {
            enargasMatricula: 'MAT-MULTI-2016-0001',
            enargasCategory: 'Técnico Integral',
            enargasExpiry: '2027-11-01',
        },
        hasLicense: true,
        licenseNumber: 'B-0567890',
        licenseCategory: 'B1',
        licenseExpiry: '2028-01-15',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 4,
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    // ADDITIONAL TECHNICIANS
    // ═══════════════════════════════════════════════════════════════════════════════
    {
        phone: '+543516000006',
        name: 'Roberto Sánchez',
        email: 'roberto.sanchez@demo.campotech.com',
        specialties: ['GASISTA'],
        certifications: {
            enargasMatricula: 'MAT-GAS-2018-1234',
            enargasCategory: 'Gasista de 3ra Categoría',
            enargasExpiry: '2026-08-30',
        },
        hasLicense: false,
        licenseNumber: null,
        licenseCategory: null,
        licenseExpiry: null,
        uocraLevel: 'MEDIO_OFICIAL',
        vehicleIndex: null,
    },
    {
        phone: '+543516000007',
        name: 'Javier Mendoza',
        email: 'javier.mendoza@demo.campotech.com',
        specialties: ['GASISTA'],
        certifications: {
            enargasMatricula: 'MAT-GAS-2017-0567',
            enargasCategory: 'Gasista de 2da Categoría',
            enargasExpiry: '2027-02-15',
        },
        hasLicense: true,
        licenseNumber: 'B-0678901',
        licenseCategory: 'B1',
        licenseExpiry: '2027-04-20',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 5,
    },
    {
        phone: '+543516000008',
        name: 'Patricia Villalba',
        email: 'patricia.villalba@demo.campotech.com',
        specialties: ['ELECTRICISTA'],
        certifications: {
            enargasMatricula: 'MAT-ELEC-2019-0890',
            enargasCategory: 'Electricista Matriculado',
            enargasExpiry: '2027-11-10',
        },
        hasLicense: true,
        licenseNumber: 'B-0890123',
        licenseCategory: 'B1',
        licenseExpiry: '2028-06-25',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 6,
    },
    {
        phone: '+543516000009',
        name: 'Lucas Fernández',
        email: 'lucas.fernandez@demo.campotech.com',
        specialties: ['ELECTRICISTA'],
        certifications: {},
        hasLicense: true,
        licenseNumber: 'B-0901234',
        licenseCategory: 'B1',
        licenseExpiry: '2026-03-10',
        uocraLevel: 'OFICIAL',
        vehicleIndex: null,
    },
    {
        phone: '+543516000010',
        name: 'Nicolás Romero',
        email: 'nicolas.romero@demo.campotech.com',
        specialties: ['ELECTRICISTA'],
        certifications: {},
        hasLicense: true,
        licenseNumber: 'B-1012345',
        licenseCategory: 'B1',
        licenseExpiry: '2026-09-12',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 0, // Secondary driver
    },
    {
        phone: '+543516000011',
        name: 'María Elena Castro',
        email: 'maria.castro@demo.campotech.com',
        specialties: ['PLOMERO'],
        certifications: {},
        hasLicense: true,
        licenseNumber: 'B-1123456',
        licenseCategory: 'B1',
        licenseExpiry: '2027-01-30',
        uocraLevel: 'OFICIAL',
        vehicleIndex: 7,
    },
    {
        phone: '+543516000012',
        name: 'Camila Torres',
        email: 'camila.torres@demo.campotech.com',
        specialties: ['PLOMERO', 'GASISTA'],
        certifications: {
            enargasMatricula: 'MAT-GAS-2021-0234',
            enargasCategory: 'Gasista de 3ra Categoría',
            enargasExpiry: '2028-04-01',
        },
        hasLicense: false,
        licenseNumber: null,
        licenseCategory: null,
        licenseExpiry: null,
        uocraLevel: 'MEDIO_OFICIAL',
        vehicleIndex: null,
    },
    {
        phone: '+543516000013',
        name: 'Carlos Vega',
        email: 'carlos.vega@demo.campotech.com',
        specialties: ['REFRIGERACION', 'ELECTRICISTA', 'PLOMERO'],
        certifications: {
            enargasMatricula: 'MAT-MULTI-2015-0002',
            enargasCategory: 'Técnico Integral',
            enargasExpiry: '2026-06-15',
        },
        hasLicense: true,
        licenseNumber: 'B-1234567',
        licenseCategory: 'B2',
        licenseExpiry: '2027-09-20',
        uocraLevel: 'OFICIAL',
        vehicleIndex: null,
    },
    {
        phone: '+543516000014',
        name: 'Federico López',
        email: 'federico.lopez@demo.campotech.com',
        specialties: ['REFRIGERACION', 'ELECTRICISTA'],
        certifications: {},
        hasLicense: false,
        licenseNumber: null,
        licenseCategory: null,
        licenseExpiry: null,
        uocraLevel: 'AYUDANTE',
        vehicleIndex: null,
    },
    {
        phone: '+543516000015',
        name: 'Ana Belén Suárez',
        email: 'ana.suarez@demo.campotech.com',
        specialties: ['ELECTRICISTA', 'PLOMERO'],
        certifications: {},
        hasLicense: true,
        licenseNumber: 'B-1345678',
        licenseCategory: 'B1',
        licenseExpiry: '2026-08-05',
        uocraLevel: 'OFICIAL',
        vehicleIndex: null,
    },
];
