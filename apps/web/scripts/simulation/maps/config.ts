/**
 * Maps Simulation Configuration
 * ==============================
 *
 * Central configuration for all simulation parameters.
 * Start small, then increase variables for real-world scale testing.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION PARAMETERS
// ═══════════════════════════════════════════════════════════════════════════════

export const SIM_CONFIG = {
    /** Number of organizations to create */
    orgCount: 10,

    /** Number of dispatch jobs to test per org (within-org dispatch) */
    jobsPerDispatchTest: 3,

    /** Number of marketplace consumer searches to simulate */
    marketplaceSearches: 5,

    /** Number of jobs per itinerary test */
    jobsPerItinerary: 4,

    /** Include rush hour variant in tests */
    includeRushHour: true,

    /** Include multi-modal comparisons (driving vs moto vs transit) */
    includeMultiModal: true,

    /** Base URL for API calls — local dev server */
    baseUrl: 'http://localhost:3000',

    /** Delay between API calls (ms) — avoid rate limiting */
    apiDelayMs: 200,

    /** Report output directory */
    reportDir: 'scripts/simulation/maps/reports',
};

// ═══════════════════════════════════════════════════════════════════════════════
// BUENOS AIRES COORDINATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Real neighborhoods in CABA and GBA with their approximate center coordinates.
 * These are used to randomly place technicians and generate job destinations.
 */
export const BA_ZONES = {
    // CABA neighborhoods
    PALERMO: { lat: -34.5795, lng: -58.4195, label: 'Palermo' },
    BELGRANO: { lat: -34.5595, lng: -58.4553, label: 'Belgrano' },
    RECOLETA: { lat: -34.5875, lng: -58.3936, label: 'Recoleta' },
    SAN_TELMO: { lat: -34.6215, lng: -58.3736, label: 'San Telmo' },
    CABALLITO: { lat: -34.6187, lng: -58.4325, label: 'Caballito' },
    FLORES: { lat: -34.6327, lng: -58.4632, label: 'Flores' },
    VILLA_URQUIZA: { lat: -34.5725, lng: -58.4895, label: 'Villa Urquiza' },
    ALMAGRO: { lat: -34.6085, lng: -58.4185, label: 'Almagro' },
    BARRACAS: { lat: -34.6452, lng: -58.3838, label: 'Barracas' },
    NUÑEZ: { lat: -34.5485, lng: -58.4558, label: 'Núñez' },
    COLEGIALES: { lat: -34.5735, lng: -58.4475, label: 'Colegiales' },
    VILLA_CRESPO: { lat: -34.5985, lng: -58.4365, label: 'Villa Crespo' },
    MICROCENTRO: { lat: -34.6055, lng: -58.3775, label: 'Microcentro' },
    PUERTO_MADERO: { lat: -34.6145, lng: -58.3625, label: 'Puerto Madero' },
    BOEDO: { lat: -34.6305, lng: -58.4175, label: 'Boedo' },

    // GBA zones
    AVELLANEDA: { lat: -34.6625, lng: -58.3655, label: 'Avellaneda' },
    VICENTE_LOPEZ: { lat: -34.5275, lng: -58.4725, label: 'Vicente López' },
    MORON: { lat: -34.6505, lng: -58.6195, label: 'Morón' },
    QUILMES: { lat: -34.7205, lng: -58.2555, label: 'Quilmes' },
    SAN_ISIDRO: { lat: -34.4725, lng: -58.5285, label: 'San Isidro' },
    LOMAS_ZAMORA: { lat: -34.7615, lng: -58.4005, label: 'Lomas de Zamora' },
    TIGRE: { lat: -34.4265, lng: -58.5795, label: 'Tigre' },
    RAMOS_MEJIA: { lat: -34.6395, lng: -58.5625, label: 'Ramos Mejía' },
} as const;

