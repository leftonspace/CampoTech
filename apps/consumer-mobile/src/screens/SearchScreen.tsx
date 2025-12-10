/**
 * Search Screen
 * =============
 *
 * Business search with filters.
 * Phase 15: Consumer Marketplace
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { consumerApi } from '../services/api-client';
import { useLocation } from '../hooks/useLocation';
import { debounce } from '../utils/helpers';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SearchResult {
  id: string;
  displayName: string;
  slug: string;
  logoUrl?: string;
  shortDescription?: string;
  categories: string[];
  overallRating: number;
  ratingCount: number;
  badges: string[];
  acceptsEmergency: boolean;
  avgResponseTimeHours?: number;
  distance?: number;
  matchScore?: number;
}

interface Filters {
  category?: string;
  minRating?: number;
  verified?: boolean;
  emergency?: boolean;
  sortBy: 'rating' | 'distance' | 'response_time' | 'relevance';
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { location, city } = useLocation();

  const [query, setQuery] = useState(route.params?.query || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    category: route.params?.category,
    sortBy: route.params?.sortBy || 'relevance',
  });

  useEffect(() => {
    performSearch(true);
  }, [filters, city]);

  const debouncedSearch = useCallback(
    debounce(() => performSearch(true), 300),
    [filters, city, location]
  );

  useEffect(() => {
    if (query) {
      debouncedSearch();
    }
  }, [query]);

  const performSearch = async (reset: boolean = false) => {
    if (loading && !reset) return;

    setLoading(true);
    const currentPage = reset ? 1 : page;

    try {
      const response = await consumerApi.discover.search({
        q: query || undefined,
        category: filters.category,
        lat: location?.latitude,
        lng: location?.longitude,
        city,
        minRating: filters.minRating,
        verified: filters.verified,
        emergency: filters.emergency,
        sortBy: filters.sortBy,
        page: currentPage,
        limit: 20,
      });

      if (response.success && response.data) {
        if (reset) {
          setResults(response.data);
          setPage(2);
        } else {
          setResults(prev => [...prev, ...response.data!]);
          setPage(currentPage + 1);
        }
        setHasMore(response.data.length === 20);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessPress = (business: SearchResult) => {
    navigation.navigate('BusinessProfile', { id: business.id });
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      performSearch(false);
    }
  };

  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ sortBy: 'relevance' });
  };

  const activeFilterCount = Object.values(filters).filter(
    v => v !== undefined && v !== 'relevance'
  ).length;

  const renderItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => handleBusinessPress(item)}
    >
      <View style={styles.resultRow}>
        {item.logoUrl ? (
          <Image source={{ uri: item.logoUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.placeholderLogo]}>
            <Text style={styles.placeholderText}>
              {item.displayName.charAt(0)}
            </Text>
          </View>
        )}
        <View style={styles.resultInfo}>
          <Text style={styles.resultName} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={styles.resultCategory} numberOfLines={1}>
            {item.categories.join(' • ')}
          </Text>
          <View style={styles.resultMeta}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={styles.rating}>
                {item.overallRating.toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>({item.ratingCount})</Text>
            </View>
            {item.distance !== undefined && (
              <Text style={styles.distance}>
                {item.distance < 1
                  ? `${Math.round(item.distance * 1000)}m`
                  : `${item.distance.toFixed(1)}km`}
              </Text>
            )}
          </View>
          <View style={styles.badgesRow}>
            {item.badges.slice(0, 3).map(badge => (
              <View key={badge} style={styles.badge}>
                <Text style={styles.badgeText}>{getBadgeLabel(badge)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      {item.shortDescription && (
        <Text style={styles.description} numberOfLines={2}>
          {item.shortDescription}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>
        {query ? 'Sin resultados' : 'Buscar servicios'}
      </Text>
      <Text style={styles.emptyText}>
        {query
          ? 'Intentá con otros términos o ajustá los filtros'
          : 'Escribí lo que necesitás o elegí una categoría'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="¿Qué servicio necesitás?"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoFocus={!route.params?.category}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilterCount > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons
            name="options-outline"
            size={24}
            color={activeFilterCount > 0 ? '#2563EB' : '#666'}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      <View style={styles.sortBar}>
        <ScrollableSortOptions
          value={filters.sortBy}
          onChange={value => updateFilter('sortBy', value)}
        />
      </View>

      {/* Results */}
      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator style={styles.loader} color="#2563EB" />
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={newFilters => {
          setFilters(newFilters);
          setShowFilters(false);
        }}
        onClear={clearFilters}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ScrollableSortOptions({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: any) => void;
}) {
  const options = [
    { id: 'relevance', label: 'Relevancia' },
    { id: 'rating', label: 'Mejor calificados' },
    { id: 'distance', label: 'Más cercanos' },
    { id: 'response_time', label: 'Respuesta rápida' },
  ];

  return (
    <FlatList
      horizontal
      data={options}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.sortOption,
            value === item.id && styles.sortOptionActive,
          ]}
          onPress={() => onChange(item.id)}
        >
          <Text
            style={[
              styles.sortOptionText,
              value === item.id && styles.sortOptionTextActive,
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      )}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.sortOptions}
    />
  );
}

