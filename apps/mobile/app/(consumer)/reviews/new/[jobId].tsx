/**
 * Submit Review Screen
 * ====================
 *
 * Phase 15: Consumer Marketplace
 * Leave a review for a completed service.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Star,
  Camera,
  X,
  Check,
  ThumbsUp,
} from 'lucide-react-native';

import { useJobDetail } from '../../../../lib/consumer/hooks/use-jobs';
import { useSubmitReview } from '../../../../lib/consumer/hooks/use-reviews';

interface RatingCategory {
  key: string;
  label: string;
  value: number;
}

export default function SubmitReviewScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { job, business } = useJobDetail(jobId);
  const { submitReview, isLoading: isSubmitting } = useSubmitReview();

  const [overallRating, setOverallRating] = useState(0);
  const [ratings, setRatings] = useState<RatingCategory[]>([
    { key: 'punctuality', label: 'Puntualidad', value: 0 },
    { key: 'quality', label: 'Calidad del trabajo', value: 0 },
    { key: 'price', label: 'Relacion calidad/precio', value: 0 },
    { key: 'communication', label: 'Comunicacion', value: 0 },
  ]);
  const [comment, setComment] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  const updateRating = (key: string, value: number) => {
    setRatings(prev =>
      prev.map(r => (r.key === key ? { ...r, value } : r))
    );
  };

  const handleAddPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map(a => a.uri);
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 5));
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (overallRating === 0 || !business) return;

    try {
      await submitReview({
        businessProfileId: business.id,
        jobId,
        overallRating,
        punctualityRating: ratings.find(r => r.key === 'punctuality')?.value || undefined,
        qualityRating: ratings.find(r => r.key === 'quality')?.value || undefined,
        priceRating: ratings.find(r => r.key === 'price')?.value || undefined,
        communicationRating: ratings.find(r => r.key === 'communication')?.value || undefined,
        comment,
        wouldRecommend: wouldRecommend ?? true,
        photos,
      });

      router.replace({
        pathname: '/(consumer)/jobs/[id]',
        params: { id: jobId },
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  const canSubmit = overallRating > 0;

  const RatingStarsInput = ({
    value,
    onChange,
    size = 32,
  }: {
    value: number;
    onChange: (v: number) => void;
    size?: number;
  }) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)}>
          <Star
            size={size}
            color={star <= value ? '#f59e0b' : '#d1d5db'}
            fill={star <= value ? '#f59e0b' : 'transparent'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dejar opinion</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Business Info */}
        {business && (
          <View style={styles.businessHeader}>
            {business.logoUrl ? (
              <Image source={{ uri: business.logoUrl }} style={styles.businessLogo} />
            ) : (
              <View style={[styles.businessLogo, styles.businessLogoPlaceholder]}>
                <Text style={styles.businessLogoText}>
                  {business.displayName?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <Text style={styles.businessName}>{business.displayName}</Text>
          </View>
        )}

        {/* Overall Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calificacion general</Text>
          <Text style={styles.sectionSubtitle}>
            Como fue tu experiencia en general?
          </Text>
          <RatingStarsInput value={overallRating} onChange={setOverallRating} size={40} />
          <Text style={styles.ratingLabel}>
            {overallRating === 0
              ? 'Toca para calificar'
              : overallRating === 1
              ? 'Muy malo'
              : overallRating === 2
              ? 'Malo'
              : overallRating === 3
              ? 'Regular'
              : overallRating === 4
              ? 'Bueno'
              : 'Excelente'}
          </Text>
        </View>

        {/* Detailed Ratings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calificacion detallada</Text>
          <Text style={styles.sectionSubtitle}>
            Opcional: ayuda a otros usuarios con mas detalles
          </Text>
          {ratings.map((rating) => (
            <View key={rating.key} style={styles.ratingRow}>
              <Text style={styles.ratingRowLabel}>{rating.label}</Text>
              <RatingStarsInput
                value={rating.value}
                onChange={(v) => updateRating(rating.key, v)}
                size={24}
              />
            </View>
          ))}
        </View>

        {/* Comment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tu comentario</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Cuenta tu experiencia con este profesional..."
            placeholderTextColor="#9ca3af"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{comment.length}/500</Text>
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fotos del trabajo</Text>
          <Text style={styles.sectionSubtitle}>
            Opcional: agrega fotos del resultado
          </Text>
          <View style={styles.photosGrid}>
            {photos.map((photo, index) => (
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
            {photos.length < 5 && (
              <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddPhotos}>
                <Camera size={24} color="#6b7280" />
                <Text style={styles.addPhotoText}>Agregar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Would Recommend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lo recomendarias?</Text>
          <View style={styles.recommendOptions}>
            <TouchableOpacity
              style={[
                styles.recommendOption,
                wouldRecommend === true && styles.recommendOptionActive,
              ]}
              onPress={() => setWouldRecommend(true)}
            >
              <ThumbsUp
                size={24}
                color={wouldRecommend === true ? '#16a34a' : '#6b7280'}
              />
              <Text
                style={[
                  styles.recommendText,
                  wouldRecommend === true && styles.recommendTextActive,
                ]}
              >
                Si, lo recomiendo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.recommendOption,
                wouldRecommend === false && styles.recommendOptionActiveNo,
              ]}
              onPress={() => setWouldRecommend(false)}
            >
              <ThumbsUp
                size={24}
                color={wouldRecommend === false ? '#ef4444' : '#6b7280'}
                style={{ transform: [{ rotate: '180deg' }] }}
              />
              <Text
                style={[
                  styles.recommendText,
                  wouldRecommend === false && styles.recommendTextActiveNo,
                ]}
              >
                No lo recomiendo
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Publicar opinion</Text>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  businessHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  businessLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 12,
  },
  businessLogoPlaceholder: {
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessLogoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  ratingRowLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoContainer: {
    position: 'relative',
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
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  recommendOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
  },
  recommendOptionActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  recommendOptionActiveNo: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  recommendText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  recommendTextActive: {
    color: '#16a34a',
  },
  recommendTextActiveNo: {
    color: '#ef4444',
  },
  bottomSpacer: {
    height: 24,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
