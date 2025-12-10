/**
 * Business Profile Screen
 * =======================
 *
 * Detailed business profile view.
 * Phase 15: Consumer Marketplace
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { consumerApi } from '../services/api-client';
import { useAuth } from '../store/auth-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface BusinessDetail {
  id: string;
  displayName: string;
  slug: string;
  logoUrl?: string;
  coverPhotoUrl?: string;
  description?: string;
  shortDescription?: string;
  galleryPhotos: string[];
  workShowcase: Array<{
    imageUrl: string;
    title?: string;
    description?: string;
  }>;
  categories: string[];
  services: Array<{
    name: string;
    description?: string;
    priceRange?: { min: number; max: number };
  }>;
  serviceAreas: string[];
  workingHours: Record<string, { open: string; close: string }>;
  acceptsEmergency: boolean;
  acceptingNewClients: boolean;
  badges: string[];
  overallRating: number;
  ratingCount: number;
  punctualityRating?: number;
  qualityRating?: number;
  priceRating?: number;
  communicationRating?: number;
  totalJobsCompleted: number;
  yearsOnPlatform: number;
  cuitVerified: boolean;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  highlights: string[];
}

interface Review {
  id: string;
  consumerName: string;
  overallRating: number;
  comment?: string;
  businessResponse?: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BusinessProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isAuthenticated } = useAuth();

  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'about' | 'services' | 'reviews'>('about');

  const businessId = route.params?.id;

  useEffect(() => {
    loadBusiness();
    loadReviews();
    if (isAuthenticated) {
      checkFavorite();
    }
  }, [businessId]);

  const loadBusiness = async () => {
    try {
      const response = await consumerApi.discover.business(businessId);
      if (response.success && response.data) {
        setBusiness(response.data);
      }
    } catch (error) {
      console.error('Failed to load business:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await consumerApi.reviews.forBusiness(businessId, { limit: 5 });
      if (response.success && response.data) {
        setReviews(response.data);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const checkFavorite = async () => {
    try {
      const response = await consumerApi.favorites.check(businessId);
      if (response.success && response.data) {
        setIsFavorite(response.data.isFavorite);
      }
    } catch (error) {
      // Ignore
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }

    try {
      if (isFavorite) {
        await consumerApi.favorites.remove(businessId);
      } else {
        await consumerApi.favorites.add(businessId);
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleRequestQuote = () => {
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    navigation.navigate('CreateRequest', {
      preselectedBusiness: business?.id,
      category: business?.categories[0],
    });
  };

  const handleShareProfile = async () => {
    // Share functionality
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#CCC" />
        <Text style={styles.errorText}>No se pudo cargar el perfil</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadBusiness}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.headerImage}>
          {business.coverPhotoUrl ? (
            <Image
              source={{ uri: business.coverPhotoUrl }}
              style={styles.coverImage}
            />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <View style={styles.headerOverlay}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={toggleFavorite}
              >
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isFavorite ? '#EF4444' : '#FFF'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleShareProfile}
              >
                <Ionicons name="share-outline" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <View style={styles.logoContainer}>
            {business.logoUrl ? (
              <Image source={{ uri: business.logoUrl }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}>
                <Text style={styles.logoPlaceholderText}>
                  {business.displayName.charAt(0)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.businessName}>{business.displayName}</Text>
          <Text style={styles.categories}>
            {business.categories.join(' • ')}
          </Text>

          {/* Ratings */}
          <View style={styles.ratingsRow}>
            <View style={styles.mainRating}>
              <Ionicons name="star" size={20} color="#FFB800" />
              <Text style={styles.ratingValue}>
                {business.overallRating.toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>
                ({business.ratingCount} reseñas)
              </Text>
            </View>
            {business.totalJobsCompleted > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {business.totalJobsCompleted}
                </Text>
                <Text style={styles.statLabel}>trabajos</Text>
              </View>
            )}
            {business.yearsOnPlatform > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {business.yearsOnPlatform}
                </Text>
                <Text style={styles.statLabel}>
                  {business.yearsOnPlatform === 1 ? 'año' : 'años'}
                </Text>
              </View>
            )}
          </View>

          {/* Badges */}
          <View style={styles.badgesRow}>
            {business.badges.map(badge => (
              <View key={badge} style={styles.badge}>
                <Ionicons
                  name={getBadgeIcon(badge)}
                  size={14}
                  color="#0369A1"
                />
                <Text style={styles.badgeText}>{getBadgeLabel(badge)}</Text>
              </View>
            ))}
          </View>

          {/* Highlights */}
          {business.highlights?.length > 0 && (
            <View style={styles.highlights}>
              {business.highlights.map((highlight, index) => (
                <View key={index} style={styles.highlightItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.highlightText}>{highlight}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'about' && styles.tabActive]}
            onPress={() => setActiveTab('about')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'about' && styles.tabTextActive,
              ]}
            >
              Información
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'services' && styles.tabActive]}
            onPress={() => setActiveTab('services')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'services' && styles.tabTextActive,
              ]}
            >
              Servicios
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'reviews' && styles.tabTextActive,
              ]}
            >
              Reseñas
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'about' && (
            <AboutTab business={business} />
          )}
          {activeTab === 'services' && (
            <ServicesTab services={business.services} />
          )}
          {activeTab === 'reviews' && (
            <ReviewsTab
              reviews={reviews}
              business={business}
              onSeeAll={() => navigation.navigate('Reviews', { businessId })}
            />
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* CTA Button */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleRequestQuote}
        >
          <Text style={styles.ctaButtonText}>Solicitar cotización</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function AboutTab({ business }: { business: BusinessDetail }) {
  return (
    <View>
      {/* Description */}
      {business.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acerca de</Text>
          <Text style={styles.description}>{business.description}</Text>
        </View>
      )}

      {/* Verifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verificaciones</Text>
        <View style={styles.verifications}>
          <VerificationItem
            label="CUIT verificado"
            verified={business.cuitVerified}
          />
          <VerificationItem
            label="Habilitación profesional"
            verified={business.licenseVerified}
          />
          <VerificationItem
            label="Seguro vigente"
            verified={business.insuranceVerified}
          />
        </View>
      </View>

      {/* Service Areas */}
      {business.serviceAreas?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zonas de cobertura</Text>
          <View style={styles.serviceAreas}>
            {business.serviceAreas.map((area, index) => (
              <View key={index} style={styles.areaChip}>
                <Ionicons name="location-outline" size={14} color="#666" />
                <Text style={styles.areaText}>{area}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Working Hours */}
      {business.workingHours && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Horarios de atención</Text>
          <WorkingHours hours={business.workingHours} />
        </View>
      )}

      {/* Gallery */}
      {business.galleryPhotos?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Galería</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
          >
            {business.galleryPhotos.map((photo, index) => (
              <Image
                key={index}
                source={{ uri: photo }}
                style={styles.galleryImage}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function ServicesTab({
  services,
}: {
  services: Array<{
    name: string;
    description?: string;
    priceRange?: { min: number; max: number };
  }>;
}) {
  if (!services || services.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Text style={styles.emptyText}>
          No hay servicios específicos listados
        </Text>
      </View>
    );
  }

  return (
    <View>
      {services.map((service, index) => (
        <View key={index} style={styles.serviceItem}>
          <View style={styles.serviceHeader}>
            <Text style={styles.serviceName}>{service.name}</Text>
            {service.priceRange && (
              <Text style={styles.servicePrice}>
                ${service.priceRange.min.toLocaleString()} -{' '}
                ${service.priceRange.max.toLocaleString()}
              </Text>
            )}
          </View>
          {service.description && (
            <Text style={styles.serviceDescription}>
              {service.description}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function ReviewsTab({
  reviews,
  business,
  onSeeAll,
}: {
  reviews: Review[];
  business: BusinessDetail;
  onSeeAll: () => void;
}) {
  return (
    <View>
      {/* Rating Breakdown */}
      <View style={styles.ratingBreakdown}>
        <View style={styles.mainRatingLarge}>
          <Text style={styles.mainRatingValue}>
            {business.overallRating.toFixed(1)}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <Ionicons
                key={star}
                name={star <= business.overallRating ? 'star' : 'star-outline'}
                size={16}
                color="#FFB800"
              />
            ))}
          </View>
          <Text style={styles.reviewCountText}>
            {business.ratingCount} reseñas
          </Text>
        </View>
        <View style={styles.detailedRatings}>
          <RatingBar label="Puntualidad" rating={business.punctualityRating} />
          <RatingBar label="Calidad" rating={business.qualityRating} />
          <RatingBar label="Precio" rating={business.priceRating} />
          <RatingBar label="Comunicación" rating={business.communicationRating} />
        </View>
      </View>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyText}>Aún no hay reseñas</Text>
        </View>
      ) : (
        <>
          {reviews.map(review => (
            <View key={review.id} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{review.consumerName}</Text>
                <View style={styles.reviewRating}>
                  <Ionicons name="star" size={14} color="#FFB800" />
                  <Text style={styles.reviewRatingText}>
                    {review.overallRating}
                  </Text>
                </View>
              </View>
              {review.comment && (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              )}
              <Text style={styles.reviewDate}>
                {formatDate(review.createdAt)}
              </Text>
              {review.businessResponse && (
                <View style={styles.businessResponse}>
                  <Text style={styles.responseLabel}>Respuesta:</Text>
                  <Text style={styles.responseText}>
                    {review.businessResponse}
                  </Text>
                </View>
              )}
            </View>
          ))}
          {business.ratingCount > 5 && (
            <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAll}>
              <Text style={styles.seeAllText}>
                Ver todas las reseñas ({business.ratingCount})
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function VerificationItem({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) {
  return (
    <View style={styles.verificationItem}>
      <Ionicons
        name={verified ? 'checkmark-circle' : 'close-circle'}
        size={20}
        color={verified ? '#10B981' : '#9CA3AF'}
      />
      <Text
        style={[
          styles.verificationText,
          !verified && styles.verificationTextInactive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function WorkingHours({
  hours,
}: {
  hours: Record<string, { open: string; close: string }>;
}) {
  const days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  return (
    <View>
      {days.map(day => {
        const dayHours = hours[day.key];
        return (
          <View key={day.key} style={styles.hoursRow}>
            <Text style={styles.dayLabel}>{day.label}</Text>
            <Text style={styles.hoursText}>
              {dayHours ? `${dayHours.open} - ${dayHours.close}` : 'Cerrado'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function RatingBar({ label, rating }: { label: string; rating?: number }) {
  return (
    <View style={styles.ratingBarRow}>
      <Text style={styles.ratingBarLabel}>{label}</Text>
      <View style={styles.ratingBarContainer}>
        <View
          style={[
            styles.ratingBarFill,
            { width: `${((rating || 0) / 5) * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.ratingBarValue}>
        {rating?.toFixed(1) || '-'}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getBadgeIcon(badge: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    verified: 'shield-checkmark',
    top_rated: 'star',
    fast_responder: 'flash',
    experienced: 'trophy',
    emergency_available: 'alert-circle',
    insured: 'umbrella',
    licensed: 'document-text',
  };
  return icons[badge] || 'checkmark-circle';
}

function getBadgeLabel(badge: string): string {
  const labels: Record<string, string> = {
    verified: 'Verificado',
    top_rated: 'Top',
    fast_responder: 'Respuesta rápida',
    experienced: 'Experimentado',
    emergency_available: 'Emergencias 24/7',
    insured: 'Asegurado',
    licensed: 'Habilitado',
  };
  return labels[badge] || badge;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  headerImage: {
    height: 200,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  profileInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop: -40,
  },
  logoContainer: {
    marginBottom: 12,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  logoPlaceholder: {
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#2563EB',
  },
  businessName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  categories: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 20,
  },
  mainRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
  },
  highlights: {
    marginTop: 16,
    width: '100%',
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  highlightText: {
    fontSize: 14,
    color: '#374151',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
  },
  tabTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  tabContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  verifications: {
    gap: 8,
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationText: {
    fontSize: 14,
    color: '#374151',
  },
  verificationTextInactive: {
    color: '#9CA3AF',
  },
  serviceAreas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  areaText: {
    fontSize: 13,
    color: '#4B5563',
  },
  gallery: {
    marginTop: 8,
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
  },
  emptyTab: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  serviceItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  servicePrice: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  serviceDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  ratingBreakdown: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 20,
  },
  mainRatingLarge: {
    alignItems: 'center',
  },
  mainRatingValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  starsRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  reviewCountText: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailedRatings: {
    flex: 1,
    justifyContent: 'center',
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingBarLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 80,
  },
  ratingBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#FFB800',
    borderRadius: 3,
  },
  ratingBarValue: {
    fontSize: 12,
    color: '#6B7280',
    width: 24,
    textAlign: 'right',
  },
  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviewComment: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  businessResponse: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 13,
    color: '#4B5563',
  },
  seeAllButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dayLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  hoursText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 100,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 34,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  ctaButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
