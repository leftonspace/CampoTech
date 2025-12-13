/**
 * CampoTech Approval Workflow Service
 * =====================================
 *
 * Handles pending approvals for field changes that require OWNER review.
 * Works with field-permissions.ts to enforce approval requirements.
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ApprovalEntityType = 'organization' | 'user' | 'customer' | 'vehicle' | 'job';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PendingApproval {
  id: string;
  orgId: string;
  entityType: ApprovalEntityType;
  entityId: string;
  fieldName: string;
  currentValue: unknown;
  requestedValue: unknown;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: Date;
  reason?: string;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
}

export interface CreateApprovalInput {
  orgId: string;
  entityType: ApprovalEntityType;
  entityId: string;
  fieldName: string;
  currentValue: unknown;
  requestedValue: unknown;
  requestedBy: string;
  reason?: string;
}

export interface ApprovalDecision {
  approved: boolean;
  reviewedBy: string;
  rejectionReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIELDS REQUIRING APPROVAL
// ═══════════════════════════════════════════════════════════════════════════════

// From field-permissions.ts, these fields have status: 'approval'
export const FIELDS_REQUIRING_APPROVAL: Record<ApprovalEntityType, string[]> = {
  organization: ['domicilioFiscal', 'codigoPostal'],
  user: ['role', 'puesto', 'isActive'],
  customer: ['direccionFiscal'],
  vehicle: ['primaryDriver'],
  job: ['customerId'],
};

/**
 * Check if a field requires approval
 */
