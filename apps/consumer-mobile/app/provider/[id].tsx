/**
 * Provider Detail Screen
 * ======================
 *
 * Shows detailed information about a service provider.
 * Features:
 * - Provider info and ratings
 * - Services offered
 * - Reviews
 * - Contact options
 * - Add to favorites
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Alert,
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
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

interface ProviderDetail {
  id: string;
  name: string;
  avatar: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  responseTime: string;
  memberSince: string;
  distance: number;
  available: boolean;
  bio: string;
  phone: string;
  services: {
    name: string;
    price: string;
  }[];
  reviews: {
    id: string;
    author: string;
    rating: number;
    date: string;
    comment: string;
    helpful: number;
  }[];
  certifications: string[];
  workingHours: {
    day: string;
    hours: string;
  }[];
}

const mockProvider: ProviderDetail = {
  id: '1',
  name: 'Carlos Méndez',
  avatar: 'CM',
  verified: true,
  rating: 4.9,
  reviewCount: 127,
  completedJobs: 342,
  responseTime: '~15 min',
  memberSince: 'Marzo 2022',
  distance: 1.2,
  available: true,
  bio: 'Plomero matriculado con más de 15 años de experiencia. Especializado en reparaciones, instalaciones y emergencias. Trabajo garantizado.',
  phone: '+54 11 2345-6789',
  services: [
    { name: 'Reparación de cañerías', price: 'Desde $8.000' },
    { name: 'Destapaciones', price: 'Desde $6.500' },
    { name: 'Instalación sanitaria', price: 'Presupuesto' },
    { name: 'Grifería', price: 'Desde $4.000' },
    { name: 'Termo tanques', price: 'Desde $12.000' },
  ],
  reviews: [
    {
      id: '1',
      author: 'Ana M.',
      rating: 5,
      date: 'Hace 3 días',
      comment: 'Excelente trabajo! Llegó puntual y resolvió el problema rápidamente. Muy recomendable.',
      helpful: 12,
    },
    {
      id: '2',
      author: 'Roberto P.',
      rating: 5,
      date: 'Hace 1 semana',
      comment: 'Muy profesional. Explicó todo el proceso y dejó todo limpio. Precio justo.',
      helpful: 8,
    },
    {
      id: '3',
      author: 'María L.',
      rating: 4,
      date: 'Hace 2 semanas',
      comment: 'Buen servicio, aunque tardó un poco más de lo esperado. Trabajo de calidad.',
      helpful: 5,
    },
  ],
  certifications: [
    'Matrícula Plomero GCBA #12345',
    'Certificado Gasista',
  ],
  workingHours: [
    { day: 'Lunes a Viernes', hours: '8:00 - 20:00' },
    { day: 'Sábados', hours: '9:00 - 14:00' },
    { day: 'Domingos', hours: 'Emergencias' },
  ],
};

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isFavorite, setIsFavorite] = useState(false);

  const { data: provider, isLoading } = useQuery({
    queryKey: ['provider', id],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return mockProvider;
    },
  });

  const handleCall = () => {
    if (provider?.phone) {
      Linking.openURL(`tel:${provider.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (provider?.phone) {
      const phoneNumber = provider.phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=${phoneNumber}`);
    }
  };

  const handleShare = () => {
    Alert.alert('Compartir', 'Función de compartir próximamente');
  };

  const handleRequestQuote = () => {
    Alert.alert(
      'Solicitar presupuesto',
      'Esta función estará disponible próximamente. Por ahora, podés contactar al profesional directamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Llamar', onPress: handleCall },
        { text: 'WhatsApp', onPress: handleWhatsApp },
      ]
    );
  };

  if (isLoading || !provider) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

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
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{provider.avatar}</Text>
            {provider.verified && (
              <View style={styles.verifiedBadge}>
                <Check size={12} color="#fff" />
              </View>
            )}
          </View>

          <Text style={styles.providerName}>{provider.name}</Text>

          {provider.verified && (
            <View style={styles.verifiedTag}>
              <Shield size={14} color="#3b82f6" />
              <Text style={styles.verifiedTagText}>Profesional verificado</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.statValue}>{provider.rating}</Text>
              <Text style={styles.statLabel}>({provider.reviewCount})</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{provider.completedJobs}</Text>
              <Text style={styles.statLabel}>trabajos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MapPin size={16} color="#6b7280" />
              <Text style={styles.statValue}>{provider.distance}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
          </View>

          <View style={styles.infoTags}>
            <View style={styles.infoTag}>
              <Clock size={14} color="#059669" />
              <Text style={styles.infoTagText}>Responde {provider.responseTime}</Text>
            </View>
            <View style={[
              styles.availabilityTag,
              provider.available ? styles.availableTag : styles.unavailableTag,
            ]}>
              <Text style={[
                styles.availabilityTagText,
                provider.available ? styles.availableTagText : styles.unavailableTagText,
              ]}>
                {provider.available ? 'Disponible ahora' : 'No disponible'}
              </Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre mí</Text>
          <Text style={styles.bioText}>{provider.bio}</Text>
        </View>

        {/* Services Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Servicios</Text>
          <View style={styles.servicesCard}>
            {provider.services.map((service, index) => (
              <View
                key={index}
                style={[
                  styles.serviceItem,
                  index < provider.services.length - 1 && styles.serviceItemBorder,
                ]}
              >
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.servicePrice}>{service.price}</Text>
              </View>
            ))}
          </View>
        </View>

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
                key={index}
                style={[
                  styles.hoursItem,
                  index < provider.workingHours.length - 1 && styles.hoursItemBorder,
                ]}
              >
                <Text style={styles.hoursDay}>{schedule.day}</Text>
                <Text style={styles.hoursTime}>{schedule.hours}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reseñas</Text>
            <Pressable style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>Ver todas</Text>
              <ChevronRight size={16} color="#059669" />
            </Pressable>
          </View>

          {provider.reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewAuthor}>{review.author}</Text>
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
                <Text style={styles.reviewDate}>{review.date}</Text>
              </View>
              <Text style={styles.reviewComment}>{review.comment}</Text>
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
          </Pressable>
        </View>
        <Pressable style={styles.requestButton} onPress={handleRequestQuote}>
          <Calendar size={20} color="#fff" />
          <Text style={styles.requestButtonText}>Solicitar presupuesto</Text>
        </Pressable>
      </View>
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
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 24,
    paddingHorizontal: 20,
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
    marginBottom: 16,
    position: 'relative',
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  providerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
    marginBottom: 16,
  },
  verifiedTagText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  },
  infoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  infoTagText: {
    fontSize: 13,
    color: '#374151',
  },
  availabilityTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    fontWeight: '500',
  },
  availableTagText: {
    color: '#059669',
  },
  unavailableTagText: {
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
  serviceName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
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
    marginBottom: 8,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  reviewRating: {
    flexDirection: 'row',
    marginRight: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  reviewComment: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 10,
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
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 16,
    fontWeight: '600',
  },
});
