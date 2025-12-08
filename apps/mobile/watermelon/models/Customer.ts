/**
 * Customer Model
 * ==============
 *
 * WatermelonDB model for customer data.
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';

export default class Customer extends Model {
  static table = 'customers';

  static associations = {
    jobs: { type: 'has_many' as const, foreignKey: 'customer_id' },
  };

  @field('server_id') serverId!: string;
  @field('organization_id') organizationId!: string;
  @field('name') name!: string;
  @field('phone') phone!: string;
  @field('email') email!: string | null;
  @field('dni') dni!: string | null;
  @field('cuit') cuit!: string | null;
  @field('iva_condition') ivaCondition!: string | null;
  @field('address') address!: string | null;
  @field('city') city!: string | null;
  @field('province') province!: string | null;
  @field('notes') notes!: string | null;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('synced_at') syncedAt!: number | null;

  @children('jobs') jobs!: any;

  // Computed properties
  get displayName(): string {
    return this.name || this.phone;
  }

  get fullAddress(): string {
    const parts = [this.address, this.city, this.province].filter(Boolean);
    return parts.join(', ');
  }

  get formattedPhone(): string {
    const digits = this.phone.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('549')) {
      // Argentine mobile: +54 9 11 1234-5678
      return `+54 9 ${digits.slice(3, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
    }
    return this.phone;
  }

  get initials(): string {
    const words = this.name.split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return this.name.slice(0, 2).toUpperCase();
  }

  get ivaConditionLabel(): string {
    const labels: Record<string, string> = {
      responsable_inscripto: 'Responsable Inscripto',
      monotributista: 'Monotributista',
      exento: 'Exento',
      consumidor_final: 'Consumidor Final',
    };
    return labels[this.ivaCondition || ''] || 'Sin especificar';
  }
}
