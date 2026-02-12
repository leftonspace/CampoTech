/**
 * Team Management Screen - Enhanced for Owners
 * =============================================
 *
 * Phase 2.5.1: Team Management
 * - Performance metrics per technician
 * - Status indicators (active, on job, available)
 * - Role management
 * - Invite functionality
 * - Workload visualization
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import {
  Search,
  Plus,
  Phone,
  Mail,
  ChevronRight,
  User,
  Shield,
  Wrench,
  X,
  Check,
  Star,
  TrendingUp,
  Clock,
  MapPin,
  Filter,
  UserPlus,
  MoreVertical,
  Edit2,
  Trash2,
  Send,
  Activity,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../../watermelon/database';
import { useAuth } from '../../../lib/auth/auth-context';

// Role definitions
const ROLES = ['OWNER', 'ADMIN', 'ADMIN', 'TECHNICIAN', 'VIEWER'] as const;
type Role = typeof ROLES[number];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  VIEWER: 'Solo lectura',
};

const SKILL_LABELS: Record<string, string> = {
  AYUDANTE: 'Ayudante',
  MEDIO_OFICIAL: 'Medio Oficial',
  OFICIAL: 'Oficial',
  OFICIAL_ESPECIALIZADO: 'Oficial Especializado',
};

const STATUS_COLORS = {
  available: '#10b981',
  on_job: '#3b82f6',
  offline: '#9ca3af',
  busy: '#f59e0b',
};

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  specialty: string;
  skillLevel: string;
  isVerified: boolean;
  status: 'available' | 'on_job' | 'offline' | 'busy';
  currentJobId?: string;
  metrics: {
    completedJobs: number;
    avgRating: number;
    avgCompletionTime: number; // in minutes
    onTimeRate: number; // percentage
  };
  location?: {
    lat: number;
    lng: number;
    lastUpdate: string;
  };
}

// Mock data with enhanced metrics
const MOCK_TEAM: TeamMember[] = [
  {
    id: '1',
    name: 'Carlos Rodriguez',
    phone: '+5491155551234',
    email: 'carlos@example.com',
    role: 'TECHNICIAN',
    specialty: 'Instalación de splits',
    skillLevel: 'OFICIAL',
    isVerified: true,
    status: 'on_job',
    currentJobId: 'job-123',
    metrics: {
      completedJobs: 156,
      avgRating: 4.8,
      avgCompletionTime: 95,
      onTimeRate: 94,
    },
    location: { lat: -34.6037, lng: -58.3816, lastUpdate: new Date().toISOString() },
  },
  {
    id: '2',
    name: 'María García',
    phone: '+5491155555678',
    email: 'maria@example.com',
    role: 'TECHNICIAN',
    specialty: 'Reparación de aires',
    skillLevel: 'MEDIO_OFICIAL',
    isVerified: true,
    status: 'available',
    metrics: {
      completedJobs: 89,
      avgRating: 4.6,
      avgCompletionTime: 110,
      onTimeRate: 88,
    },
  },
  {
    id: '3',
    name: 'Juan Pérez',
    phone: '+5491155559012',
    email: null,
    role: 'TECHNICIAN',
    specialty: 'Mantenimiento',
    skillLevel: 'AYUDANTE',
    isVerified: false,
    status: 'offline',
    metrics: {
      completedJobs: 34,
      avgRating: 4.2,
      avgCompletionTime: 130,
      onTimeRate: 76,
    },
  },
  {
    id: '4',
    name: 'Diego Martínez',
    phone: '+5491155553456',
    email: 'diego@example.com',
    role: 'ADMIN',
    specialty: 'Coordinación',
    skillLevel: 'OFICIAL',
    isVerified: true,
    status: 'available',
    metrics: {
      completedJobs: 0,
      avgRating: 0,
      avgCompletionTime: 0,
      onTimeRate: 0,
    },
  },
];

type FilterType = 'all' | 'available' | 'on_job' | 'technicians' | 'staff';

export default function TeamManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [team] = useState<TeamMember[]>(MOCK_TEAM);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('TECHNICIAN');

  // Calculate team stats
  const teamStats = useMemo(() => {
    const technicians = team.filter((m) => m.role === 'TECHNICIAN');
    return {
      total: team.length,
      available: team.filter((m) => m.status === 'available').length,
      onJob: team.filter((m) => m.status === 'on_job').length,
      technicians: technicians.length,
      avgRating: technicians.length > 0
        ? technicians.reduce((sum, m) => sum + m.metrics.avgRating, 0) / technicians.length
        : 0,
      totalCompleted: technicians.reduce((sum, m) => sum + m.metrics.completedJobs, 0),
    };
  }, [team]);

  // Filter team
  const filteredTeam = useMemo(() => {
    let result = team;

    // Apply filter
    switch (filter) {
      case 'available':
        result = result.filter((m) => m.status === 'available');
        break;
      case 'on_job':
        result = result.filter((m) => m.status === 'on_job');
        break;
      case 'technicians':
        result = result.filter((m) => m.role === 'TECHNICIAN');
        break;
      case 'staff':
        result = result.filter((m) => m.role !== 'TECHNICIAN');
        break;
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.phone?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query) ||
          member.specialty?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [team, filter, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleMemberPress = (member: TeamMember) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  const handleInvite = () => {
    if (!inviteEmail.includes('@')) {
      Alert.alert('Error', 'Ingresá un email válido');
      return;
    }
    // In production, send invite via API
    Alert.alert(
      'Invitación enviada',
      `Se envió una invitación a ${inviteEmail} como ${ROLE_LABELS[inviteRole]}`
    );
    setShowInviteModal(false);
    setInviteEmail('');
  };

  const handleRemoveMember = (member: TeamMember) => {
    Alert.alert(
      'Eliminar miembro',
      `¿Seguro que querés eliminar a ${member.name} del equipo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            // In production, remove via API
            setShowMemberModal(false);
          },
        },
      ]
    );
  };

  const getStatusLabel = (status: TeamMember['status']) => {
    switch (status) {
      case 'available':
        return 'Disponible';
      case 'on_job':
        return 'En trabajo';
      case 'offline':
        return 'Desconectado';
      case 'busy':
        return 'Ocupado';
    }
  };

  const renderMember = ({ item: member }: { item: TeamMember }) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => handleMemberPress(member)}
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {member.name[0]?.toUpperCase() || '?'}
        </Text>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: STATUS_COLORS[member.status] },
          ]}
        />
      </View>

      <View style={styles.memberInfo}>
        <View style={styles.memberHeader}>
          <Text style={styles.memberName}>{member.name}</Text>
          <View style={[styles.roleBadge, getRoleBadgeStyle(member.role)]}>
            <Text style={styles.roleBadgeText}>
              {ROLE_LABELS[member.role] || member.role}
            </Text>
          </View>
        </View>

        <View style={styles.memberDetail}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[member.status] }]}>
            {getStatusLabel(member.status)}
          </Text>
          {member.specialty && (
            <>
              <Text style={styles.detailDivider}>•</Text>
              <Text style={styles.memberDetailText}>{member.specialty}</Text>
            </>
          )}
        </View>

        {member.role === 'TECHNICIAN' && (
          <View style={styles.metricsRow}>
            <View style={styles.metricBadge}>
              <Star size={10} color="#f59e0b" />
              <Text style={styles.metricText}>{member.metrics.avgRating.toFixed(1)}</Text>
            </View>
            <View style={styles.metricBadge}>
              <CheckCircle2 size={10} color="#10b981" />
              <Text style={styles.metricText}>{member.metrics.completedJobs}</Text>
            </View>
            <View style={styles.metricBadge}>
              <Clock size={10} color="#6b7280" />
              <Text style={styles.metricText}>{member.metrics.onTimeRate}%</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.memberActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleCall(member.phone)}
        >
          <Phone size={16} color="#059669" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Equipo</Text>
            <Text style={styles.subtitle}>{team.length} miembros</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowInviteModal(true)}
          >
            <UserPlus size={18} color="#fff" />
            <Text style={styles.addButtonText}>Invitar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{teamStats.available}</Text>
          <Text style={styles.statLabel}>Disponibles</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{teamStats.onJob}</Text>
          <Text style={styles.statLabel}>En trabajo</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={styles.ratingValue}>
            <Star size={12} color="#f59e0b" />
            <Text style={styles.statValue}>{teamStats.avgRating.toFixed(1)}</Text>
          </View>
          <Text style={styles.statLabel}>Promedio</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>
            {teamStats.totalCompleted}
          </Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar miembros..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterButton, filter !== 'all' && styles.filterButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <Filter size={18} color={filter !== 'all' ? '#fff' : '#6b7280'} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterPills}
        contentContainerStyle={styles.filterPillsContent}
      >
        {[
          { key: 'all', label: 'Todos' },
          { key: 'available', label: 'Disponibles' },
          { key: 'on_job', label: 'En trabajo' },
          { key: 'technicians', label: 'Técnicos' },
          { key: 'staff', label: 'Staff' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterPill,
              filter === f.key && styles.filterPillActive,
            ]}
            onPress={() => setFilter(f.key as FilterType)}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === f.key && styles.filterPillTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Team List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredTeam}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#059669"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <User size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'Sin resultados' : 'No hay miembros'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Probá con otra búsqueda'
                  : 'Invitá a tu primer miembro del equipo'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invitar miembro</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowInviteModal(false)}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="email@ejemplo.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={inviteEmail}
                onChangeText={setInviteEmail}
              />

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Rol</Text>
              <View style={styles.roleSelector}>
                {ROLES.filter((r) => r !== 'OWNER').map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      inviteRole === role && styles.roleOptionActive,
                    ]}
                    onPress={() => setInviteRole(role)}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        inviteRole === role && styles.roleOptionTextActive,
                      ]}
                    >
                      {ROLE_LABELS[role]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.inviteButton} onPress={handleInvite}>
                <Send size={18} color="#fff" />
                <Text style={styles.inviteButtonText}>Enviar invitación</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Member Detail Modal */}
      <Modal
        visible={showMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles del miembro</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowMemberModal(false)}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <ScrollView style={styles.memberDetailContent}>
                {/* Profile */}
                <View style={styles.memberProfile}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>
                      {selectedMember.name[0]?.toUpperCase()}
                    </Text>
                    <View
                      style={[
                        styles.profileStatusDot,
                        { backgroundColor: STATUS_COLORS[selectedMember.status] },
                      ]}
                    />
                  </View>
                  <Text style={styles.profileName}>{selectedMember.name}</Text>
                  <View style={styles.profileBadges}>
                    <View
                      style={[styles.roleBadge, getRoleBadgeStyle(selectedMember.role)]}
                    >
                      <Text style={styles.roleBadgeText}>
                        {ROLE_LABELS[selectedMember.role]}
                      </Text>
                    </View>
                    <View style={styles.skillBadge}>
                      <Text style={styles.skillBadgeText}>
                        {SKILL_LABELS[selectedMember.skillLevel]}
                      </Text>
                    </View>
                  </View>
                  {!selectedMember.isVerified && (
                    <View style={styles.unverifiedAlert}>
                      <AlertCircle size={14} color="#f59e0b" />
                      <Text style={styles.unverifiedAlertText}>
                        Cuenta no verificada
                      </Text>
                    </View>
                  )}
                </View>

                {/* Contact Actions */}
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => handleCall(selectedMember.phone)}
                  >
                    <Phone size={20} color="#059669" />
                    <Text style={styles.contactButtonText}>Llamar</Text>
                  </TouchableOpacity>
                  {selectedMember.email && (
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={() => handleEmail(selectedMember.email!)}
                    >
                      <Mail size={20} color="#3b82f6" />
                      <Text style={styles.contactButtonText}>Email</Text>
                    </TouchableOpacity>
                  )}
                  {selectedMember.location && (
                    <TouchableOpacity style={styles.contactButton}>
                      <MapPin size={20} color="#8b5cf6" />
                      <Text style={styles.contactButtonText}>Ubicación</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Performance Metrics */}
                {selectedMember.role === 'TECHNICIAN' && (
                  <View style={styles.metricsSection}>
                    <Text style={styles.sectionTitle}>Rendimiento</Text>
                    <View style={styles.metricsGrid}>
                      <View style={styles.metricCard}>
                        <View style={styles.metricCardHeader}>
                          <Star size={16} color="#f59e0b" />
                          <Text style={styles.metricCardValue}>
                            {selectedMember.metrics.avgRating.toFixed(1)}
                          </Text>
                        </View>
                        <Text style={styles.metricCardLabel}>Calificación</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <View style={styles.metricCardHeader}>
                          <CheckCircle2 size={16} color="#10b981" />
                          <Text style={styles.metricCardValue}>
                            {selectedMember.metrics.completedJobs}
                          </Text>
                        </View>
                        <Text style={styles.metricCardLabel}>Completados</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <View style={styles.metricCardHeader}>
                          <Clock size={16} color="#6b7280" />
                          <Text style={styles.metricCardValue}>
                            {selectedMember.metrics.avgCompletionTime}m
                          </Text>
                        </View>
                        <Text style={styles.metricCardLabel}>Tiempo prom.</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <View style={styles.metricCardHeader}>
                          <TrendingUp size={16} color="#3b82f6" />
                          <Text style={styles.metricCardValue}>
                            {selectedMember.metrics.onTimeRate}%
                          </Text>
                        </View>
                        <Text style={styles.metricCardLabel}>Puntualidad</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.memberActions2}>
                  <TouchableOpacity
                    style={styles.memberActionButton}
                    onPress={() => router.push(`/team/${selectedMember.id}/edit` as any)}
                  >
                    <Edit2 size={18} color="#374151" />
                    <Text style={styles.memberActionText}>Editar perfil</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.memberActionButton, styles.memberActionDanger]}
                    onPress={() => handleRemoveMember(selectedMember)}
                  >
                    <Trash2 size={18} color="#dc2626" />
                    <Text style={[styles.memberActionText, { color: '#dc2626' }]}>
                      Eliminar
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getRoleBadgeStyle(role: string) {
  switch (role) {
    case 'OWNER':
      return { backgroundColor: '#fef3c7' };
    case 'ADMIN':
      return { backgroundColor: '#dbeafe' };
    case 'ADMIN':
      return { backgroundColor: '#e0e7ff' };
    default:
      return { backgroundColor: '#f3f4f6' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
  },
  ratingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterPills: {
    maxHeight: 44,
    marginTop: 8,
  },
  filterPillsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
    marginTop: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  memberDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailDivider: {
    marginHorizontal: 6,
    color: '#d1d5db',
  },
  memberDetailText: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metricText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 76,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalContentLarge: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 16,
    paddingBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleOptionActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  roleOptionTextActive: {
    color: '#059669',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 24,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Member detail modal
  memberDetailContent: {
    padding: 16,
  },
  memberProfile: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#6b7280',
  },
  profileStatusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
  },
  profileBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  skillBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  unverifiedAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 12,
  },
  unverifiedAlertText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400e',
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  contactButton: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  metricsSection: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 10,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  metricCardLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  memberActions2: {
    gap: 12,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  memberActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 10,
  },
  memberActionDanger: {
    backgroundColor: '#fee2e2',
  },
  memberActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});
