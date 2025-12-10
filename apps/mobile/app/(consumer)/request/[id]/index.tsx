/**
 * Request Detail Screen
 * =====================
 *
 * Phase 15: Consumer Marketplace
 * View service request details and received quotes.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Clock,
  MessageSquare,
  ChevronRight,
  Calendar,
  FileText,
  Camera,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';

import { QuoteCard } from '../../../../components/consumer/QuoteCard';
import { useRequestDetail, useCancelRequest } from '../../../../lib/consumer/hooks/use-requests';
import { getCategoryInfo } from '../../../../lib/consumer/constants';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Esperando presupuestos', color: '#0284c7', bgColor: '#dbeafe' },
  quotes_received: { label: 'Presupuestos recibidos', color: '#16a34a', bgColor: '#dcfce7' },
  accepted: { label: 'Presupuesto aceptado', color: '#7c3aed', bgColor: '#ede9fe' },
  in_progress: { label: 'En progreso', color: '#f59e0b', bgColor: '#fef3c7' },
  completed: { label: 'Completado', color: '#16a34a', bgColor: '#dcfce7' },
  cancelled: { label: 'Cancelado', color: '#ef4444', bgColor: '#fee2e2' },
  expired: { label: 'Expirado', color: '#6b7280', bgColor: '#f3f4f6' },
};

const URGENCY_LABELS: Record<string, string> = {
  emergency: 'Urgente',
  today: 'Hoy',
  this_week: 'Esta semana',
  flexible: 'Flexible',
};

export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { request, quotes, isLoading, error, refetch } = useRequestDetail(id);
  const { cancelRequest, isLoading: isCancelling } = useCancelRequest();

  const handleViewQuotes = () => {
    router.push({
      pathname: '/(consumer)/request/[id]/quotes',
      params: { id },
    });
  };

  const handleCancel = async () => {
    if (request) {
      await cancelRequest(request.id);
      refetch();
    }
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

  if (error || !request) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se pudo cargar la solicitud</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryInfo = getCategoryInfo(request.category);
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.open;
  const canCancel = ['open', 'quotes_received'].includes(request.status);
  const hasQuotes = quotes && quotes.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitud #{request.requestNumber}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusConfig.bgColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Request Info */}
        <View style={styles.section}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryIcon}>{categoryInfo?.icon || '🔧'}</Text>
            <View>
              <Text style={styles.categoryName}>{categoryInfo?.name || request.category}</Text>
              <Text style={styles.requestDate}>
                Creada el {new Date(request.createdAt).toLocaleDateString('es-AR')}
              </Text>
            </View>
          </View>

          <Text style={styles.requestTitle}>{request.title}</Text>
          <Text style={styles.requestDescription}>{request.description}</Text>

          {/* Photos */}
          {request.photoUrls && request.photoUrls.length > 0 && (
            <ScrollView horizontal style={styles.photosRow} showsHorizontalScrollIndicator={false}>
              {request.photoUrls.map((url: string, index: number) => (
                <Image key={index} source={{ uri: url }} style={styles.photoThumbnail} />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles</Text>

          <View style={styles.detailRow}>
            <MapPin size={18} color="#6b7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Ubicacion</Text>
              <Text style={styles.detailValue}>{request.address}</Text>
              {request.addressExtra && (
                <Text style={styles.detailExtra}>{request.addressExtra}</Text>
              )}
            </View>
          </View>

          <View style={styles.detailRow}>
            <Clock size={18} color="#6b7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Urgencia</Text>
              <Text style={styles.detailValue}>
                {URGENCY_LABELS[request.urgency] || request.urgency}
              </Text>
            </View>
          </View>

          {request.preferredDate && (
            <View style={styles.detailRow}>
              <Calendar size={18} color="#6b7280" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Fecha preferida</Text>
                <Text style={styles.detailValue}>
                  {new Date(request.preferredDate).toLocaleDateString('es-AR')}
                </Text>
              </View>
            </View>
          )}

          {request.budgetRange && (
            <View style={styles.detailRow}>
              <FileText size={18} color="#6b7280" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Presupuesto estimado</Text>
                <Text style={styles.detailValue}>{request.budgetRange}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Quotes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Presupuestos ({quotes?.length || 0})
            </Text>
            {hasQuotes && (
              <TouchableOpacity onPress={handleViewQuotes}>
                <Text style={styles.compareLink}>Comparar</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasQuotes ? (
            <View style={styles.quotesPreview}>
              {quotes.slice(0, 2).map((quote: any) => (
                <QuoteCard key={quote.id} quote={quote} compact />
              ))}
              {quotes.length > 2 && (
                <TouchableOpacity style={styles.viewAllQuotes} onPress={handleViewQuotes}>
                  <Text style={styles.viewAllQuotesText}>
                    Ver {quotes.length - 2} presupuestos mas
                  </Text>
                  <ChevronRight size={18} color="#0284c7" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.noQuotes}>
              <MessageSquare size={40} color="#d1d5db" />
              <Text style={styles.noQuotesTitle}>Esperando presupuestos</Text>
              <Text style={styles.noQuotesText}>
                Los profesionales estan revisando tu solicitud. Te notificaremos cuando recibas presupuestos.
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {canCancel && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isCancelling}
            >
              <XCircle size={18} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Cancelar solicitud</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom CTA */}
      {hasQuotes && request.status !== 'accepted' && (
        <View style={styles.ctaContainer}>
          <TouchableOpacity style={styles.ctaButton} onPress={handleViewQuotes}>
            <Text style={styles.ctaButtonText}>
              Ver y comparar presupuestos ({quotes.length})
            </Text>
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  categoryIcon: {
    fontSize: 32,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  requestDate: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  requestDescription: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  photosRow: {
    marginTop: 16,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  compareLink: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  detailExtra: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  quotesPreview: {
    gap: 12,
  },
  viewAllQuotes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 10,
    marginTop: 8,
  },
  viewAllQuotesText: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
  },
  noQuotes: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noQuotesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  noQuotesText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
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
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
