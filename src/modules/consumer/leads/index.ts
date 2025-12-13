/**
 * Leads Dashboard Module
 * ======================
 *
 * Exports for business leads dashboard.
 * Phase 15: Consumer Marketplace
 */

export { LeadsDashboardService } from './leads-dashboard.service';
export type {
  Lead,
  QuoteInfo,
  LeadStats,
  LeadFilterParams,
  QuoteSubmission,
} from './leads-dashboard.service';

export { createLeadsDashboardRoutes } from './leads-dashboard.routes';
