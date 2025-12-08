/**
 * Image Utilities
 * ===============
 *
 * Image compression, caching, and optimization utilities
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const IMAGE_CACHE_DIR = `${FileSystem.cacheDirectory}images/`;
const MAX_IMAGE_SIZE = 1920; // Max dimension in pixels
const JPEG_QUALITY = 0.8;
const THUMBNAIL_SIZE = 200;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPRESSION
// ═══════════════════════════════════════════════════════════════════════════════

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * Compress an image for upload
 */
export async function compressImage(
  uri: string,
  options: CompressOptions = {}
): Promise<{
  uri: string;
  width: number;
  height: number;
  size: number;
}> {
  const {
    maxWidth = MAX_IMAGE_SIZE,
    maxHeight = MAX_IMAGE_SIZE,
    quality = JPEG_QUALITY,
    format = 'jpeg',
  } = options;

  // Get original dimensions
  const originalInfo = await FileSystem.getInfoAsync(uri);

  // Calculate resize
  const actions: ImageManipulator.Action[] = [
    {
      resize: {
        width: maxWidth,
        height: maxHeight,
      },
    },
  ];

  // Compress
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: quality,
    format:
      format === 'jpeg'
        ? ImageManipulator.SaveFormat.JPEG
        : format === 'png'
        ? ImageManipulator.SaveFormat.PNG
        : ImageManipulator.SaveFormat.WEBP,
  });

  // Get final size
  const finalInfo = await FileSystem.getInfoAsync(result.uri);

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    size: (finalInfo as any).size || 0,
  };
}

/**
 * Create a thumbnail from an image
 */
export async function createThumbnail(
  uri: string,
  size: number = THUMBNAIL_SIZE
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: size, height: size } }],
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return result.uri;
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  uris: string[],
  options: CompressOptions = {}
): Promise<Array<{ uri: string; width: number; height: number; size: number }>> {
  return Promise.all(uris.map((uri) => compressImage(uri, options)));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize the image cache directory
 */
export async function initImageCache(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
  }
}

/**
 * Get cached image or download and cache it
 */
export async function getCachedImage(
  remoteUri: string,
  cacheKey?: string
): Promise<string> {
  // Generate cache key from URL if not provided
  const key = cacheKey || remoteUri.split('/').pop() || `img_${Date.now()}`;
  const localPath = `${IMAGE_CACHE_DIR}${key}`;

  // Check if cached
  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    return localPath;
  }

  // Download and cache
  await FileSystem.downloadAsync(remoteUri, localPath);
  return localPath;
}

/**
 * Clear the image cache
 */
export async function clearImageCache(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (dirInfo.exists) {
    await FileSystem.deleteAsync(IMAGE_CACHE_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
  }
}

/**
 * Get cache size in bytes
 */
export async function getImageCacheSize(): Promise<number> {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (!dirInfo.exists) {
    return 0;
  }

  const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIR);
  let totalSize = 0;

  for (const file of files) {
    const fileInfo = await FileSystem.getInfoAsync(`${IMAGE_CACHE_DIR}${file}`);
    totalSize += (fileInfo as any).size || 0;
  }

  return totalSize;
}

/**
 * Prune old cache files (older than maxAge in milliseconds)
 */
export async function pruneImageCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (!dirInfo.exists) {
    return 0;
  }

  const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIR);
  const now = Date.now();
  let deletedCount = 0;

  for (const file of files) {
    const filePath = `${IMAGE_CACHE_DIR}${file}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (fileInfo.exists && (fileInfo as any).modificationTime) {
      const age = now - (fileInfo as any).modificationTime * 1000;
      if (age > maxAge) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        deletedCount++;
      }
    }
  }

  return deletedCount;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get image file size
 */
export async function getImageSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return (info as any).size || 0;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Check if file is an image based on extension
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}
