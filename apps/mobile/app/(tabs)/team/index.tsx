/**
 * Team List Screen
 * ================
 *
 * Phase 9.10: Mobile-First Architecture
 * Team management for business owners and admins
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
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
} from 'lucide-react-native';
import * as Linking from 'expo-linking';

import { useAuth } from '../../../lib/auth/auth-context';

// Mock data - in production, this comes from WatermelonDB
const MOCK_TEAM = [
  {
    id: '1',
    name: 'Carlos Rodriguez',
    phone: '+5491155551234',
    email: 'carlos@example.com',
    role: 'TECHNICIAN',
    specialty: 'Instalación de splits',
    skillLevel: 'OFICIAL',
    isVerified: true,
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
  },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  DISPATCHER: 'Despachador',
  TECHNICIAN: 'Técnico',
  VIEWER: 'Solo lectura',
};

const SKILL_LABELS: Record<string, string> = {
  AYUDANTE: 'Ayudante',
  MEDIO_OFICIAL: 'Medio Oficial',
  OFICIAL: 'Oficial',
  OFICIAL_ESPECIALIZADO: 'Oficial Especializado',
};

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  specialty: string;
  skillLevel: string;
  isVerified: boolean;
}

export default function TeamListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [team] = useState<TeamMember[]>(MOCK_TEAM);

  const filteredTeam = team.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(query) ||
      member.phone?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.specialty?.toLowerCase().includes(query)
    );
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Sync would be triggered here
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleAddMember = () => {
    router.push('/team/add');
  };

  const renderMember = ({ item: member }: { item: TeamMember }) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => router.push(`/team/${member.id}`)}
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {member.name[0]?.toUpperCase() || '?'}
        </Text>
        {!member.isVerified && (
          <View style={styles.unverifiedBadge}>
            <Text style={styles.unverifiedText}>!</Text>
          </View>
        )}
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

        {member.specialty && (
          <View style={styles.memberDetail}>
            <Wrench size={12} color="#6b7280" />
            <Text style={styles.memberDetailText}>{member.specialty}</Text>
          </View>
        )}

        <View style={styles.memberDetail}>
          <Shield size={12} color="#6b7280" />
          <Text style={styles.memberDetailText}>
            {SKILL_LABELS[member.skillLevel] || member.skillLevel}
          </Text>
        </View>
      </View>

      <View style={styles.memberActions}>
        {member.phone && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCall(member.phone)}
          >
            <Phone size={18} color="#059669" />
          </TouchableOpacity>
        )}
        <ChevronRight size={20} color="#9ca3af" />
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
          <TouchableOpacity style={styles.addButton} onPress={handleAddMember}>
            <Plus size={20} color="#fff" />
            <Text style={styles.addButtonText}>Agregar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o especialidad..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Team List */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredTeam}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          estimatedItemSize={100}
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
                  : 'Agregá tu primer miembro del equipo'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleAddMember}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={styles.emptyButtonText}>Agregar miembro</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </SafeAreaView>
  );
}

function getRoleBadgeStyle(role: string) {
  switch (role) {
    case 'OWNER':
      return { backgroundColor: '#fef3c7' };
    case 'ADMIN':
      return { backgroundColor: '#dbeafe' };
    case 'DISPATCHER':
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  listContainer: {
    flex: 1,
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
  unverifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unverifiedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  memberDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  memberDetailText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
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
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