export type ZoneKey = keyof typeof BA_ZONES;

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type OrgRole = 'OWNER' | 'ADMIN' | 'TECHNICIAN';
export type Specialty = 'PLOMERO' | 'ELECTRICISTA' | 'GASISTA' | 'REFRIGERACION';

export interface SimWorker {
    name: string;
    phone: string;
    role: OrgRole;
    specialty: Specialty;
    specialties: Specialty[];
    /** Zone where this worker is currently stationed */
    zone: ZoneKey;
    /** Small random offset from zone center (degrees, ~100-500m) */
    locationJitter: { lat: number; lng: number };
}

export interface SimOrganization {
    /** Simulation label — also used as unique slug */
    slug: string;
    name: string;
    /** Primary zone (org HQ) */
    zone: ZoneKey;
    categories: Specialty[];
    /** Marketplace visibility */
    marketplaceVisible: boolean;
    /** Service area radius in km */
    serviceRadiusKm: number;
    /** Average rating (1-5) */
    rating: number;
    totalReviews: number;
    totalJobs: number;
    whatsappNumber: string;
    /** Workers — first entry is always OWNER */
    workers: SimWorker[];
}

// ─── Helper to generate a jittered coordinate ──────────────────────────────
function jitter(): { lat: number; lng: number } {
    // Random offset ±0.003 (~300m)
    return {
        lat: (Math.random() - 0.5) * 0.006,
        lng: (Math.random() - 0.5) * 0.006,
    };
}

/**
 * The 10 simulated organizations across Buenos Aires.
 * 7 are solo workers (OWNER only), 3 have teams.
 */
