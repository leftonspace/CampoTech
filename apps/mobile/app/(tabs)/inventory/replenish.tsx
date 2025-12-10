/**
 * Replenishment Request Screen
 * ============================
 *
 * Allows technicians to request stock replenishment.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';

import { database } from '../../../watermelon/database';
import { VehicleStock, ReplenishmentRequest } from '../../../watermelon/models';

const vehicleStockCollection = database.get<VehicleStock>('vehicle_stock');
const replenishmentCollection = database.get<ReplenishmentRequest>('replenishment_requests');

interface RequestItem {
  productId: string;
  productName: string;
  currentQty: number;
  requestedQty: number;
}

function ReplenishScreen({ stock }: { stock: VehicleStock[] }) {
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Items that need replenishment
  const lowStockItems = useMemo(() => {
    return stock.filter((item) => item.needsReplenishment || item.quantity <= item.minQuantity);
  }, [stock]);

  const toggleItem = useCallback((item: VehicleStock) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(item.productId)) {
        next.delete(item.productId);
      } else {
        // Default request quantity is max - current
        const requestQty = Math.max(item.maxQuantity - item.quantity, 1);
        next.set(item.productId, requestQty);
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (qty > 0) {
        next.set(productId, qty);
      } else {
        next.delete(productId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selectedItems.size === 0) {
      Alert.alert('Error', 'Selecciona al menos un producto');
      return;
    }

    setIsSubmitting(true);

    try {
      const items: RequestItem[] = [];
      selectedItems.forEach((requestedQty, productId) => {
        const stockItem = stock.find((s) => s.productId === productId);
        if (stockItem) {
          items.push({
            productId,
            productName: stockItem.productName,
            currentQty: stockItem.quantity,
            requestedQty,
          });
        }
      });

      // Create local replenishment request
      await database.write(async () => {
        await replenishmentCollection.create((request) => {
          request.vehicleId = stock[0]?.vehicleId || '';
          request.status = 'pending';
          request.priority = priority;
          request._raw.items = JSON.stringify(items);
          request.notes = notes || null;
          request.isSynced = false;
        });
      });

      Alert.alert(
        'Solicitud enviada',
        'Tu solicitud de reposición ha sido registrada',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error creating replenishment request:', error);
      Alert.alert('Error', 'No se pudo crear la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedItems, stock, priority, notes, router]);

  const PrioritySelector = () => (
    <View style={styles.priorityContainer}>
      <Text style={styles.sectionLabel}>Prioridad</Text>
      <View style={styles.priorityButtons}>
        {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.priorityButton,
              priority === p && styles.priorityButtonActive,
              priority === p && { backgroundColor: PRIORITY_COLORS[p] },
            ]}
            onPress={() => setPriority(p)}
          >
            <Text
              style={[
                styles.priorityButtonText,
                priority === p && styles.priorityButtonTextActive,
              ]}
            >
              {PRIORITY_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Priority selector */}
        <PrioritySelector />

        {/* Products section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Productos con stock bajo</Text>
            <Text style={styles.sectionCount}>
              {selectedItems.size} seleccionados
            </Text>
          </View>

          {lowStockItems.length === 0 ? (
            <View style={styles.emptySection}>
              <Feather name="check-circle" size={32} color="#16a34a" />
              <Text style={styles.emptyText}>
                Todos los productos tienen stock suficiente
              </Text>
            </View>
          ) : (
            lowStockItems.map((item) => {
              const isSelected = selectedItems.has(item.productId);
              const requestQty = selectedItems.get(item.productId) || 0;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                  onPress={() => toggleItem(item)}
                >
                  <View style={styles.itemCheckbox}>
                    {isSelected ? (
                      <Feather name="check-square" size={24} color="#16a34a" />
                    ) : (
                      <Feather name="square" size={24} color="#d1d5db" />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemMeta}>
                      {item.productSku} • Actual: {item.quantity} • Min: {item.minQuantity}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.quantityInput}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.productId, requestQty - 1)}
                      >
                        <Feather name="minus" size={16} color="#6b7280" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.quantityValue}
                        value={String(requestQty)}
                        onChangeText={(text) => {
                          const num = parseInt(text, 10);
                          if (!isNaN(num)) updateQuantity(item.productId, num);
                        }}
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.productId, requestQty + 1)}
                      >
                        <Feather name="plus" size={16} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Notes section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notas (opcional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Agregar notas..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </ScrollView>

      {/* Submit button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (selectedItems.size === 0 || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={selectedItems.size === 0 || isSubmitting}
        >
          <Feather name="send" size={20} color="#fff" />
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Enviando...' : 'Enviar solicitud'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#16a34a',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

// Observe vehicle stock from WatermelonDB
const enhance = withObservables([], () => ({
  stock: vehicleStockCollection.query(Q.sortBy('product_name', Q.asc)),
}));

export default enhance(ReplenishScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionCount: {
    fontSize: 13,
    color: '#6b7280',
  },
  priorityContainer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
  },
  priorityButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  priorityButtonActive: {
    borderColor: 'transparent',
  },
  priorityButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  priorityButtonTextActive: {
    color: '#fff',
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemCardSelected: {
    backgroundColor: '#f0fdf4',
  },
  itemCheckbox: {
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  itemMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  quantityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quantityButton: {
    padding: 8,
  },
  quantityValue: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  notesInput: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
