/**
 * Performance Optimization Utilities
 * ===================================
 *
 * Phase 2.6.1: Device Compatibility
 * Optimizations for older devices (Android 8+, iOS 14+)
 */

import { useCallback, useRef, useMemo, useEffect } from 'react';
import { InteractionManager, Platform } from 'react-native';

/**
 * Debounce function for expensive operations
 * Prevents rapid-fire calls on older devices
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle function for scroll handlers and frequent events
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Hook to run expensive operations after interactions complete
 * Critical for smooth transitions on older devices
 */
export function useAfterInteractions(callback: () => void, deps: unknown[] = []) {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      callback();
    });

    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hook for lazy initialization of expensive computations
 */
export function useLazyRef<T>(initializer: () => T): React.MutableRefObject<T> {
  const ref = useRef<T | null>(null);

  if (ref.current === null) {
    ref.current = initializer();
  }

  return ref as React.MutableRefObject<T>;
}

/**
 * Memory-efficient memoization with size limit
 * Prevents memory issues on low-RAM devices (2GB)
 */
export function createLimitedCache<K, V>(maxSize: number = 50) {
  const cache = new Map<K, V>();
  const keys: K[] = [];

  return {
    get(key: K): V | undefined {
      return cache.get(key);
    },
    set(key: K, value: V): void {
      if (cache.has(key)) {
        cache.set(key, value);
        return;
      }

      if (keys.length >= maxSize) {
        const oldestKey = keys.shift();
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }

      cache.set(key, value);
      keys.push(key);
    },
    clear(): void {
      cache.clear();
      keys.length = 0;
    },
    size(): number {
      return cache.size;
    },
  };
}

/**
 * Batch state updates to reduce re-renders
 */
export function useBatchedUpdates<T>(
  initialState: T,
  batchDelay: number = 16 // ~1 frame at 60fps
): [T, (updates: Partial<T>) => void, () => void] {
  const stateRef = useRef<T>(initialState);
  const pendingUpdates = useRef<Partial<T>>({});
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, forceUpdate] = useCallback(() => ({}), []);

  const scheduleUpdate = useCallback(
    (updates: Partial<T>) => {
      pendingUpdates.current = { ...pendingUpdates.current, ...updates };

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        stateRef.current = { ...stateRef.current, ...pendingUpdates.current };
        pendingUpdates.current = {};
        forceUpdate();
      }, batchDelay);
    },
    [batchDelay, forceUpdate]
  );

  const flushUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    stateRef.current = { ...stateRef.current, ...pendingUpdates.current };
    pendingUpdates.current = {};
    forceUpdate();
  }, [forceUpdate]);

  return [stateRef.current, scheduleUpdate, flushUpdates];
}

/**
 * Platform-specific performance settings
 */
export const PERFORMANCE_CONFIG = {
  // Image quality for older devices
  imageQuality: Platform.select({
    android: 0.7, // Lower quality on Android for performance
    ios: 0.8,
    default: 0.8,
  }),

  // Max image dimensions for thumbnails
  thumbnailSize: {
    width: 200,
    height: 200,
  },

  // Full image max dimensions
  fullImageSize: {
    width: 1200,
    height: 1200,
  },

  // List rendering optimizations
  list: {
    initialNumToRender: 10,
    maxToRenderPerBatch: 5,
    windowSize: 5,
    updateCellsBatchingPeriod: 50,
    removeClippedSubviews: Platform.OS === 'android',
  },

  // Animation settings for older devices
  animation: {
    useNativeDriver: true,
    duration: Platform.select({
      android: 200, // Shorter on Android
      ios: 250,
      default: 250,
    }),
  },

  // Memory thresholds
  memory: {
    maxCacheSize: 50, // Max items in memory cache
    imagePoolSize: 20, // Max images to keep in memory
  },
};

/**
 * Check if device is likely low-end based on platform
 */
export function isLowEndDevice(): boolean {
  // In production, you'd check Device.totalMemory
  // For now, assume Android devices might be lower-end
  return Platform.OS === 'android';
}

/**
 * Get optimized list props for FlashList/FlatList
 */
export function getOptimizedListProps() {
  const isLowEnd = isLowEndDevice();

  return {
    initialNumToRender: isLowEnd ? 5 : PERFORMANCE_CONFIG.list.initialNumToRender,
    maxToRenderPerBatch: isLowEnd ? 3 : PERFORMANCE_CONFIG.list.maxToRenderPerBatch,
    windowSize: isLowEnd ? 3 : PERFORMANCE_CONFIG.list.windowSize,
    updateCellsBatchingPeriod: PERFORMANCE_CONFIG.list.updateCellsBatchingPeriod,
    removeClippedSubviews: PERFORMANCE_CONFIG.list.removeClippedSubviews,
  };
}

/**
 * Measure component render time (development only)
 */
export function useRenderTime(componentName: string) {
  const startTime = useRef<number>(0);

  if (__DEV__) {
    startTime.current = performance.now();

    useEffect(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime.current;
      if (renderTime > 16) {
        // More than 1 frame
        console.warn(
          `[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`
        );
      }
    });
  }
}
