/**
 * Home Screen
 * ===========
 *
 * Main consumer home screen with categories and featured businesses.
 * Phase 15: Consumer Marketplace
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { consumerApi } from '../services/api-client';
import { useAuth } from '../store/auth-context';
import { useLocation } from '../hooks/useLocation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Category {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
}

interface Business {
  id: string;
  displayName: string;
  logoUrl?: string;
  shortDescription?: string;
  categories: string[];
  overallRating: number;
  ratingCount: number;
  badges: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { consumer } = useAuth();
  const { location, city } = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredBusinesses, setFeaturedBusinesses] = useState<Business[]>([]);
  const [topRated, setTopRated] = useState<Business[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [city]);

  const loadData = async () => {
    try {
      const [categoriesRes, featuredRes, topRatedRes] = await Promise.all([
        consumerApi.discover.categories(city),
        consumerApi.discover.featured(6),
        consumerApi.discover.topRated({ city, limit: 6 }),
      ]);

      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
      if (featuredRes.success && featuredRes.data) {
        setFeaturedBusinesses(featuredRes.data);
      }
      if (topRatedRes.success && topRatedRes.data) {
        setTopRated(topRatedRes.data);
      }
    } catch (error) {
      console.error('Failed to load home data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [city]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigation.navigate('Search', { query: searchQuery });
    }
  };

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('Search', { category: category.id });
  };

  const handleBusinessPress = (business: Business) => {
    navigation.navigate('BusinessProfile', { id: business.id });
  };

  const handleCreateRequest = () => {
    navigation.navigate('CreateRequest');
  };

  const greeting = getGreeting();
  const displayName = consumer?.displayName?.split(' ')[0] || 'Hola';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.name}>{displayName}</Text>
        </View>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => navigation.navigate('Location')}
        >
          <Ionicons name="location-outline" size={20} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {city || 'Seleccionar ubicación'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="¿Qué servicio necesitás?"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Quick Action */}
      <TouchableOpacity style={styles.quickAction} onPress={handleCreateRequest}>
        <View style={styles.quickActionIcon}>
          <Ionicons name="add-circle" size={32} color="#FFF" />
        </View>
        <View style={styles.quickActionContent}>
          <Text style={styles.quickActionTitle}>Publicar un pedido</Text>
          <Text style={styles.quickActionSubtitle}>
            Recibí cotizaciones de profesionales
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorías</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Categories')}>
            <Text style={styles.seeAll}>Ver todas</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
        >
          {categories.slice(0, 8).map(category => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => handleCategoryPress(category)}
            >
              <View style={styles.categoryIcon}>
                <Text style={styles.categoryEmoji}>{category.icon}</Text>
              </View>
              <Text style={styles.categoryName} numberOfLines={2}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Featured Businesses */}
      {featuredBusinesses.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Destacados</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.businessesScroll}
          >
            {featuredBusinesses.map(business => (
              <TouchableOpacity
                key={business.id}
                style={styles.featuredCard}
                onPress={() => handleBusinessPress(business)}
              >
                {business.logoUrl ? (
                  <Image
                    source={{ uri: business.logoUrl }}
                    style={styles.featuredLogo}
                  />
                ) : (
                  <View style={[styles.featuredLogo, styles.placeholderLogo]}>
                    <Text style={styles.placeholderText}>
                      {business.displayName.charAt(0)}
                    </Text>
                  </View>
                )}
                <Text style={styles.featuredName} numberOfLines={1}>
                  {business.displayName}
                </Text>
                <Text style={styles.featuredCategory} numberOfLines={1}>
                  {business.categories[0]}
                </Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#FFB800" />
                  <Text style={styles.ratingText}>
                    {business.overallRating.toFixed(1)}
                  </Text>
                  <Text style={styles.ratingCount}>
                    ({business.ratingCount})
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Top Rated */}
      {topRated.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mejor calificados</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Search', { sortBy: 'rating' })}
            >
              <Text style={styles.seeAll}>Ver más</Text>
            </TouchableOpacity>
          </View>
          {topRated.map(business => (
            <TouchableOpacity
              key={business.id}
              style={styles.businessCard}
              onPress={() => handleBusinessPress(business)}
            >
              {business.logoUrl ? (
                <Image
                  source={{ uri: business.logoUrl }}
                  style={styles.businessLogo}
                />
              ) : (
                <View style={[styles.businessLogo, styles.placeholderLogo]}>
                  <Text style={styles.placeholderText}>
                    {business.displayName.charAt(0)}
                  </Text>
                </View>
              )}
              <View style={styles.businessInfo}>
                <Text style={styles.businessName} numberOfLines={1}>
                  {business.displayName}
                </Text>
                <View style={styles.badgesRow}>
                  {business.badges.slice(0, 2).map(badge => (
                    <View key={badge} style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {getBadgeLabel(badge)}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#FFB800" />
                  <Text style={styles.ratingText}>
                    {business.overallRating.toFixed(1)}
                  </Text>
                  <Text style={styles.ratingCount}>
                    ({business.ratingCount} reseñas)
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#CCC" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function getBadgeLabel(badge: string): string {
  const labels: Record<string, string> = {
    verified: 'Verificado',
    top_rated: 'Top',
    fast_responder: 'Rápido',
    experienced: 'Experto',
    emergency_available: 'Emergencias',
    insured: 'Asegurado',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: 160,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 4,
    maxWidth: 100,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  quickActionIcon: {
    marginRight: 12,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  seeAll: {
    fontSize: 14,
    color: '#2563EB',
  },
  categoriesScroll: {
    paddingLeft: 20,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  businessesScroll: {
    paddingLeft: 20,
  },
  featuredCard: {
    width: SCREEN_WIDTH * 0.4,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featuredLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
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
  featuredName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  featuredCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  businessLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    color: '#0369A1',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 100,
  },
});
