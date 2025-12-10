/**
 * Marketplace Analytics Service
 * =============================
 *
 * Analytics and reporting for consumer marketplace.
 * Phase 15: Consumer Marketplace
 */

import { Pool } from 'pg';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketplaceDashboard {
  overview: OverviewMetrics;
  trends: TrendData[];
  topCategories: CategoryMetric[];
  topCities: CityMetric[];
  conversionFunnel: FunnelStep[];
  recentActivity: ActivityItem[];
}

export interface OverviewMetrics {
  totalConsumers: number;
  totalBusinesses: number;
  totalRequests: number;
  totalCompletedJobs: number;
  totalQuotes: number;
  avgRating: number;
  conversionRate: number;
  avgResponseTimeHours: number;
  periodComparison: {
    consumersChange: number;
    requestsChange: number;
    completedChange: number;
    conversionChange: number;
  };
}

export interface TrendData {
  date: string;
  consumers: number;
  requests: number;
  quotes: number;
  completedJobs: number;
}

export interface CategoryMetric {
  category: string;
  categoryName: string;
  requestCount: number;
  quoteCount: number;
  completedJobs: number;
  avgRating: number;
  conversionRate: number;
}

export interface CityMetric {
  city: string;
  requestCount: number;
  businessCount: number;
  avgRating: number;
  completedJobs: number;
}

export interface FunnelStep {
  step: string;
  label: string;
  count: number;
  percentage: number;
  dropOff: number;
}

