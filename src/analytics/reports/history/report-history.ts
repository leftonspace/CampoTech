/**
 * Report Execution History
 * ========================
 *
 * Phase 10.3: Report Generation Engine
 * Tracks report generation history and execution status.
 */

import { log } from '../../../lib/logging/logger';
import { getRedis } from '../../../lib/redis/redis-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReportExecution {
  id: string;
  scheduledReportId: string;
  organizationId: string;
  templateId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  format: string;
  fileSize?: number;
  generationTimeMs?: number;
  error?: string;
  recipientResults?: {
    recipient: { type: string; destination: string };
    success: boolean;
    error?: string;
  }[];
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface SaveReportExecutionInput {
  scheduledReportId: string;
  organizationId: string;
  templateId: string;
  status: ReportExecution['status'];
  format: string;
}

export interface ReportHistoryQuery {
  organizationId?: string;
  scheduledReportId?: string;
  templateId?: string;
  status?: ReportExecution['status'];
  limit?: number;
  offset?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS KEYS
// ═══════════════════════════════════════════════════════════════════════════════

const REDIS_KEYS = {
  execution: (id: string) => `report:execution:${id}`,
  orgExecutions: (orgId: string) => `report:org_executions:${orgId}`,
  scheduledReportExecutions: (reportId: string) => `report:scheduled_executions:${reportId}`,
  allExecutions: 'report:executions:all',
  recentExecutions: 'report:executions:recent',
};

const TTL_DAYS = 30;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

function generateExecutionId(): string {
  return `ex_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function saveReportExecution(input: SaveReportExecutionInput): Promise<ReportExecution> {
  const redis = getRedis();
  const now = new Date();

  const execution: ReportExecution = {
    id: generateExecutionId(),
    scheduledReportId: input.scheduledReportId,
    organizationId: input.organizationId,
    templateId: input.templateId,
    status: input.status,
    format: input.format,
    startedAt: now.toISOString(),
    createdAt: now.toISOString(),
  };

  const pipeline = redis.pipeline();
  pipeline.set(REDIS_KEYS.execution(execution.id), JSON.stringify(execution), 'EX', TTL_SECONDS);
  pipeline.zadd(REDIS_KEYS.orgExecutions(input.organizationId), now.getTime(), execution.id);
  pipeline.zadd(REDIS_KEYS.scheduledReportExecutions(input.scheduledReportId), now.getTime(), execution.id);
  pipeline.zadd(REDIS_KEYS.allExecutions, now.getTime(), execution.id);
  pipeline.lpush(REDIS_KEYS.recentExecutions, execution.id);
  pipeline.ltrim(REDIS_KEYS.recentExecutions, 0, 999);
  await pipeline.exec();

  log.info('Report execution saved', { executionId: execution.id, status: execution.status });

  return execution;
}

export async function updateExecutionStatus(
  executionId: string,
  status: ReportExecution['status'],
  details?: {
    generationTimeMs?: number;
    fileSize?: number;
    error?: string;
    recipientResults?: ReportExecution['recipientResults'];
  }
): Promise<ReportExecution | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.execution(executionId));

  if (!data) return null;

  const execution: ReportExecution = JSON.parse(data);
  execution.status = status;

  if (details) {
    if (details.generationTimeMs !== undefined) execution.generationTimeMs = details.generationTimeMs;
    if (details.fileSize !== undefined) execution.fileSize = details.fileSize;
    if (details.error !== undefined) execution.error = details.error;
    if (details.recipientResults !== undefined) execution.recipientResults = details.recipientResults;
  }

  if (status === 'completed' || status === 'failed' || status === 'partial') {
    execution.completedAt = new Date().toISOString();
  }

  await redis.set(REDIS_KEYS.execution(executionId), JSON.stringify(execution), 'EX', TTL_SECONDS);

  log.info('Report execution updated', { executionId, status });

  return execution;
}

export async function getReportExecution(executionId: string): Promise<ReportExecution | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.execution(executionId));
  return data ? JSON.parse(data) : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function getReportHistory(query: ReportHistoryQuery = {}): Promise<ReportExecution[]> {
  const redis = getRedis();
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  let executionIds: string[];

  if (query.scheduledReportId) {
    executionIds = await redis.zrevrange(
      REDIS_KEYS.scheduledReportExecutions(query.scheduledReportId),
      offset,
      offset + limit - 1
    );
  } else if (query.organizationId) {
    executionIds = await redis.zrevrange(
      REDIS_KEYS.orgExecutions(query.organizationId),
      offset,
      offset + limit - 1
    );
  } else {
    executionIds = await redis.zrevrange(REDIS_KEYS.allExecutions, offset, offset + limit - 1);
  }

  if (executionIds.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const id of executionIds) {
    pipeline.get(REDIS_KEYS.execution(id));
  }
  const results = await pipeline.exec();

  const executions: ReportExecution[] = [];

  for (const [err, data] of results || []) {
    if (!err && data) {
      const execution: ReportExecution = JSON.parse(data as string);

      if (query.status && execution.status !== query.status) continue;
      if (query.templateId && execution.templateId !== query.templateId) continue;

      executions.push(execution);
    }
  }

  return executions;
}

export async function getLatestExecution(scheduledReportId: string): Promise<ReportExecution | null> {
  const redis = getRedis();
  const executionIds = await redis.zrevrange(
    REDIS_KEYS.scheduledReportExecutions(scheduledReportId),
    0,
    0
  );

  if (executionIds.length === 0) return null;

  return getReportExecution(executionIds[0]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExecutionStats {
  total: number;
  completed: number;
  failed: number;
  partial: number;
  avgGenerationTimeMs: number;
  successRate: number;
}

export async function getExecutionStats(
  organizationId?: string,
  days: number = 30
): Promise<ExecutionStats> {
  const executions = await getReportHistory({
    organizationId,
    limit: 1000,
  });

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentExecutions = executions.filter(
    (e) => new Date(e.createdAt).getTime() >= cutoff
  );

  const completed = recentExecutions.filter((e) => e.status === 'completed').length;
  const failed = recentExecutions.filter((e) => e.status === 'failed').length;
  const partial = recentExecutions.filter((e) => e.status === 'partial').length;

  const generationTimes = recentExecutions
    .filter((e) => e.generationTimeMs)
    .map((e) => e.generationTimeMs!);

  const avgGenerationTimeMs =
    generationTimes.length > 0
      ? generationTimes.reduce((a, b) => a + b, 0) / generationTimes.length
      : 0;

  const total = recentExecutions.length;
  const successRate = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    failed,
    partial,
    avgGenerationTimeMs: Math.round(avgGenerationTimeMs),
    successRate: Math.round(successRate * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

export async function cleanupOldExecutions(maxAgeDays: number = 30): Promise<number> {
  const redis = getRedis();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  const oldExecutionIds = await redis.zrangebyscore(REDIS_KEYS.allExecutions, '-inf', cutoff);

  if (oldExecutionIds.length === 0) return 0;

  const pipeline = redis.pipeline();

  for (const id of oldExecutionIds) {
    pipeline.del(REDIS_KEYS.execution(id));
    pipeline.zrem(REDIS_KEYS.allExecutions, id);
  }

  await pipeline.exec();

  log.info('Old executions cleaned up', { count: oldExecutionIds.length, maxAgeDays });

  return oldExecutionIds.length;
}

export async function cleanupOldReportHistory(): Promise<void> {
  await cleanupOldExecutions(TTL_DAYS);
}
