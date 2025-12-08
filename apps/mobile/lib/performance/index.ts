/**
 * Performance Module
 * ==================
 *
 * Performance optimization utilities and monitoring tools
 */

// Image utilities
export {
  compressImage,
  createThumbnail,
  compressImages,
  initImageCache,
  getCachedImage,
  clearImageCache,
  getImageCacheSize,
  pruneImageCache,
  getImageSize,
  formatBytes,
  isImageFile,
} from './image-utils';

// List utilities
export {
  flashListConfigs,
  createViewabilityConfig,
  useViewableItemsChanged,
  createKeyExtractor,
  createStableKeyExtractor,
  createGetItemLayout,
  usePagination,
  calculateWindowSize,
  useWindowedList,
  useScrollDebounce,
  useScrollPerformance,
} from './list-utils';

// Performance monitoring
export {
  perfMark,
  perfMeasure,
  perfAsync,
  perfSync,
  getPerformanceMeasures,
  clearPerformanceMeasures,
  runAfterInteractions,
  deferOperation,
  getMemoryInfo,
  trackRender,
  resetRenderCounts,
  getRenderCounts,
  batchOperations,
  throttle,
  debounce,
  markAppStart,
  markTimeToInteractive,
  getStartupMetrics,
  logPerformanceSummary,
} from './monitoring';
