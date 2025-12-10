/**
 * Usage Form Component
 * ====================
 *
 * Form for recording material usage from vehicle stock during jobs.
 * Supports single and batch material usage with job association.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q, Database } from '@nozbe/watermelondb';

import { database } from '../../watermelon/database';
import { VehicleStock, Job } from '../../watermelon/models';
import BarcodeScanner from './BarcodeScanner';

const vehicleStockCollection = database.get<VehicleStock>('vehicle_stock');
const jobsCollection = database.get<Job>('jobs');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type UsageType = 'JOB' | 'WARRANTY' | 'INTERNAL' | 'LOSS' | 'OTHER';

export interface UsageEntry {
  stockId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  availableQty: number;
  unitCost: number;
}

export interface UsageFormData {
  entries: UsageEntry[];
  usageType: UsageType;
  jobId: string | null;
  notes: string;
}

interface UsageFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: UsageFormData) => Promise<void>;
  stock: VehicleStock[];
  jobs?: Job[];
  preselectedJobId?: string | null;
  preselectedStock?: VehicleStock | null;
}

const USAGE_TYPES: Record<UsageType, { label: string; icon: string; color: string }> = {
  JOB: { label: 'Trabajo', icon: 'briefcase', color: '#16a34a' },
  WARRANTY: { label: 'Garantía', icon: 'shield', color: '#3b82f6' },
  INTERNAL: { label: 'Uso Interno', icon: 'home', color: '#8b5cf6' },
  LOSS: { label: 'Pérdida/Daño', icon: 'alert-triangle', color: '#ef4444' },
  OTHER: { label: 'Otro', icon: 'more-horizontal', color: '#6b7280' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function UsageForm({
  visible,
  onClose,
  onSubmit,
  stock,
  jobs = [],
  preselectedJobId = null,
  preselectedStock = null,
}: UsageFormProps) {
  // Form state
  const [entries, setEntries] = useState<Map<string, UsageEntry>>(new Map());
  const [usageType, setUsageType] = useState<UsageType>('JOB');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(preselectedJobId);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI state
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setEntries(new Map());
      setUsageType('JOB');
      setSelectedJobId(preselectedJobId);
      setNotes('');

      // Pre-select stock if provided
      if (preselectedStock) {
        setEntries(new Map([[preselectedStock.id, {
          stockId: preselectedStock.id,
          productId: preselectedStock.productId,
          productName: preselectedStock.productName,
          productSku: preselectedStock.productSku,
          quantity: 1,
          availableQty: preselectedStock.quantity,
          unitCost: preselectedStock.unitCost,
        }]]));
      }
    }
  }, [visible, preselectedJobId, preselectedStock]);

  // Filter available stock (exclude already selected)
  const availableStock = useMemo(() => {
    let result = stock.filter(s => s.quantity > 0 && !entries.has(s.id));
    if (stockSearch) {
      const query = stockSearch.toLowerCase();
      result = result.filter(
        s => s.productName.toLowerCase().includes(query) ||
             s.productSku.toLowerCase().includes(query)
      );
    }
    return result;
  }, [stock, entries, stockSearch]);

  // Filter active jobs
  const activeJobs = useMemo(() => {
    let result = jobs.filter(j =>
      j.status === 'IN_PROGRESS' || j.status === 'SCHEDULED'
    );
    if (jobSearch) {
      const query = jobSearch.toLowerCase();
      result = result.filter(
        j => j.title?.toLowerCase().includes(query) ||
             j.customerName?.toLowerCase().includes(query) ||
             j.address?.toLowerCase().includes(query)
      );
    }
    return result;
  }, [jobs, jobSearch]);

  const selectedJob = useMemo(() =>
    jobs.find(j => j.id === selectedJobId),
    [jobs, selectedJobId]
  );

  // Add stock to entries
  const addStockEntry = useCallback((item: VehicleStock) => {
    setEntries(prev => {
      const next = new Map(prev);
      next.set(item.id, {
        stockId: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: 1,
        availableQty: item.quantity,
        unitCost: item.unitCost,
      });
      return next;
    });
    setShowStockPicker(false);
    setStockSearch('');
  }, []);

  // Remove entry
  const removeEntry = useCallback((stockId: string) => {
    setEntries(prev => {
      const next = new Map(prev);
      next.delete(stockId);
      return next;
    });
  }, []);

  // Update entry quantity
  const updateQuantity = useCallback((stockId: string, quantity: number) => {
    setEntries(prev => {
      const next = new Map(prev);
      const entry = next.get(stockId);
      if (entry && quantity > 0 && quantity <= entry.availableQty) {
        next.set(stockId, { ...entry, quantity });
      }
      return next;
    });
  }, []);

  // Handle barcode scan
  const handleScan = useCallback((barcode: string) => {
    setShowScanner(false);
    const item = stock.find(s => s.productSku === barcode);
    if (item) {
      if (item.quantity > 0) {
        addStockEntry(item);
      } else {
        Alert.alert('Sin stock', `${item.productName} no tiene stock disponible.`);
      }
    } else {
      Alert.alert('No encontrado', 'No se encontró un producto con ese código.');
    }
  }, [stock, addStockEntry]);

  // Submit form
  const handleSubmit = useCallback(async () => {
    if (entries.size === 0) {
      Alert.alert('Error', 'Debe agregar al menos un material.');
      return;
    }

    if (usageType === 'JOB' && !selectedJobId) {
      Alert.alert('Error', 'Debe seleccionar un trabajo para este tipo de uso.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        entries: Array.from(entries.values()),
        usageType,
        jobId: usageType === 'JOB' ? selectedJobId : null,
        notes: notes.trim(),
      });
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No se pudo registrar el uso.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [entries, usageType, selectedJobId, notes, onSubmit, onClose]);

  // Calculate totals
  const totalQuantity = useMemo(() => {
    let total = 0;
    entries.forEach(e => total += e.quantity);
    return total;
  }, [entries]);

  const totalCost = useMemo(() => {
    let total = 0;
    entries.forEach(e => total += e.quantity * e.unitCost);
    return total;
  }, [entries]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registrar Uso</Text>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanner(true)}
          >
            <Feather name="maximize" size={24} color="#16a34a" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Usage Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de uso</Text>
            <View style={styles.usageTypeGrid}>
              {(Object.keys(USAGE_TYPES) as UsageType[]).map((type) => {
                const config = USAGE_TYPES[type];
                const isSelected = usageType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.usageTypeButton,
                      isSelected && { borderColor: config.color, backgroundColor: `${config.color}10` },
                    ]}
                    onPress={() => setUsageType(type)}
                  >
                    <Feather
                      name={config.icon as any}
                      size={20}
                      color={isSelected ? config.color : '#6b7280'}
                    />
                    <Text
                      style={[
                        styles.usageTypeLabel,
                        isSelected && { color: config.color },
                      ]}
                    >
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Job Selector (only for JOB usage type) */}
          {usageType === 'JOB' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trabajo asociado</Text>
              <TouchableOpacity
                style={styles.jobSelector}
                onPress={() => setShowJobPicker(true)}
              >
                {selectedJob ? (
                  <View style={styles.selectedJob}>
                    <View style={styles.selectedJobInfo}>
                      <Text style={styles.selectedJobTitle} numberOfLines={1}>
                        {selectedJob.title || 'Sin título'}
                      </Text>
                      <Text style={styles.selectedJobMeta} numberOfLines={1}>
                        {selectedJob.customerName} • {selectedJob.address}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedJobId(null)}>
                      <Feather name="x" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.jobPlaceholder}>
                    <Feather name="briefcase" size={20} color="#9ca3af" />
                    <Text style={styles.jobPlaceholderText}>
                      Seleccionar trabajo
                    </Text>
                    <Feather name="chevron-right" size={20} color="#9ca3af" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Materials */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Materiales</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowStockPicker(true)}
              >
                <Feather name="plus" size={18} color="#16a34a" />
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            {entries.size === 0 ? (
              <View style={styles.emptyEntries}>
                <Feather name="package" size={32} color="#d1d5db" />
                <Text style={styles.emptyEntriesText}>
                  No hay materiales agregados
                </Text>
                <Text style={styles.emptyEntriesHint}>
                  Use el botón + o escanee un código
                </Text>
              </View>
            ) : (
              <View style={styles.entriesList}>
                {Array.from(entries.values()).map((entry) => (
                  <View key={entry.stockId} style={styles.entryCard}>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryName} numberOfLines={1}>
                        {entry.productName}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {entry.productSku} • Stock: {entry.availableQty}
                      </Text>
                    </View>
                    <View style={styles.entryControls}>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => updateQuantity(entry.stockId, entry.quantity - 1)}
                          disabled={entry.quantity <= 1}
                        >
                          <Feather
                            name="minus"
                            size={16}
                            color={entry.quantity <= 1 ? '#e5e7eb' : '#374151'}
                          />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.quantityInput}
                          value={String(entry.quantity)}
                          onChangeText={(text) => {
                            const qty = parseInt(text, 10);
                            if (!isNaN(qty)) updateQuantity(entry.stockId, qty);
                          }}
                          keyboardType="number-pad"
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => updateQuantity(entry.stockId, entry.quantity + 1)}
                          disabled={entry.quantity >= entry.availableQty}
                        >
                          <Feather
                            name="plus"
                            size={16}
                            color={entry.quantity >= entry.availableQty ? '#e5e7eb' : '#374151'}
                          />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeEntry(entry.stockId)}
                      >
                        <Feather name="trash-2" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas (opcional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Agregar notas sobre el uso..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Summary */}
          {entries.size > 0 && (
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total materiales:</Text>
                <Text style={styles.summaryValue}>{entries.size}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cantidad total:</Text>
                <Text style={styles.summaryValue}>{totalQuantity} unidades</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Costo estimado:</Text>
                <Text style={styles.summaryValueHighlight}>
                  ${totalCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (entries.size === 0 || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={entries.size === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="check" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Registrar uso</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Stock Picker Modal */}
        <Modal
          visible={showStockPicker}
          animationType="slide"
          onRequestClose={() => setShowStockPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShowStockPicker(false)}>
                <Feather name="arrow-left" size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>Seleccionar material</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar material..."
                value={stockSearch}
                onChangeText={setStockSearch}
                placeholderTextColor="#9ca3af"
                autoFocus
              />
              {stockSearch.length > 0 && (
                <TouchableOpacity onPress={() => setStockSearch('')}>
                  <Feather name="x" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.pickerList}>
              {availableStock.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Feather name="package" size={48} color="#d1d5db" />
                  <Text style={styles.pickerEmptyText}>
                    No hay materiales disponibles
                  </Text>
                </View>
              ) : (
                availableStock.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.pickerItem}
                    onPress={() => addStockEntry(item)}
                  >
                    <View style={styles.pickerItemInfo}>
                      <Text style={styles.pickerItemName}>{item.productName}</Text>
                      <Text style={styles.pickerItemMeta}>
                        {item.productSku} • Stock: {item.quantity}
                      </Text>
                    </View>
                    <Feather name="plus-circle" size={22} color="#16a34a" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Job Picker Modal */}
        <Modal
          visible={showJobPicker}
          animationType="slide"
          onRequestClose={() => setShowJobPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShowJobPicker(false)}>
                <Feather name="arrow-left" size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>Seleccionar trabajo</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar trabajo..."
                value={jobSearch}
                onChangeText={setJobSearch}
                placeholderTextColor="#9ca3af"
                autoFocus
              />
              {jobSearch.length > 0 && (
                <TouchableOpacity onPress={() => setJobSearch('')}>
                  <Feather name="x" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.pickerList}>
              {activeJobs.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Feather name="briefcase" size={48} color="#d1d5db" />
                  <Text style={styles.pickerEmptyText}>
                    No hay trabajos activos
                  </Text>
                </View>
              ) : (
                activeJobs.map((job) => (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setSelectedJobId(job.id);
                      setShowJobPicker(false);
                      setJobSearch('');
                    }}
                  >
                    <View style={styles.pickerItemInfo}>
                      <Text style={styles.pickerItemName}>
                        {job.title || 'Sin título'}
                      </Text>
                      <Text style={styles.pickerItemMeta}>
                        {job.customerName} • {job.address}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Barcode Scanner */}
        <BarcodeScanner
          visible={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleScan}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOC WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

const enhance = withObservables([], () => ({
  stock: vehicleStockCollection.query(Q.sortBy('product_name', Q.asc)),
  jobs: jobsCollection.query(
    Q.or(
      Q.where('status', 'IN_PROGRESS'),
      Q.where('status', 'SCHEDULED')
    ),
    Q.sortBy('scheduled_date', Q.desc)
  ),
}));

export default enhance(UsageForm);

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  scanButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  usageTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  usageTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    gap: 6,
  },
  usageTypeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  jobSelector: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedJob: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0fdf4',
  },
  selectedJobInfo: {
    flex: 1,
    marginRight: 8,
  },
  selectedJobTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  selectedJobMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  jobPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  jobPlaceholderText: {
    flex: 1,
    fontSize: 15,
    color: '#9ca3af',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
  },
  emptyEntries: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  emptyEntriesText: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 8,
  },
  emptyEntriesHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  entriesList: {
    gap: 8,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  entryInfo: {
    flex: 1,
    marginRight: 8,
  },
  entryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  entryMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  entryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quantityButton: {
    padding: 8,
  },
  quantityInput: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
  },
  removeButton: {
    padding: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    backgroundColor: '#fff',
  },
  summary: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  summaryValueHighlight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
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
  // Picker styles
  pickerContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
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
  pickerList: {
    flex: 1,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerItemInfo: {
    flex: 1,
  },
  pickerItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  pickerItemMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  pickerEmpty: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  pickerEmptyText: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 12,
  },
});
