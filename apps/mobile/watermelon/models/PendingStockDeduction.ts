/**
 * PendingStockDeduction Model
 * ===========================
 * 
 * Phase 2.2.4.4: Offline Queue for Scanned Items
 * 
 * Stores material usage records that are pending sync to the server.
 * These are created when a technician records material usage (scan + deduct)
 * and are synced to the cascade API when online.
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class PendingStockDeduction extends Model {
    static table = 'pending_stock_deductions';

    // Job reference
    @field('job_id') jobId!: string;
    @field('job_number') jobNumber!: string;

    // Items to deduct (JSON array of { productId, productName, quantity })
    @field('items') items!: string;

    // Optional notes
    @field('notes') notes!: string | null;

    // Sync status (renamed from syncStatus to avoid conflict with WatermelonDB base Model)
    @field('deduction_status') deductionStatus!: 'pending' | 'syncing' | 'synced' | 'failed';
    @field('sync_error') syncError!: string | null;
    @field('retry_count') retryCount!: number;

    // Timestamps
    @readonly @date('created_at') createdAt!: Date;
    @date('synced_at') syncedAt!: Date | null;

    // Getters
    get parsedItems(): Array<{ productId: string; productName: string; quantity: number }> {
        try {
            return JSON.parse(this.items);
        } catch {
            return [];
        }
    }

    get itemCount(): number {
        return this.parsedItems.length;
    }

    get totalQuantity(): number {
        return this.parsedItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    get isPending(): boolean {
        return this.deductionStatus === 'pending';
    }

    get isSyncing(): boolean {
        return this.deductionStatus === 'syncing';
    }

    get hasFailed(): boolean {
        return this.deductionStatus === 'failed';
    }
}
