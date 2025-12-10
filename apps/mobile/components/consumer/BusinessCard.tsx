/**
 * Business Card Component
 * =======================
 *
 * Phase 15: Consumer Marketplace
 * Displays a business preview in list views.
 */

import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
  Star,
  MapPin,
  Clock,
  Shield,
  Zap,
  Award,
  ChevronRight,
} from 'lucide-react-native';
import { RatingStars } from './RatingStars';
import { BadgeList } from './BadgeList';

interface Business {
  id: string;
  displayName: string;
  logoUrl?: string;
  shortDescription?: string;
  overallRating?: number;
  ratingCount?: number;
  avgResponseTimeHours?: number;
  totalJobsCompleted?: number;
  badges?: string[];
  distance?: number;
  categories?: string[];
  acceptsEmergency?: boolean;
  verified?: boolean;
}

interface BusinessCardProps {
  business: Business;
  onPress: () => void;
  showDistance?: boolean;
  compact?: boolean;
}

export function BusinessCard({
  business,
  onPress,
  showDistance = false,
  compact = false,
}: BusinessCardProps) {
  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {business.logoUrl ? (
          <Image source={{ uri: business.logoUrl }} style={styles.compactLogo} />
        ) : (
          <View style={[styles.compactLogo, styles.logoPlaceholder]}>
            <Text style={styles.logoText}>{business.displayName?.charAt(0) || '?'}</Text>
          </View>
        )}
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>
            {business.displayName}
          </Text>
          <View style={styles.ratingRow}>
            <Star size={12} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.ratingText}>
              {business.overallRating?.toFixed(1) || '0.0'}
            </Text>
            <Text style={styles.ratingCount}>({business.ratingCount || 0})</Text>
          </View>
        </View>
        <ChevronRight size={18} color="#d1d5db" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        {business.logoUrl ? (
          <Image source={{ uri: business.logoUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoPlaceholder]}>
            <Text style={styles.logoText}>{business.displayName?.charAt(0) || '?'}</Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {business.displayName}
          </Text>
          {business.shortDescription && (
            <Text style={styles.description} numberOfLines={1}>
              {business.shortDescription}
            </Text>
          )}
          <View style={styles.ratingRow}>
            <RatingStars rating={business.overallRating || 0} size={14} />
            <Text style={styles.ratingValue}>
              {business.overallRating?.toFixed(1) || '0.0'}
            </Text>
            <Text style={styles.ratingCount}>({business.ratingCount || 0})</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        {showDistance && business.distance !== undefined && (
          <View style={styles.stat}>
            <MapPin size={14} color="#6b7280" />
            <Text style={styles.statText}>{formatDistance(business.distance)}</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Clock size={14} color="#6b7280" />
          <Text style={styles.statText}>
            {business.avgResponseTimeHours
              ? `${business.avgResponseTimeHours}h respuesta`
              : '< 2h respuesta'}
          </Text>
        </View>
        {business.totalJobsCompleted && business.totalJobsCompleted > 0 && (
          <View style={styles.stat}>
            <Award size={14} color="#6b7280" />
            <Text style={styles.statText}>{business.totalJobsCompleted} trabajos</Text>
          </View>
        )}
      </View>

      {business.badges && business.badges.length > 0 && (
        <View style={styles.badgesRow}>
          <BadgeList badges={business.badges} limit={3} size="small" />
        </View>
      )}

      <View style={styles.footer}>
        {business.acceptsEmergency && (
          <View style={styles.emergencyBadge}>
            <Zap size={12} color="#f59e0b" />
            <Text style={styles.emergencyText}>Urgencias</Text>
          </View>
        )}
        {business.verified && (
          <View style={styles.verifiedBadge}>
            <Shield size={12} color="#16a34a" />
            <Text style={styles.verifiedText}>Verificado</Text>
          </View>
        )}
        <View style={styles.spacer} />
        <ChevronRight size={18} color="#d1d5db" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
  },
  logoPlaceholder: {
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 13,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#6b7280',
  },
  badgesRow: {
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    marginRight: 8,
  },
  emergencyText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#92400e',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#dcfce7',
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#166534',
  },
  spacer: {
    flex: 1,
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
  compactLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 4,
  },
});

export default BusinessCard;
