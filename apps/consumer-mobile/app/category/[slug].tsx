/**
 * Category Listing Screen
 * =======================
 *
 * Shows all providers in a specific category with filtering options.
 * Features:
 * - List/Map view toggle
 * - Sub-service filter
 * - Rating filter
 * - Distance filter
 * - "Available now" filter
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import {
  ArrowLeft,
  List,
  Map,
  SlidersHorizontal,
  Star,
  MapPin,
  Clock,
  Check,
  X,
  ChevronDown,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

// Category configuration
const CATEGORIES: Record<string, {
  name: string;
  icon: string;
  subServices: string[];
}> = {
  plomeria: {
    name: 'Plomería',
    icon: '🔧',
    subServices: [
      'Reparación de cañerías',
      'Destapaciones',
      'Instalación sanitaria',
      'Termo tanques',
      'Grifería',
      'Bombas de agua',
    ],
  },
  electricidad: {
    name: 'Electricidad',
    icon: '⚡',
    subServices: [
      'Instalación eléctrica',
      'Reparación de cortocircuitos',
      'Tableros eléctricos',
      'Iluminación',
      'Tomas y enchufes',
      'Puesta a tierra',
    ],
  },
  gas: {
    name: 'Gas',
    icon: '🔥',
    subServices: [
      'Instalación de gas',
      'Reparación de pérdidas',
      'Calefones',
      'Estufas',
      'Hornos',
      'Certificación matriculado',
    ],
  },
  aires: {
    name: 'Aires Acondicionados',
    icon: '❄️',
    subServices: [
      'Instalación split',
      'Carga de gas',
      'Limpieza y mantenimiento',
      'Reparación',
      'Central de aire',
      'Ventilación',
    ],
  },
  cerrajeria: {
    name: 'Cerrajería',
    icon: '🔐',
    subServices: [
      'Apertura de puertas',
      'Cambio de cerraduras',
      'Copia de llaves',
      'Cerraduras de seguridad',
      'Portones automáticos',
      'Cerraduras electrónicas',
    ],
  },
  limpieza: {
    name: 'Limpieza',
    icon: '🧹',
    subServices: [
      'Limpieza hogareña',
      'Limpieza de oficinas',
      'Limpieza post obra',
      'Limpieza de vidrios',
      'Limpieza de alfombras',
      'Limpieza profunda',
    ],
  },
  pintura: {
    name: 'Pintura',
    icon: '🎨',
    subServices: [
      'Pintura interior',
      'Pintura exterior',
      'Empapelado',
      'Texturado',
      'Impermeabilización',
      'Restauración',
    ],
  },
  albanileria: {
    name: 'Albañilería',
    icon: '🧱',
    subServices: [
      'Construcción',
      'Refacciones',
      'Revoques',
      'Pisos y revestimientos',
      'Mampostería',
      'Demoliciones',
    ],
  },
};

// Mock provider data
interface Provider {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  distance: number;
  services: string[];
  available: boolean;
  responseTime: string;
  avatar: string;
  verified: boolean;
}

const mockProviders: Provider[] = [
  {
    id: '1',
    name: 'Carlos Méndez',
    rating: 4.9,
    reviewCount: 127,
    distance: 1.2,
    services: ['Reparación de cañerías', 'Destapaciones', 'Grifería'],
    available: true,
    responseTime: '~15 min',
    avatar: 'CM',
    verified: true,
  },
  {
    id: '2',
    name: 'Roberto García',
    rating: 4.7,
    reviewCount: 89,
    distance: 2.5,
    services: ['Instalación sanitaria', 'Termo tanques', 'Bombas de agua'],
    available: true,
    responseTime: '~30 min',
    avatar: 'RG',
    verified: true,
  },
  {
    id: '3',
    name: 'Miguel Torres',
    rating: 4.5,
    reviewCount: 56,
    distance: 3.8,
    services: ['Reparación de cañerías', 'Instalación sanitaria'],
    available: false,
    responseTime: '~1 hora',
    avatar: 'MT',
    verified: false,
  },
  {
    id: '4',
    name: 'Juan Pérez',
    rating: 4.8,
    reviewCount: 203,
    distance: 4.2,
    services: ['Destapaciones', 'Grifería', 'Termo tanques'],
    available: true,
    responseTime: '~20 min',
    avatar: 'JP',
    verified: true,
  },
  {
    id: '5',
    name: 'Fernando López',
    rating: 4.3,
    reviewCount: 41,
    distance: 5.1,
    services: ['Instalación sanitaria', 'Bombas de agua'],
    available: true,
    responseTime: '~45 min',
    avatar: 'FL',
    verified: false,
  },
];

type ViewMode = 'list' | 'map';
type SortOption = 'rating' | 'distance' | 'reviews';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const category = CATEGORIES[slug || ''] || { name: 'Categoría', icon: '📋', subServices: [] };

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSubServices, setSelectedSubServices] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxDistance, setMaxDistance] = useState<number>(10);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('rating');

  // Simulated query - replace with actual API call
  const { data: providers, isLoading } = useQuery({
    queryKey: ['category-providers', slug],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockProviders;
    },
  });

  // Apply filters and sorting
  const filteredProviders = useMemo(() => {
    if (!providers) return [];

    let result = [...providers];

    // Filter by sub-services
    if (selectedSubServices.length > 0) {
      result = result.filter(p =>
        p.services.some(s => selectedSubServices.includes(s))
      );
    }

    // Filter by rating
    if (minRating > 0) {
      result = result.filter(p => p.rating >= minRating);
    }

    // Filter by distance
    result = result.filter(p => p.distance <= maxDistance);

    // Filter by availability
    if (availableOnly) {
      result = result.filter(p => p.available);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'distance':
          return a.distance - b.distance;
        case 'reviews':
          return b.reviewCount - a.reviewCount;
        default:
          return 0;
      }
    });

    return result;
  }, [providers, selectedSubServices, minRating, maxDistance, availableOnly, sortBy]);

  const toggleSubService = (service: string) => {
    setSelectedSubServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  const clearFilters = () => {
    setSelectedSubServices([]);
    setMinRating(0);
    setMaxDistance(10);
    setAvailableOnly(false);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSubServices.length > 0) count++;
    if (minRating > 0) count++;
    if (maxDistance < 10) count++;
    if (availableOnly) count++;
    return count;
  }, [selectedSubServices, minRating, maxDistance, availableOnly]);

  const renderProvider = ({ item }: { item: Provider }) => (
    <Pressable
      style={styles.providerCard}
      onPress={() => router.push(`/provider/${item.id}`)}
    >
      <View style={styles.providerHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{item.avatar}</Text>
          {item.verified && (
            <View style={styles.verifiedBadge}>
              <Check size={10} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.providerInfo}>
          <Text style={styles.providerName}>{item.name}</Text>
          <View style={styles.ratingRow}>
            <Star size={14} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.ratingText}>{item.rating}</Text>
            <Text style={styles.reviewCount}>({item.reviewCount} reseñas)</Text>
          </View>
        </View>
        <View style={styles.distanceContainer}>
          <MapPin size={14} color="#6b7280" />
          <Text style={styles.distanceText}>{item.distance} km</Text>
        </View>
      </View>

      <View style={styles.servicesContainer}>
        {item.services.slice(0, 3).map((service, index) => (
          <View key={index} style={styles.serviceTag}>
            <Text style={styles.serviceTagText}>{service}</Text>
          </View>
        ))}
      </View>

      <View style={styles.providerFooter}>
        <View style={styles.responseTimeContainer}>
          <Clock size={14} color="#6b7280" />
          <Text style={styles.responseTimeText}>Responde {item.responseTime}</Text>
        </View>
        <View style={[
          styles.availabilityBadge,
          item.available ? styles.availableBadge : styles.unavailableBadge,
        ]}>
          <Text style={[
            styles.availabilityText,
            item.available ? styles.availableText : styles.unavailableText,
          ]}>
            {item.available ? 'Disponible' : 'No disponible'}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  const renderMapView = () => (
    <View style={styles.mapPlaceholder}>
      <Map size={48} color="#9ca3af" />
      <Text style={styles.mapPlaceholderText}>
        Vista de mapa próximamente
      </Text>
      <Text style={styles.mapPlaceholderSubtext}>
        Estamos trabajando en esta función
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: `${category.icon} ${category.name}`,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#111827" />
            </Pressable>
          ),
        }}
      />

      {/* Controls bar */}
      <View style={styles.controlsBar}>
        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <List size={18} color={viewMode === 'list' ? '#fff' : '#6b7280'} />
          </Pressable>
          <Pressable
            style={[styles.viewButton, viewMode === 'map' && styles.viewButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <Map size={18} color={viewMode === 'map' ? '#fff' : '#6b7280'} />
          </Pressable>
        </View>

        <Pressable
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <SlidersHorizontal size={18} color="#374151" />
          <Text style={styles.filterButtonText}>Filtros</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.sortButton}>
          <Text style={styles.sortButtonText}>
            {sortBy === 'rating' && 'Mejor valorados'}
            {sortBy === 'distance' && 'Más cercanos'}
            {sortBy === 'reviews' && 'Más reseñas'}
          </Text>
          <ChevronDown size={16} color="#374151" />
        </Pressable>
      </View>

      {/* Results count */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {filteredProviders.length} profesionales encontrados
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Buscando profesionales...</Text>
        </View>
      ) : viewMode === 'list' ? (
        <FlashList
          data={filteredProviders}
          renderItem={renderProvider}
          keyExtractor={item => item.id}
          estimatedItemSize={180}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No encontramos profesionales con estos filtros
              </Text>
              <Pressable style={styles.clearFiltersButton} onPress={clearFilters}>
                <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        renderMapView()
      )}

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros</Text>
            <Pressable onPress={() => setShowFilters(false)}>
              <X size={24} color="#374151" />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Sub-services filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Tipo de servicio</Text>
              <View style={styles.subServicesGrid}>
                {category.subServices.map((service, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.subServiceChip,
                      selectedSubServices.includes(service) && styles.subServiceChipActive,
                    ]}
                    onPress={() => toggleSubService(service)}
                  >
                    <Text style={[
                      styles.subServiceChipText,
                      selectedSubServices.includes(service) && styles.subServiceChipTextActive,
                    ]}>
                      {service}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Rating filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Calificación mínima</Text>
              <View style={styles.ratingOptions}>
                {[0, 3, 3.5, 4, 4.5].map(rating => (
                  <Pressable
                    key={rating}
                    style={[
                      styles.ratingOption,
                      minRating === rating && styles.ratingOptionActive,
                    ]}
                    onPress={() => setMinRating(rating)}
                  >
                    {rating === 0 ? (
                      <Text style={[
                        styles.ratingOptionText,
                        minRating === rating && styles.ratingOptionTextActive,
                      ]}>
                        Todas
                      </Text>
                    ) : (
                      <View style={styles.ratingOptionContent}>
                        <Star
                          size={14}
                          color={minRating === rating ? '#fff' : '#f59e0b'}
                          fill={minRating === rating ? '#fff' : '#f59e0b'}
                        />
                        <Text style={[
                          styles.ratingOptionText,
                          minRating === rating && styles.ratingOptionTextActive,
                        ]}>
                          {rating}+
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Distance filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Distancia máxima</Text>
              <View style={styles.distanceOptions}>
                {[2, 5, 10, 20, 50].map(distance => (
                  <Pressable
                    key={distance}
                    style={[
                      styles.distanceOption,
                      maxDistance === distance && styles.distanceOptionActive,
                    ]}
                    onPress={() => setMaxDistance(distance)}
                  >
                    <Text style={[
                      styles.distanceOptionText,
                      maxDistance === distance && styles.distanceOptionTextActive,
                    ]}>
                      {distance} km
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Available only toggle */}
            <View style={styles.filterSection}>
              <Pressable
                style={styles.availableToggle}
                onPress={() => setAvailableOnly(!availableOnly)}
              >
                <View>
                  <Text style={styles.filterSectionTitle}>Solo disponibles</Text>
                  <Text style={styles.availableToggleSubtext}>
                    Mostrar solo profesionales disponibles ahora
                  </Text>
                </View>
                <View style={[
                  styles.toggleSwitch,
                  availableOnly && styles.toggleSwitchActive,
                ]}>
                  <View style={[
                    styles.toggleKnob,
                    availableOnly && styles.toggleKnobActive,
                  ]} />
                </View>
              </Pressable>
            </View>

            {/* Sort options */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Ordenar por</Text>
              <View style={styles.sortOptions}>
                {[
                  { value: 'rating' as const, label: 'Mejor valorados' },
                  { value: 'distance' as const, label: 'Más cercanos' },
                  { value: 'reviews' as const, label: 'Más reseñas' },
                ].map(option => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.sortOption,
                      sortBy === option.value && styles.sortOptionActive,
                    ]}
                    onPress={() => setSortBy(option.value)}
                  >
                    <Text style={[
                      styles.sortOptionText,
                      sortBy === option.value && styles.sortOptionTextActive,
                    ]}>
                      {option.label}
                    </Text>
                    {sortBy === option.value && (
                      <Check size={16} color="#059669" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Limpiar todo</Text>
            </Pressable>
            <Pressable
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>
                Ver {filteredProviders.length} resultados
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  viewButton: {
    padding: 8,
    borderRadius: 6,
  },
  viewButtonActive: {
    backgroundColor: '#059669',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterBadge: {
    backgroundColor: '#059669',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  sortButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  resultsInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  resultsText: {
    fontSize: 13,
    color: '#6b7280',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  listContent: {
    padding: 16,
  },
  providerCard: {
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
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  reviewCount: {
    fontSize: 13,
    color: '#6b7280',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 13,
    color: '#6b7280',
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  serviceTag: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  serviceTagText: {
    fontSize: 12,
    color: '#4b5563',
  },
  providerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  responseTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  responseTimeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  availabilityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  availableBadge: {
    backgroundColor: '#d1fae5',
  },
  unavailableBadge: {
    backgroundColor: '#f3f4f6',
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  availableText: {
    color: '#059669',
  },
  unavailableText: {
    color: '#6b7280',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  clearFiltersButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  clearFiltersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
  },
  filterSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  subServicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subServiceChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  subServiceChipActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#059669',
  },
  subServiceChipText: {
    fontSize: 13,
    color: '#4b5563',
  },
  subServiceChipTextActive: {
    color: '#059669',
    fontWeight: '500',
  },
  ratingOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  ratingOptionActive: {
    backgroundColor: '#059669',
  },
  ratingOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingOptionText: {
    fontSize: 14,
    color: '#4b5563',
  },
  ratingOptionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  distanceOptionActive: {
    backgroundColor: '#059669',
  },
  distanceOptionText: {
    fontSize: 14,
    color: '#4b5563',
  },
  distanceOptionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  availableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availableToggleSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    backgroundColor: '#e5e7eb',
    borderRadius: 14,
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#059669',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  sortOptions: {
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: '#d1fae5',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#4b5563',
  },
  sortOptionTextActive: {
    color: '#059669',
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
