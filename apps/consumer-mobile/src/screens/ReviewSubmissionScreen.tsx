/**
 * Review Submission Screen
 * ========================
 *
 * Submit reviews after job completion.
 * Phase 15: Consumer Marketplace
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { consumerApi } from '../services/api-client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RatingCategory {
  key: string;
  label: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const RATING_CATEGORIES: RatingCategory[] = [
  {
    key: 'punctuality',
    label: 'Puntualidad',
    description: '¿Llegó a tiempo y cumplió plazos?',
  },
  {
    key: 'quality',
    label: 'Calidad del trabajo',
    description: '¿El resultado cumplió tus expectativas?',
  },
  {
    key: 'price',
    label: 'Precio',
    description: '¿El precio fue justo por el trabajo?',
  },
  {
    key: 'communication',
    label: 'Comunicación',
    description: '¿Fue fácil comunicarse?',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STAR RATING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface StarRatingProps {
  rating: number;
  onChange: (rating: number) => void;
  size?: number;
}

function StarRating({ rating, onChange, size = 32 }: StarRatingProps): React.JSX.Element {
  return (
    <View style={styles.starContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onChange(star)}
          style={styles.starButton}
        >
          <Text style={[styles.star, { fontSize: size }]}>
            {star <= rating ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReviewSubmissionScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { businessId, jobId, businessName } = route.params;

  // Form state
  const [overallRating, setOverallRating] = useState(0);
  const [punctualityRating, setPunctualityRating] = useState(0);
  const [qualityRating, setQualityRating] = useState(0);
  const [priceRating, setPriceRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [comment, setComment] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Rating setters map
  const ratingSetters: Record<string, (rating: number) => void> = {
    punctuality: setPunctualityRating,
    quality: setQualityRating,
    price: setPriceRating,
    communication: setCommunicationRating,
  };

  const ratingValues: Record<string, number> = {
    punctuality: punctualityRating,
    quality: qualityRating,
    price: priceRating,
    communication: communicationRating,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  const isValid = overallRating > 0 && wouldRecommend !== null;

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMIT
  // ─────────────────────────────────────────────────────────────────────────────

  const submitReview = async () => {
    if (!isValid) {
      Alert.alert('Campos requeridos', 'Por favor califica tu experiencia general y si recomendarías al profesional.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await consumerApi.reviews.create({
        businessProfileId: businessId,
        jobId,
        overallRating,
        punctualityRating: punctualityRating || undefined,
        qualityRating: qualityRating || undefined,
        priceRating: priceRating || undefined,
        communicationRating: communicationRating || undefined,
        comment: comment.trim() || undefined,
        wouldRecommend: wouldRecommend!,
      });

      if (response.success) {
        Alert.alert(
          '¡Gracias!',
          'Tu reseña ha sido enviada exitosamente.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', response.error?.message || 'No se pudo enviar la reseña');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Califica tu experiencia</Text>
          <Text style={styles.subtitle}>con {businessName}</Text>
        </View>

        {/* Overall Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calificación general *</Text>
          <Text style={styles.sectionSubtitle}>¿Cómo fue tu experiencia en general?</Text>
          <View style={styles.overallRatingContainer}>
            <StarRating
              rating={overallRating}
              onChange={setOverallRating}
              size={48}
            />
            <Text style={styles.ratingLabel}>
              {overallRating === 0 && 'Selecciona una calificación'}
              {overallRating === 1 && 'Muy malo'}
              {overallRating === 2 && 'Malo'}
              {overallRating === 3 && 'Regular'}
              {overallRating === 4 && 'Bueno'}
              {overallRating === 5 && 'Excelente'}
            </Text>
          </View>
        </View>

        {/* Detailed Ratings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calificaciones detalladas</Text>
          <Text style={styles.sectionSubtitle}>Opcional pero ayuda a otros usuarios</Text>

          {RATING_CATEGORIES.map((category) => (
            <View key={category.key} style={styles.categoryRow}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryLabel}>{category.label}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
              </View>
              <StarRating
                rating={ratingValues[category.key]}
                onChange={ratingSetters[category.key]}
                size={24}
              />
            </View>
          ))}
        </View>

        {/* Would Recommend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>¿Recomendarías a este profesional? *</Text>
          <View style={styles.recommendButtons}>
            <TouchableOpacity
              style={[
                styles.recommendButton,
                wouldRecommend === true && styles.recommendButtonActiveYes,
              ]}
              onPress={() => setWouldRecommend(true)}
            >
              <Text style={styles.recommendIcon}>👍</Text>
              <Text
                style={[
                  styles.recommendText,
                  wouldRecommend === true && styles.recommendTextActive,
                ]}
              >
                Sí, lo recomiendo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.recommendButton,
                wouldRecommend === false && styles.recommendButtonActiveNo,
              ]}
              onPress={() => setWouldRecommend(false)}
            >
              <Text style={styles.recommendIcon}>👎</Text>
              <Text
                style={[
                  styles.recommendText,
                  wouldRecommend === false && styles.recommendTextActive,
                ]}
              >
                No lo recomiendo
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comentarios</Text>
          <Text style={styles.sectionSubtitle}>
            Cuéntanos más sobre tu experiencia (opcional)
          </Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="¿Qué te gustó? ¿Qué podría mejorar?"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.characterCount}>{comment.length}/1000</Text>
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>💡 Tips para una buena reseña</Text>
          <Text style={styles.tipText}>• Sé específico sobre lo que te gustó o no</Text>
          <Text style={styles.tipText}>• Menciona si cumplió con lo acordado</Text>
          <Text style={styles.tipText}>• Describe la calidad del trabajo</Text>
          <Text style={styles.tipText}>• Evita información personal</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={submitReview}
          disabled={!isValid || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar reseña</Text>
          )}
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.skipButtonText}>Omitir por ahora</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Section
  section: {
    backgroundColor: '#FFF',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 16,
  },

  // Overall Rating
  overallRatingContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  ratingLabel: {
    fontSize: 16,
    color: '#424242',
    marginTop: 8,
    fontWeight: '500',
  },

  // Star Rating
  starContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  star: {
    color: '#FFC107',
  },

  // Category Ratings
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryInfo: {
    flex: 1,
    marginRight: 12,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#212121',
  },
  categoryDescription: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },

  // Recommend
  recommendButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  recommendButtonActiveYes: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  recommendButtonActiveNo: {
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
    borderColor: '#E53935',
  },
  recommendIcon: {
    fontSize: 24,
  },
  recommendText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  recommendTextActive: {
    color: '#212121',
  },

  // Comment
  commentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
    backgroundColor: '#FAFAFA',
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 4,
  },

  // Tips
  tipsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FFF9C4',
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57F17',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#795548',
    marginBottom: 4,
    lineHeight: 18,
  },

  // Buttons
  submitButton: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 32,
  },
  skipButtonText: {
    color: '#757575',
    fontSize: 14,
  },
});
