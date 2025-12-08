/**
 * Conflict Resolver Component
 * ===========================
 *
 * UI for resolving sync conflicts between local and server data
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Check,
  X,
  Cloud,
  Smartphone,
  GitMerge,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { SyncConflict } from '../../watermelon/models';
import { resolveConflict, getUnresolvedConflicts } from '../../lib/sync/sync-engine';

interface ConflictResolverProps {
  visible: boolean;
  onClose: () => void;
  conflicts: SyncConflict[];
  onResolved: () => void;
}

export function ConflictResolver({
  visible,
  onClose,
  conflicts,
  onResolved,
}: ConflictResolverProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolving, setResolving] = useState(false);

  const currentConflict = conflicts[currentIndex];

  const handleResolve = async (resolution: 'local' | 'server') => {
    if (!currentConflict) return;

    setResolving(true);
    try {
      await resolveConflict(currentConflict.id, resolution);

      if (currentIndex < conflicts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onResolved();
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo resolver el conflicto');
    } finally {
      setResolving(false);
    }
  };

  if (!currentConflict) {
    return null;
  }

  const localData = currentConflict.parsedLocalData || {};
  const serverData = currentConflict.parsedServerData || {};

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AlertTriangle size={24} color="#f59e0b" />
            <Text style={styles.headerTitle}>Resolver conflicto</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={styles.progress}>
          <Text style={styles.progressText}>
            Conflicto {currentIndex + 1} de {conflicts.length}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentIndex + 1) / conflicts.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Conflict Info */}
        <View style={styles.conflictInfo}>
          <Text style={styles.conflictType}>
            {getEntityTypeLabel(currentConflict.entityType)}
          </Text>
          <Text style={styles.conflictDesc}>
            Este registro fue modificado tanto en tu dispositivo como en el servidor.
            Elegi cual version mantener.
          </Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Local Version */}
          <ConflictVersion
            title="Tu version (local)"
            icon={<Smartphone size={20} color="#3b82f6" />}
            data={localData}
            color="#3b82f6"
            onSelect={() => handleResolve('local')}
            disabled={resolving}
          />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>VS</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Server Version */}
          <ConflictVersion
            title="Version del servidor"
            icon={<Cloud size={20} color="#059669" />}
            data={serverData}
            color="#059669"
            onSelect={() => handleResolve('server')}
            disabled={resolving}
          />
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.localButton]}
            onPress={() => handleResolve('local')}
            disabled={resolving}
          >
            <Smartphone size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Usar mi version</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.serverButton]}
            onPress={() => handleResolve('server')}
            disabled={resolving}
          >
            <Cloud size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Usar del servidor</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface ConflictVersionProps {
  title: string;
  icon: React.ReactNode;
  data: Record<string, unknown>;
  color: string;
  onSelect: () => void;
  disabled: boolean;
}

function ConflictVersion({
  title,
  icon,
  data,
  color,
  onSelect,
  disabled,
}: ConflictVersionProps) {
  const [expanded, setExpanded] = useState(false);

  // Get displayable fields
  const displayFields = getDisplayFields(data);
  const previewFields = displayFields.slice(0, 3);
  const hasMore = displayFields.length > 3;

  return (
    <View style={[styles.versionCard, { borderColor: color }]}>
      <View style={styles.versionHeader}>
        {icon}
        <Text style={[styles.versionTitle, { color }]}>{title}</Text>
      </View>

      <View style={styles.versionFields}>
        {(expanded ? displayFields : previewFields).map((field) => (
          <View key={field.key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <Text style={styles.fieldValue} numberOfLines={expanded ? undefined : 1}>
              {field.value}
            </Text>
          </View>
        ))}
      </View>

      {hasMore && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp size={16} color="#6b7280" />
              <Text style={styles.expandText}>Ver menos</Text>
            </>
          ) : (
            <>
              <ChevronDown size={16} color="#6b7280" />
              <Text style={styles.expandText}>
                Ver {displayFields.length - 3} campos mas
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// Helper functions

function getEntityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    job: 'Trabajo',
    customer: 'Cliente',
    price_book_item: 'Item de precio',
  };
  return labels[type] || type;
}

function getDisplayFields(data: Record<string, unknown>): Array<{
  key: string;
  label: string;
  value: string;
}> {
  const fieldLabels: Record<string, string> = {
    status: 'Estado',
    notes: 'Notas',
    completionNotes: 'Notas de finalizacion',
    address: 'Direccion',
    scheduledStart: 'Inicio programado',
    scheduledEnd: 'Fin programado',
    actualStart: 'Inicio real',
    actualEnd: 'Fin real',
    subtotal: 'Subtotal',
    tax: 'IVA',
    total: 'Total',
    name: 'Nombre',
    phone: 'Telefono',
    email: 'Email',
  };

  const hiddenFields = ['id', 'serverId', '_raw', 'syncedAt', 'isDirty', 'createdAt', 'updatedAt'];

  return Object.entries(data)
    .filter(([key]) => !hiddenFields.includes(key))
    .map(([key, value]) => ({
      key,
      label: fieldLabels[key] || key,
      value: formatValue(value),
    }));
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (typeof value === 'number') {
    // Check if it looks like a timestamp
    if (value > 1000000000000) {
      return new Date(value).toLocaleString('es-AR');
    }
    // Format as currency if it looks like money
    if (value > 100) {
      return `$${value.toLocaleString('es-AR')}`;
    }
    return value.toString();
  }
  if (typeof value === 'string') {
    // Check if it's a date string
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value).toLocaleString('es-AR');
    }
    return value;
  }
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Hook for conflict resolution
 */
export function useConflictResolver() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [visible, setVisible] = useState(false);

  const checkConflicts = async () => {
    const unresolvedConflicts = await getUnresolvedConflicts();
    if (unresolvedConflicts.length > 0) {
      setConflicts(unresolvedConflicts);
      setVisible(true);
    }
  };

  const close = () => {
    setVisible(false);
    setConflicts([]);
  };

  const handleResolved = () => {
    checkConflicts(); // Check if there are more
  };

  return {
    conflicts,
    visible,
    checkConflicts,
    close,
    handleResolved,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  progress: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 2,
  },
  conflictInfo: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  conflictType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conflictDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  versionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  versionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  versionFields: {
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fieldLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  fieldValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  expandText: {
    fontSize: 13,
    color: '#6b7280',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  localButton: {
    backgroundColor: '#3b82f6',
  },
  serverButton: {
    backgroundColor: '#059669',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
