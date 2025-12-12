/**
 * Field Filter Middleware
 * Filters entity data based on user role and field permissions
 */

import {
  ORGANIZATION_FIELDS,
  USER_FIELDS,
  CUSTOMER_FIELDS,
  VEHICLE_FIELDS,
  PRODUCT_FIELDS,
  INVOICE_FIELDS,
  JOB_FIELDS,
  UserRole,
  FieldPermission,
  canViewField,
  canEditField,
  filterSensitiveFields,
  validateFieldEdits,
  getFieldMetadata,
} from '@/lib/config/field-permissions';

export type EntityType = 'organization' | 'user' | 'customer' | 'vehicle' | 'product' | 'invoice' | 'job';

const FIELD_CONFIGS: Record<EntityType, Record<string, FieldPermission>> = {
  organization: ORGANIZATION_FIELDS,
  user: USER_FIELDS,
  customer: CUSTOMER_FIELDS,
  vehicle: VEHICLE_FIELDS,
  product: PRODUCT_FIELDS,
  invoice: INVOICE_FIELDS,
  job: JOB_FIELDS,
};

/**
 * Filter entity data based on user's role
 * Removes fields the user shouldn't see
 */
export function filterEntityByRole<T extends Record<string, unknown>>(
  data: T,
  entityType: EntityType,
  userRole: UserRole,
  isSelf: boolean = false
): Partial<T> {
  const fieldConfig = FIELD_CONFIGS[entityType];
  if (!fieldConfig) return data;

  return filterSensitiveFields(data, fieldConfig, userRole, isSelf);
}

/**
 * Filter array of entities
 */
export function filterEntitiesByRole<T extends Record<string, unknown>>(
  data: T[],
  entityType: EntityType,
  userRole: UserRole
): Partial<T>[] {
  return data.map((item) => filterEntityByRole(item, entityType, userRole));
}

/**
 * Get field metadata for a specific entity type
 */
export function getEntityFieldMetadata(
  entityType: EntityType,
  userRole: UserRole,
  isSelf: boolean = false
): Record<string, {
  visible: boolean;
  editable: boolean;
  locked: boolean;
  message?: string;
  requiresApproval: boolean;
}> {
  const fieldConfig = FIELD_CONFIGS[entityType];
  if (!fieldConfig) return {};

  return getFieldMetadata(fieldConfig, userRole, isSelf);
}

/**
 * Validate update request for an entity
 */
export function validateEntityUpdate(
  updates: Record<string, unknown>,
  entityType: EntityType,
  userRole: UserRole,
  isSelf: boolean = false
): { valid: boolean; errors: string[] } {
  const fieldConfig = FIELD_CONFIGS[entityType];
  if (!fieldConfig) return { valid: true, errors: [] };

  return validateFieldEdits(updates, fieldConfig, userRole, isSelf);
}

/**
 * Check if a specific field can be viewed
 */
export function canViewEntityField(
  entityType: EntityType,
  fieldName: string,
  userRole: UserRole,
  isSelf: boolean = false
): boolean {
  const fieldConfig = FIELD_CONFIGS[entityType]?.[fieldName];
  if (!fieldConfig) return true; // Unknown fields are visible by default

  return canViewField(fieldConfig, userRole, isSelf);
}

/**
 * Check if a specific field can be edited
 */
export function canEditEntityField(
  entityType: EntityType,
  fieldName: string,
  userRole: UserRole,
  isSelf: boolean = false
): boolean {
  const fieldConfig = FIELD_CONFIGS[entityType]?.[fieldName];
  if (!fieldConfig) return true; // Unknown fields are editable by default

  return canEditField(fieldConfig, userRole, isSelf);
}

/**
 * Special validation for invoices with CAE
 * Almost all fields are locked after CAE is assigned
 */
export function validateInvoiceUpdate(
  invoice: { afipCae?: string | null },
  updates: Record<string, unknown>,
  userRole: UserRole
): { valid: boolean; errors: string[] } {
  // If invoice doesn't have CAE yet, use normal validation
  if (!invoice.afipCae) {
    return validateEntityUpdate(updates, 'invoice', userRole);
  }

  // With CAE, only status, paidAt, and paymentMethod can be updated
  const allowedFieldsAfterCae = ['status', 'paidAt', 'paymentMethod'];
  const attemptedFields = Object.keys(updates);
  const disallowedFields = attemptedFields.filter((f) => !allowedFieldsAfterCae.includes(f));

  if (disallowedFields.length > 0) {
    return {
      valid: false,
      errors: [
        `Factura con CAE no puede ser modificada. Campos bloqueados: ${disallowedFields.join(', ')}. Emita una Nota de Credito.`,
      ],
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Create response with filtered data and field metadata
 */
export function createFilteredResponse<T extends Record<string, unknown>>(
  data: T,
  entityType: EntityType,
  userRole: UserRole,
  isSelf: boolean = false
): {
  data: Partial<T>;
  _fieldMeta: Record<string, {
    visible: boolean;
    editable: boolean;
    locked: boolean;
    message?: string;
    requiresApproval: boolean;
  }>;
} {
  return {
    data: filterEntityByRole(data, entityType, userRole, isSelf),
    _fieldMeta: getEntityFieldMetadata(entityType, userRole, isSelf),
  };
}

/**
 * Create response with filtered array and field metadata
 */
export function createFilteredArrayResponse<T extends Record<string, unknown>>(
  data: T[],
  entityType: EntityType,
  userRole: UserRole
): {
  data: Partial<T>[];
  _fieldMeta: Record<string, {
    visible: boolean;
    editable: boolean;
    locked: boolean;
    message?: string;
    requiresApproval: boolean;
  }>;
} {
  return {
    data: filterEntitiesByRole(data, entityType, userRole),
    _fieldMeta: getEntityFieldMetadata(entityType, userRole),
  };
}

// Re-export types for convenience
export type { UserRole, FieldPermission } from '@/lib/config/field-permissions';

// Re-export utilities for convenience
export {
  ORGANIZATION_FIELDS,
  USER_FIELDS,
  CUSTOMER_FIELDS,
  VEHICLE_FIELDS,
  PRODUCT_FIELDS,
  INVOICE_FIELDS,
  JOB_FIELDS,
  MODULE_ACCESS,
  canAccessModule,
  getModuleAccess,
} from '@/lib/config/field-permissions';
