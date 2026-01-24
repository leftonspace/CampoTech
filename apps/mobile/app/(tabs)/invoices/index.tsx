/**
 * Invoices List Screen
 * ====================
 *
 * Phase 9.10: Mobile-First Architecture
 * Invoice list with status filters and quick actions
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import {
  Search,
  Plus,
  FileText,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  DollarSign,
} from 'lucide-react-native';

// Mock data
const MOCK_INVOICES = [
  {
    id: '1',
    number: 'FAC-2024-001',
    customer: 'María López',
    date: '2024-12-09',
    total: 85000,
    status: 'paid',
  },
  {
    id: '2',
    number: 'FAC-2024-002',
    customer: 'Pedro García',
    date: '2024-12-08',
    total: 45000,
    status: 'pending',
  },
  {
    id: '3',
    number: 'FAC-2024-003',
    customer: 'Ana Ruiz',
    date: '2024-12-07',
    total: 120000,
    status: 'sent',
  },
  {
    id: '4',
    number: 'FAC-2024-004',
    customer: 'Carlos Mendez',
    date: '2024-12-05',
    total: 65000,
    status: 'overdue',
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft: { label: 'Borrador', color: '#6b7280', bg: '#f3f4f6', icon: FileText },
  pending: { label: 'Pendiente', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
  sent: { label: 'Enviada', color: '#3b82f6', bg: '#dbeafe', icon: Send },
  paid: { label: 'Pagada', color: '#059669', bg: '#d1fae5', icon: CheckCircle },
  overdue: { label: 'Vencida', color: '#ef4444', bg: '#fee2e2', icon: XCircle },
};

interface Invoice {
  id: string;
  number: string;
  customer: string;
  date: string;
  total: number;
  status: string;
}

export default function InvoicesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [invoices] = useState<Invoice[]>(MOCK_INVOICES);

  const filteredInvoices = invoices.filter((invoice) => {
    if (selectedStatus && invoice.status !== selectedStatus) {
      return false;
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.number.toLowerCase().includes(query) ||
      invoice.customer.toLowerCase().includes(query)
    );
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const renderInvoice = ({ item: invoice }: { item: Invoice }) => {
    const status = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
    const StatusIcon = status.icon;

    return (
      <TouchableOpacity
        style={styles.invoiceCard}
        onPress={() => router.push(`/invoices/${invoice.id}` as any)}
      >
        <View style={[styles.statusIndicator, { backgroundColor: status.color }]} />

        <View style={styles.invoiceContent}>
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <StatusIcon size={12} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>

          <Text style={styles.customerName}>{invoice.customer}</Text>

          <View style={styles.invoiceFooter}>
            <Text style={styles.invoiceDate}>{formatDate(invoice.date)}</Text>
            <Text style={styles.invoiceTotal}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        <ChevronRight size={20} color="#9ca3af" />
      </TouchableOpacity>
    );
  };

  const statusFilters = ['pending', 'sent', 'paid', 'overdue'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Facturas</Text>
            <Text style={styles.subtitle}>{invoices.length} facturas</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/invoices/create' as any)}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.addButtonText}>Nueva</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por número o cliente..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            !selectedStatus && styles.filterChipActive,
          ]}
          onPress={() => setSelectedStatus(null)}
        >
          <Text
            style={[
              styles.filterChipText,
              !selectedStatus && styles.filterChipTextActive,
            ]}
          >
            Todas
          </Text>
        </TouchableOpacity>

        {statusFilters.map((status) => {
          const config = STATUS_CONFIG[status];
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                selectedStatus === status && styles.filterChipActive,
              ]}
              onPress={() =>
                setSelectedStatus(selectedStatus === status ? null : status)
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedStatus === status && styles.filterChipTextActive,
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Invoice List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredInvoices}
          renderItem={renderInvoice}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#059669"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FileText size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {searchQuery || selectedStatus ? 'Sin resultados' : 'Sin facturas'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || selectedStatus
                  ? 'Probá con otros filtros'
                  : 'Creá tu primera factura'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  invoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  statusIndicator: {
    width: 4,
    height: '100%',
    marginRight: 16,
  },
  invoiceContent: {
    flex: 1,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  invoiceDate: {
    fontSize: 13,
    color: '#9ca3af',
  },
  invoiceTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
