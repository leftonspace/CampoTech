/**
 * New Service Request Screen
 * ==========================
 *
 * Phase 15: Consumer Marketplace
 * Multi-step form to create a service request:
 * 1. Select category & service type
 * 2. Describe problem (text, photos, voice)
 * 3. Enter address
 * 4. Select urgency & preferred time
 * 5. Review & submit
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  ChevronRight,
  Camera,
  Mic,
  MapPin,
  Clock,
  AlertTriangle,
  Calendar,
  X,
  Check,
} from 'lucide-react-native';

import { CategoryGrid } from '../../../components/consumer/CategoryGrid';
import { useCreateRequest } from '../../../lib/consumer/hooks/use-requests';
import { useConsumerLocation } from '../../../lib/consumer/hooks/use-location';
import { CATEGORIES, getCategoryInfo } from '../../../lib/consumer/constants';

type Step = 'category' | 'description' | 'location' | 'schedule' | 'review';

interface FormData {
  category: string;
  serviceType: string;
  title: string;
  description: string;
  photos: string[];
  voiceNoteUrl?: string;
  address: string;
  addressExtra?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  city: string;
  urgency: 'emergency' | 'today' | 'this_week' | 'flexible';
  preferredDate?: string;
  preferredTimeSlot?: string;
  budgetRange?: string;
}

const URGENCY_OPTIONS = [
  {
    key: 'emergency',
    label: 'Urgente',
    description: 'Lo necesito ahora',
    icon: AlertTriangle,
    color: '#ef4444',
  },
  {
    key: 'today',
    label: 'Hoy',
    description: 'Durante el dia de hoy',
    icon: Clock,
    color: '#f59e0b',
  },
  {
    key: 'this_week',
    label: 'Esta semana',
    description: 'En los proximos dias',
    icon: Calendar,
    color: '#0284c7',
  },
  {
    key: 'flexible',
    label: 'Flexible',
    description: 'Sin apuro',
    icon: Calendar,
    color: '#16a34a',
  },
];

export default function NewRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; businessId?: string }>();
  const { location, neighborhood, city } = useConsumerLocation();
  const { createRequest, isLoading: isSubmitting } = useCreateRequest();

  const [step, setStep] = useState<Step>(params.category ? 'description' : 'category');
  const [formData, setFormData] = useState<FormData>({
    category: params.category || '',
    serviceType: '',
    title: '',
    description: '',
    photos: [],
    address: '',
    city: city || 'Buenos Aires',
    neighborhood: neighborhood,
    urgency: 'flexible',
  });

  const updateForm = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleCategorySelect = (categoryId: string) => {
    updateForm({ category: categoryId });
    setStep('description');
  };

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - formData.photos.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map(a => a.uri);
      updateForm({ photos: [...formData.photos, ...newPhotos].slice(0, 5) });
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = [...formData.photos];
    newPhotos.splice(index, 1);
    updateForm({ photos: newPhotos });
  };

  const handleSubmit = async () => {
    try {
      const result = await createRequest({
        category: formData.category,
        serviceType: formData.serviceType,
        title: formData.title || getCategoryInfo(formData.category)?.name || 'Servicio',
        description: formData.description,
        photoUrls: formData.photos,
        voiceNoteUrl: formData.voiceNoteUrl,
        address: formData.address,
        addressExtra: formData.addressExtra,
        lat: formData.lat || location?.lat,
        lng: formData.lng || location?.lng,
        neighborhood: formData.neighborhood,
        city: formData.city,
        urgency: formData.urgency,
        preferredDate: formData.preferredDate,
        preferredTimeSlot: formData.preferredTimeSlot,
        budgetRange: formData.budgetRange,
      });

      if (result?.id) {
        router.replace({
          pathname: '/(consumer)/request/[id]',
          params: { id: result.id, new: 'true' },
        });
      }
    } catch (error) {
      console.error('Failed to create request:', error);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'category':
        return !!formData.category;
      case 'description':
        return formData.description.length >= 10;
      case 'location':
        return formData.address.length >= 5;
      case 'schedule':
        return !!formData.urgency;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const goToNextStep = () => {
    switch (step) {
      case 'category':
        setStep('description');
        break;
      case 'description':
        setStep('location');
        break;
      case 'location':
        setStep('schedule');
        break;
      case 'schedule':
        setStep('review');
        break;
      case 'review':
        handleSubmit();
        break;
    }
  };

  const goToPrevStep = () => {
    switch (step) {
      case 'description':
        setStep('category');
        break;
      case 'location':
        setStep('description');
        break;
      case 'schedule':
        setStep('location');
        break;
      case 'review':
        setStep('schedule');
        break;
      default:
        router.back();
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'category':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Que tipo de servicio necesitas?</Text>
            <Text style={styles.stepSubtitle}>
              Selecciona la categoria que mejor describa tu necesidad
            </Text>
            <CategoryGrid
              onCategoryPress={handleCategorySelect}
              selectedCategory={formData.category}
              fullWidth
            />
          </View>
        );

      case 'description':
        const categoryInfo = getCategoryInfo(formData.category);
        return (
          <View style={styles.stepContent}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryIcon}>{categoryInfo?.icon}</Text>
              <Text style={styles.categoryName}>{categoryInfo?.name}</Text>
            </View>

            <Text style={styles.stepTitle}>Describe lo que necesitas</Text>
            <Text style={styles.stepSubtitle}>
              Cuanto mas detalle nos des, mejores presupuestos recibiras
            </Text>

            <TextInput
              style={styles.titleInput}
              placeholder="Titulo breve (ej: Reparar canilla que gotea)"
              placeholderTextColor="#9ca3af"
              value={formData.title}
              onChangeText={(text) => updateForm({ title: text })}
              maxLength={100}
            />

            <TextInput
              style={styles.descriptionInput}
              placeholder="Describe el problema o trabajo que necesitas..."
              placeholderTextColor="#9ca3af"
              value={formData.description}
              onChangeText={(text) => updateForm({ description: text })}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={1000}
            />

            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaButton} onPress={handleAddPhoto}>
                <Camera size={20} color="#0284c7" />
                <Text style={styles.mediaButtonText}>
                  Fotos ({formData.photos.length}/5)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mediaButton}>
                <Mic size={20} color="#0284c7" />
                <Text style={styles.mediaButtonText}>Nota de voz</Text>
              </TouchableOpacity>
            </View>

            {formData.photos.length > 0 && (
              <ScrollView horizontal style={styles.photosPreview} showsHorizontalScrollIndicator={false}>
                {formData.photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image source={{ uri: photo }} style={styles.photoThumbnail} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <X size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        );

      case 'location':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Donde necesitas el servicio?</Text>
            <Text style={styles.stepSubtitle}>
              Ingresa la direccion donde se realizara el trabajo
            </Text>

            <View style={styles.addressInputContainer}>
              <MapPin size={20} color="#6b7280" />
              <TextInput
                style={styles.addressInput}
                placeholder="Direccion completa"
                placeholderTextColor="#9ca3af"
                value={formData.address}
                onChangeText={(text) => updateForm({ address: text })}
              />
            </View>

            <TextInput
              style={styles.addressExtraInput}
              placeholder="Piso, departamento, referencias (opcional)"
              placeholderTextColor="#9ca3af"
              value={formData.addressExtra}
              onChangeText={(text) => updateForm({ addressExtra: text })}
            />

            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Barrio detectado:</Text>
              <Text style={styles.locationValue}>
                {formData.neighborhood || neighborhood || 'Sin detectar'}
              </Text>
            </View>
          </View>
        );

      case 'schedule':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Cuando lo necesitas?</Text>
            <Text style={styles.stepSubtitle}>
              Indica la urgencia y preferencia de horario
            </Text>

            <View style={styles.urgencyOptions}>
              {URGENCY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.urgencyOption,
                    formData.urgency === option.key && styles.urgencyOptionActive,
                    formData.urgency === option.key && { borderColor: option.color },
                  ]}
                  onPress={() => updateForm({ urgency: option.key as any })}
                >
                  <option.icon
                    size={24}
                    color={formData.urgency === option.key ? option.color : '#6b7280'}
                  />
                  <View style={styles.urgencyText}>
                    <Text
                      style={[
                        styles.urgencyLabel,
                        formData.urgency === option.key && { color: option.color },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.urgencyDescription}>{option.description}</Text>
                  </View>
                  {formData.urgency === option.key && (
                    <Check size={20} color={option.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'review':
        const catInfo = getCategoryInfo(formData.category);
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Revisa tu solicitud</Text>
            <Text style={styles.stepSubtitle}>
              Confirma que todo este correcto antes de enviar
            </Text>

            <View style={styles.reviewCard}>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Categoria</Text>
                <View style={styles.reviewValueContainer}>
                  <Text style={styles.reviewIcon}>{catInfo?.icon}</Text>
                  <Text style={styles.reviewValue}>{catInfo?.name}</Text>
                </View>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Descripcion</Text>
                <Text style={styles.reviewValue}>{formData.title || formData.description.slice(0, 50)}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Ubicacion</Text>
                <Text style={styles.reviewValue}>{formData.address}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Urgencia</Text>
                <Text style={styles.reviewValue}>
                  {URGENCY_OPTIONS.find(o => o.key === formData.urgency)?.label}
                </Text>
              </View>

              {formData.photos.length > 0 && (
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Fotos</Text>
                  <Text style={styles.reviewValue}>{formData.photos.length} adjuntas</Text>
                </View>
              )}
            </View>

            <View style={styles.freeNotice}>
              <Check size={20} color="#16a34a" />
              <Text style={styles.freeNoticeText}>
                Publicar tu solicitud es 100% gratis. Recibiras presupuestos de profesionales verificados.
              </Text>
            </View>
          </View>
        );
    }
  };

  const getStepNumber = () => {
    const steps: Step[] = ['category', 'description', 'location', 'schedule', 'review'];
    return steps.indexOf(step) + 1;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPrevStep}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerProgress}>
          <Text style={styles.headerTitle}>Nueva solicitud</Text>
          <Text style={styles.headerStep}>Paso {getStepNumber()} de 5</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(getStepNumber() / 5) * 100}%` }]} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
          onPress={goToNextStep}
          disabled={!canProceed() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {step === 'review' ? 'Publicar solicitud' : 'Continuar'}
              </Text>
              {step !== 'review' && <ChevronRight size={20} color="#fff" />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
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
  headerProgress: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  headerStep: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#e5e7eb',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0284c7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  stepContent: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    marginBottom: 16,
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
    marginBottom: 16,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  mediaButtonText: {
    fontSize: 14,
    color: '#0284c7',
    fontWeight: '500',
  },
  photosPreview: {
    marginTop: 8,
  },
  photoContainer: {
    position: 'relative',
    marginRight: 8,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 12,
    marginBottom: 12,
  },
  addressInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 10,
  },
  addressExtraInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  locationLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  urgencyOptions: {
    gap: 12,
  },
  urgencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    gap: 16,
  },
  urgencyOptionActive: {
    backgroundColor: '#f9fafb',
  },
  urgencyText: {
    flex: 1,
  },
  urgencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  urgencyDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  reviewCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  reviewValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 2,
    justifyContent: 'flex-end',
  },
  reviewIcon: {
    fontSize: 18,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  freeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  freeNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
