/**
 * Tabs Layout
 * ===========
 *
 * Main app navigation with bottom tabs.
 */

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar, Briefcase, Users, User, WifiOff, RefreshCw } from 'lucide-react-native';

import { useAuth } from '../../lib/auth/auth-context';
import { useSyncStatus } from '../../lib/hooks/use-sync-status';

export default function TabsLayout() {
  const { user, mode } = useAuth();
  const { isOnline, pendingOperations, isSyncing } = useSyncStatus();

  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color="#fff" />
          <Text style={styles.offlineText}>Sin conexion</Text>
          {pendingOperations > 0 && (
            <Text style={styles.offlineText}>
              - {pendingOperations} cambios pendientes
            </Text>
          )}
        </View>
      )}

      {/* Sync indicator */}
      {isOnline && isSyncing && (
        <View style={styles.syncBanner}>
          <RefreshCw size={14} color="#16a34a" />
          <Text style={styles.syncText}>Sincronizando...</Text>
        </View>
      )}

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#16a34a',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: 'Hoy',
            headerTitle: 'Mis Trabajos',
            tabBarIcon: ({ color, size }) => (
              <Calendar size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Trabajos',
            headerTitle: 'Todos los Trabajos',
            tabBarIcon: ({ color, size }) => (
              <Briefcase size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="customers"
          options={{
            title: 'Clientes',
            headerTitle: 'Clientes',
            tabBarIcon: ({ color, size }) => (
              <Users size={size} color={color} />
            ),
            // Hide in basic mode
            href: mode === 'advanced' ? '/customers' : null,
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            headerTitle: user?.name || 'Perfil',
            tabBarIcon: ({ color, size }) => (
              <User size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    paddingBottom: 8,
    height: 60,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#16a34a',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingVertical: 6,
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  syncText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '500',
  },
});
