/**
 * Create Request Screen
 * =====================
 *
 * Multi-step service request creation flow.
 * Phase 15: Consumer Marketplace
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { consumerApi } from '../services/api-client';
import { useLocation } from '../hooks/useLocation';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestFormData {
  title: string;
  description: string;
  category: string;
  urgency: 'low' | 'normal' | 'high' | 'emergency';
  budgetRange?: string;
  preferredSchedule?: string;
  photos: string[];
  address: string;
  city: string;
  neighborhood?: string;
  lat: number;
  lng: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  { id: 'plumbing', name: 'Plomería', icon: '🔧' },
  { id: 'electrical', name: 'Electricidad', icon: '⚡' },
  { id: 'cleaning', name: 'Limpieza', icon: '🧹' },
  { id: 'painting', name: 'Pintura', icon: '🎨' },
  { id: 'hvac', name: 'Aire acondicionado', icon: '❄️' },
  { id: 'gardening', name: 'Jardinería', icon: '🌿' },
  { id: 'moving', name: 'Mudanzas', icon: '📦' },
  { id: 'carpentry', name: 'Carpintería', icon: '🪚' },
  { id: 'locksmith', name: 'Cerrajería', icon: '🔐' },
  { id: 'appliance_repair', name: 'Electrodomésticos', icon: '🔌' },
  { id: 'pest_control', name: 'Control de plagas', icon: '🐜' },
  { id: 'glass', name: 'Vidrios', icon: '🪟' },
];

const URGENCY_OPTIONS = [
  { id: 'low', label: 'Sin apuro', description: 'Próximos 30 días', icon: 'time-outline' },
  { id: 'normal', label: 'Normal', description: 'Esta semana', icon: 'calendar-outline' },
  { id: 'high', label: 'Urgente', description: 'Próximos 2-3 días', icon: 'alert-circle-outline' },
  { id: 'emergency', label: 'Emergencia', description: 'Hoy mismo', icon: 'flash-outline' },
];

const BUDGET_OPTIONS = [
  { id: 'under_10k', label: 'Hasta $10.000' },
  { id: '10k_30k', label: '$10.000 - $30.000' },
  { id: '30k_50k', label: '$30.000 - $50.000' },
  { id: '50k_100k', label: '$50.000 - $100.000' },
  { id: 'over_100k', label: 'Más de $100.000' },
  { id: 'flexible', label: 'Flexible / No sé' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CreateRequestScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { location, city, address: currentAddress } = useLocation();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<RequestFormData>({
    title: '',
    description: '',
    category: route.params?.category || '',
    urgency: 'normal',
    budgetRange: undefined,
    preferredSchedule: undefined,
    photos: [],
    address: currentAddress || '',
    city: city || 'Buenos Aires',
    neighborhood: undefined,
    lat: location?.latitude || -34.6037,
    lng: location?.longitude || -58.3816,
  });

  const scrollViewRef = useRef<ScrollView>(null);
  const totalSteps = 4;

  const updateForm = (updates: Partial<RequestFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < totalSteps) {
      setStep(step + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 1:
        if (!formData.category) {
          Alert.alert('Seleccioná una categoría');
          return false;
        }
        return true;
      case 2:
        if (!formData.title.trim()) {
          Alert.alert('Escribí un título para tu pedido');
          return false;
        }
        if (formData.title.length < 10) {
          Alert.alert('El título debe tener al menos 10 caracteres');
          return false;
        }
        if (!formData.description.trim()) {
          Alert.alert('Describí lo que necesitás');
          return false;
        }
        if (formData.description.length < 20) {
          Alert.alert('La descripción debe tener al menos 20 caracteres');
          return false;
        }
        return true;
      case 3:
        if (!formData.address.trim()) {
          Alert.alert('Ingresá tu dirección');
          return false;
        }
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const handlePickImage = async () => {
    if (formData.photos.length >= 5) {
      Alert.alert('Máximo 5 fotos permitidas');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - formData.photos.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map(asset => asset.uri);
      updateForm({ photos: [...formData.photos, ...newPhotos] });
    }
  };

  const handleTakePhoto = async () => {
    if (formData.photos.length >= 5) {
      Alert.alert('Máximo 5 fotos permitidas');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Se requiere acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      updateForm({ photos: [...formData.photos, result.assets[0].uri] });
    }
  };

  const handleRemovePhoto = (index: number) => {
    updateForm({
      photos: formData.photos.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      // TODO: Upload photos first
      const response = await consumerApi.requests.create({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        urgency: formData.urgency,
        budgetRange: formData.budgetRange,
        preferredSchedule: formData.preferredSchedule,
        photos: [], // TODO: Upload and get URLs
        address: formData.address,
        city: formData.city,
        neighborhood: formData.neighborhood,
        lat: formData.lat,
        lng: formData.lng,
      });

      if (response.success && response.data) {
        navigation.replace('RequestSuccess', {
          requestId: response.data.id,
          requestNumber: response.data.requestNumber,
        });
      } else {
        Alert.alert(
          'Error',
          response.error?.message || 'No se pudo crear el pedido'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>Nuevo pedido</Text>
          <Text style={styles.stepIndicator}>
            Paso {step} de {totalSteps}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(step / totalSteps) * 100}%` },
          ]}
        />
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <Step1Category
            selected={formData.category}
            onSelect={category => updateForm({ category })}
          />
        )}

        {step === 2 && (
          <Step2Details
            title={formData.title}
            description={formData.description}
            urgency={formData.urgency}
            photos={formData.photos}
            onTitleChange={title => updateForm({ title })}
            onDescriptionChange={description => updateForm({ description })}
            onUrgencyChange={urgency => updateForm({ urgency })}
            onPickImage={handlePickImage}
            onTakePhoto={handleTakePhoto}
            onRemovePhoto={handleRemovePhoto}
          />
        )}

        {step === 3 && (
          <Step3Location
            address={formData.address}
            city={formData.city}
            neighborhood={formData.neighborhood}
            onAddressChange={address => updateForm({ address })}
            onCityChange={city => updateForm({ city })}
            onNeighborhoodChange={neighborhood => updateForm({ neighborhood })}
            onSelectCurrentLocation={() => {
              if (location && currentAddress) {
                updateForm({
                  address: currentAddress,
                  lat: location.latitude,
                  lng: location.longitude,
                });
              }
            }}
          />
        )}

        {step === 4 && (
          <Step4Budget
            budgetRange={formData.budgetRange}
            preferredSchedule={formData.preferredSchedule}
            onBudgetChange={budgetRange => updateForm({ budgetRange })}
            onScheduleChange={preferredSchedule =>
              updateForm({ preferredSchedule })
            }
          />
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === totalSteps ? 'Publicar pedido' : 'Continuar'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Step1Category({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (category: string) => void;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>¿Qué servicio necesitás?</Text>
      <Text style={styles.stepDescription}>
        Seleccioná la categoría que mejor describe tu pedido
      </Text>

      <View style={styles.categoriesGrid}>
        {CATEGORIES.map(category => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryCard,
              selected === category.id && styles.categoryCardSelected,
            ]}
            onPress={() => onSelect(category.id)}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text
              style={[
                styles.categoryName,
                selected === category.id && styles.categoryNameSelected,
              ]}
            >
              {category.name}
            </Text>
            {selected === category.id && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#2563EB"
                style={styles.categoryCheck}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Step2Details({
  title,
  description,
  urgency,
  photos,
  onTitleChange,
  onDescriptionChange,
  onUrgencyChange,
  onPickImage,
  onTakePhoto,
  onRemovePhoto,
}: {
  title: string;
  description: string;
  urgency: string;
  photos: string[];
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onUrgencyChange: (urgency: any) => void;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onRemovePhoto: (index: number) => void;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>Contanos qué necesitás</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Título del pedido *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ej: Arreglar pérdida de agua en el baño"
          placeholderTextColor="#999"
          value={title}
          onChangeText={onTitleChange}
          maxLength={100}
        />
        <Text style={styles.charCount}>{title.length}/100</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Descripción *</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Describí el problema con más detalle: qué pasó, desde cuándo, qué intentaste..."
          placeholderTextColor="#999"
          value={description}
          onChangeText={onDescriptionChange}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={1000}
        />
        <Text style={styles.charCount}>{description.length}/1000</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>¿Qué tan urgente es?</Text>
        <View style={styles.urgencyOptions}>
          {URGENCY_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.urgencyOption,
                urgency === option.id && styles.urgencyOptionSelected,
              ]}
              onPress={() => onUrgencyChange(option.id)}
            >
              <Ionicons
                name={option.icon as any}
                size={24}
                color={urgency === option.id ? '#2563EB' : '#666'}
              />
              <Text
                style={[
                  styles.urgencyLabel,
                  urgency === option.id && styles.urgencyLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.urgencyDescription}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Fotos (opcional)</Text>
        <Text style={styles.inputHint}>
          Agregá fotos para que los profesionales entiendan mejor el problema
        </Text>
        <View style={styles.photosContainer}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoWrapper}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity
                style={styles.removePhoto}
                onPress={() => onRemovePhoto(index)}
              >
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 5 && (
            <View style={styles.addPhotoButtons}>
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={onTakePhoto}
              >
                <Ionicons name="camera-outline" size={24} color="#666" />
                <Text style={styles.addPhotoText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={onPickImage}
              >
                <Ionicons name="images-outline" size={24} color="#666" />
                <Text style={styles.addPhotoText}>Galería</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function Step3Location({
  address,
  city,
  neighborhood,
  onAddressChange,
  onCityChange,
  onNeighborhoodChange,
  onSelectCurrentLocation,
}: {
  address: string;
  city: string;
  neighborhood?: string;
  onAddressChange: (address: string) => void;
  onCityChange: (city: string) => void;
  onNeighborhoodChange: (neighborhood: string) => void;
  onSelectCurrentLocation: () => void;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>¿Dónde necesitás el servicio?</Text>

      <TouchableOpacity
        style={styles.currentLocationButton}
        onPress={onSelectCurrentLocation}
      >
        <Ionicons name="locate" size={20} color="#2563EB" />
        <Text style={styles.currentLocationText}>Usar mi ubicación actual</Text>
      </TouchableOpacity>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Dirección *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ej: Av. Corrientes 1234, Piso 3"
          placeholderTextColor="#999"
          value={address}
          onChangeText={onAddressChange}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Ciudad *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ej: Buenos Aires"
          placeholderTextColor="#999"
          value={city}
          onChangeText={onCityChange}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Barrio (opcional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ej: Palermo"
          placeholderTextColor="#999"
          value={neighborhood}
          onChangeText={onNeighborhoodChange}
        />
      </View>
    </View>
  );
}

function Step4Budget({
  budgetRange,
  preferredSchedule,
  onBudgetChange,
  onScheduleChange,
}: {
  budgetRange?: string;
  preferredSchedule?: string;
  onBudgetChange: (budget: string) => void;
  onScheduleChange: (schedule: string) => void;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>Último paso</Text>
      <Text style={styles.stepDescription}>
        Esta información es opcional pero ayuda a los profesionales a darte
        mejores cotizaciones
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Presupuesto estimado</Text>
        <View style={styles.budgetOptions}>
          {BUDGET_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.budgetOption,
                budgetRange === option.id && styles.budgetOptionSelected,
              ]}
              onPress={() => onBudgetChange(option.id)}
            >
              <Text
                style={[
                  styles.budgetLabel,
                  budgetRange === option.id && styles.budgetLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          ¿Cuándo preferís que se haga el trabajo?
        </Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Ej: Preferentemente por la mañana, cualquier día de la semana"
          placeholderTextColor="#999"
          value={preferredSchedule}
          onChangeText={onScheduleChange}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.summaryCard}>
        <Ionicons name="information-circle" size={20} color="#2563EB" />
        <Text style={styles.summaryText}>
          Tu pedido será visible para profesionales de la zona. Recibirás
          cotizaciones y podrás elegir la que más te convenga.
        </Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  stepIndicator: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#E5E7EB',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  categoryIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: '#2563EB',
  },
  categoryCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  urgencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  urgencyOption: {
    width: '47%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  urgencyOptionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  urgencyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  urgencyLabelSelected: {
    color: '#2563EB',
  },
  urgencyDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  currentLocationText: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '500',
  },
  budgetOptions: {
    gap: 10,
  },
  budgetOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  budgetOptionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  budgetLabel: {
    fontSize: 15,
    color: '#374151',
  },
  budgetLabelSelected: {
    color: '#2563EB',
    fontWeight: '500',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
