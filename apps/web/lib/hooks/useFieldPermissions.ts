/**
 * Field Permissions Hook
 * ======================
 *
 * Provides field-level access control metadata for forms.
 * Uses the centralized field permissions configuration.
 */

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  ORGANIZATION_FIELDS,
  USER_FIELDS,
  CUSTOMER_FIELDS,
  VEHICLE_FIELDS,
  PRODUCT_FIELDS,
  INVOICE_FIELDS,
  JOB_FIELDS,
  getFieldMetadata,
  type UserRole,
  type FieldPermission,
} from '@/lib/config/field-permissions';
import type { FieldMeta } from '@/components/ui/permission-field';

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY FIELD CONFIGS
// ═══════════════════════════════════════════════════════════════════════════════

const ENTITY_FIELDS: Record<string, Record<string, FieldPermission>> = {
  organization: ORGANIZATION_FIELDS,
  user: USER_FIELDS,
  customer: CUSTOMER_FIELDS,
  vehicle: VEHICLE_FIELDS,
  product: PRODUCT_FIELDS,
  inventory: PRODUCT_FIELDS, // Alias for backwards compatibility
  invoice: INVOICE_FIELDS,
  job: JOB_FIELDS,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export type EntityType = keyof typeof ENTITY_FIELDS;

export interface UseFieldPermissionsResult {
  /**
   * Get metadata for a specific field
   */
  getFieldMeta: (fieldName: string) => FieldMeta;

  /**
   * Check if a field is visible to the current user
   */
  isFieldVisible: (fieldName: string) => boolean;

  /**
   * Check if a field is editable by the current user
   */
  isFieldEditable: (fieldName: string) => boolean;

  /**
   * Check if a field is locked (cannot be edited)
   */
  isFieldLocked: (fieldName: string) => boolean;

  /**
   * Check if editing a field requires approval
   */
  requiresApproval: (fieldName: string) => boolean;

  /**
   * Get all field metadata as a map
   */
  allFieldMeta: Record<string, FieldMeta>;

  /**
   * Current user's role
   */
  userRole: UserRole;
}

/**
 * Hook to get field permissions for an entity type
 *
 * @param entityType - The type of entity (organization, user, customer, etc.)
 * @param isSelf - Whether the user is editing their own record (for self-editable fields)
 */
export function useFieldPermissions(
  entityType: EntityType,
  isSelf: boolean = false
): UseFieldPermissionsResult {
  const { user } = useAuth();

  // Get user role, defaulting to VIEWER
  const userRole = useMemo(() => {
    return (user?.role?.toUpperCase() || 'VIEWER') as UserRole;
  }, [user?.role]);

  // Get the field config for this entity type
  const fieldConfig = ENTITY_FIELDS[entityType] || {};

  // Generate all field metadata
  const allFieldMeta = useMemo(() => {
    return getFieldMetadata(fieldConfig, userRole, isSelf);
  }, [fieldConfig, userRole, isSelf]);

  // Helper to get metadata for a specific field
  const getFieldMeta = (fieldName: string): FieldMeta => {
    const meta = allFieldMeta[fieldName];
    if (meta) {
      return meta;
    }
    // Default: visible and editable
    return {
      visible: true,
      editable: true,
      locked: false,
      requiresApproval: false,
    };
  };

  // Helper functions
  const isFieldVisible = (fieldName: string): boolean => {
    return getFieldMeta(fieldName).visible;
  };

  const isFieldEditable = (fieldName: string): boolean => {
    return getFieldMeta(fieldName).editable;
  };

  const isFieldLocked = (fieldName: string): boolean => {
    return getFieldMeta(fieldName).locked;
  };

  const requiresApproval = (fieldName: string): boolean => {
    return getFieldMeta(fieldName).requiresApproval ?? false;
  };

  return {
    getFieldMeta,
    isFieldVisible,
    isFieldEditable,
    isFieldLocked,
    requiresApproval,
    allFieldMeta,
    userRole,
  };
}

/**
 * Utility function to filter form data to only include editable fields
 */
export function filterEditableFields<T extends Record<string, unknown>>(
  data: T,
  fieldMeta: Record<string, FieldMeta>
): Partial<T> {
  const filtered: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    const meta = fieldMeta[key];
    // Include if field is not in config (default editable) or if editable
    if (!meta || meta.editable) {
      filtered[key as keyof T] = value as T[keyof T];
    }
  }

  return filtered;
}

/**
 * Utility function to get list of locked fields with their messages
 */
export function getLockedFieldsInfo(
  fieldMeta: Record<string, FieldMeta>
): Array<{ field: string; message?: string }> {
  return Object.entries(fieldMeta)
    .filter(([_, meta]) => meta.locked || !meta.editable)
    .map(([field, meta]) => ({
      field,
      message: meta.message,
    }));
}
