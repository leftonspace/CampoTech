/**
 * Provider Detail Screen
 * ======================
 *
 * Shows detailed public profile of a service provider.
 * Features:
 * - Cover photo and logo
 * - Verification badges (CUIT, insurance, license)
 * - Services with pricing
 * - Photos gallery (job photos)
 * - Reviews with ratings
 * - WhatsApp contact with pre-filled message
 * - Quote request button
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Image,
  Modal,
  Dimensions,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  Heart,
  Check,
  Share2,
  Shield,
  Calendar,
  ChevronRight,
  ThumbsUp,
  Camera,
  X,
  BadgeCheck,
  FileCheck,
  Building2,
  Zap,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import {
  BusinessPublicProfile,
  CATEGORY_INFO,
  type ServiceCategory,
} from '@/lib/types/business-profile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Enhanced mock provider data
const mockProvider: BusinessPublicProfile = {
  id: '1',
  organizationId: 'org-1',
  displayName: 'Plomería Méndez',
  description:
    'Servicio profesional de plomería con más de 15 años de experiencia. Especializado en reparaciones, instalaciones y emergencias las 24 horas. Trabajo garantizado y precios justos.',
  logo: undefined,
  coverPhoto: undefined,
  avatar: 'PM',
  categories: ['plomeria', 'gas'],
  services: [
    {
      id: '1',
      name: 'Reparación de cañerías',
      description: 'Reparación de todo tipo de cañerías',
      priceType: 'from',
      price: 8000,
    },
    {
      id: '2',
      name: 'Destapaciones',
      description: 'Destapación de cañerías y desagües',
      priceType: 'from',
      price: 6500,
    },
    {
      id: '3',
      name: 'Instalación sanitaria',
      priceType: 'quote',
    },
    {
      id: '4',
      name: 'Grifería',
      description: 'Instalación y reparación de grifería',
      priceType: 'from',
      price: 4000,
    },
    {
      id: '5',
      name: 'Termo tanques',
      description: 'Instalación y service de termo tanques',
      priceType: 'from',
      price: 12000,
    },
  ],
  serviceArea: {
    type: 'radius',
    radiusKm: 15,
    zones: ['Palermo', 'Recoleta', 'Belgrano', 'Núñez', 'Colegiales'],
  },
  address: 'Palermo, CABA',
  city: 'Buenos Aires',
  province: 'CABA',
  whatsappNumber: '+5491123456789',
  phone: '+54 11 2345-6789',
  averageRating: 4.9,
  totalReviews: 127,
  totalJobs: 342,
  responseRate: 98,
  responseTimeMinutes: 15,
  verification: {
    cuitVerified: true,
    insuranceVerified: true,
    backgroundCheck: false,
    professionalLicense: true,
  },
  memberSince: 'Marzo 2022',
  isActive: true,
  isAvailable: true,
  photos: [
    {
      id: '1',
      url: 'https://placeholder.com/photo1.jpg',
      caption: 'Instalación de cañería nueva',
      jobType: 'Instalación',
      createdAt: '2024-01-10',
    },
    {
      id: '2',
      url: 'https://placeholder.com/photo2.jpg',
      caption: 'Reparación de pérdida',
      jobType: 'Reparación',
      createdAt: '2024-01-08',
    },
    {
      id: '3',
      url: 'https://placeholder.com/photo3.jpg',
      caption: 'Instalación termo tanque',
      jobType: 'Instalación',
      createdAt: '2024-01-05',
    },
    {
      id: '4',
      url: 'https://placeholder.com/photo4.jpg',
      caption: 'Destapación de desagüe',
      jobType: 'Mantenimiento',
      createdAt: '2024-01-03',
    },
  ],
  reviews: [
    {
      id: '1',
      authorName: 'Ana M.',
      authorInitials: 'AM',
      rating: 5,
      comment:
        'Excelente trabajo! Llegó puntual y resolvió el problema rápidamente. Muy recomendable.',
      serviceType: 'Destapación',
      createdAt: '2024-01-12',
      helpful: 12,
    },
    {
      id: '2',
      authorName: 'Roberto P.',
      authorInitials: 'RP',
      rating: 5,
      comment:
        'Muy profesional. Explicó todo el proceso y dejó todo limpio. Precio justo.',
      serviceType: 'Reparación de cañería',
      createdAt: '2024-01-08',
      helpful: 8,
      response: {
        text: 'Gracias Roberto! Fue un gusto atenderte.',
        createdAt: '2024-01-09',
      },
    },
    {
      id: '3',
      authorName: 'María L.',
      authorInitials: 'ML',
      rating: 4,
      comment:
        'Buen servicio, aunque tardó un poco más de lo esperado. Trabajo de calidad.',
      serviceType: 'Instalación sanitaria',
      createdAt: '2024-01-01',
      helpful: 5,
    },
  ],
  certifications: [
    'Matrícula Plomero GCBA #12345',
    'Certificado Gasista Matriculado',
    'Seguro de Responsabilidad Civil',
  ],
  workingHours: [
    { dayOfWeek: 1, dayName: 'Lunes', isOpen: true, openTime: '08:00', closeTime: '20:00' },
    { dayOfWeek: 2, dayName: 'Martes', isOpen: true, openTime: '08:00', closeTime: '20:00' },
    { dayOfWeek: 3, dayName: 'Miércoles', isOpen: true, openTime: '08:00', closeTime: '20:00' },
    { dayOfWeek: 4, dayName: 'Jueves', isOpen: true, openTime: '08:00', closeTime: '20:00' },
    { dayOfWeek: 5, dayName: 'Viernes', isOpen: true, openTime: '08:00', closeTime: '20:00' },
    { dayOfWeek: 6, dayName: 'Sábado', isOpen: true, openTime: '09:00', closeTime: '14:00' },
    { dayOfWeek: 0, dayName: 'Domingo', isOpen: true, note: 'Solo emergencias' },
  ],
  distance: 1.2,
};

export default function ProviderDetailScreen() {
  const { id, category } = useLocalSearchParams<{ id: string; category?: string }>();
  const [isFavorite, setIsFavorite] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  const { data: provider, isLoading } = useQuery({
    queryKey: ['provider', id],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockProvider;
    },
  });

  // Get user location for WhatsApp message
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        return location.coords;
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
    return null;
  }, []);

  const handleCall = () => {
    if (provider?.phone) {
      Linking.openURL(`tel:${provider.phone}`);
    }
  };

  const handleWhatsApp = async () => {
    if (!provider?.whatsappNumber) return;

    // Get user location for the message
    const location = await getUserLocation();

    // Build pre-filled message
    const categoryName = category
      ? CATEGORY_INFO[category as ServiceCategory]?.name || category
      : provider.categories[0]
        ? CATEGORY_INFO[provider.categories[0]]?.name
        : 'servicios';

    let message = `Hola! Te contacto desde CampoTech.\n\n`;
    message += `Estoy buscando ${categoryName}.\n`;

    if (location) {
      message += `Mi ubicación: https://maps.google.com/?q=${location.latitude},${location.longitude}\n`;
    }

    message += `\n¿Podrías darme más información sobre tus servicios?`;

    const phoneNumber = provider.whatsappNumber.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);

    // Track this as a lead (in real app, call API)
    console.log('Lead tracked:', {
      providerId: provider.id,
      type: 'whatsapp',
      category,
      location,
    });

    Linking.openURL(`whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`);
  };

  const handleShare = async () => {
    // In real app, use Share API
    const shareUrl = `https://campotech.com.ar/p/${provider?.id}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(`Mirá este profesional en CampoTech: ${shareUrl}`)}`);
  };

  const handleRequestQuote = () => {
    router.push({
      pathname: '/(booking)/request/[providerId]',
      params: { providerId: provider?.id || '', category: category || provider?.categories[0] || '' },
    });
  };

  const openPhoto = (index: number) => {
    setSelectedPhotoIndex(index);
    setShowPhotoGallery(true);
  };

  const formatPrice = (service: (typeof mockProvider.services)[0]) => {
    if (service.priceType === 'quote') return 'Presupuesto';
    if (service.priceType === 'from' && service.price) {
      return `Desde $${service.price.toLocaleString('es-AR')}`;
    }
    if (service.price) {
      return `$${service.price.toLocaleString('es-AR')}`;
    }
    return 'Consultar';
  };

  if (isLoading || !provider) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const verificationBadges = [
    {
      key: 'cuit',
      verified: provider.verification.cuitVerified,
      label: 'CUIT Verificado',
      icon: Building2,
    },
    {
      key: 'insurance',
      verified: provider.verification.insuranceVerified,
      label: 'Asegurado',
      icon: Shield,
    },
    {
      key: 'license',
      verified: provider.verification.professionalLicense,
      label: 'Matriculado',
      icon: FileCheck,
    },
  ].filter((b) => b.verified);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerTransparent: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft size={24} color="#111827" />
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <Pressable onPress={handleShare} style={styles.headerButton}>
                <Share2 size={22} color="#111827" />
              </Pressable>
              <Pressable
                onPress={() => setIsFavorite(!isFavorite)}
                style={styles.headerButton}
              >
                <Heart
                  size={22}
                  color={isFavorite ? '#ef4444' : '#111827'}
                  fill={isFavorite ? '#ef4444' : 'transparent'}
                />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          {provider.coverPhoto ? (
            <Image source={{ uri: provider.coverPhoto }} style={styles.coverPhoto} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <View style={styles.coverGradient} />
            </View>
          )}
        </View>

        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {provider.logo ? (
              <Image source={{ uri: provider.logo }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{provider.avatar}</Text>
            )}
            {provider.verification.cuitVerified && (
              <View style={styles.verifiedBadge}>
                <BadgeCheck size={14} color="#fff" />
              </View>
            )}
          </View>

          <Text style={styles.providerName}>{provider.displayName}</Text>

          {/* Category Tags */}
          <View style={styles.categoryTags}>
            {provider.categories.map((cat) => (
              <View
                key={cat}
                style={[
                  styles.categoryTag,
                  { backgroundColor: `${CATEGORY_INFO[cat]?.color}15` },
                ]}
              >
                <Text style={styles.categoryEmoji}>{CATEGORY_INFO[cat]?.icon}</Text>
                <Text
                  style={[styles.categoryTagText, { color: CATEGORY_INFO[cat]?.color }]}
                >
                  {CATEGORY_INFO[cat]?.name}
                </Text>
              </View>
            ))}
          </View>

          {/* Verification Badges */}
          {verificationBadges.length > 0 && (
            <View style={styles.verificationRow}>
              {verificationBadges.map((badge) => (
                <View key={badge.key} style={styles.verificationBadgeItem}>
                  <badge.icon size={14} color="#059669" />
                  <Text style={styles.verificationBadgeText}>{badge.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.statValue}>{provider.averageRating}</Text>
              <Text style={styles.statLabel}>({provider.totalReviews})</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{provider.totalJobs}</Text>
              <Text style={styles.statLabel}>trabajos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MapPin size={16} color="#6b7280" />
              <Text style={styles.statValue}>{provider.distance}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
          </View>

          {/* Info Tags */}
          <View style={styles.infoTags}>
            <View style={styles.infoTag}>
              <Clock size={14} color="#059669" />
              <Text style={styles.infoTagText}>
                Responde en ~{provider.responseTimeMinutes} min
              </Text>
            </View>
            <View style={styles.infoTag}>
              <Zap size={14} color="#f59e0b" />
              <Text style={styles.infoTagText}>{provider.responseRate}% respuesta</Text>
            </View>
          </View>

          <View
            style={[
              styles.availabilityTag,
              provider.isAvailable ? styles.availableTag : styles.unavailableTag,
            ]}
          >
            <Text
              style={[
                styles.availabilityTagText,
                provider.isAvailable ? styles.availableText : styles.unavailableText,
              ]}
            >
              {provider.isAvailable ? 'Disponible ahora' : 'No disponible'}
            </Text>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre nosotros</Text>
          <Text style={styles.bioText}>{provider.description}</Text>
          {provider.address && (
            <View style={styles.locationRow}>
              <MapPin size={14} color="#6b7280" />
              <Text style={styles.locationText}>
                {provider.address}, {provider.city}
              </Text>
            </View>
          )}
          {provider.serviceArea.zones && (
            <Text style={styles.zonesText}>
              Zonas: {provider.serviceArea.zones.join(', ')}
            </Text>
          )}
        </View>

        {/* Services Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servicios</Text>
          <View style={styles.servicesCard}>
            {provider.services.map((service, index) => (
              <View
                key={service.id}
                style={[
                  styles.serviceItem,
                  index < provider.services.length - 1 && styles.serviceItemBorder,
                ]}
              >
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  {service.description && (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  )}
                </View>
                <Text style={styles.servicePrice}>{formatPrice(service)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Photos Gallery Section */}
        {provider.photos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trabajos realizados</Text>
              <Pressable
                style={styles.seeAllButton}
                onPress={() => setShowPhotoGallery(true)}
              >
                <Camera size={16} color="#059669" />
                <Text style={styles.seeAllText}>Ver todos ({provider.photos.length})</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosScroll}
            >
              {provider.photos.slice(0, 4).map((photo, index) => (
                <Pressable
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => openPhoto(index)}
                >
                  <View style={styles.photoPlaceholder}>
                    <Camera size={24} color="#9ca3af" />
                    <Text style={styles.photoPlaceholderText}>{photo.jobType}</Text>
                  </View>
                  {photo.caption && (
                    <Text style={styles.photoCaption} numberOfLines={1}>
                      {photo.caption}
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Certifications Section */}
        {provider.certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certificaciones</Text>
            <View style={styles.certificationsCard}>
              {provider.certifications.map((cert, index) => (
                <View key={index} style={styles.certificationItem}>
                  <Check size={16} color="#059669" />
                  <Text style={styles.certificationText}>{cert}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Working Hours Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Horarios de atención</Text>
          <View style={styles.hoursCard}>
            {provider.workingHours.map((schedule, index) => (
              <View
                key={schedule.dayOfWeek}
                style={[
                  styles.hoursItem,
                  index < provider.workingHours.length - 1 && styles.hoursItemBorder,
                ]}
              >
                <Text style={styles.hoursDay}>{schedule.dayName}</Text>
                <Text style={styles.hoursTime}>
                  {schedule.note
                    ? schedule.note
                    : schedule.isOpen
                      ? `${schedule.openTime} - ${schedule.closeTime}`
                      : 'Cerrado'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Reseñas ({provider.totalReviews})
            </Text>
            <Pressable style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Ver todas</Text>
              <ChevronRight size={16} color="#059669" />
            </Pressable>
          </View>

          {provider.reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>{review.authorInitials}</Text>
                </View>
                <View style={styles.reviewInfo}>
                  <Text style={styles.reviewAuthor}>{review.authorName}</Text>
                  {review.serviceType && (
                    <Text style={styles.reviewService}>{review.serviceType}</Text>
                  )}
                </View>
                <View style={styles.reviewMeta}>
                  <View style={styles.reviewRating}>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        color="#f59e0b"
                        fill={i < review.rating ? '#f59e0b' : 'transparent'}
                      />
                    ))}
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.createdAt).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              </View>
              <Text style={styles.reviewComment}>{review.comment}</Text>

              {review.response && (
                <View style={styles.reviewResponse}>
                  <Text style={styles.reviewResponseLabel}>
                    Respuesta de {provider.displayName}:
                  </Text>
                  <Text style={styles.reviewResponseText}>{review.response.text}</Text>
                </View>
              )}

              <Pressable style={styles.helpfulButton}>
                <ThumbsUp size={14} color="#6b7280" />
                <Text style={styles.helpfulText}>Útil ({review.helpful})</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <View style={styles.contactButtons}>
          <Pressable style={styles.callButton} onPress={handleCall}>
            <Phone size={20} color="#059669" />
          </Pressable>
          <Pressable style={styles.whatsappButton} onPress={handleWhatsApp}>
            <MessageCircle size={20} color="#25d366" />
            <Text style={styles.whatsappLabel}>WhatsApp</Text>
          </Pressable>
        </View>
        <Pressable style={styles.requestButton} onPress={handleRequestQuote}>
          <Calendar size={20} color="#fff" />
          <Text style={styles.requestButtonText}>Pedir presupuesto</Text>
        </Pressable>
      </View>

      {/* Photo Gallery Modal */}
      <Modal
        visible={showPhotoGallery}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPhotoGallery(false)}
      >
        <View style={styles.galleryModal}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>
              Trabajos realizados ({provider.photos.length})
            </Text>
            <Pressable
              style={styles.galleryClose}
              onPress={() => setShowPhotoGallery(false)}
            >
              <X size={24} color="#fff" />
            </Pressable>
          </View>
          <FlatList
            data={provider.photos}
            horizontal
            pagingEnabled
            initialScrollIndex={selectedPhotoIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={styles.galleryItem}>
                <View style={styles.galleryPhotoPlaceholder}>
                  <Camera size={48} color="#6b7280" />
                  <Text style={styles.galleryPhotoText}>{item.jobType}</Text>
                </View>
                {item.caption && (
                  <Text style={styles.galleryCaption}>{item.caption}</Text>
                )}
              </View>
            )}
            keyExtractor={(item) => item.id}
          />
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  coverContainer: {
    height: 160,
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#059669',
  },
  coverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 24,
    paddingHorizontal: 20,
    marginTop: -44,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  providerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  categoryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  verificationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  verificationBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verificationBadgeText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  infoTags: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  infoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 6,
  },
  infoTagText: {
    fontSize: 12,
    color: '#374151',
  },
  availabilityTag: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  availableTag: {
    backgroundColor: '#d1fae5',
  },
  unavailableTag: {
    backgroundColor: '#f3f4f6',
  },
  availabilityTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  availableText: {
    color: '#059669',
  },
  unavailableText: {
    color: '#6b7280',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  bioText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
  },
  zonesText: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  servicesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  serviceItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  photosScroll: {
    gap: 12,
  },
  photoItem: {
    width: 140,
  },
  photoPlaceholder: {
    width: 140,
    height: 100,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  photoCaption: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
  },
  certificationsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  certificationText: {
    fontSize: 14,
    color: '#374151',
  },
  hoursCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  hoursItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  hoursItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  hoursDay: {
    fontSize: 14,
    color: '#374151',
  },
  hoursTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reviewAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  reviewInfo: {
    flex: 1,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  reviewService: {
    fontSize: 12,
    color: '#6b7280',
  },
  reviewMeta: {
    alignItems: 'flex-end',
  },
  reviewRating: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  reviewComment: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 10,
  },
  reviewResponse: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  reviewResponseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  reviewResponseText: {
    fontSize: 13,
    color: '#4b5563',
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helpfulText: {
    fontSize: 13,
    color: '#6b7280',
  },
  bottomSpacer: {
    height: 100,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappButton: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  whatsappLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#25d366',
  },
  requestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  galleryModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  galleryClose: {
    padding: 8,
  },
  galleryItem: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  galleryPhotoPlaceholder: {
    width: SCREEN_WIDTH - 40,
    height: 300,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPhotoText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  galleryCaption: {
    fontSize: 14,
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
});
