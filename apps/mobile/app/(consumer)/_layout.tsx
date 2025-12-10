/**
 * Consumer Layout
 * ===============
 *
 * Phase 15: Consumer Marketplace
 * Tab navigation for consumer-facing features.
 *
 * Tab Structure:
 * - Inicio: Home with categories and top businesses
 * - Buscar: Search and discover services
 * - Nuevo: Create service request (center action)
 * - Mis Trabajos: Track accepted jobs
 * - Perfil: Consumer profile and settings
 */

import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import {
  Home,
  Search,
  Plus,
  ClipboardList,
  User,
  WifiOff,
  RefreshCw,
} from 'lucide-react-native';
import { useRef, useEffect } from 'react';

import { useConsumerAuth } from '../../../lib/consumer/hooks/use-consumer-auth';
import { useSyncStatus } from '../../../lib/hooks/use-sync-status';

export default function ConsumerLayout() {
  const { consumer } = useConsumerAuth();
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
      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color="#fff" />
          <Text style={styles.offlineText}>Sin conexion</Text>
          {pendingOperations > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>{pendingOperations}</Text>
            </View>
          )}
        </View>
      )}

      {/* Sync indicator */}
      {isOnline && isSyncing && (
        <View style={styles.syncBanner}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <RefreshCw size={14} color="#0284c7" />
          </Animated.View>
          <Text style={styles.syncText}>Sincronizando...</Text>
        </View>
      )}

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#0284c7',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerShown: false,
        }}
      >
        {/* Home - Categories and top businesses */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            headerTitle: 'CampoTech',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <Home size={size} color={color} />
            ),
          }}
        />

        {/* Search - Find services */}
        <Tabs.Screen
          name="search"
          options={{
            title: 'Buscar',
            tabBarIcon: ({ color, size }) => (
              <Search size={size} color={color} />
            ),
          }}
        />

        {/* New Request - Center action button */}
        <Tabs.Screen
          name="request/new"
          options={{
            title: 'Solicitar',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.newButton, focused && styles.newButtonActive]}>
                <Plus size={24} color="#fff" />
              </View>
            ),
            tabBarLabel: () => null,
          }}
        />

        {/* My Jobs - Track progress */}
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Trabajos',
            tabBarIcon: ({ color, size }) => (
              <ClipboardList size={size} color={color} />
            ),
          }}
        />

        {/* Profile */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            headerTitle: consumer?.firstName || 'Mi Perfil',
            headerShown: true,
            tabBarIcon: ({ color, size }) => (
              <User size={size} color={color} />
            ),
          }}
        />

        {/* Hidden screens - accessible via navigation */}
        <Tabs.Screen
          name="business/[id]"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="request/[id]"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="reviews/new/[jobId]"
          options={{
            href: null,
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
    backgroundColor: '#0284c7',
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
    backgroundColor: '#f0f9ff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
  },
  syncText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '500',
  },
  newButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -12,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newButtonActive: {
    backgroundColor: '#0369a1',
  },
});
