/**
 * Category Grid Component
 * =======================
 *
 * Phase 15: Consumer Marketplace
 * Displays service categories in a grid layout.
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CATEGORIES } from '../../lib/consumer/constants';

interface CategoryGridProps {
  onCategoryPress: (categoryId: string) => void;
  selectedCategory?: string;
  fullWidth?: boolean;
  limit?: number;
}

export function CategoryGrid({
  onCategoryPress,
  selectedCategory,
  fullWidth = false,
  limit,
}: CategoryGridProps) {
  const displayCategories = limit ? CATEGORIES.slice(0, limit) : CATEGORIES;

  if (fullWidth) {
    return (
      <View style={styles.fullWidthGrid}>
        {displayCategories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.fullWidthItem,
              selectedCategory === category.id && styles.itemSelected,
            ]}
            onPress={() => onCategoryPress(category.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.itemIcon}>{category.icon}</Text>
            <Text
              style={[
                styles.itemName,
                selectedCategory === category.id && styles.itemNameSelected,
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContainer}
    >
      {displayCategories.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.item,
            selectedCategory === category.id && styles.itemSelected,
          ]}
          onPress={() => onCategoryPress(category.id)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.iconContainer,
              selectedCategory === category.id && styles.iconContainerSelected,
            ]}
          >
            <Text style={styles.icon}>{category.icon}</Text>
          </View>
          <Text
            style={[
              styles.name,
              selectedCategory === category.id && styles.nameSelected,
            ]}
            numberOfLines={1}
          >
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  item: {
    alignItems: 'center',
    width: 72,
  },
  itemSelected: {},
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainerSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#0284c7',
  },
  icon: {
    fontSize: 28,
  },
  name: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
  nameSelected: {
    color: '#0284c7',
    fontWeight: '600',
  },
  fullWidthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fullWidthItem: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  itemNameSelected: {
    color: '#0284c7',
    fontWeight: '600',
  },
});

export default CategoryGrid;