export interface ActivityItem {
  type: 'signup' | 'request' | 'quote' | 'job_completed' | 'review';
  description: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface CohortAnalysis {
  cohorts: Cohort[];
  retentionMatrix: number[][];
}

export interface Cohort {
  period: string;
  size: number;
  retention: number[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class MarketplaceAnalyticsService {
  constructor(private pool: Pool) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get complete marketplace dashboard
   */
  async getDashboard(range: DateRange): Promise<MarketplaceDashboard> {
    const [overview, trends, topCategories, topCities, conversionFunnel, recentActivity] =
      await Promise.all([
        this.getOverviewMetrics(range),
        this.getTrends(range),
        this.getTopCategories(range),
        this.getTopCities(range),
        this.getConversionFunnel(range),
        this.getRecentActivity(),
      ]);

    return {
      overview,
      trends,
      topCategories,
      topCities,
      conversionFunnel,
      recentActivity,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OVERVIEW METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get overview metrics with period comparison
   */
  async getOverviewMetrics(range: DateRange): Promise<OverviewMetrics> {
    // Calculate previous period for comparison
    const periodLength = range.end.getTime() - range.start.getTime();
    const previousStart = new Date(range.start.getTime() - periodLength);
    const previousEnd = range.start;

    const [current, previous] = await Promise.all([
      this.getMetricsForPeriod(range.start, range.end),
      this.getMetricsForPeriod(previousStart, previousEnd),
    ]);

    return {
      totalConsumers: current.consumers,
      totalBusinesses: current.businesses,
      totalRequests: current.requests,
      totalCompletedJobs: current.completed,
      totalQuotes: current.quotes,
      avgRating: current.avgRating,
      conversionRate: current.conversionRate,
      avgResponseTimeHours: current.avgResponseTime,
      periodComparison: {
        consumersChange: this.calculateChange(previous.consumers, current.consumers),
        requestsChange: this.calculateChange(previous.requests, current.requests),
        completedChange: this.calculateChange(previous.completed, current.completed),
        conversionChange: this.calculateChange(
          previous.conversionRate,
          current.conversionRate
        ),
      },
    };
  }

  private async getMetricsForPeriod(
    start: Date,
    end: Date
  ): Promise<{
    consumers: number;
    businesses: number;
    requests: number;
    completed: number;
    quotes: number;
    avgRating: number;
    conversionRate: number;
    avgResponseTime: number;
  }> {
    const result = await this.pool.query<{
      consumers: string;
      businesses: string;
      requests: string;
      completed: string;
      quotes: string;
      avg_rating: string | null;
      avg_response_hours: string | null;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM consumer.consumer_profiles WHERE created_at BETWEEN $1 AND $2) as consumers,
        (SELECT COUNT(*) FROM consumer.business_public_profiles WHERE created_at BETWEEN $1 AND $2) as businesses,
        (SELECT COUNT(*) FROM consumer.service_requests WHERE created_at BETWEEN $1 AND $2) as requests,
        (SELECT COUNT(*) FROM consumer.service_requests WHERE status = 'completed' AND updated_at BETWEEN $1 AND $2) as completed,
        (SELECT COUNT(*) FROM consumer.quotes WHERE created_at BETWEEN $1 AND $2) as quotes,
        (SELECT AVG(overall_rating) FROM consumer.consumer_reviews WHERE created_at BETWEEN $1 AND $2) as avg_rating,
        (SELECT AVG(EXTRACT(EPOCH FROM (q.created_at - sr.created_at)) / 3600)
         FROM consumer.quotes q
         JOIN consumer.service_requests sr ON q.service_request_id = sr.id
         WHERE q.created_at BETWEEN $1 AND $2) as avg_response_hours`,
      [start, end]
    );

    const data = result.rows[0];
    const requests = parseInt(data.requests, 10);
    const completed = parseInt(data.completed, 10);

    return {
      consumers: parseInt(data.consumers, 10),
      businesses: parseInt(data.businesses, 10),
      requests,
      completed,
      quotes: parseInt(data.quotes, 10),
      avgRating: parseFloat(data.avg_rating || '0'),
      conversionRate: requests > 0 ? (completed / requests) * 100 : 0,
      avgResponseTime: parseFloat(data.avg_response_hours || '0'),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRENDS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get daily trends for the period
   */
  async getTrends(range: DateRange): Promise<TrendData[]> {
    const result = await this.pool.query<{
      date: Date;
      consumers: string;
      requests: string;
      quotes: string;
      completed: string;
    }>(
      `WITH dates AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as date
      )
      SELECT
        d.date,
        COALESCE((SELECT COUNT(*) FROM consumer.consumer_profiles WHERE created_at::date = d.date), 0) as consumers,
        COALESCE((SELECT COUNT(*) FROM consumer.service_requests WHERE created_at::date = d.date), 0) as requests,
        COALESCE((SELECT COUNT(*) FROM consumer.quotes WHERE created_at::date = d.date), 0) as quotes,
        COALESCE((SELECT COUNT(*) FROM consumer.service_requests WHERE status = 'completed' AND updated_at::date = d.date), 0) as completed
      FROM dates d
      ORDER BY d.date`,
      [range.start, range.end]
    );

    return result.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      consumers: parseInt(row.consumers, 10),
      requests: parseInt(row.requests, 10),
      quotes: parseInt(row.quotes, 10),
      completedJobs: parseInt(row.completed, 10),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TOP CATEGORIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get top performing categories
   */
  async getTopCategories(range: DateRange): Promise<CategoryMetric[]> {
    const result = await this.pool.query<{
      category: string;
      request_count: string;
      quote_count: string;
      completed_jobs: string;
      avg_rating: string | null;
    }>(
      `SELECT
        sr.category,
        COUNT(DISTINCT sr.id) as request_count,
        COUNT(DISTINCT q.id) as quote_count,
        COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_jobs,
        AVG(cr.overall_rating) as avg_rating
       FROM consumer.service_requests sr
       LEFT JOIN consumer.quotes q ON q.service_request_id = sr.id
       LEFT JOIN consumer.consumer_reviews cr ON cr.business_profile_id = q.business_profile_id
       WHERE sr.created_at BETWEEN $1 AND $2
       GROUP BY sr.category
       ORDER BY request_count DESC
       LIMIT 10`,
      [range.start, range.end]
    );

    return result.rows.map((row) => {
      const requests = parseInt(row.request_count, 10);
      const completed = parseInt(row.completed_jobs, 10);
      return {
        category: row.category,
        categoryName: this.getCategoryName(row.category),
        requestCount: requests,
        quoteCount: parseInt(row.quote_count, 10),
        completedJobs: completed,
        avgRating: parseFloat(row.avg_rating || '0'),
        conversionRate: requests > 0 ? (completed / requests) * 100 : 0,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TOP CITIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get top cities by activity
   */
  async getTopCities(range: DateRange): Promise<CityMetric[]> {
    const result = await this.pool.query<{
      city: string;
      request_count: string;
      business_count: string;
      avg_rating: string | null;
      completed_jobs: string;
    }>(
      `SELECT
        sr.city,
        COUNT(DISTINCT sr.id) as request_count,
        COUNT(DISTINCT bpp.business_profile_id) as business_count,
        AVG(bpp.overall_rating) as avg_rating,
        COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_jobs
       FROM consumer.service_requests sr
       LEFT JOIN consumer.business_public_profiles bpp ON sr.city = ANY(bpp.service_areas)
       WHERE sr.created_at BETWEEN $1 AND $2
       GROUP BY sr.city
       ORDER BY request_count DESC
       LIMIT 10`,
      [range.start, range.end]
    );

    return result.rows.map((row) => ({
      city: row.city,
      requestCount: parseInt(row.request_count, 10),
      businessCount: parseInt(row.business_count, 10),
      avgRating: parseFloat(row.avg_rating || '0'),
      completedJobs: parseInt(row.completed_jobs, 10),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSION FUNNEL
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get conversion funnel metrics
   */
  async getConversionFunnel(range: DateRange): Promise<FunnelStep[]> {
    const result = await this.pool.query<{
      visitors: string;
      signups: string;
      requests_created: string;
      received_quotes: string;
      accepted_quotes: string;
      completed_jobs: string;
      left_reviews: string;
    }>(
      `SELECT
        1000000 as visitors, -- Placeholder, would come from analytics service
        (SELECT COUNT(*) FROM consumer.consumer_profiles WHERE created_at BETWEEN $1 AND $2) as signups,
        (SELECT COUNT(*) FROM consumer.service_requests WHERE created_at BETWEEN $1 AND $2) as requests_created,
        (SELECT COUNT(DISTINCT service_request_id) FROM consumer.quotes WHERE created_at BETWEEN $1 AND $2) as received_quotes,
        (SELECT COUNT(*) FROM consumer.quotes WHERE status = 'accepted' AND created_at BETWEEN $1 AND $2) as accepted_quotes,
        (SELECT COUNT(*) FROM consumer.service_requests WHERE status = 'completed' AND updated_at BETWEEN $1 AND $2) as completed_jobs,
        (SELECT COUNT(*) FROM consumer.consumer_reviews WHERE created_at BETWEEN $1 AND $2) as left_reviews`,
      [range.start, range.end]
    );

    const data = result.rows[0];
    const steps = [
      { step: 'signup', label: 'Registros', count: parseInt(data.signups, 10) },
      { step: 'request', label: 'Solicitudes creadas', count: parseInt(data.requests_created, 10) },
      { step: 'quotes', label: 'Recibieron cotizaciones', count: parseInt(data.received_quotes, 10) },
      { step: 'accepted', label: 'Aceptaron cotización', count: parseInt(data.accepted_quotes, 10) },
      { step: 'completed', label: 'Trabajos completados', count: parseInt(data.completed_jobs, 10) },
      { step: 'review', label: 'Dejaron reseña', count: parseInt(data.left_reviews, 10) },
    ];

    const firstCount = steps[0].count || 1;

    return steps.map((step, index) => ({
      step: step.step,
      label: step.label,
      count: step.count,
      percentage: (step.count / firstCount) * 100,
      dropOff:
        index > 0 ? ((steps[index - 1].count - step.count) / steps[index - 1].count) * 100 : 0,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECENT ACTIVITY
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get recent activity feed
   */
  async getRecentActivity(): Promise<ActivityItem[]> {
    const activities: ActivityItem[] = [];

    // Get recent signups
    const signups = await this.pool.query<{
      display_name: string | null;
      created_at: Date;
    }>(
      `SELECT display_name, created_at
       FROM consumer.consumer_profiles
       ORDER BY created_at DESC
       LIMIT 5`
    );

    activities.push(
      ...signups.rows.map((row) => ({
        type: 'signup' as const,
        description: `Nuevo consumidor: ${row.display_name || 'Usuario'}`,
        timestamp: row.created_at,
        data: {},
      }))
    );

    // Get recent requests
    const requests = await this.pool.query<{
      title: string;
      category: string;
      city: string;
      created_at: Date;
    }>(
      `SELECT title, category, city, created_at
       FROM consumer.service_requests
       ORDER BY created_at DESC
       LIMIT 5`
    );

    activities.push(
      ...requests.rows.map((row) => ({
        type: 'request' as const,
        description: `Nueva solicitud: ${row.title} en ${row.city}`,
        timestamp: row.created_at,
        data: { category: row.category, city: row.city },
      }))
    );

    // Get recent completed jobs
    const completed = await this.pool.query<{
      title: string;
      updated_at: Date;
    }>(
      `SELECT title, updated_at
       FROM consumer.service_requests
       WHERE status = 'completed'
       ORDER BY updated_at DESC
       LIMIT 5`
    );

    activities.push(
      ...completed.rows.map((row) => ({
        type: 'job_completed' as const,
        description: `Trabajo completado: ${row.title}`,
        timestamp: row.updated_at,
        data: {},
      }))
    );

    // Sort by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, 20);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COHORT ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get consumer cohort analysis
   */
  async getCohortAnalysis(months: number = 6): Promise<CohortAnalysis> {
    const cohorts: Cohort[] = [];
    const retentionMatrix: number[][] = [];

    for (let i = months - 1; i >= 0; i--) {
      const cohortStart = new Date();
      cohortStart.setMonth(cohortStart.getMonth() - i);
      cohortStart.setDate(1);
      cohortStart.setHours(0, 0, 0, 0);

      const cohortEnd = new Date(cohortStart);
      cohortEnd.setMonth(cohortEnd.getMonth() + 1);

      // Get cohort size
      const sizeResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM consumer.consumer_profiles
         WHERE created_at >= $1 AND created_at < $2`,
        [cohortStart, cohortEnd]
      );

      const cohortSize = parseInt(sizeResult.rows[0].count, 10);
      const retention: number[] = [];

      // Calculate retention for each subsequent month
      for (let j = 0; j <= i; j++) {
        const periodStart = new Date(cohortStart);
        periodStart.setMonth(periodStart.getMonth() + j);

        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const activeResult = await this.pool.query<{ count: string }>(
          `SELECT COUNT(DISTINCT cp.id) as count
           FROM consumer.consumer_profiles cp
           WHERE cp.created_at >= $1 AND cp.created_at < $2
           AND EXISTS (
             SELECT 1 FROM consumer.service_requests sr
             WHERE sr.consumer_id = cp.id
             AND sr.created_at >= $3 AND sr.created_at < $4
           )`,
          [cohortStart, cohortEnd, periodStart, periodEnd]
        );

        const activeCount = parseInt(activeResult.rows[0].count, 10);
        retention.push(cohortSize > 0 ? (activeCount / cohortSize) * 100 : 0);
      }

      cohorts.push({
        period: cohortStart.toISOString().slice(0, 7), // YYYY-MM
        size: cohortSize,
        retention,
      });

      retentionMatrix.push(retention);
    }

    return { cohorts, retentionMatrix };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BUSINESS METRICS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get marketplace-wide business metrics
   */
  async getBusinessMetrics(range: DateRange): Promise<{
    avgQuotesPerRequest: number;
    avgTimeToFirstQuote: number;
    avgQuoteAcceptanceRate: number;
    topPerformingBusinesses: Array<{
      id: string;
      name: string;
      completedJobs: number;
      avgRating: number;
      responseTime: number;
    }>;
  }> {
    // Average quotes per request
    const quotesResult = await this.pool.query<{
      avg_quotes: string;
    }>(
      `SELECT AVG(quote_count)::numeric as avg_quotes
       FROM consumer.service_requests
       WHERE created_at BETWEEN $1 AND $2 AND quote_count > 0`,
      [range.start, range.end]
    );

    // Average time to first quote
    const timeResult = await this.pool.query<{
      avg_hours: string | null;
    }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (
         (SELECT MIN(q.created_at) FROM consumer.quotes q WHERE q.service_request_id = sr.id)
         - sr.created_at
       )) / 3600)::numeric as avg_hours
       FROM consumer.service_requests sr
       WHERE sr.created_at BETWEEN $1 AND $2
       AND EXISTS (SELECT 1 FROM consumer.quotes q WHERE q.service_request_id = sr.id)`,
      [range.start, range.end]
    );

    // Quote acceptance rate
    const acceptanceResult = await this.pool.query<{
      total: string;
      accepted: string;
    }>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted
       FROM consumer.quotes
       WHERE created_at BETWEEN $1 AND $2`,
      [range.start, range.end]
    );

