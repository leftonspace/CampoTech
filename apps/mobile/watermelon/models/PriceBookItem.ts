/**
 * PriceBookItem Model
 * ===================
 */

import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class PriceBookItem extends Model {
  static table = 'price_book_items';

  @field('server_id') serverId!: string;
  @field('organization_id') organizationId!: string;
  @field('category') category!: string;
  @field('name') name!: string;
  @field('description') description!: string | null;
  @field('unit_price') unitPrice!: number;
  @field('unit') unit!: string;
  @field('tax_rate') taxRate!: number;
  @field('afip_product_code') afipProductCode!: string | null;
  @field('is_active') isActive!: boolean;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('synced_at') syncedAt!: number | null;

  get formattedPrice(): string {
    return `$${this.unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  }

  get priceWithTax(): number {
    return this.unitPrice * (1 + this.taxRate);
  }
}
