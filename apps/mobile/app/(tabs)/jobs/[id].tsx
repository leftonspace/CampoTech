/**
 * Job Detail Screen
 * =================
 *
 * Shows job details with status actions and completion flow.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';

import { jobsCollection, customersCollection } from '../../../watermelon/database';
import { Job, Customer } from '../../../watermelon/models';
import { enqueueOperation } from '../../../lib/sync/sync-engine';
import StatusButton from '../../../components/job/StatusButton';

function JobDetailScreen({ job, customer }: { job: Job; customer: Customer | null }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setIsUpdating(true);
      try {
        if (newStatus === 'en_camino') {
          await job.startJob();
        } else if (newStatus === 'working') {
          await job.arriveAtJob();
        } else if (newStatus === 'completed') {
          // Navigate to completion flow
          router.push(`/(tabs)/jobs/complete?id=${job.id}`);
          return;
        } else if (newStatus === 'cancelled') {
          Alert.prompt(
            'Cancelar trabajo',
            '¿Por qué se cancela este trabajo?',
            [
              { text: 'No cancelar', style: 'cancel' },
              {
                text: 'Cancelar trabajo',
                style: 'destructive',
                onPress: async (reason) => {
                  await job.cancelJob(reason || 'Sin motivo');
                  await enqueueOperation('job', job.serverId, 'update', {
                    status: 'cancelled',
                    completionNotes: reason,
                  });
                },
              },
            ],
            'plain-text'
          );
          return;
        }

        // Queue for sync
        await enqueueOperation('job', job.serverId, 'update', {
          status: newStatus,
          actualStart: job.actualStart,
        });
      } catch (error) {
        Alert.alert('Error', 'No se pudo actualizar el estado');
      } finally {
        setIsUpdating(false);
      }
    },
    [job, router]
  );

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const handleNavigate = () => {
    const address = encodeURIComponent(job.address);
    const url = `https://maps.google.com/?q=${address}`;
    Linking.openURL(url);
  };

  const handleWhatsApp = () => {
    if (customer?.phone) {
      const phone = customer.phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=${phone}`);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '--:--';
    return new Date(timestamp).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: job.serviceType,
          headerStyle: { backgroundColor: '#16a34a' },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity onPress={() => {}} style={styles.headerButton}>
              <Feather name="more-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Status card */}
        <View style={styles.statusCard}>
          <StatusButton
            status={job.status}
            onStatusChange={handleStatusChange}
            isLoading={isUpdating}
          />
        </View>

        {/* Customer card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="user" size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>Cliente</Text>
          </View>
          <Text style={styles.customerName}>{customer?.name || 'Cliente'}</Text>
          {customer?.phone && (
            <View style={styles.contactButtons}>
              <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
                <Feather name="phone" size={18} color="#16a34a" />
                <Text style={styles.contactButtonText}>Llamar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactButton} onPress={handleWhatsApp}>
                <Feather name="message-circle" size={18} color="#25d366" />
                <Text style={styles.contactButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Schedule card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="calendar" size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>Horario</Text>
          </View>
          <Text style={styles.scheduleDate}>{formatDate(job.scheduledStart)}</Text>
          <View style={styles.scheduleTimeRow}>
            <View style={styles.scheduleTime}>
              <Text style={styles.scheduleTimeLabel}>Inicio</Text>
              <Text style={styles.scheduleTimeValue}>
                {formatTime(job.scheduledStart)}
              </Text>
            </View>
            <Feather name="arrow-right" size={16} color="#d1d5db" />
            <View style={styles.scheduleTime}>
              <Text style={styles.scheduleTimeLabel}>Fin estimado</Text>
              <Text style={styles.scheduleTimeValue}>
                {formatTime(job.scheduledEnd)}
              </Text>
            </View>
          </View>
        </View>

        {/* Location card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="map-pin" size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>Ubicación</Text>
          </View>
          <Text style={styles.address}>{job.address}</Text>
          <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
            <Feather name="navigation" size={18} color="#fff" />
            <Text style={styles.navigateButtonText}>Navegar</Text>
          </TouchableOpacity>
        </View>

        {/* Notes card */}
        {(job.notes || job.internalNotes) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="file-text" size={18} color="#16a34a" />
              <Text style={styles.cardTitle}>Notas</Text>
            </View>
            {job.notes && (
              <View style={styles.noteSection}>
                <Text style={styles.noteLabel}>Instrucciones del cliente</Text>
                <Text style={styles.noteText}>{job.notes}</Text>
              </View>
            )}
            {job.internalNotes && (
              <View style={styles.noteSection}>
                <Text style={styles.noteLabel}>Notas internas</Text>
                <Text style={styles.noteText}>{job.internalNotes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Completion info (if completed) */}
        {job.isCompleted && job.completionNotes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="check-circle" size={18} color="#16a34a" />
              <Text style={styles.cardTitle}>Trabajo completado</Text>
            </View>
            <Text style={styles.noteText}>{job.completionNotes}</Text>
            {job.total && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  ${job.total.toLocaleString('es-AR')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Offline indicator */}
        {job.isDirty && (
          <View style={styles.offlineIndicator}>
            <Feather name="cloud-off" size={16} color="#f59e0b" />
            <Text style={styles.offlineText}>
              Cambios pendientes de sincronización
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

// Enhance with WatermelonDB
const enhance = withObservables(['id'], ({ id }: { id: string }) => ({
  job: jobsCollection.findAndObserve(id),
  customer: jobsCollection.findAndObserve(id).then((job: Job) =>
    job.customerId ? customersCollection.findAndObserve(job.customerId) : null
  ),
}));

export default function JobDetailWrapper() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <View style={styles.errorContainer}>
        <Text>Job not found</Text>
      </View>
    );
  }

  const EnhancedScreen = enhance(JobDetailScreen);
  return <EnhancedScreen id={id} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  headerButton: {
    padding: 8,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
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
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  scheduleDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  scheduleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleTime: {
    alignItems: 'center',
  },
  scheduleTimeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  scheduleTimeValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  address: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 12,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
  },
  navigateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  noteSection: {
    marginBottom: 12,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16a34a',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  offlineText: {
    fontSize: 13,
    color: '#f59e0b',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
