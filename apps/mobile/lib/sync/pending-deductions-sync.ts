/**
 * Pending Deductions Sync
 * =======================
 * 
 * Phase 2.2.4.4: Sync pending stock deductions to server
 * 
 * Processes queued material usage records and syncs them to the cascade API.
 */

import { Q } from '@nozbe/watermelondb';
import { database } from '../../watermelon/database';
import { api } from '../api/client';
import type PendingStockDeduction from '../../watermelon/models/PendingStockDeduction';

const MAX_RETRIES = 5;

/**
 * Get count of pending deductions
 */
export async function getPendingDeductionCount(): Promise<number> {
    const collection = database.get<PendingStockDeduction>('pending_stock_deductions');
    return collection
        .query(Q.where('deduction_status', 'pending'))
        .fetchCount();
}

/**
 * Get count of failed deductions
 */
export async function getFailedDeductionCount(): Promise<number> {
    const collection = database.get<PendingStockDeduction>('pending_stock_deductions');
    return collection
        .query(Q.where('deduction_status', 'failed'))
        .fetchCount();
}

/**
 * Sync all pending deductions to the server
 */
export async function syncPendingDeductions(): Promise<{
    synced: number;
    failed: number;
    remaining: number;
}> {
    const collection = database.get<PendingStockDeduction>('pending_stock_deductions');

    // Get all pending deductions
    const pending = await collection
        .query(Q.where('deduction_status', 'pending'))
        .fetch();

    let synced = 0;
    let failed = 0;

    for (const deduction of pending) {
        try {
            // Mark as syncing
            await database.write(async () => {
                await deduction.update((d: any) => {
                    d.deductionStatus = 'syncing';
                });
            });

            // Call the cascade API
            const response = await api.inventory.useMaterials(
                deduction.jobId,
                deduction.parsedItems.map((item: { productId: string; quantity: number }) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                }))
            );

            if (response.success) {
                // Mark as synced
                await database.write(async () => {
                    await deduction.update((d: any) => {
                        d.deductionStatus = 'synced';
                        d.syncedAt = Date.now();
                        d.syncError = null;
                    });
                });
                synced++;
            } else {
                throw new Error(response.error?.message || 'Server error');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const newRetryCount = deduction.retryCount + 1;
            const shouldFail = newRetryCount >= MAX_RETRIES;

            await database.write(async () => {
                await deduction.update((d: any) => {
                    d.deductionStatus = shouldFail ? 'failed' : 'pending';
                    d.syncError = errorMessage;
                    d.retryCount = newRetryCount;
                });
            });

            if (shouldFail) {
                failed++;
            }

            console.error(`[PendingDeductions] Failed to sync deduction ${deduction.id}:`, errorMessage);
        }
    }

    // Get remaining count
    const remaining = await collection
        .query(Q.where('deduction_status', 'pending'))
        .fetchCount();

    return { synced, failed, remaining };
}

/**
 * Retry failed deductions
 */
export async function retryFailedDeductions(): Promise<number> {
    const collection = database.get<PendingStockDeduction>('pending_stock_deductions');

    // Get all failed deductions
    const failedDeductions = await collection
        .query(Q.where('deduction_status', 'failed'))
        .fetch();

    // Reset them to pending
    await database.write(async () => {
        for (const deduction of failedDeductions) {
            await deduction.update((d: any) => {
                d.deductionStatus = 'pending';
                d.retryCount = 0;
                d.syncError = null;
            });
        }
    });

    return failedDeductions.length;
}

/**
 * Clear old synced deductions (housekeeping)
 */
export async function clearOldSyncedDeductions(olderThanDays: number = 7): Promise<number> {
    const collection = database.get<PendingStockDeduction>('pending_stock_deductions');
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

    const oldDeductions = await collection
        .query(
            Q.and(
                Q.where('deduction_status', 'synced'),
                Q.where('synced_at', Q.lt(cutoffTime))
            )
        )
        .fetch();

    await database.write(async () => {
        for (const deduction of oldDeductions) {
            await deduction.destroyPermanently();
        }
    });

    return oldDeductions.length;
}
