/**
 * SyncConflict Model
 * ==================
 */

import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class SyncConflict extends Model {
  static table = 'sync_conflicts';

  @field('entity_type') entityType!: string;
  @field('entity_id') entityId!: string;
  @field('local_data') localData!: string;
  @field('server_data') serverData!: string;
  @field('conflict_type') conflictType!: string;
  @field('resolved') resolved!: boolean;
  @field('resolution') resolution!: 'local' | 'server' | 'merged' | null;

  @date('created_at') createdAt!: Date;
  @field('resolved_at') resolvedAt!: number | null;

  get parsedLocalData(): Record<string, unknown> {
    try {
      return JSON.parse(this.localData);
    } catch {
      return {};
    }
  }

  get parsedServerData(): Record<string, unknown> {
    try {
      return JSON.parse(this.serverData);
    } catch {
      return {};
    }
  }
}
