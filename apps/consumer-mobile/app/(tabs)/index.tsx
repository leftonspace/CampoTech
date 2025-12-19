/**
 * Home Screen - Consumer App
 * ==========================
 *
 * Phase 3.2.1: Home Screen
 * - Location auto-detected
 * - Category grid
 * - Search bar
 * - Featured/top-rated providers
 * - Recent searches
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  Search,
  MapPin,
  Wrench,
  Zap,
  Flame,
  Wind,
  Droplets,
  Hammer,
  PaintBucket,
  Lock,
  Star,
  ChevronRight,
  Clock,
  Shield,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Service categories
const CATEGORIES = [
  { id: 'plomeria', name: 'Plomería', icon: Droplets, color: '#3b82f6' },
  { id: 'electricidad', name: 'Electricidad', icon: Zap, color: '#f59e0b' },
  { id: 'gas', name: 'Gas', icon: Flame, color: '#ef4444' },
  { id: 'aire-acondicionado', name: 'Aires', icon: Wind, color: '#06b6d4' },
  { id: 'cerrajeria', name: 'Cerrajería', icon: Lock, color: '#8b5cf6' },
  { id: 'pintura', name: 'Pintura', icon: PaintBucket, color: '#ec4899' },
  { id: 'albanileria', name: 'Albañilería', icon: Hammer, color: '#78716c' },
  { id: 'otros', name: 'Otros', icon: Wrench, color: '#6b7280' },
];

// Mock featured providers
const FEATURED_PROVIDERS = [
  {
    id: '1',
    name: 'Plomería García',
    category: 'Plomería',
    rating: 4.9,
    reviews: 127,
    distance: '1.2 km',
    responseTime: '< 30 min',
    verified: true,
    image: null,
  },
  {
    id: '2',
    name: 'Electricidad Rápida',
    category: 'Electricidad',
    rating: 4.8,
    reviews: 89,
    distance: '2.4 km',
    responseTime: '< 1 hora',
    verified: true,
    image: null,
  },
  {
    id: '3',
    name: 'Frío Express',
    category: 'Aires Acondicionados',
    rating: 4.7,
    reviews: 64,
    distance: '3.1 km',
    responseTime: '< 2 horas',
    verified: false,
    image: null,
  },
];

// Mock recent searches
const RECENT_SEARCHES = [
  'reparación aire acondicionado',
  'pérdida de agua',
  'instalación split',
];

export default function HomeScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation('Buenos Aires, Argentina');
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      });

      if (address) {
        setLocation(`${address.city || address.district}, ${address.region}`);
      }
    } catch (error) {
      setLocation('Buenos Aires, Argentina');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await getLocation();
    // In production, refetch providers
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push('/search');
    }
  };

  const handleCategoryPress = (categoryId: string) => {
    router.push(`/category/${categoryId}`);
  };

  const handleProviderPress = (providerId: string) => {
    router.push(`/provider/${providerId}`);
  };

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
          />
        }
      >
        {/* Location Header */}
        <View style={styles.locationHeader}>
          <MapPin size={16} color="#059669" />
          <Text style={styles.locationText}>{location || 'Detectando...'}</Text>
          <TouchableOpacity>
            <Text style={styles.changeLocation}>Cambiar</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/search')}
          activeOpacity={0.8}
        >
          <Search size={20} color="#9ca3af" />
          <Text style={styles.searchPlaceholder}>¿Qué servicio necesitás?</Text>
        </TouchableOpacity>

        {/* Categories Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categorías</Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((category) => {
              const IconComponent = category.icon;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryCard}
                  onPress={() => handleCategoryPress(category.id)}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: category.color + '15' },
                    ]}
                  >
                    <IconComponent size={24} color={category.color} />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Featured Providers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mejor valorados cerca tuyo</Text>
            <TouchableOpacity onPress={() => router.push('/search')}>
              <Text style={styles.seeAll}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {FEATURED_PROVIDERS.map((provider) => (
            <TouchableOpacity
              key={provider.id}
              style={styles.providerCard}
              onPress={() => handleProviderPress(provider.id)}
            >
              <View style={styles.providerAvatar}>
                <Text style={styles.providerAvatarText}>
                  {provider.name[0]}
                </Text>
              </View>
              <View style={styles.providerInfo}>
                <View style={styles.providerHeader}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  {provider.verified && (
                    <Shield size={14} color="#059669" />
                  )}
                </View>
                <Text style={styles.providerCategory}>{provider.category}</Text>
                <View style={styles.providerMeta}>
                  <View style={styles.ratingBadge}>
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingText}>{provider.rating}</Text>
                    <Text style={styles.reviewCount}>({provider.reviews})</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <MapPin size={12} color="#6b7280" />
                    <Text style={styles.metaText}>{provider.distance}</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Clock size={12} color="#6b7280" />
                    <Text style={styles.metaText}>{provider.responseTime}</Text>
                  </View>
                </View>
              </View>
              <ChevronRight size={20} color="#9ca3af" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Searches */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Búsquedas recientes</Text>
          <View style={styles.recentSearches}>
            {RECENT_SEARCHES.map((search, index) => (
              <TouchableOpacity
                key={index}
                style={styles.recentSearchChip}
                onPress={() => handleRecentSearch(search)}
              >
                <Clock size={14} color="#6b7280" />
                <Text style={styles.recentSearchText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* How it works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howItWorksTitle}>¿Cómo funciona?</Text>
          <View style={styles.stepsList}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Buscá el servicio</Text>
                <Text style={styles.stepDescription}>
                  Elegí la categoría o buscá lo que necesitás
                </Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Contactá al profesional</Text>
                <Text style={styles.stepDescription}>
                  Escribile por WhatsApp directamente
                </Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Calificá el servicio</Text>
                <Text style={styles.stepDescription}>
                  Ayudá a otros usuarios con tu opinión
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  changeLocation: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  // Categories Grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: (SCREEN_WIDTH - 32 - 36) / 4,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
  },
  // Provider Cards
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
  },
  providerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  providerCategory: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  providerMeta: {
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
  // Recent Searches
  recentSearches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recentSearchText: {
    fontSize: 13,
    color: '#374151',
  },
  // How it works
  howItWorks: {
    marginTop: 32,
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  howItWorksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  stepsList: {
    gap: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  stepDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  bottomPadding: {
    height: 100,
  },
});
