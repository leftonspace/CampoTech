/**
 * Field Permission Configuration for CampoTech FSM
 * Implements field-level access control based on Argentine law (Ley 25.326, AFIP regulations)
 *
 * Field Status Types:
 * - 'locked': Cannot be edited in UI, requires email request to support
 * - 'restricted': Only visible/editable by OWNER role
 * - 'approval': Requires OWNER approval to change
 * - 'editable': Normal edit by authorized roles
 * - 'readonly': Visible but not editable
 */

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'TECHNICIAN';
export type FieldStatus = 'locked' | 'restricted' | 'approval' | 'editable' | 'readonly';

export interface FieldPermission {
  status: FieldStatus;
  visibleTo: UserRole[];
  editableBy: UserRole[];
  lockedMessage?: string;
  requiresApproval?: boolean;
  encrypted?: boolean;
}

// ===========================================
// ORGANIZATION FIELDS
// ===========================================
export const ORGANIZATION_FIELDS: Record<string, FieldPermission> = {
  // LOCKED - Cannot be changed (AFIP/legal requirements)
  cuit: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'CUIT no puede ser modificado. Contacte soporte@campotech.com con documentacion de AFIP.',
  },
  razonSocial: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'Razon Social no puede ser modificada. Requiere documentacion de IGJ.',
  },
  tipoSociedad: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'Tipo de sociedad no puede ser modificado.',
  },
  ivaCondition: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'Condicion de IVA no puede ser modificada. Requiere cambio en AFIP primero.',
  },
  puntoVentaAfip: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'Punto de venta AFIP no puede ser modificado.',
  },
  fechaInscripcionAfip: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  ingresosBrutos: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'Numero de IIBB no puede ser modificado. Contacte soporte.',
  },

  // APPROVAL REQUIRED
  domicilioFiscal: {
    status: 'approval',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
    requiresApproval: true,
    lockedMessage: 'Cambio de domicilio fiscal requiere verificacion con AFIP.',
  },

  // RESTRICTED - Only owner can see/edit
  cbu: {
    status: 'restricted',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
    encrypted: true,
  },
  cbuAlias: {
    status: 'restricted',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },
  mpAccessToken: {
    status: 'restricted',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
    encrypted: true,
  },
  afipCertificate: {
    status: 'restricted',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
    encrypted: true,
  },
  afipPrivateKey: {
    status: 'restricted',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
    encrypted: true,
  },

  // EDITABLE - Normal fields
  name: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  nombreComercial: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  phone: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  email: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  direccionComercial: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  logo: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  horariosAtencion: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
};

// ===========================================
// USER (EMPLOYEE) FIELDS
// ===========================================
export const USER_FIELDS: Record<string, FieldPermission> = {
  // LOCKED - Government/AFIP data
  cuil: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'CUIL no puede ser modificado. Es asignado por ANSES.',
  },
  dni: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'DNI no puede ser modificado.',
  },
  legalName: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'Nombre legal no puede ser modificado. Contacte soporte con documentacion.',
  },
  fechaNacimiento: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  nacionalidad: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  sexo: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'Genero puede ser modificado con documentacion legal (Ley 26.743).',
  },
  fechaIngreso: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'Fecha de ingreso esta registrada en AFIP y no puede ser modificada.',
  },
  modalidadContrato: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'Modalidad de contrato esta registrada en AFIP.',
  },
  obraSocial: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'Obra social debe ser cambiada en AFIP.',
  },
  art: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'ART es a nivel empresa, no puede ser por empleado.',
  },
  convenioColectivo: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },

  // RESTRICTED - Sensitive
  remuneracion: {
    status: 'restricted',
    visibleTo: ['OWNER'], // Employee can see their own via special logic
    editableBy: ['OWNER'],
    encrypted: true,
  },
  cbuEmpleado: {
    status: 'restricted',
    visibleTo: ['OWNER'], // Employee can see/edit their own
    editableBy: [], // Self-service for own CBU
    encrypted: true,
  },

  // APPROVAL REQUIRED
  role: {
    status: 'approval',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
    requiresApproval: true,
  },
  puesto: {
    status: 'approval',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
    requiresApproval: true,
  },
  isActive: {
    status: 'approval',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },

  // EDITABLE
  name: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  phone: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'], // Self can also edit
  },
  email: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'], // Self can also edit
  },
  direccion: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'], // Self can also edit
  },
  contactoEmergencia: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'], // Self can also edit
  },
  ubicacionAsignada: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  specialty: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  skillLevel: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  avatar: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'], // Self can edit
  },
};

