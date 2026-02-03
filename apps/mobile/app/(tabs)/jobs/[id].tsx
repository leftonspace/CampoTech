/**
 * Job Detail Screen
 * =================
 *
 * Shows job details with status actions and completion flow.
 *
 * Features:
 * - Customer info with contact options
 * - Status updates with GPS tracking integration
 * - Photo capture (before/during/after)
 * - Material usage logging
 * - Signature capture on completion
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import { switchMap, of } from 'rxjs';
import { Q } from '@nozbe/watermelondb';
import * as ImagePicker from 'expo-image-picker';

import { jobsCollection, customersCollection, jobPhotosCollection, database } from '../../../watermelon/database';
import { Job, Customer } from '../../../watermelon/models';
import { enqueueOperation } from '../../../lib/sync/sync-engine';
import {
  startTracking,
  stopTracking,
  isTrackingActive,
} from '../../../lib/services/location';
import StatusButton from '../../../components/job/StatusButton';
import { ConfirmationCodeEntry } from '../../../components/jobs';
import { api } from '../../../lib/api/client';

interface JobPhoto {
  id: string;
  localUri: string;
  type: 'before' | 'during' | 'after';
}

function JobDetailScreen({ job, customer }: { job: Job; customer: Customer | null }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);

  // Load existing photos for this job
  useEffect(() => {
    loadPhotos();
    // Check if we need to show code entry (job is en_camino)
    if (job.status === 'en_camino') {
      checkCodeStatus();
    }
  }, [job.id, job.status]);

  // Check confirmation code status
  const checkCodeStatus = async () => {
    try {
      const response = await api.jobs.confirmationCode.status(job.serverId);
      if (response.success && response.data) {
        if (response.data.codeRequired && response.data.codeSent && !response.data.codeVerified) {
          setShowCodeEntry(true);
        }
        if (response.data.codeVerified) {
          setCodeVerified(true);
        }
      }
    } catch (error) {
      console.error('Error checking code status:', error);
    }
  };

  const loadPhotos = async () => {
    try {
      const existingPhotos = await jobPhotosCollection
        .query(Q.where('job_id', job.id))
        .fetch();
      setPhotos(
        existingPhotos.map((p: any) => ({
          id: p.id,
          localUri: p.localUri,
          type: p.type,
        }))
      );
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setIsUpdating(true);
      try {
        if (newStatus === 'en_camino') {
          // Start GPS tracking when going EN_ROUTE
          const trackingResult = await startTracking(job.serverId);
          if (!trackingResult.success) {
            // Show warning but don't block status change
            Alert.alert(
              'Ubicación',
              'No se pudo activar el seguimiento GPS. El cliente no podrá ver tu ubicación.',
              [{ text: 'OK' }]
            );
          }

          // Send confirmation code to customer
          try {
            const codeResponse = await api.jobs.confirmationCode.send(job.serverId);
            if (codeResponse.success) {
              Alert.alert(
                '📱 Código Enviado',
                'Se envió un código de confirmación al cliente por WhatsApp. Pedíselo cuando llegues.',
                [{ text: 'Entendido' }]
              );
              setShowCodeEntry(true);
            }
          } catch (error) {
            console.error('Error sending confirmation code:', error);
          }

          await job.startJob();
        } else if (newStatus === 'working') {
          // Check if code verification is required and not yet done
          if (!codeVerified && showCodeEntry) {
            Alert.alert(
              '🔐 Código Requerido',
              'Primero ingresá el código de confirmación que el cliente recibió por WhatsApp.',
              [{ text: 'OK' }]
            );
            return;
          }
          await job.arriveAtJob();
          setShowCodeEntry(false);
        } else if (newStatus === 'completed') {
          // Stop GPS tracking when completing
          if (isTrackingActive()) {
            await stopTracking();
          }
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
                  // Stop tracking on cancellation
                  if (isTrackingActive()) {
                    await stopTracking();
                  }
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

  // Determine photo type based on job status
  const getPhotoType = (): 'before' | 'during' | 'after' => {
    if (job.status === 'pending' || job.status === 'scheduled' || job.status === 'en_camino') {
      return 'before';
    }
    if (job.status === 'working') {
      return 'during';
    }
    return 'after';
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar fotos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
    });

    if (!result.canceled) {
      for (const asset of result.assets) {
        await savePhoto(asset.uri);
      }
    }
  };

  const savePhoto = async (uri: string) => {
    const photoType = getPhotoType();
    try {
      await database.write(async () => {
        await jobPhotosCollection.create((photo: any) => {
          photo.jobId = job.id;
          photo.localUri = uri;
          photo.type = photoType;
          photo.uploaded = false;
          photo.createdAt = new Date();
        });
      });
      await loadPhotos();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la foto');
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    Alert.alert(
      'Eliminar foto',
      '¿Estás seguro de que querés eliminar esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                const photo = await jobPhotosCollection.find(photoId);
                await photo.destroyPermanently();
              });
              await loadPhotos();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la foto');
            }
          },
        },
      ]
    );
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

  // Check if we can add photos (job is in progress)
  const canAddPhotos = ['en_camino', 'working'].includes(job.status);
  const photoTypeLabel = getPhotoType() === 'before' ? 'Antes' : getPhotoType() === 'during' ? 'Durante' : 'Después';

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: job.serviceType,
          headerStyle: { backgroundColor: '#16a34a' },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity onPress={() => { }} style={styles.headerButton}>
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

        {/* Confirmation Code Entry - shown when en_camino and code not yet verified */}
        {showCodeEntry && !codeVerified && job.status === 'en_camino' && (
          <ConfirmationCodeEntry
            jobId={job.serverId}
            customerName={customer?.name || 'Cliente'}
            onVerified={() => {
              setCodeVerified(true);
              setShowCodeEntry(false);
              Alert.alert(
                '✅ Verificado',
                'Código confirmado. Ya podés marcar que llegaste.',
                [{ text: 'OK' }]
              );
            }}
          />
        )}

        {/* Photo capture card - shown during work */}
        {canAddPhotos && (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => setShowPhotos(!showPhotos)}
            >
              <Feather name="camera" size={18} color="#16a34a" />
              <Text style={styles.cardTitle}>
                Fotos del trabajo ({photos.length})
              </Text>
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>{photoTypeLabel}</Text>
              </View>
              <Feather
                name={showPhotos ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#9ca3af"
              />
            </TouchableOpacity>

            {showPhotos && (
              <View style={styles.photoSection}>
                {/* Photo grid */}
                {photos.length > 0 && (
                  <View style={styles.photoGrid}>
                    {photos.map((photo) => (
                      <View key={photo.id} style={styles.photoItem}>
                        <Image source={{ uri: photo.localUri }} style={styles.photo} />
                        <View style={styles.photoTypeBadge}>
                          <Text style={styles.photoTypeText}>
                            {photo.type === 'before' ? 'A' : photo.type === 'during' ? 'D' : 'F'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removePhoto}
                          onPress={() => handleRemovePhoto(photo.id)}
                        >
                          <Feather name="x" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add photo buttons */}
                <View style={styles.addPhotoButtons}>
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={handleTakePhoto}
                  >
                    <Feather name="camera" size={20} color="#16a34a" />
                    <Text style={styles.addPhotoText}>Tomar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={handlePickPhoto}
                  >
                    <Feather name="image" size={20} color="#16a34a" />
                    <Text style={styles.addPhotoText}>Galería</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.photoHint}>
                  Las fotos se guardan localmente y se sincronizan cuando haya conexión
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Quick actions during work */}
        {job.status === 'working' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="tool" size={18} color="#16a34a" />
              <Text style={styles.cardTitle}>Acciones rápidas</Text>
            </View>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push(`/(tabs)/inventory/usage?jobId=${job.id}`)}
              >
                <View style={styles.quickActionIcon}>
                  <Feather name="package" size={20} color="#3b82f6" />
                </View>
                <Text style={styles.quickActionText}>Registrar materiales</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={handleTakePhoto}
              >
                <View style={styles.quickActionIcon}>
                  <Feather name="camera" size={20} color="#8b5cf6" />
                </View>
                <Text style={styles.quickActionText}>Agregar foto</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Customer card - tappable to view full details */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => customer?.serverId && router.push(`/(tabs)/customers/${customer.serverId}`)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Feather name="user" size={18} color="#16a34a" />
            <Text style={styles.cardTitle}>Cliente</Text>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </View>
          <Text style={styles.customerName}>{customer?.name || 'Cliente'}</Text>
          {customer?.phone && (
            <View style={styles.contactButtons}>
              <TouchableOpacity style={styles.contactButton} onPress={(e) => { e.stopPropagation(); handleCall(); }}>
                <Feather name="phone" size={18} color="#16a34a" />
                <Text style={styles.contactButtonText}>Llamar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactButton} onPress={(e) => { e.stopPropagation(); handleWhatsApp(); }}>
                <Feather name="message-circle" size={18} color="#25d366" />
                <Text style={styles.contactButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.viewDetailsHint}>Tocar para ver detalles del cliente</Text>
        </TouchableOpacity>

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

        {/* Materials used (if any) */}
        {job.parsedMaterialsUsed.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="package" size={18} color="#16a34a" />
              <Text style={styles.cardTitle}>Materiales utilizados</Text>
            </View>
            {job.parsedMaterialsUsed.map((material, index) => (
              <View key={index} style={styles.materialItem}>
                <Text style={styles.materialName}>{material.name}</Text>
                <Text style={styles.materialQty}>x{material.quantity}</Text>
                <Text style={styles.materialPrice}>
                  ${(material.quantity * material.price).toLocaleString('es-AR')}
                </Text>
              </View>
            ))}
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

        {/* Existing photos for completed jobs */}
        {job.isCompleted && photos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="image" size={18} color="#16a34a" />
              <Text style={styles.cardTitle}>Fotos ({photos.length})</Text>
            </View>
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image source={{ uri: photo.localUri }} style={styles.photo} />
                  <View style={styles.photoTypeBadge}>
                    <Text style={styles.photoTypeText}>
                      {photo.type === 'before' ? 'A' : photo.type === 'during' ? 'D' : 'F'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
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
  customer: jobsCollection.findAndObserve(id).pipe(
    switchMap((job: Job) =>
      job.customerId ? customersCollection.findAndObserve(job.customerId) : of(null)
    )
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
  viewDetailsHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
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
  // Photo styles
  photoBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#16a34a',
  },
  photoSection: {
    marginTop: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  photoItem: {
    position: 'relative',
    width: '30%',
    aspectRatio: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoTypeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    padding: 4,
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#16a34a',
  },
  photoHint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  // Materials
  materialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  materialName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  materialQty: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 12,
  },
  materialPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  // Total
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
