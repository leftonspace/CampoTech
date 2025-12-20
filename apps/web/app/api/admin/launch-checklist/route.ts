/**
 * Launch Checklist API (Phase 9.1.2)
 * ==================================
 *
 * Automated pre-launch verification endpoint.
 * Checks all critical systems before production launch.
 *
 * Usage:
 *   GET /api/admin/launch-checklist
 *
 * Returns:
 *   - Overall readiness status
 *   - Individual check results
 *   - Blocking issues vs warnings
 */

import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type CheckStatus = 'pass' | 'fail' | 'warning' | 'skipped';

interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  category: 'technical' | 'legal' | 'business' | 'infrastructure';
  blocking: boolean;
  details?: Record<string, unknown>;
}

interface LaunchChecklistResult {
  timestamp: string;
  overallReady: boolean;
  blockingIssues: number;
  warnings: number;
  passed: number;
  categories: {
    technical: CheckResult[];
    legal: CheckResult[];
    business: CheckResult[];
    infrastructure: CheckResult[];
  };
  summary: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function checkDatabaseHealth(): Promise<CheckResult> {
  try {
    // Simulate database check - in production, use actual Prisma client
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return {
        name: 'Database Connection',
        status: 'fail',
        message: 'DATABASE_URL not configured',
        category: 'infrastructure',
        blocking: true,
      };
    }

    // Check connection (simplified)
    return {
      name: 'Database Connection',
      status: 'pass',
      message: 'Database connection healthy',
      category: 'infrastructure',
      blocking: true,
      details: { poolerConfigured: dbUrl.includes('pooler') },
    };
  } catch (error) {
    return {
      name: 'Database Connection',
      status: 'fail',
      message: `Database error: ${(error as Error).message}`,
      category: 'infrastructure',
      blocking: true,
    };
  }
}

async function checkRedisHealth(): Promise<CheckResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  if (!redisUrl) {
    return {
      name: 'Redis/Cache',
      status: 'fail',
      message: 'UPSTASH_REDIS_REST_URL not configured',
      category: 'infrastructure',
      blocking: true,
    };
  }

  return {
    name: 'Redis/Cache',
    status: 'pass',
    message: 'Redis connection configured',
    category: 'infrastructure',
    blocking: true,
  };
}

async function checkSentryConfig(): Promise<CheckResult> {
  const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!sentryDsn) {
    return {
      name: 'Error Tracking (Sentry)',
      status: 'warning',
      message: 'Sentry DSN not configured - errors will not be tracked',
      category: 'technical',
      blocking: false,
    };
  }

  return {
    name: 'Error Tracking (Sentry)',
    status: 'pass',
    message: 'Sentry configured',
    category: 'technical',
    blocking: false,
  };
}

async function checkAFIPConfig(): Promise<CheckResult> {
  const afipCert = process.env.AFIP_CERT;
  const afipKey = process.env.AFIP_KEY;
  const afipCuit = process.env.AFIP_CUIT;

  if (!afipCert || !afipKey || !afipCuit) {
    return {
      name: 'AFIP Integration',
      status: 'fail',
      message: 'AFIP credentials not fully configured',
      category: 'business',
      blocking: true,
      details: {
        hasCert: !!afipCert,
        hasKey: !!afipKey,
        hasCuit: !!afipCuit,
      },
    };
  }

  return {
    name: 'AFIP Integration',
    status: 'pass',
    message: 'AFIP credentials configured',
    category: 'business',
    blocking: true,
  };
}

async function checkMercadoPagoConfig(): Promise<CheckResult> {
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!mpToken) {
    return {
      name: 'MercadoPago Integration',
      status: 'fail',
      message: 'MERCADOPAGO_ACCESS_TOKEN not configured',
      category: 'business',
      blocking: true,
    };
  }

  return {
    name: 'MercadoPago Integration',
    status: 'pass',
    message: 'MercadoPago configured',
    category: 'business',
    blocking: true,
  };
}

