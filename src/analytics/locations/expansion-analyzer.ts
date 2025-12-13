/**
 * Expansion Analyzer
 * ==================
 *
 * Phase 11.6: Location Analytics
 * Analysis tools for identifying expansion opportunities.
 */

import { db } from '../../lib/db';
import { DateRange } from '../analytics.types';
import { analyzeCoverage, generateServiceDensityMap, GeoCoordinate } from './geographic-analytics';
import { generateLocationComparisonReport } from './location-comparison';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExpansionOpportunity {
  id: string;
  type: 'new_location' | 'coverage_extension' | 'capacity_increase';
  priority: 'high' | 'medium' | 'low';
  location: {
    suggestedCoordinates?: GeoCoordinate;
    existingLocationId?: string;
    existingLocationName?: string;
  };
  metrics: {
    potentialRevenue: number;
    potentialCustomers: number;
    marketSize: number;
    competitionLevel: number; // 0-100
  };
  reasoning: string[];
  estimatedROI: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  timeToValue: string; // e.g., "3-6 months"
}

export interface ExpansionAnalysis {
  organizationId: string;
  analysisDate: Date;
  currentState: {
    totalLocations: number;
    totalRevenue: number;
    totalCustomers: number;
    avgLocationPerformance: number;
    marketCoverage: number; // percentage
  };
  opportunities: ExpansionOpportunity[];
  marketGrowthPotential: number;
  recommendedActions: ExpansionAction[];
  riskAssessment: RiskAssessment;
}

export interface ExpansionAction {
  priority: number;
  action: string;
  description: string;
  estimatedCost: string;
  expectedBenefit: string;
  timeline: string;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
}