export const SIM_ORGANIZATIONS: SimOrganization[] = [
    // ─── 1. Solo Plomero — Palermo ──────────────────────────────────────────
    {
        slug: 'garcia-plomeria-sim',
        name: 'García Plomería',
        zone: 'PALERMO',
        categories: ['PLOMERO'],
        marketplaceVisible: true,
        serviceRadiusKm: 15,
        rating: 4.7,
        totalReviews: 32,
        totalJobs: 85,
        whatsappNumber: '+5491100000001',
        workers: [
            {
                name: 'Martín García',
                phone: '+5491100000001',
                role: 'OWNER',
                specialty: 'PLOMERO',
                specialties: ['PLOMERO'],
                zone: 'PALERMO',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 2. Solo Electricista — Avellaneda ──────────────────────────────────
    {
        slug: 'electrosur-sim',
        name: 'ElectroSur',
        zone: 'AVELLANEDA',
        categories: ['ELECTRICISTA'],
        marketplaceVisible: true,
        serviceRadiusKm: 20,
        rating: 4.3,
        totalReviews: 18,
        totalJobs: 52,
        whatsappNumber: '+5491100000002',
        workers: [
            {
                name: 'Roberto Díaz',
                phone: '+5491100000002',
                role: 'OWNER',
                specialty: 'ELECTRICISTA',
                specialties: ['ELECTRICISTA'],
                zone: 'AVELLANEDA',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 3. Team HVAC — Belgrano (owner + 2 techs) ─────────────────────────
    {
        slug: 'friotech-hvac-sim',
        name: 'FríoTech HVAC',
        zone: 'BELGRANO',
        categories: ['REFRIGERACION'],
        marketplaceVisible: true,
        serviceRadiusKm: 25,
        rating: 4.8,
        totalReviews: 67,
        totalJobs: 210,
        whatsappNumber: '+5491100000003',
        workers: [
            {
                name: 'Laura Fernández',
                phone: '+5491100000003',
                role: 'OWNER',
                specialty: 'REFRIGERACION',
                specialties: ['REFRIGERACION'],
                zone: 'BELGRANO',
                locationJitter: jitter(),
            },
            {
                name: 'Carlos Méndez',
                phone: '+5491100000013',
                role: 'TECHNICIAN',
                specialty: 'REFRIGERACION',
                specialties: ['REFRIGERACION'],
                zone: 'NUÑEZ',
                locationJitter: jitter(),
            },
            {
                name: 'Pablo Acosta',
                phone: '+5491100000023',
                role: 'TECHNICIAN',
                specialty: 'REFRIGERACION',
                specialties: ['REFRIGERACION'],
                zone: 'COLEGIALES',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 4. Solo Plomero — San Telmo ────────────────────────────────────────
    {
        slug: 'aquaserv-ba-sim',
        name: 'AquaServ BA',
        zone: 'SAN_TELMO',
        categories: ['PLOMERO'],
        marketplaceVisible: true,
        serviceRadiusKm: 12,
        rating: 4.1,
        totalReviews: 11,
        totalJobs: 34,
        whatsappNumber: '+5491100000004',
        workers: [
            {
                name: 'Diego Romero',
                phone: '+5491100000004',
                role: 'OWNER',
                specialty: 'PLOMERO',
                specialties: ['PLOMERO'],
                zone: 'SAN_TELMO',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 5. Team Gasista/Plomero — Caballito (owner + 1 tech) ──────────────
    {
        slug: 'instalaciones-martinez-sim',
        name: 'Instalaciones Martínez',
        zone: 'CABALLITO',
        categories: ['GASISTA', 'PLOMERO'],
        marketplaceVisible: true,
        serviceRadiusKm: 18,
        rating: 4.5,
        totalReviews: 44,
        totalJobs: 128,
        whatsappNumber: '+5491100000005',
        workers: [
            {
                name: 'Javier Martínez',
                phone: '+5491100000005',
                role: 'OWNER',
                specialty: 'GASISTA',
                specialties: ['GASISTA', 'PLOMERO'],
                zone: 'CABALLITO',
                locationJitter: jitter(),
            },
            {
                name: 'Nicolás Suárez',
                phone: '+5491100000015',
                role: 'TECHNICIAN',
                specialty: 'PLOMERO',
                specialties: ['PLOMERO'],
                zone: 'ALMAGRO',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 6. Solo HVAC — Vicente López ──────────────────────────────────────
    {
        slug: 'tecnoclima-norte-sim',
        name: 'TecnoClima Norte',
        zone: 'VICENTE_LOPEZ',
        categories: ['REFRIGERACION'],
        marketplaceVisible: true,
        serviceRadiusKm: 30,
        rating: 4.6,
        totalReviews: 25,
        totalJobs: 72,
        whatsappNumber: '+5491100000006',
        workers: [
            {
                name: 'Alejandro Paz',
                phone: '+5491100000006',
                role: 'OWNER',
                specialty: 'REFRIGERACION',
                specialties: ['REFRIGERACION'],
                zone: 'VICENTE_LOPEZ',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 7. Team Electricista — Flores (owner + admin + 2 techs) ───────────
    {
        slug: 'servicios-electricos-ramos-sim',
        name: 'Servicios Eléctricos Ramos',
        zone: 'FLORES',
        categories: ['ELECTRICISTA'],
        marketplaceVisible: true,
        serviceRadiusKm: 22,
        rating: 4.4,
        totalReviews: 53,
        totalJobs: 190,
        whatsappNumber: '+5491100000007',
        workers: [
            {
                name: 'Fernando Ramos',
                phone: '+5491100000007',
                role: 'OWNER',
                specialty: 'ELECTRICISTA',
                specialties: ['ELECTRICISTA'],
                zone: 'FLORES',
                locationJitter: jitter(),
            },
            {
                name: 'Valentina Cruz',
                phone: '+5491100000017',
                role: 'ADMIN',
                specialty: 'ELECTRICISTA',
                specialties: ['ELECTRICISTA'],
                zone: 'FLORES',
                locationJitter: jitter(),
            },
            {
                name: 'Tomás Herrera',
                phone: '+5491100000027',
                role: 'TECHNICIAN',
                specialty: 'ELECTRICISTA',
                specialties: ['ELECTRICISTA'],
                zone: 'CABALLITO',
                locationJitter: jitter(),
            },
            {
                name: 'Ignacio López',
                phone: '+5491100000037',
                role: 'TECHNICIAN',
                specialty: 'ELECTRICISTA',
                specialties: ['ELECTRICISTA'],
                zone: 'VILLA_CRESPO',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 8. Solo Multi-trade — Morón ───────────────────────────────────────
    {
        slug: 'multiserv-oeste-sim',
        name: 'MultiServ del Oeste',
        zone: 'MORON',
        categories: ['PLOMERO', 'ELECTRICISTA'],
        marketplaceVisible: true,
        serviceRadiusKm: 20,
        rating: 3.9,
        totalReviews: 8,
        totalJobs: 21,
        whatsappNumber: '+5491100000008',
        workers: [
            {
                name: 'Matías Giménez',
                phone: '+5491100000008',
                role: 'OWNER',
                specialty: 'PLOMERO',
                specialties: ['PLOMERO', 'ELECTRICISTA'],
                zone: 'MORON',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 9. Solo Plomero — Recoleta ────────────────────────────────────────
    {
        slug: 'canerias-express-sim',
        name: 'Cañerías Express',
        zone: 'RECOLETA',
        categories: ['PLOMERO'],
        marketplaceVisible: true,
        serviceRadiusKm: 10,
        rating: 4.9,
        totalReviews: 87,
        totalJobs: 310,
        whatsappNumber: '+5491100000009',
        workers: [
            {
                name: 'Sebastián Vega',
                phone: '+5491100000009',
                role: 'OWNER',
                specialty: 'PLOMERO',
                specialties: ['PLOMERO'],
                zone: 'RECOLETA',
                locationJitter: jitter(),
            },
        ],
    },

    // ─── 10. Team Gasista — Quilmes (owner + 1 tech) ───────────────────────
    {
        slug: 'surgas-instalaciones-sim',
        name: 'SurGas Instalaciones',
        zone: 'QUILMES',
        categories: ['GASISTA'],
        marketplaceVisible: true,
        serviceRadiusKm: 25,
        rating: 4.2,
        totalReviews: 15,
        totalJobs: 45,
        whatsappNumber: '+5491100000010',
        workers: [
            {
                name: 'Andrés Molina',
                phone: '+5491100000010',
                role: 'OWNER',
                specialty: 'GASISTA',
                specialties: ['GASISTA'],
                zone: 'QUILMES',
                locationJitter: jitter(),
            },
            {
                name: 'Luciano Pereyra',
                phone: '+5491100000020',
                role: 'TECHNICIAN',
                specialty: 'GASISTA',
                specialties: ['GASISTA'],
                zone: 'LOMAS_ZAMORA',
                locationJitter: jitter(),
            },
        ],
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE SEARCH SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketplaceScenario {
    label: string;
    /** Consumer location */
    lat: number;
    lng: number;
    /** Category filter (optional) */
    category?: Specialty;
    /** Expected behavior description */
    expectation: string;
}

export const MARKETPLACE_SCENARIOS: MarketplaceScenario[] = [
    {
        label: 'Plomero en Microcentro',
        lat: BA_ZONES.MICROCENTRO.lat,
        lng: BA_ZONES.MICROCENTRO.lng,
        category: 'PLOMERO',
        expectation: 'AquaServ (San Telmo) or Cañerías Express (Recoleta) should rank first — both are <3km',
    },
    {
        label: 'Electricista en Villa Urquiza',
        lat: BA_ZONES.VILLA_URQUIZA.lat,
        lng: BA_ZONES.VILLA_URQUIZA.lng,
        category: 'ELECTRICISTA',
        expectation: 'Servicios Eléctricos Ramos (Flores tech in V.Crespo) may rank high — cross-org matching',
    },
    {
        label: 'HVAC en Puerto Madero',
        lat: BA_ZONES.PUERTO_MADERO.lat,
        lng: BA_ZONES.PUERTO_MADERO.lng,
        category: 'REFRIGERACION',
        expectation: 'FríoTech (Belgrano) should outperform TecnoClima (Vicente López) — closer to CBD',
    },
    {
        label: 'Gasista en Boedo',
        lat: BA_ZONES.BOEDO.lat,
        lng: BA_ZONES.BOEDO.lng,
        category: 'GASISTA',
        expectation: 'Instalaciones Martínez (Caballito) should rank first — closest gasista to Boedo',
    },
    {
        label: 'Cualquier servicio en Barracas (sin filtro)',
        lat: BA_ZONES.BARRACAS.lat,
        lng: BA_ZONES.BARRACAS.lng,
        category: undefined,
        expectation: 'All 10 orgs should appear, sorted by real ETA — AquaServ (San Telmo) likely first',
    },
    {
        label: 'Plomero en Tigre (zona lejana)',
        lat: BA_ZONES.TIGRE.lat,
        lng: BA_ZONES.TIGRE.lng,
        category: 'PLOMERO',
        expectation: 'Some orgs may be outside service radius — tests service area filtering',
    },
    {
        label: 'Electricista en Quilmes',
        lat: BA_ZONES.QUILMES.lat,
        lng: BA_ZONES.QUILMES.lng,
        category: 'ELECTRICISTA',
        expectation: 'ElectroSur (Avellaneda) should rank first — closest electricista to zona sur',
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// JOB DESTINATION SCENARIOS (for dispatch within-org tests)
// ═══════════════════════════════════════════════════════════════════════════════

export interface DispatchScenario {
    label: string;
    /** Job destination */
    lat: number;
    lng: number;
    specialty?: Specialty;
    urgency: 'NORMAL' | 'URGENTE';
}

/** Random job locations across BA for dispatch testing */
export const DISPATCH_JOB_LOCATIONS: DispatchScenario[] = [
    { label: 'Depto en Belgrano', lat: BA_ZONES.BELGRANO.lat, lng: BA_ZONES.BELGRANO.lng, specialty: 'REFRIGERACION', urgency: 'NORMAL' },
    { label: 'Casa en Flores', lat: BA_ZONES.FLORES.lat, lng: BA_ZONES.FLORES.lng, specialty: 'ELECTRICISTA', urgency: 'URGENTE' },
    { label: 'Oficina en Microcentro', lat: BA_ZONES.MICROCENTRO.lat, lng: BA_ZONES.MICROCENTRO.lng, specialty: 'PLOMERO', urgency: 'NORMAL' },
    { label: 'PH en Almagro', lat: BA_ZONES.ALMAGRO.lat, lng: BA_ZONES.ALMAGRO.lng, specialty: 'GASISTA', urgency: 'NORMAL' },
    { label: 'Casa en Núñez', lat: BA_ZONES.NUÑEZ.lat, lng: BA_ZONES.NUÑEZ.lng, specialty: 'REFRIGERACION', urgency: 'URGENTE' },
    { label: 'Edificio en Recoleta', lat: BA_ZONES.RECOLETA.lat, lng: BA_ZONES.RECOLETA.lng, specialty: 'PLOMERO', urgency: 'NORMAL' },
    { label: 'Local en Caballito', lat: BA_ZONES.CABALLITO.lat, lng: BA_ZONES.CABALLITO.lng, specialty: 'ELECTRICISTA', urgency: 'NORMAL' },
    { label: 'Galpón en Avellaneda', lat: BA_ZONES.AVELLANEDA.lat, lng: BA_ZONES.AVELLANEDA.lng, specialty: 'ELECTRICISTA', urgency: 'URGENTE' },
    { label: 'Casa en Vicente López', lat: BA_ZONES.VICENTE_LOPEZ.lat, lng: BA_ZONES.VICENTE_LOPEZ.lng, specialty: 'REFRIGERACION', urgency: 'NORMAL' },
    { label: 'Emergencia en Barracas', lat: BA_ZONES.BARRACAS.lat, lng: BA_ZONES.BARRACAS.lng, specialty: 'PLOMERO', urgency: 'URGENTE' },
];
