# External Resource Security Guidelines

**Last Updated:** 2026-02-05  
**Security Phase:** Phase 11 Remediation (L-UI-02)

---

## Overview

This document provides guidelines for securely loading external resources (scripts, stylesheets, fonts, images) in CampoTech applications. Following these guidelines helps prevent supply chain attacks and ensures resource integrity.

---

## Subresource Integrity (SRI)

### What is SRI?

Subresource Integrity (SRI) is a security feature that enables browsers to verify that resources they fetch are delivered without unexpected manipulation. SRI uses cryptographic hashes to ensure the content matches what was expected.

### When to Use SRI

**Required for:**
- All external JavaScript files loaded from CDNs
- External CSS stylesheets from CDNs
- Any third-party library loaded via `<script>` or `<link>` tags

**Not required for:**
- Resources from same-origin (your own domain)
- Dynamically loaded resources (use CSP instead)
- Images (use CSP `img-src` directive instead)

---

## Implementation Guidelines

### 1. Adding External Scripts

When adding an external script, always include the `integrity` and `crossorigin` attributes:

```html
<!-- ❌ WRONG - No integrity check -->
<script src="https://cdn.example.com/library.js"></script>

<!-- ✅ CORRECT - With SRI -->
<script
  src="https://cdn.example.com/library@1.0.0.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>
```

### 2. Using Next.js Script Component

For Next.js applications, use the `Script` component with strategy and integrity:

```typescript
import Script from 'next/script';

export function ExternalScript() {
  return (
    <Script
      src="https://cdn.example.com/analytics.js"
      strategy="afterInteractive"
      integrity="sha384-..."
      crossOrigin="anonymous"
    />
  );
}
```

### 3. Generating SRI Hashes

#### Online Tools
- [SRI Hash Generator](https://www.srihash.org/)

#### Command Line (OpenSSL)
```bash
# Generate SHA-384 hash
curl -s https://cdn.example.com/library.js | openssl dgst -sha384 -binary | openssl base64 -A

# Output format for integrity attribute
echo "sha384-$(curl -s https://cdn.example.com/library.js | openssl dgst -sha384 -binary | openssl base64 -A)"
```

#### Node.js Script
```javascript
const crypto = require('crypto');
const https = require('https');

function generateSRI(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const hash = crypto.createHash('sha384').update(body).digest('base64');
        resolve(`sha384-${hash}`);
      });
    }).on('error', reject);
  });
}

// Usage
generateSRI('https://cdn.example.com/library.js')
  .then(hash => console.log(hash));
```

---

## Content Security Policy (CSP) Integration

External resources must also be whitelisted in the Content Security Policy. Located in:
- `apps/web/next.config.js`
- `apps/admin/next.config.ts`

### Adding a New External Domain

1. **Identify the resource type:**
   - Script → `script-src`
   - Stylesheet → `style-src`
   - Font → `font-src`
   - Image → `img-src`
   - API/XHR → `connect-src`

2. **Update CSP in next.config.js:**
```javascript
headers: [
  {
    source: '/:path*',
    headers: [
      {
        key: 'Content-Security-Policy',
        value: [
          // ... existing directives
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.example.com",
          // Add the domain to appropriate directive
        ].join('; '),
      },
    ],
  },
],
```

3. **Document the addition** in this file (see Approved External Resources below).

---

## Approved External Resources

### Currently Used

| Resource | Type | Domain | SRI Required | Notes |
|----------|------|--------|--------------|-------|
| Google Fonts | Font/CSS | fonts.googleapis.com, fonts.gstatic.com | No* | Google-hosted, versioned |
| MercadoPago API | API | api.mercadopago.com | N/A | API calls, not scripts |
| OpenAI API | API | api.openai.com | N/A | API calls |
| Sentry | SDK | *.sentry.io | Pre-bundled | Bundled via @sentry/nextjs |
| AFIP Web Services | API | wsaa.afip.gov.ar, wswhomo.afip.gov.ar | N/A | API calls |

*Google Fonts are loaded dynamically and don't support SRI, but the CSP restricts to only Google domains.

### Prohibited Resources

The following types of external resources are **NOT allowed** without explicit security review:

- Analytics scripts from untrusted providers
- Social media widgets/embeds
- Third-party chat widgets
- Advertising networks
- Any external JavaScript without SRI

---

## Review Process for New External Resources

Before adding any new external resource:

1. **Security Review Required**
   - Open a security review ticket
   - Document: What resource, why needed, who maintains it
   - Assess: Supply chain risk, data exposure, fallback strategy

2. **Technical Requirements**
   - Must support HTTPS
   - Must support SRI (for scripts/styles)
   - Must have a versioned/pinned URL (not `latest`)
   - Must be added to CSP

3. **Approval Chain**
   - Engineering Lead approval
   - Security review sign-off
   - Documentation update

---

## Incident Response

If an SRI check fails (browser blocks resource):

1. **Immediate:** The resource won't load, potentially breaking functionality
2. **Investigation:** Check if CDN was compromised or file was legitimately updated
3. **Resolution:**
   - If legitimate update: Generate new SRI hash, update code, deploy
   - If compromise: Remove resource, notify security team, assess impact

---

## References

- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [OWASP: Third-Party JavaScript Management](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html)
- [W3C: SRI Specification](https://www.w3.org/TR/SRI/)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)

---

*Document maintained by UI-SEC Agent as part of Phase 11 security controls.*
