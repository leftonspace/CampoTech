/**
 * Profile Screen
 * ==============
 *
 * Consumer profile management screen.
 * Phase 15: Consumer Marketplace
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { consumerApi } from '../services/api-client';
import { useAuth } from '../store/auth-context';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Address {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

interface ProfileData {
  id: string;
  phone: string;
  displayName?: string;
  email?: string;
  profilePhotoUrl?: string;
  defaultCity?: string;
  defaultNeighborhood?: string;
  savedAddresses: Address[];
  notificationPreferences: Record<string, boolean>;
  stats: {
    totalRequests: number;
    completedJobs: number;
    reviewsGiven: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [defaultCity, setDefaultCity] = useState('');

  // Notification preferences
  const [newQuoteNotif, setNewQuoteNotif] = useState(true);
  const [messageNotif, setMessageNotif] = useState(true);
  const [jobUpdateNotif, setJobUpdateNotif] = useState(true);
  const [promotionNotif, setPromotionNotif] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD PROFILE
  // ─────────────────────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    try {
      const response = await consumerApi.profile.get();
      if (response.success && response.data) {
        setProfile(response.data);
        setDisplayName(response.data.displayName || '');
        setEmail(response.data.email || '');
        setDefaultCity(response.data.defaultCity || '');

        // Set notification preferences
        const prefs = response.data.notificationPreferences;
        setNewQuoteNotif(prefs?.new_quote !== false);
        setMessageNotif(prefs?.message !== false);
        setJobUpdateNotif(prefs?.job_update !== false);
        setPromotionNotif(prefs?.promotion === true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile();
  }, [loadProfile]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SAVE PROFILE
  // ─────────────────────────────────────────────────────────────────────────────

  const saveProfile = async () => {
    setSaving(true);
    try {
      const response = await consumerApi.profile.update({
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        defaultCity: defaultCity.trim() || undefined,
      });

      if (response.success) {
        // Save notification preferences
        await consumerApi.profile.updateNotifications({
          new_quote: newQuoteNotif,
          message: messageNotif,
          job_update: jobUpdateNotif,
          promotion: promotionNotif,
        });

        setEditing(false);
        loadProfile();
        Alert.alert('Éxito', 'Perfil actualizado');
      } else {
        Alert.alert('Error', response.error?.message || 'No se pudo guardar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PHOTO UPLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // In production, upload to S3/CloudStorage first
      const photoUrl = result.assets[0].uri;
      const response = await consumerApi.profile.updatePhoto(photoUrl);

      if (response.success) {
        loadProfile();
      } else {
        Alert.alert('Error', 'No se pudo actualizar la foto');
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ADDRESS MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  const removeAddress = async (addressId: string) => {
    Alert.alert(
      'Eliminar dirección',
      '¿Estás seguro de eliminar esta dirección?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const response = await consumerApi.profile.removeAddress(addressId);
            if (response.success) {
              loadProfile();
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => {
            consumerApi.auth.logout();
            logout();
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header with Photo */}
      <View style={styles.header}>
        <TouchableOpacity onPress={pickImage} style={styles.photoContainer}>
          {profile?.profilePhotoUrl ? (
            <Image source={{ uri: profile.profilePhotoUrl }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoInitial}>
                {profile?.displayName?.[0]?.toUpperCase() || 'C'}
              </Text>
            </View>
          )}
          <View style={styles.editPhotoIcon}>
            <Text style={styles.editPhotoText}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.name}>{profile?.displayName || 'Consumidor'}</Text>
        <Text style={styles.phone}>{profile?.phone}</Text>

        {!editing && (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.stats.totalRequests || 0}</Text>
          <Text style={styles.statLabel}>Solicitudes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.stats.completedJobs || 0}</Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile?.stats.reviewsGiven || 0}</Text>
          <Text style={styles.statLabel}>Reseñas</Text>
        </View>
      </View>

      {/* Edit Form or View Mode */}
      {editing ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información personal</Text>

          <Text style={styles.inputLabel}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Tu nombre"
          />

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Ciudad predeterminada</Text>
          <TextInput
            style={styles.input}
            value={defaultCity}
            onChangeText={setDefaultCity}
            placeholder="Buenos Aires"
          />

          {/* Notification Preferences */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Notificaciones</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Nuevas cotizaciones</Text>
            <Switch
              value={newQuoteNotif}
              onValueChange={setNewQuoteNotif}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={newQuoteNotif ? '#2E7D32' : '#9E9E9E'}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Mensajes</Text>
            <Switch
              value={messageNotif}
              onValueChange={setMessageNotif}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={messageNotif ? '#2E7D32' : '#9E9E9E'}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Actualizaciones de trabajo</Text>
            <Switch
              value={jobUpdateNotif}
              onValueChange={setJobUpdateNotif}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={jobUpdateNotif ? '#2E7D32' : '#9E9E9E'}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Promociones y ofertas</Text>
            <Switch
              value={promotionNotif}
              onValueChange={setPromotionNotif}
              trackColor={{ false: '#E0E0E0', true: '#81C784' }}
              thumbColor={promotionNotif ? '#2E7D32' : '#9E9E9E'}
            />
          </View>

          {/* Save/Cancel Buttons */}
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* Saved Addresses */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Direcciones guardadas</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AddAddress')}>
                <Text style={styles.addButton}>+ Agregar</Text>
              </TouchableOpacity>
            </View>

            {profile?.savedAddresses.length === 0 ? (
              <Text style={styles.emptyText}>No tienes direcciones guardadas</Text>
            ) : (
              profile?.savedAddresses.map((address) => (
                <View key={address.id} style={styles.addressItem}>
                  <View style={styles.addressInfo}>
                    <View style={styles.addressLabelRow}>
                      <Text style={styles.addressLabel}>{address.label}</Text>
                      {address.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Principal</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressText}>{address.address}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeAddress(address.id)}>
                    <Text style={styles.removeAddressText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Menu Items */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('MyRequests')}
            >
              <Text style={styles.menuIcon}>📋</Text>
              <Text style={styles.menuText}>Mis solicitudes</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('MyReviews')}
            >
              <Text style={styles.menuIcon}>⭐</Text>
              <Text style={styles.menuText}>Mis reseñas</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Favorites')}
            >
              <Text style={styles.menuIcon}>❤️</Text>
              <Text style={styles.menuText}>Favoritos</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Help')}
            >
              <Text style={styles.menuIcon}>❓</Text>
              <Text style={styles.menuText}>Ayuda y soporte</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Terms')}
            >
              <Text style={styles.menuIcon}>📄</Text>
              <Text style={styles.menuText}>Términos y condiciones</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>

          <Text style={styles.version}>Versión 1.0.0</Text>
        </>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    backgroundColor: '#FFF',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
  },
  editPhotoIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  editPhotoText: {
    fontSize: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#212121',
  },
  phone: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  editButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
  },
  editButtonText: {
    color: '#2E7D32',
    fontWeight: '600',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginTop: 1,
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },

  // Section
  section: {
    backgroundColor: '#FFF',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  addButton: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  emptyText: {
    color: '#9E9E9E',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Form
  inputLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  switchLabel: {
    fontSize: 15,
    color: '#424242',
  },

  // Edit Actions
  editActions: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#757575',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },

  // Address
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  addressInfo: {
    flex: 1,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  defaultBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
  },
  addressText: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
  removeAddressText: {
    color: '#EF5350',
    fontSize: 18,
    paddingLeft: 12,
  },

  // Menu
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: '#424242',
  },
  menuArrow: {
    fontSize: 20,
    color: '#BDBDBD',
  },

  // Logout
  logoutButton: {
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF5350',
    alignItems: 'center',
  },
  logoutText: {
    color: '#EF5350',
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#BDBDBD',
    fontSize: 12,
    marginTop: 16,
    marginBottom: 32,
  },
});
