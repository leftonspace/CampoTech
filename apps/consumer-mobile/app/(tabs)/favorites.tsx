/**
 * Favorites Screen - Consumer App
 * ================================
 *
 * Shows saved/favorited service providers.
 * Requires authentication to access.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import {
  Heart,
  Star,
  MapPin,
  Clock,
  Check,
  Trash2,
  LogIn,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

// Mock auth state - replace with actual auth context
const useAuth = () => ({
  isAuthenticated: true,
  user: { name: 'Usuario Demo' },
});

interface FavoriteProvider {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  rating: number;
  reviewCount: number;
  distance: number;
  available: boolean;
  responseTime: string;
  avatar: string;
  verified: boolean;
  savedAt: string;
}

const mockFavorites: FavoriteProvider[] = [
  {
    id: '1',
    name: 'Carlos Méndez',
    category: 'Plomería',
    categoryIcon: '🔧',
    rating: 4.9,
    reviewCount: 127,
    distance: 1.2,
    available: true,
    responseTime: '~15 min',
    avatar: 'CM',
    verified: true,
    savedAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'María González',
    category: 'Electricidad',
    categoryIcon: '⚡',
    rating: 4.8,
    reviewCount: 89,
    distance: 2.3,
    available: true,
    responseTime: '~20 min',
    avatar: 'MG',
    verified: true,
    savedAt: '2024-01-10',
  },
  {
    id: '3',
    name: 'Roberto García',
    category: 'Gas',
    categoryIcon: '🔥',
    rating: 4.7,
    reviewCount: 156,
    distance: 3.5,
    available: false,
    responseTime: '~30 min',
    avatar: 'RG',
    verified: true,
    savedAt: '2024-01-05',
  },
];

export default function FavoritesScreen() {
  const { isAuthenticated } = useAuth();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: favorites, isLoading, refetch } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockFavorites;
    },
    enabled: isAuthenticated,
  });

  const handleRemoveFavorite = (id: string) => {
    setRemovingId(id);
    // Simulate remove - in real app, call API
    setTimeout(() => {
      setRemovingId(null);
      refetch();
    }, 500);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authIconContainer}>
          <Heart size={48} color="#9ca3af" />
        </View>
        <Text style={styles.authTitle}>Inicia sesión para ver tus favoritos</Text>
        <Text style={styles.authSubtitle}>
          Guarda a tus profesionales preferidos para contactarlos fácilmente
        </Text>
        <Pressable
          style={styles.loginButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <LogIn size={20} color="#fff" />
          <Text style={styles.loginButtonText}>Iniciar sesión</Text>
        </Pressable>
      </View>
    );
  }

  const renderFavorite = ({ item }: { item: FavoriteProvider }) => (
    <Pressable
      style={[
        styles.favoriteCard,
        removingId === item.id && styles.favoriteCardRemoving,
      ]}
      onPress={() => router.push(`/provider/${item.id}`)}
    >
      <View style={styles.cardHeader}>
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
          <View style={styles.categoryRow}>
            <Text style={styles.categoryIcon}>{item.categoryIcon}</Text>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>
        <Pressable
          style={styles.removeButton}
          onPress={() => handleRemoveFavorite(item.id)}
        >
          <Trash2 size={18} color="#ef4444" />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Star size={14} color="#f59e0b" fill="#f59e0b" />
          <Text style={styles.statText}>{item.rating}</Text>
          <Text style={styles.statLabel}>({item.reviewCount})</Text>
        </View>
        <View style={styles.stat}>
          <MapPin size={14} color="#6b7280" />
          <Text style={styles.statText}>{item.distance} km</Text>
        </View>
        <View style={styles.stat}>
          <Clock size={14} color="#6b7280" />
          <Text style={styles.statText}>{item.responseTime}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[
          styles.availabilityBadge,
          item.available ? styles.availableBadge : styles.unavailableBadge,
        ]}>
          <Text style={[
            styles.availabilityText,
            item.available ? styles.availableText : styles.unavailableText,
          ]}>
            {item.available ? 'Disponible ahora' : 'No disponible'}
          </Text>
        </View>
        <Pressable
          style={styles.contactButton}
          onPress={() => router.push(`/provider/${item.id}`)}
        >
          <Text style={styles.contactButtonText}>Contactar</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {favorites && favorites.length > 0 ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerText}>
              {favorites.length} profesionales guardados
            </Text>
          </View>
          <FlashList
            data={favorites}
            renderItem={renderFavorite}
            keyExtractor={item => item.id}
            estimatedItemSize={180}
            contentContainerStyle={styles.listContent}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Heart size={48} color="#9ca3af" />
          </View>
          <Text style={styles.emptyTitle}>No tienes favoritos aún</Text>
          <Text style={styles.emptySubtitle}>
            Guarda a los profesionales que te gusten para encontrarlos fácilmente
          </Text>
          <Pressable
            style={styles.exploreButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.exploreButtonText}>Explorar profesionales</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  authContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  authIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  listContent: {
    padding: 16,
  },
  favoriteCard: {
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
  favoriteCardRemoving: {
    opacity: 0.5,
  },
  cardHeader: {
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
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 14,
    color: '#6b7280',
  },
  removeButton: {
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
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
  contactButton: {
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  exploreButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
