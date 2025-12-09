/**
 * Offline Indicator Component
 * ===========================
 *
 * Phase 9.10: Mobile-First Architecture
 * Visual indicator for offline status with sync queue info.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  Check,
  X,
} from 'lucide-react-native';

import { useSyncStatus } from '../../lib/hooks/use-sync-status';
import { performSync } from '../../lib/sync/sync-engine';

interface OfflineIndicatorProps {
  showDetails?: boolean;
  position?: 'top' | 'bottom' | 'floating';
}

export function OfflineIndicator({
  showDetails = true,
  position = 'top',
}: OfflineIndicatorProps) {
  const { isOnline, pendingOperations, isSyncing, conflicts, lastSync } = useSyncStatus();
  const [showModal, setShowModal] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for pending operations
  useEffect(() => {
    if (pendingOperations > 0 && !isSyncing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [pendingOperations, isSyncing]);

  // Auto-hide success message
  useEffect(() => {
    if (syncResult) {
      const timer = setTimeout(() => setSyncResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncResult]);

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;

    const result = await performSync();
    if (result.success) {
      setSyncResult(`Sincronizado: ${result.pushed} enviados, ${result.pulled} recibidos`);
    } else {
      setSyncResult(`Error: ${result.error}`);
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Nunca';
    const diff = Date.now() - lastSync.getTime();
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} horas`;
    return lastSync.toLocaleDateString('es-AR');
  };

  // If online and no pending operations, show minimal indicator
  if (isOnline && pendingOperations === 0 && conflicts === 0 && !syncResult) {
    return null;
  }

  const containerStyle = [
    styles.container,
    position === 'bottom' && styles.containerBottom,
    position === 'floating' && styles.containerFloating,
    !isOnline && styles.containerOffline,
    isSyncing && styles.containerSyncing,
    syncResult && (syncResult.includes('Error') ? styles.containerError : styles.containerSuccess),
  ];

  return (
    <>
      <Animated.View style={[containerStyle, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.content}
          onPress={() => showDetails && setShowModal(true)}
          onLongPress={handleManualSync}
          disabled={!showDetails}
        >
          {/* Status Icon */}
          <View style={styles.iconContainer}>
            {!isOnline ? (
              <WifiOff size={16} color="#fff" />
            ) : isSyncing ? (
              <Animated.View style={{ transform: [{ rotate: '360deg' }] }}>
                <RefreshCw size={16} color="#fff" />
              </Animated.View>
            ) : conflicts > 0 ? (
              <AlertCircle size={16} color="#fff" />
            ) : syncResult?.includes('Error') ? (
              <X size={16} color="#fff" />
            ) : syncResult ? (
              <Check size={16} color="#fff" />
            ) : (
              <Cloud size={16} color="#fff" />
            )}
          </View>

          {/* Status Text */}
          <Text style={styles.text}>
            {!isOnline
              ? 'Sin conexión'
              : isSyncing
                ? 'Sincronizando...'
                : syncResult
                  ? syncResult
                  : conflicts > 0
                    ? `${conflicts} conflicto${conflicts > 1 ? 's' : ''}`
                    : `${pendingOperations} pendiente${pendingOperations > 1 ? 's' : ''}`}
          </Text>

          {/* Pending Badge */}
          {pendingOperations > 0 && !isSyncing && !syncResult && (
            <Animated.View
              style={[styles.badge, { transform: [{ scale: pulseAnim }] }]}
            >
              <Text style={styles.badgeText}>{pendingOperations}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Details Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Estado de Sincronización</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Connection Status */}
              <View style={styles.statusRow}>
                <View style={styles.statusIcon}>
                  {isOnline ? (
                    <Cloud size={24} color="#059669" />
                  ) : (
                    <CloudOff size={24} color="#ef4444" />
                  )}
                </View>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusLabel}>Conexión</Text>
                  <Text style={styles.statusValue}>
                    {isOnline ? 'En línea' : 'Sin conexión'}
                  </Text>
                </View>
              </View>

              {/* Last Sync */}
              <View style={styles.statusRow}>
                <View style={styles.statusIcon}>
                  <RefreshCw size={24} color="#6b7280" />
                </View>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusLabel}>Última sincronización</Text>
                  <Text style={styles.statusValue}>{formatLastSync()}</Text>
                </View>
              </View>

              {/* Pending Operations */}
              <View style={styles.statusRow}>
                <View style={styles.statusIcon}>
                  <Cloud size={24} color={pendingOperations > 0 ? '#f59e0b' : '#6b7280'} />
                </View>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusLabel}>Operaciones pendientes</Text>
                  <Text style={styles.statusValue}>{pendingOperations}</Text>
                </View>
              </View>

              {/* Conflicts */}
              {conflicts > 0 && (
                <View style={styles.statusRow}>
                  <View style={styles.statusIcon}>
                    <AlertCircle size={24} color="#ef4444" />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusLabel}>Conflictos por resolver</Text>
                    <Text style={[styles.statusValue, { color: '#ef4444' }]}>
                      {conflicts}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.syncButton,
                  (!isOnline || isSyncing) && styles.syncButtonDisabled,
                ]}
                onPress={handleManualSync}
                disabled={!isOnline || isSyncing}
              >
                <RefreshCw
                  size={20}
                  color={!isOnline || isSyncing ? '#9ca3af' : '#fff'}
                />
                <Text
                  style={[
                    styles.syncButtonText,
                    (!isOnline || isSyncing) && styles.syncButtonTextDisabled,
                  ]}
                >
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Help Text */}
            <Text style={styles.helpText}>
              Los cambios se guardan localmente y se sincronizan automáticamente
              cuando hay conexión.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  containerBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  containerFloating: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  containerOffline: {
    backgroundColor: '#ef4444',
  },
  containerSyncing: {
    backgroundColor: '#059669',
  },
  containerError: {
    backgroundColor: '#ef4444',
  },
  containerSuccess: {
    backgroundColor: '#059669',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  badgeText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalBody: {
    gap: 16,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
  modalActions: {
    marginBottom: 16,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
  },
  syncButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  syncButtonTextDisabled: {
    color: '#9ca3af',
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});
