const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: ['api.mercadopago.com'],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config) => {
    // Add alias for root src directory
    config.resolve.alias['@/src'] = path.resolve(__dirname, '../../src');

    // Ensure modules from root src can find dependencies in apps/web/node_modules
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ];

    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            // Content Security Policy
            // Allows: self, inline scripts/styles (Next.js requirement), external APIs
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://api.mercadopago.com https://api.openai.com https://wswhomo.afip.gov.ar https://wsaa.afip.gov.ar https://servicios1.afip.gov.ar https://*.sentry.io https://*.ingest.sentry.io wss:",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

// Sentry webpack plugin options
const sentryWebpackPluginOptions = {
  // Suppress source map uploading during local development
  silent: process.env.NODE_ENV !== 'production',

  // Organization and project in Sentry
  org: process.env.SENTRY_ORG || 'campotech',
  project: process.env.SENTRY_PROJECT || 'web',

  // Auth token for source map uploads (set in CI/CD)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only in production
  hideSourceMaps: process.env.NODE_ENV === 'production',

  // Disable telemetry
  telemetry: false,

  // Tunnel Sentry requests through the app to avoid ad blockers
  tunnelRoute: '/api/monitoring/tunnel',
};

// Wrap Next.js config with Sentry
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
