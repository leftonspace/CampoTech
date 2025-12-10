/**
 * Consumer Home Screen
 * ====================
 *
 * Phase 15: Consumer Marketplace
 * Main landing page for consumers with:
 * - Location header
 * - Search bar
 * - Popular categories grid
 * - Top-rated businesses nearby
 * - Active service requests
 */

import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Search,
  ChevronRight,
  Star,
  Clock,
  Bell,
} from 'lucide-react-native';

import { CategoryGrid } from '../../components/consumer/CategoryGrid';
import { BusinessCard } from '../../components/consumer/BusinessCard';
import { ServiceRequestCard } from '../../components/consumer/ServiceRequestCard';
import { useConsumerLocation } from '../../lib/consumer/hooks/use-location';
import { useTopBusinesses } from '../../lib/consumer/hooks/use-discovery';
import { useMyRequests } from '../../lib/consumer/hooks/use-requests';
import { useConsumerAuth } from '../../lib/consumer/hooks/use-consumer-auth';

export default function ConsumerHome() {
  const router = useRouter();
  const { consumer } = useConsumerAuth();
  const { location, neighborhood, city, isLoading: locationLoading } = useConsumerLocation();
  const { businesses, isLoading: businessesLoading, refetch: refetchBusinesses } = useTopBusinesses(location);
  const { requests, isLoading: requestsLoading, refetch: refetchRequests } = useMyRequests({ status: 'open' });

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: '/(consumer)/search',
        params: { q: searchQuery.trim() },
      });
    }
  };

  const handleCategoryPress = (categoryId: string) => {
    router.push({
      pathname: '/(consumer)/search/[category]',
      params: { category: categoryId },
    });
  };

  const handleBusinessPress = (businessId: string) => {
    router.push({
      pathname: '/(consumer)/business/[id]',
      params: { id: businessId },
    });
  };

  const handleRequestPress = (requestId: string) => {
    router.push({
      pathname: '/(consumer)/request/[id]',
      params: { id: requestId },
    });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBusinesses(), refetchRequests()]);
    setRefreshing(false);
  }, [refetchBusinesses, refetchRequests]);

  const openRequests = requests?.filter(r =>
    ['open', 'quotes_received'].includes(r.status)
  ) || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Location Header */}
      <View style={styles.locationHeader}>
        <TouchableOpacity style={styles.locationButton}>
          <MapPin size={18} color="#0284c7" />
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Tu ubicacion</Text>
            <Text style={styles.locationText}>
              {neighborhood ? `${neighborhood}, ${city}` : city || 'Buenos Aires'}
            </Text>
          </View>
          <ChevronRight size={18} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.notificationButton}>
          <Bell size={22} color="#374151" />
          {/* Notification badge would go here */}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0284c7']}
            tintColor="#0284c7"
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Que necesitas?"
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Categories Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categorias populares</Text>
          <CategoryGrid onCategoryPress={handleCategoryPress} />
        </View>

        {/* Active Requests */}
        {openRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Mis solicitudes ({openRequests.length})
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(consumer)/jobs')}
              >
                <Text style={styles.seeAllLink}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            {openRequests.slice(0, 2).map((request) => (
              <ServiceRequestCard
                key={request.id}
                request={request}
                onPress={() => handleRequestPress(request.id)}
              />
            ))}
          </View>
        )}

        {/* Top Rated Businesses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Star size={18} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.sectionTitle}>Mejor valorados cerca tuyo</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(consumer)/search')}
            >
              <Text style={styles.seeAllLink}>Ver mas</Text>
            </TouchableOpacity>
          </View>

          {businessesLoading ? (
            <View style={styles.loadingContainer}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.businessSkeleton} />
              ))}
            </View>
          ) : businesses && businesses.length > 0 ? (
            businesses.slice(0, 5).map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
                onPress={() => handleBusinessPress(business.id)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No encontramos servicios cerca tuyo
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(consumer)/search')}
              >
                <Text style={styles.emptyButtonText}>Buscar en toda la ciudad</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones rapidas</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(consumer)/request/new')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#dbeafe' }]}>
                <Clock size={20} color="#0284c7" />
              </View>
              <Text style={styles.quickActionText}>Servicio urgente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(consumer)/search')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#dcfce7' }]}>
                <Search size={20} color="#16a34a" />
              </View>
              <Text style={styles.quickActionText}>Explorar servicios</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationInfo: {
    marginLeft: 8,
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  locationText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  notificationButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  seeAllLink: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
  },
  loadingContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  businessSkeleton: {
    height: 100,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  emptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0284c7',
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  bottomSpacer: {
    height: 24,
  },
});
