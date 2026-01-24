/**
 * List Optimization Utilities
 * ===========================
 *
 * Utilities for optimizing FlashList and list rendering performance
 */

import { useCallback, useRef, useMemo } from 'react';
import { ViewToken } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════════
// FLASHLIST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Optimized FlashList configuration for different item types
 */
export const flashListConfigs = {
  // Job cards (medium height, complex content)
  jobCard: {
    estimatedItemSize: 140,
    drawDistance: 250,
    estimatedFirstItemOffset: 0,
    overrideItemLayout: undefined,
  },

  // Customer list items (smaller, simpler)
  customerItem: {
    estimatedItemSize: 88,
    drawDistance: 200,
    estimatedFirstItemOffset: 0,
  },

  // Messages (variable height)
  message: {
    estimatedItemSize: 80,
    drawDistance: 300,
    estimatedFirstItemOffset: 0,
  },

  // Photos grid
  photoGrid: {
    estimatedItemSize: 120,
    drawDistance: 200,
    numColumns: 3,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWABILITY
// ═══════════════════════════════════════════════════════════════════════════════

interface ViewabilityConfig {
  minimumViewTime?: number;
  viewAreaCoveragePercentThreshold?: number;
  itemVisiblePercentThreshold?: number;
  waitForInteraction?: boolean;
}

/**
 * Create viewability config for tracking visible items
 */
export function createViewabilityConfig(
  options: ViewabilityConfig = {}
): ViewabilityConfig {
  return {
    minimumViewTime: 250,
    viewAreaCoveragePercentThreshold: 50,
    waitForInteraction: false,
    ...options,
  };
}

/**
 * Hook for handling viewable items changed
 */
export function useViewableItemsChanged<T>(
  onItemsViewed?: (items: T[]) => void
) {
  const viewedItems = useRef<Set<string>>(new Set());

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const newlyViewed: T[] = [];

      viewableItems.forEach((viewToken) => {
        if (viewToken.isViewable && viewToken.key && !viewedItems.current.has(viewToken.key)) {
          viewedItems.current.add(viewToken.key);
          newlyViewed.push(viewToken.item as T);
        }
      });

      if (newlyViewed.length > 0 && onItemsViewed) {
        onItemsViewed(newlyViewed);
      }
    },
    [onItemsViewed]
  );

  return {
    onViewableItemsChanged,
    viewabilityConfig: createViewabilityConfig(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEY EXTRACTORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a memoized key extractor
 */
export function createKeyExtractor<T extends { id: string }>(
  prefix?: string
): (item: T, index: number) => string {
  return (item: T, index: number) => {
    if (item?.id) {
      return prefix ? `${prefix}-${item.id}` : item.id;
    }
    return `${prefix || 'item'}-${index}`;
  };
}

/**
 * Create a stable key extractor with index fallback
 */
export function createStableKeyExtractor<T>(
  idField: keyof T
): (item: T, index: number) => string {
  return (item: T, index: number) => {
    const id = item[idField];
    return id !== undefined && id !== null ? String(id) : `index-${index}`;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEM LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create getItemLayout for fixed-height items (better performance)
 */
export function createGetItemLayout(
  itemHeight: number,
  headerHeight: number = 0,
  separatorHeight: number = 0
) {
  return (_data: unknown, index: number) => ({
    length: itemHeight,
    offset: headerHeight + (itemHeight + separatorHeight) * index,
    index,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════

interface PaginationOptions {
  pageSize?: number;
  threshold?: number;
}

/**
 * Hook for infinite scroll pagination
 */
export function usePagination<T>(
  fetchMore: (page: number) => Promise<T[]>,
  options: PaginationOptions = {}
) {
  const { pageSize = 20, threshold = 0.5 } = options;
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) {
      return [];
    }

    loadingRef.current = true;
    try {
      const newItems = await fetchMore(pageRef.current);

      if (newItems.length < pageSize) {
        hasMoreRef.current = false;
      } else {
        pageRef.current += 1;
      }

      return newItems;
    } finally {
      loadingRef.current = false;
    }
  }, [fetchMore, pageSize]);

  const reset = useCallback(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadingRef.current = false;
  }, []);

  return {
    loadMore,
    reset,
    hasMore: hasMoreRef.current,
    isLoading: loadingRef.current,
    onEndReachedThreshold: threshold,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WINDOWING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate optimal window size based on screen dimensions
 */
export function calculateWindowSize(
  screenHeight: number,
  itemHeight: number,
  buffer: number = 2
): number {
  const visibleItems = Math.ceil(screenHeight / itemHeight);
  return visibleItems + buffer * 2;
}

/**
 * Hook for managing window state in large lists
 */
export function useWindowedList<T>(
  items: T[],
  windowSize: number = 20
) {
  const windowStartRef = useRef(0);

  const windowedItems = useMemo(() => {
    const start = windowStartRef.current;
    const end = Math.min(start + windowSize, items.length);
    return items.slice(start, end);
  }, [items, windowSize]);

  const setWindowStart = useCallback((index: number) => {
    windowStartRef.current = Math.max(0, index - Math.floor(windowSize / 4));
  }, [windowSize]);

  return {
    windowedItems,
    setWindowStart,
    totalCount: items.length,
    windowStart: windowStartRef.current,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Debounce scroll events for better performance
 */
export function useScrollDebounce(
  callback: (offset: number) => void,
  delay: number = 100
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  return useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(event.nativeEvent.contentOffset.y);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Track list scroll performance
 */
export function useScrollPerformance() {
  const frameTimestamps = useRef<number[]>([]);
  const lastOffset = useRef(0);

  const onScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const now = performance.now();
      const offset = event.nativeEvent.contentOffset.y;

      frameTimestamps.current.push(now);

      // Keep only last 60 frames
      if (frameTimestamps.current.length > 60) {
        frameTimestamps.current.shift();
      }

      lastOffset.current = offset;
    },
    []
  );

  const getFPS = useCallback(() => {
    const timestamps = frameTimestamps.current;
    if (timestamps.length < 2) return 0;

    const duration = timestamps[timestamps.length - 1] - timestamps[0];
    return Math.round((timestamps.length / duration) * 1000);
  }, []);

  return { onScroll, getFPS };
}
