/**
 * Consumer Profile Screen
 * =======================
 *
 * Phase 15: Consumer Marketplace
 * Consumer profile management and settings.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  MapPin,
  Bell,
  Shield,
  Star,
  HelpCircle,
  LogOut,
  ChevronRight,
  Edit2,
  Heart,
  History,
  Gift,
  Settings,
  Repeat,
} from 'lucide-react-native';

import { useConsumerAuth } from '../../../lib/consumer/hooks/use-consumer-auth';
import { useAppMode } from '../../../lib/consumer/mode-switch';

export default function ConsumerProfileScreen() {
  const router = useRouter();
  const { consumer, logout, isLoading } = useConsumerAuth();
  const { switchToBusinessMode, hasBusinessProfile } = useAppMode();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesion',
      'Estas seguro que quieres cerrar sesion?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesion', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleSwitchMode = () => {
    if (hasBusinessProfile) {
      switchToBusinessMode();
    } else {
      Alert.alert(
        'Modo profesional',
        'No tienes un perfil de profesional. Deseas crear uno?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Crear perfil', onPress: () => router.push('/onboarding/business') },
        ]
      );
    }
  };

  const MENU_SECTIONS = [
    {
      title: 'Mi cuenta',
      items: [
        {
          icon: User,
          label: 'Editar perfil',
          onPress: () => {},
        },
        {
          icon: MapPin,
          label: 'Direcciones guardadas',
          onPress: () => {},
        },
        {
          icon: Bell,
          label: 'Notificaciones',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Actividad',
      items: [
        {
          icon: Star,
          label: 'Mis opiniones',
          subtitle: `${consumer?.totalReviewsGiven || 0} opiniones`,
          onPress: () => {},
        },
        {
          icon: Heart,
          label: 'Favoritos',
          onPress: () => {},
        },
        {
          icon: History,
          label: 'Historial de servicios',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Referidos',
      items: [
        {
          icon: Gift,
          label: 'Invitar amigos',
          subtitle: consumer?.referralCode ? `Codigo: ${consumer.referralCode}` : undefined,
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Otros',
      items: [
        {
          icon: Shield,
          label: 'Privacidad y seguridad',
          onPress: () => {},
        },
        {
          icon: HelpCircle,
          label: 'Ayuda y soporte',
          onPress: () => {},
        },
        {
          icon: Settings,
          label: 'Configuracion',
          onPress: () => {},
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {consumer?.profilePhotoUrl ? (
              <Image
                source={{ uri: consumer.profilePhotoUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {consumer?.firstName?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarButton}>
              <Edit2 size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>
            {consumer?.firstName} {consumer?.lastName || ''}
          </Text>
          <Text style={styles.userPhone}>{consumer?.phone}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{consumer?.totalRequests || 0}</Text>
              <Text style={styles.statLabel}>Solicitudes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{consumer?.totalJobsCompleted || 0}</Text>
              <Text style={styles.statLabel}>Completados</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{consumer?.totalReviewsGiven || 0}</Text>
              <Text style={styles.statLabel}>Opiniones</Text>
            </View>
          </View>
        </View>

        {/* Switch Mode Card */}
        <TouchableOpacity style={styles.switchModeCard} onPress={handleSwitchMode}>
          <View style={styles.switchModeIcon}>
            <Repeat size={24} color="#0284c7" />
          </View>
          <View style={styles.switchModeInfo}>
            <Text style={styles.switchModeTitle}>
              {hasBusinessProfile ? 'Cambiar a modo profesional' : 'Queres ofrecer servicios?'}
            </Text>
            <Text style={styles.switchModeText}>
              {hasBusinessProfile
                ? 'Gestiona tu negocio y recibe clientes'
                : 'Registra tu negocio y empieza a recibir clientes'}
            </Text>
          </View>
          <ChevronRight size={20} color="#6b7280" />
        </TouchableOpacity>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={styles.menuItems}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.menuItem}
                  onPress={item.onPress}
                >
                  <View style={styles.menuItemIcon}>
                    <item.icon size={20} color="#6b7280" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    {item.subtitle && (
                      <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                  <ChevronRight size={18} color="#d1d5db" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>CampoTech v1.0.0</Text>
          <Text style={styles.appCopyright}>
            100% gratis para consumidores
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
  },
  switchModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  switchModeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  switchModeInfo: {
    flex: 1,
  },
  switchModeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 2,
  },
  switchModeText: {
    fontSize: 13,
    color: '#3b82f6',
  },
  menuSection: {
    marginBottom: 16,
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  menuItems: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 15,
    color: '#111827',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ef4444',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appVersion: {
    fontSize: 13,
    color: '#9ca3af',
  },
  appCopyright: {
    fontSize: 12,
    color: '#d1d5db',
    marginTop: 4,
  },
  bottomSpacer: {
    height: 24,
  },
});
