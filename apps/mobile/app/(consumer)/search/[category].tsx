/**
 * Category Search Screen
 * ======================
 *
 * Phase 15: Consumer Marketplace
 * Browse businesses by service category.
 */

import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  SlidersHorizontal,
  MapPin,
} from 'lucide-react-native';

import { BusinessCard } from '../../../components/consumer/BusinessCard';
import { useSearchBusinesses } from '../../../lib/consumer/hooks/use-discovery';
import { useConsumerLocation } from '../../../lib/consumer/hooks/use-location';
import { CATEGORIES, getCategoryInfo } from '../../../lib/consumer/constants';

export default function CategorySearchScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const { location } = useConsumerLocation();

  const categoryInfo = getCategoryInfo(category);

  const {
    businesses,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSearchBusinesses('', { category }, location);

  const handleBusinessPress = (businessId: string) => {
    router.push({
      pathname: '/(consumer)/business/[id]',
      params: { id: businessId },
    });
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.categoryIcon}>{categoryInfo?.icon || '🔧'}</Text>
          <Text style={styles.headerTitle}>{categoryInfo?.name || category}</Text>
        </View>

        <TouchableOpacity style={styles.filterButton}>
          <SlidersHorizontal size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Location */}
      <View style={styles.locationBar}>
        <MapPin size={14} color="#6b7280" />
        <Text style={styles.locationText}>Cerca de tu ubicacion</Text>
      </View>

      {/* Results */}
      <FlatList
        data={businesses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BusinessCard
            business={item}
            onPress={() => handleBusinessPress(item.id)}
            showDistance
          />
        )}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          businesses && businesses.length > 0 ? (
            <Text style={styles.resultsCount}>
              {businesses.length} profesionales de {categoryInfo?.name?.toLowerCase() || category}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0284c7" />
              <Text style={styles.loadingText}>Buscando profesionales...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>{categoryInfo?.icon || '🔍'}</Text>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyText}>
                No encontramos profesionales de {categoryInfo?.name?.toLowerCase() || category} cerca tuyo.
              </Text>
              <TouchableOpacity
                style={styles.requestButton}
                onPress={() => router.push({
                  pathname: '/(consumer)/request/new',
                  params: { category },
                })}
              >
                <Text style={styles.requestButtonText}>Publicar solicitud</Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color="#0284c7" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  categoryIcon: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  filterButton: {
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: '#6b7280',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  resultsCount: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  requestButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0284c7',
    borderRadius: 10,
  },
  requestButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
