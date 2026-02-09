import type { NextConfig } from "next";

/**
 * Admin Portal Next.js Configuration
 * ===================================
 *
 * Security-hardened configuration for the high-privilege admin portal.
 * Implements comprehensive CSP and security headers.
 *
 * @security Phase 11 Remediation - M-UI-01
 */
const nextConfig: NextConfig = {
  // Remove X-Powered-By header
  poweredByHeader: false,

  // Strict React mode
  reactStrictMode: true,

  /**
   * Security Headers Configuration
   * 
   * Implements OWASP recommended security headers:
   * - Content-Security-Policy
   * - X-Frame-Options
   * - X-Content-Type-Options
   * - Strict-Transport-Security
   * - Referrer-Policy
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Restrict browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Enforce HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              // Default: only self
              "default-src 'self'",
              // Scripts: self + inline (required for Next.js)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Styles: self + inline (required for CSS-in-JS)
              "style-src 'self' 'unsafe-inline'",
              // Images: self + data URIs
              "img-src 'self' data: https:",
              // Fonts: self
              "font-src 'self' data:",
              // API connections: self + main app API
              "connect-src 'self' https://*.campotech.com https://*.sentry.io",
              // Prevent framing
              "frame-ancestors 'none'",
              // Restrict form submissions
              "form-action 'self'",
              // Restrict base URI
              "base-uri 'self'",
              // Block plugins
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
