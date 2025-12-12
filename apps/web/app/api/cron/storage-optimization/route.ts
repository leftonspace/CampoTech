/**
 * Storage Optimization Cron Job
 * =============================
 *
 * POST /api/cron/storage-optimization
 *
 * Runs storage optimization tasks:
 * - Photo compression
 * - Orphaned file cleanup
 * - Voice message cleanup
 * - Storage usage recalculation
 *
 * Should be triggered by a cron job (e.g., Vercel Cron, GitHub Actions)
 * Requires CRON_SECRET header for authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { storageOptimizer } from '@/lib/services/storage-optimizer';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

function validateCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    return true;
  }

  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <secret>" and just "<secret>"
  const token = authHeader.replace('Bearer ', '');
  return token === cronSecret;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // Validate cron authentication
  if (!validateCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get task parameter (optional - run all if not specified)
  const { searchParams } = new URL(request.url);
  const task = searchParams.get('task');

  const results: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    tasks: {},
  };

  try {
    // Run requested tasks or all if none specified
    const runAll = !task;

    // Task 1: Compress uncompressed photos
    if (runAll || task === 'compress') {
      console.log('Running photo compression...');
      const compressionResult = await storageOptimizer.compressUncompressedPhotos(100);
      results.tasks = {
        ...results.tasks as Record<string, unknown>,
        compression: {
          processedCount: compressionResult.processedCount,
          savedBytes: compressionResult.savedBytes,
          savedMB: (compressionResult.savedBytes / (1024 * 1024)).toFixed(2),
          failedCount: compressionResult.failedCount,
          errors: compressionResult.errors.slice(0, 5), // Limit errors in response
        },
      };
    }

    // Task 2: Cleanup orphaned files
    if (runAll || task === 'cleanup') {
      console.log('Running orphaned file cleanup...');
      const cleanupResult = await storageOptimizer.cleanupOrphanedFiles(30);
      results.tasks = {
        ...results.tasks as Record<string, unknown>,
        cleanup: {
          deletedCount: cleanupResult.deletedCount,
          freedBytes: cleanupResult.freedBytes,
          freedMB: (cleanupResult.freedBytes / (1024 * 1024)).toFixed(2),
          errors: cleanupResult.errors.slice(0, 5),
        },
      };
    }

    // Task 3: Cleanup transcribed voice messages
    if (runAll || task === 'voice') {
      console.log('Running voice message cleanup...');
      const voiceResult = await storageOptimizer.cleanupTranscribedVoiceMessages();
      results.tasks = {
        ...results.tasks as Record<string, unknown>,
        voiceCleanup: {
          deletedCount: voiceResult.deletedCount,
          freedBytes: voiceResult.freedBytes,
          freedMB: (voiceResult.freedBytes / (1024 * 1024)).toFixed(2),
          errors: voiceResult.errors.slice(0, 5),
        },
      };
    }

    // Task 4: Recalculate storage usage
    if (runAll || task === 'recalculate') {
      console.log('Running storage recalculation...');
      const storageResult = await storageOptimizer.recalculateStorageUsage();
      results.tasks = {
        ...results.tasks as Record<string, unknown>,
        storageRecalculation: {
          updatedOrgs: storageResult.updatedOrgs,
          totalStorageBytes: storageResult.totalStorageBytes,
          totalStorageMB: (storageResult.totalStorageBytes / (1024 * 1024)).toFixed(2),
        },
      };
    }

    const duration = Date.now() - startTime;
    results.completedAt = new Date().toISOString();
    results.durationMs = duration;
    results.success = true;

    console.log('Storage optimization completed:', {
      duration: `${duration}ms`,
      tasks: Object.keys(results.tasks as Record<string, unknown>),
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Storage optimization cron error:', error);

    const duration = Date.now() - startTime;
    return NextResponse.json(
      {
        ...results,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Status endpoint (for health checks)
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'storage-optimization',
    status: 'ready',
    availableTasks: ['compress', 'cleanup', 'voice', 'recalculate'],
    documentation: 'POST with authorization header to run tasks. Use ?task=<name> to run specific task.',
  });
}
