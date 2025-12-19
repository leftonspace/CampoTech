/**
 * Profile Screen - Consumer App
 * ==============================
 *
 * User profile and settings screen.
 * Shows login prompt if not authenticated.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  User,
  MapPin,
  Bell,
  Shield,
  HelpCircle,
  FileText,
  MessageSquare,
  Star,
  ChevronRight,
  LogIn,
  LogOut,
  Settings,
  CreditCard,
  History,
} from 'lucide-react-native';

// Mock auth state - replace with actual auth context
const useAuth = () => ({
  isAuthenticated: true,
  user: {
    name: 'María García',
    email: 'maria.garcia@email.com',
    phone: '+54 11 2345-6789',
    avatar: 'MG',
    memberSince: 'Enero 2024',
  },
  logout: () => {},
});

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
}

export default function ProfileScreen() {
  const { isAuthenticated, user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que querés cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authIconContainer}>
          <User size={48} color="#9ca3af" />
        </View>
        <Text style={styles.authTitle}>Bienvenido a CampoTech</Text>
        <Text style={styles.authSubtitle}>
          Inicia sesión para acceder a tu perfil, historial de servicios y más
        </Text>
        <Pressable
          style={styles.loginButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <LogIn size={20} color="#fff" />
          <Text style={styles.loginButtonText}>Iniciar sesión</Text>
        </Pressable>
        <Pressable
          style={styles.registerButton}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.registerButtonText}>Crear una cuenta</Text>
        </Pressable>
      </View>
    );
  }

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Mi cuenta',
      items: [
        {
          id: 'personal',
          icon: <User size={20} color="#059669" />,
          label: 'Información personal',
          sublabel: user.email,
          onPress: () => router.push('/profile/personal'),
        },
        {
          id: 'addresses',
          icon: <MapPin size={20} color="#059669" />,
          label: 'Mis direcciones',
          sublabel: '2 direcciones guardadas',
          onPress: () => router.push('/profile/addresses'),
        },
        {
          id: 'payments',
          icon: <CreditCard size={20} color="#059669" />,
          label: 'Métodos de pago',
          onPress: () => router.push('/profile/payments'),
        },
      ],
    },
    {
      title: 'Actividad',
      items: [
        {
          id: 'history',
          icon: <History size={20} color="#3b82f6" />,
          label: 'Historial de servicios',
          onPress: () => router.push('/profile/history'),
        },
        {
          id: 'reviews',
          icon: <Star size={20} color="#3b82f6" />,
          label: 'Mis reseñas',
          onPress: () => router.push('/profile/reviews'),
        },
      ],
    },
    {
      title: 'Configuración',
      items: [
        {
          id: 'notifications',
          icon: <Bell size={20} color="#6b7280" />,
          label: 'Notificaciones',
          onPress: () => router.push('/profile/notifications'),
        },
        {
          id: 'privacy',
          icon: <Shield size={20} color="#6b7280" />,
          label: 'Privacidad',
          onPress: () => router.push('/profile/privacy'),
        },
        {
          id: 'settings',
          icon: <Settings size={20} color="#6b7280" />,
          label: 'Configuración general',
          onPress: () => router.push('/profile/settings'),
        },
      ],
    },
    {
      title: 'Ayuda',
      items: [
        {
          id: 'help',
          icon: <HelpCircle size={20} color="#6b7280" />,
          label: 'Centro de ayuda',
          onPress: () => router.push('/help'),
        },
        {
          id: 'contact',
          icon: <MessageSquare size={20} color="#6b7280" />,
          label: 'Contactar soporte',
          onPress: () => router.push('/support'),
        },
        {
          id: 'terms',
          icon: <FileText size={20} color="#6b7280" />,
          label: 'Términos y condiciones',
          onPress: () => router.push('/legal/terms'),
        },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{user.avatar}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userMemberSince}>
            Miembro desde {user.memberSince}
          </Text>
        </View>
        <Pressable
          style={styles.editButton}
          onPress={() => router.push('/profile/edit')}
        >
          <Text style={styles.editButtonText}>Editar</Text>
        </Pressable>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Servicios</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Reseñas</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>3</Text>
          <Text style={styles.statLabel}>Favoritos</Text>
        </View>
      </View>

      {/* Menu Sections */}
      {menuSections.map((section, sectionIndex) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item, itemIndex) => (
              <Pressable
                key={item.id}
                style={[
                  styles.menuItem,
                  itemIndex < section.items.length - 1 && styles.menuItemBorder,
                ]}
                onPress={item.onPress}
              >
                <View style={styles.menuItemLeft}>
                  {item.icon}
                  <View style={styles.menuItemTextContainer}>
                    <Text style={[
                      styles.menuItemLabel,
                      item.danger && styles.menuItemLabelDanger,
                    ]}>
                      {item.label}
                    </Text>
                    {item.sublabel && (
                      <Text style={styles.menuItemSublabel}>{item.sublabel}</Text>
                    )}
                  </View>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Logout Button */}
      <View style={styles.section}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
        </Pressable>
      </View>

      {/* App Version */}
      <Text style={styles.versionText}>CampoTech v1.0.0</Text>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  authContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  authIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 280,
    lineHeight: 22,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
  },
  registerButtonText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  userMemberSince: {
    fontSize: 14,
    color: '#6b7280',
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  editButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  menuItemLabelDanger: {
    color: '#ef4444',
  },
  menuItemSublabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 24,
  },
  bottomSpacer: {
    height: 40,
  },
});
