# CampoTech Data Flow Documentation

**Version:** 1.0
**Last Updated:** December 2024
**Phase:** 9.11 Technical Architecture Documentation

## Overview

This document describes the key data flows in CampoTech, showing how information moves through the system for critical operations.

## 1. Authentication Flow (OTP-Based)

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │      │   API    │      │  Redis   │      │ WhatsApp │      │    DB    │
│  (App)   │      │ Gateway  │      │          │      │   API    │      │          │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │                 │
     │  POST /auth/otp │                 │                 │                 │
     │  {phone}        │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Generate OTP   │                 │                 │
     │                 │  (6 digits)     │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │  Store OTP      │                 │                 │
     │                 │  (TTL: 5min)    │                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │  Send Template  │                 │
     │                 │─────────────────┼────────────────▶│                 │
     │                 │                 │  otp_login      │                 │
     │                 │                 │  {code: xxxxxx} │                 │
     │                 │                 │                 │                 │
     │  200 OK         │                 │                 │                 │
     │◀────────────────│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │                 │                 │
     │  POST /auth/    │                 │                 │                 │
     │  verify         │                 │                 │                 │
     │  {phone, otp}   │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Verify OTP     │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │                 │                 │                 │
     │                 │  Find/Create    │                 │                 │
     │                 │  User           │                 │                 │
     │                 │─────────────────┼─────────────────┼────────────────▶│
     │                 │                 │                 │                 │
     │                 │  Create Session │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │  (TTL: 7 days)  │                 │                 │
     │                 │                 │                 │                 │
     │  {accessToken,  │                 │                 │                 │
     │   refreshToken} │                 │                 │                 │
     │◀────────────────│                 │                 │                 │
     │                 │                 │                 │                 │
```

**Key Points:**
- OTP stored in Redis with 5-minute TTL
- Maximum 3 attempts before cooldown
- WhatsApp-first, SMS fallback
- JWT tokens: 15min access, 7-day refresh

## 2. Job Lifecycle Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           JOB STATE MACHINE                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐          │
│   │ PENDING  │───▶│ SCHEDULED │───▶│ EN_CAMINO │───▶│ WORKING  │          │
│   │ (Draft)  │    │(Assigned) │    │(En Route) │    │(On Site) │          │
│   └──────────┘    └───────────┘    └───────────┘    └────┬─────┘          │
│        │               │                │                 │                │
│        ▼               ▼                ▼                 ▼                │
│   ┌──────────────────────────────────────────────────────────────┐        │
│   │                      CANCELLED                                │        │
│   └──────────────────────────────────────────────────────────────┘        │
│                                                                            │
│                              ┌─────────────┐                               │
│                              │  COMPLETED  │                               │
│                              │  (Finished) │                               │
│                              └─────────────┘                               │
│                                    │                                       │
│                                    ▼                                       │
│                              ┌─────────────┐                               │
│                              │  INVOICED   │                               │
│                              │   (Billed)  │                               │
│                              └─────────────┘                               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

TRANSITIONS AND SIDE EFFECTS:

pending → scheduled
  └─▶ Send job_assigned_tech notification to technician
  └─▶ Send job_scheduled_customer notification to customer

scheduled → en_camino
  └─▶ Create tracking session (4h token)
  └─▶ Send tracking_link_customer notification
  └─▶ Start background location updates

en_camino → working (auto on arrival < 100m)
  └─▶ Complete tracking session
  └─▶ Send technician_arrived notification

working → completed
  └─▶ Capture signature (optional)
  └─▶ Upload photos
  └─▶ Calculate totals
  └─▶ Send job_completed notifications

completed → invoiced
  └─▶ Generate AFIP electronic invoice
  └─▶ Send invoice via WhatsApp
```

## 3. WhatsApp Message Aggregation Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ WhatsApp │      │  Webhook │      │Aggregator│      │  Redis   │      │   GPT    │
│   API    │      │  Handler │      │ Service  │      │  Buffer  │      │  Process │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │                 │
     │  Message 1      │                 │                 │                 │
     │  "Hola"         │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  handleInbound  │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │  Create Buffer  │                 │
     │                 │                 │  (8s window)    │                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │                 │                 │
     │  Message 2      │                 │                 │                 │
     │  "necesito"     │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  handleInbound  │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │  Append to      │                 │
     │                 │                 │  Buffer         │                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │                 │                 │
     │  Message 3      │                 │                 │                 │
     │  "un técnico"   │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  handleInbound  │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │  Append +       │                 │
     │                 │                 │  Trigger Found  │                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │  ("necesito")   │                 │
     │                 │                 │                 │                 │
     │                 │                 │  Flush Buffer   │                 │
     │                 │                 │◀────────────────│                 │
     │                 │                 │                 │                 │
     │                 │                 │  Aggregated:    │                 │
     │                 │                 │  "Hola necesito │                 │
     │                 │                 │   un técnico"   │                 │
     │                 │                 │─────────────────┼────────────────▶│
     │                 │                 │                 │                 │
     │                 │                 │                 │   Extract       │
     │                 │                 │                 │   Intent        │
     │                 │                 │                 │                 │
     │                 │                 │◀────────────────┼─────────────────│
     │                 │                 │  {intent:       │                 │
     │                 │                 │   request_tech} │                 │
     │                 │                 │                 │                 │
