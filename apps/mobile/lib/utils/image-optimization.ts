/**
 * Image Optimization Utilities
 * ============================
 *
 * Phase 2.6.1: Device Compatibility
 * Optimizes images for older devices with limited memory
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { PERFORMANCE_CONFIG, createLimitedCache } from './performance';

interface ImageDimensions {
  width: number;
  height: number;
}

interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
}

// Memory-limited cache for processed images
const imageCache = createLimitedCache<string, OptimizedImage>(
  PERFORMANCE_CONFIG.memory.imagePoolSize
);

/**
 * Calculate dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): ImageDimensions {
  const aspectRatio = originalWidth / originalHeight;

  let newWidth = originalWidth;
  let newHeight = originalHeight;

  if (newWidth > maxWidth) {
    newWidth = maxWidth;
    newHeight = newWidth / aspectRatio;
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = newHeight * aspectRatio;
  }

  return {
    width: Math.round(newWidth),
    height: Math.round(newHeight),
  };
}

/**
 * Compress and resize image for upload
 * Optimized for older devices with limited memory
 */
export async function optimizeImageForUpload(
  uri: string,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }
): Promise<OptimizedImage> {
  const {
    maxWidth = PERFORMANCE_CONFIG.fullImageSize.width,
    maxHeight = PERFORMANCE_CONFIG.fullImageSize.height,
    quality = PERFORMANCE_CONFIG.imageQuality,
  } = options || {};

  // Check cache first
  const cacheKey = `${uri}-${maxWidth}-${maxHeight}-${quality}`;
  const cached = imageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Get original image info
    const imageInfo = await FileSystem.getInfoAsync(uri);

    // Process image with resizing and compression
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: maxWidth,
            height: maxHeight,
          },
        },
      ],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const optimizedImage: OptimizedImage = {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };

    // Get file size of optimized image
    const optimizedInfo = await FileSystem.getInfoAsync(result.uri);
    if (optimizedInfo.exists && 'size' in optimizedInfo) {
      optimizedImage.fileSize = optimizedInfo.size;
    }

    // Cache the result
    imageCache.set(cacheKey, optimizedImage);

    return optimizedImage;
  } catch (error) {
    console.error('Image optimization failed:', error);
    // Return original if optimization fails
    return { uri, width: 0, height: 0 };
  }
}

/**
 * Create a thumbnail from an image
 * Uses aggressive compression for list views
 */
export async function createThumbnail(uri: string): Promise<OptimizedImage> {
  const cacheKey = `thumb-${uri}`;
  const cached = imageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: PERFORMANCE_CONFIG.thumbnailSize.width,
            height: PERFORMANCE_CONFIG.thumbnailSize.height,
          },
        },
      ],
      {
        compress: 0.5, // Aggressive compression for thumbnails
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const thumbnail: OptimizedImage = {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };

    imageCache.set(cacheKey, thumbnail);
    return thumbnail;
  } catch (error) {
    console.error('Thumbnail creation failed:', error);
    return { uri, width: 0, height: 0 };
  }
}

/**
 * Prepare multiple images for batch upload
 * Processes in sequence to avoid memory issues on low-end devices
 */
export async function optimizeImagesForUpload(
  uris: string[],
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<OptimizedImage[]> {
  const results: OptimizedImage[] = [];
  const { onProgress } = options || {};

  for (let i = 0; i < uris.length; i++) {
    const optimized = await optimizeImageForUpload(uris[i], options);
    results.push(optimized);

    if (onProgress) {
      onProgress(i + 1, uris.length);
    }
  }

  return results;
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Check if image needs optimization based on file size
 */
export async function shouldOptimize(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || !('size' in info)) {
      return false;
    }

    // Optimize if larger than 500KB
    const maxSizeBytes = 500 * 1024;
    return info.size > maxSizeBytes;
  } catch {
    return false;
  }
}

/**
 * Clean up cached images to free memory
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * Get image dimensions without loading full image
 */
export async function getImageDimensions(
  uri: string
): Promise<ImageDimensions | null> {
  try {
    // Use manipulator with no-op to get dimensions
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { width: result.width, height: result.height };
  } catch {
    return null;
  }
}

/**
 * Platform-specific image format
 */
export function getOptimalImageFormat(): ImageManipulator.SaveFormat {
  // Use JPEG for better compatibility on older devices
  return ImageManipulator.SaveFormat.JPEG;
}