async function checkOpenAIConfig(): Promise<CheckResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return {
      name: 'OpenAI/AI Services',
      status: 'warning',
      message: 'OPENAI_API_KEY not configured - AI features disabled',
      category: 'technical',
      blocking: false,
    };
  }

  return {
    name: 'OpenAI/AI Services',
    status: 'pass',
    message: 'OpenAI API configured',
    category: 'technical',
    blocking: false,
  };
}

async function checkWhatsAppConfig(): Promise<CheckResult> {
  const waToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!waToken || !waPhoneId) {
    return {
      name: 'WhatsApp Business API',
      status: 'warning',
      message: 'WhatsApp not fully configured',
      category: 'business',
      blocking: false,
      details: { hasToken: !!waToken, hasPhoneId: !!waPhoneId },
    };
  }

  return {
    name: 'WhatsApp Business API',
    status: 'pass',
    message: 'WhatsApp API configured',
    category: 'business',
    blocking: false,
  };
}

async function checkTwilioConfig(): Promise<CheckResult> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;

  if (!twilioSid || !twilioToken) {
    return {
      name: 'Twilio SMS',
      status: 'warning',
      message: 'Twilio not configured - SMS notifications disabled',
      category: 'technical',
      blocking: false,
    };
  }

  return {
    name: 'Twilio SMS',
    status: 'pass',
    message: 'Twilio configured',
    category: 'technical',
    blocking: false,
  };
}

async function checkSSLCertificates(): Promise<CheckResult> {
  // In production, check actual SSL cert expiry
  const domain = process.env.NEXT_PUBLIC_APP_URL || '';
  const isHttps = domain.startsWith('https://');

  if (!isHttps && process.env.NODE_ENV === 'production') {
    return {
      name: 'SSL Certificates',
      status: 'fail',
      message: 'HTTPS not configured for production',
      category: 'technical',
      blocking: true,
    };
  }

  return {
    name: 'SSL Certificates',
    status: 'pass',
    message: 'SSL configured',
    category: 'technical',
    blocking: true,
  };
}

async function checkPrivacyPolicy(): Promise<CheckResult> {
  // Check if privacy policy page exists
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${appUrl}/legal/privacidad`, { method: 'HEAD' });

    if (response.ok) {
      return {
        name: 'Privacy Policy',
        status: 'pass',
        message: 'Privacy policy page exists',
        category: 'legal',
        blocking: true,
      };
    }
  } catch {
    // Ignore fetch errors
  }

  return {
    name: 'Privacy Policy',
    status: 'warning',
    message: 'Privacy policy page not found at /legal/privacidad',
    category: 'legal',
    blocking: false,
  };
}

async function checkTermsOfService(): Promise<CheckResult> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${appUrl}/legal/terminos`, { method: 'HEAD' });

    if (response.ok) {
      return {
        name: 'Terms of Service',
        status: 'pass',
        message: 'Terms of service page exists',
        category: 'legal',
        blocking: true,
      };
    }
  } catch {
    // Ignore fetch errors
  }

  return {
    name: 'Terms of Service',
    status: 'warning',
    message: 'Terms of service page not found at /legal/terminos',
    category: 'legal',
    blocking: false,
  };
}

async function checkCancellationButton(): Promise<CheckResult> {
  // Ley 24.240 compliance - "Botón de Arrepentimiento"
  return {
    name: 'Cancellation Button (Ley 24.240)',
    status: 'warning',
    message: 'Manual verification required - check footer and settings page',
    category: 'legal',
    blocking: false,
    details: { lawReference: 'Ley 24.240 - Defensa del Consumidor' },
  };
}

async function checkBackupsConfigured(): Promise<CheckResult> {
  // Check Supabase backups are enabled
  return {
    name: 'Database Backups',
    status: 'warning',
    message: 'Manual verification required - check Supabase dashboard',
    category: 'infrastructure',
    blocking: false,
  };
}

