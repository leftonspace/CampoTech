/**
 * Cron Jobs for Report Scheduling
 * ================================
 *
 * Phase 10.3: Report Generation Engine
 * Background job scheduling for automated report generation.
 */

import { log } from '../../../lib/logging/logger';
import { processScheduledReports } from '../scheduler/report-scheduler';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CronJob {
  id: string;
  name: string;
  expression: string;
  handler: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  errorCount: number;
}

export interface CronJobResult {
  jobId: string;
  success: boolean;
  duration: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

const jobRegistry: Map<string, CronJob> = new Map();
let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export const CRON_JOBS = {
  PROCESS_SCHEDULED_REPORTS: 'process_scheduled_reports',
  RUN_AGGREGATION_JOBS: 'run_aggregation_jobs',
  CLEANUP_REPORT_HISTORY: 'cleanup_report_history',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRON EXPRESSION PARSER
// ═══════════════════════════════════════════════════════════════════════════════

interface CronFields {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseField(field: string, min: number, max: number): number[] {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = parseInt(step, 10);
    const values: number[] = [];
    const start = range === '*' ? min : parseInt(range, 10);
    for (let i = start; i <= max; i += stepNum) {
      values.push(i);
    }
    return values;
  }

  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  if (field.includes(',')) {
    return field.split(',').map(Number);
  }

  return [parseInt(field, 10)];
}

function parseCronExpression(expression: string): CronFields | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  try {
    return {
      minute: parseField(parts[0], 0, 59),
      hour: parseField(parts[1], 0, 23),
      dayOfMonth: parseField(parts[2], 1, 31),
      month: parseField(parts[3], 1, 12),
      dayOfWeek: parseField(parts[4], 0, 6),
    };
  } catch {
    return null;
  }
}

export function isValidCronExpression(expression: string): boolean {
  return parseCronExpression(expression) !== null;
}

export function calculateNextRun(expression: string, from: Date = new Date()): Date | null {
  const fields = parseCronExpression(expression);
  if (!fields) return null;

  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (
      fields.minute.includes(next.getMinutes()) &&
      fields.hour.includes(next.getHours()) &&
      fields.dayOfMonth.includes(next.getDate()) &&
      fields.month.includes(next.getMonth() + 1) &&
      fields.dayOfWeek.includes(next.getDay())
    ) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  return null;
}

export function getCronDescription(expression: string): string {
  const descriptions: Record<string, string> = {
    '* * * * *': 'Cada minuto',
    '*/5 * * * *': 'Cada 5 minutos',
    '*/15 * * * *': 'Cada 15 minutos',
    '0 * * * *': 'Cada hora',
    '0 0 * * *': 'Diario a medianoche',
    '0 8 * * *': 'Diario a las 8:00',
    '0 0 * * 0': 'Semanal (domingos)',
    '0 0 * * 1': 'Semanal (lunes)',
    '0 0 1 * *': 'Mensual (día 1)',
  };

  return descriptions[expression] || `Expresión cron: ${expression}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export function registerCronJob(
  id: string,
  name: string,
  expression: string,
  handler: () => Promise<void>,
  enabled: boolean = true
): void {
  const nextRun = calculateNextRun(expression);

  jobRegistry.set(id, {
    id,
    name,
    expression,
    handler,
    enabled,
    nextRun: nextRun || undefined,
    runCount: 0,
    errorCount: 0,
  });

  log.info('Cron job registered', { id, name, expression, nextRun });
}

export function setJobEnabled(jobId: string, enabled: boolean): boolean {
  const job = jobRegistry.get(jobId);
  if (!job) return false;

  job.enabled = enabled;
  if (enabled) {
    job.nextRun = calculateNextRun(job.expression) || undefined;
  }

  log.info('Cron job status changed', { jobId, enabled });
  return true;
}

export function getRegisteredJobs(): CronJob[] {
  return Array.from(jobRegistry.values());
}

export function getJobStatus(jobId: string): CronJob | null {
  return jobRegistry.get(jobId) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function executeJob(job: CronJob): Promise<CronJobResult> {
  const startTime = Date.now();

  log.info('Executing cron job', { jobId: job.id, name: job.name });

  try {
    await job.handler();

    job.lastRun = new Date();
    job.nextRun = calculateNextRun(job.expression) || undefined;
    job.runCount++;

    const duration = Date.now() - startTime;
    log.info('Cron job completed', { jobId: job.id, duration });

    return { jobId: job.id, success: true, duration };
  } catch (error) {
    job.errorCount++;

    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error('Cron job failed', { jobId: job.id, error: errorMessage, duration });

    return { jobId: job.id, success: false, duration, error: errorMessage };
  }
}

export async function runJob(jobId: string): Promise<CronJobResult | null> {
  const job = jobRegistry.get(jobId);
  if (!job) return null;

  return executeJob(job);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════════

async function checkAndRunJobs(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  const now = new Date();

  for (const job of jobRegistry.values()) {
    if (!job.enabled || !job.nextRun) continue;

    if (job.nextRun <= now) {
      await executeJob(job);
    }
  }

  isRunning = false;
}

export function startCronScheduler(intervalMs: number = 60000): void {
  if (schedulerInterval) {
    log.warn('Cron scheduler already running');
    return;
  }

  schedulerInterval = setInterval(checkAndRunJobs, intervalMs);
  log.info('Cron scheduler started', { intervalMs });

  checkAndRunJobs();
}

export function stopCronScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log.info('Cron scheduler stopped');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT JOBS
// ═══════════════════════════════════════════════════════════════════════════════

export function initializeCronJobs(): void {
  registerCronJob(
    CRON_JOBS.PROCESS_SCHEDULED_REPORTS,
    'Procesar informes programados',
    '* * * * *',
    processScheduledReports,
    true
  );

  registerCronJob(
    CRON_JOBS.CLEANUP_REPORT_HISTORY,
    'Limpiar historial de informes',
    '0 2 * * *',
    async () => {
      log.info('Running report history cleanup');
    },
    true
  );

  log.info('Default cron jobs initialized');
}
