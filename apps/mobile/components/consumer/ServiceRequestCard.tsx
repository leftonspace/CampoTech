/**
 * Service Request Card Component
 * ==============================
 *
 * Phase 15: Consumer Marketplace
 * Displays a service request summary.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Clock,
  MapPin,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HourglassIcon,
} from 'lucide-react-native';
import { getCategoryInfo } from '../../lib/consumer/constants';

interface ServiceRequest {
  id: string;
  requestNumber: string;
  title: string;
  category: string;
  address: string;
  status: string;
  urgency: string;
  quotesReceived?: number;
  createdAt: string;
}

interface ServiceRequestCardProps {
  request: ServiceRequest;
  onPress: () => void;
  showQuotesCount?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  open: { label: 'Esperando', color: '#0284c7', bgColor: '#dbeafe', icon: HourglassIcon },
  quotes_received: { label: 'Presupuestos', color: '#16a34a', bgColor: '#dcfce7', icon: MessageSquare },
  accepted: { label: 'Aceptado', color: '#7c3aed', bgColor: '#ede9fe', icon: CheckCircle },
  in_progress: { label: 'En progreso', color: '#f59e0b', bgColor: '#fef3c7', icon: Clock },
  completed: { label: 'Completado', color: '#16a34a', bgColor: '#dcfce7', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: '#ef4444', bgColor: '#fee2e2', icon: XCircle },
  expired: { label: 'Expirado', color: '#6b7280', bgColor: '#f3f4f6', icon: Clock },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  emergency: { label: 'Urgente', color: '#ef4444' },
  today: { label: 'Hoy', color: '#f59e0b' },
  this_week: { label: 'Esta semana', color: '#0284c7' },
  flexible: { label: 'Flexible', color: '#16a34a' },
};

export function ServiceRequestCard({
  request,
  onPress,
  showQuotesCount = false,
}: ServiceRequestCardProps) {
  const categoryInfo = getCategoryInfo(request.category);
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.open;
  const urgencyConfig = URGENCY_CONFIG[request.urgency] || URGENCY_CONFIG.flexible;
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} dias`;
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryIcon}>{categoryInfo?.icon || '🔧'}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {request.title}
          </Text>
          <Text style={styles.requestNumber}>#{request.requestNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <StatusIcon size={12} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <MapPin size={14} color="#6b7280" />
          <Text style={styles.detailText} numberOfLines={1}>
            {request.address}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Clock size={12} color="#9ca3af" />
            <Text style={styles.metaText}>{formatDate(request.createdAt)}</Text>
          </View>

          {request.urgency === 'emergency' && (
            <View style={styles.urgencyBadge}>
              <AlertTriangle size={12} color={urgencyConfig.color} />
              <Text style={[styles.urgencyText, { color: urgencyConfig.color }]}>
                {urgencyConfig.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {showQuotesCount && (request.status === 'open' || request.status === 'quotes_received') && (
          <View style={styles.quotesInfo}>
            <MessageSquare size={14} color="#0284c7" />
            <Text style={styles.quotesText}>
              {request.quotesReceived || 0} presupuestos
            </Text>
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryIcon: {
    fontSize: 20,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  requestNumber: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  details: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  quotesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quotesText: {
    fontSize: 13,
    color: '#0284c7',
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
});

export default ServiceRequestCard;
