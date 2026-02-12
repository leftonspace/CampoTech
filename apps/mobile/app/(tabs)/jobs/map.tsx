/**
 * Live Map Screen (ADMIN)
 * ============================
 *
 * Phase 2.4.2: Live Map Screen
 * Shows all active technicians on a map with real-time location updates.
 * Displays job markers and allows quick access to job details.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';

import { jobsCollection } from '../../../watermelon/database';
import { Job } from '../../../watermelon/models';
import { api } from '../../../lib/api/client';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// Buenos Aires default location
const DEFAULT_REGION = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: LATITUDE_DELTA,
  longitudeDelta: LONGITUDE_DELTA,
};

// Polling interval for real-time updates (10 seconds)
const LOCATION_POLL_INTERVAL = 10000;

interface TechnicianLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  currentJobId: string | null;
  lastUpdate: Date;
}

function LiveMapScreen({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [technicians, setTechnicians] = useState<TechnicianLocation[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianLocation | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch technician locations from API
  const fetchTechnicianLocations = useCallback(async () => {
    try {
      const response = await api.map.getTechnicianLocations({ onlineOnly: false });

      if (response.success && response.data) {
        // Map API response to component's TechnicianLocation interface
        const mappedTechnicians: TechnicianLocation[] = response.data.technicians
          .filter((t) => t.location !== null)
          .map((t) => {
            // Map API status to component status
            let status = 'available';
            if (t.currentJob?.status === 'EN_ROUTE') {
              status = 'en_route';
            } else if (t.currentJob?.status === 'IN_PROGRESS') {
              status = 'working';
            } else if (!t.isOnline) {
              status = 'offline';
            }

            return {
              id: t.id,
              name: t.name,
              latitude: t.location!.lat,
              longitude: t.location!.lng,
              status,
              currentJobId: t.currentJob?.id || null,
              lastUpdate: t.lastSeen ? new Date(t.lastSeen) : new Date(),
            };
          });

        setTechnicians(mappedTechnicians);
        setError(null);
      } else {
        console.warn('[LiveMap] Failed to fetch technicians:', response.error);
        setError(response.error?.message || 'Error cargando ubicaciones');
      }
    } catch (err) {
      console.error('[LiveMap] Error fetching technician locations:', err);
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch locations on mount and poll for updates
  useEffect(() => {
    fetchTechnicianLocations();

    const interval = setInterval(fetchTechnicianLocations, LOCATION_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTechnicianLocations]);

  // Get active jobs with locations
  const jobsWithLocation = jobs.filter(
    (j) => j.latitude && j.longitude && (j.status === 'scheduled' || j.status === 'pending')
  );

  // Fit map to show all markers
  const fitToMarkers = useCallback(() => {
    if (!mapRef.current) return;

    const coordinates = [
      ...technicians.map((t) => ({ latitude: t.latitude, longitude: t.longitude })),
      ...jobsWithLocation
        .filter((j) => j.latitude && j.longitude)
        .map((j) => ({ latitude: j.latitude!, longitude: j.longitude! })),
    ];

    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }
  }, [technicians, jobsWithLocation]);

  const handleTechnicianPress = (technician: TechnicianLocation) => {
    setSelectedTechnician(technician);
    setSelectedJob(null);

    // Center map on technician
    mapRef.current?.animateToRegion({
      latitude: technician.latitude,
      longitude: technician.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const handleJobPress = (job: Job) => {
    setSelectedJob(job);
    setSelectedTechnician(null);

    if (job.latitude && job.longitude) {
      mapRef.current?.animateToRegion({
        latitude: job.latitude,
        longitude: job.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleViewJobDetails = (jobId: string) => {
    router.push(`/(tabs)/jobs/${jobId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'en_route':
        return '#3b82f6'; // Blue
      case 'working':
        return '#16a34a'; // Green
      case 'available':
        return '#9ca3af'; // Gray
      case 'offline':
        return '#ef4444'; // Red
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'en_route':
        return 'En camino';
      case 'working':
        return 'Trabajando';
      case 'available':
        return 'Disponible';
      case 'offline':
        return 'Sin conexión';
      default:
        return status;
    }
  };

  // Show loading state
  if (isLoading && technicians.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Cargando ubicaciones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mapa en vivo</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={fetchTechnicianLocations}
          >
            <Feather name="refresh-cw" size={20} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
          >
            <Feather
              name={mapType === 'standard' ? 'globe' : 'map'}
              size={20}
              color="#374151"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={fitToMarkers}>
            <Feather name="maximize" size={20} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowLegend(true)}>
            <Feather name="info" size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchTechnicianLocations}>
            <Feather name="refresh-cw" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.statText}>
            {technicians.filter((t) => t.status === 'en_route').length} en camino
          </Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#16a34a' }]} />
          <Text style={styles.statText}>
            {technicians.filter((t) => t.status === 'working').length} trabajando
          </Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#9ca3af' }]} />
          <Text style={styles.statText}>
            {technicians.filter((t) => t.status === 'available').length} disponible
          </Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={DEFAULT_REGION}
          mapType={mapType}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Technician markers */}
          {technicians.map((tech) => (
            <Marker
              key={`tech-${tech.id}`}
              coordinate={{
                latitude: tech.latitude,
                longitude: tech.longitude,
              }}
              onPress={() => handleTechnicianPress(tech)}
            >
              <View style={styles.technicianMarker}>
                <View
                  style={[
                    styles.technicianMarkerInner,
                    { backgroundColor: getStatusColor(tech.status) },
                  ]}
                >
                  <Feather name="truck" size={16} color="#fff" />
                </View>
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{tech.name}</Text>
                  <Text style={styles.calloutStatus}>{getStatusLabel(tech.status)}</Text>
                </View>
              </Callout>
            </Marker>
          ))}

          {/* Job markers */}
          {jobsWithLocation.map((job) => (
            <Marker
              key={`job-${job.id}`}
              coordinate={{
                latitude: job.latitude!,
                longitude: job.longitude!,
              }}
              onPress={() => handleJobPress(job)}
            >
              <View style={styles.jobMarker}>
                <Feather
                  name="briefcase"
                  size={14}
                  color={job.assignedToId ? '#374151' : '#f59e0b'}
                />
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{job.serviceType}</Text>
                  <Text style={styles.calloutAddress} numberOfLines={1}>
                    {job.address}
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* My location button */}
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={() => {
            // In production, would use device location
            mapRef.current?.animateToRegion(DEFAULT_REGION);
          }}
        >
          <Feather name="crosshair" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Technician list at bottom */}
      <View style={styles.technicianList}>
        <Text style={styles.technicianListTitle}>Técnicos activos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {technicians.map((tech) => (
            <TouchableOpacity
              key={tech.id}
              style={[
                styles.technicianCard,
                selectedTechnician?.id === tech.id && styles.technicianCardSelected,
              ]}
              onPress={() => handleTechnicianPress(tech)}
            >
              <View
                style={[
                  styles.technicianCardDot,
                  { backgroundColor: getStatusColor(tech.status) },
                ]}
              />
              <Text style={styles.technicianCardName} numberOfLines={1}>
                {tech.name.split(' ')[0]}
              </Text>
              <Text style={styles.technicianCardStatus}>{getStatusLabel(tech.status)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selected technician details */}
      {selectedTechnician && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailInfo}>
              <View
                style={[
                  styles.detailAvatar,
                  { backgroundColor: getStatusColor(selectedTechnician.status) },
                ]}
              >
                <Text style={styles.detailAvatarText}>
                  {selectedTechnician.name.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={styles.detailName}>{selectedTechnician.name}</Text>
                <Text style={styles.detailStatus}>
                  {getStatusLabel(selectedTechnician.status)}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedTechnician(null)}>
              <Feather name="x" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.detailActions}>
            <TouchableOpacity style={styles.detailAction}>
              <Feather name="phone" size={18} color="#16a34a" />
              <Text style={styles.detailActionText}>Llamar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailAction}>
              <Feather name="message-circle" size={18} color="#3b82f6" />
              <Text style={styles.detailActionText}>Mensaje</Text>
            </TouchableOpacity>
            {selectedTechnician.currentJobId && (
              <TouchableOpacity
                style={styles.detailAction}
                onPress={() => handleViewJobDetails(selectedTechnician.currentJobId!)}
              >
                <Feather name="briefcase" size={18} color="#8b5cf6" />
                <Text style={styles.detailActionText}>Ver trabajo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Selected job details */}
      {selectedJob && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailInfo}>
              <View style={[styles.detailAvatar, { backgroundColor: '#f59e0b' }]}>
                <Feather name="briefcase" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{selectedJob.serviceType}</Text>
                <Text style={styles.detailStatus} numberOfLines={1}>
                  {selectedJob.address}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedJob(null)}>
              <Feather name="x" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.viewJobButton}
            onPress={() => handleViewJobDetails(selectedJob.id)}
          >
            <Text style={styles.viewJobButtonText}>Ver detalles del trabajo</Text>
            <Feather name="chevron-right" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Legend Modal */}
      <Modal
        visible={showLegend}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLegend(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLegend(false)}
        >
          <View style={styles.legendModal}>
            <Text style={styles.legendTitle}>Leyenda del mapa</Text>

            <Text style={styles.legendSection}>Técnicos</Text>
            <View style={styles.legendItem}>
              <View style={[styles.legendMarker, { backgroundColor: '#3b82f6' }]}>
                <Feather name="truck" size={12} color="#fff" />
              </View>
              <Text style={styles.legendText}>En camino</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendMarker, { backgroundColor: '#16a34a' }]}>
                <Feather name="truck" size={12} color="#fff" />
              </View>
              <Text style={styles.legendText}>Trabajando</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendMarker, { backgroundColor: '#9ca3af' }]}>
                <Feather name="truck" size={12} color="#fff" />
              </View>
              <Text style={styles.legendText}>Disponible</Text>
            </View>

            <Text style={[styles.legendSection, { marginTop: 16 }]}>Trabajos</Text>
            <View style={styles.legendItem}>
              <View style={styles.jobMarkerLegend}>
                <Feather name="briefcase" size={12} color="#374151" />
              </View>
              <Text style={styles.legendText}>Trabajo asignado</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.jobMarkerLegend, { borderColor: '#f59e0b' }]}>
                <Feather name="briefcase" size={12} color="#f59e0b" />
              </View>
              <Text style={styles.legendText}>Sin asignar</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// Observe jobs from WatermelonDB
const enhance = withObservables([], () => ({
  jobs: jobsCollection.query(
    Q.or(Q.where('status', 'scheduled'), Q.where('status', 'pending'))
  ),
}));

export default enhance(LiveMapScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#e5e7eb',
    borderTopColor: '#16a34a',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#fff',
    flex: 1,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    fontSize: 13,
    color: '#6b7280',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  myLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  technicianMarker: {
    alignItems: 'center',
  },
  technicianMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  jobMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  callout: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    minWidth: 120,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  calloutStatus: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  calloutAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  technicianList: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingLeft: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  technicianListTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  technicianCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  technicianCardSelected: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  technicianCardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 6,
  },
  technicianCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  technicianCardStatus: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  detailCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  detailName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  detailStatus: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  detailActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  detailAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  detailActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  viewJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
  },
  viewJobButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendModal: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  legendSection: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  legendMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontSize: 14,
    color: '#374151',
  },
  jobMarkerLegend: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
});
