/**
 * Location Types
 * ==============
 *
 * Type definitions for multi-location support in CampoTech.
 * Supports Organization → Locations → Zones hierarchy.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type LocationType =
  | 'HEADQUARTERS'   // Casa central
  | 'BRANCH'         // Sucursal
  | 'WAREHOUSE'      // Depósito
  | 'SERVICE_POINT'; // Punto de servicio

export type TransferType =
  | 'JOB_ASSIGNMENT'    // Job transferred to another location
  | 'TECHNICIAN_LOAN'   // Technician temporarily assigned to another location
  | 'CUSTOMER_REFERRAL' // Customer referred to another location
  | 'RESOURCE_SHARE'    // Sharing of equipment/inventory
  | 'FINANCIAL';        // Financial transfer between locations

export type TransferStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

// ═══════════════════════════════════════════════════════════════════════════════
// GEOGRAPHIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  street: string;
  number: string;
  floor?: string;
  apartment?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

/**
 * GeoJSON Polygon for defining coverage areas
 * https://geojson.org/geojson-spec.html#polygon
 */
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // Array of linear rings [[[lng, lat], [lng, lat], ...]]
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION ENTITY
// ═══════════════════════════════════════════════════════════════════════════════

export interface Location {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: LocationType;
  address: Address;
  coordinates?: Coordinates;
  timezone: string;
  phone?: string;
  email?: string;
  managerId?: string;
  isHeadquarters: boolean;
  isActive: boolean;
  coverageRadius?: number; // km
  coverageArea?: GeoJSONPolygon;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationWithRelations extends Location {
  manager?: {
    id: string;
    name: string;
    email?: string;
  };
  zones?: Zone[];
  settings?: LocationSettings;
  afipConfig?: LocationAfipConfig;
  _count?: {
    jobs: number;
    customers: number;
    technicians: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZONE ENTITY
// ═══════════════════════════════════════════════════════════════════════════════

export interface Zone {
  id: string;
  locationId: string;
  code: string;
  name: string;
  description?: string;
  boundary?: GeoJSONPolygon;
  color?: string; // Hex color for map display
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ZoneWithRelations extends Zone {
  location?: Location;
  _count?: {
    jobs: number;
    customers: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export interface OperatingHours {
  monday?: { open: string; close: string };
  tuesday?: { open: string; close: string };
  wednesday?: { open: string; close: string };
  thursday?: { open: string; close: string };
  friday?: { open: string; close: string };
  saturday?: { open: string; close: string };
  sunday?: { open: string; close: string };
}

export interface LocationSettings {
  id: string;
  locationId: string;
  operatingHours: OperatingHours;
  holidays: string[]; // ISO date strings
  serviceRadius?: number;
  maxJobsPerDay?: number;
  defaultJobDuration?: number;
  allowEmergencyJobs: boolean;
  emergencyFeePercent?: number;
  pricingMultiplier: number;
  travelFeePerKm?: number;
  minimumTravelFee?: number;
  notifyOnNewJob: boolean;
  notifyOnJobComplete: boolean;
  notificationEmails: string[];
  whatsappNumber?: string;
  whatsappBusinessId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATION AFIP CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export type CondicionIva =
  | 'RESPONSABLE_INSCRIPTO'
  | 'MONOTRIBUTISTA'
  | 'EXENTO';

export interface DomicilioFiscal {
  calle: string;
  numero: string;
  piso?: string;
  depto?: string;
  localidad: string;
  provincia: string;
  cp: string;
}

export interface LocationAfipConfig {
  id: string;
  locationId: string;
  puntoDeVenta: number;
  tiposPuntoDeVenta: string;
  cuit?: string;
  razonSocial?: string;
  domicilioFiscal?: DomicilioFiscal;
  condicionIva: CondicionIva;
  facturaALastNumber: number;
  facturaBLastNumber: number;
  facturaCLastNumber: number;
  notaCreditoALastNumber: number;
  notaCreditoBLastNumber: number;
  notaCreditoCLastNumber: number;
  certificatePath?: string;
  certificateExpiry?: Date;
  privateKeyPath?: string;
  wsaaToken?: string;
  wsaaTokenExpiry?: Date;
  isActive: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTER-LOCATION TRANSFER
// ═══════════════════════════════════════════════════════════════════════════════

export interface InterLocationTransfer {
  id: string;
  organizationId: string;
  fromLocationId: string;
  toLocationId: string;
  transferType: TransferType;
  referenceId?: string;
  reason?: string;
  notes?: string;
  amount?: number;
  status: TransferStatus;
  requestedById: string;
  approvedById?: string;
  requestedAt: Date;
  approvedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterLocationTransferWithRelations extends InterLocationTransfer {
  fromLocation?: Location;
  toLocation?: Location;
  requestedBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DTOs - CREATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateLocationDTO {
  code: string;
  name: string;
  type?: LocationType;
  address: Address;
  coordinates?: Coordinates;
  timezone?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  isHeadquarters?: boolean;
  coverageRadius?: number;
  coverageArea?: GeoJSONPolygon;
}

export interface CreateZoneDTO {
  locationId: string;
  code: string;
  name: string;
  description?: string;
  boundary?: GeoJSONPolygon;
  color?: string;
  priority?: number;
}

export interface CreateLocationSettingsDTO {
  locationId: string;
  operatingHours?: OperatingHours;
  holidays?: string[];
  serviceRadius?: number;
  maxJobsPerDay?: number;
  defaultJobDuration?: number;
  allowEmergencyJobs?: boolean;
  emergencyFeePercent?: number;
  pricingMultiplier?: number;
  travelFeePerKm?: number;
  minimumTravelFee?: number;
  notifyOnNewJob?: boolean;
  notifyOnJobComplete?: boolean;
  notificationEmails?: string[];
  whatsappNumber?: string;
  whatsappBusinessId?: string;
}

export interface CreateLocationAfipConfigDTO {
  locationId: string;
  puntoDeVenta: number;
  tiposPuntoDeVenta?: string;
  cuit?: string;
  razonSocial?: string;
  domicilioFiscal?: DomicilioFiscal;
  condicionIva?: CondicionIva;
}

export interface CreateInterLocationTransferDTO {
  fromLocationId: string;
  toLocationId: string;
  transferType: TransferType;
  referenceId?: string;
  reason?: string;
  notes?: string;
  amount?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DTOs - UPDATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface UpdateLocationDTO {
  code?: string;
  name?: string;
  type?: LocationType;
  address?: Partial<Address>;
  coordinates?: Coordinates;
  timezone?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  isHeadquarters?: boolean;
  isActive?: boolean;
  coverageRadius?: number;
  coverageArea?: GeoJSONPolygon;
}

export interface UpdateZoneDTO {
  code?: string;
  name?: string;
  description?: string;
  boundary?: GeoJSONPolygon;
  color?: string;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateLocationSettingsDTO extends Partial<Omit<CreateLocationSettingsDTO, 'locationId'>> {}

export interface UpdateLocationAfipConfigDTO extends Partial<Omit<CreateLocationAfipConfigDTO, 'locationId'>> {}

export interface UpdateInterLocationTransferDTO {
  status?: TransferStatus;
  notes?: string;
  approvedById?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocationResponse {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  address: Address;
  coordinates?: Coordinates;
  timezone: string;
  phone?: string;
  email?: string;
  isHeadquarters: boolean;
  isActive: boolean;
  coverageRadius?: number;
  manager?: {
    id: string;
    name: string;
  };
  zonesCount: number;
  jobsCount: number;
  customersCount: number;
  techniciansCount: number;
  createdAt: Date;
}

export interface ZoneResponse {
  id: string;
  locationId: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  priority: number;
  isActive: boolean;
  jobsCount: number;
  customersCount: number;
  createdAt: Date;
}

export interface LocationListResponse {
  locations: LocationResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVERAGE & ASSIGNMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CoverageCheckResult {
  isCovered: boolean;
  location?: Location;
  zone?: Zone;
  distance?: number; // Distance in km from location center
  pricingMultiplier?: number;
  travelFee?: number;
}

export interface JobAssignmentSuggestion {
  locationId: string;
  locationName: string;
  zoneId?: string;
  zoneName?: string;
  distance: number;
  estimatedTravelTime: number; // minutes
  availableTechnicians: number;
  suggestedPrice: number;
  pricingMultiplier: number;
  score: number; // 0-100 ranking score
}

export interface LocationCapacity {
  locationId: string;
  date: string;
  maxJobs: number;
  scheduledJobs: number;
  completedJobs: number;
  availableSlots: number;
  techniciansAvailable: number;
  techniciansOnDuty: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY FILTERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface LocationFilters {
  type?: LocationType;
  isActive?: boolean;
  isHeadquarters?: boolean;
  managerId?: string;
  search?: string;
}

export interface ZoneFilters {
  locationId?: string;
  isActive?: boolean;
  search?: string;
}

export interface TransferFilters {
  fromLocationId?: string;
  toLocationId?: string;
  transferType?: TransferType;
  status?: TransferStatus;
  requestedById?: string;
  dateFrom?: Date;
  dateTo?: Date;
}
