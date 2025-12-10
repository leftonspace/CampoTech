/**
 * Search Results Screen
 * =====================
 *
 * Phase 15: Consumer Marketplace
 * Search and filter service providers.
 */

import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  ArrowLeft,
  X,
} from 'lucide-react-native';

import { BusinessCard } from '../../../components/consumer/BusinessCard';
import { useSearchBusinesses } from '../../../lib/consumer/hooks/use-discovery';
import { useConsumerLocation } from '../../../lib/consumer/hooks/use-location';

interface SearchFilters {
  category?: string;
  minRating?: number;
  maxDistance?: number;
  hasEmergency?: boolean;
  verified?: boolean;
  sortBy?: 'rating' | 'distance' | 'response_time' | 'relevance';
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const { location } = useConsumerLocation();

  const [query, setQuery] = useState(params.q || '');
  const [filters, setFilters] = useState<SearchFilters>({
    category: params.category,
    sortBy: 'relevance',
  });
  const [showFilters, setShowFilters] = useState(false);

  const {
    businesses,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useSearchBusinesses(query, filters, location);

  const handleSearch = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
    }
    if (params.category) {
      setFilters(prev => ({ ...prev, category: params.category }));
    }
  }, [params.q, params.category]);

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

  const clearSearch = () => {
    setQuery('');
  };

  const activeFiltersCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== 'relevance'
  ).length;

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

        <View style={styles.searchContainer}>
          <Search size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar servicios..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus={!params.q}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFiltersCount > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilters(true)}
        >
          <SlidersHorizontal size={20} color={activeFiltersCount > 0 ? '#fff' : '#374151'} />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Location indicator */}
      <View style={styles.locationBar}>
        <MapPin size={14} color="#6b7280" />
        <Text style={styles.locationText}>
          Buscando cerca de tu ubicacion
        </Text>
      </View>

      {/* Sort options */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Ordenar por:</Text>
        <View style={styles.sortOptions}>
          {[
            { key: 'relevance', label: 'Relevancia' },
            { key: 'rating', label: 'Valoracion' },
            { key: 'distance', label: 'Distancia' },
          ].map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.sortOption,
                filters.sortBy === option.key && styles.sortOptionActive,
              ]}
              onPress={() => setFilters({ ...filters, sortBy: option.key as any })}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  filters.sortBy === option.key && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
              {businesses.length} resultados encontrados
            </Text>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0284c7" />
              <Text style={styles.loadingText}>Buscando servicios...</Text>
            </View>
          ) : isError ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Error de busqueda</Text>
              <Text style={styles.emptyText}>
                No pudimos completar tu busqueda. Por favor intenta de nuevo.
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Search size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyText}>
                No encontramos servicios que coincidan con tu busqueda.
                Intenta con otros terminos o filtros.
              </Text>
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

      {/* Filter Modal would go here */}
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
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  filterButton: {
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  filterButtonActive: {
    backgroundColor: '#0284c7',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
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
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sortLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginRight: 12,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  sortOptionActive: {
    backgroundColor: '#dbeafe',
  },
  sortOptionText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#0284c7',
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#0284c7',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