    // Top performing businesses
    const topBusinesses = await this.pool.query<{
      id: string;
      name: string;
      completed_jobs: string;
      avg_rating: string | null;
      response_time: string | null;
    }>(
      `SELECT
        bp.id,
        bpp.display_name as name,
        COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) as completed_jobs,
        AVG(cr.overall_rating) as avg_rating,
        AVG(EXTRACT(EPOCH FROM (q.created_at - sr.created_at)) / 3600) as response_time
       FROM business_profiles bp
       JOIN consumer.business_public_profiles bpp ON bpp.business_profile_id = bp.id
       LEFT JOIN consumer.quotes q ON q.business_profile_id = bp.id
       LEFT JOIN consumer.service_requests sr ON sr.id = q.service_request_id
       LEFT JOIN consumer.consumer_reviews cr ON cr.business_profile_id = bp.id
       WHERE q.created_at BETWEEN $1 AND $2
       GROUP BY bp.id, bpp.display_name
       ORDER BY completed_jobs DESC
       LIMIT 10`,
      [range.start, range.end]
    );

    const total = parseInt(acceptanceResult.rows[0].total, 10);
    const accepted = parseInt(acceptanceResult.rows[0].accepted, 10);

    return {
      avgQuotesPerRequest: parseFloat(quotesResult.rows[0].avg_quotes || '0'),
      avgTimeToFirstQuote: parseFloat(timeResult.rows[0].avg_hours || '0'),
      avgQuoteAcceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
      topPerformingBusinesses: topBusinesses.rows.map((row) => ({
        id: row.id,
        name: row.name,
        completedJobs: parseInt(row.completed_jobs, 10),
        avgRating: parseFloat(row.avg_rating || '0'),
        responseTime: parseFloat(row.response_time || '0'),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private calculateChange(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private getCategoryName(slug: string): string {
    const categories: Record<string, string> = {
      plomeria: 'Plomería',
      electricidad: 'Electricidad',
      limpieza: 'Limpieza',
      pintura: 'Pintura',
      carpinteria: 'Carpintería',
      gasista: 'Gas',
      cerrajeria: 'Cerrajería',
      jardineria: 'Jardinería',
      mudanzas: 'Mudanzas',
      refrigeracion: 'Refrigeración',
      albanileria: 'Albañilería',
    };
    return categories[slug] || slug;
  }
}