export interface RiskFactor {
  name: string;
  level: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

export interface MarketPotential {
  regionId: string;
  regionName: string;
  coordinates: GeoCoordinate;
  metrics: {
    estimatedPopulation: number;
    estimatedBusinesses: number;
    currentPenetration: number;
    growthRate: number;
  };
  score: number;
}

export interface LocationSaturation {
  locationId: string;
  locationName: string;
  saturationLevel: number; // 0-100
  metrics: {
    capacityUtilization: number;
    coverageReach: number;
    customerDensity: number;
    growthTrend: number;
  };
  recommendation: 'expand' | 'maintain' | 'optimize' | 'consolidate';
  reasoning: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPANSION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Perform comprehensive expansion analysis
 */
export async function analyzeExpansionOpportunities(
  organizationId: string,
  dateRange: DateRange
): Promise<ExpansionAnalysis> {
  // Get current state
  const [comparisonReport, coverageAnalysis, saturationLevels] = await Promise.all([
    generateLocationComparisonReport(organizationId, dateRange),
    analyzeCoverage(organizationId, dateRange),
    calculateLocationSaturation(organizationId, dateRange),
  ]);

  // Calculate current state metrics
  const totalCustomers = await db.customer.count({
    where: { organizationId },
  });

  const currentState = {
    totalLocations: comparisonReport.organizationSummary.totalLocations,
    totalRevenue: comparisonReport.organizationSummary.totalRevenue,
    totalCustomers,
    avgLocationPerformance: comparisonReport.locations.length > 0
      ? comparisonReport.locations.reduce((sum, l) => sum + l.performanceScore, 0) / comparisonReport.locations.length
      : 0,
    marketCoverage: coverageAnalysis.totalCoverageArea > 0
      ? (coverageAnalysis.servicedArea / coverageAnalysis.totalCoverageArea) * 100
      : 0,
  };

  // Identify opportunities
  const opportunities: ExpansionOpportunity[] = [];

  // New location opportunities from coverage gaps
  for (const gap of coverageAnalysis.coverageGaps) {
    const potentialRevenue = estimatePotentialRevenue(gap.potentialCustomers, comparisonReport);

    opportunities.push({
      id: `new-loc-${gap.center.lat.toFixed(2)}-${gap.center.lng.toFixed(2)}`,
      type: 'new_location',
      priority: gap.potentialCustomers > 20 ? 'high' : gap.potentialCustomers > 10 ? 'medium' : 'low',
      location: {
        suggestedCoordinates: gap.center,
      },
      metrics: {
        potentialRevenue,
        potentialCustomers: gap.potentialCustomers,
        marketSize: gap.potentialCustomers * 10, // Estimate: actual customers * potential
        competitionLevel: 20, // Would need external data
      },
      reasoning: [
        `${gap.potentialCustomers} clientes existentes a más de ${gap.nearestLocation.distance.toFixed(1)}km de la sucursal más cercana`,
        `La sucursal más cercana (${gap.nearestLocation.name}) podría estar sobrecargada`,
        `Alta demanda detectada en el área`,
      ],
      estimatedROI: calculateEstimatedROI(potentialRevenue, 'new_location'),
      implementationComplexity: 'high',
      timeToValue: '6-12 meses',
    });
  }

  // Coverage extension opportunities from saturated locations
  for (const saturation of saturationLevels) {
    if (saturation.recommendation === 'expand') {
      const location = comparisonReport.locations.find((l) => l.locationId === saturation.locationId);
      if (location) {
        opportunities.push({
          id: `expand-${saturation.locationId}`,
          type: 'coverage_extension',
          priority: saturation.saturationLevel > 80 ? 'high' : 'medium',
          location: {
            existingLocationId: saturation.locationId,
            existingLocationName: saturation.locationName,
          },
          metrics: {
            potentialRevenue: location.revenue * 0.3, // 30% growth potential
            potentialCustomers: location.customersServed * 0.3,
            marketSize: location.customersServed * 5,
            competitionLevel: 30,
          },
          reasoning: [
            `Utilización de capacidad al ${saturation.metrics.capacityUtilization.toFixed(1)}%`,
            `Tendencia de crecimiento positiva: ${saturation.metrics.growthTrend.toFixed(1)}%`,
            saturation.reasoning,
          ],
          estimatedROI: calculateEstimatedROI(location.revenue * 0.3, 'coverage_extension'),
          implementationComplexity: 'medium',
          timeToValue: '3-6 meses',
        });
      }
    }
  }

  // Capacity increase opportunities
  for (const saturation of saturationLevels) {
    if (saturation.metrics.capacityUtilization > 85) {
      const location = comparisonReport.locations.find((l) => l.locationId === saturation.locationId);
      if (location) {
        opportunities.push({
          id: `capacity-${saturation.locationId}`,
          type: 'capacity_increase',
          priority: saturation.metrics.capacityUtilization > 95 ? 'high' : 'medium',
          location: {
            existingLocationId: saturation.locationId,
            existingLocationName: saturation.locationName,
          },
          metrics: {
            potentialRevenue: location.revenue * 0.2,
            potentialCustomers: location.customersServed * 0.2,
            marketSize: location.customersServed * 3,
            competitionLevel: 10,
          },
          reasoning: [
            `Capacidad casi saturada al ${saturation.metrics.capacityUtilization.toFixed(1)}%`,
            `Puede estar perdiendo clientes por falta de disponibilidad`,
            `Agregar técnicos podría aumentar ingresos significativamente`,
          ],
          estimatedROI: calculateEstimatedROI(location.revenue * 0.2, 'capacity_increase'),
          implementationComplexity: 'low',
          timeToValue: '1-3 meses',
        });
      }
    }
  }

  // Sort opportunities by priority and potential
  opportunities.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.metrics.potentialRevenue - a.metrics.potentialRevenue;
  });

  // Generate recommended actions
  const recommendedActions = generateRecommendedActions(opportunities, currentState);

  // Risk assessment
  const riskAssessment = assessExpansionRisks(opportunities, currentState, saturationLevels);

  // Calculate market growth potential
  const marketGrowthPotential = calculateMarketGrowthPotential(
    opportunities,
    currentState.totalRevenue
  );

