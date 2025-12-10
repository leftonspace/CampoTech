/**
 * Job Tracking Screen
 * ===================
 *
 * Track job progress with timeline updates.
 * Phase 15: Consumer Marketplace (reuses Phase 9.9 tracking concepts)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { consumerApi } from '../services/api-client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'message' | 'photo' | 'note' | 'schedule';
  title: string;
  description?: string;
  imageUrl?: string;
  createdAt: string;
  createdBy: 'consumer' | 'business';
}

interface JobDetails {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  business: {
    id: string;
    displayName: string;
    logoUrl?: string;
    phone?: string;
    rating: number;
  };
  acceptedQuote: {
    priceMin: number;
    priceMax: number;
    description: string;
  };
  scheduledDate?: string;
  scheduledTime?: string;
  address: string;
  timeline: TimelineEvent[];
  canReview: boolean;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_STEPS = [
  { key: 'accepted', label: 'Aceptado', icon: '✓' },
  { key: 'scheduled', label: 'Programado', icon: '📅' },
  { key: 'in_progress', label: 'En progreso', icon: '🔧' },
  { key: 'completed', label: 'Completado', icon: '✅' },
];

function getStepIndex(status: string): number {
  const index = STATUS_STEPS.findIndex((s) => s.key === status);
  return index >= 0 ? index : 0;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function JobTrackingScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { jobId } = route.params;

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD JOB
  // ─────────────────────────────────────────────────────────────────────────────

  const loadJob = useCallback(async () => {
    try {
      const response = await consumerApi.requests.get(jobId);
      if (response.success && response.data) {
        // Transform request data to job format
        const data = response.data as any;
        setJob({
          id: data.id,
          requestNumber: data.requestNumber,
          title: data.title,
          status: data.status,
          business: data.acceptedBusiness || {
            id: '',
            displayName: 'Profesional',
            rating: 0,
          },
          acceptedQuote: data.acceptedQuote || {
            priceMin: 0,
            priceMax: 0,
            description: '',
          },
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          address: data.address,
          timeline: data.timeline || [],
          canReview: data.status === 'completed' && !data.hasReview,
          createdAt: data.createdAt,
        });
      }
    } catch (error) {
      console.error('Error loading job:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadJob();
  }, [loadJob]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  const callBusiness = () => {
    if (job?.business.phone) {
      Linking.openURL(`tel:${job.business.phone}`);
    }
  };

  const openChat = () => {
    navigation.navigate('Chat', { jobId: job?.id, businessId: job?.business.id });
  };

  const writeReview = () => {
    navigation.navigate('WriteReview', {
      businessId: job?.business.id,
      jobId: job?.id,
      businessName: job?.business.displayName,
    });
  };

  const reportIssue = () => {
    Alert.alert(
      'Reportar problema',
      '¿Qué tipo de problema tienes?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'No llegó el profesional', onPress: () => {} },
        { text: 'Problema con el trabajo', onPress: () => {} },
        { text: 'Otro problema', onPress: () => {} },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se pudo cargar el trabajo</Text>
      </View>
    );
  }

  const currentStepIndex = getStepIndex(job.status);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.requestNumber}>#{job.requestNumber}</Text>
        <Text style={styles.title}>{job.title}</Text>
      </View>

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLine}>
          <View
            style={[
              styles.progressLineFilled,
              { width: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` },
            ]}
          />
        </View>
        <View style={styles.stepsRow}>
          {STATUS_STEPS.map((step, index) => (
            <View key={step.key} style={styles.step}>
              <View
                style={[
                  styles.stepCircle,
                  index <= currentStepIndex && styles.stepCircleActive,
                  index === currentStepIndex && styles.stepCircleCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.stepIcon,
                    index <= currentStepIndex && styles.stepIconActive,
                  ]}
                >
                  {step.icon}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  index <= currentStepIndex && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Business Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profesional</Text>
        <TouchableOpacity
          style={styles.businessRow}
          onPress={() => navigation.navigate('BusinessProfile', { id: job.business.id })}
        >
          {job.business.logoUrl ? (
            <Image source={{ uri: job.business.logoUrl }} style={styles.businessLogo} />
          ) : (
            <View style={styles.businessLogoPlaceholder}>
              <Text style={styles.businessLogoText}>
                {job.business.displayName[0]}
              </Text>
            </View>
          )}
          <View style={styles.businessInfo}>
            <Text style={styles.businessName}>{job.business.displayName}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingStar}>⭐</Text>
              <Text style={styles.ratingValue}>{job.business.rating.toFixed(1)}</Text>
            </View>
          </View>
          <Text style={styles.arrowIcon}>›</Text>
        </TouchableOpacity>

        {/* Contact Buttons */}
        <View style={styles.contactButtons}>
          {job.business.phone && (
            <TouchableOpacity style={styles.contactButton} onPress={callBusiness}>
              <Text style={styles.contactButtonIcon}>📞</Text>
              <Text style={styles.contactButtonText}>Llamar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.contactButton} onPress={openChat}>
            <Text style={styles.contactButtonIcon}>💬</Text>
            <Text style={styles.contactButtonText}>Chat</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Schedule & Quote */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Detalles del trabajo</Text>

        {job.scheduledDate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📅</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Fecha programada</Text>
              <Text style={styles.detailValue}>
                {formatDate(job.scheduledDate)}
                {job.scheduledTime && ` a las ${job.scheduledTime}`}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📍</Text>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Dirección</Text>
            <Text style={styles.detailValue}>{job.address}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>💰</Text>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Precio acordado</Text>
            <Text style={styles.detailValue}>
              {formatCurrency(job.acceptedQuote.priceMin)}
              {job.acceptedQuote.priceMax > job.acceptedQuote.priceMin &&
                ` - ${formatCurrency(job.acceptedQuote.priceMax)}`}
            </Text>
          </View>
        </View>

        {job.acceptedQuote.description && (
          <View style={styles.quoteDescription}>
            <Text style={styles.quoteDescriptionText}>
              {job.acceptedQuote.description}
            </Text>
          </View>
        )}
      </View>

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Historial</Text>

        {job.timeline.length === 0 ? (
          <Text style={styles.emptyTimeline}>No hay actualizaciones aún</Text>
        ) : (
          job.timeline.map((event, index) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              {index < job.timeline.length - 1 && (
                <View style={styles.timelineLine} />
              )}
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{event.title}</Text>
                {event.description && (
                  <Text style={styles.timelineDescription}>{event.description}</Text>
                )}
                {event.imageUrl && (
                  <Image
                    source={{ uri: event.imageUrl }}
                    style={styles.timelineImage}
                  />
                )}
                <Text style={styles.timelineDate}>
                  {formatDate(event.createdAt)} {formatTime(event.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {job.canReview && (
          <TouchableOpacity style={styles.primaryButton} onPress={writeReview}>
            <Text style={styles.primaryButtonText}>Escribir reseña</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={reportIssue}>
          <Text style={styles.secondaryButtonText}>Reportar problema</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#757575',
  },

  // Header
  header: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 40,
  },
  requestNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },

  // Progress
  progressContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  progressLine: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  progressLineFilled: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  step: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  stepCircleActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  stepCircleCurrent: {
    backgroundColor: '#2E7D32',
  },
  stepIcon: {
    fontSize: 16,
  },
  stepIconActive: {
    color: '#FFF',
  },
  stepLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 8,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#2E7D32',
    fontWeight: '500',
  },

  // Card
  card: {
    backgroundColor: '#FFF',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },

  // Business
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  businessLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessLogoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  businessInfo: {
    flex: 1,
    marginLeft: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingStar: {
    fontSize: 12,
  },
  ratingValue: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 4,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#BDBDBD',
  },
  contactButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  contactButtonIcon: {
    fontSize: 16,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
  },

  // Details
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: '#212121',
  },
  quoteDescription: {
    backgroundColor: '#FAFAFA',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  quoteDescriptionText: {
    fontSize: 14,
    color: '#616161',
    lineHeight: 20,
  },

  // Timeline
  emptyTimeline: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    paddingVertical: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingLeft: 12,
    marginBottom: 16,
  },
  timelineDot: {
    position: 'absolute',
    left: 0,
    top: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2E7D32',
  },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 20,
    bottom: -12,
    width: 2,
    backgroundColor: '#E0E0E0',
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#212121',
  },
  timelineDescription: {
    fontSize: 14,
    color: '#616161',
    marginTop: 4,
  },
  timelineImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  timelineDate: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 6,
  },

  // Actions
  actionsContainer: {
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryButtonText: {
    color: '#757575',
    fontSize: 15,
    fontWeight: '500',
  },
});
