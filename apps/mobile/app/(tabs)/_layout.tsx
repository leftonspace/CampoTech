/**
 * Tabs Layout
 * ===========
 *
 * Role-based navigation with bottom tabs.
 *
 * Tab visibility by role:
 * - OWNER: All tabs (today, jobs, calendar, team, profile)
 * - DISPATCHER: today, jobs, calendar, customers, profile
 * - TECHNICIAN: today, inventory, profile
 */

import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet, Animated } from 'react-native';
import {
  CalendarDays,
  CalendarClock,
  Briefcase,
  Package,
  User,
  WifiOff,
  RefreshCw,
  Users,
  Map,
  FileText,
} from 'lucide-react-native';
import { useRef, useEffect, useMemo } from 'react';

import { useAuth } from '../../lib/auth/auth-context';
import { useSyncStatus } from '../../lib/hooks/use-sync-status';

type UserRole = 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const { isOnline, pendingOperations, isSyncing } = useSyncStatus();
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Get user role with fallback
  const userRole = useMemo(() => {
    const role = user?.role?.toUpperCase();
    if (role === 'OWNER' || role === 'DISPATCHER' || role === 'TECHNICIAN') {
      return role as UserRole;
    }
    return 'TECHNICIAN' as UserRole;
  }, [user?.role]);

  // Check if user has access to specific tabs
  const canSeeJobs = userRole === 'OWNER' || userRole === 'DISPATCHER';
  const canSeeCalendar = userRole === 'OWNER' || userRole === 'DISPATCHER';
  const canSeeTeam = userRole === 'OWNER';
  const canSeeInvoices = userRole === 'OWNER';
  const canSeeInventory = userRole === 'TECHNICIAN';

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

  // Redirect to login if not authenticated
  if (!isLoading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

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
          headerShown: false,
        }}
      >
        {/* Today's Jobs - All roles see this */}
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

        {/* All Jobs - OWNER and DISPATCHER only */}
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Trabajos',
            headerTitle: 'Todos los Trabajos',
            headerShown: true,
            href: canSeeJobs ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Briefcase size={size} color={color} />
            ),
          }}
        />

        {/* Calendar/Agenda - OWNER and DISPATCHER only */}
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Agenda',
            href: canSeeCalendar ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <CalendarClock size={size} color={color} />
            ),
          }}
        />

        {/* Inventory - TECHNICIAN only */}
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Inventario',
            headerTitle: 'Mi Inventario',
            headerShown: true,
            href: canSeeInventory ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Package size={size} color={color} />
            ),
          }}
        />

        {/* Team - OWNER only */}
        <Tabs.Screen
          name="team"
          options={{
            title: 'Equipo',
            headerTitle: 'Mi Equipo',
            headerShown: true,
            href: canSeeTeam ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Users size={size} color={color} />
            ),
          }}
        />

        {/* Profile - All roles */}
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

        {/* Hidden screens - accessible via navigation but not in tab bar */}
        <Tabs.Screen
          name="customers"
          options={{
            title: 'Clientes',
            headerTitle: 'Clientes',
            headerShown: true,
            href: null,
            tabBarIcon: ({ color, size }) => (
              <Users size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="invoices"
          options={{
            title: 'Facturas',
            headerShown: true,
            href: null,
            tabBarIcon: ({ color, size }) => (
              <FileText size={size} color={color} />
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
