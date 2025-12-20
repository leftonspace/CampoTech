/**
 * Audit Logging Utility
 * Logs all data changes for compliance with Argentine law (Ley 25.326)
 */

import { prisma } from '@/lib/prisma';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'acknowledgment_accepted'
  | 'verification_submit'
  | 'document_upload'
  | 'cuit_validation';

export interface AuditEntry {
  userId: string;
  userRole: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  fieldChanged?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit entry to the database
 */
export async function logAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    // Build old_data and new_data JSONB objects
    const oldData = entry.oldValue !== undefined
      ? { [entry.fieldChanged || 'value']: entry.oldValue }
      : null;

    const newData = entry.newValue !== undefined
      ? { [entry.fieldChanged || 'value']: entry.newValue }
      : null;

    // Include metadata in the audit log
    const fullMetadata = {
      ...entry.metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      fieldChanged: entry.fieldChanged,
    };

    // Insert using raw query since audit_logs uses UUIDs
    await prisma.$executeRaw`
      INSERT INTO audit_logs (
        org_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        metadata,
        created_at
      ) VALUES (
        ${entry.organizationId}::uuid,
        ${entry.userId}::uuid,
        ${entry.action},
        ${entry.entityType},
        ${entry.entityId}::uuid,
        ${oldData ? JSON.stringify(oldData) : null}::jsonb,
        ${newData ? JSON.stringify(newData) : null}::jsonb,
        ${JSON.stringify(fullMetadata)}::jsonb,
        NOW()
      )
    `;
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main operation
    console.error('Audit logging error:', error);
  }
}

/**
 * Log a bulk audit entry for multiple field changes
 */
export async function logBulkAuditEntry(
  baseEntry: Omit<AuditEntry, 'fieldChanged' | 'oldValue' | 'newValue'>,
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>
): Promise<void> {
  try {
    const oldData: Record<string, unknown> = {};
    const newData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    for (const change of changes) {
      if (change.oldValue !== change.newValue) {
        oldData[change.field] = change.oldValue;
        newData[change.field] = change.newValue;
        changedFields.push(change.field);
      }
    }

    if (changedFields.length === 0) {
      return; // No actual changes
    }

    const metadata = {
      ...baseEntry.metadata,
      ipAddress: baseEntry.ipAddress,
      userAgent: baseEntry.userAgent,
      changedFields,
    };

    await prisma.$executeRaw`
      INSERT INTO audit_logs (
        org_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        metadata,
        created_at
      ) VALUES (
        ${baseEntry.organizationId}::uuid,
        ${baseEntry.userId}::uuid,
        ${baseEntry.action},
        ${baseEntry.entityType},
        ${baseEntry.entityId}::uuid,
        ${JSON.stringify(oldData)}::jsonb,
        ${JSON.stringify(newData)}::jsonb,
        ${JSON.stringify(metadata)}::jsonb,
        NOW()
      )
    `;
  } catch (error) {
    console.error('Bulk audit logging error:', error);
  }
}

/**
 * Helper to detect changes between two objects
 */
export function detectChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fieldsToTrack?: string[]
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
  const fields = fieldsToTrack || Object.keys({ ...oldObj, ...newObj });

  for (const field of fields) {
    const oldValue = oldObj[field];
    const newValue = newObj[field];

    // Skip if both are undefined/null
    if (oldValue == null && newValue == null) continue;

    // Check for changes
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field, oldValue, newValue });
    }
  }

  return changes;
}

/**
 * Helper to create audit entry from request
 */
export function createAuditEntryFromRequest(
  request: Request,
  session: { userId: string; role: string; organizationId: string },
  entityType: string,
  entityId: string,
  action: AuditAction
): Omit<AuditEntry, 'fieldChanged' | 'oldValue' | 'newValue'> {
  return {
    userId: session.userId,
    userRole: session.role,
    organizationId: session.organizationId,
    entityType,
    entityId,
    action,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

/**
 * Middleware function to add audit logging to API route handlers
 */
export function withAuditLogging<T>(
  handler: (request: Request, context: T) => Promise<Response>,
  options: {
    entityType: string;
    getEntityId: (request: Request, context: T) => Promise<string>;
    action: AuditAction;
    getChanges?: (request: Request, context: T, oldData: unknown, newData: unknown) => Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  }
): (request: Request, context: T) => Promise<Response> {
  return async (request: Request, context: T) => {
    // Execute the handler
    const response = await handler(request, context);

    // Log audit entry in the background (don't await)
    // This would need access to session and old/new data
    // Implementation depends on your specific needs

    return response;
  };
}
