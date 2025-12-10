/**
 * Rating Stars Component
 * ======================
 *
 * Phase 15: Consumer Marketplace
 * Displays star ratings (1-5).
 */

import { View, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

interface RatingStarsProps {
  rating: number;
  size?: number;
  color?: string;
  showEmpty?: boolean;
}

export function RatingStars({
  rating,
  size = 16,
  color = '#f59e0b',
  showEmpty = true,
}: RatingStarsProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = showEmpty ? 5 - fullStars - (hasHalfStar ? 1 : 0) : 0;

  return (
    <View style={styles.container}>
      {/* Full stars */}
      {Array(fullStars)
        .fill(null)
        .map((_, index) => (
          <Star key={`full-${index}`} size={size} color={color} fill={color} />
        ))}

      {/* Half star (rendered as full for simplicity) */}
      {hasHalfStar && (
        <Star key="half" size={size} color={color} fill={color} />
      )}

      {/* Empty stars */}
      {Array(emptyStars)
        .fill(null)
        .map((_, index) => (
          <Star
            key={`empty-${index}`}
            size={size}
            color={showEmpty ? '#d1d5db' : color}
            fill="transparent"
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 2,
  },
});

export default RatingStars;
