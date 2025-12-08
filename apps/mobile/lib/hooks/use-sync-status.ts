/**
 * Sync Status Hook
 * ================
 */

import { useState, useEffect } from 'react';
import { addSyncListener, getSyncStatus, SyncStatus } from '../sync/sync-engine';

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