  return {
    organizationId,
    analysisDate: new Date(),
    currentState,
    opportunities,
    marketGrowthPotential,
    recommendedActions,
    riskAssessment,
  };
}

/**
 * Calculate saturation levels for all locations
 */
export async function calculateLocationSaturation(
  organizationId: string,
  dateRange: DateRange
): Promise<LocationSaturation[]> {
  const locations = await db.location.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      name: true,
    },
  });

  const results: LocationSaturation[] = [];

  for (const location of locations) {
    // Get job metrics
    const jobs = await db.job.findMany({
      where: {
        organizationId,
        locationId: location.id,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: {
        status: true,
        createdAt: true,
        customerId: true,
      },
    });

    // Calculate previous period for trend
    const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
    const prevRange = {
      start: new Date(dateRange.start.getTime() - periodLength),
      end: new Date(dateRange.start.getTime() - 1),
    };

    const prevJobs = await db.job.count({
      where: {
        organizationId,
        locationId: location.id,
        createdAt: { gte: prevRange.start, lte: prevRange.end },
      },
    });

    // Calculate metrics
    const daysInPeriod = Math.ceil(periodLength / (1000 * 60 * 60 * 24));
    const avgDailyJobs = jobs.length / daysInPeriod;
    const maxDaily = 20; // Default max daily jobs capacity
    const capacityUtilization = (avgDailyJobs / maxDaily) * 100;

    const uniqueCustomers = new Set(jobs.map((j) => j.customerId)).size;
    // Default coverage radius calculation - assume ~10km service area
    const defaultCoverageRadius = 10;
    const customerDensity = uniqueCustomers / (Math.PI * defaultCoverageRadius * defaultCoverageRadius);

    const growthTrend = prevJobs > 0
      ? ((jobs.length - prevJobs) / prevJobs) * 100
      : 0;

    // Determine saturation level (0-100)
    const saturationLevel = Math.min(100, (
      capacityUtilization * 0.5 +
      (customerDensity > 1 ? 25 : customerDensity * 25) +
      (growthTrend > 10 ? 25 : growthTrend > 0 ? 15 : 0)
    ));

    // Determine recommendation
    let recommendation: LocationSaturation['recommendation'];
    let reasoning: string;

    if (saturationLevel > 80 && growthTrend > 5) {
      recommendation = 'expand';
      reasoning = 'Alta saturación con crecimiento continuo - considerar expansión';
    } else if (saturationLevel > 70) {
      recommendation = 'maintain';
      reasoning = 'Operación estable - mantener nivel actual';
    } else if (saturationLevel < 40 && growthTrend < 0) {
      recommendation = 'consolidate';
      reasoning = 'Baja utilización con tendencia negativa - evaluar consolidación';
    } else {
      recommendation = 'optimize';
      reasoning = 'Oportunidad de optimización operativa';
    }

    results.push({
      locationId: location.id,
      locationName: location.name,
      saturationLevel,
      metrics: {
        capacityUtilization,
        coverageReach: 70, // Placeholder - would need actual calculation
        customerDensity,
        growthTrend,
      },
      recommendation,
      reasoning,
    });
  }

  return results;
}

/**
 * Identify potential market areas for expansion
 */
