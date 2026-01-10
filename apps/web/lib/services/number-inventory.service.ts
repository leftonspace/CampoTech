/**
 * Phase 6.1: WhatsApp Number Inventory Management Service
 * 
 * Manages pre-purchased WhatsApp numbers for instant provisioning to clients.
 * 
 * Key features:
 * - Bulk number provisioning from BSP
 * - Instant assignment to organizations
 * - Auto-release of inactive numbers (30+ days)
 * - Cooldown period after release before reassignment
 * - Cost tracking per number
 * - Activity logging for audit trail
 */

import { prisma } from '@/lib/prisma';
import { addDays, subDays } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Local type definitions matching Prisma schema enums
// These will be used until `prisma generate` is run
type NumberInventoryStatus = 'available' | 'reserved' | 'assigned' | 'suspended' | 'released';
type NumberActivityType = 'provisioned' | 'reserved' | 'assigned' | 'message_sent' | 'message_received' | 'suspended' | 'unsuspended' | 'released' | 'recycled' | 'billed';

const INACTIVITY_DAYS_FOR_AUTO_RELEASE = 30;
const COOLDOWN_DAYS_AFTER_RELEASE = 7;
const RESERVATION_TIMEOUT_HOURS = 24;
const DEFAULT_MONTHLY_COST_USD = 5.0;

export type BSPProvider = 'twilio' | 'dialog360' | 'meta_direct';

export interface ProvisionNumberParams {
    phoneNumber: string;
    phoneNumberFormatted?: string;
    countryCode?: string;
    bspNumberId?: string;
    bspProvider?: BSPProvider;
    wabaId?: string;
    monthlyRentalCostUsd?: number;
    notes?: string;
}

export interface BulkProvisionResult {
    total: number;
    successful: number;
    failed: number;
    numbers: Array<{
        phoneNumber: string;
        success: boolean;
        error?: string;
        numberId?: string;
    }>;
}

export interface AssignmentResult {
    success: boolean;
    number?: {
        id: string;
        phoneNumber: string;
        phoneNumberFormatted: string | null;
    };
    error?: string;
}

export interface InventoryStats {
    total: number;
    available: number;
    reserved: number;
    assigned: number;
    suspended: number;
    released: number;
    totalMonthlyCostUsd: number;
    avgCostPerNumber: number;
    utilizationRate: number;
}

