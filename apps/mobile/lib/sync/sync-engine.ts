/**
 * Sync Engine
 * ===========
 *
 * Bidirectional sync between local WatermelonDB and server.
 * Handles conflict resolution and offline queuing.
 */

import NetInfo from '@react-native-community/netinfo';
import {
  database,
  jobsCollection,
  customersCollection,
  priceBookCollection,
  syncQueueCollection,
  syncConflictsCollection,
  userSessionCollection,
} from '../../watermelon/database';
import { api } from '../api/client';
import { Job, Customer, SyncQueue, SyncConflict } from '../../watermelon/models';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_QUEUE_SIZE = 50;
const SYNC_DEBOUNCE_MS = 5000;
const MAX_RETRIES = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

let isSyncing = false;
let lastSyncTime: number | null = null;
let syncTimeout: NodeJS.Timeout | null = null;
let listeners: Array<(status: SyncStatus) => void> = [];

export interface SyncStatus {
  isSyncing: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  conflicts: number;
  isOnline: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

let isOnline = true;

NetInfo.addEventListener((state) => {
  const wasOffline = !isOnline;
  isOnline = state.isConnected ?? false;

  // Trigger sync when coming back online
  if (wasOffline && isOnline) {
    scheduleSyncDebounced();
  }

  notifyListeners();
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full bidirectional sync
 */
export async function performSync(): Promise<{
  success: boolean;
  pulled: number;
  pushed: number;
  conflicts: number;
  error?: string;
}> {
  if (isSyncing) {
    return { success: false, pulled: 0, pushed: 0, conflicts: 0, error: 'Sync in progress' };
  }

  if (!isOnline) {
    return { success: false, pulled: 0, pushed: 0, conflicts: 0, error: 'Offline' };
  }

  isSyncing = true;
  notifyListeners();

  try {
    // 1. Push local changes first
    const pushResult = await pushLocalChanges();

    // 2. Pull server changes
    const pullResult = await pullServerChanges();

    // 3. Update last sync time
    lastSyncTime = Date.now();
    await updateSessionLastSync(lastSyncTime);

    return {
      success: true,
      pulled: pullResult.count,
      pushed: pushResult.count,
      conflicts: pushResult.conflicts,
    };
  } catch (error) {
    return {
      success: false,
      pulled: 0,
      pushed: 0,
      conflicts: 0,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  } finally {
    isSyncing = false;
    notifyListeners();
  }
}

/**
 * Push local changes to server
 */
async function pushLocalChanges(): Promise<{ count: number; conflicts: number }> {
  // Get pending sync operations
  const pendingOps = await syncQueueCollection
    .query()
    .fetch() as SyncQueue[];

  if (pendingOps.length === 0) {
    return { count: 0, conflicts: 0 };
  }

  // Build operations array
  const operations = pendingOps.map((op) => ({
    type: op.operation,
    entity: op.entityType,
    data: op.parsedPayload,
  }));

  // Send to server
  const response = await api.sync.push(operations);

  if (!response.success) {
    throw new Error(response.error?.message || 'Push failed');
  }

  // Handle conflicts
  let conflictCount = 0;
  if (response.data?.conflicts && response.data.conflicts.length > 0) {
    for (const conflict of response.data.conflicts) {
      await createConflict(conflict);
      conflictCount++;
    }
  }

  // Clear processed operations
  await database.write(async () => {
    for (const op of pendingOps) {
      await op.destroyPermanently();
    }
  });

  return { count: response.data?.processed || 0, conflicts: conflictCount };
}

/**
 * Pull changes from server
 */
async function pullServerChanges(): Promise<{ count: number }> {
  const response = await api.sync.pull(lastSyncTime || undefined);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Pull failed');
  }

  const { jobs, customers, priceBook } = response.data;
  let count = 0;

  await database.write(async () => {
    // Sync jobs
    for (const serverJob of jobs as any[]) {
      await syncJob(serverJob);
      count++;
    }

    // Sync customers
    for (const serverCustomer of customers as any[]) {
      await syncCustomer(serverCustomer);
      count++;
    }

    // Sync price book
    for (const serverItem of priceBook as any[]) {
      await syncPriceBookItem(serverItem);
      count++;
    }
  });

  return { count };
}

/**
 * Sync a single job from server
 */
async function syncJob(serverJob: any): Promise<void> {
  const existing = await jobsCollection
    .query()
    .where('server_id', serverJob.id)
    .fetchFirst() as Job | null;

  if (existing) {
    // Check for conflicts
    if (existing.isDirty) {
      // Local has changes - create conflict
      await createConflict({
        entityType: 'job',
        entityId: serverJob.id,
        serverData: serverJob,
      });
      return;
    }

    // Update local record
    await existing.update((job) => {
      Object.assign(job, mapServerJobToLocal(serverJob));
      job.syncedAt = Date.now();
    });
  } else {
    // Create new local record
    await jobsCollection.create((job) => {
      Object.assign(job, mapServerJobToLocal(serverJob));
      job.serverId = serverJob.id;
      job.syncedAt = Date.now();
      job.isDirty = false;
    });
  }
}

/**
 * Sync a single customer from server
 */
async function syncCustomer(serverCustomer: any): Promise<void> {
  const existing = await customersCollection
    .query()
    .where('server_id', serverCustomer.id)
    .fetchFirst() as Customer | null;

  if (existing) {
    await existing.update((customer) => {
      Object.assign(customer, mapServerCustomerToLocal(serverCustomer));
      customer.syncedAt = Date.now();
    });
  } else {
    await customersCollection.create((customer) => {
      Object.assign(customer, mapServerCustomerToLocal(serverCustomer));
      customer.serverId = serverCustomer.id;
      customer.syncedAt = Date.now();
    });
  }
}

/**
 * Sync a single price book item from server
 */
async function syncPriceBookItem(serverItem: any): Promise<void> {
  const existing = await priceBookCollection
    .query()
    .where('server_id', serverItem.id)
    .fetchFirst();

  if (existing) {
    await existing.update((item: any) => {
      item.name = serverItem.name;
      item.category = serverItem.category;
      item.description = serverItem.description;
      item.unitPrice = serverItem.unitPrice;
      item.unit = serverItem.unit;
      item.taxRate = serverItem.taxRate;
      item.isActive = serverItem.isActive;
      item.syncedAt = Date.now();
    });
  } else {
    await priceBookCollection.create((item: any) => {
      item.serverId = serverItem.id;
      item.organizationId = serverItem.organizationId;
      item.name = serverItem.name;
      item.category = serverItem.category;
      item.description = serverItem.description;
      item.unitPrice = serverItem.unitPrice;
      item.unit = serverItem.unit;
      item.taxRate = serverItem.taxRate;
      item.isActive = serverItem.isActive;
      item.syncedAt = Date.now();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add operation to sync queue
 */
export async function enqueueOperation(
  entityType: string,
  entityId: string,
  operation: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>,
  priority: number = 5
): Promise<void> {
  // Check queue size
  const queueSize = await syncQueueCollection.query().fetchCount();
  if (queueSize >= MAX_QUEUE_SIZE) {
    // Remove oldest low-priority items
    const oldestOps = await syncQueueCollection
      .query()
      .sortBy('priority', 'asc')
      .sortBy('created_at', 'asc')
      .limit(10)
      .fetch();

    await database.write(async () => {
      for (const op of oldestOps) {
        await op.destroyPermanently();
      }
    });
  }

  await database.write(async () => {
    await syncQueueCollection.create((op: any) => {
      op.entityType = entityType;
      op.entityId = entityId;
      op.operation = operation;
      op.payload = JSON.stringify(payload);
      op.priority = priority;
      op.retryCount = 0;
      op.createdAt = new Date();
    });
  });

  // Schedule sync
  scheduleSyncDebounced();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICT RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function createConflict(data: {
  entityType: string;
  entityId: string;
  serverData: unknown;
}): Promise<void> {
  // Get local data
  let localData: unknown = null;
  if (data.entityType === 'job') {
    const job = await jobsCollection
      .query()
      .where('server_id', data.entityId)
      .fetchFirst();
    localData = job?._raw;
  }

  await database.write(async () => {
    await syncConflictsCollection.create((conflict: any) => {
      conflict.entityType = data.entityType;
      conflict.entityId = data.entityId;
      conflict.localData = JSON.stringify(localData);
      conflict.serverData = JSON.stringify(data.serverData);
      conflict.conflictType = 'concurrent_edit';
      conflict.resolved = false;
      conflict.createdAt = new Date();
    });
  });
}

/**
 * Resolve a sync conflict
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'local' | 'server' | 'merged',
  mergedData?: Record<string, unknown>
): Promise<void> {
  const conflict = await syncConflictsCollection.find(conflictId) as SyncConflict;

  if (resolution === 'server') {
    // Apply server data
    if (conflict.entityType === 'job') {
      await syncJob(conflict.parsedServerData);
    }
  } else if (resolution === 'local') {
    // Queue local data for push
    await enqueueOperation(
      conflict.entityType,
      conflict.entityId,
      'update',
      conflict.parsedLocalData,
      10 // High priority
    );
  } else if (resolution === 'merged' && mergedData) {
    // Apply merged data locally and queue for push
    await enqueueOperation(
      conflict.entityType,
      conflict.entityId,
      'update',
      mergedData,
      10
    );
  }

  // Mark conflict as resolved
  await database.write(async () => {
    await conflict.update((c: any) => {
      c.resolved = true;
      c.resolution = resolution;
      c.resolvedAt = Date.now();
    });
  });
}

/**
 * Get unresolved conflicts
 */
export async function getUnresolvedConflicts(): Promise<SyncConflict[]> {
  return syncConflictsCollection
    .query()
    .where('resolved', false)
    .fetch() as Promise<SyncConflict[]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function mapServerJobToLocal(serverJob: any): Partial<Job> {
  return {
    customerId: serverJob.customerId,
    organizationId: serverJob.organizationId,
    assignedToId: serverJob.assignedToId,
    serviceType: serverJob.serviceType,
    status: serverJob.status,
    priority: serverJob.priority,
    scheduledStart: serverJob.scheduledStart ? new Date(serverJob.scheduledStart).getTime() : null,
    scheduledEnd: serverJob.scheduledEnd ? new Date(serverJob.scheduledEnd).getTime() : null,
    actualStart: serverJob.actualStart ? new Date(serverJob.actualStart).getTime() : null,
    actualEnd: serverJob.actualEnd ? new Date(serverJob.actualEnd).getTime() : null,
    address: serverJob.address,
    latitude: serverJob.latitude,
    longitude: serverJob.longitude,
    notes: serverJob.notes,
    internalNotes: serverJob.internalNotes,
    completionNotes: serverJob.completionNotes,
    materialsUsed: serverJob.materialsUsed ? JSON.stringify(serverJob.materialsUsed) : null,
    signatureUrl: serverJob.signatureUrl,
    subtotal: serverJob.subtotal,
    tax: serverJob.tax,
    total: serverJob.total,
  } as any;
}

function mapServerCustomerToLocal(serverCustomer: any): Partial<Customer> {
  return {
    organizationId: serverCustomer.organizationId,
    name: serverCustomer.name,
    phone: serverCustomer.phone,
    email: serverCustomer.email,
    dni: serverCustomer.dni,
    cuit: serverCustomer.cuit,
    ivaCondition: serverCustomer.ivaCondition,
    address: serverCustomer.address,
    city: serverCustomer.city,
    province: serverCustomer.province,
    notes: serverCustomer.notes,
  } as any;
}

async function updateSessionLastSync(timestamp: number): Promise<void> {
  const sessions = await userSessionCollection.query().fetch();
  if (sessions.length > 0) {
    await database.write(async () => {
      await sessions[0].update((s: any) => {
        s.lastSync = timestamp;
      });
    });
  }
}

function scheduleSyncDebounced(): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    performSync();
  }, SYNC_DEBOUNCE_MS);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS & LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

export function addSyncListener(listener: (status: SyncStatus) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

async function notifyListeners(): Promise<void> {
  const pendingOps = await syncQueueCollection.query().fetchCount();
  const conflicts = await syncConflictsCollection
    .query()
    .where('resolved', false)
    .fetchCount();

  const status: SyncStatus = {
    isSyncing,
    lastSync: lastSyncTime ? new Date(lastSyncTime) : null,
    pendingOperations: pendingOps,
    conflicts,
    isOnline,
  };

  listeners.forEach((listener) => listener(status));
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const pendingOps = await syncQueueCollection.query().fetchCount();
  const conflicts = await syncConflictsCollection
    .query()
    .where('resolved', false)
    .fetchCount();

  return {
    isSyncing,
    lastSync: lastSyncTime ? new Date(lastSyncTime) : null,
    pendingOperations: pendingOps,
    conflicts,
    isOnline,
  };
}
