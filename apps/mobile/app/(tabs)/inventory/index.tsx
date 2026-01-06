/**
 * Inventory Screen
 * ================
 *
 * Main inventory view for technicians showing vehicle stock.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
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

import { database } from '../../../watermelon/database';
import { VehicleStock } from '../../../watermelon/models';
import { performSync } from '../../../lib/sync/sync-engine';
import { useSyncStatus } from '../../../lib/hooks/use-sync-status';
import {
  getPendingDeductionCount,
  getFailedDeductionCount,
  retryFailedDeductions,
} from '../../../lib/sync/pending-deductions-sync';

const vehicleStockCollection = database.get<VehicleStock>('vehicle_stock');

function InventoryScreen({ stock }: { stock: VehicleStock[] }) {
  const router = useRouter();
  const { isSyncing } = useSyncStatus();
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Load pending deduction counts
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [pending, failed] = await Promise.all([
          getPendingDeductionCount(),
          getFailedDeductionCount(),
        ]);
        setPendingCount(pending);
        setFailedCount(failed);
      } catch (error) {
        console.error('Error loading pending counts:', error);
      }
    };
    loadCounts();
  }, [isSyncing]); // Refresh counts after sync

  const handleRefresh = useCallback(async () => {
    await performSync();
  }, []);

  const handleRetryFailed = useCallback(async () => {
    try {
      const retried = await retryFailedDeductions();
      if (retried > 0) {
        setFailedCount(0);
        setPendingCount((prev) => prev + retried);
        // Trigger sync
        performSync().catch(console.error);
      }
    } catch (error) {
      console.error('Error retrying failed deductions:', error);
    }
  }, []);

  const filteredStock = useMemo(() => {
    if (!search) return stock;
    const query = search.toLowerCase();
    return stock.filter(
      (item) =>
        item.productName.toLowerCase().includes(query) ||
        item.productSku.toLowerCase().includes(query)
    );
  }, [stock, search]);

  // Group by status
  const groupedStock = useMemo(() => {
    const groups = {
      needsReplenishment: [] as VehicleStock[],
      ok: [] as VehicleStock[],
    };

    filteredStock.forEach((item) => {
      if (item.needsReplenishment || item.quantity <= item.minQuantity) {
        groups.needsReplenishment.push(item);
      } else {
        groups.ok.push(item);
      }
    });

    return groups;
  }, [filteredStock]);

  const totalValue = useMemo(() => {
    return stock.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  }, [stock]);

  const renderItem = ({ item }: { item: VehicleStock }) => (
    <TouchableOpacity
      style={styles.stockCard}
      onPress={() => router.push(`/(tabs)/inventory/${item.id}`)}
    >
      <View style={styles.stockInfo}>
        <Text style={styles.productName}>{item.productName}</Text>
        <Text style={styles.productSku}>{item.productSku}</Text>
      </View>
      <View style={styles.stockQuantity}>
        <Text
          style={[
            styles.quantityText,
            item.quantity <= item.minQuantity && styles.lowQuantity,
          ]}
        >
          {item.quantity}
        </Text>
        <Text style={styles.quantityLabel}>
          Min: {item.minQuantity}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  const ListHeader = () => (
    <View>
      {/* Pending sync indicator */}
      {(pendingCount > 0 || failedCount > 0) && (
        <View style={styles.pendingSyncBanner}>
          <View style={styles.pendingSyncContent}>
            <Feather
              name={failedCount > 0 ? 'alert-circle' : 'cloud-off'}
              size={18}
              color={failedCount > 0 ? '#ef4444' : '#f59e0b'}
            />
            <Text style={styles.pendingSyncText}>
              {failedCount > 0
                ? `${failedCount} uso${failedCount > 1 ? 's' : ''} fallido${failedCount > 1 ? 's' : ''}`
                : `${pendingCount} material${pendingCount > 1 ? 'es' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sincronizar`}
            </Text>
          </View>
          {failedCount > 0 ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetryFailed}
            >
              <Feather name="refresh-cw" size={14} color="#ef4444" />
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          ) : (
            <Feather name="loader" size={16} color="#f59e0b" />
          )}
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stock.length}</Text>
          <Text style={styles.statLabel}>Productos</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>
            {groupedStock.needsReplenishment.length}
          </Text>
          <Text style={styles.statLabel}>Stock bajo</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: '#16a34a' }]}>
            ${totalValue.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Valor total</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9ca3af"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Low stock section */}
      {groupedStock.needsReplenishment.length > 0 && (
        <View style={styles.sectionHeader}>
          <Feather name="alert-triangle" size={16} color="#ef4444" />
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>
            Stock bajo ({groupedStock.needsReplenishment.length})
          </Text>
        </View>
      )}
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Feather name="package" size={48} color="#d1d5db" />
      <Text style={styles.emptyTitle}>Sin stock en vehículo</Text>
      <Text style={styles.emptyText}>
        El inventario de tu vehículo aparecerá aquí
      </Text>
    </View>
  );

  // Combine low stock and ok stock for flat list
  const listData = [
    ...groupedStock.needsReplenishment,
    ...(groupedStock.needsReplenishment.length > 0 && groupedStock.ok.length > 0
      ? [{ id: 'separator', type: 'separator' } as any]
      : []),
    ...groupedStock.ok,
  ];

  return (
    <View style={styles.container}>
      <FlashList
        data={listData}
        renderItem={({ item }) => {
          if (item.type === 'separator') {
            return (
              <View style={styles.sectionHeader}>
                <Feather name="check-circle" size={16} color="#16a34a" />
                <Text style={[styles.sectionTitle, { color: '#16a34a' }]}>
                  Stock OK ({groupedStock.ok.length})
                </Text>
              </View>
            );
          }
          return renderItem({ item });
        }}
        estimatedItemSize={80}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleRefresh}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={<ListEmpty />}
        contentContainerStyle={styles.listContent}
      />

      {/* Request replenishment FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/inventory/replenish')}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// Observe vehicle stock from WatermelonDB
const enhance = withObservables([], () => ({
  stock: vehicleStockCollection.query(Q.sortBy('product_name', Q.asc)),
}));

export default enhance(InventoryScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  listContent: {
    paddingBottom: 100,
  },
  statsContainer: {
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  stockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stockInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  productSku: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  stockQuantity: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  quantityText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  lowQuantity: {
    color: '#ef4444',
  },
  quantityLabel: {
    fontSize: 11,
    color: '#9ca3af',
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
  pendingSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  pendingSyncContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pendingSyncText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e',
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ef4444',
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