export interface NumberFilters {
    status?: NumberInventoryStatus;
    bspProvider?: BSPProvider;
    countryCode?: string;
    assignedToOrgId?: string;
    inactiveForDays?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NUMBER INVENTORY SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class NumberInventoryService {

    // ─────────────────────────────────────────────────────────────────────────────
    // PROVISIONING: Add numbers to inventory
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Provision a single number into the inventory
     */
    async provisionNumber(params: ProvisionNumberParams): Promise<string> {
        const { phoneNumber, ...rest } = params;

        // Normalize phone number (remove spaces, dashes)
        const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

        // Check if number already exists
        const existing = await prisma.whatsAppNumberInventory.findUnique({
            where: { phoneNumber: normalizedPhone },
        });

        if (existing) {
            throw new Error(`Number ${phoneNumber} already exists in inventory`);
        }

        // Create number record
        const number = await prisma.whatsAppNumberInventory.create({
            data: {
                phoneNumber: normalizedPhone,
                phoneNumberFormatted: rest.phoneNumberFormatted || this.formatPhoneNumber(normalizedPhone),
                countryCode: rest.countryCode || 'AR',
                bspNumberId: rest.bspNumberId,
                bspProvider: rest.bspProvider || 'twilio',
                wabaId: rest.wabaId,
                monthlyRentalCostUsd: rest.monthlyRentalCostUsd || DEFAULT_MONTHLY_COST_USD,
                notes: rest.notes,
                status: 'available',
                purchasedAt: new Date(),
            },
        });

        // Log activity
        await this.logActivity(number.id, 'provisioned', null, {
            bspProvider: number.bspProvider,
            monthlyRentalCostUsd: number.monthlyRentalCostUsd,
        });

        return number.id;
    }

    /**
     * Bulk provision multiple numbers
     */
    async bulkProvisionNumbers(numbers: ProvisionNumberParams[]): Promise<BulkProvisionResult> {
        const result: BulkProvisionResult = {
            total: numbers.length,
            successful: 0,
            failed: 0,
            numbers: [],
        };

        for (const params of numbers) {
            try {
                const numberId = await this.provisionNumber(params);
                result.successful++;
                result.numbers.push({
                    phoneNumber: params.phoneNumber,
                    success: true,
                    numberId,
                });
            } catch (error) {
                result.failed++;
                result.numbers.push({
                    phoneNumber: params.phoneNumber,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ASSIGNMENT: Assign numbers to organizations
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Reserve a number for an organization (during onboarding)
     * Number is held for up to 24 hours before auto-releasing
     */
    async reserveNumberForOrg(orgId: string, countryCode = 'AR'): Promise<AssignmentResult> {
        // Check if org already has an assigned number
        const existingAssignment = await prisma.whatsAppNumberInventory.findFirst({
            where: { assignedToOrgId: orgId },
        });

        if (existingAssignment) {
            return {
                success: true,
                number: {
                    id: existingAssignment.id,
                    phoneNumber: existingAssignment.phoneNumber,
                    phoneNumberFormatted: existingAssignment.phoneNumberFormatted,
                },
            };
        }

        // Find an available number
        const availableNumber = await prisma.whatsAppNumberInventory.findFirst({
            where: {
                status: 'available',
                countryCode,
                OR: [
                    { cooldownUntil: null },
                    { cooldownUntil: { lt: new Date() } },
                ],
            },
            orderBy: { createdAt: 'asc' }, // FIFO - oldest numbers first
        });

        if (!availableNumber) {
            return {
                success: false,
                error: `No available numbers for country code ${countryCode}`,
            };
        }

        // Reserve the number
        const expiresAt = addDays(new Date(), 1); // 24 hour reservation

        const updated = await prisma.whatsAppNumberInventory.update({
            where: { id: availableNumber.id },
            data: {
                status: 'reserved',
                assignedToOrgId: orgId,
                reservedAt: new Date(),
                reservationExpiresAt: expiresAt,
            },
        });

        // Log activity
        await this.logActivity(updated.id, 'reserved', orgId, {
            reservationExpiresAt: expiresAt.toISOString(),
        });

        return {
            success: true,
            number: {
                id: updated.id,
                phoneNumber: updated.phoneNumber,
                phoneNumberFormatted: updated.phoneNumberFormatted,
            },
        };
    }

    /**
     * Confirm assignment after successful onboarding/payment
     */
    async confirmAssignment(orgId: string): Promise<AssignmentResult> {
        // Find reserved number for this org
        const reserved = await prisma.whatsAppNumberInventory.findFirst({
            where: {
                assignedToOrgId: orgId,
                status: { in: ['reserved', 'assigned'] },
            },
        });

        if (!reserved) {
            return {
                success: false,
                error: 'No reserved number found for this organization',
            };
        }

        // If already assigned, just return success
        if (reserved.status === 'assigned') {
            return {
                success: true,
                number: {
                    id: reserved.id,
                    phoneNumber: reserved.phoneNumber,
                    phoneNumberFormatted: reserved.phoneNumberFormatted,
                },
            };
        }

        // Confirm assignment
        const updated = await prisma.whatsAppNumberInventory.update({
            where: { id: reserved.id },
            data: {
                status: 'assigned',
                assignedAt: new Date(),
                lastActivityAt: new Date(),
                reservedAt: null,
                reservationExpiresAt: null,
                releasedAt: null,
                releaseReason: null,
            },
        });

        // Log activity
        await this.logActivity(updated.id, 'assigned', orgId, {});

        return {
            success: true,
            number: {
                id: updated.id,
                phoneNumber: updated.phoneNumber,
                phoneNumberFormatted: updated.phoneNumberFormatted,
            },
        };
    }

    /**
     * Instantly assign a number (combines reserve + confirm)
     */
    async instantAssign(orgId: string, countryCode = 'AR'): Promise<AssignmentResult> {
        const reservation = await this.reserveNumberForOrg(orgId, countryCode);
        if (!reservation.success) {
            return reservation;
        }
        return this.confirmAssignment(orgId);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RELEASE: Release numbers from organizations
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Release a number from an organization
     */
    async releaseNumber(
        numberId: string,
        reason: 'inactivity' | 'cancellation' | 'suspension' | 'manual'
    ): Promise<void> {
        const number = await prisma.whatsAppNumberInventory.findUnique({
            where: { id: numberId },
        });

        if (!number) {
            throw new Error('Number not found');
        }

        if (number.status !== 'assigned') {
            throw new Error('Number is not currently assigned');
        }

        const cooldownUntil = addDays(new Date(), COOLDOWN_DAYS_AFTER_RELEASE);

        await prisma.whatsAppNumberInventory.update({
            where: { id: numberId },
            data: {
                status: 'released',
                releasedAt: new Date(),
                releaseReason: reason,
                previousOrgId: number.assignedToOrgId,
                assignedToOrgId: null,
                assignedAt: null,
                cooldownUntil,
            },
        });

        // Log activity
        await this.logActivity(numberId, 'released', number.assignedToOrgId, {
            reason,
            cooldownUntil: cooldownUntil.toISOString(),
        });
    }

    /**
     * Release a number by organization ID
     */
    async releaseByOrgId(
        orgId: string,
        reason: 'inactivity' | 'cancellation' | 'suspension' | 'manual'
    ): Promise<boolean> {
        const number = await prisma.whatsAppNumberInventory.findFirst({
            where: { assignedToOrgId: orgId, status: 'assigned' },
        });

        if (!number) {
            return false;
        }

        await this.releaseNumber(number.id, reason);
        return true;
    }

    /**
     * Recycle released numbers back to available pool
     */
    async recycleReleasedNumbers(): Promise<number> {
        const eligible = await prisma.whatsAppNumberInventory.findMany({
            where: {
                status: 'released',
                cooldownUntil: { lt: new Date() },
            },
        });

        let recycled = 0;

        for (const number of eligible) {
            await prisma.whatsAppNumberInventory.update({
                where: { id: number.id },
                data: {
                    status: 'available',
                    recycleCount: { increment: 1 },
                    cooldownUntil: null,
                    messageCountMonth: 0, // Reset monthly count
                },
            });

            await this.logActivity(number.id, 'recycled', null, {
                previousOrgId: number.previousOrgId,
            });

            recycled++;
        }

        return recycled;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AUTO-RELEASE: Identify and release inactive numbers
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Find numbers inactive for more than N days
     */
    async findInactiveNumbers(inactiveDays = INACTIVITY_DAYS_FOR_AUTO_RELEASE): Promise<string[]> {
        const cutoffDate = subDays(new Date(), inactiveDays);

        const inactive = await prisma.whatsAppNumberInventory.findMany({
            where: {
                status: 'assigned',
                OR: [
                    { lastActivityAt: { lt: cutoffDate } },
                    { lastActivityAt: null, assignedAt: { lt: cutoffDate } },
                ],
            },
            select: { id: true },
        });

        return inactive.map((n: { id: string }) => n.id);
    }

    /**
     * Auto-release all inactive numbers
     * Returns count of released numbers
     */
    async autoReleaseInactiveNumbers(): Promise<number> {
        const inactiveIds = await this.findInactiveNumbers();

        let released = 0;
        for (const id of inactiveIds) {
            try {
                await this.releaseNumber(id, 'inactivity');
                released++;
            } catch (error) {
                console.error(`Failed to auto-release number ${id}:`, error);
            }
        }

        return released;
    }

    /**
     * Release expired reservations
     */
    async releaseExpiredReservations(): Promise<number> {
        const expired = await prisma.whatsAppNumberInventory.findMany({
            where: {
                status: 'reserved',
                reservationExpiresAt: { lt: new Date() },
            },
        });

        for (const number of expired) {
            await prisma.whatsAppNumberInventory.update({
                where: { id: number.id },
                data: {
                    status: 'available',
                    assignedToOrgId: null,
                    reservedAt: null,
                    reservationExpiresAt: null,
                },
            });

            await this.logActivity(number.id, 'released', number.assignedToOrgId, {
                reason: 'reservation_expired',
            });
        }

        return expired.length;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ACTIVITY TRACKING: Record message activity
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Record message activity on a number
     */
    async recordMessageActivity(
        numberId: string,
        type: 'sent' | 'received'
    ): Promise<void> {
        await prisma.whatsAppNumberInventory.update({
            where: { id: numberId },
            data: {
                lastActivityAt: new Date(),
                lastMessageAt: new Date(),
                messageCountTotal: { increment: 1 },
                messageCountMonth: { increment: 1 },
            },
        });

        // Don't log every message (too noisy), just update counts
    }

    /**
     * Reset monthly message counts (call on 1st of each month)
     */
    async resetMonthlyMessageCounts(): Promise<void> {
        await prisma.whatsAppNumberInventory.updateMany({
            data: { messageCountMonth: 0 },
        });
    }

    /**
     * Process monthly billing for assigned numbers
     */
    async processMonthlyBilling(): Promise<{ numbers: number; totalCostUsd: number }> {
        const assignedNumbers = await prisma.whatsAppNumberInventory.findMany({
            where: { status: 'assigned' },
        });

        let totalCostUsd = 0;

        for (const number of assignedNumbers) {
            await prisma.whatsAppNumberInventory.update({
                where: { id: number.id },
                data: {
                    lastBilledAt: new Date(),
                    totalCostUsd: { increment: number.monthlyRentalCostUsd },
                },
            });

            await this.logActivity(number.id, 'billed', number.assignedToOrgId, {
                amountUsd: number.monthlyRentalCostUsd,
            });

            totalCostUsd += number.monthlyRentalCostUsd;
        }

        return {
            numbers: assignedNumbers.length,
            totalCostUsd,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // QUERIES: Get inventory data
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Get inventory statistics
     */
    async getStats(): Promise<InventoryStats> {
        const counts = await prisma.whatsAppNumberInventory.groupBy({
            by: ['status'],
            _count: { _all: true },
        });

        const statusCounts: Record<string, number> = {};
        for (const c of counts) {
            statusCounts[c.status] = (c._count as { _all: number })._all;
        }

        const total = Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0);
        const assigned = statusCounts['assigned'] || 0;

        // Get cost info
        const costInfo = await prisma.whatsAppNumberInventory.aggregate({
            where: { status: 'assigned' },
            _sum: { monthlyRentalCostUsd: true },
            _avg: { monthlyRentalCostUsd: true },
        });

        return {
            total,
            available: statusCounts['available'] || 0,
            reserved: statusCounts['reserved'] || 0,
            assigned,
            suspended: statusCounts['suspended'] || 0,
            released: statusCounts['released'] || 0,
            totalMonthlyCostUsd: costInfo._sum.monthlyRentalCostUsd || 0,
            avgCostPerNumber: costInfo._avg.monthlyRentalCostUsd || DEFAULT_MONTHLY_COST_USD,
            utilizationRate: total > 0 ? (assigned / total) * 100 : 0,
        };
    }

    /**
     * Get all numbers with filters
     */
    async getNumbers(filters: NumberFilters = {}, page = 1, limit = 50) {
        const where: Record<string, unknown> = {};

        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.bspProvider) {
            where.bspProvider = filters.bspProvider;
        }
        if (filters.countryCode) {
            where.countryCode = filters.countryCode;
        }
        if (filters.assignedToOrgId) {
            where.assignedToOrgId = filters.assignedToOrgId;
        }
        if (filters.inactiveForDays) {
            const cutoff = subDays(new Date(), filters.inactiveForDays);
            where.lastActivityAt = { lt: cutoff };
            where.status = 'assigned';
        }

        const [numbers, total] = await Promise.all([
            prisma.whatsAppNumberInventory.findMany({
                where,
                include: {
                    assignedOrg: {
                        select: { id: true, name: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.whatsAppNumberInventory.count({ where }),
        ]);

        return {
            numbers,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get number by organization ID
     */
    async getNumberByOrgId(orgId: string) {
        return prisma.whatsAppNumberInventory.findFirst({
            where: { assignedToOrgId: orgId },
        });
    }

    /**
     * Get number by ID
     */
    async getNumberById(numberId: string) {
        return prisma.whatsAppNumberInventory.findUnique({
            where: { id: numberId },
            include: {
                assignedOrg: { select: { id: true, name: true } },
                activityLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });
    }

    /**
     * Get activity logs for a number
     */
    async getActivityLogs(numberId: string, limit = 100) {
        return prisma.numberActivityLog.findMany({
            where: { numberId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ADMIN: Suspend and manage numbers
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Suspend a number
     */
    async suspendNumber(numberId: string, reason?: string): Promise<void> {
        const number = await prisma.whatsAppNumberInventory.findUnique({
            where: { id: numberId },
        });

        if (!number) {
            throw new Error('Number not found');
        }

        await prisma.whatsAppNumberInventory.update({
            where: { id: numberId },
            data: { status: 'suspended' },
        });

        await this.logActivity(numberId, 'suspended', number.assignedToOrgId, { reason });
    }

    /**
     * Unsuspend a number
     */
    async unsuspendNumber(numberId: string): Promise<void> {
        const number = await prisma.whatsAppNumberInventory.findUnique({
            where: { id: numberId },
        });

        if (!number) {
            throw new Error('Number not found');
        }

        if (number.status !== 'suspended') {
            throw new Error('Number is not suspended');
        }

        // Return to previous state
        const newStatus = number.assignedToOrgId ? 'assigned' : 'available';

        await prisma.whatsAppNumberInventory.update({
            where: { id: numberId },
            data: { status: newStatus },
        });

        await this.logActivity(numberId, 'unsuspended', number.assignedToOrgId, {});
    }

    /**
     * Update number metadata
     */
    async updateNumber(
        numberId: string,
        data: {
            notes?: string;
            monthlyRentalCostUsd?: number;
            bspNumberId?: string;
            wabaId?: string;
        }
    ): Promise<void> {
        await prisma.whatsAppNumberInventory.update({
            where: { id: numberId },
            data,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────────

    private async logActivity(
        numberId: string,
        activityType: NumberActivityType,
        organizationId: string | null,
        details: Record<string, unknown>
    ): Promise<void> {
        await prisma.numberActivityLog.create({
            data: {
                numberId,
                activityType,
                organizationId,
                details,
            },
        });
    }

    private normalizePhoneNumber(phone: string): string {
        return phone.replace(/[\s\-\(\)\.]/g, '');
    }

    private formatPhoneNumber(phone: string): string {
        // Basic Argentina formatting
        if (phone.startsWith('+54')) {
            const areaCode = phone.slice(3, 6);
            const number = phone.slice(6);
            return `+54 ${areaCode} ${number.slice(0, 3)}-${number.slice(3)}`;
        }
        return phone;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const numberInventoryService = new NumberInventoryService();
