/**
 * Review Card Component
 * =====================
 *
 * Phase 15: Consumer Marketplace
 * Displays a single review with ratings and response.
 */

import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ThumbsUp, MessageSquare, Flag } from 'lucide-react-native';
import { RatingStars } from './RatingStars';

interface Review {
  id: string;
  overallRating: number;
  comment?: string;
  consumerName?: string;
  consumerInitials?: string;
  createdAt: string;
  wouldRecommend?: boolean;
  helpfulCount?: number;
  businessResponse?: string;
  businessResponseAt?: string;
  photoUrls?: string[];
  verified?: boolean;
}

interface ReviewCardProps {
  review: Review;
  onHelpful?: () => void;
  onReport?: () => void;
}

export function ReviewCard({ review, onHelpful, onReport }: ReviewCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {review.consumerInitials || review.consumerName?.charAt(0) || '?'}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{review.consumerName || 'Usuario'}</Text>
            {review.verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verificado</Text>
              </View>
            )}
          </View>
          <Text style={styles.date}>{formatDate(review.createdAt)}</Text>
        </View>
        <RatingStars rating={review.overallRating} size={14} />
      </View>

      {/* Comment */}
      {review.comment && (
        <Text style={styles.comment}>{review.comment}</Text>
      )}

      {/* Photos */}
      {review.photoUrls && review.photoUrls.length > 0 && (
        <View style={styles.photos}>
          {review.photoUrls.slice(0, 3).map((url, index) => (
            <Image key={index} source={{ uri: url }} style={styles.photo} />
          ))}
          {review.photoUrls.length > 3 && (
            <View style={styles.morePhotos}>
              <Text style={styles.morePhotosText}>+{review.photoUrls.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {/* Would Recommend */}
      {review.wouldRecommend !== undefined && (
        <View style={styles.recommendRow}>
          <ThumbsUp
            size={14}
            color={review.wouldRecommend ? '#16a34a' : '#ef4444'}
            style={!review.wouldRecommend ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
          <Text
            style={[
              styles.recommendText,
              { color: review.wouldRecommend ? '#16a34a' : '#ef4444' },
            ]}
          >
            {review.wouldRecommend ? 'Recomienda' : 'No recomienda'}
          </Text>
        </View>
      )}

      {/* Business Response */}
      {review.businessResponse && (
        <View style={styles.responseContainer}>
          <View style={styles.responseHeader}>
            <MessageSquare size={14} color="#0284c7" />
            <Text style={styles.responseLabel}>Respuesta del profesional</Text>
          </View>
          <Text style={styles.responseText}>{review.businessResponse}</Text>
          {review.businessResponseAt && (
            <Text style={styles.responseDate}>
              {formatDate(review.businessResponseAt)}
            </Text>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={onHelpful}>
          <ThumbsUp size={14} color="#6b7280" />
          <Text style={styles.actionText}>
            Util {review.helpfulCount ? `(${review.helpfulCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onReport}>
          <Flag size={14} color="#6b7280" />
          <Text style={styles.actionText}>Reportar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  verifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#dcfce7',
    borderRadius: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  comment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  photos: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  morePhotos: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  recommendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  recommendText: {
    fontSize: 13,
    fontWeight: '500',
  },
  responseContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0284c7',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  responseText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  responseDate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    color: '#6b7280',
  },
});

export default ReviewCard;