// ===========================================
// CUSTOMER FIELDS
// ===========================================
export const CUSTOMER_FIELDS: Record<string, FieldPermission> = {
  // LOCKED for business customers
  cuit: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'CUIT de cliente no puede ser modificado. Contacte soporte.',
  },
  razonSocial: {
    status: 'locked', // Only locked if has CUIT
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'Razon social debe coincidir con AFIP.',
  },
  condicionIva: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'Condicion IVA determina tipo de factura.',
  },
  dni: {
    status: 'locked', // If provided
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
  },

  // APPROVAL for fiscal address
  direccionFiscal: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },

  // EDITABLE
  name: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  phone: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'],
  },
  email: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'],
  },
  address: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'],
  },
  notes: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'],
  },
};

// ===========================================
// VEHICLE FIELDS
// ===========================================
export const VEHICLE_FIELDS: Record<string, FieldPermission> = {
  // LOCKED - Cannot ever change
  plateNumber: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'Patente no puede ser modificada. Cree un nuevo vehiculo.',
  },
  vin: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  make: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
  },
  model: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
  },
  year: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
  },
  fuelType: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
    lockedMessage: 'Tipo de combustible solo puede cambiar con conversion a GNC documentada.',
  },

  // LOCKED DOCUMENTS - Upload new only (readonly for viewing)
  vtvCertificadoUrl: {
    status: 'readonly',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [], // Can only upload new
  },
  seguroDocumentoUrl: {
    status: 'readonly',
    visibleTo: ['OWNER'],
    editableBy: [], // Can only upload new
  },
  cedulaVerdeUrl: {
    status: 'readonly',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  tituloAutomotorUrl: {
    status: 'restricted',
    visibleTo: ['OWNER'],
    editableBy: [],
    encrypted: true,
  },

  // EDITABLE - Operational
  vtvExpiry: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'], // When uploading new cert
  },
  insuranceCompany: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },
  insurancePolicyNumber: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },
  insuranceExpiry: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  currentMileage: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'TECHNICIAN'], // Tech can update for assigned vehicle
  },
  status: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  color: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  notes: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'],
  },

  // APPROVAL - Assignment
  primaryDriver: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
};

// ===========================================
// INVENTORY PRODUCT FIELDS
// ===========================================
export const PRODUCT_FIELDS: Record<string, FieldPermission> = {
  sku: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
    lockedMessage: 'SKU no puede ser modificado. Cree un nuevo producto.',
  },
  barcode: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  costPrice: {
    status: 'restricted',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
    encrypted: true,
  },
  name: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  description: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  salePrice: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  category: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  minStockLevel: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },
  isActive: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },
};

// ===========================================
// INVOICE FIELDS - Almost all locked after CAE
// ===========================================
export const INVOICE_FIELDS: Record<string, FieldPermission> = {
  invoiceNumber: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  afipCae: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  afipCaeExpiry: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  issuedAt: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  type: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  puntoVenta: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  subtotal: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  taxAmount: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  total: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  customerId: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  items: {
    status: 'locked',
    visibleTo: ['OWNER'],
    editableBy: [],
  },
  // Only these are editable after CAE
  status: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },
  paidAt: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },
  paymentMethod: {
    status: 'editable',
    visibleTo: ['OWNER'],
    editableBy: ['OWNER'],
  },
};

// ===========================================
// JOB FIELDS
// ===========================================
export const JOB_FIELDS: Record<string, FieldPermission> = {
  jobNumber: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
  },
  createdAt: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [],
  },
  customerSignature: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: [], // Once captured
  },
  customerId: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER'],
  },
  // Editable
  address: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'],
  },
  description: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'],
  },
  urgency: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  technicianId: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  scheduledDate: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  status: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'], // Per workflow
  },
  resolution: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['TECHNICIAN'], // Only assigned tech
  },
  materialsUsed: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'TECHNICIAN'], // Until invoiced
  },
  photos: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'TECHNICIAN'],
  },
  serviceType: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'TECHNICIAN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
};

// ===========================================
// MODULE ACCESS BY ROLE
// ===========================================
export type ModuleAccess = 'full' | 'limited' | 'view' | 'own' | 'hidden';

