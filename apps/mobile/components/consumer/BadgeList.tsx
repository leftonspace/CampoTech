/**
 * Badge List Component
 * ====================
 *
 * Phase 15: Consumer Marketplace
 * Displays business badges/certifications.
 */

import { View, Text, StyleSheet } from 'react-native';
import {
  Shield,
  Star,
  Clock,
  Sparkles,
  Award,
  FileCheck,
  ShieldCheck,
  Crown,
} from 'lucide-react-native';

interface BadgeConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: any;
}

const BADGE_CONFIG: Record<string, BadgeConfig> = {
  verified: {
    label: 'Verificado',
    color: '#16a34a',
    bgColor: '#dcfce7',
    icon: ShieldCheck,
  },
  top_rated: {
    label: 'Mejor valorado',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: Star,
  },
  fast_responder: {
    label: 'Respuesta rapida',
    color: '#0284c7',
    bgColor: '#dbeafe',
    icon: Clock,
  },
  new: {
    label: 'Nuevo',
    color: '#7c3aed',
    bgColor: '#ede9fe',
    icon: Sparkles,
  },
  licensed: {
    label: 'Matriculado',
    color: '#0891b2',
    bgColor: '#cffafe',
    icon: FileCheck,
  },
  insured: {
    label: 'Asegurado',
    color: '#0d9488',
    bgColor: '#ccfbf1',
    icon: Shield,
  },
  background_checked: {
    label: 'Antecedentes',
    color: '#4f46e5',
    bgColor: '#e0e7ff',
    icon: Award,
  },
  premium: {
    label: 'Premium',
    color: '#b45309',
    bgColor: '#fef3c7',
    icon: Crown,
  },
};

interface BadgeListProps {
  badges: string[];
  limit?: number;
  size?: 'small' | 'medium' | 'large';
}

export function BadgeList({ badges, limit, size = 'medium' }: BadgeListProps) {
  const displayBadges = limit ? badges.slice(0, limit) : badges;
  const remaining = badges.length - displayBadges.length;

  const sizeStyles = {
    small: {
      badge: styles.badgeSmall,
      text: styles.textSmall,
      iconSize: 10,
    },
    medium: {
      badge: styles.badgeMedium,
      text: styles.textMedium,
      iconSize: 12,
    },
    large: {
      badge: styles.badgeLarge,
      text: styles.textLarge,
      iconSize: 14,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={styles.container}>
      {displayBadges.map((badge) => {
        const config = BADGE_CONFIG[badge];
        if (!config) return null;

        const BadgeIcon = config.icon;
        return (
          <View
            key={badge}
            style={[currentSize.badge, { backgroundColor: config.bgColor }]}
          >
            <BadgeIcon size={currentSize.iconSize} color={config.color} />
            <Text style={[currentSize.text, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        );
      })}
      {remaining > 0 && (
        <View style={[currentSize.badge, styles.moreBadge]}>
          <Text style={[currentSize.text, styles.moreText]}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeMedium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  textSmall: {
    fontSize: 10,
    fontWeight: '500',
  },
  textMedium: {
    fontSize: 11,
    fontWeight: '500',
  },
  textLarge: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreBadge: {
    backgroundColor: '#f3f4f6',
  },
  moreText: {
    color: '#6b7280',
  },
});

export default BadgeList;
