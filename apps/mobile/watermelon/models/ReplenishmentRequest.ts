/**
 * ReplenishmentRequest Model
 * ==========================
 *
 * Local model for technician replenishment requests.
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

interface RequestItem {
  productId: string;
  productName: string;
  requestedQty: number;
  currentQty: number;
}

export default class ReplenishmentRequest extends Model {
  static table = 'replenishment_requests';

  @field('server_id') serverId!: string | null;
  @field('vehicle_id') vehicleId!: string;
  @field('status') status!: string; // 'pending', 'approved', 'processing', 'completed', 'cancelled'
  @field('priority') priority!: string; // 'low', 'medium', 'high', 'urgent'
  @json('items', (json: any) => json || []) items!: RequestItem[];
  @field('notes') notes!: string | null;
  @field('processed_by_id') processedById!: string | null;
  @field('processed_by_name') processedByName!: string | null;
  @field('is_synced') isSynced!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('processed_at') processedAt!: Date | null;
}
