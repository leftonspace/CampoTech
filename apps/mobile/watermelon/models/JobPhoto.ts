/**
 * JobPhoto Model
 * ==============
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

export default class JobPhoto extends Model {
  static table = 'job_photos';

  static associations = {
    jobs: { type: 'belongs_to' as const, key: 'job_id' },
  };

  @field('job_id') jobId!: string;
  @field('server_id') serverId!: string | null;
  @field('local_uri') localUri!: string;
  @field('remote_url') remoteUrl!: string | null;
  @field('type') type!: 'before' | 'during' | 'after' | 'signature';
  @field('caption') caption!: string | null;
  @field('uploaded') uploaded!: boolean;

  @date('created_at') createdAt!: Date;

  @relation('jobs', 'job_id') job!: any;

  get displayUrl(): string {
    return this.remoteUrl || this.localUri;
  }

  get isPending(): boolean {
    return !this.uploaded;
  }
}
