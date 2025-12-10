/**
 * My Requests Screen
 * ==================
 *
 * View and manage service requests.
 * Phase 15: Consumer Marketplace
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { consumerApi } from '../services/api-client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceRequest {
  id: string;
  requestNumber: string;
  title: string;
  category: string;
  status: string;
  urgency: string;
  quoteCount: number;
  createdAt: string;
}

type TabType = 'active' | 'completed' | 'cancelled';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Abierta', color: '#1976D2', bgColor: '#E3F2FD' },
  quotes_received: { label: 'Cotizaciones', color: '#7B1FA2', bgColor: '#F3E5F5' },
  accepted: { label: 'Aceptada', color: '#388E3C', bgColor: '#E8F5E9' },
  in_progress: { label: 'En progreso', color: '#F57C00', bgColor: '#FFF3E0' },
  completed: { label: 'Completada', color: '#2E7D32', bgColor: '#E8F5E9' },
  cancelled: { label: 'Cancelada', color: '#757575', bgColor: '#F5F5F5' },
  expired: { label: 'Expirada', color: '#9E9E9E', bgColor: '#FAFAFA' },
};

const URGENCY_LABELS: Record<string, string> = {
  flexible: 'Flexible',
  this_week: 'Esta semana',
  urgent: 'Urgente',
  emergency: 'Emergencia',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MyRequestsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('active');

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD REQUESTS
  // ─────────────────────────────────────────────────────────────────────────────

  const loadRequests = useCallback(async () => {
    try {
      const statusFilter = activeTab === 'active'
        ? 'open,quotes_received,accepted,in_progress'
        : activeTab === 'completed'
          ? 'completed'
          : 'cancelled,expired';

      const response = await consumerApi.requests.list({ status: statusFilter });
      if (response.success && response.data) {
        setRequests(response.data);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    loadRequests();
  }, [loadRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRequests();
  }, [loadRequests]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER REQUEST ITEM
  // ─────────────────────────────────────────────────────────────────────────────

  const renderRequestItem = ({ item }: { item: ServiceRequest }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;

    return (
      <TouchableOpacity
        style={styles.requestCard}
        onPress={() => navigation.navigate('RequestDetail', { requestId: item.id })}
      >
        <View style={styles.requestHeader}>
          <Text style={styles.requestNumber}>#{item.requestNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <Text style={styles.requestTitle}>{item.title}</Text>

        <View style={styles.requestMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>🏷️</Text>
            <Text style={styles.metaText}>{item.category}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>⏰</Text>
            <Text style={styles.metaText}>{URGENCY_LABELS[item.urgency] || item.urgency}</Text>
          </View>
        </View>

        <View style={styles.requestFooter}>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          {item.quoteCount > 0 && (
            <View style={styles.quotesBadge}>
              <Text style={styles.quotesText}>
                {item.quoteCount} cotizaci{item.quoteCount === 1 ? 'ón' : 'ones'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Activas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Completadas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cancelled' && styles.tabActive]}
          onPress={() => setActiveTab('cancelled')}
        >
          <Text style={[styles.tabText, activeTab === 'cancelled' && styles.tabTextActive]}>
            Canceladas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Request List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'active'
                  ? 'No tienes solicitudes activas'
                  : activeTab === 'completed'
                    ? 'No tienes solicitudes completadas'
                    : 'No tienes solicitudes canceladas'}
              </Text>
              {activeTab === 'active' && (
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => navigation.navigate('CreateRequest')}
                >
                  <Text style={styles.createButtonText}>Crear solicitud</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateRequest')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2E7D32',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#757575',
  },
  tabTextActive: {
    color: '#2E7D32',
  },

  // List
  listContent: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestNumber: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 10,
  },
  requestMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 13,
    color: '#757575',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
  dateText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  quotesBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  quotesText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#757575',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    color: '#FFF',
    lineHeight: 32,
  },
});
