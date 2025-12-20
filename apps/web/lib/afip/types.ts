/**
 * AFIP Integration Types
 * ======================
 *
 * Type definitions for AFIP (Administración Federal de Ingresos Públicos)
 * integration, including CUIT validation and business information retrieval.
 *
 * CUIT = Clave Única de Identificación Tributaria (Unique Tax ID Key)
 * CUIL = Clave Única de Identificación Laboral (Unique Labor ID Key)
 *
 * Both follow the same format: XX-XXXXXXXX-X (11 digits with check digit)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CUIT/CUIL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CUIT/CUIL prefix types
 * - 20, 23, 24, 27: Person (CUIL)
 * - 30, 33, 34: Company/Entity (CUIT)
 */
export type CUITPrefix = '20' | '23' | '24' | '27' | '30' | '33' | '34';

/**
 * Type of entity based on CUIT prefix
 */
export type CUITEntityType = 'persona_fisica' | 'persona_juridica' | 'unknown';

/**
 * CUIT format validation result
 */
export interface CUITFormatValidation {
  isValid: boolean;
  formattedCuit?: string; // XX-XXXXXXXX-X format
  entityType?: CUITEntityType;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP ACTIVITY CODES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AFIP activity code with description
 */
export interface ActivityCode {
  code: string;
  description: string;
  period?: string; // Since when this activity is registered
  order?: number; // Primary (1), Secondary (2), etc.
}

/**
 * Mapped service type from AFIP activity codes
 */
export interface MappedServiceType {
  afipCode: string;
  afipDescription: string;
  serviceCategory: string; // hvac, plumbing, electrical, etc.
  serviceTypes: string[]; // Specific service types from CampoTech
  confidence: 'high' | 'medium' | 'low';
}

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP PERSONA (TAXPAYER) INFORMATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AFIP tax category
 */
export type CategoriaTributaria =
  | 'Monotributo'
  | 'Monotributo Social'
  | 'Responsable Inscripto'
  | 'Exento'
  | 'No Responsable'
  | 'Consumidor Final'
  | 'No Categorizado';

/**
 * AFIP registration status
 */
export type AFIPEstado = 'ACTIVO' | 'INACTIVO' | 'BAJA' | 'SUSPENDIDO';

/**
 * Fiscal address from AFIP
 */
export interface DomicilioFiscal {
  direccion: string;
  localidad: string;
  codigoPostal: string;
  provincia: string;
  provinciaId?: number;
}

/**
 * Full persona information from AFIP
 */
export interface AFIPPersonaInfo {
  cuit: string;
  razonSocial: string;
  tipoPersona: CUITEntityType;
  estadoClave: AFIPEstado;
  fechaInscripcion?: string;
  fechaBaja?: string;
  domicilioFiscal?: DomicilioFiscal;
  actividadesPrincipales: ActivityCode[];
  actividadesSecundarias: ActivityCode[];
  categoriaTributaria: CategoriaTributaria;
  categoriaAutonomo?: string;
  empleador?: boolean;
  monotributo?: {
    categoria: string;
    fechaDesde: string;
    impuestoIntegrado: boolean;
    aporteJubilatorio: boolean;
    obraSocial: boolean;
  };
  impuestosActivos?: string[];
  regimenes?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUIT VALIDATION RESULT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete CUIT validation result
 */
export interface CUITValidationResult {
  /** Whether the CUIT format is valid */
  isValid: boolean;

  /** Whether the CUIT exists in AFIP database */
  exists: boolean;

  /** Whether the entity is currently active in AFIP */
  isActive: boolean;

  /** Business/Person name registered with AFIP */
  razonSocial: string;

  /** Fiscal address */
  domicilioFiscal: string;

  /** Main economic activities registered */
  actividadesPrincipales: ActivityCode[];

  /** Tax category (Monotributista, Resp. Inscripto, etc.) */
  categoriaTributaria: CategoriaTributaria;

  /** Date of AFIP registration */
  fechaInscripcion: string;

  /** Entity type (person or company) */
  tipoPersona: CUITEntityType;

  /** Full persona info if available */
  personaInfo?: AFIPPersonaInfo;

  /** Error message if validation failed */
  error?: string;

  /** Timestamp of the validation */
  validatedAt: Date;

  /** Source of validation (api, cache, manual) */
  source: 'afip_api' | 'afip_padron' | 'cache' | 'manual';
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AFIP API error response
 */
export interface AFIPError {
  code: string;
  message: string;
  details?: string;
  retryable: boolean;
}

/**
 * AFIP client configuration
 */
export interface AFIPClientConfig {
  /** Timeout for API requests in milliseconds */
  timeout?: number;
  /** Number of retries for failed requests */
  retries?: number;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Whether to use the padron file fallback */
  usePadronFallback?: boolean;
}

/**
 * AFIP service status
 */
export interface AFIPServiceStatus {
  available: boolean;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION INTEGRATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Auto-verification response for CUIT validation
 * Stored in verification_submissions.autoVerifyResponse
 */
export interface CUITAutoVerifyResponse {
  cuit: string;
  isValid: boolean;
  exists: boolean;
  isActive: boolean;
  razonSocial?: string;
  categoriaTributaria?: CategoriaTributaria;
  activityCodes?: string[];
  matchedServices?: MappedServiceType[];
  domicilioFiscal?: DomicilioFiscal;
  validatedAt: string;
  source: 'afip_api' | 'afip_padron' | 'cache';
  error?: string;
}

/**
 * Activity code match verification result
 */
export interface ActivityCodeMatchResult {
  matched: boolean;
  afipCodes: ActivityCode[];
  matchedServices: MappedServiceType[];
  unmatchedCodes: ActivityCode[];
  matchPercentage: number; // 0-100
  recommendation: 'approved' | 'review' | 'rejected';
  reason?: string;
}
