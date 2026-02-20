/**
 * AI-Powered Dispatch Recommendation API
 *
 * Provides intelligent technician recommendations for job assignments
 * based on multiple factors: proximity, availability, skills, and workload.
 *
 * Supports two modes:
 * - Algorithmic scoring (default): Fast, rule-based recommendations
 * - AI-enhanced (useAI=true): Uses GPT-4o-mini for intelligent reasoning
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getAIDispatchService,
  isAIDispatchAvailable,
  TechnicianData,
  JobContext,
  AIDispatchResult,
} from '@/lib/services/ai-dispatch';
import {
  haversineDistanceKm,
  getBatchDistances,
  getBuenosAiresTrafficContext,
  compareMultiModal,
  type TravelMode,
} from '@/lib/integrations/google-maps/distance-matrix';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RecommendationRequest {
  jobLocation: {
    lat: number;
    lng: number;
  };
  serviceType?: string;
  urgency?: 'NORMAL' | 'URGENTE';
  preferredTime?: string; // ISO datetime
  requiredSkillLevel?: string;
  excludeTechnicianIds?: string[];
  useAI?: boolean; // Enable GPT-4o-mini powered recommendations
  customerName?: string;
  address?: string;
  // Specialty filtering (optional convenience feature)
  filterBySpecialty?: string; // e.g., 'PLOMERO', 'ELECTRICISTA', 'GASISTA', 'REFRIGERACION'
  strictSpecialtyFilter?: boolean; // If true, exclude technicians without matching specialty
}

interface TechnicianRecommendation {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  specialty: string | null;
  skillLevel: string | null;
  currentStatus: string;
  distanceKm: number;
  etaMinutes: number;
  /** Human-readable ETA string from Distance Matrix (e.g. "23 min") */
  etaText: string;
  /** True if ETA comes from real Distance Matrix API with live traffic data */
  isRealEta: boolean;
  score: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  reasons: string[];
  warnings: string[];
  currentLocation: {
    lat: number;
    lng: number;
  } | null;
  todaysWorkload: {
    totalJobs: number;
    completed: number;
    remaining: number;
  };
  // AI-enhanced fields (only present when useAI=true)
  aiReasoning?: string;
  aiConfidence?: 'high' | 'medium' | 'low';
  estimatedSuccessRate?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING WEIGHTS (AI-tunable parameters)
// ═══════════════════════════════════════════════════════════════════════════════

const SCORING_WEIGHTS = {
  proximity: 0.30,        // 30% - Distance to job
  availability: 0.25,     // 25% - Current status and availability
  workload: 0.15,         // 15% - Today's job count
  skillMatch: 0.15,       // 15% - Specialty/skill level match
  performance: 0.15,      // 15% - Historical performance
};

const MAX_DISTANCE_KM = 50; // Maximum distance to consider
const URGENCY_DISTANCE_PENALTY = 0.5; // Extra weight on distance for urgent jobs

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// NOTE: calculateDistance and estimateETA have been replaced by imports from
// distance-matrix.ts — haversineDistanceKm for pre-filtering, and real
// Distance Matrix API calls for actual travel time with live traffic.

function estimateETAFallback(distanceKm: number): number {
  // Simple fallback — only used when Distance Matrix API is unavailable
  const avgSpeedKmh = 30;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
}

/**
 * Calculate proximity score using real ETA (minutes) instead of distance.
 * This is the Phase 1 key upgrade: score based on actual travel time,
 * not straight-line distance.
 */
function calculateProximityScore(
  etaMinutes: number,
  distanceKm: number,
  isUrgent: boolean,
): number {
  if (distanceKm > MAX_DISTANCE_KM) return 0;

  // ETA-based scoring (max 60 min considered, then 0)
  const MAX_ETA_MINUTES = 60;
  let score = 100 * Math.max(0, 1 - etaMinutes / MAX_ETA_MINUTES);

  // For urgent jobs, penalize long ETAs more heavily
  if (isUrgent && etaMinutes > 15) {
    score *= URGENCY_DISTANCE_PENALTY;
  }

  return Math.max(0, score);
}

function calculateAvailabilityScore(status: string, currentJobStartedAt: Date | null): number {
  switch (status) {
    case 'disponible':
      return 100;
    case 'en_camino':
      return 40; // Available soon, but committed
    case 'trabajando':
      // Score based on how long they've been working
      if (currentJobStartedAt) {
        const minutesWorking = (Date.now() - currentJobStartedAt.getTime()) / 60000;
        // Assume average job is 60-90 minutes
        if (minutesWorking > 90) return 50; // Likely finishing soon
        if (minutesWorking > 60) return 30;
        return 10; // Still early in job
      }
      return 20;
    case 'sin_conexion':
      return 0;
    default:
      return 0;
  }
}

