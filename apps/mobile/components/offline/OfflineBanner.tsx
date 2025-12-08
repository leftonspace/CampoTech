/**
 * Offline Banner Component
 * ========================
 *
 * Displays a persistent banner when the device is offline
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { WifiOff, RefreshCw, X } from 'lucide-react-native';
import { useSyncStatus } from '../../lib/hooks/use-sync-status';

interface OfflineBannerProps {
  onDismiss?: () => void;
  showPendingCount?: boolean;
}

export function OfflineBanner({ onDismiss, showPendingCount = true }: OfflineBannerProps) {
  const { status } = useSyncStatus();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!status.isOnline) {
      // Slide in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status.isOnline, slideAnim, opacityAnim]);

  if (status.isOnline) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <WifiOff size={20} color="#fff" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Sin conexion a internet</Text>
          <Text style={styles.subtitle}>
            {showPendingCount && status.pendingOperations > 0
              ? `${status.pendingOperations} cambios pendientes de sincronizar`
              : 'Los cambios se guardaran localmente'}
          </Text>
        </View>
        {onDismiss && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color="#fca5a5" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Compact version for inline use
 */
export function OfflineIndicator() {
  const { status } = useSyncStatus();

  if (status.isOnline) {
    return null;
  }

  return (
    <View style={styles.indicator}>
      <WifiOff size={14} color="#dc2626" />
      <Text style={styles.indicatorText}>Offline</Text>
    </View>
  );
}

/**
 * Sync pending indicator
 */
export function PendingSyncIndicator() {
  const { status } = useSyncStatus();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status.isSyncing) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [status.isSyncing, rotateAnim]);

  if (status.pendingOperations === 0 && !status.isSyncing) {
    return null;
  }

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.pendingIndicator}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <RefreshCw
          size={14}
          color={status.isSyncing ? '#059669' : '#f59e0b'}
        />
      </Animated.View>
      <Text
        style={[
          styles.pendingText,
          status.isSyncing && styles.syncingText,
        ]}
      >
        {status.isSyncing
          ? 'Sincronizando...'
          : `${status.pendingOperations} pendientes`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#dc2626',
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#fecaca',
    marginTop: 2,
  },
  dismissButton: {
    padding: 4,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#dc2626',
  },
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#f59e0b',
  },
  syncingText: {
    color: '#059669',
  },
});
