/**
 * Mode Switcher Component
 * =======================
 *
 * UI for switching between consumer and business modes.
 * Phase 15: Consumer Marketplace
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { consumerApi, apiRequest } from '../services/api-client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type AppMode = 'consumer' | 'business';

interface ProfileSummary {
  id: string;
  displayName: string | null;
  profilePhotoUrl?: string | null;
  logoUrl?: string | null;
  activeRequests?: number;
  pendingLeads?: number;
  subscriptionPlan?: string;
}

interface ModeStatus {
  hasConsumerProfile: boolean;
  hasBusinessProfile: boolean;
  canSwitch: boolean;
  currentMode: AppMode;
  consumer: ProfileSummary | null;
  business: ProfileSummary | null;
}

interface ModeSwitcherProps {
  onModeChange?: (mode: AppMode) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ModeSwitcher({ onModeChange }: ModeSwitcherProps): React.JSX.Element | null {
  const [status, setStatus] = useState<ModeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMode, setCurrentMode] = useState<AppMode>('consumer');
  const fadeAnim = useState(new Animated.Value(0))[0];

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD STATUS
  // ─────────────────────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    try {
      const response = await apiRequest<ModeStatus>('/mode/status');
      if (response.success && response.data) {
        setStatus(response.data);
        setCurrentMode(response.data.currentMode);
      }
    } catch (error) {
      console.error('Error loading mode status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SWITCH MODE
  // ─────────────────────────────────────────────────────────────────────────────

  const switchMode = async (targetMode: AppMode) => {
    if (switching || currentMode === targetMode) return;

    setSwitching(true);
    try {
      const response = await apiRequest<{ mode: AppMode; profile: ProfileSummary }>(
        '/mode/switch',
        {
          method: 'POST',
          body: { mode: targetMode },
        }
      );

      if (response.success) {
        setCurrentMode(targetMode);
        setModalVisible(false);
        onModeChange?.(targetMode);

        // If switching to business, redirect to business app
        if (targetMode === 'business') {
          // In production, this would deep link to the business app
          Linking.openURL('campotech-business://dashboard');
        }
      }
    } catch (error) {
      console.error('Error switching mode:', error);
    } finally {
      setSwitching(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // OPEN/CLOSE MODAL
  // ─────────────────────────────────────────────────────────────────────────────

  const openModal = () => {
    setModalVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // Don't render if loading or no dual profile
  if (loading) return null;
  if (!status?.canSwitch) return null;

  const currentProfile =
    currentMode === 'consumer' ? status.consumer : status.business;
  const otherMode = currentMode === 'consumer' ? 'business' : 'consumer';
  const otherProfile = otherMode === 'consumer' ? status.consumer : status.business;

  return (
    <>
      {/* Mode Badge Button */}
      <TouchableOpacity style={styles.modeButton} onPress={openModal}>
        <View style={styles.modeButtonContent}>
          {currentProfile?.profilePhotoUrl || currentProfile?.logoUrl ? (
            <Image
              source={{ uri: currentProfile.profilePhotoUrl || currentProfile.logoUrl! }}
              style={styles.modeButtonAvatar}
            />
          ) : (
            <View style={styles.modeButtonAvatarPlaceholder}>
              <Text style={styles.modeButtonAvatarText}>
                {currentProfile?.displayName?.[0] || 'C'}
              </Text>
            </View>
          )}
          <View style={styles.switchIcon}>
            <Text style={styles.switchIconText}>⇄</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Mode Switcher Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
            <TouchableOpacity activeOpacity={1}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Cambiar modo</Text>
                <TouchableOpacity onPress={closeModal}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Current Mode */}
              <View style={styles.currentModeSection}>
                <Text style={styles.sectionLabel}>Modo actual</Text>
                <View style={[styles.modeCard, styles.modeCardActive]}>
                  {currentProfile?.profilePhotoUrl || currentProfile?.logoUrl ? (
                    <Image
                      source={{
                        uri: currentProfile.profilePhotoUrl || currentProfile.logoUrl!,
                      }}
                      style={styles.modeAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.modeAvatarPlaceholder,
                        currentMode === 'consumer'
                          ? styles.consumerBg
                          : styles.businessBg,
                      ]}
                    >
                      <Text style={styles.modeAvatarText}>
                        {currentProfile?.displayName?.[0] || 'C'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modeInfo}>
                    <Text style={styles.modeName}>
                      {currentProfile?.displayName || 'Mi perfil'}
                    </Text>
                    <Text style={styles.modeType}>
                      {currentMode === 'consumer' ? 'Consumidor' : 'Negocio'}
                    </Text>
                  </View>
                  <View style={styles.activeIndicator}>
                    <Text style={styles.activeIndicatorText}>✓</Text>
                  </View>
                </View>
              </View>

              {/* Switch To */}
              <View style={styles.switchSection}>
                <Text style={styles.sectionLabel}>Cambiar a</Text>
                <TouchableOpacity
                  style={styles.modeCard}
                  onPress={() => switchMode(otherMode)}
                  disabled={switching}
                >
                  {otherProfile?.profilePhotoUrl || otherProfile?.logoUrl ? (
                    <Image
                      source={{
                        uri: otherProfile.profilePhotoUrl || otherProfile.logoUrl!,
                      }}
                      style={styles.modeAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.modeAvatarPlaceholder,
                        otherMode === 'consumer'
                          ? styles.consumerBg
                          : styles.businessBg,
                      ]}
                    >
                      <Text style={styles.modeAvatarText}>
                        {otherProfile?.displayName?.[0] || 'N'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modeInfo}>
                    <Text style={styles.modeName}>
                      {otherProfile?.displayName || 'Mi perfil'}
                    </Text>
                    <Text style={styles.modeType}>
                      {otherMode === 'consumer' ? 'Consumidor' : 'Negocio'}
                    </Text>
                    {otherMode === 'business' && otherProfile?.pendingLeads ? (
                      <View style={styles.badgeRow}>
                        <View style={styles.notificationBadge}>
                          <Text style={styles.notificationBadgeText}>
                            {otherProfile.pendingLeads} leads pendientes
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    {otherMode === 'consumer' && otherProfile?.activeRequests ? (
                      <View style={styles.badgeRow}>
                        <View style={styles.notificationBadge}>
                          <Text style={styles.notificationBadgeText}>
                            {otherProfile.activeRequests} solicitudes activas
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  {switching ? (
                    <ActivityIndicator size="small" color="#2E7D32" />
                  ) : (
                    <Text style={styles.switchArrow}>›</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View style={styles.infoSection}>
                <Text style={styles.infoText}>
                  Al cambiar de modo, accederás a una experiencia diferente de la
                  aplicación.
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // Mode Button
  modeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 100,
  },
  modeButtonContent: {
    position: 'relative',
  },
  modeButtonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  modeButtonAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  modeButtonAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  switchIcon: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FFF',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchIconText: {
    fontSize: 10,
    color: '#2E7D32',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  closeButton: {
    fontSize: 20,
    color: '#757575',
    padding: 4,
  },

  // Sections
  currentModeSection: {
    marginTop: 20,
  },
  switchSection: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Mode Card
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 12,
  },
  modeCardActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  modeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  modeAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  consumerBg: {
    backgroundColor: '#2E7D32',
  },
  businessBg: {
    backgroundColor: '#1976D2',
  },
  modeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  modeType: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 6,
  },
  notificationBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  notificationBadgeText: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '500',
  },
  activeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIndicatorText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  switchArrow: {
    fontSize: 24,
    color: '#BDBDBD',
  },

  // Info
  infoSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
    textAlign: 'center',
  },
});
