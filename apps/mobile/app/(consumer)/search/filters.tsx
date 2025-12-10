/**
 * Search Filters Modal
 * ====================
 *
 * Phase 15: Consumer Marketplace
 * Advanced filtering options for service search.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Star,
  MapPin,
  Clock,
  Shield,
  Zap,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';

import { CATEGORIES } from '../../../lib/consumer/constants';

interface Filters {
  category?: string;
  minRating: number;
  maxDistance: number;
  hasEmergency: boolean;
  verified: boolean;
  sortBy: 'rating' | 'distance' | 'response_time' | 'relevance';
}

export default function FiltersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [filters, setFilters] = useState<Filters>({
    category: params.category as string,
    minRating: 0,
    maxDistance: 20,
    hasEmergency: false,
    verified: false,
    sortBy: 'relevance',
  });

  const handleApply = () => {
    // Build query params
    const queryParams: Record<string, string> = {};
    if (filters.category) queryParams.category = filters.category;
    if (filters.minRating > 0) queryParams.minRating = filters.minRating.toString();
    if (filters.maxDistance < 20) queryParams.maxDistance = filters.maxDistance.toString();
    if (filters.hasEmergency) queryParams.hasEmergency = 'true';
    if (filters.verified) queryParams.verified = 'true';
    if (filters.sortBy !== 'relevance') queryParams.sortBy = filters.sortBy;

    router.back();
    // Would pass params back
  };

  const handleReset = () => {
    setFilters({
      category: undefined,
      minRating: 0,
      maxDistance: 20,
      hasEmergency: false,
      verified: false,
      sortBy: 'relevance',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filtros</Text>
        <TouchableOpacity onPress={handleReset}>
          <Text style={styles.resetText}>Limpiar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoriesRow}>
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  !filters.category && styles.categoryChipActive,
                ]}
                onPress={() => setFilters({ ...filters, category: undefined })}
              >
                <Text style={[
                  styles.categoryChipText,
                  !filters.category && styles.categoryChipTextActive,
                ]}>
                  Todas
                </Text>
              </TouchableOpacity>
              {CATEGORIES.slice(0, 7).map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    filters.category === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setFilters({ ...filters, category: cat.id })}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[
                    styles.categoryChipText,
                    filters.category === cat.id && styles.categoryChipTextActive,
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Rating */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Star size={18} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.sectionTitle}>Valoracion minima</Text>
          </View>
          <View style={styles.ratingContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={5}
              step={0.5}
              value={filters.minRating}
              onValueChange={(value) => setFilters({ ...filters, minRating: value })}
              minimumTrackTintColor="#0284c7"
              maximumTrackTintColor="#e5e7eb"
              thumbTintColor="#0284c7"
            />
            <View style={styles.ratingLabels}>
              <Text style={styles.ratingValue}>
                {filters.minRating > 0 ? `${filters.minRating}+ estrellas` : 'Cualquiera'}
              </Text>
            </View>
          </View>
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={18} color="#0284c7" />
            <Text style={styles.sectionTitle}>Distancia maxima</Text>
          </View>
          <View style={styles.distanceContainer}>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={50}
              step={1}
              value={filters.maxDistance}
              onValueChange={(value) => setFilters({ ...filters, maxDistance: value })}
              minimumTrackTintColor="#0284c7"
              maximumTrackTintColor="#e5e7eb"
              thumbTintColor="#0284c7"
            />
            <Text style={styles.distanceValue}>{filters.maxDistance} km</Text>
          </View>
        </View>

        {/* Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caracteristicas</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Shield size={18} color="#16a34a" />
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleLabel}>Solo verificados</Text>
                <Text style={styles.toggleDescription}>
                  Profesionales con documentacion validada
                </Text>
              </View>
            </View>
            <Switch
              value={filters.verified}
              onValueChange={(value) => setFilters({ ...filters, verified: value })}
              trackColor={{ false: '#e5e7eb', true: '#86efac' }}
              thumbColor={filters.verified ? '#16a34a' : '#fff'}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Zap size={18} color="#f59e0b" />
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleLabel}>Servicio urgente</Text>
                <Text style={styles.toggleDescription}>
                  Disponibles para emergencias
                </Text>
              </View>
            </View>
            <Switch
              value={filters.hasEmergency}
              onValueChange={(value) => setFilters({ ...filters, hasEmergency: value })}
              trackColor={{ false: '#e5e7eb', true: '#fde68a' }}
              thumbColor={filters.hasEmergency ? '#f59e0b' : '#fff'}
            />
          </View>
        </View>

        {/* Sort */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={18} color="#6b7280" />
            <Text style={styles.sectionTitle}>Ordenar por</Text>
          </View>
          <View style={styles.sortOptions}>
            {[
              { key: 'relevance', label: 'Relevancia' },
              { key: 'rating', label: 'Mejor valorados' },
              { key: 'distance', label: 'Mas cercanos' },
              { key: 'response_time', label: 'Respuesta rapida' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.sortOption,
                  filters.sortBy === option.key && styles.sortOptionActive,
                ]}
                onPress={() => setFilters({ ...filters, sortBy: option.key as any })}
              >
                <Text style={[
                  styles.sortOptionText,
                  filters.sortBy === option.key && styles.sortOptionTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Apply Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>Aplicar filtros</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  resetText: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#0284c7',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#0284c7',
  },
  ratingContainer: {
    paddingTop: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  ratingValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  sortOptions: {
    gap: 8,
  },
  sortOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  sortOptionActive: {
    backgroundColor: '#dbeafe',
  },
  sortOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  sortOptionTextActive: {
    color: '#0284c7',
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  applyButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
