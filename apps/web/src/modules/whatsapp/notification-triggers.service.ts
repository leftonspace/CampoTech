/**
 * WhatsApp Notification Triggers Service
 *
 * Stub implementation - triggers WhatsApp notifications on various events
 * TODO: Implement actual WhatsApp integration
 */

type JobStatus = 'PENDING' | 'SCHEDULED' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface NotificationOptions {
  technicianId?: string;
  customerId?: string;
}

/**
 * Triggered when a job status changes
 * Sends appropriate WhatsApp notification to customer/technician
 */
export async function onJobStatusChange(
  jobId: string,
  oldStatus: JobStatus,
  newStatus: JobStatus,
  options: NotificationOptions = {}
): Promise<void> {
  // TODO: Implement actual WhatsApp notifications
  console.log(`[WhatsApp] Job ${jobId} status changed: ${oldStatus} -> ${newStatus}`, options);

  // Future implementation:
  // - EN_ROUTE: Notify customer that technician is on the way
  // - COMPLETED: Send completion confirmation and rating link
  // - etc.
}

/**
 * Triggered when a new job is assigned
 */
export async function onJobAssigned(
  jobId: string,
  technicianId: string
): Promise<void> {
  console.log(`[WhatsApp] Job ${jobId} assigned to technician ${technicianId}`);
}

/**
 * Triggered when a job is created
 */
export async function onJobCreated(jobId: string): Promise<void> {
  console.log(`[WhatsApp] Job ${jobId} created`);
}
