/**
 * Job Card Component
 * ==================
 *
 * Displays a job summary in list views.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';

import { Job, Customer } from '../../watermelon/models';
import { customersCollection } from '../../watermelon/database';

interface JobCardProps {
  job: Job;
  customer?: Customer;
  onPress: () => void;
}

function JobCard({ job, customer, onPress }: JobCardProps) {
  const statusConfig = getStatusConfig(job.status);

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {/* Status indicator */}
      <View style={[styles.statusBar, { backgroundColor: statusConfig.color }]} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.timeContainer}>
            <Feather name="clock" size={14} color="#6b7280" />
            <Text style={styles.time}>{formatTime(job.scheduledStart)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Service type */}
        <Text style={styles.serviceType}>{job.serviceType}</Text>

        {/* Customer name */}
        <Text style={styles.customerName}>
          {customer?.name || 'Cliente'}
        </Text>

        {/* Address */}
        <View style={styles.addressContainer}>
          <Feather name="map-pin" size={14} color="#9ca3af" />
          <Text style={styles.address} numberOfLines={1}>
            {job.address}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {job.priority === 'high' && (
            <View style={styles.priorityBadge}>
              <Feather name="alert-circle" size={12} color="#ef4444" />
              <Text style={styles.priorityText}>Urgente</Text>
            </View>
          )}

          {job.isDirty && (
            <View style={styles.syncBadge}>
              <Feather name="cloud-off" size={12} color="#f59e0b" />
              <Text style={styles.syncText}>Pendiente</Text>
            </View>
          )}

          <View style={styles.spacer} />

          <Feather name="chevron-right" size={20} color="#d1d5db" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'Pendiente', color: '#9ca3af', bgColor: '#f3f4f6' };
    case 'scheduled':
      return { label: 'Programado', color: '#3b82f6', bgColor: '#eff6ff' };
    case 'en_camino':
      return { label: 'En camino', color: '#f59e0b', bgColor: '#fffbeb' };
    case 'working':
      return { label: 'En progreso', color: '#8b5cf6', bgColor: '#f5f3ff' };
    case 'completed':
      return { label: 'Completado', color: '#16a34a', bgColor: '#f0fdf4' };
    case 'cancelled':
      return { label: 'Cancelado', color: '#ef4444', bgColor: '#fef2f2' };
    default:
      return { label: status, color: '#6b7280', bgColor: '#f9fafb' };
  }
}

// Enhance with customer data
// Use job.customer relation but catch errors when customer doesn't exist locally
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const enhance = withObservables(['job'], ({ job }: { job: Job }) => {
  // Safely observe the customer relationship
  // If customer doesn't exist locally, return null instead of crashing
  let customerObservable = null;
  try {
    if (job.customerId) {
      customerObservable = job.customer.observe().pipe(
        catchError(() => of(null))
      );
    }
  } catch {
    customerObservable = of(null);
  }

  return {
    job,
    customer: customerObservable,
  };
});

export default enhance(JobCard);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  address: {
    flex: 1,
    fontSize: 13,
    color: '#9ca3af',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    marginRight: 8,
  },
  priorityText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fffbeb',
    borderRadius: 6,
  },
  syncText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
});
