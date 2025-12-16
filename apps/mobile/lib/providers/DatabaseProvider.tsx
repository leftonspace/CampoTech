/**
 * Platform-Aware Database Provider
 * =================================
 *
 * Wraps WatermelonDB's DatabaseProvider for native platforms,
 * but skips it on web where WatermelonDB doesn't work.
 */

import React from 'react';
import { Platform } from 'react-native';

interface Props {
  children: React.ReactNode;
}

export function AppDatabaseProvider({ children }: Props) {
  if (Platform.OS === 'web') {
    // On web, just render children without WatermelonDB provider
    // The web mock database doesn't require a provider context
    return <>{children}</>;
  }

  // On native (iOS/Android), use real WatermelonDB provider
  // Using require to avoid importing native modules on web
  const { DatabaseProvider } = require('@nozbe/watermelondb/react');
  const { database } = require('../../watermelon/database.native');

  return <DatabaseProvider database={database}>{children}</DatabaseProvider>;
}

export default AppDatabaseProvider;
