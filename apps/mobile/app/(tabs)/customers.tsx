/**
 * Customers Screen
 * ================
 *
 * Customer list for advanced mode with search and quick actions
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
import { Search, Phone, MapPin, ChevronRight, User } from 'lucide-react-native';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { withObservables } from '@nozbe/watermelondb/react';
import { customersCollection } from '../../watermelon/database';
import { Customer } from '../../watermelon/models';
import * as Linking from 'expo-linking';

function CustomersScreenContent({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.address?.toLowerCase().includes(query)
    );
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Sync would be triggered here
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleNavigate = (address: string) => {
    const encoded = encodeURIComponent(address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  };

  const renderCustomer = ({ item: customer }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => router.push(`/customers/${customer.id}`)}
    >
      <View style={styles.customerAvatar}>
        <Text style={styles.customerAvatarText}>
          {customer.name[0]?.toUpperCase() || '?'}
        </Text>
      </View>

      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{customer.name}</Text>
        {customer.phone && (
          <View style={styles.customerDetail}>
            <Phone size={12} color="#6b7280" />
            <Text style={styles.customerDetailText}>{customer.phone}</Text>
          </View>
        )}
        {customer.address && (
          <View style={styles.customerDetail}>
            <MapPin size={12} color="#6b7280" />
            <Text style={styles.customerDetailText} numberOfLines={1}>
              {customer.address}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.customerActions}>
        {customer.phone && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCall(customer.phone!)}
          >
            <Phone size={18} color="#059669" />
          </TouchableOpacity>
        )}
        {customer.address && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleNavigate(customer.address!)}
          >
            <MapPin size={18} color="#3b82f6" />
          </TouchableOpacity>
        )}
        <ChevronRight size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Clientes</Text>
        <Text style={styles.subtitle}>{customers.length} clientes</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, telefono o direccion..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Customer List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredCustomers}
          renderItem={renderCustomer}
          keyExtractor={(item) => item.id}
          estimatedItemSize={88}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#059669"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <User size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'Sin resultados' : 'No hay clientes'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Proba con otra busqueda'
                  : 'Los clientes se sincronizaran desde el servidor'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </SafeAreaView>
  );
}

// Observe customers from WatermelonDB
const enhance = withObservables([], () => ({
  customers: customersCollection.query(Q.sortBy('name', Q.asc)).observe(),
}));

export default enhance(CustomersScreenContent);

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
  listContainer: {
    flex: 1,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  customerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  customerDetailText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  customerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 76,
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
