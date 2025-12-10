/**
 * Inventory Scan Screen
 * =====================
 *
 * Barcode scanning for quick product lookup and stock management.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';

import { database } from '../../../watermelon/database';
import { Product, VehicleStock } from '../../../watermelon/models';
import BarcodeScanner from '../../../components/inventory/BarcodeScanner';

const productCollection = database.get<Product>('products');
const vehicleStockCollection = database.get<VehicleStock>('vehicle_stock');

interface ScannedProduct {
  product: Product;
  stockInfo: VehicleStock | null;
}

export default function InventoryScanScreen() {
  const router = useRouter();
  const [scannerVisible, setScannerVisible] = useState(true);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [recentScans, setRecentScans] = useState<ScannedProduct[]>([]);

  const handleScan = useCallback(async (barcode: string, type: string) => {
    setScannerVisible(false);
    setIsSearching(true);

    try {
      // Search by barcode first
      let products = await productCollection
        .query(Q.where('barcode', barcode))
        .fetch();

      // If not found, try SKU
      if (products.length === 0) {
        products = await productCollection
          .query(Q.where('sku', barcode))
          .fetch();
      }

      if (products.length === 0) {
        Alert.alert(
          'Producto no encontrado',
          `No se encontró ningún producto con el código: ${barcode}`,
          [
            { text: 'Escanear otro', onPress: () => setScannerVisible(true) },
            { text: 'Cerrar', style: 'cancel' },
          ]
        );
        setScannedProduct(null);
        return;
      }

      const product = products[0];

      // Get vehicle stock info for this product
      const stockResults = await vehicleStockCollection
        .query(Q.where('product_id', product.serverId))
        .fetch();
      const stockInfo = stockResults.length > 0 ? stockResults[0] : null;

      const scanned: ScannedProduct = { product, stockInfo };
      setScannedProduct(scanned);

      // Add to recent scans (keep last 5)
      setRecentScans((prev) => {
        const filtered = prev.filter((s) => s.product.id !== product.id);
        return [scanned, ...filtered].slice(0, 5);
      });
    } catch (error) {
      console.error('Error searching product:', error);
      Alert.alert('Error', 'No se pudo buscar el producto');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleManualSearch = useCallback(() => {
    if (manualBarcode.trim()) {
      handleScan(manualBarcode.trim(), 'manual');
      setManualBarcode('');
    }
  }, [manualBarcode, handleScan]);

  const handleRecordUsage = useCallback(
    (product: ScannedProduct) => {
      router.push({
        pathname: '/(tabs)/inventory/usage',
        params: { productId: product.product.serverId },
      });
    },
    [router]
  );

  const renderProductCard = (scanned: ScannedProduct, isMain: boolean = false) => {
    const { product, stockInfo } = scanned;
    const hasStock = stockInfo && stockInfo.quantity > 0;
    const isLowStock = stockInfo && stockInfo.quantity <= stockInfo.minQuantity;

    return (
      <View
        key={product.id}
        style={[styles.productCard, isMain && styles.productCardMain]}
      >
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productSku}>SKU: {product.sku}</Text>
            {product.barcode && (
              <Text style={styles.productBarcode}>
                <Feather name="bar-chart-2" size={12} /> {product.barcode}
              </Text>
            )}
          </View>
          {stockInfo ? (
            <View
              style={[
                styles.stockBadge,
                isLowStock ? styles.stockBadgeLow : styles.stockBadgeOk,
              ]}
            >
              <Text
                style={[
                  styles.stockBadgeText,
                  isLowStock ? styles.stockBadgeLowText : styles.stockBadgeOkText,
                ]}
              >
                {stockInfo.quantity} en vehículo
              </Text>
            </View>
          ) : (
            <View style={styles.stockBadgeNone}>
              <Text style={styles.stockBadgeNoneText}>Sin stock</Text>
            </View>
          )}
        </View>

        {/* Stock details */}
        {stockInfo && (
          <View style={styles.stockDetails}>
            <View style={styles.stockDetailItem}>
              <Text style={styles.stockDetailLabel}>Mínimo</Text>
              <Text style={styles.stockDetailValue}>{stockInfo.minQuantity}</Text>
            </View>
            <View style={styles.stockDetailItem}>
              <Text style={styles.stockDetailLabel}>Máximo</Text>
              <Text style={styles.stockDetailValue}>{stockInfo.maxQuantity}</Text>
            </View>
            <View style={styles.stockDetailItem}>
              <Text style={styles.stockDetailLabel}>Costo unit.</Text>
              <Text style={styles.stockDetailValue}>
                ${stockInfo.unitCost.toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Product details */}
        <View style={styles.productDetails}>
          {product.categoryName && (
            <View style={styles.detailRow}>
              <Feather name="folder" size={14} color="#6b7280" />
              <Text style={styles.detailText}>{product.categoryName}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Feather name="package" size={14} color="#6b7280" />
            <Text style={styles.detailText}>{product.unitOfMeasure}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="dollar-sign" size={14} color="#6b7280" />
            <Text style={styles.detailText}>
              Venta: ${product.salePrice.toLocaleString()} | Costo: ${product.costPrice.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Actions */}
        {isMain && (
          <View style={styles.productActions}>
            {hasStock && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleRecordUsage(scanned)}
              >
                <Feather name="minus-circle" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Registrar uso</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => setScannerVisible(true)}
            >
              <Feather name="camera" size={18} color="#16a34a" />
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                Escanear otro
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => {
          setScannerVisible(false);
          if (!scannedProduct) {
            router.back();
          }
        }}
        onScan={handleScan}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Manual search */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Búsqueda manual</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Código de barras o SKU..."
              value={manualBarcode}
              onChangeText={setManualBarcode}
              onSubmitEditing={handleManualSearch}
              returnKeyType="search"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleManualSearch}
            >
              <Feather name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading state */}
        {isSearching && (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Buscando producto...</Text>
          </View>
        )}

        {/* Scanned product */}
        {scannedProduct && !isSearching && (
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>Producto encontrado</Text>
            {renderProductCard(scannedProduct, true)}
          </View>
        )}

        {/* Recent scans */}
        {recentScans.length > 1 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Escaneos recientes</Text>
            {recentScans.slice(1).map((scan) => (
              <TouchableOpacity
                key={scan.product.id}
                onPress={() => setScannedProduct(scan)}
              >
                {renderProductCard(scan)}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {!scannedProduct && !isSearching && recentScans.length === 0 && (
          <View style={styles.empty}>
            <Feather name="camera" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Escanea un código</Text>
            <Text style={styles.emptyText}>
              Usa la cámara o ingresa el código manualmente
            </Text>
            <TouchableOpacity
              style={styles.openScannerButton}
              onPress={() => setScannerVisible(true)}
            >
              <Feather name="camera" size={20} color="#fff" />
              <Text style={styles.openScannerButtonText}>Abrir escáner</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Floating scan button */}
      {!scannerVisible && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setScannerVisible(true)}
        >
          <Feather name="camera" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

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
  searchSection: {
    backgroundColor: '#fff',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#6b7280',
  },
  resultSection: {
    padding: 16,
  },
  recentSection: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productCardMain: {
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 13,
    color: '#6b7280',
  },
  productBarcode: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockBadgeOk: {
    backgroundColor: '#dcfce7',
  },
  stockBadgeLow: {
    backgroundColor: '#fef2f2',
  },
  stockBadgeNone: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockBadgeOkText: {
    color: '#16a34a',
  },
  stockBadgeLowText: {
    color: '#ef4444',
  },
  stockBadgeNoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  stockDetails: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  stockDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  stockDetailLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  stockDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  productDetails: {
    gap: 6,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  productActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextSecondary: {
    color: '#16a34a',
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
  openScannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  openScannerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
