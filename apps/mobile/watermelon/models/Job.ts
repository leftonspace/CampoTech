/**
 * Job Model
 * =========
 *
 * WatermelonDB model for offline job management.
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children, relation } from '@nozbe/watermelondb/decorators';

export default class Job extends Model {
  static table = 'jobs';

  static associations = {
    customers: { type: 'belongs_to' as const, key: 'customer_id' },
    job_photos: { type: 'has_many' as const, foreignKey: 'job_id' },
  };

  @field('server_id') serverId!: string;
  @field('customer_id') customerId!: string;
  @field('organization_id') organizationId!: string;
  @field('assigned_to_id') assignedToId!: string | null;
  @field('service_type') serviceType!: string;
  @field('status') status!: string;
  @field('priority') priority!: string;

  @field('scheduled_start') scheduledStart!: number | null;
  @field('scheduled_end') scheduledEnd!: number | null;
  @field('actual_start') actualStart!: number | null;
  @field('actual_end') actualEnd!: number | null;

  @field('address') address!: string;
  @field('latitude') latitude!: number | null;
  @field('longitude') longitude!: number | null;

  @field('notes') notes!: string | null;
  @field('internal_notes') internalNotes!: string | null;
  @field('completion_notes') completionNotes!: string | null;
  @field('materials_used') materialsUsed!: string | null;
  @field('signature_url') signatureUrl!: string | null;

  @field('subtotal') subtotal!: number | null;
  @field('tax') tax!: number | null;
  @field('total') total!: number | null;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('synced_at') syncedAt!: number | null;
  @field('is_dirty') isDirty!: boolean;

  @relation('customers', 'customer_id') customer!: any;
  @children('job_photos') photos!: any;

  // Computed properties
  get scheduledStartDate(): Date | null {
    return this.scheduledStart ? new Date(this.scheduledStart) : null;
  }

  get scheduledEndDate(): Date | null {
    return this.scheduledEnd ? new Date(this.scheduledEnd) : null;
  }

  get parsedMaterialsUsed(): Array<{ name: string; quantity: number; price: number }> {
    if (!this.materialsUsed) return [];
    try {
      return JSON.parse(this.materialsUsed);
    } catch {
      return [];
    }
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isScheduled(): boolean {
    return this.status === 'scheduled';
  }

  get isInProgress(): boolean {
    return this.status === 'en_camino' || this.status === 'working';
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isCancelled(): boolean {
    return this.status === 'cancelled';
  }

  get canStart(): boolean {
    return this.status === 'scheduled';
  }

  get canComplete(): boolean {
    return this.status === 'working';
  }

  // Status transition methods
  async startJob() {
    await this.update((job) => {
      job.status = 'en_camino';
      job.actualStart = Date.now();
      job.isDirty = true;
    });
  }

  async arriveAtJob() {
    await this.update((job) => {
      job.status = 'working';
      job.isDirty = true;
    });
  }

  async completeJob(
    notes: string,
    materials: Array<{ name: string; quantity: number; price: number }>,
    signatureUrl?: string
  ) {
    const subtotal = materials.reduce((sum, m) => sum + m.quantity * m.price, 0);
    const tax = subtotal * 0.21; // 21% IVA
    const total = subtotal + tax;

    await this.update((job) => {
      job.status = 'completed';
      job.actualEnd = Date.now();
      job.completionNotes = notes;
      job.materialsUsed = JSON.stringify(materials);
      job.signatureUrl = signatureUrl || null;
      job.subtotal = subtotal;
      job.tax = tax;
      job.total = total;
      job.isDirty = true;
    });
  }

  async cancelJob(reason: string) {
    await this.update((job) => {
      job.status = 'cancelled';
      job.completionNotes = reason;
      job.isDirty = true;
    });
  }
}
