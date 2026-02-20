/**
 * Maps Simulation Runner
 * ======================
 *
 * Runs three simulation suites against the live API:
 *
 * 1. MARKETPLACE NEAREST — Consumer searches across all 10 orgs
 * 2. DISPATCH RECOMMEND — Within-org dispatch for team orgs (3+ workers)
 * 3. ITINERARY OPTIMIZATION — Optimal visit order for multi-job techs
 *
 * Prerequisites:
 * - Dev server running (`pnpm dev`)
 * - Simulation orgs seeded (`pnpm tsx scripts/simulation/maps/seed-map-orgs.ts`)
 *
 * Usage:
 *   pnpm tsx scripts/simulation/maps/run-simulation.ts
 */

import { PrismaClient } from '@prisma/client';
import {
    SIM_CONFIG,
    SIM_ORGANIZATIONS,
    BA_ZONES,
    MARKETPLACE_SCENARIOS,
    DISPATCH_JOB_LOCATIONS,
} from './config';
import { generateReport } from './report-generator';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MarketplaceResult {
    scenario: string;
    category: string | undefined;
    searchLocation: { lat: number; lng: number };
    totalCandidates: number;
    topResults: Array<{
        rank: number;
        orgName: string;
        etaMinutes: number;
        distanceKm: number;
        isRealEta: boolean;
        haversineKm: number;
        rating: number;
        reviewCount: number;
    }>;
    traffic: {
        isRushHour: boolean;
        modeRecommendation: string | null;
    };
    expectation: string;
    /** Was expectation met? */
    passed: boolean | null;
    responseTimeMs: number;
    error?: string;
}

interface DispatchResult {
    orgName: string;
    jobLabel: string;
    jobLocation: { lat: number; lng: number };
    recommendations: Array<{
        rank: number;
        techName: string;
        etaMinutes: number;
        distanceKm: number;
        score: number;
        isRealEta: boolean;
        confidence: string;
        reasons: string[];
        warnings: string[];
    }>;
    traffic: {
        isRushHour: boolean;
    };
    responseTimeMs: number;
    error?: string;
}

interface ItineraryResult {
    techName: string;
    orgName: string;
    startLocation: { lat: number; lng: number };
    jobs: Array<{
        visitOrder: number;
        label: string;
        location: { lat: number; lng: number };
        etaFromPrevious: number;
        cumulativeEta: number;
    }>;
    totalTravelMinutes: number;
    /** Naive order ETA (jobs in original order without optimization) */
    naiveTotalMinutes: number;
    optimizationGainPercent: number;
    error?: string;
}

