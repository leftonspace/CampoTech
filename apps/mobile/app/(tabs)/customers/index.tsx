/**
 * Customers List Screen
 * =====================
 *
 * Phase 9.10: Mobile-First Architecture
 * Customer management for mobile app.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Plus,
  User,
  Phone,
  MapPin,
  ChevronRight,
  Users,
} from 'lucide-react-native';

import { api } from '../../../lib/api/client';
import { useIsOnline } from '../../../lib/hooks/use-offline';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  cuit?: string;
  taxCondition?: string;
  jobsCount?: number;
  lastJobAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CustomersScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const isOnline = useIsOnline();

  // Fetch customers
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['customers', searchQuery],
    queryFn: async () => {
      const response = await api.customers.list({
        search: searchQuery || undefined,
        limit: 50,
      });
      return response;
    },
    staleTime: 30000, // 30 seconds
  });

  const customers: Customer[] = (data?.data as Customer[]) || [];

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const navigateToCustomer = useCallback((customerId: string) => {
    router.push(`/customers/${customerId}`);
  }, [router]);

  const navigateToCreate = useCallback(() => {
    router.push('/customers/create');
  }, [router]);

  const renderCustomer = useCallback(({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => navigateToCustomer(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.customerInfo}>
        <Text style={styles.customerName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.customerMeta}>
          <Phone size={12} color="#6b7280" />
          <Text style={styles.metaText}>{item.phone}</Text>
        </View>

        {item.address && (
          <View style={styles.customerMeta}>
            <MapPin size={12} color="#6b7280" />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        )}

        {item.jobsCount !== undefined && item.jobsCount > 0 && (
          <Text style={styles.jobsCount}>
            {item.jobsCount} trabajo{item.jobsCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <ChevronRight size={20} color="#9ca3af" />
    </TouchableOpacity>
  ), [navigateToCustomer]);

  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Users size={48} color="#d1d5db" />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'Sin resultados' : 'Sin clientes'}
      </Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'No se encontraron clientes con esa búsqueda'
          : 'Agregá tu primer cliente para comenzar'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.emptyButton} onPress={navigateToCreate}>
          <Plus size={18} color="#fff" />
          <Text style={styles.emptyButtonText}>Agregar cliente</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [searchQuery, navigateToCreate]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Clientes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={navigateToCreate}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, teléfono..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={handleSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Offline indicator */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Modo sin conexión - Datos pueden estar desactualizados
          </Text>
        </View>
      )}

      {/* List */}
      {isLoading && !isRefetching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Cargando clientes...</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={['#16a34a']}
              tintColor="#16a34a"
            />
          }
          ListEmptyComponent={ListEmptyComponent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  offlineBanner: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#16a34a',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  customerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  jobsCount: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '500',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
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
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
