/**
 * Lazy Screen Component
 * =====================
 *
 * Phase 2.6.1: Device Compatibility
 * Defers heavy component rendering until after navigation completes
 */

import React, { useState, useEffect, ReactNode, ComponentType } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LazyScreenProps {
  children: ReactNode;
  placeholder?: ReactNode;
  delay?: number;
}

/**
 * Wrapper that defers rendering until animations complete
 * Critical for smooth transitions on older devices
 */
export function LazyScreen({
  children,
  placeholder,
  delay = 0,
}: LazyScreenProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Wait for navigation animation to complete
    const task = InteractionManager.runAfterInteractions(() => {
      if (delay > 0) {
        setTimeout(() => {
          if (mounted) setIsReady(true);
        }, delay);
      } else {
        if (mounted) setIsReady(true);
      }
    });

    return () => {
      mounted = false;
      task.cancel();
    };
  }, [delay]);

  if (!isReady) {
    return (
      placeholder || (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      )
    );
  }

  return <>{children}</>;
}

/**
 * HOC version for lazy loading entire screen components
 */
export function withLazyLoading<P extends object>(
  WrappedComponent: ComponentType<P>,
  options?: { delay?: number; placeholder?: ReactNode }
) {
  return function LazyLoadedComponent(props: P) {
    return (
      <LazyScreen delay={options?.delay} placeholder={options?.placeholder}>
        <WrappedComponent {...props} />
      </LazyScreen>
    );
  };
}

/**
 * Skeleton placeholder for common UI patterns
 */
export function SkeletonPlaceholder({
  type = 'list',
}: {
  type?: 'list' | 'card' | 'detail';
}) {
  if (type === 'list') {
    return (
      <SafeAreaView style={styles.skeleton}>
        {Array.from({ length: 5 }).map((_, index) => (
          <View key={index} style={styles.skeletonRow}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonContent}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonSubtitle} />
            </View>
          </View>
        ))}
      </SafeAreaView>
    );
  }

  if (type === 'card') {
    return (
      <SafeAreaView style={styles.skeleton}>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonCardImage} />
          <View style={styles.skeletonCardBody}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonSubtitle} />
            <View style={styles.skeletonSubtitle} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // detail type
  return (
    <SafeAreaView style={styles.skeleton}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonHeaderTitle} />
      </View>
      <View style={styles.skeletonDetailContent}>
        <View style={styles.skeletonDetailRow} />
        <View style={styles.skeletonDetailRow} />
        <View style={styles.skeletonDetailRow} />
        <View style={[styles.skeletonDetailRow, { width: '60%' }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  skeleton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
  },
  skeletonContent: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonTitle: {
    height: 16,
    width: '60%',
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  skeletonSubtitle: {
    height: 12,
    width: '40%',
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginTop: 8,
  },
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  skeletonCardImage: {
    height: 200,
    backgroundColor: '#e5e7eb',
  },
  skeletonCardBody: {
    padding: 16,
  },
  skeletonHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  skeletonHeaderTitle: {
    height: 24,
    width: '50%',
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  skeletonDetailContent: {
    padding: 16,
    gap: 12,
  },
  skeletonDetailRow: {
    height: 16,
    width: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
});
