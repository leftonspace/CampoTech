/**
 * Offline Data Hook
 * =================
 *
 * Phase 9.10: Mobile-First Architecture
 * Unified hook for offline-first data access with optimistic updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/hooks';

import { enqueueOperation } from '../sync/sync-engine';
import { useSyncStatus } from './use-sync-status';

// Types for supported entities
export type EntityType = 'job' | 'customer' | 'invoice' | 'team_member';

interface UseOfflineDataOptions<T> {
  entityType: EntityType;
  collection: string;
  where?: Record<string, unknown>;
  orderBy?: { column: string; direction: 'asc' | 'desc' };
  limit?: number;
  transform?: (record: any) => T;
}

interface OfflineDataResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  create: (data: Partial<T>) => Promise<T | null>;
  update: (id: string, data: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  isOnline: boolean;
  pendingChanges: number;
}

/**
 * Hook for offline-first data access with optimistic updates
 */
export function useOfflineData<T extends { id: string }>(
  options: UseOfflineDataOptions<T>
): OfflineDataResult<T> {
  const database = useDatabase();
  const { isOnline, pendingOperations } = useSyncStatus();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    entityType,
    collection: collectionName,
    where,
    orderBy,
    limit,
    transform = (r) => r as T,
  } = options;

  // Fetch data from local database
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const collection = database.get(collectionName);
      let query = collection.query();

      // Apply where conditions
      if (where) {
        const conditions = Object.entries(where).map(([key, value]) =>
          Q.where(key, value as any)
        );
        query = collection.query(...conditions);
      }

      // Observe the collection for real-time updates
      const records = await query.fetch();

      // Apply sorting client-side if specified
      let sortedRecords = records;
      if (orderBy) {
        sortedRecords = [...records].sort((a: any, b: any) => {
          const aVal = a[orderBy.column];
          const bVal = b[orderBy.column];
          if (orderBy.direction === 'asc') {
            return aVal > bVal ? 1 : -1;
          }
          return aVal < bVal ? 1 : -1;
        });
      }

      // Apply limit
      if (limit) {
        sortedRecords = sortedRecords.slice(0, limit);
      }

      // Transform records
      const transformed = sortedRecords.map(transform);
      setData(transformed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [database, collectionName, where, orderBy, limit, transform]);

  // Initial fetch and subscription
  useEffect(() => {
    fetchData();

    // Subscribe to collection changes
    const collection = database.get(collectionName);
    const subscription = collection.query().observe().subscribe(() => {
      fetchData();
    });

    return () => subscription.unsubscribe();
  }, [fetchData, collectionName]);

  // Create with optimistic update
  const create = useCallback(
    async (createData: Partial<T>): Promise<T | null> => {
      try {
        const collection = database.get(collectionName);

        // Generate temporary ID for optimistic update
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create locally
        const created = await database.write(async () => {
          return collection.create((record: any) => {
            record._raw.id = tempId;
            Object.assign(record, createData);
            record.isDirty = true;
            record.createdAt = new Date();
          });
        });

        // Queue for sync
        await enqueueOperation(
          entityType,
          tempId,
          'create',
          { ...createData, tempId },
          8 // High priority for creates
        );

        return transform(created);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error creating record');
        return null;
      }
    },
    [database, collectionName, entityType, transform]
  );

  // Update with optimistic update
  const update = useCallback(
    async (id: string, updateData: Partial<T>): Promise<T | null> => {
      try {
        const collection = database.get(collectionName);
        const record = await collection.find(id);

        // Update locally
        await database.write(async () => {
          await record.update((r: any) => {
            Object.assign(r, updateData);
            r.isDirty = true;
            r.updatedAt = new Date();
          });
        });

        // Queue for sync
        await enqueueOperation(
          entityType,
          id,
          'update',
          updateData as Record<string, unknown>,
          5 // Medium priority for updates
        );

        // Refetch to get updated record
        const updated = await collection.find(id);
        return transform(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error updating record');
        return null;
      }
    },
    [database, collectionName, entityType, transform]
  );

  // Delete with optimistic update
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const collection = database.get(collectionName);
        const record = await collection.find(id);

        // Mark as deleted locally (soft delete for sync)
        await database.write(async () => {
          await record.markAsDeleted();
        });

        // Queue for sync
        await enqueueOperation(entityType, id, 'delete', {}, 3);

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error deleting record');
        return false;
      }
    },
    [database, collectionName, entityType]
  );

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    create,
    update,
    remove,
    isOnline,
    pendingChanges: pendingOperations,
  };
}

/**
 * Convenience hook for jobs
 */
export function useOfflineJobs(filters?: {
  status?: string;
  assignedTo?: string;
  customerId?: string;
}) {
  return useOfflineData({
    entityType: 'job',
    collection: 'jobs',
    where: filters,
    orderBy: { column: 'scheduledStart', direction: 'asc' },
    transform: (record: any) => ({
      id: record.id,
      serverId: record.serverId,
      customerId: record.customerId,
      status: record.status,
      serviceType: record.serviceType,
      priority: record.priority,
      scheduledStart: record.scheduledStart ? new Date(record.scheduledStart) : null,
      scheduledEnd: record.scheduledEnd ? new Date(record.scheduledEnd) : null,
      address: record.address,
      notes: record.notes,
      assignedToId: record.assignedToId,
      isDirty: record.isDirty,
    }),
  });
}

/**
 * Convenience hook for customers
 */
export function useOfflineCustomers(filters?: {
  search?: string;
}) {
  return useOfflineData({
    entityType: 'customer',
    collection: 'customers',
    orderBy: { column: 'name', direction: 'asc' },
    transform: (record: any) => ({
      id: record.id,
      serverId: record.serverId,
      name: record.name,
      phone: record.phone,
      email: record.email,
      address: record.address,
      city: record.city,
      province: record.province,
      cuit: record.cuit,
      isDirty: record.isDirty,
    }),
  });
}

/**
 * Hook for single entity by ID
 */
export function useOfflineEntity<T>(
  entityType: EntityType,
  collectionName: string,
  id: string | null
) {
  const database = useDatabase();
  const [entity, setEntity] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setEntity(null);
      setLoading(false);
      return;
    }

    const fetchEntity = async () => {
      try {
        setLoading(true);
        const collection = database.get(collectionName);
        const record = await collection.find(id);
        setEntity(record as unknown as T);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Entity not found');
        setEntity(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEntity();

    // Subscribe to changes
    const collection = database.get(collectionName);
    const subscription = collection
      .findAndObserve(id)
      .subscribe(
        (record) => setEntity(record as unknown as T),
        () => setEntity(null)
      );

    return () => subscription.unsubscribe();
  }, [database, collectionName, id]);

  return { entity, loading, error };
}
