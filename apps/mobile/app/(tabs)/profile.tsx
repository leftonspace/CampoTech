/**
 * Profile Screen
 * ==============
 *
 * User profile with settings and app configuration
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Settings,
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  ChevronRight,
  Moon,
  MapPin,
  Clock,
  Shield,
} from 'lucide-react-native';
import { useAuth } from '../../lib/auth/auth-context';
import { useSyncStatus, useForceSync } from '../../lib/hooks/use-sync-status';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const status = useSyncStatus();
  const forceSync = useForceSync();

  const [advancedMode, setAdvancedMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesion',
      'Estas seguro que queres salir? Los datos no sincronizados se perderan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const handleForceSync = async () => {
    if (!status.isOnline) {
      Alert.alert('Sin conexion', 'Necesitas conexion a internet para sincronizar.');
      return;
    }

    try {
      const result = await forceSync();
      if (result.success) {
        Alert.alert(
          'Sincronizacion completada',
          `Enviados: ${result.pushed}\nRecibidos: ${result.pulled}${
            result.conflicts > 0 ? `\nConflictos: ${result.conflicts}` : ''
          }`
        );
      } else {
        Alert.alert('Error', result.error || 'No se pudo sincronizar');
      }
    } catch (error) {
      Alert.alert('Error', 'Ocurrio un error al sincronizar');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.[0]?.toUpperCase() || 'T'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'Tecnico'}</Text>
          <Text style={styles.userPhone}>{user?.phone || ''}</Text>
          <View style={styles.roleBadge}>
            <Shield size={14} color="#059669" />
            <Text style={styles.roleText}>Tecnico de Campo</Text>
          </View>
        </View>

        {/* Sync Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de sincronizacion</Text>
          <View style={styles.syncCard}>
            <View style={styles.syncRow}>
              {status.isOnline ? (
                <Wifi size={20} color="#059669" />
              ) : (
                <WifiOff size={20} color="#dc2626" />
              )}
              <Text style={styles.syncText}>
                {status.isOnline ? 'Conectado' : 'Sin conexion'}
              </Text>
            </View>

            <View style={styles.syncDivider} />

            <View style={styles.syncStats}>
              <View style={styles.syncStat}>
                <Text style={styles.syncStatValue}>{status.pendingOperations}</Text>
                <Text style={styles.syncStatLabel}>Pendientes</Text>
              </View>
              <View style={styles.syncStat}>
                <Text style={styles.syncStatValue}>{status.conflicts}</Text>
                <Text style={styles.syncStatLabel}>Conflictos</Text>
              </View>
              <View style={styles.syncStat}>
                <Text style={styles.syncStatValue}>
                  {status.lastSync
                    ? new Date(status.lastSync).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--'}
                </Text>
                <Text style={styles.syncStatLabel}>Ultima sync</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.syncButton, status.isSyncing && styles.syncButtonDisabled]}
              onPress={handleForceSync}
              disabled={status.isSyncing}
            >
              <RefreshCw
                size={18}
                color="#fff"
                style={status.isSyncing ? styles.rotating : undefined}
              />
              <Text style={styles.syncButtonText}>
                {status.isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuracion</Text>

          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Settings size={20} color="#6b7280" />
                <Text style={styles.settingLabel}>Modo avanzado</Text>
              </View>
              <Switch
                value={advancedMode}
                onValueChange={setAdvancedMode}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={advancedMode ? '#059669' : '#f4f4f5'}
              />
            </View>
            <Text style={styles.settingHint}>
              Acceso a clientes, historial completo y mas opciones
            </Text>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Bell size={20} color="#6b7280" />
                <Text style={styles.settingLabel}>Notificaciones</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={notifications ? '#059669' : '#f4f4f5'}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <MapPin size={20} color="#6b7280" />
                <Text style={styles.settingLabel}>Seguimiento GPS</Text>
              </View>
              <Switch
                value={locationTracking}
                onValueChange={setLocationTracking}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={locationTracking ? '#059669' : '#f4f4f5'}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Moon size={20} color="#6b7280" />
                <Text style={styles.settingLabel}>Modo oscuro</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={darkMode ? '#059669' : '#f4f4f5'}
              />
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informacion</Text>

          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.infoRow}>
              <Text style={styles.infoLabel}>Organizacion</Text>
              <View style={styles.infoRight}>
                <Text style={styles.infoValue}>{user?.organizationName || 'CampoTech'}</Text>
                <ChevronRight size={18} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version de la app</Text>
              <View style={styles.infoRight}>
                <Text style={styles.infoValue}>1.0.0</Text>
                <ChevronRight size={18} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity style={styles.infoRow}>
              <Text style={styles.infoLabel}>Terminos y condiciones</Text>
              <ChevronRight size={18} color="#9ca3af" />
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity style={styles.infoRow}>
              <Text style={styles.infoLabel}>Politica de privacidad</Text>
              <ChevronRight size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>

        <View style={styles.footer} />
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
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  userPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#059669',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  syncCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  syncDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  syncStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  syncStat: {
    alignItems: 'center',
  },
  syncStatValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
  },
  syncStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  rotating: {
    // Animation would be handled differently in RN
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#111827',
  },
  settingHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    marginLeft: 32,
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 16,
    color: '#111827',
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  footer: {
    height: 40,
  },
});
