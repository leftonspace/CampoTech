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

export type UserRole = 'OWNER' | 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN' | 'VIEWER';
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
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'CUIT no puede ser modificado. Contacte soporte@campotech.com con documentacion de AFIP.',
  },
  razonSocial: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'Razon Social no puede ser modificada. Requiere documentacion de IGJ.',
  },
  tipoSociedad: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'Tipo de sociedad no puede ser modificado.',
  },
  ivaCondition: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'Condicion de IVA no puede ser modificada. Requiere cambio en AFIP primero.',
  },
  puntoVentaAfip: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'Punto de venta AFIP no puede ser modificado.',
  },
  fechaInscripcionAfip: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  ingresosBrutos: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'Numero de IIBB no puede ser modificado. Contacte soporte.',
  },

  // APPROVAL REQUIRED
  domicilioFiscal: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN'],
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
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  nombreComercial: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  phone: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  email: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  direccionComercial: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  logo: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  horariosAtencion: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
};

// ===========================================
// USER (EMPLOYEE) FIELDS
// ===========================================
export const USER_FIELDS: Record<string, FieldPermission> = {
  // LOCKED - Government/AFIP data
  cuil: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'CUIL no puede ser modificado. Es asignado por ANSES.',
  },
  dni: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'DNI no puede ser modificado.',
  },
  legalName: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'Nombre legal no puede ser modificado. Contacte soporte con documentacion.',
  },
  fechaNacimiento: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  nacionalidad: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  sexo: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'Genero puede ser modificado con documentacion legal (Ley 26.743).',
  },
  fechaIngreso: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'Fecha de ingreso esta registrada en AFIP y no puede ser modificada.',
  },
  modalidadContrato: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'Modalidad de contrato esta registrada en AFIP.',
  },
  obraSocial: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'Obra social debe ser cambiada en AFIP.',
  },
  art: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'ART es a nivel empresa, no puede ser por empleado.',
  },
  convenioColectivo: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
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
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER'],
    requiresApproval: true,
  },
  puesto: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER'],
    requiresApproval: true,
  },
  isActive: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
  },

  // EDITABLE
  name: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  phone: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
    editableBy: ['ADMIN'], // Self can also edit
  },
  email: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
    editableBy: ['ADMIN'], // Self can also edit
  },
  direccion: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['ADMIN'], // Self can also edit
  },
  contactoEmergencia: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['ADMIN'], // Self can also edit
  },
  ubicacionAsignada: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  specialty: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  skillLevel: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  avatar: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'], // Self can edit
  },
};

// ===========================================
// CUSTOMER FIELDS
// ===========================================
export const CUSTOMER_FIELDS: Record<string, FieldPermission> = {
  // LOCKED for business customers
  cuit: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'CUIT de cliente no puede ser modificado. Contacte soporte.',
  },
  razonSocial: {
    status: 'locked', // Only locked if has CUIT
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'Razon social debe coincidir con AFIP.',
  },
  condicionIva: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'Condicion IVA determina tipo de factura.',
  },
  dni: {
    status: 'locked', // If provided
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
  },

  // APPROVAL for fiscal address
  direccionFiscal: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },

  // EDITABLE
  name: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER'],
  },
  phone: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
  },
  email: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
  },
  address: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
  },
  notes: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
  },
};

// ===========================================
// VEHICLE FIELDS
// ===========================================
export const VEHICLE_FIELDS: Record<string, FieldPermission> = {
  // LOCKED - Cannot ever change
  plateNumber: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'Patente no puede ser modificada. Cree un nuevo vehiculo.',
  },
  vin: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  make: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
  },
  model: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
  },
  year: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
  },
  fuelType: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
    lockedMessage: 'Tipo de combustible solo puede cambiar con conversion a GNC documentada.',
  },

  // LOCKED DOCUMENTS - Upload new only (readonly for viewing)
  vtvCertificadoUrl: {
    status: 'readonly',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [], // Can only upload new
  },
  seguroDocumentoUrl: {
    status: 'readonly',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [], // Can only upload new
  },
  cedulaVerdeUrl: {
    status: 'readonly',
    visibleTo: ['OWNER', 'ADMIN'],
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
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'], // When uploading new cert
  },
  insuranceCompany: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  insurancePolicyNumber: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  insuranceExpiry: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  currentMileage: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'], // Tech can update for assigned vehicle
  },
  status: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  color: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  notes: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
  },

  // APPROVAL - Assignment
  primaryDriver: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
};

