/**
 * Status Button Component
 * =======================
 *
 * Large action button for status transitions.
 */

import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface StatusButtonProps {
  status: string;
  onStatusChange: (newStatus: string) => void;
  isLoading: boolean;
}

export default function StatusButton({
  status,
  onStatusChange,
  isLoading,
}: StatusButtonProps) {
  const config = getStatusConfig(status);

  if (!config.nextAction) {
    return (
      <View style={styles.completedContainer}>
        <Feather name={config.icon as any} size={32} color={config.color} />
        <Text style={[styles.statusLabel, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Current status */}
      <View style={styles.currentStatus}>
        <View style={[styles.statusDot, { backgroundColor: config.color }]} />
        <Text style={styles.statusText}>{config.label}</Text>
      </View>

      {/* Action button */}
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: config.actionColor }]}
        onPress={() => onStatusChange(config.nextAction!)}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name={config.actionIcon as any} size={24} color="#fff" />
            <Text style={styles.actionText}>{config.actionLabel}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Quick actions */}
      {config.showCancel && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => onStatusChange('cancelled')}
          disabled={isLoading}
        >
          <Text style={styles.cancelText}>Cancelar trabajo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
    case 'scheduled':
      return {
        label: 'Programado',
        color: '#3b82f6',
        icon: 'clock',
        nextAction: 'en_camino',
        actionLabel: 'Salir hacia el trabajo',
        actionIcon: 'navigation',
        actionColor: '#16a34a',
        showCancel: true,
      };
    case 'en_camino':
      return {
        label: 'En camino',
        color: '#f59e0b',
        icon: 'truck',
        nextAction: 'working',
        actionLabel: 'Llegué al lugar',
        actionIcon: 'map-pin',
        actionColor: '#3b82f6',
        showCancel: true,
      };
    case 'working':
      return {
        label: 'Trabajando',
        color: '#8b5cf6',
        icon: 'tool',
        nextAction: 'completed',
        actionLabel: 'Completar trabajo',
        actionIcon: 'check-circle',
        actionColor: '#16a34a',
        showCancel: true,
      };
    case 'completed':
      return {
        label: 'Completado',
        color: '#16a34a',
        icon: 'check-circle',
        nextAction: null,
        actionLabel: null,
        actionIcon: null,
        actionColor: null,
        showCancel: false,
      };
    case 'cancelled':
      return {
        label: 'Cancelado',
        color: '#ef4444',
        icon: 'x-circle',
        nextAction: null,
        actionLabel: null,
        actionIcon: null,
        actionColor: null,
        showCancel: false,
      };
    default:
      return {
        label: status,
        color: '#6b7280',
        icon: 'help-circle',
        nextAction: null,
        actionLabel: null,
        actionIcon: null,
        actionColor: null,
        showCancel: false,
      };
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  actionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 16,
  },
  actionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  completedContainer: {
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
});