export const MODULE_ACCESS: Record<string, Record<UserRole, ModuleAccess>> = {
  // Dashboard: SUPER_ADMIN sees everything, Owner sees everything, ADMIN sees operations summary, Technician sees own stats
  dashboard: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'limited', TECHNICIAN: 'own' },
  // Jobs: SUPER_ADMIN/Owner & ADMIN manage all jobs, Technician sees only assigned jobs
  jobs: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'own' },
  // Customers: SUPER_ADMIN/Owner & ADMIN manage customers, Technician sees own job customers
  customers: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'own' },
  // Invoices: SUPER_ADMIN/Owner only (billing access)
  invoices: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'hidden', TECHNICIAN: 'hidden' },
  // Payments: SUPER_ADMIN/Owner only (billing access)
  payments: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'hidden', TECHNICIAN: 'hidden' },
  // Fleet: SUPER_ADMIN/Owner manages vehicles, ADMIN views, Technician sees assigned vehicle
  fleet: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'view', TECHNICIAN: 'own' },
  // Inventory: SUPER_ADMIN/Owner manages, ADMIN views stock, Technician logs usage
  inventory: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'view', TECHNICIAN: 'own' },
  // Team: SUPER_ADMIN/Owner only (manages employees)
  team: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'view', TECHNICIAN: 'own' },
  // Settings: SUPER_ADMIN/Owner only (organization config)
  settings: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'hidden', TECHNICIAN: 'hidden' },
  // Analytics: SUPER_ADMIN/Owner sees all, ADMIN sees ops reports, Technician hidden
  analytics: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'limited', TECHNICIAN: 'hidden' },
  // Calendar: SUPER_ADMIN/Owner & ADMIN manage schedule, Technician sees own schedule
  calendar: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'own' },
  // Map: SUPER_ADMIN/Owner & ADMIN see live map, Technician hidden
  map: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'hidden' },
  // WhatsApp: SUPER_ADMIN/Owner & ADMIN manage inbox, Technician hidden
  whatsapp: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'hidden' },
  // Schedule: SUPER_ADMIN/Owner & ADMIN manage all schedules, Technician sees own (read-only)
  schedule: { SUPER_ADMIN: 'full', OWNER: 'full', ADMIN: 'full', TECHNICIAN: 'own' },
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Check if user can view a specific field
 */
export function canViewField(
  fieldConfig: FieldPermission,
  userRole: UserRole,
  isSelf: boolean = false
): boolean {
  if (fieldConfig.visibleTo.includes(userRole)) return true;
  // Special case: users can always see their own data (except restricted)
  if (isSelf && fieldConfig.status !== 'restricted') return true;
  return false;
}

/**
 * Check if user can edit a specific field
 */
export function canEditField(
  fieldConfig: FieldPermission,
  userRole: UserRole,
  isSelf: boolean = false
): boolean {
  if (fieldConfig.status === 'locked' || fieldConfig.status === 'readonly') return false;
  if (fieldConfig.editableBy.includes(userRole)) return true;
  // Special case: users can edit their own contact info
  if (isSelf && ['phone', 'email', 'direccion', 'cbuEmpleado', 'avatar'].includes(fieldConfig.status)) return true;
  return false;
}

/**
 * Check if user has access to a module
 */
export function canAccessModule(module: string, userRole: UserRole): boolean {
  const access = MODULE_ACCESS[module]?.[userRole];
  return access !== undefined && access !== 'hidden';
}

/**
 * Get module access level for a user
 */
export function getModuleAccess(module: string, userRole: UserRole): ModuleAccess {
  return MODULE_ACCESS[module]?.[userRole] || 'hidden';
}

/**
 * Filter sensitive fields from an entity based on user role
 */
export function filterSensitiveFields<T extends Record<string, unknown>>(
  data: T,
  fieldConfig: Record<string, FieldPermission>,
  userRole: UserRole,
  isSelf: boolean = false
): Partial<T> {
  const filtered: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    const config = fieldConfig[key];

    // If no config for this field, include it (backwards compatibility)
    if (!config) {
      filtered[key as keyof T] = value as T[keyof T];
      continue;
    }

    // Check if user can view this field
    if (canViewField(config, userRole, isSelf)) {
      filtered[key as keyof T] = value as T[keyof T];
    }
  }

  return filtered;
}

/**
 * Validate that user can edit the fields they're trying to update
 */
export function validateFieldEdits(
  updates: Record<string, unknown>,
  fieldConfig: Record<string, FieldPermission>,
  userRole: UserRole,
  isSelf: boolean = false
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of Object.keys(updates)) {
    const config = fieldConfig[field];
    if (config && !canEditField(config, userRole, isSelf)) {
      const message = config.lockedMessage || `No tiene permiso para modificar ${field}.`;
      errors.push(message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get field metadata for frontend (shows which fields are locked, etc)
 */
export function getFieldMetadata(
  fieldConfig: Record<string, FieldPermission>,
  userRole: UserRole,
  isSelf: boolean = false
): Record<string, {
  visible: boolean;
  editable: boolean;
  locked: boolean;
  message?: string;
  requiresApproval: boolean;
}> {
  const metadata: Record<string, {
    visible: boolean;
    editable: boolean;
    locked: boolean;
    message?: string;
    requiresApproval: boolean;
  }> = {};

  for (const [key, config] of Object.entries(fieldConfig)) {
    metadata[key] = {
      visible: canViewField(config, userRole, isSelf),
      editable: canEditField(config, userRole, isSelf),
      locked: config.status === 'locked' || config.status === 'readonly',
      message: config.lockedMessage,
      requiresApproval: config.requiresApproval || false,
    };
  }

  return metadata;
}