export async function identifyMarketPotential(
  organizationId: string,
  dateRange: DateRange
): Promise<MarketPotential[]> {
  const densityMap = await generateServiceDensityMap(organizationId, dateRange, 10);

  // Find cells with high activity but low penetration
  const highPotentialCells = densityMap.cells
    .filter((cell) => {
      // High job count but far from location
      return cell.metrics.jobCount > 3 &&
             cell.nearestLocationDistance &&
             cell.nearestLocationDistance > 10;
    })
    .sort((a, b) => b.metrics.jobCount - a.metrics.jobCount)
    .slice(0, 10);

  return highPotentialCells.map((cell, index) => ({
    regionId: `region-${index}`,
    regionName: `Área ${cell.gridX}-${cell.gridY}`,
    coordinates: cell.center,
    metrics: {
      estimatedPopulation: cell.metrics.customerCount * 100, // Rough estimate
      estimatedBusinesses: cell.metrics.customerCount * 10,
      currentPenetration: (cell.metrics.customerCount / (cell.metrics.customerCount * 100)) * 100,
      growthRate: 5, // Placeholder
    },
    score: calculateMarketScore(cell),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function estimatePotentialRevenue(
  potentialCustomers: number,
  comparisonReport: Awaited<ReturnType<typeof generateLocationComparisonReport>>
): number {
  if (comparisonReport.locations.length === 0) return 0;

  const avgRevenuePerCustomer = comparisonReport.organizationSummary.totalRevenue /
    comparisonReport.locations.reduce((sum, l) => sum + l.customersServed, 0);

  return potentialCustomers * avgRevenuePerCustomer * 0.7; // Conservative estimate
}

function calculateEstimatedROI(
  potentialRevenue: number,
  type: ExpansionOpportunity['type']
): number {
  // Rough cost estimates
  const costs: Record<ExpansionOpportunity['type'], number> = {
    new_location: 500000, // High initial investment
    coverage_extension: 100000, // Marketing + vehicles
    capacity_increase: 50000, // Additional staff
  };

  const annualRevenue = potentialRevenue * 12;
  const cost = costs[type];

  return cost > 0 ? ((annualRevenue - cost) / cost) * 100 : 0;
}

function calculateMarketGrowthPotential(
  opportunities: ExpansionOpportunity[],
  currentRevenue: number
): number {
  const totalPotential = opportunities.reduce(
    (sum, opp) => sum + opp.metrics.potentialRevenue,
    0
  );

  return currentRevenue > 0 ? (totalPotential / currentRevenue) * 100 : 0;
}

function calculateMarketScore(cell: {
  metrics: { jobCount: number; customerCount: number; revenue: number };
  nearestLocationDistance?: number;
}): number {
  let score = 0;

  // Job activity (0-40 points)
  score += Math.min(40, cell.metrics.jobCount * 4);

  // Revenue potential (0-30 points)
  score += Math.min(30, cell.metrics.revenue / 10000);

  // Distance from nearest location (0-30 points) - farther is better for expansion
  if (cell.nearestLocationDistance) {
    score += Math.min(30, cell.nearestLocationDistance * 2);
  }

  return Math.min(100, score);
}

function generateRecommendedActions(
  opportunities: ExpansionOpportunity[],
  currentState: ExpansionAnalysis['currentState']
): ExpansionAction[] {
  const actions: ExpansionAction[] = [];

  // Priority 1: Capacity issues
  const capacityOpps = opportunities.filter((o) => o.type === 'capacity_increase' && o.priority === 'high');
  if (capacityOpps.length > 0) {
    actions.push({
      priority: 1,
      action: 'Aumentar capacidad operativa',
      description: `${capacityOpps.length} sucursal(es) están operando cerca del límite de capacidad`,
      estimatedCost: '$50,000 - $100,000 por sucursal',
      expectedBenefit: `+${(capacityOpps.reduce((sum, o) => sum + o.metrics.potentialRevenue, 0) / 1000).toFixed(0)}K en ingresos`,
      timeline: '1-3 meses',
    });
  }

  // Priority 2: Coverage extensions
  const extensionOpps = opportunities.filter((o) => o.type === 'coverage_extension');
  if (extensionOpps.length > 0) {
    actions.push({
      priority: 2,
      action: 'Extender área de cobertura',
      description: 'Ampliar zonas de servicio de sucursales existentes con buen rendimiento',
      estimatedCost: '$100,000 - $200,000',
      expectedBenefit: `+${(extensionOpps.reduce((sum, o) => sum + o.metrics.potentialCustomers, 0))} clientes potenciales`,
      timeline: '3-6 meses',
    });
  }

  // Priority 3: New locations
  const newLocationOpps = opportunities.filter((o) => o.type === 'new_location' && o.priority !== 'low');
  if (newLocationOpps.length > 0) {
    actions.push({
      priority: 3,
      action: 'Abrir nueva sucursal',
      description: `Se identificaron ${newLocationOpps.length} áreas con alta demanda sin cobertura adecuada`,
      estimatedCost: '$500,000 - $1,000,000 por sucursal',
      expectedBenefit: `Acceso a ${newLocationOpps.reduce((sum, o) => sum + o.metrics.marketSize, 0)} clientes potenciales`,
      timeline: '6-12 meses',
    });
  }

  // Priority 4: Optimization
  if (currentState.avgLocationPerformance < 70) {
    actions.push({
      priority: 4,
      action: 'Optimizar operaciones existentes',
      description: 'Mejorar el rendimiento de sucursales antes de expandir',
      estimatedCost: '$20,000 - $50,000',
      expectedBenefit: `Mejorar rendimiento promedio de ${currentState.avgLocationPerformance.toFixed(1)}% a 80%+`,
      timeline: '2-4 meses',
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

function assessExpansionRisks(
  opportunities: ExpansionOpportunity[],
  currentState: ExpansionAnalysis['currentState'],
  saturationLevels: LocationSaturation[]
): RiskAssessment {
  const factors: RiskFactor[] = [];

  // Market saturation risk
  const avgSaturation = saturationLevels.length > 0
    ? saturationLevels.reduce((sum, s) => sum + s.saturationLevel, 0) / saturationLevels.length
    : 0;

  if (avgSaturation > 70) {
    factors.push({
      name: 'Saturación de mercado',
      level: avgSaturation > 85 ? 'high' : 'medium',
      description: `Las sucursales actuales operan al ${avgSaturation.toFixed(1)}% de saturación`,
      mitigation: 'Optimizar operaciones antes de expandir agresivamente',
    });
  }

  // Operational capacity risk
  if (currentState.avgLocationPerformance < 60) {
    factors.push({
      name: 'Capacidad operativa',
      level: 'high',
      description: 'El rendimiento promedio de sucursales es bajo',
      mitigation: 'Resolver problemas operativos antes de la expansión',
    });
  }

  // Financial risk
  const highCostOpps = opportunities.filter((o) => o.type === 'new_location').length;
  if (highCostOpps > 2) {
    factors.push({
      name: 'Riesgo financiero',
      level: 'medium',
      description: `Se identificaron ${highCostOpps} oportunidades de nueva sucursal con alta inversión`,
      mitigation: 'Priorizar una sucursal a la vez y evaluar resultados',
    });
  }

  // Competition risk
  const highCompetitionOpps = opportunities.filter((o) => o.metrics.competitionLevel > 50);
  if (highCompetitionOpps.length > 0) {
    factors.push({
      name: 'Competencia',
      level: 'medium',
      description: 'Algunas áreas tienen alta competencia existente',
      mitigation: 'Diferenciación de servicios y precios competitivos',
    });
  }

  // Resource risk
  if (currentState.totalLocations > 5 && opportunities.filter((o) => o.priority === 'high').length > 3) {
    factors.push({
      name: 'Recursos de gestión',
      level: 'medium',
      description: 'Múltiples expansiones simultáneas pueden sobrecargar la gestión',
      mitigation: 'Implementar expansiones de forma escalonada',
    });
  }

  // Determine overall risk
  const highRiskCount = factors.filter((f) => f.level === 'high').length;
  const mediumRiskCount = factors.filter((f) => f.level === 'medium').length;

  let overallRisk: RiskAssessment['overallRisk'];
  if (highRiskCount >= 2) {
    overallRisk = 'high';
  } else if (highRiskCount >= 1 || mediumRiskCount >= 3) {
    overallRisk = 'medium';
  } else {
    overallRisk = 'low';
  }

  return {
    overallRisk,
    factors,
  };
}