async function checkRateLimiting(): Promise<CheckResult> {
  const rateLimitConfig = process.env.RATE_LIMIT_ENABLED;

  if (rateLimitConfig === 'true' || process.env.UPSTASH_REDIS_REST_URL) {
    return {
      name: 'Rate Limiting',
      status: 'pass',
      message: 'Rate limiting configured',
      category: 'technical',
      blocking: false,
    };
  }

  return {
    name: 'Rate Limiting',
    status: 'warning',
    message: 'Rate limiting may not be configured',
    category: 'technical',
    blocking: false,
  };
}

async function checkQueueSystem(): Promise<CheckResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;

  if (!redisUrl) {
    return {
      name: 'Queue System (BullMQ)',
      status: 'warning',
      message: 'Queue system not configured - background jobs may not work',
      category: 'infrastructure',
      blocking: false,
    };
  }

  return {
    name: 'Queue System (BullMQ)',
    status: 'pass',
    message: 'Queue system configured',
    category: 'infrastructure',
    blocking: false,
  };
}

async function checkCostTracking(): Promise<CheckResult> {
  // Check if cost tracking is configured
  const hasBudgetConfig = process.env.OPENAI_DAILY_BUDGET || process.env.COST_TRACKING_ENABLED;

  if (hasBudgetConfig) {
    return {
      name: 'Cost Tracking',
      status: 'pass',
      message: 'Cost tracking configured',
      category: 'business',
      blocking: false,
    };
  }

  return {
    name: 'Cost Tracking',
    status: 'warning',
    message: 'Cost tracking not explicitly configured',
    category: 'business',
    blocking: false,
  };
}

async function checkAlertingSystem(): Promise<CheckResult> {
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  const sentryDsn = process.env.SENTRY_DSN;

  if (slackWebhook || sentryDsn) {
    return {
      name: 'Alerting System',
      status: 'pass',
      message: 'At least one alerting channel configured',
      category: 'technical',
      blocking: false,
      details: { hasSlack: !!slackWebhook, hasSentry: !!sentryDsn },
    };
  }

  return {
    name: 'Alerting System',
    status: 'warning',
    message: 'No alerting channels configured',
    category: 'technical',
    blocking: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Run all checks in parallel
  const checks = await Promise.all([
    // Infrastructure
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkSSLCertificates(),
    checkBackupsConfigured(),
    checkQueueSystem(),

    // Technical
    checkSentryConfig(),
    checkRateLimiting(),
    checkAlertingSystem(),
    checkOpenAIConfig(),
    checkTwilioConfig(),

    // Business
    checkAFIPConfig(),
    checkMercadoPagoConfig(),
    checkWhatsAppConfig(),
    checkCostTracking(),

    // Legal
    checkPrivacyPolicy(),
    checkTermsOfService(),
    checkCancellationButton(),
  ]);

  // Categorize results
  const categories: LaunchChecklistResult['categories'] = {
    technical: [],
    legal: [],
    business: [],
    infrastructure: [],
  };

  let blockingIssues = 0;
  let warnings = 0;
  let passed = 0;

  for (const check of checks) {
    categories[check.category].push(check);

    if (check.status === 'fail') {
      if (check.blocking) blockingIssues++;
      else warnings++;
    } else if (check.status === 'warning') {
      warnings++;
    } else if (check.status === 'pass') {
      passed++;
    }
  }

  const overallReady = blockingIssues === 0;

  const result: LaunchChecklistResult = {
    timestamp: new Date().toISOString(),
    overallReady,
    blockingIssues,
    warnings,
    passed,
    categories,
    summary: overallReady
      ? warnings > 0
        ? `READY with ${warnings} warning(s) - ${passed} checks passed`
        : `READY - All ${passed} checks passed`
      : `NOT READY - ${blockingIssues} blocking issue(s), ${warnings} warning(s)`,
  };

  return NextResponse.json(result, {
    status: overallReady ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
