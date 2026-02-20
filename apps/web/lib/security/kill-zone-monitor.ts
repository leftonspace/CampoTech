/**
 * Kill Zone Monitor — "Silent Alarm" Prisma Extension
 * =====================================================
 *
 * Phase: CERT-AR / Cybersecurity Breach Detection (Res. 580/2011 + Convenio 108+)
 *
 * Monitors the 3 critical "Kill Zones" where a breach would be catastrophic:
 *
 *   1. 🔴 FISCAL IDENTITY (Organization.afipPrivateKeyEncrypted)
 *      Risk: Mass export of private keys → fraudulent AFIP invoice signing
 *
 *   2. 🟠 REAL-TIME SURVEILLANCE (TechnicianLocation.latitude/longitude)
 *      Risk: Location scraping → physical stalking of technicians
 *
 *   3. 🟠 BUSINESS HIJACKING (WhatsAppBusinessAccount.accessToken)
 *      Risk: Token exfiltration → spam/scams from verified business numbers
 *
 * Architecture:
 *   Uses Prisma Client Extension ($extends) with query-level hooks.
 *   Prisma $use middleware is deprecated — this uses the modern $extends API.
 *
 * Detection Strategy:
 *   Normal operation reads 1 record at a time (e.g., sign 1 invoice).
 *   A breach reads many records at once (e.g., dump all keys).
 *   Thresholds are tuned to real usage patterns from the AFIPCredentialsService.
 *
 * @see .legal/Comprehensive_Review_of_Laws/1.2 CERT-AR
 * @see lib/services/afip-credentials.service.ts (normal access pattern: 1 org at a time)
 */

import { PrismaClient } from '@prisma/client';
import { checkAfipKeyAccess, checkLocationScraping, checkWhatsAppTokenAccess } from './tripwires';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SecurityAlertSeverity = 'WARNING' | 'CRITICAL' | 'LOCKDOWN';

