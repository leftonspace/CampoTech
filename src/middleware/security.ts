/**
 * Security Middleware
 * ===================
 *
 * Comprehensive security middleware for Express
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import { Redis } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════════════
// HELMET CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configure Helmet for security headers
 */
export function createHelmetMiddleware(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.openai.com', 'https://graph.facebook.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for WhatsApp media
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const ALLOWED_ORIGINS = [
  'https://app.campotech.com.ar',
  'https://staging.campotech.com.ar',
  'https://admin.campotech.com.ar',
];

if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000');
  ALLOWED_ORIGINS.push('http://localhost:3001');
  ALLOWED_ORIGINS.push('http://localhost:8081'); // Expo
}

/**
 * Configure CORS
 */
export function createCorsMiddleware(): RequestHandler {
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Organization-ID',
      'X-Client-Version',
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    maxAge: 86400, // 24 hours
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create rate limiter with Redis store
 */
export function createRateLimiter(
  redis: Redis,
  config: RateLimitConfig
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: config.message || 'Too many requests, please try again later.',
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: config.keyGenerator || ((req) => {
      // Use user ID if authenticated, otherwise IP
      const userId = (req as any).user?.id;
      return userId || req.ip || 'anonymous';
    }),
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/ready' || req.path === '/live';
    },
    handler: (req, res) => {
      res.status(429).json({
        error: config.message || 'Too many requests',
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
    },
  });
}

/**
 * Standard API rate limiter (100 requests per minute)
 */
export function createApiRateLimiter(redis: Redis): RateLimitRequestHandler {
  return createRateLimiter(redis, {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many API requests, please try again in a minute.',
  });
}

/**
 * Auth rate limiter (10 attempts per 15 minutes)
 */
export function createAuthRateLimiter(redis: Redis): RateLimitRequestHandler {
  return createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many login attempts, please try again in 15 minutes.',
    keyGenerator: (req) => {
      // Use IP for auth endpoints
      return `auth:${req.ip}`;
    },
  });
}

/**
 * WhatsApp webhook rate limiter (higher limit for Meta)
 */
export function createWebhookRateLimiter(redis: Redis): RateLimitRequestHandler {
  return createRateLimiter(redis, {
    windowMs: 60 * 1000, // 1 minute
    max: 500, // Higher limit for webhooks
    message: 'Webhook rate limit exceeded.',
    keyGenerator: () => 'webhook:whatsapp', // Single bucket for all webhook requests
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize request body to prevent NoSQL injection
 */
export function sanitizeRequest(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query) as typeof req.query;
    }
    if (req.params) {
      req.params = sanitizeObject(req.params) as typeof req.params;
    }
    next();
  };
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Remove keys starting with $ (MongoDB operators)
    if (key.startsWith('$')) {
      continue;
    }

    if (typeof value === 'string') {
      // Remove null bytes
      sanitized[key] = value.replace(/\0/g, '');
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item: any) =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST ID
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add request ID for tracing
 */
export function addRequestId(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || generateRequestId();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  };
}

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IP VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that requests come from trusted proxies
 */
export function validateTrustedProxy(trustedProxies: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const forwardedFor = req.headers['x-forwarded-for'];

    if (forwardedFor && process.env.NODE_ENV === 'production') {
      const clientIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0].trim();

      // Log suspicious requests from unknown sources
      if (!trustedProxies.some((proxy) => clientIp.startsWith(proxy))) {
        console.warn(`Request from untrusted proxy: ${clientIp}`);
      }
    }

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYLOAD SIZE LIMIT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check payload size to prevent DoS
 */
export function checkPayloadSize(maxSizeBytes: number = 1024 * 1024): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        error: 'Payload too large',
        maxSize: `${Math.round(maxSizeBytes / 1024)}KB`,
      });
      return;
    }

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSITE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create all security middleware
 */
export function createSecurityMiddleware(redis: Redis): RequestHandler[] {
  return [
    addRequestId(),
    createHelmetMiddleware(),
    createCorsMiddleware(),
    sanitizeRequest(),
    createApiRateLimiter(redis),
    checkPayloadSize(),
  ];
}
