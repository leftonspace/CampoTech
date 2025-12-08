/**
 * UserSession Model
 * =================
 */

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class UserSession extends Model {
  static table = 'user_session';

  @field('user_id') userId!: string;
  @field('organization_id') organizationId!: string;
  @field('name') name!: string;
  @field('phone') phone!: string;
  @field('role') role!: string;
  @field('mode') mode!: 'simple' | 'advanced';
  @field('last_sync') lastSync!: number | null;

  get isSimpleMode(): boolean {
    return this.mode === 'simple';
  }

  get isAdvancedMode(): boolean {
    return this.mode === 'advanced';
  }

  get isTechnician(): boolean {
    return this.role === 'technician';
  }

  get lastSyncDate(): Date | null {
    return this.lastSync ? new Date(this.lastSync) : null;
  }
}