interface SimulationResults {
    timestamp: string;
    config: typeof SIM_CONFIG;
    marketplace: MarketplaceResult[];
    dispatch: DispatchResult[];
    itinerary: ItineraryResult[];
    summary: {
        totalApiCalls: number;
        totalTimeMs: number;
        marketplacePassRate: string;
        avgMarketplaceResponseMs: number;
        avgDispatchResponseMs: number;
        itineraryOptimizationAvg: string;
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApi(path: string, options?: RequestInit): Promise<{ data: unknown; timeMs: number }> {
    const url = `${SIM_CONFIG.baseUrl}${path}`;
    const start = Date.now();
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
        const data = await response.json();
        return { data, timeMs: Date.now() - start };
    } catch (error) {
        return {
            data: { success: false, error: String(error) },
            timeMs: Date.now() - start,
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1: MARKETPLACE NEAREST
// ═══════════════════════════════════════════════════════════════════════════════

async function runMarketplaceSimulation(): Promise<MarketplaceResult[]> {
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  🏪 MARKETPLACE NEAREST SEARCH SIMULATION   │');
    console.log('└─────────────────────────────────────────────┘\n');

    const results: MarketplaceResult[] = [];
    const scenarios = MARKETPLACE_SCENARIOS.slice(0, SIM_CONFIG.marketplaceSearches);

    for (const scenario of scenarios) {
        console.log(`  🔍 ${scenario.label}...`);

        const params = new URLSearchParams({
            lat: String(scenario.lat),
            lng: String(scenario.lng),
            limit: '10',
            multiModal: String(SIM_CONFIG.includeMultiModal),
        });
        if (scenario.category) {
            params.set('category', scenario.category);
        }

        const { data, timeMs } = await callApi(`/api/marketplace/nearest?${params}`);
        const response = data as Record<string, unknown>;

        if (response.success && response.data) {
            const d = response.data as Record<string, unknown>;
            const orgs = (d.organizations as Array<Record<string, unknown>> || []);
            const traffic = d.traffic as Record<string, unknown> || {};
            const context = traffic.context as Record<string, unknown> || {};

            const topResults = orgs.map((org: Record<string, unknown>, idx: number) => {
                const organization = org.organization as Record<string, unknown>;
                const verification = org.verification as Record<string, unknown>;
                const proximity = org.proximity as Record<string, unknown>;
                return {
                    rank: idx + 1,
                    orgName: String(organization?.displayName || 'Unknown'),
                    etaMinutes: Number(proximity?.etaMinutes || 0),
                    distanceKm: Number(proximity?.distanceKm || 0),
                    isRealEta: Boolean(proximity?.isRealEta),
                    haversineKm: Number(proximity?.haversineKm || 0),
                    rating: Number(verification?.averageRating || 0),
                    reviewCount: Number(verification?.totalReviews || 0),
                };
            });

            results.push({
                scenario: scenario.label,
                category: scenario.category,
                searchLocation: { lat: scenario.lat, lng: scenario.lng },
                totalCandidates: Number(d.totalCandidates || 0),
                topResults,
                traffic: {
                    isRushHour: Boolean(context?.isRushHour),
                    modeRecommendation: traffic?.modeRecommendation as string | null ?? null,
                },
                expectation: scenario.expectation,
                passed: null, // Manual review needed
                responseTimeMs: timeMs,
            });

            console.log(`    ✅ ${topResults.length} results | Top: ${topResults[0]?.orgName || 'none'} (${topResults[0]?.etaMinutes || '?'}min) | ${timeMs}ms`);
        } else {
            results.push({
                scenario: scenario.label,
                category: scenario.category,
                searchLocation: { lat: scenario.lat, lng: scenario.lng },
                totalCandidates: 0,
                topResults: [],
                traffic: { isRushHour: false, modeRecommendation: null },
                expectation: scenario.expectation,
                passed: false,
                responseTimeMs: timeMs,
                error: String(response.error || 'Unknown error'),
            });
            console.log(`    ❌ Error: ${response.error}`);
        }

        await delay(SIM_CONFIG.apiDelayMs);
    }

    return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2: DISPATCH RECOMMENDATIONS (Within-Org)
// ═══════════════════════════════════════════════════════════════════════════════

async function runDispatchSimulation(): Promise<DispatchResult[]> {
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  ⚡ DISPATCH RECOMMENDATION SIMULATION      │');
    console.log('└─────────────────────────────────────────────┘\n');

    const results: DispatchResult[] = [];

    // Only test orgs with 2+ workers (solo owners can't test dispatch ranking)
    const teamOrgs = SIM_ORGANIZATIONS.filter((o) => o.workers.length >= 2);

    for (const org of teamOrgs) {
        console.log(`  🏢 ${org.name} (${org.workers.length} workers)`);

        // Pick random job locations to dispatch
        const jobScenarios = DISPATCH_JOB_LOCATIONS
            .filter((j) => org.categories.includes(j.specialty!))
            .slice(0, SIM_CONFIG.jobsPerDispatchTest);

        if (jobScenarios.length === 0) {
            console.log('    ⏭️  No matching job scenarios for this org\n');
            continue;
        }

        for (const job of jobScenarios) {
            console.log(`    📍 ${job.label} (${job.urgency})...`);

            // The dispatch recommend API requires auth — so we call the internal scoring
            // logic directly via the haversine + batch distance approach.
            // For a full E2E test, you'd need to generate JWT tokens per org.
            //
            // Instead, we use the marketplace/nearest as a proxy for cross-org,
            // and implement a local scoring simulation for within-org dispatch.

            const orgId = `sim-maps-org-${org.slug}`;
            const workers = await prisma.user.findMany({
                where: {
                    organizationId: orgId,
                    isActive: true,
                },
                include: {
                    currentLocation: true,
                },
            });

            if (workers.length === 0) {
                console.log('      ⚠️ No workers found (seed first!)\n');
                continue;
            }

            // Calculate haversine distances for each worker
            type Worker = typeof workers[number];
            const start = Date.now();
            const scored = workers
                .filter((w: Worker) => w.currentLocation)
                .map((w: Worker) => {
                    const wLat = Number(w.currentLocation!.latitude);
                    const wLng = Number(w.currentLocation!.longitude);
                    const dLat = job.lat - wLat;
                    const dLng = job.lng - wLng;
                    const a = Math.sin((dLat * Math.PI) / 180 / 2) ** 2 +
                        Math.cos((wLat * Math.PI) / 180) *
                        Math.cos((job.lat * Math.PI) / 180) *
                        Math.sin((dLng * Math.PI) / 180 / 2) ** 2;
                    const haversineKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                    // Simplified ETA: ~30 km/h average in BA
                    const etaMinutes = Math.ceil((haversineKm / 30) * 60);

                    // Simplified scoring (mirrors API logic)
                    const MAX_ETA = 60;
                    const proximityScore = 100 * Math.max(0, 1 - etaMinutes / MAX_ETA);
                    const availabilityScore = 100; // All freshly seeded = available
                    const workloadScore = 100;     // No existing jobs
                    const skillMatch = org.categories.includes(w.specialty as never) ? 80 : 50;
                    const score = 0.30 * proximityScore + 0.25 * availabilityScore +
                        0.15 * workloadScore + 0.15 * skillMatch + 0.15 * 70;

                    return {
                        rank: 0,
                        techName: w.name,
                        etaMinutes,
                        distanceKm: Math.round(haversineKm * 10) / 10,
                        score: Math.round(score * 10) / 10,
                        isRealEta: false, // Haversine estimate (no live API call to save quota)
                        confidence: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
                        reasons: [
                            `${haversineKm.toFixed(1)} km de distancia`,
                            `ETA estimado: ~${etaMinutes} min`,
                        ],
                        warnings: haversineKm > 20 ? [`Distancia considerable`] : [],
                    };
                })
                .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

            scored.forEach((s: { rank: number }, i: number) => (s.rank = i + 1));
            const responseTimeMs = Date.now() - start;

            results.push({
                orgName: org.name,
                jobLabel: job.label,
                jobLocation: { lat: job.lat, lng: job.lng },
                recommendations: scored,
                traffic: { isRushHour: false },
                responseTimeMs,
            });

            if (scored[0]) {
                console.log(`      ✅ #1: ${scored[0].techName} (${scored[0].distanceKm}km, ~${scored[0].etaMinutes}min, score: ${scored[0].score}) | ${responseTimeMs}ms`);
            }

            await delay(50);
        }

        console.log('');
    }

    return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3: ITINERARY OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════════

async function runItinerarySimulation(): Promise<ItineraryResult[]> {
    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│  🗺️  ITINERARY OPTIMIZATION SIMULATION       │');
    console.log('└─────────────────────────────────────────────┘\n');

    const results: ItineraryResult[] = [];

    // Pick orgs with 2+ workers, use the first worker's location as start
    const teamOrgs = SIM_ORGANIZATIONS.filter((o) => o.workers.length >= 2);

    for (const org of teamOrgs) {
        const worker = org.workers[0]; // Use owner as the technician
        const workerZone = BA_ZONES[worker.zone];
        const startLat = workerZone.lat + worker.locationJitter.lat;
        const startLng = workerZone.lng + worker.locationJitter.lng;

        console.log(`  🧑‍🔧 ${worker.name} (${org.name}) — start: ${BA_ZONES[worker.zone].label}`);

        // Generate N random job stops
        const jobCount = Math.min(SIM_CONFIG.jobsPerItinerary, DISPATCH_JOB_LOCATIONS.length);
        const shuffled = [...DISPATCH_JOB_LOCATIONS].sort(() => Math.random() - 0.5);
        const selectedJobs = shuffled.slice(0, jobCount);

        // Calculate distance matrix between all points (start + all jobs)
        const allPoints = [
            { lat: startLat, lng: startLng, label: 'Inicio' },
            ...selectedJobs.map((j) => ({ lat: j.lat, lng: j.lng, label: j.label })),
        ];

        // Build distance matrix using haversine
        const distMatrix: number[][] = [];
        for (let i = 0; i < allPoints.length; i++) {
            distMatrix[i] = [];
            for (let j = 0; j < allPoints.length; j++) {
                if (i === j) {
                    distMatrix[i][j] = 0;
                    continue;
                }
                const dLat = allPoints[j].lat - allPoints[i].lat;
                const dLng = allPoints[j].lng - allPoints[i].lng;
                const a = Math.sin((dLat * Math.PI) / 180 / 2) ** 2 +
                    Math.cos((allPoints[i].lat * Math.PI) / 180) *
                    Math.cos((allPoints[j].lat * Math.PI) / 180) *
                    Math.sin((dLng * Math.PI) / 180 / 2) ** 2;
                const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                distMatrix[i][j] = Math.ceil((km / 30) * 60); // ETA in minutes
            }
        }

        // ─── Naive Order: visit jobs in the order given ─────────────────────
        let naiveTotal = 0;
        let prevIdx = 0;
        for (let j = 0; j < selectedJobs.length; j++) {
            naiveTotal += distMatrix[prevIdx][j + 1];
            prevIdx = j + 1;
        }

        // ─── Optimized: Nearest Neighbor greedy algorithm ───────────────────
        const visited = new Set<number>();
        const optimizedOrder: number[] = [];
        let current = 0; // Start at origin
        let optimizedTotal = 0;

        for (let step = 0; step < selectedJobs.length; step++) {
            let bestNext = -1;
            let bestEta = Infinity;

            for (let j = 1; j <= selectedJobs.length; j++) {
                if (visited.has(j)) continue;
                if (distMatrix[current][j] < bestEta) {
                    bestEta = distMatrix[current][j];
                    bestNext = j;
                }
            }

            if (bestNext === -1) break;
            visited.add(bestNext);
            optimizedOrder.push(bestNext);
            optimizedTotal += distMatrix[current][bestNext];
            current = bestNext;
        }

        // Build result
        const jobs = optimizedOrder.map((jobIdx, step) => {
            const prevPoint = step === 0 ? 0 : optimizedOrder[step - 1];
            const etaFromPrev = distMatrix[prevPoint][jobIdx];
            return {
                visitOrder: step + 1,
                label: allPoints[jobIdx].label,
                location: { lat: allPoints[jobIdx].lat, lng: allPoints[jobIdx].lng },
                etaFromPrevious: etaFromPrev,
                cumulativeEta: 0, // Filled below
            };
        });

        // Fill cumulative ETA
        let cumulative = 0;
        for (const job of jobs) {
            cumulative += job.etaFromPrevious;
            job.cumulativeEta = cumulative;
        }

        const gain = naiveTotal > 0
            ? Math.round(((naiveTotal - optimizedTotal) / naiveTotal) * 100)
            : 0;

        results.push({
            techName: worker.name,
            orgName: org.name,
            startLocation: { lat: startLat, lng: startLng },
            jobs,
            totalTravelMinutes: optimizedTotal,
            naiveTotalMinutes: naiveTotal,
            optimizationGainPercent: gain,
        });

        console.log(`    Naive: ${naiveTotal}min → Optimized: ${optimizedTotal}min (${gain}% improvement)`);
        jobs.forEach((j) => {
            console.log(`      ${j.visitOrder}. ${j.label} (+${j.etaFromPrevious}min, total: ${j.cumulativeEta}min)`);
        });
        console.log('');
    }

    return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🗺️  Maps & Dispatch Simulation Runner          ║');
    console.log('║   Testing: Marketplace + Dispatch + Itinerary    ║');
    console.log('╚══════════════════════════════════════════════════╝');

    const startTime = Date.now();

    // Verify simulation data exists
    const simOrgCount = await prisma.organization.count({
        where: { id: { startsWith: 'sim-maps-' } },
    });

    if (simOrgCount === 0) {
        console.error('\n❌ No simulation organizations found!');
        console.error('   Run: pnpm tsx scripts/simulation/maps/seed-map-orgs.ts\n');
        await prisma.$disconnect();
        process.exit(1);
    }

    console.log(`\n📊 Found ${simOrgCount} simulation organizations`);

    // ─── Run all suites ─────────────────────────────────────────────────

    const marketplace = await runMarketplaceSimulation();
    const dispatch = await runDispatchSimulation();
    const itinerary = await runItinerarySimulation();

    // ─── Summary ─────────────────────────────────────────────────────────

    const totalTimeMs = Date.now() - startTime;
    const totalApiCalls = marketplace.length; // Dispatch + itinerary use local calculations
    const avgMarketplaceMs = marketplace.length > 0
        ? Math.round(marketplace.reduce((s, r) => s + r.responseTimeMs, 0) / marketplace.length)
        : 0;
    const avgDispatchMs = dispatch.length > 0
        ? Math.round(dispatch.reduce((s, r) => s + r.responseTimeMs, 0) / dispatch.length)
        : 0;
    const marketplacePassRate = marketplace.length > 0
        ? `${marketplace.filter((r) => !r.error).length}/${marketplace.length}`
        : '0/0';
    const itineraryOptAvg = itinerary.length > 0
        ? `${Math.round(itinerary.reduce((s, r) => s + r.optimizationGainPercent, 0) / itinerary.length)}%`
        : 'N/A';

    const results: SimulationResults = {
        timestamp: new Date().toISOString(),
        config: SIM_CONFIG,
        marketplace,
        dispatch,
        itinerary,
        summary: {
            totalApiCalls,
            totalTimeMs,
            marketplacePassRate,
            avgMarketplaceResponseMs: avgMarketplaceMs,
            avgDispatchResponseMs: avgDispatchMs,
            itineraryOptimizationAvg: itineraryOptAvg,
        },
    };

    // ─── Generate Report ─────────────────────────────────────────────────

    const reportPath = await generateReport(results);

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   📊 SIMULATION COMPLETE                         ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Marketplace tests:  ${marketplace.length.toString().padEnd(5)}                        ║`);
    console.log(`║  Dispatch tests:     ${dispatch.length.toString().padEnd(5)}                        ║`);
    console.log(`║  Itinerary tests:    ${itinerary.length.toString().padEnd(5)}                        ║`);
    console.log(`║  Total API calls:    ${totalApiCalls.toString().padEnd(5)}                        ║`);
    console.log(`║  Total time:         ${(totalTimeMs / 1000).toFixed(1).padEnd(5)}s                       ║`);
    console.log(`║  Avg marketplace:    ${avgMarketplaceMs.toString().padEnd(5)}ms                      ║`);
    console.log(`║  Avg dispatch:       ${avgDispatchMs.toString().padEnd(5)}ms                      ║`);
    console.log(`║  Itinerary opt avg:  ${itineraryOptAvg.padEnd(5)}                        ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  📄 Report: ${reportPath.padEnd(36)} ║`);
    console.log('╚══════════════════════════════════════════════════╝\n');

    await prisma.$disconnect();
}

main().catch((error) => {
    console.error('Fatal error:', error);
    prisma.$disconnect();
    process.exit(1);
});
