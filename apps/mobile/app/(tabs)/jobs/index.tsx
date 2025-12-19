/**
 * Jobs Management Screen (Dispatcher/Owner)
 * ==========================================
 *
 * Phase 2.4.1: Job Management Screen
 * Shows all jobs with filtering by status, date, and technician.
 * Supports job creation and assignment.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { SafeAreaView } from 'react-native-safe-area-context';

import { jobsCollection, database } from '../../../watermelon/database';
import { Job } from '../../../watermelon/models';
import { performSync, enqueueOperation } from '../../../lib/sync/sync-engine';
import { useSyncStatus } from '../../../lib/hooks/use-sync-status';
import { useAuth } from '../../../lib/auth/auth-context';
import JobCard from '../../../components/job/JobCard';

type StatusFilter = 'all' | 'pending' | 'active' | 'completed' | 'unassigned';

// Mock technicians - in production from API
const MOCK_TECHNICIANS = [
  { id: 'tech-1', name: 'Carlos Rodriguez' },
  { id: 'tech-2', name: 'María García' },
  { id: 'tech-3', name: 'Juan Pérez' },
];

function JobsManagementScreen({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const { user } = useAuth();
  const { isSyncing } = useSyncStatus();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string | null>(null);
  const [showTechnicianPicker, setShowTechnicianPicker] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    await performSync();
  }, []);

  const handleJobPress = useCallback(
    (job: Job) => {
      router.push(`/(tabs)/jobs/${job.id}`);
    },
    [router]
  );

  const handleCreateJob = useCallback(() => {
    router.push('/(tabs)/jobs/create');
  }, [router]);

  const handleAssignJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setShowAssignModal(true);
  }, []);

  const handleConfirmAssign = useCallback(
    async (technicianId: string, technicianName: string) => {
      if (!selectedJobId) return;

      try {
        const job = await jobsCollection.find(selectedJobId);
        await database.write(async () => {
          await job.update((j: any) => {
            j.assignedToId = technicianId;
            j.isDirty = true;
          });
        });

        await enqueueOperation('job', job.serverId, 'update', {
          assignedToId: technicianId,
        });

        Alert.alert('Asignado', `Trabajo asignado a ${technicianName}`);
      } catch (error) {
        Alert.alert('Error', 'No se pudo asignar el trabajo');
      } finally {
        setShowAssignModal(false);
        setSelectedJobId(null);
      }
    },
    [selectedJobId]
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
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
      if (statusFilter === 'unassigned' && job.assignedToId) {
        return false;
      }

      // Technician filter
      if (technicianFilter && job.assignedToId !== technicianFilter) {
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
  }, [jobs, statusFilter, technicianFilter, search]);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      pending: jobs.filter((j) => j.status === 'pending' || j.status === 'scheduled').length,
      active: jobs.filter((j) => j.status === 'en_camino' || j.status === 'working').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      unassigned: jobs.filter((j) => !j.assignedToId).length,
    }),
    [jobs]
  );

  const FilterButton = ({
    label,
    value,
    count,
    warning,
  }: {
    label: string;
    value: StatusFilter;
    count: number;
    warning?: boolean;
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
          warning && count > 0 && styles.filterBadgeWarning,
        ]}
      >
        <Text
          style={[
            styles.filterBadgeText,
            statusFilter === value && styles.filterBadgeTextActive,
            warning && count > 0 && styles.filterBadgeTextWarning,
          ]}
        >
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const selectedTechnician = MOCK_TECHNICIANS.find((t) => t.id === technicianFilter);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header with create button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestión de Trabajos</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateJob}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

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

      {/* Technician filter */}
      <TouchableOpacity
        style={styles.technicianFilter}
        onPress={() => setShowTechnicianPicker(true)}
      >
        <Feather name="user" size={16} color="#6b7280" />
        <Text style={styles.technicianFilterText}>
          {selectedTechnician ? selectedTechnician.name : 'Todos los técnicos'}
        </Text>
        <Feather name="chevron-down" size={16} color="#6b7280" />
        {technicianFilter && (
          <TouchableOpacity
            style={styles.clearTechFilter}
            onPress={() => setTechnicianFilter(null)}
          >
            <Feather name="x" size={14} color="#6b7280" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollView}
        contentContainerStyle={styles.filterContainer}
      >
        <FilterButton label="Todos" value="all" count={counts.all} />
        <FilterButton label="Pendientes" value="pending" count={counts.pending} />
        <FilterButton label="Activos" value="active" count={counts.active} />
        <FilterButton label="Completados" value="completed" count={counts.completed} />
        <FilterButton label="Sin asignar" value="unassigned" count={counts.unassigned} warning />
      </ScrollView>

      {/* Jobs list */}
      <FlashList
        data={filteredJobs}
        renderItem={({ item }) => (
          <View style={styles.jobCardContainer}>
            <JobCard job={item} onPress={() => handleJobPress(item)} />
            {!item.assignedToId && (
              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => handleAssignJob(item.id)}
              >
                <Feather name="user-plus" size={14} color="#f59e0b" />
                <Text style={styles.assignButtonText}>Asignar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        estimatedItemSize={140}
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
            <TouchableOpacity style={styles.emptyButton} onPress={handleCreateJob}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyButtonText}>Crear trabajo</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Technician Picker Modal */}
      <Modal
        visible={showTechnicianPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTechnicianPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTechnicianPicker(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Filtrar por técnico</Text>
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => {
                setTechnicianFilter(null);
                setShowTechnicianPicker(false);
              }}
            >
              <Text style={styles.pickerOptionText}>Todos los técnicos</Text>
              {!technicianFilter && <Feather name="check" size={18} color="#16a34a" />}
            </TouchableOpacity>
            {MOCK_TECHNICIANS.map((tech) => (
              <TouchableOpacity
                key={tech.id}
                style={styles.pickerOption}
                onPress={() => {
                  setTechnicianFilter(tech.id);
                  setShowTechnicianPicker(false);
                }}
              >
                <Text style={styles.pickerOptionText}>{tech.name}</Text>
                {technicianFilter === tech.id && (
                  <Feather name="check" size={18} color="#16a34a" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Assign Job Modal */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.assignModal}>
            <View style={styles.assignModalHeader}>
              <Text style={styles.assignModalTitle}>Asignar trabajo</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.assignModalSubtitle}>
              Seleccioná un técnico para este trabajo
            </Text>
            {MOCK_TECHNICIANS.map((tech) => (
              <TouchableOpacity
                key={tech.id}
                style={styles.technicianOption}
                onPress={() => handleConfirmAssign(tech.id, tech.name)}
              >
                <View style={styles.technicianAvatar}>
                  <Text style={styles.technicianAvatarText}>
                    {tech.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.technicianName}>{tech.name}</Text>
                <Feather name="chevron-right" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Observe jobs from WatermelonDB
const enhance = withObservables([], () => ({
  jobs: jobsCollection.query(Q.sortBy('scheduled_start', Q.desc)),
}));

export default enhance(JobsManagementScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
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
  technicianFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  technicianFilterText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  clearTechFilter: {
    padding: 4,
  },
  filterScrollView: {
    maxHeight: 50,
    marginTop: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },
  filterBadgeTextWarning: {
    color: '#b45309',
  },
  jobCardContainer: {
    position: 'relative',
  },
  assignButton: {
    position: 'absolute',
    top: 12,
    right: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  assignButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
  },
  listContent: {
    paddingTop: 12,
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
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  assignModal: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  assignModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  assignModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  assignModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  technicianOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  technicianAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  technicianAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  technicianName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
});
