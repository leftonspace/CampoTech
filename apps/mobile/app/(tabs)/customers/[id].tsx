/**
 * Customer Detail Screen
 * ======================
 *
 * Phase 9.10: Mobile-First Architecture
 * Customer details and job history.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  Mail,
  MapPin,
  FileText,
  Briefcase,
  Edit2,
  Trash2,
  MessageCircle,
  ChevronRight,
  Calendar,
  DollarSign,
} from 'lucide-react-native';

import { api } from '../../../lib/api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  cuit?: string;
  taxCondition?: string;
  notes?: string;
  createdAt: string;
}

interface CustomerJob {
  id: string;
  serviceType: string;
  status: string;
  scheduledStart?: string;
  address: string;
  total?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch customer details
  const { data: customerData, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await api.customers.get(id);
      return response;
    },
    enabled: !!id,
  });

  // Fetch customer jobs
  const { data: jobsData } = useQuery({
    queryKey: ['customer-jobs', id],
    queryFn: async () => {
      const response = await api.jobs.list({ customerId: id, limit: 10 });
      return response;
    },
    enabled: !!id,
  });

  const customer: Customer | null = customerData?.data || null;
  const jobs: CustomerJob[] = jobsData?.data || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.customers.delete(id);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.back();
    },
  });

  // Actions
  const handleCall = useCallback(() => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  }, [customer?.phone]);

  const handleWhatsApp = useCallback(() => {
    if (customer?.phone) {
      const phone = customer.phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=${phone}`);
    }
  }, [customer?.phone]);

  const handleEmail = useCallback(() => {
    if (customer?.email) {
      Linking.openURL(`mailto:${customer.email}`);
    }
  }, [customer?.email]);

  const handleMap = useCallback(() => {
    if (customer?.address) {
      const query = encodeURIComponent(customer.address);
      Linking.openURL(`https://maps.google.com/?q=${query}`);
    }
  }, [customer?.address]);

  const handleEdit = useCallback(() => {
    router.push(`/customers/${id}/edit`);
  }, [router, id]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Eliminar cliente',
      `¿Estás seguro de eliminar a ${customer?.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  }, [customer?.name, deleteMutation]);

  const handleCreateJob = useCallback(() => {
    router.push(`/jobs/create?customerId=${id}`);
  }, [router, id]);

  const navigateToJob = useCallback((jobId: string) => {
    router.push(`/jobs/${jobId}`);
  }, [router]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      scheduled: '#3b82f6',
      en_camino: '#8b5cf6',
      in_progress: '#6366f1',
      completed: '#22c55e',
      cancelled: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const formatTaxCondition = (condition?: string) => {
    const conditions: Record<string, string> = {
      responsable_inscripto: 'Responsable Inscripto',
      monotributista: 'Monotributista',
      consumidor_final: 'Consumidor Final',
      exento: 'Exento',
    };
    return conditions[condition || ''] || condition || '-';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Cliente' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Cliente' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Cliente no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: customer.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
                <Edit2 size={20} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Contact Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Phone size={20} color="#16a34a" />
            <Text style={styles.actionText}>Llamar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleWhatsApp}>
            <MessageCircle size={20} color="#25d366" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>

          {customer.email && (
            <TouchableOpacity style={styles.actionButton} onPress={handleEmail}>
              <Mail size={20} color="#3b82f6" />
              <Text style={styles.actionText}>Email</Text>
            </TouchableOpacity>
          )}

          {customer.address && (
            <TouchableOpacity style={styles.actionButton} onPress={handleMap}>
              <MapPin size={20} color="#ef4444" />
              <Text style={styles.actionText}>Mapa</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de contacto</Text>

          <View style={styles.infoCard}>
            <InfoRow icon={Phone} label="Teléfono" value={customer.phone} />
            {customer.email && (
              <InfoRow icon={Mail} label="Email" value={customer.email} />
            )}
            {customer.address && (
              <InfoRow icon={MapPin} label="Dirección" value={customer.address} />
            )}
          </View>
        </View>

        {/* Fiscal Info */}
        {(customer.cuit || customer.taxCondition) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información fiscal</Text>

            <View style={styles.infoCard}>
              {customer.cuit && (
                <InfoRow icon={FileText} label="CUIT" value={customer.cuit} />
              )}
              {customer.taxCondition && (
                <InfoRow
                  icon={DollarSign}
                  label="Condición fiscal"
                  value={formatTaxCondition(customer.taxCondition)}
                />
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {customer.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{customer.notes}</Text>
            </View>
          </View>
        )}

        {/* Jobs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trabajos recientes</Text>
            <TouchableOpacity onPress={handleCreateJob}>
              <Text style={styles.sectionAction}>+ Nuevo trabajo</Text>
            </TouchableOpacity>
          </View>

          {jobs.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Briefcase size={32} color="#d1d5db" />
              <Text style={styles.emptyJobsText}>Sin trabajos registrados</Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {jobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => navigateToJob(job.id)}
                >
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobTitle}>{job.serviceType}</Text>
                    <View style={styles.jobMeta}>
                      {job.scheduledStart && (
                        <>
                          <Calendar size={12} color="#6b7280" />
                          <Text style={styles.jobMetaText}>
                            {new Date(job.scheduledStart).toLocaleDateString('es-AR')}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(job.status)}20` },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: getStatusColor(job.status) }]}
                    >
                      {job.status}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon size={16} color="#6b7280" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#374151',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    marginTop: 2,
  },
  notesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  emptyJobs: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyJobsText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  jobsList: {
    gap: 8,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  jobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  jobMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
