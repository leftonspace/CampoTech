/**
 * Consumer Job Detail Screen
 * ==========================
 *
 * Phase 15: Consumer Marketplace
 * Track job progress and communicate with service provider.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Star,
  CheckCircle,
  Circle,
  Calendar,
  User,
} from 'lucide-react-native';

import { RatingStars } from '../../../components/consumer/RatingStars';
import { useJobDetail } from '../../../lib/consumer/hooks/use-jobs';

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  scheduled: { label: 'Programado', color: '#0284c7', step: 1 },
  en_camino: { label: 'En camino', color: '#f59e0b', step: 2 },
  in_progress: { label: 'En progreso', color: '#7c3aed', step: 3 },
  completed: { label: 'Completado', color: '#16a34a', step: 4 },
  cancelled: { label: 'Cancelado', color: '#ef4444', step: 0 },
};

const TIMELINE_STEPS = [
  { step: 1, label: 'Programado' },
  { step: 2, label: 'En camino' },
  { step: 3, label: 'En progreso' },
  { step: 4, label: 'Completado' },
];

export default function ConsumerJobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, business, timeline, isLoading } = useJobDetail(id);

  const handleCall = () => {
    if (business?.phone) {
      Linking.openURL(`tel:${business.phone}`);
    }
  };

  const handleMessage = () => {
    // Would open chat screen
  };

  const handleLeaveReview = () => {
    router.push({
      pathname: '/(consumer)/reviews/new/[jobId]',
      params: { jobId: id },
    });
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

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se pudo cargar el trabajo</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = JOB_STATUS_CONFIG[job.status] || JOB_STATUS_CONFIG.scheduled;
  const currentStep = statusConfig.step;
  const isCompleted = job.status === 'completed';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trabajo #{job.jobNumber}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={[styles.statusCard, { borderLeftColor: statusConfig.color }]}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Text style={styles.statusText}>{statusConfig.label}</Text>
          </View>
          {job.scheduledDate && (
            <View style={styles.scheduleInfo}>
              <Calendar size={16} color="#6b7280" />
              <Text style={styles.scheduleText}>
                {new Date(job.scheduledDate).toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                {job.scheduledTime && ` - ${job.scheduledTime}`}
              </Text>
            </View>
          )}
        </View>

        {/* Progress Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progreso</Text>
          <View style={styles.timeline}>
            {TIMELINE_STEPS.map((step, index) => {
              const isActive = currentStep >= step.step;
              const isCurrent = currentStep === step.step;
              return (
                <View key={step.step} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineDot,
                        isActive && styles.timelineDotActive,
                        isCurrent && styles.timelineDotCurrent,
                      ]}
                    >
                      {isActive ? (
                        <CheckCircle size={16} color="#fff" />
                      ) : (
                        <Circle size={16} color="#d1d5db" />
                      )}
                    </View>
                    {index < TIMELINE_STEPS.length - 1 && (
                      <View
                        style={[
                          styles.timelineLine,
                          currentStep > step.step && styles.timelineLineActive,
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        isActive && styles.timelineLabelActive,
                        isCurrent && styles.timelineLabelCurrent,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Service Provider */}
        {business && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profesional</Text>
            <View style={styles.businessCard}>
              <View style={styles.businessInfo}>
                {business.logoUrl ? (
                  <Image source={{ uri: business.logoUrl }} style={styles.businessLogo} />
                ) : (
                  <View style={[styles.businessLogo, styles.businessLogoPlaceholder]}>
                    <User size={24} color="#9ca3af" />
                  </View>
                )}
                <View style={styles.businessDetails}>
                  <Text style={styles.businessName}>{business.displayName}</Text>
                  <View style={styles.businessRating}>
                    <RatingStars rating={business.overallRating || 0} size={14} />
                    <Text style={styles.businessRatingText}>
                      {business.overallRating?.toFixed(1) || '0.0'} ({business.ratingCount || 0})
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.contactButtons}>
                <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
                  <Phone size={18} color="#0284c7" />
                  <Text style={styles.contactButtonText}>Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactButton} onPress={handleMessage}>
                  <MessageSquare size={18} color="#0284c7" />
                  <Text style={styles.contactButtonText}>Mensaje</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalle del servicio</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Servicio</Text>
              <Text style={styles.detailValue}>{job.serviceType || job.title}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ubicacion</Text>
              <Text style={styles.detailValue}>{job.address}</Text>
            </View>
            {job.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notas</Text>
                <Text style={styles.detailValue}>{job.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Timeline Events */}
        {timeline && timeline.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actividad</Text>
            {timeline.map((event: any) => (
              <View key={event.id} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{event.title}</Text>
                  {event.description && (
                    <Text style={styles.activityDescription}>{event.description}</Text>
                  )}
                  <Text style={styles.activityTime}>
                    {new Date(event.createdAt).toLocaleString('es-AR')}
                  </Text>
                </View>
                {event.imageUrl && (
                  <Image source={{ uri: event.imageUrl }} style={styles.activityImage} />
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Leave Review CTA (only for completed jobs) */}
      {isCompleted && (
        <View style={styles.ctaContainer}>
          <TouchableOpacity style={styles.ctaButton} onPress={handleLeaveReview}>
            <Star size={20} color="#fff" />
            <Text style={styles.ctaButtonText}>Dejar una opinion</Text>
          </TouchableOpacity>
        </View>
      )}
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
  statusCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleText: {
    fontSize: 14,
    color: '#374151',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotActive: {
    backgroundColor: '#16a34a',
  },
  timelineDotCurrent: {
    backgroundColor: '#0284c7',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  timelineLineActive: {
    backgroundColor: '#16a34a',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  timelineLabelActive: {
    color: '#374151',
    fontWeight: '500',
  },
  timelineLabelCurrent: {
    color: '#0284c7',
    fontWeight: '600',
  },
  businessCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  businessLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  businessLogoPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessDetails: {
    flex: 1,
    marginLeft: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  businessRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  businessRatingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 8,
  },
  contactButtonText: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
  },
  detailCard: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284c7',
    marginTop: 6,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  activityImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginLeft: 12,
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
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 12,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
