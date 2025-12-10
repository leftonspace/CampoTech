/**
 * Material Usage Screen
 * =====================
 *
 * Records material consumption from vehicle stock during jobs.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';

import { database } from '../../../watermelon/database';
import { VehicleStock, Job } from '../../../watermelon/models';
import { performSync } from '../../../lib/sync/sync-engine';
import BarcodeScanner from '../../../components/inventory/BarcodeScanner';

const vehicleStockCollection = database.get<VehicleStock>('vehicle_stock');
const jobCollection = database.get<Job>('jobs');

interface UsageItem {
  stockId: string;
  productId: string;
  productName: string;
  productSku: string;
  availableQty: number;
  usedQty: number;
  unitCost: number;
}

function MaterialUsageScreen({
  stock,
  activeJobs,
}: {
  stock: VehicleStock[];
  activeJobs: Job[];
}) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const preselectedProductId = params.productId as string | undefined;
  const preselectedJobId = params.jobId as string | undefined;

  const [selectedJob, setSelectedJob] = useState<string>(preselectedJobId || '');
  const [usageItems, setUsageItems] = useState<UsageItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [search, setSearch] = useState('');

  // Initialize with preselected product if provided
  useEffect(() => {
    if (preselectedProductId && stock.length > 0) {
      const stockItem = stock.find((s) => s.productId === preselectedProductId);
      if (stockItem && !usageItems.some((u) => u.productId === preselectedProductId)) {
        setUsageItems([
          {
            stockId: stockItem.id,
            productId: stockItem.productId,
            productName: stockItem.productName,
            productSku: stockItem.productSku,
            availableQty: stockItem.quantity,
            usedQty: 1,
            unitCost: stockItem.unitCost,
          },
        ]);
      }
    }
  }, [preselectedProductId, stock]);

  const filteredStock = useMemo(() => {
    if (!search) return stock;
    const query = search.toLowerCase();
    return stock.filter(
      (item) =>
        item.productName.toLowerCase().includes(query) ||
        item.productSku.toLowerCase().includes(query)
    );
  }, [stock, search]);

  const totalCost = useMemo(() => {
    return usageItems.reduce((sum, item) => sum + item.usedQty * item.unitCost, 0);
  }, [usageItems]);

  const addItem = useCallback(
    (stockItem: VehicleStock) => {
      if (usageItems.some((u) => u.productId === stockItem.productId)) {
        // Already added, focus on quantity
        return;
      }

      setUsageItems((prev) => [
        ...prev,
        {
          stockId: stockItem.id,
          productId: stockItem.productId,
          productName: stockItem.productName,
          productSku: stockItem.productSku,
          availableQty: stockItem.quantity,
          usedQty: 1,
          unitCost: stockItem.unitCost,
        },
      ]);
    },
    [usageItems]
  );

  const updateQuantity = useCallback((productId: string, qty: number) => {
    setUsageItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, usedQty: Math.max(0, Math.min(qty, item.availableQty)) }
          : item
      )
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setUsageItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const handleScan = useCallback(
    async (barcode: string) => {
      setScannerVisible(false);

      // Find product in vehicle stock by SKU or searching
      const stockItem = stock.find(
        (s) => s.productSku === barcode || s.productId === barcode
      );

      if (!stockItem) {
        Alert.alert('No encontrado', 'Este producto no está en tu vehículo');
        return;
      }

      if (stockItem.quantity <= 0) {
        Alert.alert('Sin stock', 'No tienes stock disponible de este producto');
        return;
      }

      addItem(stockItem);
    },
    [stock, addItem]
  );

  const handleSubmit = useCallback(async () => {
    if (usageItems.length === 0) {
      Alert.alert('Error', 'Agrega al menos un producto');
      return;
    }

    if (!selectedJob) {
      Alert.alert('Error', 'Selecciona un trabajo');
      return;
    }

    // Validate quantities
    for (const item of usageItems) {
      if (item.usedQty <= 0) {
        Alert.alert('Error', `Cantidad inválida para ${item.productName}`);
        return;
      }
      if (item.usedQty > item.availableQty) {
        Alert.alert(
          'Error',
          `Stock insuficiente para ${item.productName}. Disponible: ${item.availableQty}`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Update local vehicle stock
      await database.write(async () => {
        for (const item of usageItems) {
          const stockRecord = await vehicleStockCollection.find(item.stockId);
          await stockRecord.update((record) => {
            record.quantity = record.quantity - item.usedQty;
            record.needsReplenishment = record.quantity <= record.minQuantity;
          });
        }
      });

      // Create sync queue entry for server sync
      // The sync engine will pick this up and send to server
      await database.write(async () => {
        const syncQueue = database.get('sync_queue');
        await syncQueue.create((entry: any) => {
          entry.entityType = 'material_usage';
          entry.entityId = `usage_${Date.now()}`;
          entry.action = 'create';
          entry._raw.payload = JSON.stringify({
            jobId: selectedJob,
            items: usageItems.map((item) => ({
              productId: item.productId,
              quantity: item.usedQty,
              unitCost: item.unitCost,
            })),
            notes: notes || undefined,
            usedAt: new Date().toISOString(),
          });
          entry.attempts = 0;
          entry.isSynced = false;
        });
      });

      Alert.alert(
        'Uso registrado',
        'El consumo de materiales ha sido registrado correctamente',
        [{ text: 'OK', onPress: () => router.back() }]
      );

      // Trigger sync in background
      performSync().catch(console.error);
    } catch (error) {
      console.error('Error recording usage:', error);
      Alert.alert('Error', 'No se pudo registrar el uso');
    } finally {
      setIsSubmitting(false);
    }
  }, [usageItems, selectedJob, notes, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Job selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Trabajo *</Text>
          <View style={styles.jobSelector}>
            {activeJobs.length === 0 ? (
              <View style={styles.noJobs}>
                <Feather name="alert-circle" size={20} color="#f59e0b" />
                <Text style={styles.noJobsText}>No hay trabajos activos</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.jobList}
              >
                {activeJobs.map((job) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.jobCard,
                      selectedJob === job.serverId && styles.jobCardSelected,
                    ]}
                    onPress={() => setSelectedJob(job.serverId)}
                  >
                    <Text
                      style={[
                        styles.jobNumber,
                        selectedJob === job.serverId && styles.jobNumberSelected,
                      ]}
                    >
                      {job.jobNumber}
                    </Text>
                    <Text
                      style={[
                        styles.jobCustomer,
                        selectedJob === job.serverId && styles.jobCustomerSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {job.customerName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* Add products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Materiales usados *</Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setScannerVisible(true)}
            >
              <Feather name="camera" size={16} color="#16a34a" />
              <Text style={styles.scanButtonText}>Escanear</Text>
            </TouchableOpacity>
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

          {/* Stock list */}
          <View style={styles.stockList}>
            {filteredStock.map((item) => {
              const isAdded = usageItems.some((u) => u.productId === item.productId);
              const usageItem = usageItems.find((u) => u.productId === item.productId);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.stockItem, isAdded && styles.stockItemSelected]}
                  onPress={() => (isAdded ? removeItem(item.productId) : addItem(item))}
                  disabled={item.quantity <= 0}
                >
                  <View style={styles.stockItemInfo}>
                    <Text
                      style={[
                        styles.stockItemName,
                        item.quantity <= 0 && styles.stockItemNameDisabled,
                      ]}
                    >
                      {item.productName}
                    </Text>
                    <Text style={styles.stockItemSku}>
                      {item.productSku} • Disponible: {item.quantity}
                    </Text>
                  </View>

                  {isAdded ? (
                    <View style={styles.quantityControl}>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() =>
                          updateQuantity(item.productId, (usageItem?.usedQty || 1) - 1)
                        }
                      >
                        <Feather name="minus" size={16} color="#6b7280" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.qtyInput}
                        value={String(usageItem?.usedQty || 0)}
                        onChangeText={(text) => {
                          const num = parseInt(text, 10);
                          if (!isNaN(num)) updateQuantity(item.productId, num);
                        }}
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() =>
                          updateQuantity(item.productId, (usageItem?.usedQty || 1) + 1)
                        }
                      >
                        <Feather name="plus" size={16} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ) : item.quantity > 0 ? (
                    <Feather name="plus-circle" size={24} color="#16a34a" />
                  ) : (
                    <Text style={styles.outOfStock}>Agotado</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notas (opcional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Agregar notas sobre el uso..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Summary */}
        {usageItems.length > 0 && (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Productos:</Text>
              <Text style={styles.summaryValue}>{usageItems.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cantidad total:</Text>
              <Text style={styles.summaryValue}>
                {usageItems.reduce((sum, i) => sum + i.usedQty, 0)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Costo total:</Text>
              <Text style={styles.summaryValueBold}>
                ${totalCost.toLocaleString()}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Submit button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (usageItems.length === 0 || !selectedJob || isSubmitting) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={usageItems.length === 0 || !selectedJob || isSubmitting}
        >
          <Feather name="check" size={20} color="#fff" />
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Guardando...' : 'Registrar uso'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Observe data from WatermelonDB
const enhance = withObservables([], () => ({
  stock: vehicleStockCollection.query(
    Q.where('quantity', Q.gt(0)),
    Q.sortBy('product_name', Q.asc)
  ),
  activeJobs: jobCollection.query(
    Q.where('status', Q.oneOf(['scheduled', 'in_progress'])),
    Q.sortBy('scheduled_date', Q.desc)
  ),
}));

export default enhance(MaterialUsageScreen);

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
  jobSelector: {
    paddingHorizontal: 16,
  },
  noJobs: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    gap: 8,
  },
  noJobsText: {
    fontSize: 14,
    color: '#92400e',
  },
  jobList: {
    gap: 12,
  },
  jobCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minWidth: 140,
  },
  jobCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  jobNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  jobNumberSelected: {
    color: '#16a34a',
  },
  jobCustomer: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  jobCustomerSelected: {
    color: '#16a34a',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#16a34a',
    marginRight: 16,
  },
  scanButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#16a34a',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 15,
    color: '#111827',
  },
  stockList: {
    marginHorizontal: 16,
  },
  stockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  stockItemSelected: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  stockItemInfo: {
    flex: 1,
  },
  stockItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  stockItemNameDisabled: {
    color: '#9ca3af',
  },
  stockItemSku: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  outOfStock: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  qtyButton: {
    padding: 8,
  },
  qtyInput: {
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
  summary: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  summaryLabelBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
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
