/**
 * Product Model
 * =============
 *
 * Local model for products/materials available to technicians.
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

export default class Product extends Model {
  static table = 'products';

  @field('server_id') serverId!: string;
  @field('organization_id') organizationId!: string;
  @field('sku') sku!: string;
  @field('barcode') barcode!: string | null;
  @field('name') name!: string;
  @field('description') description!: string | null;
  @field('category_name') categoryName!: string | null;
  @field('unit_of_measure') unitOfMeasure!: string;
  @field('sale_price') salePrice!: number;
  @field('cost_price') costPrice!: number;
  @field('is_active') isActive!: boolean;
  @field('track_inventory') trackInventory!: boolean;
  @field('image_url') imageUrl!: string | null;
  @readonly @date('synced_at') syncedAt!: Date | null;
  @readonly @date('updated_at') updatedAt!: Date;
}
