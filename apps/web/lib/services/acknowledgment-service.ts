/**
 * Acknowledgment Service
 * ======================
 *
 * Service for managing legal acknowledgments.
 * Handles checking, recording, and validating acknowledgment status.
 */

import { prisma } from '@/lib/prisma';
import {
  ACKNOWLEDGMENTS,
  getTier2RequiredAcknowledgments,
  getFirstEmployeeAcknowledgments,
  type AcknowledgmentType,
  type AcknowledgmentTrigger,
} from '@/lib/config/acknowledgments';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// Define Prisma Enum locally since it's not being exported correctly from @prisma/client in this env
enum PrismaAcknowledgmentType {
  terms_of_service = 'terms_of_service',
  verification_responsibility = 'verification_responsibility',
  employee_responsibility = 'employee_responsibility',
  data_accuracy = 'data_accuracy',
  update_obligation = 'update_obligation'
}

export interface AcknowledgmentInput {
  userId: string;
  organizationId: string;
  acknowledgmentType: AcknowledgmentType;
  version?: string;
  ipAddress?: string | null;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;
}

export interface AcknowledgmentStatus {
  type: AcknowledgmentType;
  title: string;
  requiredVersion: string;
  acknowledged: boolean;
  acknowledgedVersion: string | null;
  acknowledgedAt: Date | null;
  isOutdated: boolean;
}

