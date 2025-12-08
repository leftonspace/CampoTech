/**
 * SyncQueue Model
 * ===============
 */

import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class SyncQueue extends Model {
  static table = 'sync_queue';

  @field('entity_type') entityType!: string;
  @field('entity_id') entityId!: string;
  @field('operation') operation!: 'create' | 'update' | 'delete';
  @field('payload') payload!: string;
  @field('priority') priority!: number;
  @field('retry_count') retryCount!: number;
  @field('last_error') lastError!: string | null;

  @date('created_at') createdAt!: Date;

  get parsedPayload(): Record<string, unknown> {
    try {
      return JSON.parse(this.payload);
    } catch {
      return {};
    }
  }

  get isHighPriority(): boolean {
    return this.priority >= 10;
  }

  get hasExceededRetries(): boolean {
    return this.retryCount >= 5;
  }
}
