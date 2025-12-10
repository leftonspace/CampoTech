/**
 * Bull Board Dashboard
 * ====================
 *
 * Web-based queue monitoring dashboard using Bull Board.
 * Provides real-time visibility into all BullMQ queues.
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { getRedis } from '../redis/redis-manager';

// =============================================================================
// TYPES
// =============================================================================

export interface DashboardConfig {
  /** Base path for the dashboard (default: /admin/queues) */
  basePath?: string;
  /** Enable read-only mode */
  readOnly?: boolean;
  /** Custom UI config */
  uiConfig?: {
    boardTitle?: string;
    boardLogo?: {
      path: string;
      width?: string | number;
      height?: string | number;
    };
    favIcon?: {
      default?: string;
      alternative?: string;
    };
  };
}

export interface QueueDefinition {
  name: string;
  displayName?: string;
  description?: string;
}

// =============================================================================
// QUEUE DEFINITIONS
// =============================================================================

/**
 * All queues to be displayed in the dashboard
 */
const QUEUE_DEFINITIONS: QueueDefinition[] = [
  // Core Business Queues
  {
    name: 'payment-webhook',
    displayName: 'Payment Webhooks',
    description: 'MercadoPago payment webhook processing',
  },
  {
    name: 'job-notification',
    displayName: 'Job Notifications',
    description: 'Job status notifications to customers and technicians',
  },
  {
    name: 'invoice-pdf',
    displayName: 'Invoice PDFs',
    description: 'PDF generation for invoices',
  },

  // Existing BullMQ Queues
  {
    name: 'voice-processing',
    displayName: 'Voice Processing',
    description: 'WhatsApp voice message transcription',
  },
  {
    name: 'reminder',
    displayName: 'Reminders',
    description: 'Scheduled job reminders',
  },

  // Queue Manager Queues
  {
    name: 'cae-queue',
    displayName: 'AFIP CAE',
    description: 'AFIP electronic invoice CAE requests',
  },
  {
    name: 'whatsapp-queue',
    displayName: 'WhatsApp Messages',
    description: 'WhatsApp message delivery queue',
  },
  {
    name: 'payment-queue',
    displayName: 'Payments',
    description: 'Payment processing queue',
  },
  {
    name: 'notification-queue',
    displayName: 'Notifications',
    description: 'General notification delivery queue',
  },
  {
    name: 'scheduled-queue',
    displayName: 'Scheduled Jobs',
    description: 'Cron-like scheduled tasks',
  },
  {
    name: 'dead-letter-queue',
    displayName: 'Dead Letter Queue',
    description: 'Failed jobs requiring manual intervention',
  },
];

// =============================================================================
// DASHBOARD
// =============================================================================

let serverAdapter: ExpressAdapter | null = null;
let bullBoard: ReturnType<typeof createBullBoard> | null = null;
const queues: Map<string, Queue> = new Map();

/**
 * Initialize the Bull Board dashboard
 */
export function initializeDashboard(config: DashboardConfig = {}): ExpressAdapter {
  const basePath = config.basePath || '/admin/queues';

  // Create Express adapter
  serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  // Create queue instances
  const connection = getRedis();
  const adapters: BullMQAdapter[] = [];

  for (const def of QUEUE_DEFINITIONS) {
    const queue = new Queue(def.name, {
      connection,
    });

    queues.set(def.name, queue);
    adapters.push(new BullMQAdapter(queue));
  }

  // Create Bull Board
  bullBoard = createBullBoard({
    queues: adapters,
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: config.uiConfig?.boardTitle || 'CampoTech Queue Dashboard',
        boardLogo: config.uiConfig?.boardLogo || {
          path: '/logo.svg',
          width: 150,
        },
        favIcon: config.uiConfig?.favIcon,
      },
    },
  });

  console.log(`[Bull Board] Dashboard initialized at ${basePath}`);

  return serverAdapter;
}

/**
 * Get the server adapter for mounting
 */
export function getDashboardAdapter(): ExpressAdapter | null {
  return serverAdapter;
}

/**
 * Get the Bull Board instance
 */
export function getBullBoard(): ReturnType<typeof createBullBoard> | null {
  return bullBoard;
}

/**
 * Add a new queue to the dashboard dynamically
 */
export function addQueueToDashboard(queue: Queue): void {
  if (!bullBoard) {
    throw new Error('Dashboard not initialized');
  }

  queues.set(queue.name, queue);
  bullBoard.addQueue(new BullMQAdapter(queue));
  console.log(`[Bull Board] Added queue: ${queue.name}`);
}

/**
 * Remove a queue from the dashboard
 */
export function removeQueueFromDashboard(queueName: string): void {
  if (!bullBoard) {
    throw new Error('Dashboard not initialized');
  }

  const queue = queues.get(queueName);
  if (queue) {
    bullBoard.removeQueue(new BullMQAdapter(queue));
    queues.delete(queueName);
    console.log(`[Bull Board] Removed queue: ${queueName}`);
  }
}

/**
 * Get all dashboard queue stats
 */
export async function getDashboardStats(): Promise<Map<string, {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}>> {
  const stats = new Map();

  for (const [name, queue] of queues) {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    stats.set(name, {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    });
  }

  return stats;
}

/**
 * Get queue by name
 */
export function getDashboardQueue(name: string): Queue | undefined {
  return queues.get(name);
}

/**
 * Shutdown the dashboard
 */
export async function shutdownDashboard(): Promise<void> {
  for (const queue of queues.values()) {
    await queue.close();
  }
  queues.clear();
  serverAdapter = null;
  bullBoard = null;
  console.log('[Bull Board] Dashboard shutdown complete');
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Create dashboard middleware for Express/Next.js API routes
 */
export function createDashboardMiddleware(config: DashboardConfig = {}) {
  const adapter = initializeDashboard(config);

  return {
    adapter,
    router: adapter.getRouter(),
  };
}

// =============================================================================
// AUTH MIDDLEWARE
// =============================================================================

/**
 * Create authentication middleware for the dashboard
 *
 * @example
 * // In Express
 * app.use('/admin/queues', authMiddleware, dashboardRouter);
 *
 * // In Next.js API route
 * const { authMiddleware } = createDashboardAuth(['owner', 'admin']);
 */
export function createDashboardAuth(allowedRoles: string[] = ['owner', 'admin']) {
  return async (req: any, res: any, next: () => void) => {
    // Check if user is authenticated
    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has required role
    const userRole = user.role || user.organizationRole;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden - insufficient permissions' });
    }

    next();
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  QUEUE_DEFINITIONS,
};
