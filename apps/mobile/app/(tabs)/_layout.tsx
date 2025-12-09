/**
 * Tabs Layout
 * ===========
 *
 * Phase 9.10: Mobile-First Architecture
 * Main app navigation with bottom tabs (max 5 tabs per guidelines).
 *
 * Tab Structure:
 * - Hoy: Today's jobs (primary view for field workers)
 * - Agenda: Calendar/scheduling view
 * - Trabajos: All jobs management
 * - Facturas: Invoicing
 * - Perfil: Profile and access to team/settings
 */

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Animated } from 'react-native';
import {
  CalendarDays,
  CalendarClock,
  Briefcase,
  FileText,
  User,
  WifiOff,
  RefreshCw,
  Users,
} from 'lucide-react-native';
import { useRef, useEffect } from 'react';

import { useAuth } from '../../lib/auth/auth-context';
import { useSyncStatus } from '../../lib/hooks/use-sync-status';

export default function TabsLayout() {
  const { user, mode } = useAuth();
  const { isOnline, pendingOperations, isSyncing } = useSyncStatus();
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Animate sync icon
  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [isSyncing]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      {/* Offline banner with pending operations count */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color="#fff" />
          <Text style={styles.offlineText}>Sin conexión</Text>
          {pendingOperations > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>{pendingOperations}</Text>
            </View>
          )}
        </View>
      )}

      {/* Sync indicator with animation */}
      {isOnline && isSyncing && (
        <View style={styles.syncBanner}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <RefreshCw size={14} color="#16a34a" />
          </Animated.View>
          <Text style={styles.syncText}>Sincronizando...</Text>
        </View>
      )}

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#059669',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerShown: false, // Most screens have custom headers
        }}
      >
        {/* Today's Jobs - Primary view for field workers */}
        <Tabs.Screen
          name="today"
          options={{
            title: 'Hoy',
            headerTitle: 'Mis Trabajos de Hoy',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <CalendarDays size={size} color={color} />
            ),
          }}
        />

        {/* Calendar/Agenda - Scheduling view */}
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Agenda',
            tabBarIcon: ({ color, size }) => (
              <CalendarClock size={size} color={color} />
            ),
          }}
        />

        {/* All Jobs */}
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Trabajos',
            headerTitle: 'Todos los Trabajos',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <Briefcase size={size} color={color} />
            ),
          }}
        />

        {/* Invoices */}
        <Tabs.Screen
          name="invoices"
          options={{
            title: 'Facturas',
            tabBarIcon: ({ color, size }) => (
              <FileText size={size} color={color} />
            ),
          }}
        />

        {/* Profile - Also provides access to Team and Settings */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            headerTitle: user?.name || 'Perfil',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <User size={size} color={color} />
            ),
          }}
        />

        {/* Hidden tabs - accessible via navigation but not in tab bar */}
        <Tabs.Screen
          name="customers"
          options={{
            title: 'Clientes',
            headerTitle: 'Clientes',
            headerShown: true,
            href: null, // Hide from tab bar, accessible via navigation
            tabBarIcon: ({ color, size }) => (
              <Users size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="team"
          options={{
            href: null, // Hide from tab bar, accessible via Profile
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
    height: 64,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#059669',
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
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 8,
  },
  offlineText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  pendingBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  pendingText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  syncText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '500',
  },
});
