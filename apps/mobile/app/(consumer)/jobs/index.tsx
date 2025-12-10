/**
 * Consumer Jobs Screen
 * ====================
 *
 * Phase 15: Consumer Marketplace
 * List of consumer's service requests and accepted jobs.
 */

import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Plus,
} from 'lucide-react-native';

import { ServiceRequestCard } from '../../../components/consumer/ServiceRequestCard';
import { useMyRequests } from '../../../lib/consumer/hooks/use-requests';

type TabKey = 'all' | 'active' | 'completed' | 'cancelled';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'all', label: 'Todos', icon: Clock },
  { key: 'active', label: 'Activos', icon: AlertCircle },
  { key: 'completed', label: 'Completados', icon: CheckCircle },
  { key: 'cancelled', label: 'Cancelados', icon: XCircle },
];

const STATUS_FILTER_MAP: Record<TabKey, string[] | undefined> = {
  all: undefined,
  active: ['open', 'quotes_received', 'accepted', 'in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled', 'expired'],
};

export default function ConsumerJobsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const statusFilter = STATUS_FILTER_MAP[activeTab];
  const { requests, isLoading, refetch } = useMyRequests({
    status: statusFilter ? statusFilter.join(',') : undefined,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleRequestPress = (requestId: string) => {
    router.push({
      pathname: '/(consumer)/request/[id]',
      params: { id: requestId },
    });
  };

  const handleNewRequest = () => {
    router.push('/(consumer)/request/new');
  };

  const groupedRequests = {
    active: requests?.filter(r =>
      ['open', 'quotes_received', 'accepted', 'in_progress'].includes(r.status)
    ) || [],
    completed: requests?.filter(r => r.status === 'completed') || [],
    cancelled: requests?.filter(r =>
      ['cancelled', 'expired'].includes(r.status)
    ) || [],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Solicitudes</Text>
        <TouchableOpacity style={styles.newButton} onPress={handleNewRequest}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <tab.icon
              size={16}
              color={activeTab === tab.key ? '#0284c7' : '#6b7280'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ServiceRequestCard
            request={item}
            onPress={() => handleRequestPress(item.id)}
            showQuotesCount
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0284c7']}
            tintColor="#0284c7"
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyContainer}>
              {activeTab === 'all' ? (
                <>
                  <Text style={styles.emptyTitle}>No tienes solicitudes</Text>
                  <Text style={styles.emptyText}>
                    Crea tu primera solicitud y recibe presupuestos de profesionales cerca tuyo.
                  </Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleNewRequest}
                  >
                    <Plus size={18} color="#fff" />
                    <Text style={styles.createButtonText}>Crear solicitud</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>
                    Sin {activeTab === 'active' ? 'solicitudes activas' :
                          activeTab === 'completed' ? 'trabajos completados' :
                          'solicitudes canceladas'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {activeTab === 'active'
                      ? 'Cuando crees una solicitud, aparecera aqui'
                      : activeTab === 'completed'
                      ? 'Los trabajos completados se mostraran aqui'
                      : 'Las solicitudes canceladas se mostraran aqui'}
                  </Text>
                </>
              )}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  newButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#dbeafe',
  },
  tabText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#0284c7',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