export interface SecurityAlert {
    timestamp: string;
    severity: SecurityAlertSeverity;
    killZone: 'FISCAL_IDENTITY' | 'REAL_TIME_SURVEILLANCE' | 'BUSINESS_HIJACKING';
    model: string;
    operation: string;
    recordCount: number;
    threshold: number;
    userId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    query: string;
    metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// THRESHOLDS — Tuned to real access patterns
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Kill Zone 1: Organization table with AFIP keys
 * Normal: AFIPCredentialsService.getCredentials() reads 1 org at a time.
 * Suspicious: Any findMany() that selects AFIP encrypted fields.
 * Critical: Fetching > 10 records with key fields included.
 */
const AFIP_KEY_BULK_THRESHOLD = 10;

/**
 * Kill Zone 2: TechnicianLocation table
 * Normal: Dashboard reads 1 technician's location, or all for map view (bounded by org).
 * Suspicious: Cross-org reads, or reading all technicians.
 * Critical: Reading > 50 location records in a single query (entire fleet scraping).
 */
const LOCATION_BULK_THRESHOLD = 50;

/**
 * Kill Zone 3: WhatsAppBusinessAccount table
 * Normal: WhatsApp service reads 1 account at a time per org.
 * Suspicious: Any findMany() that returns > 5 accounts with accessToken.
 * Critical: Mass token harvesting.
 */
const WA_TOKEN_BULK_THRESHOLD = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Attempt to extract the requesting user's context from async local storage
 * or known patterns. In Next.js App Router, this context must be injected
 * by the calling code via the global _securityContext.
 */

interface SecurityContext {
    userId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}

/** Global mutable context — set per-request by middleware */
let _currentSecurityContext: SecurityContext = {
    userId: null,
    ipAddress: null,
    userAgent: null,
};

/**
 * Set the security context for the current request.
 * Call this from your auth middleware before any Prisma queries execute.
 */
export function setSecurityContext(ctx: Partial<SecurityContext>): void {
    _currentSecurityContext = {
        userId: ctx.userId ?? null,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
    };
}

/**
 * Clear the security context after the request completes.
 */
export function clearSecurityContext(): void {
    _currentSecurityContext = { userId: null, ipAddress: null, userAgent: null };
}

function getSecurityContext(): SecurityContext {
    return { ..._currentSecurityContext };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD DETECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Check if a Prisma `select` or `include` clause requests AFIP key fields */
function selectsAfipKeyFields(args: Record<string, unknown> | undefined): boolean {
    if (!args) return true; // No select = selects ALL fields (worst case)

    const select = args.select as Record<string, unknown> | undefined;

    // If there's no select clause, all fields are returned (including key fields)
    if (!select) return true;

    // Check if the sensitive fields are explicitly selected
    return !!(
        select.afipPrivateKeyEncrypted ||
        select.afipCertificateEncrypted
    );
}

/** Check if a Prisma `select` clause requests WA token fields */
function selectsWaTokenFields(args: Record<string, unknown> | undefined): boolean {
    if (!args) return true;

    const select = args.select as Record<string, unknown> | undefined;
    if (!select) return true;

    return !!(
        select.accessToken ||
        select.webhookSecret ||
        select.webhookVerifyToken ||
        select.verificationCode
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle a security alert. In production, this should:
 *   1. Log to structured logging (Sentry, Datadog, etc.)
 *   2. Write to the audit_logs table
 *   3. Send a Slack/PagerDuty notification
 *   4. Potentially trigger a kill-switch lockdown
 *
 * For now, we log to console with structured JSON and write to the DB.
 */
async function handleSecurityAlert(
    alert: SecurityAlert,
    prismaClient: PrismaClient
): Promise<void> {
    // 1. Structured console log (always — even if DB write fails)
    const logPrefix = alert.severity === 'LOCKDOWN'
        ? '🚨🚨🚨 LOCKDOWN'
        : alert.severity === 'CRITICAL'
            ? '🔴 CRITICAL'
            : '⚠️ WARNING';

    console.error(
        `[SECURITY_ALERT] ${logPrefix} — Kill Zone: ${alert.killZone}`,
        JSON.stringify(alert, null, 2)
    );

    // 2. Write to audit_logs table (fire-and-forget, don't block the query)
    try {
        // Use a system org ID for security alerts — they're platform-level events
        await prismaClient.$executeRaw`
      INSERT INTO "audit_logs" (
        "id", "organizationId", "userId", "action", "entityType", "entityId", "metadata", "ipAddress", "userAgent", "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        'SYSTEM',
        ${alert.userId},
        ${'SECURITY_ALERT'},
        ${alert.model},
        ${alert.killZone},
        ${JSON.stringify({
            severity: alert.severity,
            operation: alert.operation,
            recordCount: alert.recordCount,
            threshold: alert.threshold,
            query: alert.query,
            ...alert.metadata,
        })}::jsonb,
        ${alert.ipAddress},
        ${alert.userAgent},
        NOW()
      )
    `;
    } catch (dbError) {
        // If we can't log to DB, at least the console log got through
        console.error('[SECURITY_ALERT] Failed to write audit log:', dbError);
    }

    // 3. Trigger tripwire anomaly detection (rate-based)
    const ctx = getSecurityContext();
    const actor = ctx.userId ?? 'unknown';

    if (alert.killZone === 'FISCAL_IDENTITY') {
        await checkAfipKeyAccess(actor, alert.recordCount);
    } else if (alert.killZone === 'REAL_TIME_SURVEILLANCE') {
        await checkLocationScraping(actor, alert.recordCount);
    } else if (alert.killZone === 'BUSINESS_HIJACKING') {
        await checkWhatsAppTokenAccess(actor, alert.recordCount);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRISMA CLIENT EXTENSION — The "Silent Alarm"
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a Prisma Client Extension config that monitors Kill Zone queries.
 *
 * Usage in lib/prisma.ts:
 * ```ts
 * import { PrismaClient } from '@prisma/client';
 * import { createKillZoneMonitor } from '@/lib/security/kill-zone-monitor';
 *
 * const basePrisma = new PrismaClient();
 * export const prisma = basePrisma.$extends(createKillZoneMonitor(basePrisma));
 * ```
 *
 * NOTE: We pass the config object directly to $extends() instead of using
 * Prisma.defineExtension(), because the generated client may not export it
 * until the next `prisma generate` run.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createKillZoneMonitor(basePrisma: PrismaClient): any {
    return {
        name: 'kill-zone-monitor',
        query: {

            // ─────────────────────────────────────────────────────────────────────
            // KILL ZONE 1: Organization (AFIP Private Keys)
            // ─────────────────────────────────────────────────────────────────────
            organization: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
                    // Only alert if the query could return AFIP key fields
                    if (!selectsAfipKeyFields(args as Record<string, unknown>)) {
                        return query(args);
                    }

                    const result = await query(args);
                    const results = result as unknown[];
                    const count = Array.isArray(results) ? results.length : 0;

                    if (count > AFIP_KEY_BULK_THRESHOLD) {
                        const ctx = getSecurityContext();
                        await handleSecurityAlert({
                            timestamp: new Date().toISOString(),
                            severity: count > AFIP_KEY_BULK_THRESHOLD * 3 ? 'CRITICAL' : 'WARNING',
                            killZone: 'FISCAL_IDENTITY',
                            model: 'Organization',
                            operation: 'findMany',
                            recordCount: count,
                            threshold: AFIP_KEY_BULK_THRESHOLD,
                            userId: ctx.userId,
                            ipAddress: ctx.ipAddress,
                            userAgent: ctx.userAgent,
                            query: JSON.stringify({
                                where: (args as Record<string, unknown>)?.where ?? 'ALL',
                                select: (args as Record<string, unknown>)?.select ?? 'ALL_FIELDS',
                            }),
                            metadata: {
                                risk: 'Mass export of AFIP private keys — potential for fraudulent invoice signing',
                                afipFieldsRequested: true,
                            },
                        }, basePrisma);
                    }

                    return result;
                },
            },

            // ─────────────────────────────────────────────────────────────────────
            // KILL ZONE 2: TechnicianLocation (Real-time Surveillance)
            // ─────────────────────────────────────────────────────────────────────
            technicianLocation: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
                    const result = await query(args);
                    const results = result as unknown[];
                    const count = Array.isArray(results) ? results.length : 0;

                    if (count > LOCATION_BULK_THRESHOLD) {
                        const ctx = getSecurityContext();
                        await handleSecurityAlert({
                            timestamp: new Date().toISOString(),
                            severity: count > LOCATION_BULK_THRESHOLD * 2 ? 'CRITICAL' : 'WARNING',
                            killZone: 'REAL_TIME_SURVEILLANCE',
                            model: 'TechnicianLocation',
                            operation: 'findMany',
                            recordCount: count,
                            threshold: LOCATION_BULK_THRESHOLD,
                            userId: ctx.userId,
                            ipAddress: ctx.ipAddress,
                            userAgent: ctx.userAgent,
                            query: JSON.stringify({
                                where: (args as Record<string, unknown>)?.where ?? 'ALL',
                            }),
                            metadata: {
                                risk: 'Bulk location scraping — potential for stalking or physical harm',
                            },
                        }, basePrisma);
                    }

                    return result;
                },
            },

            // Also monitor the history table (even more dangerous — entire movement trails)
            technicianLocationHistory: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
                    const result = await query(args);
                    const results = result as unknown[];
                    const count = Array.isArray(results) ? results.length : 0;

                    // Lower threshold for history — this data is a complete movement trail
                    const historyThreshold = 100;
                    if (count > historyThreshold) {
                        const ctx = getSecurityContext();

                        // Extract how many unique technicians are being queried
                        const where = (args as Record<string, unknown>)?.where as Record<string, unknown> | undefined;
                        const targetsTechIds = where?.userId;

                        await handleSecurityAlert({
                            timestamp: new Date().toISOString(),
                            severity: count > historyThreshold * 5 ? 'CRITICAL' : 'WARNING',
                            killZone: 'REAL_TIME_SURVEILLANCE',
                            model: 'TechnicianLocationHistory',
                            operation: 'findMany',
                            recordCount: count,
                            threshold: historyThreshold,
                            userId: ctx.userId,
                            ipAddress: ctx.ipAddress,
                            userAgent: ctx.userAgent,
                            query: JSON.stringify({
                                where: where ?? 'ALL',
                                take: (args as Record<string, unknown>)?.take ?? 'UNLIMITED',
                            }),
                            metadata: {
                                risk: 'Bulk location history export — complete movement trail extraction',
                                targetsTechIds: targetsTechIds ?? 'ALL_TECHNICIANS',
                            },
                        }, basePrisma);
                    }

                    return result;
                },
            },

            // ─────────────────────────────────────────────────────────────────────
            // KILL ZONE 3: WhatsAppBusinessAccount (Access Token Theft)
            // ─────────────────────────────────────────────────────────────────────
            whatsAppBusinessAccount: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
                    if (!selectsWaTokenFields(args as Record<string, unknown>)) {
                        return query(args);
                    }

                    const result = await query(args);
                    const results = result as unknown[];
                    const count = Array.isArray(results) ? results.length : 0;

                    if (count > WA_TOKEN_BULK_THRESHOLD) {
                        const ctx = getSecurityContext();
                        await handleSecurityAlert({
                            timestamp: new Date().toISOString(),
                            severity: count > WA_TOKEN_BULK_THRESHOLD * 5 ? 'CRITICAL' : 'WARNING',
                            killZone: 'BUSINESS_HIJACKING',
                            model: 'WhatsAppBusinessAccount',
                            operation: 'findMany',
                            recordCount: count,
                            threshold: WA_TOKEN_BULK_THRESHOLD,
                            userId: ctx.userId,
                            ipAddress: ctx.ipAddress,
                            userAgent: ctx.userAgent,
                            query: JSON.stringify({
                                where: (args as Record<string, unknown>)?.where ?? 'ALL',
                                select: (args as Record<string, unknown>)?.select ?? 'ALL_FIELDS',
                            }),
                            metadata: {
                                risk: 'Bulk WhatsApp token harvesting — potential for mass spam/scam from verified numbers',
                                tokenFieldsRequested: true,
                            },
                        }, basePrisma);
                    }

                    return result;
                },
            },
        },
    };
}
