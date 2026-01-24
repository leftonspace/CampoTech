/**
 * Performance Monitoring
 * ======================
 *
 * Tools for monitoring and debugging app performance
 */

import { InteractionManager } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════════
// TIMING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

const marks = new Map<string, PerformanceMark>();
const measures: PerformanceMark[] = [];

/**
 * Start measuring a performance mark
 */
export function perfMark(name: string): void {
  marks.set(name, {
    name,
    startTime: performance.now(),
  });
}

/**
 * End a performance mark and record the measurement
 */
export function perfMeasure(name: string): number | null {
  const mark = marks.get(name);
  if (!mark) {
    console.warn(`Performance mark "${name}" not found`);
    return null;
  }

  const endTime = performance.now();
  const duration = endTime - mark.startTime;

  const measurement: PerformanceMark = {
    ...mark,
    endTime,
    duration,
  };

  measures.push(measurement);
  marks.delete(name);

  if (__DEV__) {
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
  }

  return duration;
}

/**
 * Measure a function execution time
 */
export async function perfAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  perfMark(name);
  try {
    const result = await fn();
    perfMeasure(name);
    return result;
  } catch (error) {
    perfMeasure(name);
    throw error;
  }
}

/**
 * Measure a synchronous function execution time
 */
export function perfSync<T>(name: string, fn: () => T): T {
  perfMark(name);
  try {
    const result = fn();
    perfMeasure(name);
    return result;
  } catch (error) {
    perfMeasure(name);
    throw error;
  }
}

/**
 * Get all recorded measurements
 */
export function getPerformanceMeasures(): PerformanceMark[] {
  return [...measures];
}

/**
 * Clear all measurements
 */
export function clearPerformanceMeasures(): void {
  measures.length = 0;
  marks.clear();
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTION MANAGER UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run a function after interactions complete (for smooth animations)
 */
export function runAfterInteractions<T>(fn: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Defer heavy operations to prevent blocking the UI thread
 */
export function deferOperation<T>(
  fn: () => T,
  delay: number = 0
): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        const result = fn();
        resolve(result);
      });
    }, delay);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
}

/**
 * Get memory usage info (if available)
 * Note: This is limited in React Native, but provides what's available
 */
export function getMemoryInfo(): MemoryInfo | null {
  // @ts-ignore - performance.memory is non-standard
  const memory = (performance as any).memory;

  if (!memory) {
    return null;
  }

  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

const renderCounts = new Map<string, number>();

/**
 * Track component render count (for debugging)
 */
export function trackRender(componentName: string): number {
  const count = (renderCounts.get(componentName) || 0) + 1;
  renderCounts.set(componentName, count);

  if (__DEV__ && count > 10) {
    console.warn(`[PERF] ${componentName} has rendered ${count} times`);
  }

  return count;
}

/**
 * Reset render counts
 */
export function resetRenderCounts(): void {
  renderCounts.clear();
}

/**
 * Get all render counts
 */
export function getRenderCounts(): Map<string, number> {
  return new Map(renderCounts);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCHING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Batch multiple operations together
 */
export function batchOperations<T>(
  operations: Array<() => T>,
  batchSize: number = 10
): Promise<T[]> {
  return new Promise((resolve) => {
    const results: T[] = [];
    let index = 0;

    function processBatch() {
      const batch = operations.slice(index, index + batchSize);
      batch.forEach((op) => results.push(op()));
      index += batchSize;

      if (index < operations.length) {
        requestAnimationFrame(processBatch);
      } else {
        resolve(results);
      }
    }

    requestAnimationFrame(processBatch);
  });
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): T {
  let lastCall = 0;
  let lastResult: ReturnType<T>;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      lastResult = fn(...args) as ReturnType<T>;
    }
    return lastResult;
  }) as T;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;

  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP TIMING
// ═══════════════════════════════════════════════════════════════════════════════

let appStartTime: number | null = null;
let interactiveTime: number | null = null;

/**
 * Mark app start time
 */
export function markAppStart(): void {
  appStartTime = performance.now();
}

/**
 * Mark time to interactive
 */
export function markTimeToInteractive(): void {
  if (appStartTime !== null) {
    interactiveTime = performance.now() - appStartTime;
    if (__DEV__) {
      console.log(`[PERF] Time to Interactive: ${interactiveTime.toFixed(2)}ms`);
    }
  }
}

/**
 * Get startup metrics
 */
export function getStartupMetrics(): {
  timeToInteractive: number | null;
  appStartTime: number | null;
} {
  return {
    timeToInteractive: interactiveTime,
    appStartTime,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPMENT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log performance summary (development only)
 */
export function logPerformanceSummary(): void {
  if (!__DEV__) return;

  console.log('=== Performance Summary ===');

  // Startup metrics
  const startup = getStartupMetrics();
  if (startup.timeToInteractive) {
    console.log(`Time to Interactive: ${startup.timeToInteractive.toFixed(2)}ms`);
  }

  // Top measurements
  const topMeasures = measures
    .sort((a, b) => (b.duration || 0) - (a.duration || 0))
    .slice(0, 10);

  console.log('Top 10 Operations:');
  topMeasures.forEach((m) => {
    console.log(`  ${m.name}: ${m.duration?.toFixed(2)}ms`);
  });

  // Render counts
  const topRenders = [...renderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('Top 10 Re-renders:');
  topRenders.forEach(([name, count]) => {
    console.log(`  ${name}: ${count} renders`);
  });

  console.log('===========================');
}
