/**
 * Job Materials Selector Component
 * =================================
 *
 * Allows technicians to add materials to a job from their vehicle stock.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';

import { database } from '../../watermelon/database';
import { VehicleStock } from '../../watermelon/models';
import BarcodeScanner from './BarcodeScanner';

const vehicleStockCollection = database.get<VehicleStock>('vehicle_stock');

interface SelectedMaterial {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  availableQty: number;
}

interface JobMaterialsSelectorProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (materials: SelectedMaterial[]) => void;
  stock: VehicleStock[];
}

function JobMaterialsSelector({
  visible,
  onClose,
  onConfirm,
  stock,
}: JobMaterialsSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<Map<string, SelectedMaterial>>(
    new Map()
  );
  const [showScanner, setShowScanner] = useState(false);

  const filteredStock = useMemo(() => {
    if (!search) return stock;
    const query = search.toLowerCase();
    return stock.filter(
      (item) =>
        item.productName.toLowerCase().includes(query) ||
        item.productSku.toLowerCase().includes(query)
    );
  }, [stock, search]);

  const toggleMaterial = useCallback((item: VehicleStock) => {
    setSelectedMaterials((prev) => {
      const next = new Map(prev);
      if (next.has(item.productId)) {
        next.delete(item.productId);
      } else {
        next.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          quantity: 1,
          unitPrice: item.unitCost,
          availableQty: item.quantity,
        });
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setSelectedMaterials((prev) => {
      const next = new Map(prev);
      const material = next.get(productId);
      if (material && quantity > 0 && quantity <= material.availableQty) {
        next.set(productId, { ...material, quantity });
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selectedMaterials.values()));
    setSelectedMaterials(new Map());
    onClose();
  }, [selectedMaterials, onConfirm, onClose]);

  const handleScan = useCallback(
    (barcode: string) => {
      setShowScanner(false);
      // Find product by barcode
      const item = stock.find((s) => s.productSku === barcode);
      if (item) {
        toggleMaterial(item);
      }
    },
    [stock, toggleMaterial]
  );

  const totalItems = selectedMaterials.size;
  const totalAmount = useMemo(() => {
    let total = 0;
    selectedMaterials.forEach((m) => {
      total += m.quantity * m.unitPrice;
    });
    return total;
  }, [selectedMaterials]);

  const renderItem = ({ item }: { item: VehicleStock }) => {
    const selected = selectedMaterials.get(item.productId);
    const isSelected = !!selected;

    return (
      <TouchableOpacity
        style={[styles.itemCard, isSelected && styles.itemCardSelected]}
        onPress={() => toggleMaterial(item)}
        disabled={item.quantity === 0}
      >
        <View style={styles.itemCheckbox}>
          {isSelected ? (
            <Feather name="check-square" size={22} color="#16a34a" />
          ) : (
            <Feather
              name="square"
              size={22}
              color={item.quantity === 0 ? '#e5e7eb' : '#d1d5db'}
            />
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text
            style={[styles.itemName, item.quantity === 0 && styles.itemDisabled]}
          >
            {item.productName}
          </Text>
          <Text style={styles.itemMeta}>
            {item.productSku} • Stock: {item.quantity}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.productId, selected.quantity - 1)}
              disabled={selected.quantity <= 1}
            >
              <Feather
                name="minus"
                size={16}
                color={selected.quantity <= 1 ? '#e5e7eb' : '#6b7280'}
              />
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{selected.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.productId, selected.quantity + 1)}
              disabled={selected.quantity >= item.quantity}
            >
              <Feather
                name="plus"
                size={16}
                color={selected.quantity >= item.quantity ? '#e5e7eb' : '#6b7280'}
              />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agregar materiales</Text>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanner(true)}
          >
            <Feather name="maximize" size={24} color="#16a34a" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar material..."
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

        {/* List */}
        <FlatList
          data={filteredStock}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Feather name="package" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No hay materiales disponibles</Text>
            </View>
          )}
        />

        {/* Footer */}
        {totalItems > 0 && (
          <View style={styles.footer}>
            <View style={styles.footerInfo}>
              <Text style={styles.footerItems}>{totalItems} materiales</Text>
              <Text style={styles.footerTotal}>
                Total: ${totalAmount.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Feather name="check" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Barcode Scanner */}
        <BarcodeScanner
          visible={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleScan}
        />
      </View>
    </Modal>
  );
}

// HOC wrapper to provide stock data
const enhance = withObservables([], () => ({
  stock: vehicleStockCollection.query(
    Q.where('quantity', Q.gt(0)),
    Q.sortBy('product_name', Q.asc)
  ),
}));

export default enhance(JobMaterialsSelector);

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
  listContent: {
    paddingBottom: 120,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  itemDisabled: {
    color: '#9ca3af',
  },
  itemMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
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
  quantityValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  footerInfo: {
    flex: 1,
  },
  footerItems: {
    fontSize: 13,
    color: '#6b7280',
  },
  footerTotal: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
