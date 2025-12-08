/**
 * Today's Jobs Screen
 * ===================
 *
 * Shows jobs scheduled for today with quick status updates.
 */

import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';

import { database, jobsCollection } from '../../watermelon/database';
import { Job } from '../../watermelon/models';
import { performSync } from '../../lib/sync/sync-engine';
import { useSyncStatus } from '../../lib/hooks/use-sync-status';
import JobCard from '../../components/job/JobCard';

// Get today's date range
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

function TodayScreen({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const { isSyncing, pendingOperations } = useSyncStatus();

  const handleRefresh = useCallback(async () => {
    await performSync();
  }, []);

  const handleJobPress = useCallback(
    (job: Job) => {
      router.push(`/(tabs)/jobs/${job.id}`);
    },
    [router]
  );

  // Group jobs by status
  const groupedJobs = useMemo(() => {
    const groups = {
      active: [] as Job[],
      upcoming: [] as Job[],
      completed: [] as Job[],
    };

    jobs.forEach((job) => {
      if (job.status === 'en_camino' || job.status === 'working') {
        groups.active.push(job);
      } else if (job.status === 'completed' || job.status === 'cancelled') {
        groups.completed.push(job);
      } else {
        groups.upcoming.push(job);
      }
    });

    // Sort by scheduled time
    const sortByTime = (a: Job, b: Job) =>
      (a.scheduledStart || 0) - (b.scheduledStart || 0);

    groups.active.sort(sortByTime);
    groups.upcoming.sort(sortByTime);
    groups.completed.sort(sortByTime);

    return groups;
  }, [jobs]);

  const renderSection = (title: string, data: Job[], icon: string, color: string) => {
    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name={icon as any} size={16} color={color} />
          <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{data.length}</Text>
          </View>
        </View>
        {data.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onPress={() => handleJobPress(job)}
          />
        ))}
      </View>
    );
  };

  const ListHeader = () => (
    <View style={styles.headerStats}>
      <View style={styles.stat}>
        <Text style={styles.statNumber}>{jobs.length}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.stat}>
        <Text style={[styles.statNumber, { color: '#16a34a' }]}>
          {groupedJobs.completed.length}
        </Text>
        <Text style={styles.statLabel}>Completados</Text>
      </View>
      <View style={styles.stat}>
        <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
          {groupedJobs.upcoming.length}
        </Text>
        <Text style={styles.statLabel}>Pendientes</Text>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Feather name="calendar" size={48} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No hay trabajos para hoy</Text>
      <Text style={styles.emptyText}>
        Los trabajos programados para hoy aparecerán aquí
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={[1]} // Single item to render sections
        renderItem={() => (
          <>
            <ListHeader />
            {renderSection('En progreso', groupedJobs.active, 'play-circle', '#3b82f6')}
            {renderSection('Próximos', groupedJobs.upcoming, 'clock', '#f59e0b')}
            {renderSection('Completados', groupedJobs.completed, 'check-circle', '#16a34a')}
          </>
        )}
        estimatedItemSize={200}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleRefresh}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
        ListEmptyComponent={<ListEmpty />}
        contentContainerStyle={styles.listContent}
      />

      {/* Pending sync indicator */}
      {pendingOperations > 0 && (
        <View style={styles.pendingBadge}>
          <Feather name="cloud-off" size={14} color="#fff" />
          <Text style={styles.pendingText}>
            {pendingOperations} cambio{pendingOperations > 1 ? 's' : ''} pendiente
            {pendingOperations > 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

// Observe today's jobs from WatermelonDB
const enhance = withObservables([], () => {
  const { start, end } = getTodayRange();

  return {
    jobs: jobsCollection.query(
      Q.where('scheduled_start', Q.gte(start)),
      Q.where('scheduled_start', Q.lte(end)),
      Q.sortBy('scheduled_start', Q.asc)
    ),
  };
});

export default enhance(TodayScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  listContent: {
    paddingBottom: 100,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 16,
    marginBottom: 8,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  pendingBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 12,
  },
  pendingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
