/**
 * Quote Request Form
 * ==================
 *
 * Form to request a quote from a service provider.
 * Features:
 * - Service type selection
 * - Problem description
 * - Photo upload (optional)
 * - Preferred date/time
 * - Address with auto-fill from location
 * - Urgency level
 * - Contact information
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Camera,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  Check,
  ChevronDown,
  X,
  Image as ImageIcon,
  Phone,
  User,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import {
  CATEGORY_INFO,
  type ServiceCategory,
  type QuoteRequest,
} from '@/lib/types/business-profile';

// Service options based on category
const SERVICE_OPTIONS: Record<ServiceCategory, string[]> = {
  plomeria: [
    'Reparación de cañerías',
    'Destapaciones',
    'Instalación sanitaria',
    'Grifería',
    'Termo tanques',
    'Bombas de agua',
    'Otro',
  ],
  electricidad: [
    'Instalación eléctrica',
    'Reparación de cortocircuitos',
    'Tableros eléctricos',
    'Iluminación',
    'Tomas y enchufes',
    'Puesta a tierra',
    'Otro',
  ],
  gas: [
    'Instalación de gas',
    'Reparación de pérdidas',
    'Calefones',
    'Estufas',
    'Hornos',
    'Certificación matriculado',
    'Otro',
  ],
  aires: [
    'Instalación split',
    'Carga de gas',
    'Limpieza y mantenimiento',
    'Reparación',
    'Central de aire',
    'Ventilación',
    'Otro',
  ],
  cerrajeria: [
    'Apertura de puertas',
    'Cambio de cerraduras',
    'Copia de llaves',
    'Cerraduras de seguridad',
    'Portones automáticos',
    'Otro',
  ],
  limpieza: [
    'Limpieza hogareña',
    'Limpieza de oficinas',
    'Limpieza post obra',
    'Limpieza de vidrios',
    'Limpieza profunda',
    'Otro',
  ],
  pintura: [
    'Pintura interior',
    'Pintura exterior',
    'Empapelado',
    'Texturado',
    'Impermeabilización',
    'Otro',
  ],
  albanileria: [
    'Construcción',
    'Refacciones',
    'Revoques',
    'Pisos y revestimientos',
    'Mampostería',
    'Otro',
  ],
};

const TIME_SLOTS = [
  { value: 'morning', label: 'Mañana (8:00 - 12:00)' },
  { value: 'afternoon', label: 'Tarde (12:00 - 18:00)' },
  { value: 'evening', label: 'Noche (18:00 - 21:00)' },
  { value: 'flexible', label: 'Flexible' },
] as const;

const URGENCY_OPTIONS = [
  { value: 'normal', label: 'Normal', description: 'Puede esperar unos días', color: '#059669' },
  { value: 'urgent', label: 'Urgente', description: 'Necesito atención hoy', color: '#f59e0b' },
  { value: 'emergency', label: 'Emergencia', description: 'Necesito atención ahora', color: '#ef4444' },
] as const;

export default function QuoteRequestScreen() {
  const { providerId, category } = useLocalSearchParams<{
    providerId: string;
    category?: string;
  }>();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);

  // Form state
  const [serviceType, setServiceType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [preferredDate, setPreferredDate] = useState<string>('');
  const [timeSlot, setTimeSlot] = useState<typeof TIME_SLOTS[number]['value']>('flexible');
  const [address, setAddress] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'emergency'>('normal');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Get provider info
  const { data: provider } = useQuery({
    queryKey: ['provider-basic', providerId],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        id: providerId,
        displayName: 'Plomería Méndez',
        categories: [category || 'plomeria'] as ServiceCategory[],
      };
    },
  });

  const currentCategory = (category as ServiceCategory) || provider?.categories[0] || 'plomeria';
  const serviceOptions = SERVICE_OPTIONS[currentCategory] || [];

  // Auto-detect location on mount
  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const [result] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (result) {
          const addressParts = [
            result.street,
            result.streetNumber,
            result.district,
            result.city,
          ].filter(Boolean);
          setAddress(addressParts.join(', '));
        }
      }
    } catch (error) {
      console.log('Error detecting location:', error);
    }
    setIsLoadingLocation(false);
  };

  const handleAddPhoto = () => {
    // In real app, use expo-image-picker
    Alert.alert('Agregar foto', 'Función de cámara próximamente disponible');
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (!serviceType) {
      Alert.alert('Error', 'Por favor seleccioná el tipo de servicio');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Por favor describí el problema');
      return false;
    }
    if (description.trim().length < 20) {
      Alert.alert('Error', 'Por favor brindá más detalles sobre el problema (mínimo 20 caracteres)');
      return false;
    }
    if (!address.trim()) {
      Alert.alert('Error', 'Por favor ingresá la dirección');
      return false;
    }
    if (!contactPhone.trim()) {
      Alert.alert('Error', 'Por favor ingresá tu número de teléfono');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    const quoteRequest: QuoteRequest = {
      providerId: providerId || '',
      serviceCategory: currentCategory,
      serviceType,
      description: description.trim(),
      photos,
      preferredDate: preferredDate || undefined,
      preferredTimeSlot: timeSlot,
      address: address.trim(),
      urgency,
      contactPhone: contactPhone.trim(),
      contactName: contactName.trim() || undefined,
    };

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log('Quote request submitted:', quoteRequest);

      Alert.alert(
        'Solicitud enviada',
        `Tu solicitud de presupuesto fue enviada a ${provider?.displayName}. Te contactarán pronto.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar la solicitud. Por favor intentá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Provider Info */}
        <View style={styles.providerCard}>
          <View style={styles.providerAvatar}>
            <Text style={styles.providerAvatarText}>PM</Text>
          </View>
          <View>
            <Text style={styles.providerName}>{provider?.displayName}</Text>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryEmoji}>
                {CATEGORY_INFO[currentCategory]?.icon}
              </Text>
              <Text style={styles.categoryText}>
                {CATEGORY_INFO[currentCategory]?.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Service Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Tipo de servicio *</Text>
          <Pressable
            style={styles.selectButton}
            onPress={() => setShowServicePicker(true)}
          >
            <Text
              style={[styles.selectButtonText, !serviceType && styles.selectButtonPlaceholder]}
            >
              {serviceType || 'Seleccionar servicio'}
            </Text>
            <ChevronDown size={20} color="#6b7280" />
          </Pressable>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Descripción del problema *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describí el problema con el mayor detalle posible..."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.label}>Fotos (opcional)</Text>
          <Text style={styles.helperText}>
            Agregá fotos para ayudar al profesional a entender el problema
          </Text>
          <View style={styles.photosContainer}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoItem}>
                <View style={styles.photoPlaceholder}>
                  <ImageIcon size={24} color="#9ca3af" />
                </View>
                <Pressable
                  style={styles.photoRemove}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <X size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < 4 && (
              <Pressable style={styles.addPhotoButton} onPress={handleAddPhoto}>
                <Camera size={24} color="#6b7280" />
                <Text style={styles.addPhotoText}>Agregar</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Preferred Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Fecha preferida (opcional)</Text>
          <View style={styles.row}>
            <Pressable style={[styles.selectButton, styles.flex1]}>
              <Calendar size={18} color="#6b7280" />
              <Text
                style={[
                  styles.selectButtonText,
                  !preferredDate && styles.selectButtonPlaceholder,
                ]}
              >
                {preferredDate || 'Seleccionar fecha'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Time Slot */}
        <View style={styles.section}>
          <Text style={styles.label}>Horario preferido</Text>
          <View style={styles.timeSlots}>
            {TIME_SLOTS.map((slot) => (
              <Pressable
                key={slot.value}
                style={[
                  styles.timeSlotButton,
                  timeSlot === slot.value && styles.timeSlotButtonActive,
                ]}
                onPress={() => setTimeSlot(slot.value)}
              >
                <Clock
                  size={16}
                  color={timeSlot === slot.value ? '#059669' : '#6b7280'}
                />
                <Text
                  style={[
                    styles.timeSlotText,
                    timeSlot === slot.value && styles.timeSlotTextActive,
                  ]}
                >
                  {slot.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.label}>Dirección *</Text>
          <View style={styles.addressContainer}>
            <TextInput
              style={styles.addressInput}
              placeholder="Ingresá tu dirección"
              placeholderTextColor="#9ca3af"
              value={address}
              onChangeText={setAddress}
            />
            <Pressable
              style={styles.detectLocationButton}
              onPress={detectLocation}
              disabled={isLoadingLocation}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <MapPin size={20} color="#059669" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Urgency */}
        <View style={styles.section}>
          <Text style={styles.label}>Urgencia</Text>
          <View style={styles.urgencyOptions}>
            {URGENCY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.urgencyOption,
                  urgency === option.value && styles.urgencyOptionActive,
                  urgency === option.value && { borderColor: option.color },
                ]}
                onPress={() => setUrgency(option.value)}
              >
                <View style={styles.urgencyHeader}>
                  <AlertTriangle
                    size={16}
                    color={urgency === option.value ? option.color : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.urgencyLabel,
                      urgency === option.value && { color: option.color },
                    ]}
                  >
                    {option.label}
                  </Text>
                </View>
                <Text style={styles.urgencyDescription}>{option.description}</Text>
                {urgency === option.value && (
                  <View style={[styles.urgencyCheck, { backgroundColor: option.color }]}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos de contacto</Text>

          <Text style={styles.label}>Nombre (opcional)</Text>
          <View style={styles.inputContainer}>
            <User size={18} color="#6b7280" />
            <TextInput
              style={styles.input}
              placeholder="Tu nombre"
              placeholderTextColor="#9ca3af"
              value={contactName}
              onChangeText={setContactName}
            />
          </View>

          <Text style={styles.label}>Teléfono *</Text>
          <View style={styles.inputContainer}>
            <Phone size={18} color="#6b7280" />
            <TextInput
              style={styles.input}
              placeholder="+54 11 1234-5678"
              placeholderTextColor="#9ca3af"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Enviar solicitud</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Service Picker Modal */}
      {showServicePicker && (
        <View style={styles.pickerOverlay}>
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setShowServicePicker(false)}
          />
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Seleccionar servicio</Text>
              <Pressable onPress={() => setShowServicePicker(false)}>
                <X size={24} color="#374151" />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerOptions}>
              {serviceOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.pickerOption,
                    serviceType === option && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    setServiceType(option);
                    setShowServicePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      serviceType === option && styles.pickerOptionTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                  {serviceType === option && <Check size={18} color="#059669" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 13,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  selectButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  selectButtonPlaceholder: {
    color: '#9ca3af',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 12,
    color: '#6b7280',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  timeSlots: {
    gap: 8,
  },
  timeSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  timeSlotButtonActive: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  timeSlotText: {
    fontSize: 14,
    color: '#374151',
  },
  timeSlotTextActive: {
    color: '#059669',
    fontWeight: '500',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
  },
  addressInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: '#111827',
  },
  detectLocationButton: {
    padding: 14,
  },
  urgencyOptions: {
    gap: 10,
  },
  urgencyOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    position: 'relative',
  },
  urgencyOptionActive: {
    borderWidth: 2,
    backgroundColor: '#fafafa',
  },
  urgencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  urgencyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  urgencyDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 24,
  },
  urgencyCheck: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  pickerOptions: {
    paddingBottom: 32,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerOptionActive: {
    backgroundColor: '#f0fdf4',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#374151',
  },
  pickerOptionTextActive: {
    color: '#059669',
    fontWeight: '500',
  },
});
