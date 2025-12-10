/**
 * Quote Card Component
 * ====================
 *
 * Phase 15: Consumer Marketplace
 * Displays a quote from a business.
 */

import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import {
  Star,
  Clock,
  ChevronRight,
  Check,
  Calendar,
  DollarSign,
} from 'lucide-react-native';
import { RatingStars } from './RatingStars';

interface Quote {
  id: string;
  quoteNumber: string;
  priceType?: string;
  priceAmount?: number;
  priceMin?: number;
  priceMax?: number;
  description?: string;
  estimatedDurationHours?: number;
  availableDate?: string;
  status: string;
  createdAt: string;
  businessProfileId?: string;
  business?: {
    id: string;
    displayName: string;
    logoUrl?: string;
    overallRating?: number;
    ratingCount?: number;
    badges?: string[];
  };
}

interface QuoteCardProps {
  quote: Quote;
  isSelected?: boolean;
  onPress?: () => void;
  onViewProfile?: () => void;
  onAccept?: () => void;
  isAccepting?: boolean;
  showDetails?: boolean;
  compact?: boolean;
}

export function QuoteCard({
  quote,
  isSelected = false,
  onPress,
  onViewProfile,
  onAccept,
  isAccepting = false,
  showDetails = false,
  compact = false,
}: QuoteCardProps) {
  const formatPrice = () => {
    if (quote.priceAmount) {
      return `$${quote.priceAmount.toLocaleString('es-AR')}`;
    }
    if (quote.priceMin && quote.priceMax) {
      return `$${quote.priceMin.toLocaleString('es-AR')} - $${quote.priceMax.toLocaleString('es-AR')}`;
    }
    return 'A cotizar';
  };

  const formatDuration = () => {
    if (!quote.estimatedDurationHours) return null;
    if (quote.estimatedDurationHours < 1) {
      return `${Math.round(quote.estimatedDurationHours * 60)} min`;
    }
    return `${quote.estimatedDurationHours}h aprox.`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    });
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, isSelected && styles.compactSelected]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.compactHeader}>
          {quote.business?.logoUrl ? (
            <Image source={{ uri: quote.business.logoUrl }} style={styles.compactLogo} />
          ) : (
            <View style={[styles.compactLogo, styles.logoPlaceholder]}>
              <Text style={styles.logoText}>
                {quote.business?.displayName?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          <View style={styles.compactInfo}>
            <Text style={styles.compactName} numberOfLines={1}>
              {quote.business?.displayName || 'Profesional'}
            </Text>
            <View style={styles.ratingRow}>
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.ratingText}>
                {quote.business?.overallRating?.toFixed(1) || '0.0'}
              </Text>
            </View>
          </View>
          <Text style={styles.compactPrice}>{formatPrice()}</Text>
        </View>
        {isSelected && <Check size={18} color="#0284c7" />}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, isSelected && styles.containerSelected]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.businessInfo} onPress={onViewProfile}>
          {quote.business?.logoUrl ? (
            <Image source={{ uri: quote.business.logoUrl }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Text style={styles.logoText}>
                {quote.business?.displayName?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          <View style={styles.businessDetails}>
            <Text style={styles.businessName} numberOfLines={1}>
              {quote.business?.displayName || 'Profesional'}
            </Text>
            <View style={styles.ratingRow}>
              <RatingStars rating={quote.business?.overallRating || 0} size={12} />
              <Text style={styles.ratingValue}>
                {quote.business?.overallRating?.toFixed(1) || '0.0'}
              </Text>
              <Text style={styles.ratingCount}>
                ({quote.business?.ratingCount || 0})
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Price */}
      <View style={styles.priceSection}>
        <View style={styles.priceRow}>
          <DollarSign size={20} color="#0284c7" />
          <Text style={styles.priceValue}>{formatPrice()}</Text>
        </View>
        {quote.priceType && (
          <Text style={styles.priceType}>
            {quote.priceType === 'fixed' ? 'Precio fijo' :
             quote.priceType === 'range' ? 'Rango de precio' :
             quote.priceType === 'hourly' ? 'Por hora' :
             'A cotizar en sitio'}
          </Text>
        )}
      </View>

      {/* Details */}
      {showDetails && (
        <View style={styles.detailsSection}>
          {quote.description && (
            <Text style={styles.description} numberOfLines={3}>
              {quote.description}
            </Text>
          )}

          <View style={styles.detailsRow}>
            {formatDuration() && (
              <View style={styles.detailItem}>
                <Clock size={14} color="#6b7280" />
                <Text style={styles.detailText}>{formatDuration()}</Text>
              </View>
            )}
            {quote.availableDate && (
              <View style={styles.detailItem}>
                <Calendar size={14} color="#6b7280" />
                <Text style={styles.detailText}>
                  Disponible: {formatDate(quote.availableDate)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.viewProfileButton} onPress={onViewProfile}>
          <Text style={styles.viewProfileText}>Ver perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={onAccept}
          disabled={isAccepting}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Check size={16} color="#fff" />
              <Text style={styles.acceptButtonText}>Aceptar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Timestamp */}
      <Text style={styles.timestamp}>
        Recibido {formatDate(quote.createdAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  containerSelected: {
    borderColor: '#0284c7',
    borderWidth: 2,
    backgroundColor: '#f0f9ff',
  },
  header: {
    marginBottom: 16,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
  },
  logoPlaceholder: {
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
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
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 13,
    color: '#6b7280',
  },
  priceSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  priceType: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginLeft: 28,
  },
  detailsSection: {
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewProfileButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 10,
    alignItems: 'center',
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284c7',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#16a34a',
    borderRadius: 10,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  compactSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 4,
  },
  compactPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0284c7',
    marginRight: 8,
  },
});

export default QuoteCard;
