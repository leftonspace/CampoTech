/**
 * Business Profile Screen
 * =======================
 *
 * Phase 15: Consumer Marketplace
 * Detailed view of a service provider with:
 * - Photos and basic info
 * - Rating breakdown
 * - Services offered
 * - Reviews
 * - Contact CTA
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Shield,
  MessageSquare,
  Phone,
  ChevronRight,
  Award,
  ThumbsUp,
  Calendar,
} from 'lucide-react-native';

import { RatingStars } from '../../../components/consumer/RatingStars';
import { ReviewCard } from '../../../components/consumer/ReviewCard';
import { BadgeList } from '../../../components/consumer/BadgeList';
import { useBusinessProfile } from '../../../lib/consumer/hooks/use-discovery';

export default function BusinessProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, reviews, isLoading, error } = useBusinessProfile(id);

  const handleRequestQuote = () => {
    router.push({
      pathname: '/(consumer)/request/new',
      params: { businessId: id },
    });
  };

  const handleViewAllReviews = () => {
    // Would navigate to full reviews list
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !business) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se pudo cargar el perfil</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header with cover photo */}
        <View style={styles.headerSection}>
          {business.coverPhotoUrl ? (
            <Image source={{ uri: business.coverPhotoUrl }} style={styles.coverPhoto} />
          ) : (
            <View style={[styles.coverPhoto, styles.coverPlaceholder]} />
          )}

          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>

          {/* Profile info overlay */}
          <View style={styles.profileOverlay}>
            <View style={styles.logoContainer}>
              {business.logoUrl ? (
                <Image source={{ uri: business.logoUrl }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoPlaceholder]}>
                  <Text style={styles.logoText}>
                    {business.displayName?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.businessName}>{business.displayName}</Text>
            <Text style={styles.shortDescription} numberOfLines={2}>
              {business.shortDescription || 'Servicio profesional de calidad'}
            </Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Star size={18} color="#f59e0b" fill="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{business.overallRating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.statLabel}>({business.ratingCount || 0})</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Clock size={18} color="#0284c7" />
            </View>
            <Text style={styles.statValue}>
              {business.avgResponseTimeHours ? `${business.avgResponseTimeHours}h` : '< 2h'}
            </Text>
            <Text style={styles.statLabel}>respuesta</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Award size={18} color="#16a34a" />
            </View>
            <Text style={styles.statValue}>{business.totalJobsCompleted || 0}</Text>
            <Text style={styles.statLabel}>trabajos</Text>
          </View>
        </View>

        {/* Badges */}
        {business.badges && business.badges.length > 0 && (
          <View style={styles.section}>
            <BadgeList badges={business.badges} />
          </View>
        )}

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acerca de</Text>
          <Text style={styles.description}>
            {business.description || 'Este profesional no ha agregado una descripcion aun.'}
          </Text>
        </View>

        {/* Services */}
        {business.services && business.services.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Servicios</Text>
            {business.services.map((service: any, index: number) => (
              <View key={index} style={styles.serviceItem}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  {service.description && (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  )}
                </View>
                {service.priceRange && (
                  <Text style={styles.servicePrice}>{service.priceRange}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Location / Service Areas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zona de servicio</Text>
          <View style={styles.locationItem}>
            <MapPin size={18} color="#6b7280" />
            <Text style={styles.locationText}>
              {business.serviceAreas?.map((a: any) => a.neighborhood || a.city).join(', ') ||
                'Buenos Aires y alrededores'}
            </Text>
          </View>
          {business.maxTravelDistanceKm && (
            <Text style={styles.distanceNote}>
              Viaja hasta {business.maxTravelDistanceKm} km
            </Text>
          )}
        </View>

        {/* Ratings breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Valoraciones</Text>
            <View style={styles.overallRating}>
              <Text style={styles.overallRatingValue}>
                {business.overallRating?.toFixed(1) || '0.0'}
              </Text>
              <RatingStars rating={business.overallRating || 0} size={16} />
              <Text style={styles.overallRatingCount}>
                ({business.ratingCount || 0} opiniones)
              </Text>
            </View>
          </View>

          <View style={styles.ratingsBreakdown}>
            {[
              { label: 'Puntualidad', value: business.punctualityRating },
              { label: 'Calidad', value: business.qualityRating },
              { label: 'Precio', value: business.priceRating },
              { label: 'Comunicacion', value: business.communicationRating },
            ].map((item, index) => (
              <View key={index} style={styles.ratingItem}>
                <Text style={styles.ratingLabel}>{item.label}</Text>
                <View style={styles.ratingBar}>
                  <View
                    style={[
                      styles.ratingBarFill,
                      { width: `${((item.value || 0) / 5) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.ratingValue}>
                  {item.value?.toFixed(1) || '-'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Opiniones recientes</Text>
            {reviews && reviews.length > 3 && (
              <TouchableOpacity onPress={handleViewAllReviews}>
                <Text style={styles.seeAllLink}>Ver todas</Text>
              </TouchableOpacity>
            )}
          </View>

          {reviews && reviews.length > 0 ? (
            reviews.slice(0, 3).map((review: any) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <View style={styles.noReviews}>
              <MessageSquare size={32} color="#d1d5db" />
              <Text style={styles.noReviewsText}>
                Aun no hay opiniones para este profesional
              </Text>
            </View>
          )}
        </View>

        {/* Bottom spacing for fixed CTA */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Fixed CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity style={styles.ctaButton} onPress={handleRequestQuote}>
          <Calendar size={20} color="#fff" />
          <Text style={styles.ctaButtonText}>Solicitar presupuesto</Text>
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0284c7',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  headerSection: {
    position: 'relative',
  },
  coverPhoto: {
    width: '100%',
    height: 180,
  },
  coverPlaceholder: {
    backgroundColor: '#e5e7eb',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileOverlay: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
  logoPlaceholder: {
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  businessName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  shortDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statItem: {
    alignItems: 'center',
  },
  statIconContainer: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  seeAllLink: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  serviceInfo: {
    flex: 1,
    marginRight: 16,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284c7',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
  },
  distanceNote: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
  },
  overallRating: {
    alignItems: 'flex-end',
  },
  overallRatingValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  overallRatingCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  ratingsBreakdown: {
    gap: 12,
  },
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingLabel: {
    width: 100,
    fontSize: 14,
    color: '#374151',
  },
  ratingBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  ratingValue: {
    width: 30,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'right',
  },
  noReviews: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noReviewsText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  bottomSpacer: {
    height: 100,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 12,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
