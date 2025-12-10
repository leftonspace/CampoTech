/**
 * Photo Gallery Screen
 * ====================
 *
 * Before/after photos for jobs and business portfolios.
 * Phase 15: Consumer Marketplace
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  Animated,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Photo {
  id: string;
  url: string;
  type: 'before' | 'after' | 'gallery';
  caption?: string;
  createdAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMBNAIL_SIZE = (SCREEN_WIDTH - 48) / 3;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PhotoGalleryScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { photos, title, showBeforeAfter } = route.params as {
    photos: Photo[];
    title?: string;
    showBeforeAfter?: boolean;
  };

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'before' | 'after'>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Filter photos by view mode
  const filteredPhotos = viewMode === 'all'
    ? photos
    : photos.filter((p) => p.type === viewMode);

  // Group before/after pairs
  const beforeAfterPairs = showBeforeAfter
    ? photos
        .filter((p) => p.type === 'before')
        .map((before) => ({
          before,
          after: photos.find(
            (p) => p.type === 'after' && p.id.replace('after', 'before') === before.id
          ),
        }))
    : [];

  // ─────────────────────────────────────────────────────────────────────────────
  // MODAL HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const openModal = (index: number) => {
    setSelectedIndex(index);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSelectedIndex(null);
    });
  };

  const goToNext = () => {
    if (selectedIndex !== null && selectedIndex < filteredPhotos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER THUMBNAIL
  // ─────────────────────────────────────────────────────────────────────────────

  const renderThumbnail = ({ item, index }: { item: Photo; index: number }) => (
    <TouchableOpacity
      style={styles.thumbnail}
      onPress={() => openModal(index)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.url }} style={styles.thumbnailImage} />
      {item.type !== 'gallery' && (
        <View
          style={[
            styles.typeBadge,
            item.type === 'before' ? styles.typeBadgeBefore : styles.typeBadgeAfter,
          ]}
        >
          <Text style={styles.typeBadgeText}>
            {item.type === 'before' ? 'Antes' : 'Después'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER BEFORE/AFTER PAIR
  // ─────────────────────────────────────────────────────────────────────────────

  const renderBeforeAfterPair = ({
    item,
  }: {
    item: { before: Photo; after?: Photo };
  }) => (
    <View style={styles.pairContainer}>
      <View style={styles.pairImageContainer}>
        <Image source={{ uri: item.before.url }} style={styles.pairImage} />
        <View style={[styles.pairLabel, styles.pairLabelBefore]}>
          <Text style={styles.pairLabelText}>ANTES</Text>
        </View>
      </View>
      {item.after ? (
        <View style={styles.pairImageContainer}>
          <Image source={{ uri: item.after.url }} style={styles.pairImage} />
          <View style={[styles.pairLabel, styles.pairLabelAfter]}>
            <Text style={styles.pairLabelText}>DESPUÉS</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.pairImageContainer, styles.pairImagePlaceholder]}>
          <Text style={styles.placeholderText}>Después no disponible</Text>
        </View>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title || 'Galería'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* View Mode Tabs (for before/after galleries) */}
      {showBeforeAfter && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'all' && styles.tabActive]}
            onPress={() => setViewMode('all')}
          >
            <Text style={[styles.tabText, viewMode === 'all' && styles.tabTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'before' && styles.tabActive]}
            onPress={() => setViewMode('before')}
          >
            <Text style={[styles.tabText, viewMode === 'before' && styles.tabTextActive]}>
              Antes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'after' && styles.tabActive]}
            onPress={() => setViewMode('after')}
          >
            <Text style={[styles.tabText, viewMode === 'after' && styles.tabTextActive]}>
              Después
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Photo Grid or Before/After Pairs */}
      {showBeforeAfter && viewMode === 'all' && beforeAfterPairs.length > 0 ? (
        <FlatList
          data={beforeAfterPairs}
          renderItem={renderBeforeAfterPair}
          keyExtractor={(item) => item.before.id}
          contentContainerStyle={styles.pairsList}
        />
      ) : (
        <FlatList
          data={filteredPhotos}
          renderItem={renderThumbnail}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📷</Text>
              <Text style={styles.emptyText}>No hay fotos</Text>
            </View>
          }
        />
      )}

      {/* Photo count */}
      <View style={styles.footer}>
        <Text style={styles.countText}>
          {filteredPhotos.length} foto{filteredPhotos.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Fullscreen Modal */}
      <Modal
        visible={selectedIndex !== null}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <StatusBar hidden />
        <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.modalClose} onPress={closeModal}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>

          {/* Navigation arrows */}
          {selectedIndex !== null && selectedIndex > 0 && (
            <TouchableOpacity style={styles.navLeft} onPress={goToPrevious}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
          )}
          {selectedIndex !== null && selectedIndex < filteredPhotos.length - 1 && (
            <TouchableOpacity style={styles.navRight} onPress={goToNext}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
          )}

          {/* Full image */}
          {selectedIndex !== null && filteredPhotos[selectedIndex] && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: filteredPhotos[selectedIndex].url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              {filteredPhotos[selectedIndex].caption && (
                <View style={styles.captionContainer}>
                  <Text style={styles.captionText}>
                    {filteredPhotos[selectedIndex].caption}
                  </Text>
                </View>
              )}
              <View style={styles.pagination}>
                <Text style={styles.paginationText}>
                  {selectedIndex + 1} / {filteredPhotos.length}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  closeButton: {
    fontSize: 24,
    color: '#FFF',
    padding: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  headerSpacer: {
    width: 32,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#333',
  },
  tabText: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '500',
  },

  // Grid
  grid: {
    padding: 12,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  typeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeBefore: {
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
  },
  typeBadgeAfter: {
    backgroundColor: 'rgba(46, 125, 50, 0.9)',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },

  // Before/After Pairs
  pairsList: {
    padding: 16,
  },
  pairContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 4,
  },
  pairImageContainer: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pairImage: {
    width: '100%',
    height: '100%',
  },
  pairImagePlaceholder: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 12,
  },
  pairLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pairLabelBefore: {
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
  },
  pairLabelAfter: {
    backgroundColor: 'rgba(46, 125, 50, 0.9)',
  },
  pairLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },

  // Footer
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#000',
  },
  countText: {
    fontSize: 13,
    color: '#666',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  modalCloseText: {
    fontSize: 28,
    color: '#FFF',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
  },
  captionText: {
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
  },
  pagination: {
    position: 'absolute',
    bottom: 60,
  },
  paginationText: {
    fontSize: 14,
    color: '#FFF',
  },
  navLeft: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navRight: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navText: {
    fontSize: 48,
    color: 'rgba(255,255,255,0.8)',
  },
});
