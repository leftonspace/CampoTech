/**
 * CampoTech Unified System Capacity & Health Monitor
 * ===================================================
 *
 * Integrates infrastructure capacity monitoring with operational health monitoring.
 * Provides a complete picture of system status:
 *
 * 1. OPERATIONAL HEALTH (from degradation/manager.ts)
 *    - "Is it working right now?"
 *    - Service status, circuit breakers, incidents
 *
 * 2. INFRASTRUCTURE CAPACITY (this file)
 *    - "How much room do we have left?"
 *    - Database size, connection limits, API quotas
 *
 * Usage:
 * - API: GET /api/system/capacity
 * - CLI: pnpm tsx scripts/check-capacity.ts
 */

import { PrismaClient } from '@prisma/client';
import { getSystemHealth, type SystemHealth } from '@/lib/degradation';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE TIER CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type ServiceTier = 'free' | 'pro' | 'team' | 'enterprise' | 'trial' | 'credit';

export interface ServiceLimit {
    name: string;
    tier: ServiceTier;
    limits: Record<string, number | boolean | string>;
    costs?: Record<string, number>;
    upgradeUrl?: string;
}

// Current tier configuration - UPDATE THESE AS YOU UPGRADE SERVICES
export const SERVICE_TIERS: Record<string, ServiceLimit> = {
    supabase: {
        name: 'Supabase (Database)',
        tier: 'free',
        limits: {
            databaseSizeMB: 500,
            storageGB: 1,
            pooledConnections: 50,
            directConnections: 2,
            bandwidthGB: 5,
            egressGB: 2,
            edgeFunctionInvocations: 500000,
        },
        upgradeUrl: 'https://supabase.com/dashboard/project/_/settings/billing',
    },
    vercel: {
        name: 'Vercel (Hosting)',
        tier: 'free',
        limits: {
            functionGBHours: 100,
            bandwidthGB: 100,
            buildsPerDay: 100,
            functionTimeoutSeconds: 10,
            concurrentExecutions: 10,
            edgeInvocations: 500000,
        },
        upgradeUrl: 'https://vercel.com/account/billing',
    },
    openai: {
        name: 'OpenAI (AI)',
        tier: 'credit',
        limits: {
            creditUSD: 10, // UPDATE: Your current credit balance
            requestsPerMinute: 60,
            tokensPerMinute: 60000,
        },
        costs: {
            gpt4oMiniInputPer1MTokens: 0.15,
            gpt4oMiniOutputPer1MTokens: 0.60,
            avgCostPerCall: 0.00045,
        },
        upgradeUrl: 'https://platform.openai.com/account/billing',
    },
    twilio: {
        name: 'Twilio (SMS)',
        tier: 'trial',
        limits: {
            creditUSD: 15,
            smsPerSecond: 1,
            trialRestrictions: true, // Must verify each recipient
        },
        costs: {
            smsArgentina: 0.10,
            smsUSA: 0.0079,
        },
        upgradeUrl: 'https://www.twilio.com/console/billing',
    },
    googleMaps: {
        name: 'Google Maps',
        tier: 'free',
        limits: {
            monthlyCreditsUSD: 200,
        },
        costs: {
            mapsJSPer1000: 7.00,
            geocodingPer1000: 5.00,
            directionsPer1000: 5.00,
            placesPer1000: 17.00,
        },
        upgradeUrl: 'https://console.cloud.google.com/billing',
    },
    resend: {
        name: 'Resend (Email)',
        tier: 'free',
        limits: {
            emailsPerMonth: 100,
            emailsPerDay: 100,
            domains: 1,
        },
        upgradeUrl: 'https://resend.com/settings/billing',
    },
    whatsapp: {
        name: 'WhatsApp Business',
        tier: 'free',
        limits: {
            freeServiceConversationsPerMonth: 1000,
            phoneNumbers: 2,
        },
        costs: {
            marketingConversationARG: 0.0625,
            utilityConversationARG: 0.0188,
            authenticationARG: 0.0315,
        },
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CAPACITY STATUS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CapacityLevel = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface ResourceCapacity {
    name: string;
    current: number;
    limit: number;
    unit: string;
    percentUsed: number;
    status: CapacityLevel;
    daysUntilFull?: number;
    recommendation?: string;
}

export interface ServiceCapacity {
    id: string;
    name: string;
    tier: ServiceTier;
    status: CapacityLevel;
    resources: ResourceCapacity[];
    upgradeUrl?: string;
    estimatedMonthlyCost?: number;
    notes?: string[];
}

export interface UnifiedSystemStatus {
    timestamp: string;

    // Overall status
    overallHealth: CapacityLevel;
    overallCapacity: CapacityLevel;
    combined: CapacityLevel;

    // From degradation manager (operational health)
    operationalHealth: {
        status: SystemHealth['status'];
        message: string;
        healthyServices: number;
        totalServices: number;
        degradedFeatures: number;
        activeIncidents: number;
    };

    // Infrastructure capacity
    infrastructureCapacity: {
        services: ServiceCapacity[];
        bottlenecks: Bottleneck[];
    };

    // Business metrics
    businessMetrics: {
        organizations: number;
        jobs: number;
        customers: number;
        users: number;
        databaseSizeMB: number;
    };

    // Estimates
    estimates: {
        maxConcurrentUsers: number;
        maxMonthlyOrganizations: number;
        daysUntilCritical: number;
        recommendedUpgradeAt: number; // org count
        mttrHours?: number; // mean time to recovery
    };

    // Actionable recommendations
    recommendations: Recommendation[];
}

export interface Bottleneck {
    service: string;
    resource: string;
    severity: 'warning' | 'critical';
    percentUsed: number;
    message: string;
}

export interface Recommendation {
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: 'upgrade' | 'configuration' | 'optimization' | 'monitoring';
    title: string;
    description: string;
    action?: string;
    estimatedCost?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CAPACITY CHECK
// ═══════════════════════════════════════════════════════════════════════════════

async function checkDatabaseCapacity(prisma: PrismaClient): Promise<ServiceCapacity> {
    const tierConfig = SERVICE_TIERS.supabase;
    const limits = tierConfig.limits;
    const resources: ResourceCapacity[] = [];
    const notes: string[] = [];

    try {
        // Get database size
        const sizeResult = await prisma.$queryRaw<[{ size: bigint }]>`
      SELECT pg_database_size(current_database()) as size
    `;
        const sizeUsedMB = Number(sizeResult[0].size) / (1024 * 1024);
        const sizeLimitMB = limits.databaseSizeMB as number;
        const sizePercentUsed = (sizeUsedMB / sizeLimitMB) * 100;

        resources.push({
            name: 'Database Size',
            current: Math.round(sizeUsedMB * 100) / 100,
            limit: sizeLimitMB,
            unit: 'MB',
            percentUsed: Math.round(sizePercentUsed * 10) / 10,
            status: sizePercentUsed > 90 ? 'critical' : sizePercentUsed > 70 ? 'warning' : 'healthy',
            daysUntilFull: estimateDaysUntilFull(sizeUsedMB, sizeLimitMB, 0.5), // Assume 0.5MB/day growth
            recommendation: sizePercentUsed > 70 ? 'Upgrade to Supabase Pro for 8GB' : undefined,
        });

        // Get table counts for business metrics tracking
        const [orgCount, jobCount, _customerCount, _userCount] = await Promise.all([
            prisma.organization.count(),
            prisma.job.count(),
            prisma.customer.count(),
            prisma.user.count(),
        ]);

        // Connection pool (estimated usage)
        const poolLimit = limits.pooledConnections as number;
        const estimatedActiveConnections = 5; // Typical for low traffic
        resources.push({
            name: 'Connection Pool',
            current: estimatedActiveConnections,
            limit: poolLimit,
            unit: 'connections',
            percentUsed: (estimatedActiveConnections / poolLimit) * 100,
            status: 'healthy',
            recommendation:
                orgCount > 50
                    ? 'Monitor connection usage during peak hours'
                    : undefined,
        });

        // Determine overall status
        const worstStatus = resources.reduce<CapacityLevel>((acc, r) => {
            if (r.status === 'critical') return 'critical';
            if (r.status === 'warning' && acc !== 'critical') return 'warning';
            return acc;
        }, 'healthy');

        // Add notes
        notes.push(`${orgCount} organizations, ${jobCount} jobs stored`);
        if (tierConfig.tier === 'free') {
            notes.push('Free tier: Consider upgrading before 50 organizations');
        }

        return {
            id: 'supabase',
            name: tierConfig.name,
            tier: tierConfig.tier,
            status: worstStatus,
            resources,
            upgradeUrl: tierConfig.upgradeUrl,
            notes,
        };
    } catch (error) {
        return {
            id: 'supabase',
            name: tierConfig.name,
            tier: tierConfig.tier,
            status: 'unknown',
            resources: [{
                name: 'Database',
                current: 0,
                limit: limits.databaseSizeMB as number,
                unit: 'MB',
                percentUsed: 0,
                status: 'unknown',
                recommendation: `Unable to check: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            upgradeUrl: tierConfig.upgradeUrl,
            notes: ['Unable to connect to database'],
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTHER SERVICE CAPACITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

function checkOpenAICapacity(estimatedDailyCalls: number): ServiceCapacity {
    const tierConfig = SERVICE_TIERS.openai;
    const limits = tierConfig.limits;
    const costs = tierConfig.costs!;

    const creditRemaining = limits.creditUSD as number;
    const costPerCall = costs.avgCostPerCall;
    const estimatedCallsRemaining = Math.floor(creditRemaining / costPerCall);
    const daysRemaining = estimatedDailyCalls > 0
        ? Math.floor(estimatedCallsRemaining / estimatedDailyCalls)
        : 999;

    const percentUsed = 100 - ((estimatedCallsRemaining / 22000) * 100); // 22000 is max calls for $10

    return {
        id: 'openai',
        name: tierConfig.name,
        tier: tierConfig.tier,
        status: daysRemaining < 3 ? 'critical' : daysRemaining < 7 ? 'warning' : 'healthy',
        resources: [{
            name: 'API Credit',
            current: creditRemaining,
            limit: 10, // Initial credit
            unit: 'USD',
            percentUsed: Math.max(0, percentUsed),
            status: daysRemaining < 3 ? 'critical' : daysRemaining < 7 ? 'warning' : 'healthy',
            daysUntilFull: daysRemaining,
            recommendation: daysRemaining < 14 ? 'Set up auto-billing to avoid disruption' : undefined,
        }],
        upgradeUrl: tierConfig.upgradeUrl,
        notes: [
            `~${estimatedCallsRemaining.toLocaleString()} AI calls remaining`,
            `At ${estimatedDailyCalls} calls/day = ${daysRemaining} days`,
        ],
    };
}

function checkTwilioCapacity(): ServiceCapacity {
    const tierConfig = SERVICE_TIERS.twilio;
    const limits = tierConfig.limits;
    const costs = tierConfig.costs!;

    const creditRemaining = limits.creditUSD as number;
    const smsRemaining = Math.floor(creditRemaining / costs.smsArgentina);

    return {
        id: 'twilio',
        name: tierConfig.name,
        tier: tierConfig.tier,
        status: smsRemaining < 50 ? 'critical' : limits.trialRestrictions ? 'warning' : 'healthy',
        resources: [{
            name: 'Trial Credit',
            current: creditRemaining,
            limit: 15,
            unit: 'USD',
            percentUsed: ((15 - creditRemaining) / 15) * 100,
            status: smsRemaining < 50 ? 'critical' : 'warning',
            recommendation: 'Upgrade to paid account before production launch',
        }],
        upgradeUrl: tierConfig.upgradeUrl,
        notes: [
            `Trial account: ~${smsRemaining} SMS remaining`,
            '⚠️ Trial restricts outbound to verified numbers only',
            'Must upgrade before accepting real customers',
        ],
    };
}

function checkResendCapacity(): ServiceCapacity {
    const tierConfig = SERVICE_TIERS.resend;
    const limits = tierConfig.limits;

    return {
        id: 'resend',
        name: tierConfig.name,
        tier: tierConfig.tier,
        status: 'warning', // Free tier is always a warning for production
        resources: [{
            name: 'Monthly Emails',
            current: 0, // Would need API call to get actual usage
            limit: limits.emailsPerMonth as number,
            unit: 'emails',
            percentUsed: 0,
            status: 'warning',
            recommendation: '100 emails/month too limited for production',
        }],
        upgradeUrl: tierConfig.upgradeUrl,
        notes: [
            'Free tier: 100 emails/month',
            'Upgrade before launch ($20/mo for 5,000 emails)',
        ],
    };
}

function checkGoogleMapsCapacity(): ServiceCapacity {
    const tierConfig = SERVICE_TIERS.googleMaps;
    const limits = tierConfig.limits;

    return {
        id: 'googleMaps',
        name: tierConfig.name,
        tier: tierConfig.tier,
        status: 'healthy',
        resources: [{
            name: 'Monthly Credit',
            current: 0, // Would need API call
            limit: limits.monthlyCreditsUSD as number,
            unit: 'USD',
            percentUsed: 0,
            status: 'healthy',
            recommendation: undefined,
        }],
        upgradeUrl: tierConfig.upgradeUrl,
        notes: [
            '$200/month free credit (auto-applied)',
            '~28,000 map loads included',
        ],
    };
}

function checkVercelCapacity(): ServiceCapacity {
    const tierConfig = SERVICE_TIERS.vercel;

    return {
        id: 'vercel',
        name: tierConfig.name,
        tier: tierConfig.tier,
        status: 'healthy',
        resources: [{
            name: 'Function GB-Hours',
            current: 0, // Would need Vercel API
            limit: tierConfig.limits.functionGBHours as number,
            unit: 'GB-hours',
            percentUsed: 0,
            status: 'healthy',
        }],
        upgradeUrl: tierConfig.upgradeUrl,
        notes: [
            'Free tier: 100 GB-hours/month',
            '10 second function timeout',
            'Upgrade for 60 second timeout + more concurrency',
        ],
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED STATUS BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

export async function getUnifiedSystemStatus(
    prisma: PrismaClient,
    options?: {
        estimatedDailyAICalls?: number;
        skipOperationalHealth?: boolean;
    }
): Promise<UnifiedSystemStatus> {
    const timestamp = new Date().toISOString();
    const estimatedDailyAICalls = options?.estimatedDailyAICalls ?? 100;

    // Get operational health from degradation manager
    let operationalHealth: UnifiedSystemStatus['operationalHealth'];
    let systemHealth: SystemHealth | null = null;

    if (!options?.skipOperationalHealth) {
        try {
            systemHealth = await getSystemHealth();
            operationalHealth = {
                status: systemHealth.status,
                message: systemHealth.message,
                healthyServices: systemHealth.healthyCount,
                totalServices: systemHealth.totalServices,
                degradedFeatures: systemHealth.degradedCount,
                activeIncidents: systemHealth.activeIncidents.length,
            };
        } catch {
            operationalHealth = {
                status: 'major_outage',
                message: 'Unable to check operational health',
                healthyServices: 0,
                totalServices: 7,
                degradedFeatures: 8,
                activeIncidents: 0,
            };
        }
    } else {
        operationalHealth = {
            status: 'operational',
            message: 'Skipped',
            healthyServices: 0,
            totalServices: 0,
            degradedFeatures: 0,
            activeIncidents: 0,
        };
    }

    // Check infrastructure capacity
    const [database, openai, twilio, resend, googleMaps, vercel] = await Promise.all([
        checkDatabaseCapacity(prisma),
        Promise.resolve(checkOpenAICapacity(estimatedDailyAICalls)),
        Promise.resolve(checkTwilioCapacity()),
        Promise.resolve(checkResendCapacity()),
        Promise.resolve(checkGoogleMapsCapacity()),
        Promise.resolve(checkVercelCapacity()),
    ]);

    const services = [database, openai, twilio, resend, googleMaps, vercel];

    // Get business metrics
    let businessMetrics: UnifiedSystemStatus['businessMetrics'];
    try {
        const [orgCount, jobCount, customerCount, userCount] = await Promise.all([
            prisma.organization.count(),
            prisma.job.count(),
            prisma.customer.count(),
            prisma.user.count(),
        ]);

        const sizeResult = await prisma.$queryRaw<[{ size: bigint }]>`
      SELECT pg_database_size(current_database()) as size
    `;

        businessMetrics = {
            organizations: orgCount,
            jobs: jobCount,
            customers: customerCount,
            users: userCount,
            databaseSizeMB: Math.round(Number(sizeResult[0].size) / (1024 * 1024) * 100) / 100,
        };
    } catch {
        businessMetrics = {
            organizations: 0,
            jobs: 0,
            customers: 0,
            users: 0,
            databaseSizeMB: 0,
        };
    }

    // Identify bottlenecks
    const bottlenecks: Bottleneck[] = [];
    for (const service of services) {
        for (const resource of service.resources) {
            if (resource.status === 'critical' || resource.status === 'warning') {
                bottlenecks.push({
                    service: service.name,
                    resource: resource.name,
                    severity: resource.status === 'critical' ? 'critical' : 'warning',
                    percentUsed: resource.percentUsed,
                    message: `${resource.name} at ${resource.percentUsed.toFixed(1)}% (${resource.current}/${resource.limit} ${resource.unit})`,
                });
            }
        }
    }

    // Sort bottlenecks by severity
    bottlenecks.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return b.percentUsed - a.percentUsed;
    });

    // Calculate overall statuses
    const overallHealth = mapSystemHealthToCapacityLevel(operationalHealth.status);
    const overallCapacity = services.reduce<CapacityLevel>((acc, s) => {
        if (s.status === 'critical') return 'critical';
        if (s.status === 'warning' && acc !== 'critical') return 'warning';
        return acc;
    }, 'healthy');

    const combined: CapacityLevel =
        overallHealth === 'critical' || overallCapacity === 'critical'
            ? 'critical'
            : overallHealth === 'warning' || overallCapacity === 'warning'
                ? 'warning'
                : 'healthy';

    // Generate recommendations
    const recommendations = generateRecommendations(services, businessMetrics, bottlenecks);

    // Calculate estimates
    const maxConcurrentUsers = Math.floor(
        (SERVICE_TIERS.supabase.limits.pooledConnections as number) / 0.5
    );

    const dbSizeLimit = SERVICE_TIERS.supabase.limits.databaseSizeMB as number;
    const avgOrgSizeMB = 0.5;
    const remainingMB = dbSizeLimit - businessMetrics.databaseSizeMB;
    const maxMonthlyOrganizations = Math.floor(remainingMB / avgOrgSizeMB);

    // Days until critical (find minimum)
    const daysUntilCritical = Math.min(
        ...services.flatMap(s =>
            s.resources
                .filter(r => r.daysUntilFull !== undefined)
                .map(r => r.daysUntilFull!)
        ),
        999
    );

    return {
        timestamp,
        overallHealth,
        overallCapacity,
        combined,
        operationalHealth,
        infrastructureCapacity: {
            services,
            bottlenecks,
        },
        businessMetrics,
        estimates: {
            maxConcurrentUsers,
            maxMonthlyOrganizations,
            daysUntilCritical: daysUntilCritical === Infinity ? 999 : daysUntilCritical,
            recommendedUpgradeAt: 50, // Organizations
        },
        recommendations,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function estimateDaysUntilFull(current: number, limit: number, dailyGrowth: number): number {
    if (dailyGrowth <= 0) return 999;
    const remaining = limit - current;
    return Math.floor(remaining / dailyGrowth);
}

function mapSystemHealthToCapacityLevel(status: SystemHealth['status']): CapacityLevel {
    switch (status) {
        case 'operational':
            return 'healthy';
        case 'degraded':
            return 'warning';
        case 'partial_outage':
        case 'major_outage':
            return 'critical';
        default:
            return 'unknown';
    }
}

function generateRecommendations(
    services: ServiceCapacity[],
    metrics: UnifiedSystemStatus['businessMetrics'],
    bottlenecks: Bottleneck[]
): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Critical: Twilio is on trial
    const twilio = services.find(s => s.id === 'twilio');
    if (twilio?.tier === 'trial') {
        recommendations.push({
            priority: 'critical',
            category: 'upgrade',
            title: 'Twilio en modo prueba',
            description: 'No puedes enviar SMS a números no verificados. Actualiza antes de aceptar clientes.',
            action: 'Upgrade to paid account',
            estimatedCost: '~$20/month',
        });
    }

    // High: Resend limit too low
    const resend = services.find(s => s.id === 'resend');
    if (resend?.tier === 'free') {
        recommendations.push({
            priority: 'high',
            category: 'upgrade',
            title: 'Resend muy limitado (100 emails/mes)',
            description: 'Insuficiente para producción. Un cliente activo puede generar 10+ emails/mes.',
            action: 'Upgrade to Pro ($20/mo)',
            estimatedCost: '$20/month',
        });
    }

    // Medium: OpenAI credit running low
    const openai = services.find(s => s.id === 'openai');
    const openaiDays = openai?.resources[0]?.daysUntilFull;
    if (openaiDays && openaiDays < 14) {
        recommendations.push({
            priority: openaiDays < 3 ? 'critical' : 'high',
            category: 'upgrade',
            title: 'Crédito OpenAI bajo',
            description: `Solo ~${openaiDays} días restantes con uso actual.`,
            action: 'Configure auto-billing',
            estimatedCost: '~$20-50/month (usage-based)',
        });
    }

    // Medium: Database approaching limits
    const database = services.find(s => s.id === 'supabase');
    const dbPercent = database?.resources.find(r => r.name === 'Database Size')?.percentUsed;
    if (dbPercent && dbPercent > 50) {
        recommendations.push({
            priority: dbPercent > 80 ? 'critical' : 'high',
            category: 'upgrade',
            title: 'Base de datos llenándose',
            description: `${dbPercent.toFixed(1)}% usado. Free tier: 500MB. Pro: 8GB.`,
            action: 'Upgrade Supabase to Pro',
            estimatedCost: '$25/month',
        });
    }

    // Low: Approaching upgrade threshold
    if (metrics.organizations > 30 && metrics.organizations < 50) {
        recommendations.push({
            priority: 'medium',
            category: 'upgrade',
            title: 'Prepararse para escalar',
            description: `${metrics.organizations} organizaciones. Planifica upgrades al llegar a 50.`,
            action: 'Review infrastructure upgrade plan',
        });
    }

    // Monitoring: Sentry not configured
    if (!process.env.SENTRY_DSN) {
        recommendations.push({
            priority: 'medium',
            category: 'monitoring',
            title: 'Sentry no configurado',
            description: 'Sin monitoreo de errores en producción. Configura SENTRY_DSN.',
            action: 'Set SENTRY_DSN environment variable',
            estimatedCost: 'Free tier available',
        });
    }

    // Add bottleneck-based recommendations
    for (const bottleneck of bottlenecks.slice(0, 3)) {
        if (!recommendations.some(r => r.title.includes(bottleneck.service))) {
            recommendations.push({
                priority: bottleneck.severity === 'critical' ? 'critical' : 'high',
                category: 'upgrade',
                title: `${bottleneck.service}: ${bottleneck.resource} al límite`,
                description: bottleneck.message,
            });
        }
    }

    // Sort by priority
    const priorityOrder: Record<Recommendation['priority'], number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
    };

    return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSOLE FORMATTER
// ═══════════════════════════════════════════════════════════════════════════════

export function formatUnifiedReport(status: UnifiedSystemStatus): string {
    const lines: string[] = [];
    const statusEmoji = {
        healthy: '✅',
        warning: '⚠️',
        critical: '🔴',
        unknown: '❓',
    };

    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════════════════════╗');
    lines.push('║              CAMPOTECH UNIFIED SYSTEM STATUS                             ║');
    lines.push('╠══════════════════════════════════════════════════════════════════════════╣');
    lines.push(`║  Timestamp: ${status.timestamp.padEnd(62)}║`);
    lines.push(`║  Overall: ${statusEmoji[status.combined]} ${status.combined.toUpperCase().padEnd(65)}║`);
    lines.push('╚══════════════════════════════════════════════════════════════════════════╝');
    lines.push('');

    // Operational Health
    lines.push('┌─────────────────────────────────────────────────────────────────────────┐');
    lines.push('│ 🔧 OPERATIONAL HEALTH (Is it working?)                                  │');
    lines.push('├─────────────────────────────────────────────────────────────────────────┤');
    lines.push(`│  Status: ${statusEmoji[mapSystemHealthToCapacityLevel(status.operationalHealth.status)]} ${status.operationalHealth.status.padEnd(64)}│`);
    lines.push(`│  Message: ${status.operationalHealth.message.substring(0, 63).padEnd(63)}│`);
    lines.push(`│  Services: ${status.operationalHealth.healthyServices}/${status.operationalHealth.totalServices} healthy    Degraded Features: ${status.operationalHealth.degradedFeatures}    Incidents: ${status.operationalHealth.activeIncidents}`.padEnd(76) + '│');
    lines.push('└─────────────────────────────────────────────────────────────────────────┘');
    lines.push('');

    // Infrastructure Capacity
    lines.push('┌─────────────────────────────────────────────────────────────────────────┐');
    lines.push('│ 📊 INFRASTRUCTURE CAPACITY (How much room left?)                        │');
    lines.push('├─────────────────────────────────────────────────────────────────────────┤');

    for (const service of status.infrastructureCapacity.services) {
        const emoji = statusEmoji[service.status];
        lines.push(`│  ${emoji} ${service.name} (${service.tier})`.padEnd(75) + '│');
        for (const resource of service.resources) {
            const bar = generateProgressBar(resource.percentUsed, 20);
            lines.push(`│     ${resource.name}: ${bar} ${resource.percentUsed.toFixed(1)}% (${resource.current}/${resource.limit} ${resource.unit})`.substring(0, 75).padEnd(75) + '│');
        }
    }

    lines.push('└─────────────────────────────────────────────────────────────────────────┘');
    lines.push('');

    // Business Metrics
    lines.push('┌─────────────────────────────────────────────────────────────────────────┐');
    lines.push('│ 📈 BUSINESS METRICS                                                     │');
    lines.push('├─────────────────────────────────────────────────────────────────────────┤');
    lines.push(`│  Organizations: ${status.businessMetrics.organizations}    Jobs: ${status.businessMetrics.jobs}    Customers: ${status.businessMetrics.customers}    Users: ${status.businessMetrics.users}`.padEnd(75) + '│');
    lines.push(`│  Database Size: ${status.businessMetrics.databaseSizeMB} MB`.padEnd(75) + '│');
    lines.push('└─────────────────────────────────────────────────────────────────────────┘');
    lines.push('');

    // Estimates
    lines.push('┌─────────────────────────────────────────────────────────────────────────┐');
    lines.push('│ 🎯 CAPACITY ESTIMATES                                                   │');
    lines.push('├─────────────────────────────────────────────────────────────────────────┤');
    lines.push(`│  Max concurrent users: ~${status.estimates.maxConcurrentUsers}`.padEnd(75) + '│');
    lines.push(`│  Max organizations (before DB full): ~${status.estimates.maxMonthlyOrganizations}`.padEnd(75) + '│');
    lines.push(`│  Days until critical: ${status.estimates.daysUntilCritical === 999 ? '∞' : '~' + status.estimates.daysUntilCritical}`.padEnd(75) + '│');
    lines.push(`│  Recommended upgrade at: ${status.estimates.recommendedUpgradeAt} organizations`.padEnd(75) + '│');
    lines.push('└─────────────────────────────────────────────────────────────────────────┘');
    lines.push('');

    // Bottlenecks
    if (status.infrastructureCapacity.bottlenecks.length > 0) {
        lines.push('┌─────────────────────────────────────────────────────────────────────────┐');
        lines.push('│ 🚨 BOTTLENECKS                                                          │');
        lines.push('├─────────────────────────────────────────────────────────────────────────┤');
        for (const b of status.infrastructureCapacity.bottlenecks.slice(0, 5)) {
            const emoji = b.severity === 'critical' ? '🔴' : '⚠️';
            lines.push(`│  ${emoji} ${b.message}`.substring(0, 75).padEnd(75) + '│');
        }
        lines.push('└─────────────────────────────────────────────────────────────────────────┘');
        lines.push('');
    }

    // Recommendations
    lines.push('┌─────────────────────────────────────────────────────────────────────────┐');
    lines.push('│ 💡 RECOMMENDATIONS                                                      │');
    lines.push('├─────────────────────────────────────────────────────────────────────────┤');

    for (const rec of status.recommendations.slice(0, 6)) {
        const emoji =
            rec.priority === 'critical' ? '🔴' :
                rec.priority === 'high' ? '🟠' :
                    rec.priority === 'medium' ? '🟡' : '🟢';
        lines.push(`│  ${emoji} [${rec.priority.toUpperCase()}] ${rec.title}`.substring(0, 75).padEnd(75) + '│');
        lines.push(`│     ${rec.description.substring(0, 68)}`.padEnd(75) + '│');
        if (rec.estimatedCost) {
            lines.push(`│     Cost: ${rec.estimatedCost}`.padEnd(75) + '│');
        }
    }

    lines.push('└─────────────────────────────────────────────────────────────────────────┘');
    lines.push('');

    return lines.join('\n');
}

function generateProgressBar(percent: number, width: number): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(Math.min(filled, width)) + '░'.repeat(Math.max(empty, 0));

    if (percent > 90) return `[${bar}]`;
    if (percent > 70) return `[${bar}]`;
    return `[${bar}]`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY EXPORTS (for backwards compatibility with existing capacity endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

export const SERVICE_LIMITS = SERVICE_TIERS;
export { getUnifiedSystemStatus as checkSystemCapacity };
export { formatUnifiedReport as formatCapacityReport };
