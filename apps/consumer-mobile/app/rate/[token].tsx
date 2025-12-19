/**
 * Rating Screen - Consumer App
 * ============================
 *
 * In-app rating form for completed jobs.
 * Receives link via WhatsApp after job completion.
 * Features:
 * - Star rating (1-5)
 * - Optional comment
 * - Submit updates business's averageRating
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Star, Check, MessageCircle, ArrowLeft } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

interface JobDetails {
  id: string;
  providerName: string;
  providerAvatar: string;
  serviceType: string;
  completedAt: string;
  whatsappNumber: string;
  alreadyRated: boolean;
  existingRating?: {
    rating: number;
    comment?: string;
  };
}

const mockJobDetails: JobDetails = {
  id: 'job-1',
  providerName: 'Plomería Méndez',
  providerAvatar: 'PM',
  serviceType: 'Reparación de cañería',
  completedAt: '2024-01-15',
  whatsappNumber: '+5491123456789',
  alreadyRated: false,
};

export default function RatingScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    data: job,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['job-rating', token],
    queryFn: async () => {
      // Simulate API call to validate token and get job details
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate invalid token
      if (token === 'invalid') {
        throw new Error('Token inválido');
      }

      return mockJobDetails;
    },
  });

  const handleStarPress = (star: number) => {
    setRating(star);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Por favor seleccioná una calificación');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call to submit rating
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log('Rating submitted:', {
        token,
        rating,
        comment: comment.trim() || undefined,
      });

      setIsSubmitted(true);
    } catch (err) {
      Alert.alert('Error', 'No se pudo enviar la calificación. Intentá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = (value: number) => {
    switch (value) {
      case 1:
        return 'Muy malo';
      case 2:
        return 'Malo';
      case 3:
        return 'Regular';
      case 4:
        return 'Bueno';
      case 5:
        return 'Excelente';
      default:
        return 'Seleccioná una calificación';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ headerTitle: 'Error' }} />
        <View style={styles.errorIcon}>
          <Text style={styles.errorEmoji}>❌</Text>
        </View>
        <Text style={styles.errorTitle}>Enlace inválido</Text>
        <Text style={styles.errorText}>
          Este enlace de calificación no es válido o ya expiró.
        </Text>
        <Pressable style={styles.errorButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.errorButtonText}>Ir al inicio</Text>
        </Pressable>
      </View>
    );
  }

  if (job.alreadyRated) {
    return (
      <View style={styles.successContainer}>
        <Stack.Screen options={{ headerTitle: 'Ya calificado' }} />
        <View style={styles.successIcon}>
          <Check size={40} color="#059669" />
        </View>
        <Text style={styles.successTitle}>Ya calificaste este servicio</Text>
        <Text style={styles.successText}>
          Gracias por tu opinión. Tu calificación ayuda a otros usuarios.
        </Text>
        <Pressable style={styles.successButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.successButtonText}>Ir al inicio</Text>
        </Pressable>
      </View>
    );
  }

  if (isSubmitted) {
    return (
      <View style={styles.successContainer}>
        <Stack.Screen options={{ headerTitle: 'Gracias' }} />
        <View style={styles.successIcon}>
          <Check size={40} color="#059669" />
        </View>
        <Text style={styles.successTitle}>¡Gracias por tu calificación!</Text>
        <Text style={styles.successText}>
          Tu opinión ayuda a otros usuarios a encontrar buenos profesionales.
        </Text>

        <View style={styles.saveContactBox}>
          <MessageCircle size={24} color="#25d366" />
          <View style={styles.saveContactText}>
            <Text style={styles.saveContactTitle}>
              Guardá este contacto para futuras consultas
            </Text>
            <Text style={styles.saveContactNumber}>{job.whatsappNumber}</Text>
          </View>
        </View>

        <Pressable style={styles.successButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.successButtonText}>Ir al inicio</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: 'Calificar servicio',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft size={24} color="#111827" />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Provider Info */}
        <View style={styles.providerCard}>
          <View style={styles.providerAvatar}>
            <Text style={styles.providerAvatarText}>{job.providerAvatar}</Text>
          </View>
          <View>
            <Text style={styles.providerName}>{job.providerName}</Text>
            <Text style={styles.serviceType}>{job.serviceType}</Text>
            <Text style={styles.completedDate}>
              Completado el{' '}
              {new Date(job.completedAt).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* Rating Section */}
        <View style={styles.ratingSection}>
          <Text style={styles.ratingTitle}>¿Cómo calificarías el servicio?</Text>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                style={styles.starButton}
                onPress={() => handleStarPress(star)}
              >
                <Star
                  size={44}
                  color="#f59e0b"
                  fill={star <= rating ? '#f59e0b' : 'transparent'}
                  strokeWidth={star <= rating ? 0 : 1.5}
                />
              </Pressable>
            ))}
          </View>

          <Text
            style={[
              styles.ratingLabel,
              rating > 0 && styles.ratingLabelSelected,
              rating >= 4 && styles.ratingLabelPositive,
              rating > 0 && rating < 3 && styles.ratingLabelNegative,
            ]}
          >
            {getRatingLabel(rating)}
          </Text>
        </View>

        {/* Comment Section */}
        <View style={styles.commentSection}>
          <Text style={styles.commentTitle}>Contanos más (opcional)</Text>
          <Text style={styles.commentSubtitle}>
            Tu opinión ayuda a otros usuarios y al profesional a mejorar
          </Text>
          <TextInput
            style={styles.commentInput}
            placeholder="¿Qué te gustó? ¿Qué podría mejorar?"
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

        {/* Quick Comments */}
        {rating > 0 && (
          <View style={styles.quickComments}>
            <Text style={styles.quickCommentsTitle}>Comentarios rápidos</Text>
            <View style={styles.quickCommentsGrid}>
              {rating >= 4
                ? [
                    'Llegó puntual',
                    'Muy profesional',
                    'Buen precio',
                    'Trabajo de calidad',
                    'Muy recomendable',
                    'Excelente atención',
                  ].map((text) => (
                    <Pressable
                      key={text}
                      style={[
                        styles.quickCommentChip,
                        comment.includes(text) && styles.quickCommentChipSelected,
                      ]}
                      onPress={() => {
                        if (comment.includes(text)) {
                          setComment(comment.replace(text + '. ', '').replace(text, ''));
                        } else {
                          setComment((prev) => (prev ? prev + ' ' + text + '.' : text + '.'));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.quickCommentText,
                          comment.includes(text) && styles.quickCommentTextSelected,
                        ]}
                      >
                        {text}
                      </Text>
                    </Pressable>
                  ))
                : [
                    'Llegó tarde',
                    'Falta de comunicación',
                    'Precio alto',
                    'Trabajo incompleto',
                    'Poco profesional',
                    'Mala actitud',
                  ].map((text) => (
                    <Pressable
                      key={text}
                      style={[
                        styles.quickCommentChip,
                        comment.includes(text) && styles.quickCommentChipSelected,
                      ]}
                      onPress={() => {
                        if (comment.includes(text)) {
                          setComment(comment.replace(text + '. ', '').replace(text, ''));
                        } else {
                          setComment((prev) => (prev ? prev + ' ' + text + '.' : text + '.'));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.quickCommentText,
                          comment.includes(text) && styles.quickCommentTextSelected,
                        ]}
                      >
                        {text}
                      </Text>
                    </Pressable>
                  ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.submitButton,
            (rating === 0 || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={rating === 0 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Star size={20} color="#fff" fill="#fff" />
              <Text style={styles.submitButtonText}>Enviar calificación</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerButton: {
    padding: 8,
    marginLeft: -8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorEmoji: {
    fontSize: 36,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  saveContactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    width: '100%',
  },
  saveContactText: {
    flex: 1,
  },
  saveContactTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#059669',
    marginBottom: 2,
  },
  saveContactNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  successButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 24,
    gap: 14,
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  providerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  serviceType: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  completedDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },
  ratingLabelSelected: {
    color: '#374151',
  },
  ratingLabelPositive: {
    color: '#059669',
  },
  ratingLabelNegative: {
    color: '#ef4444',
  },
  commentSection: {
    marginBottom: 24,
  },
  commentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  commentSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  commentInput: {
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
  quickComments: {
    marginBottom: 24,
  },
  quickCommentsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 12,
  },
  quickCommentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickCommentChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  quickCommentChipSelected: {
    backgroundColor: '#d1fae5',
    borderColor: '#059669',
  },
  quickCommentText: {
    fontSize: 13,
    color: '#4b5563',
  },
  quickCommentTextSelected: {
    color: '#059669',
    fontWeight: '500',
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
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
