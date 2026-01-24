/**
 * Sync Status Hook
 * ================
 */

import { useState, useEffect, useCallback } from 'react';
import { addSyncListener, getSyncStatus, performSync, SyncStatus } from '../sync/sync-engine';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    pendingOperations: 0,
    conflicts: 0,
    isOnline: true,
  });

  useEffect(() => {
    // Get initial status
    getSyncStatus().then(setStatus);

    // Subscribe to updates
    const unsubscribe = addSyncListener(setStatus);

    return unsubscribe;
  }, []);

  return status;
}

/**
 * Hook to trigger a manual sync
 */
export function useForceSync() {
  const [isSyncing, setIsSyncing] = useState(false);

  const forceSync = useCallback(async () => {
    if (isSyncing) return { success: false, pulled: 0, pushed: 0, conflicts: 0, error: 'Sync already in progress' };

    setIsSyncing(true);
    try {
      const result = await performSync();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return forceSync;
}
