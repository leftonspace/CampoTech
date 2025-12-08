/**
 * Jobs List Screen
 * ================
 *
 * Shows all jobs with filtering options.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';

import { jobsCollection } from '../../../watermelon/database';
import { Job } from '../../../watermelon/models';
import { performSync } from '../../../lib/sync/sync-engine';
import { useSyncStatus } from '../../../lib/hooks/use-sync-status';
import JobCard from '../../../components/job/JobCard';

type StatusFilter = 'all' | 'pending' | 'active' | 'completed';

function JobsListScreen({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const { isSyncing } = useSyncStatus();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const handleRefresh = useCallback(async () => {
    await performSync();
  }, []);

  const handleJobPress = useCallback(
    (job: Job) => {
      router.push(`/(tabs)/jobs/${job.id}`);
    },
    [router]
  );

  const filteredJobs = jobs.filter((job) => {
    // Status filter
    if (statusFilter === 'pending' && job.status !== 'pending' && job.status !== 'scheduled') {
      return false;
    }
    if (statusFilter === 'active' && job.status !== 'en_camino' && job.status !== 'working') {
      return false;
    }
    if (statusFilter === 'completed' && job.status !== 'completed') {
      return false;
    }

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      return (
        job.serviceType.toLowerCase().includes(query) ||
        job.address.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const FilterButton = ({
    label,
    value,
    count,
  }: {
    label: string;
    value: StatusFilter;
    count: number;
  }) => (
    <TouchableOpacity
      style={[styles.filterButton, statusFilter === value && styles.filterButtonActive]}
      onPress={() => setStatusFilter(value)}
    >
      <Text
        style={[
          styles.filterButtonText,
          statusFilter === value && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.filterBadge,
          statusFilter === value && styles.filterBadgeActive,
        ]}
      >
        <Text
          style={[
            styles.filterBadgeText,
            statusFilter === value && styles.filterBadgeTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const counts = {
    all: jobs.length,
    pending: jobs.filter((j) => j.status === 'pending' || j.status === 'scheduled').length,
    active: jobs.filter((j) => j.status === 'en_camino' || j.status === 'working').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar trabajos..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <FilterButton label="Todos" value="all" count={counts.all} />
        <FilterButton label="Pendientes" value="pending" count={counts.pending} />
        <FilterButton label="Activos" value="active" count={counts.active} />
        <FilterButton label="Completados" value="completed" count={counts.completed} />
      </View>

      {/* Jobs list */}
      <FlashList
        data={filteredJobs}
        renderItem={({ item }) => (
          <JobCard job={item} onPress={() => handleJobPress(item)} />
        )}
        estimatedItemSize={120}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleRefresh}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No hay trabajos</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// Observe jobs from WatermelonDB
const enhance = withObservables([], () => ({
  jobs: jobsCollection.query(Q.sortBy('scheduled_start', Q.desc)),
}));

export default enhance(JobsListScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#111827',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 100,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
});