export function requiresApproval(entityType: ApprovalEntityType, fieldName: string): boolean {
  return FIELDS_REQUIRING_APPROVAL[entityType]?.includes(fieldName) ?? false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL WORKFLOW SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ApprovalWorkflowService {
  /**
   * Create a pending approval request
   */
  async createApproval(input: CreateApprovalInput): Promise<PendingApproval> {
    try {
      const result = await prisma.$queryRaw<Array<{
        id: string;
        org_id: string;
        entity_type: string;
        entity_id: string;
        field_name: string;
        current_value: unknown;
        requested_value: unknown;
        requested_by: string;
        requested_at: Date;
        reason: string | null;
        status: string;
      }>>`
        INSERT INTO pending_approvals (
          org_id, entity_type, entity_id, field_name,
          current_value, requested_value, requested_by, reason
        ) VALUES (
          ${input.orgId}::uuid,
          ${input.entityType},
          ${input.entityId}::uuid,
          ${input.fieldName},
          ${JSON.stringify(input.currentValue)}::jsonb,
          ${JSON.stringify(input.requestedValue)}::jsonb,
          ${input.requestedBy}::uuid,
          ${input.reason || null}
        )
        RETURNING
          id, org_id, entity_type, entity_id, field_name,
          current_value, requested_value, requested_by,
          requested_at, reason, status
      `;

      const approval = result[0];

      // Notify OWNER (in real implementation)
      await this.notifyOwner(input.orgId, approval.id);

      return this.mapToApproval(approval);
    } catch (error) {
      console.error('Error creating approval:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals for an organization
   */
  async getPendingApprovals(orgId: string): Promise<PendingApproval[]> {
    try {
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          pa.id, pa.org_id, pa.entity_type, pa.entity_id, pa.field_name,
          pa.current_value, pa.requested_value, pa.requested_by,
          pa.requested_at, pa.reason, pa.status,
          pa.reviewed_by, pa.reviewed_at, pa.rejection_reason,
          u.name as requested_by_name
        FROM pending_approvals pa
        LEFT JOIN users u ON pa.requested_by = u.id
        WHERE pa.org_id = ${orgId}::uuid
        AND pa.status = 'pending'
        ORDER BY pa.requested_at DESC
      `;

      return result.map((row: typeof result[number]) => this.mapToApproval(row));
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      return [];
    }
  }

  /**
   * Get approval by ID
   */
  async getApproval(approvalId: string, orgId: string): Promise<PendingApproval | null> {
    try {
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          pa.id, pa.org_id, pa.entity_type, pa.entity_id, pa.field_name,
          pa.current_value, pa.requested_value, pa.requested_by,
          pa.requested_at, pa.reason, pa.status,
          pa.reviewed_by, pa.reviewed_at, pa.rejection_reason,
          u.name as requested_by_name,
          r.name as reviewed_by_name
        FROM pending_approvals pa
        LEFT JOIN users u ON pa.requested_by = u.id
        LEFT JOIN users r ON pa.reviewed_by = r.id
        WHERE pa.id = ${approvalId}::uuid
        AND pa.org_id = ${orgId}::uuid
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      return this.mapToApproval(result[0]);
    } catch (error) {
      console.error('Error getting approval:', error);
      return null;
    }
  }

  /**
   * Approve a pending request
   */
  async approve(
    approvalId: string,
    orgId: string,
    reviewedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const approval = await this.getApproval(approvalId, orgId);

      if (!approval) {
        return { success: false, error: 'Aprobación no encontrada.' };
      }

      if (approval.status !== 'pending') {
        return { success: false, error: 'Esta solicitud ya fue procesada.' };
      }

      // Update approval status
      await prisma.$executeRaw`
        UPDATE pending_approvals
        SET
          status = 'approved',
          reviewed_by = ${reviewedBy}::uuid,
          reviewed_at = NOW()
        WHERE id = ${approvalId}::uuid
      `;

      // Apply the change to the entity
      await this.applyChange(approval);

      // Notify requester
      await this.notifyRequester(approval.requestedBy, approvalId, true);

      return { success: true };
    } catch (error) {
      console.error('Error approving request:', error);
      return { success: false, error: 'Error al aprobar la solicitud.' };
    }
  }

  /**
   * Reject a pending request
   */
  async reject(
    approvalId: string,
    orgId: string,
    reviewedBy: string,
    rejectionReason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const approval = await this.getApproval(approvalId, orgId);

      if (!approval) {
        return { success: false, error: 'Aprobación no encontrada.' };
      }

      if (approval.status !== 'pending') {
        return { success: false, error: 'Esta solicitud ya fue procesada.' };
      }

      // Update approval status
      await prisma.$executeRaw`
        UPDATE pending_approvals
        SET
          status = 'rejected',
          reviewed_by = ${reviewedBy}::uuid,
          reviewed_at = NOW(),
          rejection_reason = ${rejectionReason}
        WHERE id = ${approvalId}::uuid
      `;

      // Notify requester
      await this.notifyRequester(approval.requestedBy, approvalId, false, rejectionReason);

      return { success: true };
    } catch (error) {
      console.error('Error rejecting request:', error);
      return { success: false, error: 'Error al rechazar la solicitud.' };
    }
  }

  /**
   * Get pending approval count for an organization
   */
  async getPendingCount(orgId: string): Promise<number> {
    try {
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM pending_approvals
        WHERE org_id = ${orgId}::uuid AND status = 'pending'
      `;

      return Number(result[0]?.count ?? 0);
    } catch (error) {
      console.error('Error getting pending count:', error);
      return 0;
    }
  }

  /**
   * Get approval history for an entity
   */
  async getEntityApprovalHistory(
    entityType: ApprovalEntityType,
    entityId: string
  ): Promise<PendingApproval[]> {
    try {
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          pa.id, pa.org_id, pa.entity_type, pa.entity_id, pa.field_name,
          pa.current_value, pa.requested_value, pa.requested_by,
          pa.requested_at, pa.reason, pa.status,
          pa.reviewed_by, pa.reviewed_at, pa.rejection_reason,
          u.name as requested_by_name,
          r.name as reviewed_by_name
        FROM pending_approvals pa
        LEFT JOIN users u ON pa.requested_by = u.id
        LEFT JOIN users r ON pa.reviewed_by = r.id
        WHERE pa.entity_type = ${entityType}
        AND pa.entity_id = ${entityId}::uuid
        ORDER BY pa.requested_at DESC
      `;

      return result.map((row: typeof result[number]) => this.mapToApproval(row));
    } catch (error) {
      console.error('Error getting entity approval history:', error);
      return [];
    }
  }

  /**
   * Check for existing pending approval for same field
   */
  async hasPendingApproval(
    entityType: ApprovalEntityType,
    entityId: string,
    fieldName: string
  ): Promise<boolean> {
    try {
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM pending_approvals
        WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}::uuid
        AND field_name = ${fieldName}
        AND status = 'pending'
      `;

      return Number(result[0]?.count ?? 0) > 0;
    } catch (error) {
      console.error('Error checking pending approval:', error);
      return false;
    }
  }

  /**
   * Apply approved change to entity
   */
  private async applyChange(approval: PendingApproval): Promise<void> {
    const { entityType, entityId, fieldName, requestedValue } = approval;

    // Build dynamic update based on entity type
    switch (entityType) {
      case 'user':
        await prisma.user.update({
          where: { id: entityId },
          data: { [fieldName]: requestedValue },
        });
        break;

      case 'customer':
        await prisma.customer.update({
          where: { id: entityId },
          data: { [fieldName]: requestedValue },
        });
        break;

      case 'vehicle':
        // Handle vehicle fields specially
        if (fieldName === 'primaryDriver') {
          // Update vehicle assignments
          // This is a placeholder - actual implementation depends on schema
        }
        break;

      case 'job':
        await prisma.job.update({
          where: { id: entityId },
          data: { [fieldName]: requestedValue },
        });
        break;

      case 'organization':
        // Organization updates might need special handling
        await prisma.organization.update({
          where: { id: entityId },
          data: { [fieldName]: requestedValue },
        });
        break;
    }
  }

  /**
   * Notify OWNER about new approval request
   */
  private async notifyOwner(orgId: string, approvalId: string): Promise<void> {
    try {
      // Get OWNER(s) for the organization
      const owners = await prisma.user.findMany({
        where: { organizationId: orgId, role: 'OWNER', isActive: true },
        select: { id: true },
      });

      // Create notifications for each owner
      for (const owner of owners as typeof owners) {
        await prisma.$executeRaw`
          INSERT INTO user_notifications (
            user_id, org_id, type, title, message, reference_type, reference_id, action_url
          ) VALUES (
            ${owner.id}::uuid,
            ${orgId}::uuid,
            'approval_required',
            'Nueva solicitud de aprobación',
            'Hay una solicitud de cambio pendiente de tu revisión.',
            'pending_approval',
            ${approvalId}::uuid,
            '/dashboard/settings/approvals'
          )
        `;
      }
    } catch (error) {
      console.error('Error notifying owner:', error);
    }
  }

  /**
   * Notify requester about approval decision
   */
  private async notifyRequester(
    userId: string,
    approvalId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<void> {
    try {
      const approval = await prisma.$queryRaw<Array<{ org_id: string }>>`
        SELECT org_id FROM pending_approvals WHERE id = ${approvalId}::uuid
      `;

      if (approval.length === 0) return;

      const orgId = approval[0].org_id;

      const title = approved
        ? 'Solicitud aprobada'
        : 'Solicitud rechazada';

      const message = approved
        ? 'Tu solicitud de cambio ha sido aprobada.'
        : `Tu solicitud de cambio fue rechazada. Motivo: ${rejectionReason}`;

      await prisma.$executeRaw`
        INSERT INTO user_notifications (
          user_id, org_id, type, title, message, reference_type, reference_id
        ) VALUES (
          ${userId}::uuid,
          ${orgId}::uuid,
          'approval_result',
          ${title},
          ${message},
          'pending_approval',
          ${approvalId}::uuid
        )
      `;
    } catch (error) {
      console.error('Error notifying requester:', error);
    }
  }

  /**
   * Map database row to PendingApproval type
   */
  private mapToApproval(row: Record<string, unknown>): PendingApproval {
    return {
      id: row.id as string,
      orgId: row.org_id as string,
      entityType: row.entity_type as ApprovalEntityType,
      entityId: row.entity_id as string,
      fieldName: row.field_name as string,
      currentValue: row.current_value,
      requestedValue: row.requested_value,
      requestedBy: row.requested_by as string,
      requestedByName: row.requested_by_name as string | undefined,
      requestedAt: row.requested_at as Date,
      reason: row.reason as string | undefined,
      status: row.status as ApprovalStatus,
      reviewedBy: row.reviewed_by as string | undefined,
      reviewedByName: row.reviewed_by_name as string | undefined,
      reviewedAt: row.reviewed_at as Date | undefined,
      rejectionReason: row.rejection_reason as string | undefined,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let approvalWorkflowInstance: ApprovalWorkflowService | null = null;

export function getApprovalWorkflowService(): ApprovalWorkflowService {
  if (!approvalWorkflowInstance) {
    approvalWorkflowInstance = new ApprovalWorkflowService();
  }
  return approvalWorkflowInstance;
}

export const approvalWorkflow = getApprovalWorkflowService();
