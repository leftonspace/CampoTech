/**
 * Queue Status Component
 * ======================
 *
 * Shows offline queue status with retry capabilities
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CloudOff,
  RefreshCw,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import { Q } from '@nozbe/watermelondb';
import { syncQueueCollection, database } from '../../watermelon/database';
import { SyncQueue } from '../../watermelon/models';
import { performSync } from '../../lib/sync/sync-engine';
import { useSyncStatus } from '../../lib/hooks/use-sync-status';

interface QueueStatusProps {
  compact?: boolean;
}

export function QueueStatus({ compact = false }: QueueStatusProps) {
  const status = useSyncStatus();
  const [showModal, setShowModal] = useState(false);
  const [queueItems, setQueueItems] = useState<SyncQueue[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const subscription = syncQueueCollection
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe((items) => {
        setQueueItems(items as SyncQueue[]);
      });

    return () => subscription.unsubscribe();
  }, []);

  const handleSync = async () => {
    if (!status.isOnline) {
      Alert.alert('Sin conexion', 'Necesitas conexion a internet para sincronizar.');
      return;
    }

    setSyncing(true);
    try {
      const result = await performSync();
      if (result.success) {
        Alert.alert('Sincronizado', `${result.pushed} cambios enviados`);
      } else {
        Alert.alert('Error', result.error || 'No se pudo sincronizar');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleClearQueue = () => {
    Alert.alert(
      'Limpiar cola',
      'Estas seguro? Se perderan todos los cambios pendientes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            await database.write(async () => {
              for (const item of queueItems) {
                await item.destroyPermanently();
              }
            });
          },
        },
      ]
    );
  };

  const handleDeleteItem = (item: SyncQueue) => {
    Alert.alert(
      'Eliminar operacion',
      'Este cambio no se sincronizara. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await database.write(async () => {
              await item.destroyPermanently();
            });
          },
        },
      ]
    );
  };

  if (queueItems.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={() => setShowModal(true)}
      >
        <CloudOff size={16} color="#f59e0b" />
        <Text style={styles.compactText}>{queueItems.length} pendientes</Text>
        <ChevronRight size={16} color="#9ca3af" />
      </TouchableOpacity>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <CloudOff size={20} color="#f59e0b" />
            <Text style={styles.title}>Cola de sincronizacion</Text>
          </View>
          <Text style={styles.count}>{queueItems.length} pendientes</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.buttonDisabled]}
            onPress={handleSync}
            disabled={syncing || !status.isOnline}
          >
            <RefreshCw size={18} color="#fff" />
            <Text style={styles.syncButtonText}>
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => setShowModal(true)}
          >
            <Text style={styles.detailsButtonText}>Ver detalles</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Queue Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cola de sincronizacion</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalSyncButton, syncing && styles.buttonDisabled]}
              onPress={handleSync}
              disabled={syncing || !status.isOnline}
            >
              <RefreshCw size={18} color="#fff" />
              <Text style={styles.modalSyncButtonText}>Sincronizar todo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearQueue}
            >
              <Trash2 size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={queueItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <QueueItem item={item} onDelete={() => handleDeleteItem(item)} />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

interface QueueItemProps {
  item: SyncQueue;
  onDelete: () => void;
}

function QueueItem({ item, onDelete }: QueueItemProps) {
  const getOperationLabel = (op: string) => {
    const labels: Record<string, string> = {
      create: 'Crear',
      update: 'Actualizar',
      delete: 'Eliminar',
    };
    return labels[op] || op;
  };

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, string> = {
      job: 'Trabajo',
      customer: 'Cliente',
      job_photo: 'Foto',
    };
    return labels[entity] || entity;
  };

  const getStatusIcon = () => {
    if (item.retryCount > 0) {
      return <AlertCircle size={16} color="#f59e0b" />;
    }
    return <Clock size={16} color="#6b7280" />;
  };

  return (
    <View style={styles.queueItem}>
      <View style={styles.queueItemIcon}>{getStatusIcon()}</View>

      <View style={styles.queueItemContent}>
        <Text style={styles.queueItemTitle}>
          {getOperationLabel(item.operation)} {getEntityLabel(item.entityType)}
        </Text>
        <Text style={styles.queueItemMeta}>
          {item.createdAt.toLocaleString('es-AR')}
          {item.retryCount > 0 && ` • ${item.retryCount} intentos fallidos`}
        </Text>
      </View>

      <TouchableOpacity style={styles.queueItemDelete} onPress={onDelete}>
        <Trash2 size={18} color="#dc2626" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
  },
  count: {
    fontSize: 14,
    color: '#b45309',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  detailsButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
  },
  compactText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#92400e',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalSyncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalSyncButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  listContent: {
    paddingBottom: 24,
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  queueItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  queueItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  queueItemMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  queueItemDelete: {
    padding: 8,
  },
});
