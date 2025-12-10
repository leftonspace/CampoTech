/**
 * Inventory List Component
 * ========================
 *
 * Reusable list component for displaying inventory items with filtering.
 */

import { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { VehicleStock } from '../../watermelon/models';

interface InventoryListProps {
  items: VehicleStock[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onItemPress?: (item: VehicleStock) => void;
  onItemAction?: (item: VehicleStock, action: 'use' | 'adjust' | 'request') => void;
  emptyMessage?: string;
  showActions?: boolean;
  filterLowStock?: boolean;
  filterOutOfStock?: boolean;
  groupByCategory?: boolean;
  compact?: boolean;
}

interface GroupedItems {
  title: string;
  data: VehicleStock[];
}

export default function InventoryList({
  items,
  isRefreshing = false,
  onRefresh,
  onItemPress,
  onItemAction,
  emptyMessage = 'Sin productos en inventario',
  showActions = false,
  filterLowStock = false,
  filterOutOfStock = false,
  groupByCategory = false,
  compact = false,
}: InventoryListProps) {
  // Filter items based on props
  const filteredItems = useMemo(() => {
    let result = items;

    if (filterLowStock) {
      result = result.filter(
        (item) => item.needsReplenishment || item.quantity <= item.minQuantity
      );
    }

    if (filterOutOfStock) {
      result = result.filter((item) => item.quantity <= 0);
    }

    return result;
  }, [items, filterLowStock, filterOutOfStock]);

  // Group items by category if needed
  const groupedData = useMemo(() => {
    if (!groupByCategory) return null;

    const groups: Record<string, VehicleStock[]> = {};

    filteredItems.forEach((item) => {
      // Using productSku prefix as pseudo-category for grouping
      const category = item.productSku.split('-')[0] || 'Otros';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    return Object.entries(groups)
      .map(([title, data]) => ({ title, data }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredItems, groupByCategory]);

  const getStockStatus = useCallback((item: VehicleStock) => {
    if (item.quantity <= 0) return 'out';
    if (item.quantity <= item.minQuantity || item.needsReplenishment) return 'low';
    if (item.quantity >= item.maxQuantity) return 'full';
    return 'ok';
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'out':
        return '#ef4444';
      case 'low':
        return '#f59e0b';
      case 'full':
        return '#3b82f6';
      default:
        return '#16a34a';
    }
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    switch (status) {
      case 'out':
        return 'Agotado';
      case 'low':
        return 'Bajo';
      case 'full':
        return 'Completo';
      default:
        return 'OK';
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: VehicleStock }) => {
      const status = getStockStatus(item);
      const statusColor = getStatusColor(status);
      const progress = item.maxQuantity > 0
        ? Math.min(item.quantity / item.maxQuantity, 1)
        : item.quantity > 0 ? 1 : 0;

      return (
        <TouchableOpacity
          style={[styles.itemCard, compact && styles.itemCardCompact]}
          onPress={() => onItemPress?.(item)}
          activeOpacity={0.7}
        >
          <View style={styles.itemContent}>
            {/* Product info */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.productName}
              </Text>
              <Text style={styles.itemSku}>{item.productSku}</Text>
            </View>

            {/* Quantity display */}
            <View style={styles.quantityContainer}>
              <Text style={[styles.quantityText, { color: statusColor }]}>
                {item.quantity}
              </Text>
              <Text style={styles.quantityLabel}>
                / {item.maxQuantity}
              </Text>
            </View>

            {/* Status badge */}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${statusColor}20` },
              ]}
            >
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(status)}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          {!compact && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: statusColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.rangeText}>
                Min: {item.minQuantity} | Máx: {item.maxQuantity}
              </Text>
            </View>
          )}

          {/* Actions */}
          {showActions && status !== 'out' && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onItemAction?.(item, 'use')}
              >
                <Feather name="minus-circle" size={18} color="#6b7280" />
                <Text style={styles.actionText}>Usar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onItemAction?.(item, 'adjust')}
              >
                <Feather name="edit-3" size={18} color="#6b7280" />
                <Text style={styles.actionText}>Ajustar</Text>
              </TouchableOpacity>
              {status === 'low' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.requestButton]}
                  onPress={() => onItemAction?.(item, 'request')}
                >
                  <Feather name="refresh-cw" size={18} color="#16a34a" />
                  <Text style={[styles.actionText, { color: '#16a34a' }]}>
                    Reponer
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Feather
            name="chevron-right"
            size={20}
            color="#9ca3af"
            style={styles.chevron}
          />
        </TouchableOpacity>
      );
    },
    [compact, showActions, onItemPress, onItemAction, getStockStatus, getStatusColor, getStatusLabel]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: GroupedItems }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length} items</Text>
      </View>
    ),
    []
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Feather name="package" size={48} color="#d1d5db" />
        <Text style={styles.emptyTitle}>{emptyMessage}</Text>
        {filterLowStock && (
          <Text style={styles.emptySubtitle}>
            No hay productos con stock bajo
          </Text>
        )}
      </View>
    ),
    [emptyMessage, filterLowStock]
  );

  const keyExtractor = useCallback((item: VehicleStock) => item.id, []);

  // Use SectionList if grouped
  if (groupByCategory && groupedData) {
    return (
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#16a34a']}
              tintColor="#16a34a"
            />
          ) : undefined
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <FlatList
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        ) : undefined
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sectionCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  itemCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemCardCompact: {
    paddingVertical: 8,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  itemSku: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 12,
  },
  quantityText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  rangeText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestButton: {
    marginLeft: 'auto',
  },
  actionText: {
    fontSize: 13,
    color: '#6b7280',
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  emptyContainer: {
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
