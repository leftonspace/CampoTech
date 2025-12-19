/**
 * Offline Support Hook
 * ====================
 *
 * Phase 2.3.5: Offline Support
 * Provides unified offline state management with:
 * - Connection status monitoring
 * - Pending operations tracking
 * - Sync conflict detection
 * - Retry utilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import {
  syncQueueCollection,
  syncConflictsCollection,
  database,
} from '../../watermelon/database';
import { SyncQueue, SyncConflict } from '../../watermelon/models';
import {
  performSync,
  enqueueOperation,
  resolveConflict as resolveConflictSync,
  addSyncListener,
  getSyncStatus,
  SyncStatus,
} from '../sync/sync-engine';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSync: Date | null;
  pendingOperations: SyncQueue[];
  conflicts: SyncConflict[];
  error: string | null;
}

export interface OfflineActions {
  sync: () => Promise<{ success: boolean; error?: string }>;
  retryOperation: (operationId: string) => Promise<void>;
  deleteOperation: (operationId: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  resolveConflict: (
    conflictId: string,
    resolution: 'local' | 'server' | 'merged',
    mergedData?: Record<string, unknown>
  ) => Promise<void>;
  queueOperation: (
    entityType: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    payload: Record<string, unknown>
  ) => Promise<void>;
}

export interface UseOfflineResult {
  state: OfflineState;
  actions: OfflineActions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useOffline(): UseOfflineResult {
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    conflictCount: 0,
    lastSync: null,
    pendingOperations: [],
    conflicts: [],
    error: null,
  });

  const syncInProgressRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Subscribe to sync status changes
    const unsubscribeSyncStatus = addSyncListener((status: SyncStatus) => {
      setState((prev) => ({
        ...prev,
        isOnline: status.isOnline,
        isSyncing: status.isSyncing,
        pendingCount: status.pendingOperations,
        conflictCount: status.conflicts,
        lastSync: status.lastSync,
        error: status.error || null,
      }));
    });

    // Get initial status
    getSyncStatus().then((status) => {
      setState((prev) => ({
        ...prev,
        isOnline: status.isOnline,
        isSyncing: status.isSyncing,
        pendingCount: status.pendingOperations,
        conflictCount: status.conflicts,
        lastSync: status.lastSync,
      }));
    });

    // Subscribe to pending operations
    const operationsSubscription = syncQueueCollection
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe((operations) => {
        setState((prev) => ({
          ...prev,
          pendingOperations: operations as SyncQueue[],
          pendingCount: operations.length,
        }));
      });

    // Subscribe to conflicts
    const conflictsSubscription = syncConflictsCollection
      .query(Q.where('resolved', false))
      .observe()
      .subscribe((conflicts) => {
        setState((prev) => ({
          ...prev,
          conflicts: conflicts as SyncConflict[],
          conflictCount: conflicts.length,
        }));
      });

    // Subscribe to app state changes
    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      unsubscribeSyncStatus();
      operationsSubscription.unsubscribe();
      conflictsSubscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // APP STATE HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      // Sync when app comes to foreground
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Small delay to let network reconnect
        setTimeout(() => {
          if (state.isOnline && !syncInProgressRef.current) {
            performSync();
          }
        }, 1000);
      }
      appStateRef.current = nextAppState;
    },
    [state.isOnline]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const sync = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (syncInProgressRef.current) {
      return { success: false, error: 'Sync already in progress' };
    }

    if (!state.isOnline) {
      return { success: false, error: 'Sin conexión a internet' };
    }

    syncInProgressRef.current = true;
    try {
      const result = await performSync();
      return {
        success: result.success,
        error: result.error,
      };
    } finally {
      syncInProgressRef.current = false;
    }
  }, [state.isOnline]);

  const retryOperation = useCallback(async (operationId: string) => {
    const operation = await syncQueueCollection.find(operationId);
    if (operation) {
      await database.write(async () => {
        await operation.update((op: any) => {
          op.retryCount = 0;
        });
      });
      performSync();
    }
  }, []);

  const deleteOperation = useCallback(async (operationId: string) => {
    await database.write(async () => {
      const operation = await syncQueueCollection.find(operationId);
      await operation.destroyPermanently();
    });
  }, []);

  const clearQueue = useCallback(async () => {
    await database.write(async () => {
      const operations = await syncQueueCollection.query().fetch();
      for (const op of operations) {
        await op.destroyPermanently();
      }
    });
  }, []);

  const resolveConflict = useCallback(
    async (
      conflictId: string,
      resolution: 'local' | 'server' | 'merged',
      mergedData?: Record<string, unknown>
    ) => {
      await resolveConflictSync(conflictId, resolution, mergedData);
    },
    []
  );

  const queueOperation = useCallback(
    async (
      entityType: string,
      entityId: string,
      operation: 'create' | 'update' | 'delete',
      payload: Record<string, unknown>
    ) => {
      await enqueueOperation(entityType, entityId, operation, payload);
    },
    []
  );

  return {
    state,
    actions: {
      sync,
      retryOperation,
      deleteOperation,
      clearQueue,
      resolveConflict,
      queueOperation,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE CONNECTION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = addSyncListener((status) => {
      setIsOnline(status.isOnline);
    });

    getSyncStatus().then((status) => {
      setIsOnline(status.isOnline);
    });

    return unsubscribe;
  }, []);

  return isOnline;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PENDING SYNC HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePendingSync(): {
  count: number;
  hasPending: boolean;
  isSyncing: boolean;
} {
  const [state, setState] = useState({
    count: 0,
    hasPending: false,
    isSyncing: false,
  });

  useEffect(() => {
    const unsubscribe = addSyncListener((status) => {
      setState({
        count: status.pendingOperations,
        hasPending: status.pendingOperations > 0,
        isSyncing: status.isSyncing,
      });
    });

    getSyncStatus().then((status) => {
      setState({
        count: status.pendingOperations,
        hasPending: status.pendingOperations > 0,
        isSyncing: status.isSyncing,
      });
    });

    return unsubscribe;
  }, []);

  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICT DETECTION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useConflicts(): {
  conflicts: SyncConflict[];
  hasConflicts: boolean;
  count: number;
} {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  useEffect(() => {
    const subscription = syncConflictsCollection
      .query(Q.where('resolved', false))
      .observe()
      .subscribe((items) => {
        setConflicts(items as SyncConflict[]);
      });

    return () => subscription.unsubscribe();
  }, []);

  return {
    conflicts,
    hasConflicts: conflicts.length > 0,
    count: conflicts.length,
  };
}

export default useOffline;
