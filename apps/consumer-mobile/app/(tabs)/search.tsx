/**
 * Search Screen - Consumer App
 * ============================
 *
 * Phase 3.2.2: Search Functionality
 * - Text search with autocomplete
 * - Voice search option
 * - Filter by: distance, rating, availability
 * - Sort by: relevance, rating, distance
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import {
  Search,
  Mic,
  X,
  SlidersHorizontal,
  MapPin,
  Star,
  Clock,
  ChevronRight,
  Shield,
  ChevronDown,
  Map,
  List,
  Check,
} from 'lucide-react-native';

// Sort options
const SORT_OPTIONS = [
  { id: 'relevance', label: 'Más relevantes' },
  { id: 'rating', label: 'Mejor valorados' },
  { id: 'distance', label: 'Más cercanos' },
  { id: 'response', label: 'Respuesta rápida' },
];

// Distance filter options
const DISTANCE_OPTIONS = [
  { id: 'any', label: 'Cualquier distancia' },
  { id: '2', label: 'Hasta 2 km' },
  { id: '5', label: 'Hasta 5 km' },
  { id: '10', label: 'Hasta 10 km' },
  { id: '25', label: 'Hasta 25 km' },
];

// Rating filter options
const RATING_OPTIONS = [
  { id: 'any', label: 'Cualquier rating' },
  { id: '4', label: '4+ estrellas' },
  { id: '4.5', label: '4.5+ estrellas' },
];

// Mock search results
const MOCK_RESULTS = [
  {
    id: '1',
    name: 'Plomería García',
    category: 'Plomería',
    rating: 4.9,
    reviews: 127,
    distance: 1.2,
    responseTime: 30,
    verified: true,
    available: true,
    services: ['Destapaciones', 'Pérdidas de agua', 'Instalaciones'],
  },
  {
    id: '2',
    name: 'Servicios de Agua Express',
    category: 'Plomería',
    rating: 4.7,
    reviews: 89,
    distance: 2.4,
    responseTime: 45,
    verified: true,
    available: true,
    services: ['Reparaciones generales', 'Tanques de agua'],
  },
  {
    id: '3',
    name: 'Plomero Don Juan',
    category: 'Plomería',
    rating: 4.5,
    reviews: 54,
    distance: 3.8,
    responseTime: 60,
    verified: false,
    available: false,
    services: ['Destapaciones', 'Cañerías'],
  },
  {
    id: '4',
    name: 'Instalaciones Rápidas',
    category: 'Plomería',
    rating: 4.8,
    reviews: 112,
    distance: 4.2,
    responseTime: 90,
    verified: true,
    available: true,
    services: ['Instalación de calefones', 'Termotanques'],
  },
];

// Autocomplete suggestions
const SUGGESTIONS = [
  'pérdida de agua en el baño',
  'pérdida de agua calefón',
  'pérdida de gas',
  'plomero urgente',
  'plomero 24 horas',
];

interface Provider {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviews: number;
  distance: number;
  responseTime: number;
  verified: boolean;
  available: boolean;
  services: string[];
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState(params.q || '');
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<Provider[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Filters
  const [sortBy, setSortBy] = useState('relevance');
  const [distance, setDistance] = useState('any');
  const [rating, setRating] = useState('any');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [showSortModal, setShowSortModal] = useState(false);

  useEffect(() => {
    if (params.q) {
      performSearch(params.q);
    }
  }, [params.q]);

  const performSearch = useCallback((searchQuery: string) => {
    // In production, call API with filters
    const filtered = MOCK_RESULTS.filter((provider) => {
      if (availableOnly && !provider.available) return false;
      if (rating !== 'any' && provider.rating < parseFloat(rating)) return false;
      if (distance !== 'any' && provider.distance > parseFloat(distance)) return false;
      return true;
    });

    // Sort results
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'distance':
          return a.distance - b.distance;
        case 'response':
          return a.responseTime - b.responseTime;
        default:
          return 0;
      }
    });

    setResults(sorted);
    Keyboard.dismiss();
  }, [sortBy, distance, rating, availableOnly]);

  const handleSearch = () => {
    if (query.trim()) {
      performSearch(query);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setQuery(suggestion);
    performSearch(suggestion);
  };

  const handleProviderPress = (providerId: string) => {
    router.push(`/provider/${providerId}`);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const applyFilters = () => {
    performSearch(query);
    setShowFilters(false);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (distance !== 'any') count++;
    if (rating !== 'any') count++;
    if (availableOnly) count++;
    return count;
  };

  const renderProvider = ({ item }: { item: Provider }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => handleProviderPress(item.id)}
    >
      <View style={styles.resultAvatar}>
        <Text style={styles.resultAvatarText}>{item.name[0]}</Text>
        {item.available && <View style={styles.availableDot} />}
      </View>
      <View style={styles.resultInfo}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultName}>{item.name}</Text>
          {item.verified && <Shield size={14} color="#059669" />}
        </View>
        <Text style={styles.resultCategory}>{item.category}</Text>
        <View style={styles.resultServices}>
          {item.services.slice(0, 2).map((service, idx) => (
            <View key={idx} style={styles.serviceChip}>
              <Text style={styles.serviceChipText}>{service}</Text>
            </View>
          ))}
        </View>
        <View style={styles.resultMeta}>
          <View style={styles.ratingBadge}>
            <Star size={12} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.ratingText}>{item.rating}</Text>
            <Text style={styles.reviewCount}>({item.reviews})</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <MapPin size={12} color="#6b7280" />
            <Text style={styles.metaText}>{item.distance} km</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Clock size={12} color="#6b7280" />
            <Text style={styles.metaText}>
              {item.responseTime < 60
                ? `${item.responseTime} min`
                : `${Math.round(item.responseTime / 60)}h`}
            </Text>
          </View>
        </View>
      </View>
      <ChevronRight size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#9ca3af" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="¿Qué servicio necesitás?"
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus={!params.q}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <X size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.voiceButton}>
            <Mic size={20} color="#059669" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters Bar */}
      {results.length > 0 && (
        <View style={styles.filtersBar}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortModal(true)}
          >
            <Text style={styles.sortButtonText}>
              {SORT_OPTIONS.find((o) => o.id === sortBy)?.label}
            </Text>
            <ChevronDown size={16} color="#374151" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              getActiveFiltersCount() > 0 && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilters(true)}
          >
            <SlidersHorizontal
              size={18}
              color={getActiveFiltersCount() > 0 ? '#fff' : '#374151'}
            />
            {getActiveFiltersCount() > 0 && (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>
                  {getActiveFiltersCount()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[
                styles.viewToggleButton,
                viewMode === 'list' && styles.viewToggleButtonActive,
              ]}
              onPress={() => setViewMode('list')}
            >
              <List size={18} color={viewMode === 'list' ? '#fff' : '#6b7280'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewToggleButton,
                viewMode === 'map' && styles.viewToggleButtonActive,
              ]}
              onPress={() => setViewMode('map')}
            >
              <Map size={18} color={viewMode === 'map' ? '#fff' : '#6b7280'} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Suggestions (when focused and no results) */}
      {isFocused && query.length > 0 && results.length === 0 && (
        <View style={styles.suggestions}>
          {SUGGESTIONS.filter((s) =>
            s.toLowerCase().includes(query.toLowerCase())
          ).map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleSuggestionPress(suggestion)}
            >
              <Search size={16} color="#9ca3af" />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      {results.length > 0 && viewMode === 'list' && (
        <View style={styles.resultsList}>
          <Text style={styles.resultsCount}>
            {results.length} resultados encontrados
          </Text>
          <FlashList
            data={results}
            renderItem={renderProvider}
            keyExtractor={(item) => item.id}
            estimatedItemSize={140}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Map View Placeholder */}
      {results.length > 0 && viewMode === 'map' && (
        <View style={styles.mapPlaceholder}>
          <Map size={48} color="#d1d5db" />
          <Text style={styles.mapPlaceholderText}>
            Vista de mapa próximamente
          </Text>
        </View>
      )}

      {/* Empty State */}
      {!isFocused && results.length === 0 && query.length === 0 && (
        <View style={styles.emptyState}>
          <Search size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Buscá un servicio</Text>
          <Text style={styles.emptySubtitle}>
            Escribí qué necesitás y te mostramos los mejores profesionales
          </Text>
        </View>
      )}

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModal}>
            <Text style={styles.sortModalTitle}>Ordenar por</Text>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.sortOption}
                onPress={() => {
                  setSortBy(option.id);
                  setShowSortModal(false);
                  if (query) performSearch(query);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === option.id && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {sortBy === option.id && (
                  <Check size={18} color="#059669" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filtersModal}>
          <View style={styles.filtersContent}>
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filtersBody}>
              {/* Distance Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Distancia</Text>
                <View style={styles.filterOptions}>
                  {DISTANCE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.filterOption,
                        distance === option.id && styles.filterOptionActive,
                      ]}
                      onPress={() => setDistance(option.id)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          distance === option.id && styles.filterOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Rating Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Calificación mínima</Text>
                <View style={styles.filterOptions}>
                  {RATING_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.filterOption,
                        rating === option.id && styles.filterOptionActive,
                      ]}
                      onPress={() => setRating(option.id)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          rating === option.id && styles.filterOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Available Only */}
              <TouchableOpacity
                style={styles.availableToggle}
                onPress={() => setAvailableOnly(!availableOnly)}
              >
                <View>
                  <Text style={styles.filterLabel}>Solo disponibles ahora</Text>
                  <Text style={styles.filterHint}>
                    Mostrar solo proveedores disponibles
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggle,
                    availableOnly && styles.toggleActive,
                  ]}
                >
                  {availableOnly && <Check size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.filtersFooter}>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setDistance('any');
                  setRating('any');
                  setAvailableOnly(false);
                }}
              >
                <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyFiltersButton}
                onPress={applyFilters}
              >
                <Text style={styles.applyFiltersText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  voiceButton: {
    padding: 4,
  },
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    height: 40,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#059669',
  },
  filterCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  viewToggle: {
    flexDirection: 'row',
    marginLeft: 'auto',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  viewToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: '#059669',
  },
  suggestions: {
    backgroundColor: '#fff',
    paddingVertical: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionText: {
    fontSize: 15,
    color: '#374151',
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsCount: {
    fontSize: 13,
    color: '#6b7280',
    paddingVertical: 12,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
  },
  resultAvatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAvatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
  },
  availableDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  resultCategory: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  resultServices: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  serviceChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  serviceChipText: {
    fontSize: 11,
    color: '#6b7280',
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  reviewCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
    textAlign: 'center',
    marginTop: 8,
  },
  // Sort Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  sortOptionTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  // Filters Modal
  filtersModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filtersContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  filtersBody: {
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  filterHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterOptionActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  filterOptionTextActive: {
    color: '#059669',
    fontWeight: '500',
  },
  availableToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#059669',
  },
  filtersFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  clearFiltersButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    alignItems: 'center',
  },
  clearFiltersText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  applyFiltersButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#059669',
    borderRadius: 10,
    alignItems: 'center',
  },
  applyFiltersText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
