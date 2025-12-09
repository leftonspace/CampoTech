# CampoTech Technical Architecture Overview

**Version:** 1.0
**Last Updated:** December 2024

## Executive Summary

CampoTech is a comprehensive field service management platform designed specifically for the Argentine market. The system enables small and medium businesses to manage their operations entirely from a mobile phone, with a strong emphasis on WhatsApp-first communication.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                     │
├─────────────────────────────────────────────────────────────────────┤
│  📱 Mobile App        🖥️ Web Dashboard        💬 WhatsApp          │
│  (React Native)       (Next.js 14)           (Business API)        │
└──────────┬───────────────────┬───────────────────────┬─────────────┘
           │                   │                       │
           ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js API Routes (/api/*)                                        │
│  ├── /api/auth/*           Authentication (OTP-based)               │
│  ├── /api/jobs/*           Job management                           │
│  ├── /api/users/*          User/team management                     │
│  ├── /api/customers/*      Customer database                        │
│  ├── /api/invoices/*       AFIP invoicing                           │
│  ├── /api/tracking/*       Live location tracking                   │
│  ├── /api/whatsapp/*       WhatsApp conversations                   │
│  ├── /api/notifications/*  Multi-channel notifications              │
│  └── /api/webhooks/*       External service callbacks               │
└──────────┬─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC                                  │
├─────────────────────────────────────────────────────────────────────┤
│  src/                                                               │
│  ├── integrations/                                                  │
│  │   ├── whatsapp/          WhatsApp Business API + Aggregation     │
│  │   ├── voice-ai/          Whisper + GPT extraction                │
│  │   ├── mercadopago/       Payments + OAuth                        │
│  │   └── afip/              Argentine tax invoicing (WSAA/WSFEv1)   │
│  ├── modules/                                                       │
│  │   ├── tracking/          Live location tracking                  │
│  │   ├── notifications/     Multi-channel delivery                  │
│  │   ├── users/             User management + onboarding            │
│  │   └── ...                                                        │
│  ├── workers/               Background job processing               │
│  └── lib/                   Shared utilities                        │
└──────────┬─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Prisma)        Redis                 S3/R2             │
│  ├── Users                  ├── Sessions          ├── Job photos    │
│  ├── Organizations          ├── Rate limits       ├── Invoices PDF  │
│  ├── Jobs                   ├── Job queues        └── Attachments   │
│  ├── Customers              ├── Message buffers                     │
│  ├── Invoices               ├── Tracking cache                      │
│  ├── Tracking sessions      └── Cache                               │
│  └── Notifications                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Mobile-First Architecture
- All features available on mobile app
- Optimized for low-end Android devices
- Offline-capable with sync

### 2. WhatsApp-First Communication (Argentine Market)
- 95%+ of notifications via WhatsApp
- SMS only for OTP and fallback
- Email for documents only

### 3. Multi-Tenant Isolation
- Row-Level Security (RLS) on all tables
- Organization-scoped data access
- Tenant-aware job queues

### 4. Resilience Patterns
- Circuit breakers for external services
- Queue-based processing with retry
- Panic mode for critical failures

## Key Components

### Authentication
- OTP-based (WhatsApp/SMS)
- JWT tokens (15min access, 7-day refresh)
- Role-based access control (5 roles)

### Job Management
- State machine: pending → scheduled → en_camino → working → completed
- Photo capture and signature
- Line items with tax calculation

### AFIP Integration
- WSAA token management (10min safety margin)
- WSFEv1 electronic invoicing
- QR code generation (RG 4291)

### WhatsApp Integration
- Message aggregation (8s buffer)
- Voice message transcription
- Template-based notifications
- 24-hour window enforcement

### Live Tracking
- 30-second position updates
- ETA calculation
- Customer tracking page
- Token-based access

### Notification System
- Multi-channel delivery (WhatsApp, Push, Email, SMS)
- Quiet hours support
- Event-based preferences
- Job reminders (24h, 1h, 30min)

## Security

- Encryption at rest (AES-256-GCM)
- HTTPS everywhere
- Webhook signature validation
- Rate limiting
- Audit logging with hash chain

## External Services

| Service | Purpose | Tier |
|---------|---------|------|
| Meta WhatsApp Business API | Messaging | Required |
| OpenAI (Whisper + GPT-4o) | Voice AI | Optional |
| MercadoPago | Payments | Required |
| AFIP | Invoicing | Required |
| Twilio | SMS fallback | Optional |
| Google Maps / Mapbox | Tracking | Tier-based |

## Directory Structure

```
/
├── apps/
│   ├── web/              Next.js web application
│   └── mobile/           React Native mobile app
├── src/
│   ├── integrations/     External service integrations
│   ├── modules/          Domain modules
│   ├── workers/          Background workers
│   └── lib/              Shared libraries
├── database/
│   └── migrations/       SQL migrations
├── docs/
│   └── architecture/     Technical documentation
└── architecture/         Design documents
```

## Deployment

- **Platform:** Vercel (Web) / Expo (Mobile)
- **Database:** PostgreSQL (Supabase/Neon)
- **Cache:** Redis (Upstash)
- **Storage:** S3/R2 compatible
- **Workers:** Vercel Functions / Railway

## Performance Targets

- Cold start: < 4 seconds (mobile)
- API latency: < 200ms (p95)
- Message delivery: < 5 seconds
- Offline sync: < 30 seconds
