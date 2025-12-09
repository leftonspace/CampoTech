/**
 * Settings Screen
 * ===============
 *
 * Phase 9.10: Mobile-First Architecture
 * Main settings screen with all configuration options
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Bell,
  MessageCircle,
  CreditCard,
  Clock,
  Globe,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Moon,
} from 'lucide-react-native';
import { useState } from 'react';

import { useAuth } from '../../lib/auth/auth-context';

interface SettingsRowProps {
  icon: any;
  iconColor?: string;
  label: string;
  description?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}

function SettingsRow({
  icon: Icon,
  iconColor = '#374151',
  label,
  description,
  onPress,
  rightElement,
  showChevron = true,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
        <Icon size={20} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description && <Text style={styles.rowDescription}>{description}</Text>}
      </View>
      {rightElement || (showChevron && onPress && <ChevronRight size={20} color="#9ca3af" />)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Configuración</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Section */}
        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {user?.name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
            <Text style={styles.userRole}>{user?.role || 'Técnico'}</Text>
          </View>
        </View>

        {/* Business Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Negocio</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={Building2}
              iconColor="#059669"
              label="Información del negocio"
              description="Nombre, logo, datos fiscales"
              onPress={() => router.push('/settings/business')}
            />
            <SettingsRow
              icon={Clock}
              iconColor="#3b82f6"
              label="Horario de atención"
              description="Días y horarios de trabajo"
              onPress={() => router.push('/settings/business-hours')}
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notificaciones</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={Bell}
              iconColor="#f59e0b"
              label="Notificaciones push"
              description="Recibir alertas en el dispositivo"
              showChevron={false}
              rightElement={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                  thumbColor={notifications ? '#059669' : '#f4f4f5'}
                />
              }
            />
            <SettingsRow
              icon={Bell}
              iconColor="#f59e0b"
              label="Preferencias de notificación"
              description="Qué notificaciones recibir"
              onPress={() => router.push('/settings/notifications')}
            />
          </View>
        </View>

        {/* Integrations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integraciones</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={MessageCircle}
              iconColor="#25D366"
              label="WhatsApp Business"
              description="Configurar mensajes automáticos"
              onPress={() => router.push('/settings/whatsapp')}
            />
            <SettingsRow
              icon={CreditCard}
              iconColor="#0099e5"
              label="MercadoPago"
              description="Configurar cobros online"
              onPress={() => router.push('/settings/mercadopago')}
            />
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aplicación</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={Moon}
              iconColor="#6366f1"
              label="Modo oscuro"
              description="Cambiar apariencia"
              showChevron={false}
              rightElement={
                <Switch
                  value={darkMode}
                  onValueChange={setDarkMode}
                  trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                  thumbColor={darkMode ? '#059669' : '#f4f4f5'}
                />
              }
            />
            <SettingsRow
              icon={Globe}
              iconColor="#8b5cf6"
              label="Idioma"
              description="Español (Argentina)"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={CreditCard}
              iconColor="#059669"
              label="Suscripción"
              description="Plan Profesional"
              onPress={() => router.push('/settings/subscription')}
            />
            <SettingsRow
              icon={Shield}
              iconColor="#64748b"
              label="Seguridad"
              description="Contraseña y acceso"
              onPress={() => router.push('/settings/security')}
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Soporte</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={HelpCircle}
              iconColor="#0ea5e9"
              label="Centro de ayuda"
              description="Preguntas frecuentes"
              onPress={() => {}}
            />
            <SettingsRow
              icon={MessageCircle}
              iconColor="#0ea5e9"
              label="Contactar soporte"
              description="Chatear con nosotros"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>CampoTech v1.0.0</Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  userInfo: {
    marginLeft: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  userRole: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginLeft: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  rowDescription: {
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
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
});
