/**
 * Quote Comparison Screen
 * =======================
 *
 * Phase 15: Consumer Marketplace
 * Compare and select from received quotes.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowUpDown,
  Star,
  Clock,
  DollarSign,
  CheckCircle,
  Award,
} from 'lucide-react-native';

import { QuoteCard } from '../../../../components/consumer/QuoteCard';
import { useRequestQuotes, useAcceptQuote } from '../../../../lib/consumer/hooks/use-quotes';

type SortOption = 'price' | 'rating' | 'response_time';

export default function QuotesComparisonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { quotes, stats, isLoading, refetch } = useRequestQuotes(id);
  const { acceptQuote, isLoading: isAccepting } = useAcceptQuote();

  const [sortBy, setSortBy] = useState<SortOption>('price');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const handleAcceptQuote = async (quoteId: string) => {
    try {
      await acceptQuote(quoteId);
      router.replace({
        pathname: '/(consumer)/request/[id]',
        params: { id },
      });
    } catch (error) {
      console.error('Failed to accept quote:', error);
    }
  };

  const sortedQuotes = [...(quotes || [])].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return (a.priceMin || a.priceAmount || 0) - (b.priceMin || b.priceAmount || 0);
      case 'rating':
        return (b.business?.overallRating || 0) - (a.business?.overallRating || 0);
      case 'response_time':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default:
        return 0;
    }
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comparar presupuestos</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Stats Summary */}
      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Mas bajo</Text>
            <Text style={styles.statValue}>
              ${stats.minPrice?.toLocaleString('es-AR') || '-'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Promedio</Text>
            <Text style={styles.statValue}>
              ${stats.avgPrice?.toLocaleString('es-AR') || '-'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Mas alto</Text>
            <Text style={styles.statValue}>
              ${stats.maxPrice?.toLocaleString('es-AR') || '-'}
            </Text>
          </View>
        </View>
      )}

      {/* Sort Options */}
      <View style={styles.sortBar}>
        <ArrowUpDown size={16} color="#6b7280" />
        <Text style={styles.sortLabel}>Ordenar:</Text>
        {[
          { key: 'price', label: 'Precio', icon: DollarSign },
          { key: 'rating', label: 'Valoracion', icon: Star },
          { key: 'response_time', label: 'Tiempo', icon: Clock },
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortOption,
              sortBy === option.key && styles.sortOptionActive,
            ]}
            onPress={() => setSortBy(option.key as SortOption)}
          >
            <option.icon
              size={14}
              color={sortBy === option.key ? '#0284c7' : '#6b7280'}
            />
            <Text
              style={[
                styles.sortOptionText,
                sortBy === option.key && styles.sortOptionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quotes List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Best Value Badge */}
        {sortedQuotes.length > 0 && sortBy === 'price' && (
          <View style={styles.bestValueBadge}>
            <Award size={16} color="#16a34a" />
            <Text style={styles.bestValueText}>Mejor precio</Text>
          </View>
        )}

        {sortedQuotes.map((quote, index) => (
          <View key={quote.id}>
            {index === 0 && sortBy === 'price' && (
              <View style={styles.recommendedBorder} />
            )}
            <QuoteCard
              quote={quote}
              isSelected={selectedQuoteId === quote.id}
              onPress={() => setSelectedQuoteId(quote.id)}
              onViewProfile={() => {
                if (quote.businessProfileId) {
                  router.push({
                    pathname: '/(consumer)/business/[id]',
                    params: { id: quote.businessProfileId },
                  });
                }
              }}
              onAccept={() => handleAcceptQuote(quote.id)}
              isAccepting={isAccepting}
              showDetails
            />
          </View>
        ))}

        {sortedQuotes.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Aun no has recibido presupuestos
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Consejos para elegir:</Text>
        <Text style={styles.tipsText}>
          • Revisa las valoraciones y trabajos completados{'\n'}
          • Compara no solo el precio sino la calidad del servicio{'\n'}
          • Lee los comentarios de otros clientes
        </Text>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  sortLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginRight: 4,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
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
  },
  sortOptionTextActive: {
    color: '#0284c7',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  bestValueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    marginBottom: 8,
  },
  bestValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  recommendedBorder: {
    position: 'absolute',
    top: 0,
    left: -2,
    right: -2,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 14,
    zIndex: -1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  bottomSpacer: {
    height: 24,
  },
  tipsContainer: {
    padding: 16,
    backgroundColor: '#fef3c7',
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 20,
  },
});