```

**Aggregation Window Rules:**
- Default window: 8 seconds
- Immediate triggers: "necesito", "quiero", "cuanto", "?", urgency words
- Maximum messages per buffer: 10
- Fallback: Process immediately if Redis unavailable

## 4. Live Tracking Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ Mobile   │      │ Tracking │      │   ETA    │      │ Customer │      │ WhatsApp │
│   App    │      │   API    │      │ Service  │      │  Page    │      │          │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │                 │
     │  Job → EN_CAMINO│                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Create Session │                 │                 │
     │                 │  (token: abc123)│                 │                 │
     │                 │                 │                 │                 │
     │                 │─────────────────┼─────────────────┼────────────────▶│
     │                 │  Send tracking  │                 │  template:      │
     │                 │  link           │                 │  tracking_link  │
     │                 │                 │                 │                 │
     │                 │                 │                 │                 │
     │  POST /tracking/│                 │                 │                 │
     │  update         │                 │                 │                 │
     │  {lat, lng}     │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Calculate ETA  │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │                 │                 │                 │
     │                 │  {eta: 15min,   │                 │                 │
     │                 │   mode: driving}│                 │                 │
     │                 │◀────────────────│                 │                 │
     │                 │                 │                 │                 │
     │                 │  Store in Redis │                 │                 │
     │                 │  (TTL: 5min)    │                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │  GET /track/    │                 │
     │                 │                 │  abc123 (poll)  │                 │
     │                 │◀────────────────┼─────────────────│                 │
     │                 │                 │                 │                 │
     │                 │  {position,     │                 │                 │
     │                 │   eta, mode}    │                 │                 │
     │                 │─────────────────┼────────────────▶│                 │
     │                 │                 │                 │                 │
     │                 │                 │                 │  Animate        │
     │                 │                 │                 │  marker         │
     │                 │                 │                 │                 │
     │  Distance <100m │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │  (auto-arrival) │                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Session →      │                 │                 │
     │                 │  ARRIVED        │                 │                 │
     │                 │─────────────────┼─────────────────┼────────────────▶│
     │                 │                 │                 │  template:      │
     │                 │                 │                 │  tech_arrived   │
     │                 │                 │                 │                 │
```

**Tracking Details:**
- Position updates: Every 30 seconds
- ETA calculation: Haversine formula with speed adjustment
- Movement modes: driving (>40km/h), walking (5-40km/h), stationary (<5km/h)
- Auto-arrival: When distance < 100m from destination
- Token expiry: 4 hours

## 5. Invoice Generation Flow (AFIP)

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│   API    │      │ Invoice  │      │   WSAA   │      │  WSFEv1  │      │    DB    │
│  Route   │      │ Service  │      │  (Auth)  │      │(Invoices)│      │          │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │                 │
     │  POST /invoices │                 │                 │                 │
     │  {jobId, items} │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Check Token    │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │                 │                 │                 │
     │                 │  Token expired? │                 │                 │
     │                 │  Request new    │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │  LoginCMS       │                 │
     │                 │                 │  (certificate)  │                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │                 │                 │
     │                 │                 │  WSAA Token     │                 │
     │                 │                 │  (12h validity) │                 │
     │                 │                 │◀────────────────│                 │
     │                 │                 │                 │                 │
     │                 │  Token OK       │                 │                 │
     │                 │◀────────────────│                 │                 │
     │                 │                 │                 │                 │
     │                 │  Get Last       │                 │                 │
     │                 │  Invoice #      │                 │                 │
     │                 │─────────────────┼────────────────▶│                 │
     │                 │                 │                 │                 │
     │                 │  FECompUltimo   │                 │                 │
     │                 │  Autorizado     │                 │                 │
     │                 │◀────────────────┼─────────────────│                 │
     │                 │                 │                 │                 │
     │                 │  Submit Invoice │                 │                 │
     │                 │─────────────────┼────────────────▶│                 │
     │                 │                 │                 │                 │
     │                 │                 │  FECAESolicitar │                 │
     │                 │                 │  {items, totals}│                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │                 │                 │
     │                 │                 │  CAE + Expiry   │                 │
     │                 │                 │◀────────────────│                 │
     │                 │                 │                 │                 │
     │                 │  CAE Response   │                 │                 │
     │                 │◀────────────────┼─────────────────│                 │
     │                 │                 │                 │                 │
     │                 │  Generate PDF   │                 │                 │
     │                 │  + QR Code      │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Save Invoice   │                 │                 │
     │                 │─────────────────┼─────────────────┼────────────────▶│
     │                 │                 │                 │                 │
     │  {invoice, pdf} │                 │                 │                 │
     │◀────────────────│                 │                 │                 │
     │                 │                 │                 │                 │