function FilterModal({
  visible,
  onClose,
  filters,
  onApply,
  onClear,
}: {
  visible: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (filters: Filters) => void;
  onClear: () => void;
}) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [visible]);

  const categories = [
    { id: 'plumbing', name: 'Plomería' },
    { id: 'electrical', name: 'Electricidad' },
    { id: 'cleaning', name: 'Limpieza' },
    { id: 'painting', name: 'Pintura' },
    { id: 'hvac', name: 'Aire acondicionado' },
    { id: 'gardening', name: 'Jardinería' },
    { id: 'moving', name: 'Mudanzas' },
    { id: 'carpentry', name: 'Carpintería' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Categoría</Text>
            <View style={styles.filterOptions}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    localFilters.category === cat.id && styles.filterChipActive,
                  ]}
                  onPress={() =>
                    setLocalFilters(prev => ({
                      ...prev,
                      category: prev.category === cat.id ? undefined : cat.id,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      localFilters.category === cat.id &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Calificación mínima</Text>
            <View style={styles.filterOptions}>
              {[4.5, 4.0, 3.5, 3.0].map(rating => (
                <TouchableOpacity
                  key={rating}
                  style={[
                    styles.filterChip,
                    localFilters.minRating === rating && styles.filterChipActive,
                  ]}
                  onPress={() =>
                    setLocalFilters(prev => ({
                      ...prev,
                      minRating: prev.minRating === rating ? undefined : rating,
                    }))
                  }
                >
                  <Ionicons
                    name="star"
                    size={14}
                    color={
                      localFilters.minRating === rating ? '#FFF' : '#FFB800'
                    }
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      localFilters.minRating === rating &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {rating}+
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() =>
                setLocalFilters(prev => ({
                  ...prev,
                  verified: !prev.verified,
                }))
              }
            >
              <Text style={styles.filterToggleLabel}>Solo verificados</Text>
              <View
                style={[
                  styles.toggle,
                  localFilters.verified && styles.toggleActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    localFilters.verified && styles.toggleKnobActive,
                  ]}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() =>
                setLocalFilters(prev => ({
                  ...prev,
                  emergency: !prev.emergency,
                }))
              }
            >
              <Text style={styles.filterToggleLabel}>
                Disponible para emergencias
              </Text>
              <View
                style={[
                  styles.toggle,
                  localFilters.emergency && styles.toggleActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    localFilters.emergency && styles.toggleKnobActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                onClear();
                onClose();
              }}
            >
              <Text style={styles.clearButtonText}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => onApply(localFilters)}
            >
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getBadgeLabel(badge: string): string {
  const labels: Record<string, string> = {
    verified: 'Verificado',
    top_rated: 'Top',
    fast_responder: 'Rápido',
    experienced: 'Experto',
    emergency_available: '24/7',
    insured: 'Asegurado',
    licensed: 'Habilitado',
  };
  return labels[badge] || badge;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
  },
  backButton: {
    padding: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1A1A1A',
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  sortBar: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  sortOptions: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sortOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  sortOptionActive: {
    backgroundColor: '#2563EB',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#666',
  },
  sortOptionTextActive: {
    color: '#FFF',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  resultCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultRow: {
    flexDirection: 'row',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 12,
  },
  placeholderLogo: {
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2563EB',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  resultCategory: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 13,
    color: '#666',
    marginLeft: 2,
  },
  distance: {
    fontSize: 13,
    color: '#666',
    marginLeft: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  loader: {
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  filterSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  filterToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  filterToggleLabel: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#2563EB',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  toggleKnobActive: {
    marginLeft: 22,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 40,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    marginRight: 12,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  applyButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});