function calculateWorkloadScore(remainingJobs: number): number {
  // Less jobs = higher score
  if (remainingJobs === 0) return 100;
  if (remainingJobs === 1) return 80;
  if (remainingJobs === 2) return 60;
  if (remainingJobs === 3) return 40;
  if (remainingJobs === 4) return 20;
  return 0; // 5+ jobs already assigned
}

function calculateSkillMatchScore(
  techSpecialty: string | null,
  techSkillLevel: string | null,
  requiredServiceType: string | null,
  requiredSkillLevel: string | null
): number {
  let score = 50; // Base score

  // Specialty match (simplistic - could be enhanced with mapping)
  if (requiredServiceType && techSpecialty) {
    const serviceTypeUpper = requiredServiceType.toUpperCase();
    const specialtyUpper = techSpecialty.toUpperCase();

    if (serviceTypeUpper.includes('SPLIT') && specialtyUpper.includes('CLIMA')) {
      score += 30;
    } else if (serviceTypeUpper.includes('CALEFACTOR') && specialtyUpper.includes('CALEF')) {
      score += 30;
    } else if (serviceTypeUpper.includes('ELECTRIC') && specialtyUpper.includes('ELECTRIC')) {
      score += 30;
    } else if (serviceTypeUpper.includes('PLOM') && specialtyUpper.includes('PLOM')) {
      score += 30;
    }
  }

  // Skill level match
  if (requiredSkillLevel && techSkillLevel) {
    const skillOrder = ['AYUDANTE', 'MEDIO_OFICIAL', 'OFICIAL', 'OFICIAL_ESPECIALIZADO'];
    const techIdx = skillOrder.indexOf(techSkillLevel.toUpperCase());
    const reqIdx = skillOrder.indexOf(requiredSkillLevel.toUpperCase());

    if (techIdx >= reqIdx) {
      score += 20; // Meets or exceeds requirement
    } else {
      score -= 20; // Below requirement
    }
  }

  return Math.max(0, Math.min(100, score));
}

function calculatePerformanceScore(
  avgRating: number | null,
  jobsThisMonth: number,
  _avgDuration: number | null
): number {
  let score = 50; // Base score

  // Rating component (0-50 points)
  if (avgRating !== null) {
    score += (avgRating / 5) * 30;
  }

  // Activity component (0-20 points)
  if (jobsThisMonth >= 20) score += 20;
  else if (jobsThisMonth >= 10) score += 15;
  else if (jobsThisMonth >= 5) score += 10;
  else score += jobsThisMonth;

  return Math.min(100, score);
}

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function generateReasons(
  proximityScore: number,
  availabilityScore: number,
  workloadScore: number,
  skillScore: number,
  performanceScore: number,
  status: string,
  distanceKm: number,
  hasRequiredSpecialty?: boolean,
  filterBySpecialty?: string | null
): string[] {
  const reasons: string[] = [];

  // Specialty match (show first if filtering by specialty)
  if (filterBySpecialty && hasRequiredSpecialty) {
    reasons.push(`Especialidad: ${filterBySpecialty}`);
  }

  if (proximityScore >= 80) {
    reasons.push(`Muy cerca del trabajo (${distanceKm.toFixed(1)} km)`);
  } else if (proximityScore >= 60) {
    reasons.push(`Distancia razonable (${distanceKm.toFixed(1)} km)`);
  }

  if (availabilityScore === 100) {
    reasons.push('Disponible inmediatamente');
  } else if (status === 'trabajando' && availabilityScore >= 30) {
    reasons.push('Podría estar disponible pronto');
  }

  if (workloadScore >= 80) {
    reasons.push('Carga de trabajo liviana');
  }

  if (skillScore >= 70 && !filterBySpecialty) {
    reasons.push('Especialidad adecuada');
  }

  if (performanceScore >= 70) {
    reasons.push('Buen historial de desempeño');
  }

  return reasons;
}

