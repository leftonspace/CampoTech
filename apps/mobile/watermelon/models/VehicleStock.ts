/**
 * VehicleStock Model
 * ==================
 *
 * Local model for technician vehicle inventory.
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children, relation } from '@nozbe/watermelondb/decorators';

export default class VehicleStock extends Model {
  static table = 'vehicle_stock';

  static associations = {
    products: { type: 'belongs_to' as const, key: 'product_id' },
  };

  @field('server_id') serverId!: string;
  @field('vehicle_id') vehicleId!: string;
  @field('product_id') productId!: string;
  @field('product_name') productName!: string;
  @field('product_sku') productSku!: string;
  @field('quantity') quantity!: number;
  @field('min_quantity') minQuantity!: number;
  @field('max_quantity') maxQuantity!: number;
  @field('unit_cost') unitCost!: number;
  @field('needs_replenishment') needsReplenishment!: boolean;
  @readonly @date('synced_at') syncedAt!: Date | null;
  @readonly @date('updated_at') updatedAt!: Date;
}
