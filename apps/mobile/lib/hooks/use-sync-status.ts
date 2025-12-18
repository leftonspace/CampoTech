/**
 * Sync Status Hook
 * ================
 */

import { useState, useEffect, useCallback } from 'react';
import { addSyncListener, getSyncStatus, performSync, SyncStatus } from '../sync/sync-engine';

export function useSyncStatus() {
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
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      await performSync();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return forceSync;
}