// ===========================================
// INVENTORY PRODUCT FIELDS
// ===========================================
export const PRODUCT_FIELDS: Record<string, FieldPermission> = {
  sku: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
    lockedMessage: 'SKU no puede ser modificado. Cree un nuevo producto.',
  },
  barcode: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  costPrice: {
    status: 'restricted',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
    encrypted: true,
  },
  name: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  description: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  salePrice: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  category: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  minStockLevel: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  isActive: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
};

// ===========================================
// INVOICE FIELDS - Almost all locked after CAE
// ===========================================
export const INVOICE_FIELDS: Record<string, FieldPermission> = {
  invoiceNumber: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  afipCae: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  afipCaeExpiry: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  issuedAt: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  type: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  puntoVenta: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  subtotal: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  taxAmount: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  total: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  customerId: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  items: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: [],
  },
  // Only these are editable after CAE
  status: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  paidAt: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  paymentMethod: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN'],
    editableBy: ['OWNER', 'ADMIN'],
  },
};

// ===========================================
// JOB FIELDS
// ===========================================
export const JOB_FIELDS: Record<string, FieldPermission> = {
  jobNumber: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
  },
  createdAt: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [],
  },
  customerSignature: {
    status: 'locked',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: [], // Once captured
  },
  customerId: {
    status: 'approval',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN'],
  },
  // Editable
  address: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
  },
  description: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'],
  },
  urgency: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER'],
  },
  technicianId: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER'],
  },
  scheduledDate: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER'],
  },
  status: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'], // Per workflow
  },
  resolution: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['TECHNICIAN'], // Only assigned tech
  },
  materialsUsed: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'], // Until invoiced
  },
  photos: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'TECHNICIAN'],
  },
  serviceType: {
    status: 'editable',
    visibleTo: ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'VIEWER'],
    editableBy: ['OWNER', 'ADMIN', 'DISPATCHER'],
  },
};

// ===========================================
// MODULE ACCESS BY ROLE
// ===========================================
export type ModuleAccess = 'full' | 'limited' | 'view' | 'own' | 'hidden';

export const MODULE_ACCESS: Record<string, Record<UserRole, ModuleAccess>> = {
  dashboard: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'limited', TECHNICIAN: 'own', VIEWER: 'view' },
  jobs: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'full', TECHNICIAN: 'own', VIEWER: 'view' },
  customers: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'full', TECHNICIAN: 'own', VIEWER: 'view' },
  invoices: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'view', TECHNICIAN: 'hidden', VIEWER: 'view' },
  payments: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'hidden', TECHNICIAN: 'hidden', VIEWER: 'hidden' },
  fleet: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'view', TECHNICIAN: 'own', VIEWER: 'view' },
  inventory: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'view', TECHNICIAN: 'own', VIEWER: 'view' },
  team: { OWNER: 'full', ADMIN: 'limited', DISPATCHER: 'view', TECHNICIAN: 'own', VIEWER: 'hidden' },
  settings: { OWNER: 'full', ADMIN: 'limited', DISPATCHER: 'hidden', TECHNICIAN: 'hidden', VIEWER: 'hidden' },
  analytics: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'limited', TECHNICIAN: 'hidden', VIEWER: 'view' },
  calendar: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'full', TECHNICIAN: 'own', VIEWER: 'view' },
  map: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'full', TECHNICIAN: 'hidden', VIEWER: 'view' },
  locations: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'view', TECHNICIAN: 'hidden', VIEWER: 'view' },
  whatsapp: { OWNER: 'full', ADMIN: 'full', DISPATCHER: 'full', TECHNICIAN: 'hidden', VIEWER: 'hidden' },
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