function generateWarnings(
  status: string,
  distanceKm: number,
  remainingJobs: number,
  hasLocation: boolean
): string[] {
  const warnings: string[] = [];

  if (status === 'sin_conexion') {
    warnings.push('Sin conexión - verificar disponibilidad');
  }

  if (status === 'trabajando') {
    warnings.push('Actualmente en otro trabajo');
  }

  if (distanceKm > 20) {
    warnings.push(`Distancia considerable (${distanceKm.toFixed(1)} km)`);
  }

  if (remainingJobs >= 4) {
    warnings.push(`Carga de trabajo alta (${remainingJobs} trabajos pendientes)`);
  }

  if (!hasLocation) {
    warnings.push('Sin ubicación GPS disponible');
  }

  return warnings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only owners and Admins can use dispatch recommendations
    const userRole = session.role?.toUpperCase();
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const body: RecommendationRequest = await request.json();
    const {
      jobLocation,
      serviceType,
      urgency = 'NORMAL',
      requiredSkillLevel,
      excludeTechnicianIds = [],
      useAI = false,
      customerName,
      address,
      filterBySpecialty,
      strictSpecialtyFilter = false,
    } = body;

    if (!jobLocation?.lat || !jobLocation?.lng) {
      return NextResponse.json(
        { success: false, error: 'Job location (lat, lng) is required' },
        { status: 400 }
      );
    }

    const isUrgent = urgency === 'URGENTE';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Fetch all active technicians
    const technicians = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        role: 'TECHNICIAN',
        isActive: true,
        id: { notIn: excludeTechnicianIds },
      },
      include: {
        currentLocation: true,
        assignedJobs: {
          where: {
            scheduledDate: {
              gte: today,
              lt: tomorrow,
            },
          },
        },
      },
    });

    // Fetch historical performance data
    const technicianIds = technicians.map((t: { id: string }) => t.id);

    const [monthlyStats, ratingsData] = await Promise.all([
      prisma.job.groupBy({
        by: ['technicianId'],
        where: {
          technicianId: { in: technicianIds },
          completedAt: { gte: startOfMonth },
          status: 'COMPLETED',
        },
        _count: { id: true },
        _avg: { actualDuration: true },
      }),
      prisma.review.groupBy({
        by: ['technicianId'],
        where: {
          technicianId: { in: technicianIds },
          rating: { not: null },
        },
        _avg: { rating: true },
      }),
    ]);

    type StatsEntry = { count: number; avgDuration: number | null };

    const statsMap = new Map<string | null, StatsEntry>(
      monthlyStats.map((s: { technicianId: string | null; _count: { id: number }; _avg: { actualDuration: number | null } }) => [
        s.technicianId,
        { count: s._count.id, avgDuration: s._avg.actualDuration },
      ])
    );
    const ratingsMap = new Map<string | null, number | null>(
      ratingsData.map((r: { technicianId: string | null; _avg: { rating: number | null } }) => [r.technicianId, r._avg.rating])
    );

    // Calculate scores and build recommendations
    const recommendations: TechnicianRecommendation[] = [];

    // ─── Phase 1: Batch Distance Matrix ────────────────────────────────
    // Pre-filter candidates by Haversine, then get real ETAs via Distance Matrix
    const trafficContext = getBuenosAiresTrafficContext();

    interface TechWithLocation {
      tech: typeof technicians[number];
      techLat: number;
      techLng: number;
      haversineKm: number;
      hasLocation: boolean;
    }

    const candidatesForMatrix: TechWithLocation[] = [];

    for (const tech of technicians) {
      const hasLocation = !!(tech.currentLocation?.latitude && tech.currentLocation?.longitude);
      const techLat = hasLocation ? Number(tech.currentLocation!.latitude) : null;
      const techLng = hasLocation ? Number(tech.currentLocation!.longitude) : null;

      // Pre-filter by Haversine distance
      const haversineKm =
        techLat !== null && techLng !== null
          ? haversineDistanceKm(techLat, techLng, jobLocation.lat, jobLocation.lng)
          : MAX_DISTANCE_KM;

      if (haversineKm > MAX_DISTANCE_KM) continue;

      candidatesForMatrix.push({
        tech,
        techLat: techLat ?? 0,
        techLng: techLng ?? 0,
        haversineKm,
        hasLocation,
      });
    }

    // Call Distance Matrix API for all candidates → job location
    const matrixOrigins = candidatesForMatrix
      .filter((c) => c.hasLocation)
      .map((c) => ({
        id: c.tech.id,
        location: `${c.techLat},${c.techLng}`,
      }));

    const destinationStr = `${jobLocation.lat},${jobLocation.lng}`;
    const batchResult = await getBatchDistances(matrixOrigins, destinationStr, 'driving');

    // Build a map of tech ID → real ETA/distance
    const matrixMap = new Map<string, { distanceKm: number; etaMinutes: number; etaText: string; isRealEta: boolean }>();
    for (let i = 0; i < matrixOrigins.length; i++) {
      const result = batchResult.results.find((r) => r.originIndex === i);
      if (result) {
        matrixMap.set(matrixOrigins[i].id, {
          distanceKm: result.element.distanceMeters / 1000,
          etaMinutes: Math.ceil(result.effectiveEtaSeconds / 60),
          etaText: result.element.durationInTrafficText ?? result.element.durationText,
          isRealEta: result.element.durationInTrafficSeconds !== null,
        });
      }
    }

    // ─── Score each candidate ────────────────────────────────────────────
    for (const { tech, techLat, techLng, haversineKm, hasLocation } of candidatesForMatrix) {
      const matrixData = matrixMap.get(tech.id);
      const distanceKm = matrixData?.distanceKm ?? haversineKm;
      const etaMinutes = matrixData?.etaMinutes ?? estimateETAFallback(haversineKm);

      // ═══════════════════════════════════════════════════════════════════════════════
      // SPECIALTY FILTERING (Optional convenience feature)
      // ═══════════════════════════════════════════════════════════════════════════════
      // Check if technician has the required specialty
      // Uses both legacy `specialty` field and new `specialties[]` array
      const techSpecialties = [
        ...(tech.specialties || []),
        ...(tech.specialty ? [tech.specialty] : []),
      ].map((s: string) => s.toUpperCase());

      const hasRequiredSpecialty = filterBySpecialty
        ? techSpecialties.includes(filterBySpecialty.toUpperCase())
        : true;

      // If strict filtering, skip technicians without the specialty
      if (strictSpecialtyFilter && filterBySpecialty && !hasRequiredSpecialty) {
        continue;
      }

      // Determine current status
      const currentJob = tech.assignedJobs.find(
        (j: { status: string }) => j.status === 'IN_PROGRESS' || j.status === 'EN_ROUTE'
      );
      const isOnline =
        tech.currentLocation?.isOnline &&
        tech.currentLocation.lastSeen >
        new Date(Date.now() - 5 * 60 * 1000);

      let status = 'sin_conexion';
      if (isOnline) {
        if (currentJob?.status === 'IN_PROGRESS') status = 'trabajando';
        else if (currentJob?.status === 'EN_ROUTE') status = 'en_camino';
        else status = 'disponible';
      }

      // Calculate individual scores (using real ETA for proximity!)
      const proximityScore = calculateProximityScore(etaMinutes, distanceKm, isUrgent);
      const availabilityScore = calculateAvailabilityScore(
        status,
        currentJob?.startedAt || null
      );
      const completedJobs = tech.assignedJobs.filter((j: { status: string }) => j.status === 'COMPLETED').length;
      const remainingJobs = tech.assignedJobs.length - completedJobs;
      const workloadScore = calculateWorkloadScore(remainingJobs);
      const skillScore = calculateSkillMatchScore(
        tech.specialty,
        tech.skillLevel,
        serviceType || null,
        requiredSkillLevel || null
      );

      // Bonus for matching specialty filter (if provided)
      const specialtyBonus = filterBySpecialty && hasRequiredSpecialty ? 15 : 0;

      const monthlyData = statsMap.get(tech.id);
      const avgRating = ratingsMap.get(tech.id) ?? null;
      const performanceScore = calculatePerformanceScore(
        avgRating as number | null,
        monthlyData?.count ?? 0,
        monthlyData?.avgDuration ?? null
      );

      // Calculate weighted total score
      const totalScore = Math.min(100,
        proximityScore * SCORING_WEIGHTS.proximity +
        availabilityScore * SCORING_WEIGHTS.availability +
        workloadScore * SCORING_WEIGHTS.workload +
        skillScore * SCORING_WEIGHTS.skillMatch +
        performanceScore * SCORING_WEIGHTS.performance +
        specialtyBonus // Extra boost for matching specialty
      );

      recommendations.push({
        id: tech.id,
        name: tech.name,
        phone: tech.phone,
        avatar: tech.avatar,
        specialty: tech.specialty,
        skillLevel: tech.skillLevel,
        currentStatus: status,
        distanceKm: Math.round(distanceKm * 10) / 10,
        etaMinutes,
        etaText: matrixData?.etaText ?? `~${etaMinutes} min`,
        isRealEta: matrixData?.isRealEta ?? false,
        score: Math.round(totalScore),
        confidenceLevel: getConfidenceLevel(totalScore),
        reasons: generateReasons(
          proximityScore,
          availabilityScore,
          workloadScore,
          skillScore,
          performanceScore,
          status,
          distanceKm,
          hasRequiredSpecialty,
          filterBySpecialty
        ),
        warnings: generateWarnings(status, distanceKm, remainingJobs, hasLocation),
        currentLocation:
          techLat !== null && techLng !== null
            ? { lat: techLat, lng: techLng }
            : null,
        todaysWorkload: {
          totalJobs: tech.assignedJobs.length,
          completed: completedJobs,
          remaining: remainingJobs,
        },
      });
    }

    // Sort by score (highest first)
    recommendations.sort((a, b) => b.score - a.score);

    // Take top 5 recommendations
    let topRecommendations = recommendations.slice(0, 5);

    // AI Enhancement (optional)
    let aiResult: AIDispatchResult | null = null;
    const aiAvailable = isAIDispatchAvailable();

    if (useAI && aiAvailable && topRecommendations.length > 0) {
      try {
        const aiService = getAIDispatchService();

        // Prepare data for AI analysis
        const technicianDataForAI: TechnicianData[] = topRecommendations.map(
          (rec) => ({
            id: rec.id,
            name: rec.name,
            specialty: rec.specialty,
            skillLevel: rec.skillLevel,
            currentStatus: rec.currentStatus,
            distanceKm: rec.distanceKm,
            etaMinutes: rec.etaMinutes,
            todaysWorkload: rec.todaysWorkload,
            performanceScore: rec.score,
            avgRating:
              ratingsMap.get(rec.id) !== undefined
                ? (ratingsMap.get(rec.id) as number | null)
                : null,
          })
        );

        const jobContext: JobContext = {
          serviceType: serviceType || null,
          urgency,
          requiredSkillLevel: requiredSkillLevel || null,
          customerName,
          address,
        };

        aiResult = await aiService.getRecommendations(
          technicianDataForAI,
          jobContext
        );

        // Merge AI reasoning into recommendations
        if (aiResult.recommendations.length > 0) {
          const aiRecommendationsMap = new Map(
            aiResult.recommendations.map((r) => [r.technicianId, r])
          );

          topRecommendations = topRecommendations.map((rec) => {
            const aiRec = aiRecommendationsMap.get(rec.id);
            if (aiRec) {
              return {
                ...rec,
                aiReasoning: aiRec.reasoning,
                aiConfidence: aiRec.confidence,
                estimatedSuccessRate: aiRec.estimatedSuccessRate,
                // Merge AI warnings with existing warnings
                warnings: [...new Set([...rec.warnings, ...aiRec.warnings])],
              };
            }
            return rec;
          });

          // Re-sort based on AI ranking if available
          topRecommendations.sort((a, b) => {
            const aRank =
              aiResult!.recommendations.find((r) => r.technicianId === a.id)
                ?.rank ?? 999;
            const bRank =
              aiResult!.recommendations.find((r) => r.technicianId === b.id)
                ?.rank ?? 999;
            return aRank - bRank;
          });
        }
      } catch (aiError) {
        console.error('AI enhancement failed, using algorithmic results:', aiError);
        // Continue with algorithmic recommendations
      }
    }

    // ─── Phase 2: Multi-Modal Comparison (rush hour) ──────────────────
    let multiModalData = null;
    if (trafficContext.isRushHour && topRecommendations.length > 0) {
      // Compare driving vs moto/bici for the top candidate
      const topRec = topRecommendations[0];
      if (topRec.currentLocation) {
        const topOrigin = `${topRec.currentLocation.lat},${topRec.currentLocation.lng}`;
        multiModalData = await compareMultiModal(
          topOrigin,
          destinationStr,
          ['driving', 'bicycling', 'transit'] as TravelMode[],
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        recommendations: topRecommendations,
        totalCandidates: recommendations.length,
        jobLocation,
        urgency,
        serviceType: serviceType || null,
        scoringWeights: SCORING_WEIGHTS,
        generatedAt: new Date().toISOString(),
        // AI-specific response fields
        aiEnhanced: useAI && aiResult !== null,
        aiAvailable,
        aiSummary: aiResult?.summary || null,
        aiAlternativeStrategy: aiResult?.alternativeStrategy || null,
        // Buenos Aires traffic intelligence (Phase 2)
        traffic: {
          context: trafficContext,
          multiModal: multiModalData,
          modeRecommendation: multiModalData?.fastestMode !== 'driving'
            ? `En hora pico, ${multiModalData?.fastestMode === 'bicycling' ? 'moto/bici' : 'transporte público'} llegaría en ${multiModalData?.fastestEtaText}`
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Dispatch recommendation error:', error);
    return NextResponse.json(
      { success: false, error: 'Error generating recommendations' },
      { status: 500 }
    );
  }
}