```

**AFIP Integration Details:**
- WSAA tokens valid for 12 hours
- 10-minute safety margin for token refresh
- QR code per RG 4291 format
- Invoice types: A (responsable inscripto), B (consumidor final), C (monotributista)

## 6. Notification Delivery Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Event   │      │  Notif   │      │ Channels │      │ External │      │    DB    │
│ Trigger  │      │ Service  │      │ Handler  │      │   APIs   │      │          │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │                 │
     │  Event:         │                 │                 │                 │
     │  JOB_ASSIGNED   │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Get User       │                 │                 │
     │                 │  Preferences    │                 │                 │
     │                 │─────────────────┼─────────────────┼────────────────▶│
     │                 │                 │                 │                 │
     │                 │  {whatsapp: ON  │                 │                 │
     │                 │   push: ON      │                 │                 │
     │                 │   email: OFF}   │                 │                 │
     │                 │◀────────────────┼─────────────────┼─────────────────│
     │                 │                 │                 │                 │
     │                 │  Check Quiet    │                 │                 │
     │                 │  Hours          │                 │                 │
     │                 │  (timezone)     │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Queue Messages │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │  WhatsApp       │                 │
     │                 │                 │  Template       │                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │  job_assigned   │  Meta API       │
     │                 │                 │                 │                 │
     │                 │                 │  Push           │                 │
     │                 │                 │  Notification   │                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │                 │  Expo/FCM       │
     │                 │                 │                 │                 │
     │                 │                 │  Log Delivery   │                 │
     │                 │                 │─────────────────┼────────────────▶│
     │                 │                 │  {channel,      │                 │
     │                 │                 │   status,       │                 │
     │                 │                 │   timestamp}    │                 │
     │                 │                 │                 │                 │
```

**Channel Priority (Argentine Market):**
1. WhatsApp (95% of notifications)
2. Push (mobile app)
3. SMS (fallback only)
4. Email (documents only)

## 7. Offline Sync Flow (Mobile)

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Mobile  │      │ Waterme- │      │  Sync    │      │   API    │      │  Server  │
│    UI    │      │  lonDB   │      │ Service  │      │  Client  │      │    DB    │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │                 │
     │  User Action    │                 │                 │                 │
     │  (offline)      │                 │                 │                 │
     │────────────────▶│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Write Local    │                 │                 │
     │                 │  + Mark Dirty   │                 │                 │
     │                 │                 │                 │                 │
     │                 │  Queue for Sync │                 │                 │
     │                 │────────────────▶│                 │                 │
     │                 │  {type, data,   │                 │                 │
     │                 │   priority}     │                 │                 │
     │                 │                 │                 │                 │
     │  Optimistic UI  │                 │                 │                 │
     │◀────────────────│                 │                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │                 │                 │
     │      ... Network Restored ...     │                 │                 │
     │                 │                 │                 │                 │
     │                 │                 │  Process Queue  │                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │                 │                 │
     │                 │                 │                 │  Push Changes   │
     │                 │                 │                 │────────────────▶│
     │                 │                 │                 │                 │
     │                 │                 │                 │  200 OK /       │
     │                 │                 │                 │  409 Conflict   │
     │                 │                 │                 │◀────────────────│
     │                 │                 │                 │                 │
     │                 │                 │  Pull Changes   │                 │
     │                 │                 │────────────────▶│                 │
     │                 │                 │                 │                 │
     │                 │                 │                 │  GET /sync?     │
     │                 │                 │                 │  since=ts       │
     │                 │                 │                 │────────────────▶│
     │                 │                 │                 │                 │
     │                 │                 │                 │  {changes}      │
     │                 │                 │                 │◀────────────────│
     │                 │                 │                 │                 │
     │                 │                 │  Apply Changes  │                 │
     │                 │                 │◀────────────────│                 │
     │                 │                 │                 │                 │
     │                 │  Merge/Resolve  │                 │                 │
     │                 │◀────────────────│                 │                 │
     │                 │                 │                 │                 │
     │  Update UI      │                 │                 │                 │
     │◀────────────────│                 │                 │                 │
     │                 │                 │                 │                 │
```

**Sync Strategy:**
- Local-first writes with optimistic UI
- Queue operations by priority (high: job status, medium: updates, low: reads)
- Pull server changes after push completes
- Conflict resolution: last-write-wins or user prompt for critical data
- Maximum queue size: 50 operations

## Related Documentation

- [High-Level Architecture](./high-level-architecture.md)
- [Security Architecture](./security-architecture.md)
- [Integration Patterns](./integration-patterns.md)