export interface MissingAcknowledgment {
  type: AcknowledgmentType;
  title: string;
  version: string;
  isBlocking: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACKNOWLEDGMENT SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class AcknowledgmentServiceClass {
  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK ACKNOWLEDGMENT STATUS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if user has acknowledged a specific type (with current version)
   */
  async hasAcknowledged(userId: string, type: AcknowledgmentType): Promise<boolean> {
    const config = ACKNOWLEDGMENTS[type];
    if (!config) return true; // Unknown type, assume acknowledged

    const acknowledgment = await prisma.complianceAcknowledgment.findUnique({
      where: {
        userId_acknowledgmentType_version: {
          userId,
          acknowledgmentType: type as unknown as PrismaAcknowledgmentType,
          version: config.version,
        },
      },
    });

    return !!acknowledgment;
  }

  /**
   * Check if user has acknowledged any version of a type
   */
  async hasEverAcknowledged(userId: string, type: AcknowledgmentType): Promise<boolean> {
    const count = await prisma.complianceAcknowledgment.count({
      where: {
        userId,
        acknowledgmentType: type as unknown as PrismaAcknowledgmentType,
      },
    });

    return count > 0;
  }

  /**
   * Get acknowledgment status for a specific type
   */
  async getAcknowledgmentStatus(
    userId: string,
    type: AcknowledgmentType
  ): Promise<AcknowledgmentStatus> {
    const config = ACKNOWLEDGMENTS[type];
    if (!config) {
      throw new Error(`Unknown acknowledgment type: ${type}`);
    }

    // Get latest acknowledgment for this type
    const acknowledgment = await prisma.complianceAcknowledgment.findFirst({
      where: {
        userId,
        acknowledgmentType: type as unknown as PrismaAcknowledgmentType,
      },
      orderBy: { acknowledgedAt: 'desc' },
    });

    const acknowledged = !!acknowledgment;
    const isOutdated = acknowledged && acknowledgment.version !== config.version;

    return {
      type,
      title: config.title,
      requiredVersion: config.version,
      acknowledged: acknowledged && !isOutdated,
      acknowledgedVersion: acknowledgment?.version || null,
      acknowledgedAt: acknowledgment?.acknowledgedAt || null,
      isOutdated,
    };
  }

  /**
   * Get all acknowledgment statuses for a user
   */
  async getAllAcknowledgmentStatuses(userId: string): Promise<AcknowledgmentStatus[]> {
    const types = Object.keys(ACKNOWLEDGMENTS) as AcknowledgmentType[];
    return Promise.all(types.map((type) => this.getAcknowledgmentStatus(userId, type)));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET MISSING ACKNOWLEDGMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get missing acknowledgments for a specific action/trigger
   */
  async getMissingAcknowledgments(
    userId: string,
    action: AcknowledgmentTrigger
  ): Promise<MissingAcknowledgment[]> {
    // Get acknowledgments required for this action
    const requiredAcks = Object.values(ACKNOWLEDGMENTS).filter(
      (ack) => ack.required_for === action
    );

    if (requiredAcks.length === 0) return [];

    // Get user's acknowledgments
    const userAcks = await prisma.complianceAcknowledgment.findMany({
      where: {
        userId,
        acknowledgmentType: {
          in: requiredAcks.map((a) => a.type) as unknown as PrismaAcknowledgmentType[],
        },
      },
    });

    // Create map of type -> versions acknowledged
    const acknowledgedMap = new Map<string, string[]>();
    for (const ack of userAcks) {
      const existing = acknowledgedMap.get(ack.acknowledgmentType) || [];
      existing.push(ack.version);
      acknowledgedMap.set(ack.acknowledgmentType, existing);
    }

    // Find missing or outdated
    const missing: MissingAcknowledgment[] = [];
    for (const required of requiredAcks) {
      const versions = acknowledgedMap.get(required.type) || [];
      if (!versions.includes(required.version)) {
        missing.push({
          type: required.type,
          title: required.title,
          version: required.version,
          isBlocking: required.isBlocking,
        });
      }
    }

    return missing;
  }

  /**
   * Get missing acknowledgments for Tier 2 completion
   */
  async getMissingForTier2(userId: string): Promise<MissingAcknowledgment[]> {
    const requiredAcks = getTier2RequiredAcknowledgments();

    const userAcks = await prisma.complianceAcknowledgment.findMany({
      where: {
        userId,
        acknowledgmentType: {
          in: requiredAcks.map((a) => a.type) as unknown as PrismaAcknowledgmentType[],
        },
      },
    });

    const acknowledgedMap = new Map<string, string[]>();
    for (const ack of userAcks) {
      const existing = acknowledgedMap.get(ack.acknowledgmentType) || [];
      existing.push(ack.version);
      acknowledgedMap.set(ack.acknowledgmentType, existing);
    }

    const missing: MissingAcknowledgment[] = [];
    for (const required of requiredAcks) {
      const versions = acknowledgedMap.get(required.type) || [];
      if (!versions.includes(required.version)) {
        missing.push({
          type: required.type,
          title: required.title,
          version: required.version,
          isBlocking: required.isBlocking,
        });
      }
    }

    return missing;
  }

  /**
   * Get missing acknowledgments for first employee
   */
  async getMissingForFirstEmployee(userId: string): Promise<MissingAcknowledgment[]> {
    const requiredAcks = getFirstEmployeeAcknowledgments();

    const userAcks = await prisma.complianceAcknowledgment.findMany({
      where: {
        userId,
        acknowledgmentType: {
          in: requiredAcks.map((a) => a.type) as unknown as PrismaAcknowledgmentType[],
        },
      },
    });

    const acknowledgedMap = new Map<string, string[]>();
    for (const ack of userAcks) {
      const existing = acknowledgedMap.get(ack.acknowledgmentType) || [];
      existing.push(ack.version);
      acknowledgedMap.set(ack.acknowledgmentType, existing);
    }

    const missing: MissingAcknowledgment[] = [];
    for (const required of requiredAcks) {
      const versions = acknowledgedMap.get(required.type) || [];
      if (!versions.includes(required.version)) {
        missing.push({
          type: required.type,
          title: required.title,
          version: required.version,
          isBlocking: required.isBlocking,
        });
      }
    }

    return missing;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECORD ACKNOWLEDGMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record an acknowledgment
   */
  async recordAcknowledgment(input: AcknowledgmentInput): Promise<string> {
    const config = ACKNOWLEDGMENTS[input.acknowledgmentType];
    if (!config) {
      throw new Error(`Unknown acknowledgment type: ${input.acknowledgmentType}`);
    }

    const version = input.version || config.version;

    // Upsert the acknowledgment
    const acknowledgment = await prisma.complianceAcknowledgment.upsert({
      where: {
        userId_acknowledgmentType_version: {
          userId: input.userId,
          acknowledgmentType: input.acknowledgmentType as unknown as PrismaAcknowledgmentType,
          version,
        },
      },
      create: {
        userId: input.userId,
        organizationId: input.organizationId,
        acknowledgmentType: input.acknowledgmentType as unknown as PrismaAcknowledgmentType,
        version,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceInfo: input.deviceInfo as object || null,
        acknowledgedAt: new Date(),
      },
      update: {
        // Already exists, just return it
        acknowledgedAt: new Date(),
      },
    });

    return acknowledgment.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if user can complete Tier 2 verification
   * (has all required acknowledgments)
   */
  async canCompleteTier2(userId: string): Promise<{
    canComplete: boolean;
    missing: MissingAcknowledgment[];
  }> {
    const missing = await this.getMissingForTier2(userId);
    return {
      canComplete: missing.length === 0,
      missing,
    };
  }

  /**
   * Check if user can add first employee
   * (has required acknowledgment)
   */
  async canAddFirstEmployee(userId: string): Promise<{
    canAdd: boolean;
    missing: MissingAcknowledgment[];
  }> {
    const missing = await this.getMissingForFirstEmployee(userId);
    return {
      canAdd: missing.length === 0,
      missing,
    };
  }

  /**
   * Check if user has any blocking missing acknowledgments
   */
  async hasBlockingMissing(userId: string): Promise<boolean> {
    const statuses = await this.getAllAcknowledgmentStatuses(userId);

    return statuses.some((status) => {
      const config = ACKNOWLEDGMENTS[status.type];
      return config.isBlocking && !status.acknowledged;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all acknowledgments for a user
   */
  async getUserAcknowledgments(userId: string): Promise<
    Array<{
      id: string;
      type: AcknowledgmentType;
      title: string;
      version: string;
      acknowledgedAt: Date;
      ipAddress: string | null;
    }>
  > {
    const acknowledgments = await prisma.complianceAcknowledgment.findMany({
      where: { userId },
      orderBy: { acknowledgedAt: 'desc' },
    });

    type UserAckEntry = (typeof acknowledgments)[number];
    return acknowledgments.map((a: UserAckEntry) => ({
      id: a.id,
      type: a.acknowledgmentType as AcknowledgmentType,
      title: ACKNOWLEDGMENTS[a.acknowledgmentType as AcknowledgmentType]?.title || a.acknowledgmentType,
      version: a.version,
      acknowledgedAt: a.acknowledgedAt,
      ipAddress: a.ipAddress,
    }));
  }

  /**
   * Get all acknowledgments for an organization
   */
  async getOrganizationAcknowledgments(organizationId: string): Promise<
    Array<{
      id: string;
      userId: string;
      type: AcknowledgmentType;
      title: string;
      version: string;
      acknowledgedAt: Date;
    }>
  > {
    const acknowledgments = await prisma.complianceAcknowledgment.findMany({
      where: { organizationId },
      orderBy: { acknowledgedAt: 'desc' },
    });

    type OrgAckEntry = (typeof acknowledgments)[number];
    return acknowledgments.map((a: OrgAckEntry) => ({
      id: a.id,
      userId: a.userId,
      type: a.acknowledgmentType as AcknowledgmentType,
      title: ACKNOWLEDGMENTS[a.acknowledgmentType as AcknowledgmentType]?.title || a.acknowledgmentType,
      version: a.version,
      acknowledgedAt: a.acknowledgedAt,
    }));
  }
}

// Export singleton instance
export const acknowledgmentService = new AcknowledgmentServiceClass();
