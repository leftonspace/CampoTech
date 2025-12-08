# CampoTech Master End-to-End Flow Diagrams

> Complete sequence diagrams and decision flows connecting all system modules.

---

## Table of Contents

1. [Flow A: Complete Customer Journey](#flow-a-complete-customer-journey)
2. [Flow B: External Failure Cascade](#flow-b-external-failure-cascade)
3. [Flow C: Offline Technician Sync](#flow-c-offline-technician-sync)
4. [Flow D: Abuse Detection](#flow-d-abuse-detection)
5. [Flow E: Voice AI Pipeline](#flow-e-voice-ai-pipeline)
6. [Flow F: Payment Lifecycle](#flow-f-payment-lifecycle)

---

## Flow A: Complete Customer Journey

### A.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE CUSTOMER JOURNEY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ INTAKE   │───▶│ SCHEDULE │───▶│ EXECUTE  │───▶│ INVOICE  │             │
│  │          │    │          │    │          │    │          │             │
│  │ WhatsApp │    │ Dispatch │    │ Technician│   │ AFIP CAE │             │
│  │ Voice    │    │ Calendar │    │ Mobile   │    │ PDF Gen  │             │
│  │ Manual   │    │ Assign   │    │ Photos   │    │          │             │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘             │
│       │                                               │                    │
│       │              ┌──────────┐    ┌──────────┐    │                    │
│       │              │ PAYMENT  │◀───│ NOTIFY   │◀───┘                    │
│       │              │          │    │          │                         │
│       │              │ MP Link  │    │ WhatsApp │                         │
│       │              │ Webhook  │    │ Invoice  │                         │
│       │              │ Reconcile│    │ Payment  │                         │
│       │              └──────────┘    └──────────┘                         │
│       │                   │                                               │
│       │                   ▼                                               │
│       │              ┌──────────┐                                         │
│       └─────────────▶│ COMPLETE │                                         │
│                      │          │                                         │
│                      │ Analytics│                                         │
│                      │ History  │                                         │
│                      └──────────┘                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### A.2 Detailed Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    
    participant C as Customer
    participant WA as WhatsApp API
    participant API as CampoTech API
    participant Q as Queue System
    participant AI as Voice AI
    participant DB as Database
    participant Tech as Technician App
    participant AFIP as AFIP Service
    participant MP as Mercado Pago
    
    %% === INTAKE PHASE ===
    rect rgb(240, 248, 255)
        Note over C,DB: PHASE 1: INTAKE (Customer Contact)
        
        alt Text Message
            C->>WA: Send WhatsApp text
            WA->>API: Webhook: incoming message
            API->>Q: Queue: whatsapp:inbound
            Q->>API: Process message
            API->>DB: Create/update customer
            API->>DB: Log message
        else Voice Message
            C->>WA: Send WhatsApp voice
            WA->>API: Webhook: voice message
            API->>Q: Queue: voice:transcription
            Q->>AI: Whisper transcription
            AI-->>Q: Transcription result
            Q->>Q: Queue: voice:extraction
            Q->>AI: GPT extraction
            AI-->>Q: Structured data
            
            alt High Confidence (≥70%)
                Q->>DB: Auto-create job
                Q->>Q: Queue: job:notification
            else Low Confidence (<70%)
                Q->>DB: Queue for human review
                API->>Tech: Push notification: review needed
            end
        else Manual Entry
            Tech->>API: POST /jobs
            API->>DB: Create job
        end
    end
    
    %% === SCHEDULING PHASE ===
    rect rgb(255, 250, 240)
        Note over API,Tech: PHASE 2: SCHEDULING
        
        API->>DB: Job created (status: pending)
        
        alt Auto-Assignment Enabled
            API->>DB: Query available technicians
            API->>DB: Check calendar conflicts
            API->>DB: Assign technician
        else Manual Assignment
            API->>Tech: Push: new job available
            Tech->>API: PATCH /jobs/{id}/assign
            API->>DB: Assign technician
        end
        
        API->>DB: Update status: scheduled
        API->>Q: Queue: job:notification (scheduled)
        Q->>WA: Send template: job_scheduled
        WA->>C: "Your appointment is confirmed for..."
    end
    
    %% === REMINDER PHASE ===
    rect rgb(248, 248, 255)
        Note over Q,C: PHASE 2.5: REMINDERS
        
        Q->>Q: Scheduler: 24h before
        Q->>WA: Send template: reminder_24h
        WA->>C: "Reminder: appointment tomorrow..."
        
        Q->>Q: Scheduler: 1h before
        Q->>WA: Send template: reminder_1h
        WA->>C: "Reminder: technician arriving in 1 hour..."
    end
    
    %% === EXECUTION PHASE ===
    rect rgb(240, 255, 240)
        Note over Tech,C: PHASE 3: EXECUTION
        
        Tech->>API: PATCH /jobs/{id}/status (en_camino)
        API->>DB: Update status, log location
        API->>Q: Queue: job:notification (en_camino)
        Q->>WA: Send template: technician_en_route
        WA->>C: "Juan is on the way. ETA: 15 min"
        
        Tech->>API: PATCH /jobs/{id}/status (working)
        API->>DB: Update status, record start time
        
        Tech->>API: POST /jobs/{id}/photos (before)
        API->>DB: Store photo metadata
        
        Note over Tech: Technician performs work
        
        Tech->>API: POST /jobs/{id}/photos (after)
        API->>DB: Store photo metadata
        
        Tech->>API: POST /jobs/{id}/complete
        Note right of Tech: Includes: photos, signature, line items
        API->>DB: Update status: completed
        API->>DB: Record end time, duration
    end
    
    %% === INVOICING PHASE ===
    rect rgb(255, 255, 240)
        Note over API,AFIP: PHASE 4: INVOICING
        
        API->>DB: Create invoice (draft)
        API->>DB: Calculate totals, taxes
        API->>Q: Queue: afip:invoice
        
        Q->>AFIP: Request CAE
        
        alt AFIP Success
            AFIP-->>Q: CAE + expiry date
            Q->>DB: Update invoice with CAE
            Q->>Q: Queue: invoice:pdf
            Q->>DB: Generate & store PDF
            Q->>DB: Update status: issued
        else AFIP Failure (Retryable)
            AFIP-->>Q: Error (timeout/rate limit)
            Q->>Q: Retry with backoff
            Note right of Q: Backoff: 30s, 2m, 5m, 15m, 30m
        else AFIP Failure (Permanent)
            AFIP-->>Q: Rejection error
            Q->>DB: Update status: failed
            Q->>API: Alert: manual intervention needed
        end
    end
    
    %% === NOTIFICATION PHASE ===
    rect rgb(255, 245, 238)
        Note over Q,C: PHASE 5: CUSTOMER NOTIFICATION
        
        Q->>Q: Queue: job:notification (completed)
        Q->>WA: Send template: job_completed
        WA->>C: "Work completed! Invoice attached."
        
        Q->>WA: Send PDF attachment
        WA->>C: [Invoice PDF]
        
        Q->>WA: Send payment link
        WA->>C: "Pay here: [MP Link]"
    end
    
    %% === PAYMENT PHASE ===
    rect rgb(245, 255, 250)
        Note over C,MP: PHASE 6: PAYMENT
        
        C->>MP: Click payment link
        MP->>C: Show payment options
        Note right of C: Select: card, installments
        C->>MP: Confirm payment
        
        MP->>API: Webhook: payment.approved
        API->>Q: Queue: payment:webhook
        Q->>DB: Verify signature
        Q->>DB: Update payment status
        Q->>DB: Update invoice status: paid
        
        Q->>Q: Queue: job:notification (payment_received)
        Q->>WA: Send template: payment_confirmed
        WA->>C: "Payment received! Thank you."
    end
    
    %% === COMPLETION PHASE ===
    rect rgb(248, 248, 248)
        Note over API,DB: PHASE 7: COMPLETION
        
        API->>DB: Update job: fully_completed
        API->>DB: Calculate customer lifetime value
        API->>Q: Queue: analytics
        Q->>DB: Store analytics event
    end
```

### A.3 State Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JOB STATE MACHINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              ┌───────────┐                                  │
│                              │  PENDING  │                                  │
│                              └─────┬─────┘                                  │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                       │
│                    │               │               │                        │
│                    ▼               │               ▼                        │
│             ┌───────────┐         │        ┌───────────┐                   │
│             │ SCHEDULED │         │        │ CANCELLED │                   │
│             └─────┬─────┘         │        └───────────┘                   │
│                   │               │               ▲                         │
│                   ▼               │               │                         │
│             ┌───────────┐         │               │                         │
│             │ EN_CAMINO │─────────┼───────────────┘                        │
│             └─────┬─────┘         │                                         │
│                   │               │                                         │
│                   ▼               │                                         │
│             ┌───────────┐         │                                         │
│             │  WORKING  │─────────┼─────────────────────────────────┐      │
│             └─────┬─────┘         │                                 │      │
│                   │               │                                 │      │
│                   ▼               │                                 ▼      │
│             ┌───────────┐         │                          ┌───────────┐ │
│             │ COMPLETED │◀────────┘                          │ CANCELLED │ │
│             └───────────┘                                    └───────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Valid Transitions:                                                         │
│  • pending → scheduled, cancelled                                           │
│  • scheduled → en_camino, cancelled                                         │
│  • en_camino → working, cancelled                                           │
│  • working → completed, cancelled                                           │
│  • completed → (terminal)                                                   │
│  • cancelled → (terminal)                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INVOICE STATE MACHINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│        ┌─────────┐                                                          │
│        │  DRAFT  │                                                          │
│        └────┬────┘                                                          │
│             │                                                               │
│             ▼                                                               │
│      ┌─────────────┐         ┌─────────┐                                   │
│      │ PENDING_CAE │────────▶│ FAILED  │                                   │
│      └──────┬──────┘         └────┬────┘                                   │
│             │                     │                                         │
│             ▼                     │ (retry)                                 │
│        ┌─────────┐                │                                         │
│        │ ISSUED  │◀───────────────┘                                        │
│        └────┬────┘                                                          │
│             │                                                               │
│             ▼                                                               │
│        ┌─────────┐                                                          │
│        │  SENT   │                                                          │
│        └────┬────┘                                                          │
│             │                                                               │
│     ┌───────┴───────┐                                                       │
│     ▼               ▼                                                       │
│ ┌─────────┐   ┌─────────┐                                                  │
│ │  PAID   │   │ OVERDUE │                                                  │
│ └─────────┘   └────┬────┘                                                  │
│                    │                                                        │
│                    ▼                                                        │
│               ┌─────────┐                                                   │
│               │  PAID   │                                                   │
│               └─────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow B: External Failure Cascade

### B.1 AFIP Service Failure

```mermaid
sequenceDiagram
    autonumber
    
    participant API as CampoTech API
    participant Q as Queue (afip:invoice)
    participant CB as Circuit Breaker
    participant AFIP as AFIP Service
    participant DB as Database
    participant Alert as Alert System
    participant Admin as Admin Dashboard
    
    Note over API,Admin: SCENARIO: AFIP Service Degradation → Outage
    
    %% Normal operation
    rect rgb(240, 255, 240)
        Note over API,AFIP: Normal Operation
        API->>Q: Enqueue invoice #1
        Q->>CB: Check circuit state
        CB-->>Q: CLOSED (healthy)
        Q->>AFIP: Request CAE
        AFIP-->>Q: Success ✓
        Q->>DB: Update invoice
    end
    
    %% First failures
    rect rgb(255, 255, 200)
        Note over API,AFIP: First Failures (Circuit Still Closed)
        
        API->>Q: Enqueue invoice #2
        Q->>CB: Check circuit state
        CB-->>Q: CLOSED (1 failure)
        Q->>AFIP: Request CAE
        AFIP-->>Q: Timeout ✗
        Q->>CB: Record failure
        Q->>Q: Schedule retry (30s backoff)
        
        Q->>AFIP: Retry #1
        AFIP-->>Q: Timeout ✗
        Q->>CB: Record failure (2 failures)
        Q->>Q: Schedule retry (2min backoff)
    end
    
    %% Circuit opens
    rect rgb(255, 200, 200)
        Note over API,Alert: Circuit Breaker Opens (5 consecutive failures)
        
        Q->>AFIP: Retry #2
        AFIP-->>Q: Timeout ✗
        Q->>CB: Record failure (5 failures)
        CB->>CB: State → OPEN
        CB->>Alert: Circuit opened for AFIP
        Alert->>Admin: 🚨 AFIP circuit breaker opened
        
        Note over Q: New invoices fast-fail
        API->>Q: Enqueue invoice #3
        Q->>CB: Check circuit state
        CB-->>Q: OPEN (fail fast)
        Q->>DB: Update invoice status: queued_afip_down
        Q->>API: Return: AFIP_SERVICE_DEGRADED
    end
    
    %% Panic mode activation
    rect rgb(255, 150, 150)
        Note over CB,Admin: Panic Mode Activation (15 min OPEN)
        
        CB->>CB: OPEN for 15 minutes
        CB->>CB: State → PANIC
        CB->>Alert: Panic mode activated
        Alert->>Admin: 🔴 AFIP PANIC MODE
        
        Note over API: All AFIP operations suspended
        API->>Q: Enqueue invoice #4
        Q-->>API: Rejected: PANIC_MODE
        API->>DB: Store invoice as draft
        API->>API: Return 503 to client
    end
    
    %% Recovery attempt
    rect rgb(255, 255, 200)
        Note over CB,AFIP: Recovery Attempt (Half-Open)
        
        CB->>CB: Probe timer (5 min)
        CB->>CB: State → HALF_OPEN
        CB->>Alert: Testing AFIP connectivity
        
        Q->>AFIP: Probe request (1 invoice)
        
        alt Probe Success
            AFIP-->>Q: Success ✓
            Q->>CB: Record success
            CB->>CB: State → CLOSED
            CB->>Alert: AFIP recovered
            Alert->>Admin: ✅ AFIP service restored
            
            Note over Q: Process backlog
            Q->>Q: Resume queued invoices
            loop Process backlog
                Q->>AFIP: Request CAE
                AFIP-->>Q: Success
                Q->>DB: Update invoice
            end
        else Probe Failure
            AFIP-->>Q: Timeout ✗
            Q->>CB: Record failure
            CB->>CB: State → OPEN
            CB->>Alert: AFIP still failing
            Note over CB: Restart recovery timer
        end
    end
```

### B.2 WhatsApp Rate Limit Cascade

```mermaid
sequenceDiagram
    autonumber
    
    participant API as CampoTech API
    participant Q as Queue (whatsapp:outbound)
    participant RL as Rate Limiter
    participant WA as WhatsApp API
    participant DB as Database
    participant SMS as SMS Fallback
    participant Alert as Alert System
    
    Note over API,Alert: SCENARIO: WhatsApp Rate Limit Hit
    
    %% Normal operation with rate limiting
    rect rgb(240, 255, 240)
        Note over API,WA: Normal Operation (under limit)
        
        loop Messages 1-45 (limit: 50/min)
            API->>Q: Enqueue message
            Q->>RL: Check org rate limit
            RL-->>Q: OK (45/50 used)
            Q->>WA: Send message
            WA-->>Q: Delivered ✓
        end
    end
    
    %% Approaching limit
    rect rgb(255, 255, 200)
        Note over API,WA: Approaching Rate Limit
        
        API->>Q: Enqueue message #46
        Q->>RL: Check org rate limit
        RL-->>Q: OK (46/50 used)
        RL->>Alert: Rate limit warning (90%)
        Q->>WA: Send message
        WA-->>Q: Delivered ✓
    end
    
    %% Rate limit hit
    rect rgb(255, 200, 200)
        Note over API,SMS: Rate Limit Hit
        
        API->>Q: Enqueue message #51
        Q->>RL: Check org rate limit
        RL-->>Q: RATE_LIMITED
        
        alt Critical Message (job notifications)
            Q->>DB: Check message priority
            DB-->>Q: Priority: HIGH
            Q->>SMS: Fallback to SMS
            SMS-->>Q: Sent via SMS ✓
            Q->>DB: Update: sent_via_sms
        else Non-Critical Message
            Q->>Q: Delay job (60s)
            Q->>DB: Update: rate_limited
        end
    end
    
    %% WhatsApp API rate limit (429)
    rect rgb(255, 150, 150)
        Note over Q,WA: WhatsApp API Returns 429
        
        Q->>WA: Send message
        WA-->>Q: 429 Too Many Requests
        Note right of WA: Retry-After: 60s
        
        Q->>RL: Update: WA global limit hit
        Q->>Q: Pause all WA sends (60s)
        Q->>Alert: WhatsApp rate limited
        
        Note over Q: Queue continues to accept jobs
        API->>Q: Enqueue message
        Q->>DB: Status: queued_rate_limited
    end
    
    %% Recovery
    rect rgb(240, 255, 240)
        Note over Q,WA: Rate Limit Window Reset
        
        Q->>Q: Timer: 60s elapsed
        Q->>RL: Check WA status
        RL-->>Q: OK (new window)
        
        Q->>Q: Resume processing
        loop Process backlog (with rate limiting)
            Q->>RL: Check rate
            RL-->>Q: OK
            Q->>WA: Send message
            WA-->>Q: Delivered ✓
        end
    end
```

### B.3 Mercado Pago Webhook Delay

```mermaid
sequenceDiagram
    autonumber
    
    participant C as Customer
    participant MP as Mercado Pago
    participant API as CampoTech API
    participant Q as Queue
    participant DB as Database
    participant Recon as Reconciliation Job
    participant Alert as Alert System
    
    Note over C,Alert: SCENARIO: MP Webhook Delayed/Lost
    
    %% Payment made but webhook delayed
    rect rgb(255, 255, 200)
        Note over C,MP: Customer Pays
        
        C->>MP: Complete payment
        MP->>MP: Payment approved
        Note right of MP: Webhook queued but delayed
    end
    
    %% Expected webhook doesn't arrive
    rect rgb(255, 200, 200)
        Note over API,DB: Webhook Not Received (5 minutes)
        
        Note over API: No webhook received
        
        API->>DB: Invoice still shows: pending_payment
        Note over DB: Customer sees "unpaid" status
    end
    
    %% Customer contacts support
    rect rgb(255, 230, 230)
        Note over C,Alert: Customer Reports Issue
        
        C->>API: "I already paid!"
        API->>DB: Check payment status
        DB-->>API: No payment record
        
        API->>MP: GET /payments?invoice={id}
        MP-->>API: Payment found: approved
        
        API->>DB: Create payment record
        API->>DB: Update invoice: paid
        API->>Alert: Webhook delay detected
    end
    
    %% Delayed webhook arrives
    rect rgb(255, 255, 200)
        Note over MP,Q: Delayed Webhook Finally Arrives
        
        MP->>API: Webhook: payment.approved
        API->>Q: Queue: payment:webhook
        Q->>DB: Check idempotency key
        DB-->>Q: Already processed ✓
        Q->>Q: Skip (idempotent)
    end
    
    %% Reconciliation catches missed webhooks
    rect rgb(240, 255, 240)
        Note over Recon,DB: Scheduled Reconciliation (Every Hour)
        
        Recon->>MP: GET /payments (last hour)
        MP-->>Recon: List of payments
        
        loop Each MP payment
            Recon->>DB: Check if payment exists
            alt Payment exists
                Recon->>DB: Verify amounts match
            else Payment missing
                Recon->>DB: Create payment record
                Recon->>DB: Update invoice status
                Recon->>Alert: Payment created via reconciliation
            end
        end
        
        Recon->>Alert: Reconciliation complete
        Note right of Recon: Found: 3 missing payments
    end
```

### B.4 Combined Failure Scenario

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMBINED FAILURE RESPONSE MATRIX                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Failure Combination          │ System Response                             │
│  ─────────────────────────────┼─────────────────────────────────────────── │
│                               │                                             │
│  AFIP Down                    │ • Queue invoices as drafts                 │
│  (single failure)             │ • Generate provisional PDFs                │
│                               │ • Process backlog when recovered           │
│                               │                                             │
│  ─────────────────────────────┼─────────────────────────────────────────── │
│                               │                                             │
│  WhatsApp Down                │ • Fall back to SMS for critical messages   │
│  (single failure)             │ • Queue non-critical messages              │
│                               │ • Email fallback for invoices              │
│                               │                                             │
│  ─────────────────────────────┼─────────────────────────────────────────── │
│                               │                                             │
│  MP Down                      │ • Accept cash payments                     │
│  (single failure)             │ • Generate manual payment links            │
│                               │ • Reconcile when recovered                 │
│                               │                                             │
│  ─────────────────────────────┼─────────────────────────────────────────── │
│                               │                                             │
│  AFIP + WhatsApp Down         │ • Queue invoices                           │
│  (double failure)             │ • SMS for job notifications only           │
│                               │ • Hold invoice sends until WA recovered    │
│                               │                                             │
│  ─────────────────────────────┼─────────────────────────────────────────── │
│                               │                                             │
│  AFIP + MP Down               │ • Accept cash only                         │
│  (double failure)             │ • Manual invoicing workflow                │
│                               │ • Priority recovery: MP first              │
│                               │                                             │
│  ─────────────────────────────┼─────────────────────────────────────────── │
│                               │                                             │
│  All External Services Down   │ • PANIC MODE activated                     │
│  (triple failure)             │ • Core operations only (scheduling)        │
│                               │ • Manual everything                        │
│                               │ • Alert: immediate escalation              │
│                               │                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow C: Offline Technician Sync

### C.1 Offline Operation Flow

```mermaid
sequenceDiagram
    autonumber
    
    participant Tech as Technician App
    participant Local as Local SQLite
    participant Sync as Sync Engine
    participant API as CampoTech API
    participant Q as Queue (sync:offline)
    participant DB as Server Database
    
    Note over Tech,DB: SCENARIO: Technician Works Offline, Then Syncs
    
    %% Go offline
    rect rgb(255, 240, 240)
        Note over Tech,Local: Technician Loses Connection
        
        Tech->>Sync: Check connectivity
        Sync-->>Tech: OFFLINE
        Sync->>Local: Enable offline mode
        Local->>Local: Start operation log
    end
    
    %% Work offline
    rect rgb(255, 255, 230)
        Note over Tech,Local: Offline Work (2 hours)
        
        Tech->>Local: Update job status → working
        Local->>Local: Log: {op: status_change, ts: T1, clock: {device1: 1}}
        
        Tech->>Local: Upload photo (before)
        Local->>Local: Store photo locally
        Local->>Local: Log: {op: photo, ts: T2, clock: {device1: 2}}
        
        Tech->>Local: Update job notes
        Local->>Local: Log: {op: update, ts: T3, clock: {device1: 3}}
        
        Tech->>Local: Upload photo (after)
        Local->>Local: Store photo locally
        Local->>Local: Log: {op: photo, ts: T4, clock: {device1: 4}}
        
        Tech->>Local: Complete job
        Local->>Local: Log: {op: status_change, ts: T5, clock: {device1: 5}}
        
        Note over Local: 5 operations queued
    end
    
    %% Come back online
    rect rgb(230, 255, 230)
        Note over Tech,API: Connection Restored
        
        Tech->>Sync: Check connectivity
        Sync-->>Tech: ONLINE
        Sync->>Local: Get pending operations
        Local-->>Sync: 5 operations
        
        Sync->>API: POST /jobs/sync
        Note right of Sync: Payload: operations[], deviceId, lastSyncTs
    end
    
    %% Server processing
    rect rgb(240, 248, 255)
        Note over API,DB: Server Processes Sync
        
        API->>Q: Queue: sync:offline
        Q->>DB: Begin transaction
        
        loop Each operation
            Q->>DB: Check for conflicts
            Q->>DB: Apply operation
            Q->>DB: Update vector clock
        end
        
        Q->>DB: Commit transaction
        Q-->>API: Sync result
    end
    
    %% Return results
    rect rgb(230, 255, 230)
        Note over API,Local: Sync Complete
        
        API-->>Sync: {processed: 5, conflicts: 0, serverClock: {...}}
        Sync->>Local: Clear synced operations
        Sync->>Local: Update server state
        Sync->>Tech: Sync complete ✓
    end
```

### C.2 Conflict Resolution Flow

```mermaid
sequenceDiagram
    autonumber
    
    participant Tech1 as Technician 1 (Mobile)
    participant Tech2 as Technician 2 (Mobile)
    participant Disp as Dispatcher (Web)
    participant API as CampoTech API
    participant DB as Database
    
    Note over Tech1,DB: SCENARIO: Concurrent Edits Create Conflict
    
    %% Initial state
    rect rgb(248, 248, 248)
        Note over DB: Job #123 State
        Note over DB: status: scheduled, assignedTo: Tech1, notes: ""
        Note over DB: vectorClock: {server: 5}
    end
    
    %% Concurrent edits
    rect rgb(255, 255, 200)
        Note over Tech1,Disp: Concurrent Edits (within sync window)
        
        par Tech1 goes offline and edits
            Tech1->>Tech1: Update notes: "Customer not home"
            Note right of Tech1: localClock: {device1: 1}
        and Dispatcher edits online
            Disp->>API: PATCH /jobs/123 {notes: "VIP customer"}
            API->>DB: Update notes
            Note right of DB: vectorClock: {server: 6}
        and Tech2 edits online
            Tech2->>API: PATCH /jobs/123 {priority: urgent}
            API->>DB: Update priority
            Note right of DB: vectorClock: {server: 7}
        end
    end
    
    %% Tech1 comes online
    rect rgb(255, 220, 220)
        Note over Tech1,DB: Tech1 Syncs - Conflict Detected
        
        Tech1->>API: POST /jobs/sync
        Note right of Tech1: {notes: "Customer not home", lastSync: server:5}
        
        API->>DB: Check vector clock
        DB-->>API: Current: {server: 7}, Client last saw: {server: 5}
        
        API->>API: Conflict detected!
        Note over API: Server has newer changes client hasn't seen
    end
    
    %% Conflict resolution
    rect rgb(255, 255, 200)
        Note over API,DB: Conflict Resolution Strategy
        
        alt Field-Level Merge (no overlap)
            Note over API: Tech1 changed: notes
            Note over API: Server changed: priority
            Note over API: No overlap → Auto-merge
            
            API->>DB: Merge both changes
            Note right of DB: notes: "Customer not home", priority: urgent
            API-->>Tech1: {merged: true, conflicts: []}
            
        else Field-Level Conflict (same field)
            Note over API: Tech1 changed: notes
            Note over API: Dispatcher changed: notes
            Note over API: Same field → Conflict
            
            API-->>Tech1: {merged: false, conflicts: [{field: "notes", serverValue: "VIP customer", clientValue: "Customer not home"}]}
            
            Tech1->>Tech1: Show conflict UI
            Tech1->>Tech1: User chooses: keep both
            Tech1->>API: Resolve: "VIP customer - Customer not home"
            API->>DB: Update with resolved value
        end
    end
    
    %% Resolution complete
    rect rgb(230, 255, 230)
        Note over Tech1,DB: Conflict Resolved
        
        API->>DB: Update vectorClock: {server: 8, device1: 1}
        API-->>Tech1: Sync complete
        Tech1->>Tech1: Update local state
    end
```

### C.3 Conflict Resolution Decision Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONFLICT RESOLUTION DECISION TREE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Client submits operation with lastSyncClock                                │
│                    │                                                        │
│                    ▼                                                        │
│          ┌─────────────────┐                                               │
│          │ Compare clocks  │                                               │
│          └────────┬────────┘                                               │
│                   │                                                        │
│     ┌─────────────┼─────────────┐                                         │
│     ▼             ▼             ▼                                          │
│ ┌───────┐   ┌───────────┐   ┌───────┐                                     │
│ │Client │   │ Concurrent│   │Server │                                     │
│ │ ahead │   │  (equal)  │   │ ahead │                                     │
│ └───┬───┘   └─────┬─────┘   └───┬───┘                                     │
│     │             │             │                                          │
│     ▼             ▼             ▼                                          │
│ ┌───────┐   ┌───────────┐   ┌───────────┐                                 │
│ │ Apply │   │  Merge    │   │  Conflict │                                 │
│ │client │   │  clocks   │   │  detected │                                 │
│ └───────┘   └───────────┘   └─────┬─────┘                                 │
│                                   │                                        │
│                     ┌─────────────┼─────────────┐                          │
│                     ▼             ▼             ▼                          │
│              ┌───────────┐ ┌───────────┐ ┌───────────┐                    │
│              │ Different │ │   Same    │ │  Status   │                    │
│              │  fields   │ │  field    │ │  change   │                    │
│              └─────┬─────┘ └─────┬─────┘ └─────┬─────┘                    │
│                    │             │             │                           │
│                    ▼             ▼             ▼                           │
│              ┌───────────┐ ┌───────────┐ ┌───────────┐                    │
│              │Auto-merge │ │ Return to │ │  Server   │                    │
│              │ both      │ │  client   │ │   wins    │                    │
│              └───────────┘ └───────────┘ └───────────┘                    │
│                                  │                                         │
│                                  ▼                                         │
│                            ┌───────────┐                                   │
│                            │  Client   │                                   │
│                            │ resolves  │                                   │
│                            └─────┬─────┘                                   │
│                                  │                                         │
│                    ┌─────────────┼─────────────┐                          │
│                    ▼             ▼             ▼                          │
│              ┌───────────┐ ┌───────────┐ ┌───────────┐                    │
│              │   Keep    │ │   Keep    │ │   Keep    │                    │
│              │  client   │ │  server   │ │   both    │                    │
│              └───────────┘ └───────────┘ └───────────┘                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  SPECIAL RULES:                                                             │
│  • Status changes: Server always wins (state machine integrity)             │
│  • Photos: Always accept (append-only, no conflict possible)               │
│  • Signatures: Client wins (captured on device)                            │
│  • Financial data: Server wins, require manual review                       │
│  • Timestamps: Use latest                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### C.4 Vector Clock Implementation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VECTOR CLOCK EXAMPLE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Timeline:                                                                  │
│                                                                             │
│  Server    ──●────●────●────────●────●────────────●───▶                    │
│              1    2    3        4    5            6                         │
│              │         │        │                 │                         │
│              │         │        │                 │                         │
│  Device1  ──●─────────────●────●────●───────────●───▶                      │
│              1              1    2    3           4                         │
│              │              │    │    │           │                         │
│              └──(sync)──────┘    │    │           │                         │
│                              (offline) └──(sync)──┘                        │
│                                                                             │
│  Clock states:                                                              │
│                                                                             │
│  T1: Server creates job                                                     │
│      Server clock: {s: 1}                                                   │
│                                                                             │
│  T2: Device1 syncs, gets job                                               │
│      Device1 clock: {s: 1, d1: 0}                                          │
│                                                                             │
│  T3: Server updates job                                                     │
│      Server clock: {s: 2}                                                   │
│                                                                             │
│  T4: Device1 goes offline, makes change                                     │
│      Device1 clock: {s: 1, d1: 1}  (doesn't know about s:2)                │
│                                                                             │
│  T5: Device1 makes another change                                           │
│      Device1 clock: {s: 1, d1: 2}                                          │
│                                                                             │
│  T6: Device1 syncs                                                          │
│      Client sends: changes with clock {s: 1, d1: 2}                        │
│      Server has: {s: 2}                                                     │
│      CONFLICT: Client's s:1 < Server's s:2                                 │
│      → Server made changes client hasn't seen                               │
│                                                                             │
│  Resolution:                                                                │
│      Merge changes, new clock: {s: 3, d1: 2}                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow D: Abuse Detection

### D.1 Abuse Detection Decision Flow

```mermaid
flowchart TD
    subgraph Input["Incoming Request"]
        A[API Request] --> B{Request Type}
    end
    
    subgraph RateLimit["Rate Limiting Layer"]
        B -->|Auth| C[Check IP Rate]
        B -->|API| D[Check Org Rate]
        B -->|WhatsApp| E[Check Phone Rate]
        
        C --> F{IP Rate OK?}
        D --> G{Org Rate OK?}
        E --> H{Phone Rate OK?}
        
        F -->|No| I[429 + Exponential Backoff]
        G -->|No| J[429 + Org Warning]
        H -->|No| K[429 + Phone Block]
    end
    
    subgraph BehaviorAnalysis["Behavior Analysis"]
        F -->|Yes| L[Log Request Pattern]
        G -->|Yes| L
        H -->|Yes| L
        
        L --> M{Anomaly Detection}
        
        M -->|Normal| N[Process Request]
        M -->|Suspicious| O[Flag for Review]
        M -->|Malicious| P[Block + Alert]
    end
    
    subgraph Patterns["Pattern Detection"]
        O --> Q{Pattern Type}
        
        Q -->|Enumeration| R[Account enumeration attempt]
        Q -->|Scraping| S[Data scraping attempt]
        Q -->|Credential| T[Credential stuffing]
        Q -->|DDoS| U[Distributed attack]
        
        R --> V[Temporary IP ban]
        S --> W[CAPTCHA challenge]
        T --> X[Account lockout]
        U --> Y[WAF escalation]
    end
    
    subgraph Response["Response Actions"]
        V --> Z[Log to SIEM]
        W --> Z
        X --> Z
        Y --> Z
        P --> Z
        
        Z --> AA{Severity}
        
        AA -->|Low| AB[Monitor]
        AA -->|Medium| AC[Alert On-Call]
        AA -->|High| AD[Incident Response]
        AA -->|Critical| AE[Auto-Mitigation]
    end
```

### D.2 Abuse Detection Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ABUSE DETECTION RULES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RULE 1: OTP Abuse                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Trigger:    > 3 OTP requests for same phone in 1 hour                     │
│  Action:     Block phone for 24 hours                                       │
│  Alert:      If > 10 different phones from same IP                         │
│                                                                             │
│  RULE 2: Authentication Brute Force                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Trigger:    > 5 failed OTP verifications for same phone                   │
│  Action:     Lock phone for 1 hour, invalidate pending OTPs                │
│  Escalate:   If same pattern from multiple IPs → credential stuffing       │
│                                                                             │
│  RULE 3: API Rate Abuse                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Trigger:    > 1000 requests/minute from single org                        │
│  Action:     Throttle to 10 req/min, alert admin                           │
│  Escalate:   If sustained > 10 minutes → temp org suspension               │
│                                                                             │
│  RULE 4: Data Enumeration                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Trigger:    Sequential customer ID queries (> 50 in pattern)              │
│  Action:     Block IP, alert security team                                  │
│  Indicator:  GET /customers/{sequential-ids}                               │
│                                                                             │
│  RULE 5: WhatsApp Spam                                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Trigger:    > 100 unique recipients in 1 hour                             │
│  Action:     Suspend WhatsApp for org, require verification                │
│  Alert:      Potential spam campaign                                        │
│                                                                             │
│  RULE 6: Invoice Fraud                                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Trigger:    > 20 invoices to same CUIT in 24 hours                        │
│  Action:     Flag for review, hold AFIP submission                         │
│  Indicator:  Potential invoice splitting for tax evasion                   │
│                                                                             │
│  RULE 7: Payment Anomaly                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Trigger:    Payment > 10x average for org                                 │
│  Action:     Hold payment, require manual approval                         │
│  Indicator:  Potential money laundering                                     │
│                                                                             │
│  RULE 8: Velocity Abuse                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Trigger:    Job create → complete in < 5 minutes                          │
│  Action:     Flag job, hold invoice                                        │
│  Indicator:  Fake jobs for payment processing                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### D.3 Abuse Detection Sequence

```mermaid
sequenceDiagram
    autonumber
    
    participant Attacker as Attacker
    participant WAF as WAF/CDN
    participant API as API Gateway
    participant RL as Rate Limiter
    participant AD as Abuse Detector
    participant DB as Database
    participant Alert as Alert System
    participant SIEM as SIEM/Logging
    
    Note over Attacker,SIEM: SCENARIO: Credential Stuffing Attack
    
    %% Initial requests
    rect rgb(255, 255, 230)
        Note over Attacker,RL: Phase 1: Initial Requests
        
        loop Requests 1-10
            Attacker->>WAF: POST /auth/otp/send
            WAF->>API: Forward (IP not blocked)
            API->>RL: Check rate limit
            RL-->>API: OK
            API->>DB: Process request
            API-->>Attacker: OTP sent
        end
    end
    
    %% Pattern detected
    rect rgb(255, 230, 200)
        Note over RL,AD: Phase 2: Pattern Detection
        
        Attacker->>WAF: POST /auth/otp/send (request #11)
        WAF->>API: Forward
        API->>RL: Check rate limit
        RL->>RL: Threshold exceeded (10/hour)
        RL->>AD: Report anomaly
        
        AD->>DB: Query recent patterns
        DB-->>AD: 10 OTPs, 10 unique phones, 1 IP
        
        AD->>AD: Pattern match: credential stuffing
        AD->>SIEM: Log: CREDENTIAL_STUFFING_SUSPECTED
    end
    
    %% Mitigation
    rect rgb(255, 200, 200)
        Note over AD,Alert: Phase 3: Mitigation
        
        AD->>WAF: Block IP: 1 hour
        AD->>DB: Invalidate all pending OTPs from IP
        AD->>Alert: Security alert: credential stuffing
        
        Alert->>Alert: Page on-call security
    end
    
    %% Continued attack (blocked)
    rect rgb(200, 200, 200)
        Note over Attacker,WAF: Phase 4: Attack Blocked
        
        loop Requests 12+
            Attacker->>WAF: POST /auth/otp/send
            WAF-->>Attacker: 403 Forbidden
            WAF->>SIEM: Log: BLOCKED_REQUEST
        end
    end
    
    %% Attacker switches IP
    rect rgb(255, 230, 200)
        Note over Attacker,AD: Phase 5: IP Rotation Detected
        
        Attacker->>WAF: POST /auth/otp/send (new IP)
        WAF->>API: Forward
        API->>RL: Check rate limit
        RL-->>API: OK (new IP)
        
        API->>AD: Check behavioral patterns
        AD->>DB: Query: same phone patterns
        DB-->>AD: Phone previously targeted
        
        AD->>AD: Pattern: same target, new IP
        AD->>DB: Block phone for 24 hours
        AD->>WAF: Add IP to watch list
        AD->>SIEM: Log: IP_ROTATION_DETECTED
    end
    
    %% Escalation
    rect rgb(255, 200, 200)
        Note over AD,Alert: Phase 6: Escalation
        
        AD->>AD: Attack persists > 10 minutes
        AD->>Alert: Escalate: distributed attack
        Alert->>Alert: Trigger incident response
        
        AD->>WAF: Enable aggressive filtering
        AD->>WAF: Add CAPTCHA to /auth/*
    end
```

### D.4 Abuse Scoring Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ABUSE SCORING MODEL                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Each request is scored. Score > 70 triggers review. Score > 90 blocks.    │
│                                                                             │
│  FACTOR                              │ SCORE IMPACT                         │
│  ────────────────────────────────────┼──────────────────────────────────── │
│                                      │                                      │
│  IP Reputation                       │                                      │
│  • Known bad IP (threat intel)       │ +50                                  │
│  • VPN/Proxy detected                │ +15                                  │
│  • New IP (no history)               │ +10                                  │
│  • Good history                      │ -10                                  │
│                                      │                                      │
│  Request Pattern                     │                                      │
│  • Sequential ID access              │ +30                                  │
│  • Unusual time (3am local)          │ +10                                  │
│  • Missing common headers            │ +15                                  │
│  • Unusual User-Agent                │ +10                                  │
│                                      │                                      │
│  Rate Behavior                       │                                      │
│  • > 80% of rate limit               │ +20                                  │
│  • Exactly at rate limit             │ +30 (bot-like precision)            │
│  • Burst after quiet period          │ +15                                  │
│                                      │                                      │
│  Account Behavior                    │                                      │
│  • New account (< 24h)               │ +20                                  │
│  • Failed auth attempts > 3          │ +25                                  │
│  • Accessing other orgs' data        │ +50 (immediate block)               │
│                                      │                                      │
│  Org Behavior                        │                                      │
│  • Org created today                 │ +15                                  │
│  • No payment method                 │ +10                                  │
│  • Excessive API usage               │ +20                                  │
│                                      │                                      │
│  SCORE THRESHOLDS:                   │                                      │
│  • 0-30:   Normal (log only)         │                                      │
│  • 31-50:  Elevated (increase logging)│                                     │
│  • 51-70:  Suspicious (add CAPTCHA)  │                                      │
│  • 71-90:  High risk (throttle)      │                                      │
│  • 91+:    Block (immediate)         │                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow E: Voice AI Pipeline

### E.1 Complete Voice Processing Flow

```mermaid
sequenceDiagram
    autonumber
    
    participant C as Customer
    participant WA as WhatsApp
    participant API as CampoTech API
    participant Q1 as Queue: whatsapp:inbound
    participant Q2 as Queue: voice:transcription
    participant Q3 as Queue: voice:extraction
    participant Whisper as OpenAI Whisper
    participant GPT as OpenAI GPT-4
    participant DB as Database
    participant Review as Human Review
    participant Q4 as Queue: job:notification
    
    Note over C,Q4: VOICE MESSAGE → JOB CREATION PIPELINE
    
    %% Customer sends voice
    rect rgb(240, 248, 255)
        Note over C,WA: Step 1: Customer Sends Voice Message
        
        C->>WA: Record voice message
        Note right of C: "Hola, soy María. Tengo una pérdida en el baño, vivo en Palermo, Gorriti 4500. ¿Pueden venir mañana a la tarde?"
        WA->>API: Webhook: voice message
        Note right of WA: mediaId, duration: 12s
    end
    
    %% Initial processing
    rect rgb(255, 250, 240)
        Note over API,Q2: Step 2: Queue for Processing
        
        API->>DB: Store message metadata
        API->>DB: Download audio from WA
        API->>Q1: Queue: whatsapp:inbound
        Q1->>DB: Link to customer (by phone)
        Q1->>Q2: Queue: voice:transcription
    end
    
    %% Transcription
    rect rgb(240, 255, 240)
        Note over Q2,Whisper: Step 3: Whisper Transcription
        
        Q2->>Whisper: POST /audio/transcriptions
        Note right of Q2: model: whisper-1, language: es
        
        Whisper-->>Q2: Transcription result
        Note left of Whisper: "Hola, soy María. Tengo una pérdida en el baño, vivo en Palermo, Gorriti 4500. Pueden venir mañana a la tarde?"
        Note left of Whisper: confidence: 0.94
        
        Q2->>DB: Store transcription
        Q2->>Q3: Queue: voice:extraction
    end
    
    %% Extraction
    rect rgb(255, 255, 240)
        Note over Q3,GPT: Step 4: GPT Data Extraction
        
        Q3->>GPT: POST /chat/completions
        Note right of Q3: Extract: name, address, problem, urgency, time preference
        
        GPT-->>Q3: Structured extraction
        Note left of GPT: { customerName: {value: "María", confidence: 0.95}, address: {value: "Gorriti 4500, Palermo", confidence: 0.92}, problemDescription: {value: "pérdida en el baño", confidence: 0.98}, urgency: {value: "normal", confidence: 0.85}, preferredTime: {value: "mañana tarde", confidence: 0.90} }
        
        Q3->>DB: Store extraction
    end
    
    %% Confidence check
    rect rgb(248, 248, 255)
        Note over Q3,Review: Step 5: Confidence Evaluation
        
        Q3->>Q3: Calculate overall confidence
        Note right of Q3: avg(0.95, 0.92, 0.98, 0.85, 0.90) = 0.92
        
        alt High Confidence (≥ 0.70)
            Q3->>DB: Auto-create customer (if new)
            Q3->>DB: Auto-create job
            Note right of DB: status: pending, source: voice
            Q3->>Q4: Queue: job:notification
        else Low Confidence (< 0.70)
            Q3->>DB: Flag for review
            Q3->>Review: Push notification
            Note right of Review: "Voice message needs review"
            
            Review->>DB: View transcript + extraction
            Review->>DB: Correct/confirm data
            Review->>DB: Approve job creation
            Review->>Q4: Queue: job:notification
        end
    end
    
    %% Confirmation to customer
    rect rgb(240, 255, 240)
        Note over Q4,C: Step 6: Customer Confirmation
        
        Q4->>WA: Send template: voice_received
        WA->>C: "¡Recibimos tu mensaje! Trabajo creado: Pérdida en baño, Gorriti 4500. Te contactaremos para confirmar horario."
    end
```

### E.2 Voice Confidence Thresholds

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VOICE CONFIDENCE THRESHOLDS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRANSCRIPTION CONFIDENCE (Whisper)                                         │
│  ────────────────────────────────────────────────────────────────────────   │
│  ≥ 0.90  │ High quality audio, clear speech                                │
│  ≥ 0.70  │ Acceptable quality, proceed with extraction                     │
│  ≥ 0.50  │ Poor quality, flag for human review                             │
│  < 0.50  │ Very poor, request customer to resend                           │
│                                                                             │
│  EXTRACTION CONFIDENCE (GPT)                                                │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  Field               │ Required │ Min Confidence │ Action if Low           │
│  ────────────────────┼──────────┼────────────────┼────────────────────────  │
│  customerName        │ No       │ 0.60           │ Use phone lookup        │
│  phone               │ No       │ 0.80           │ Use sender phone        │
│  address             │ Yes      │ 0.70           │ Flag for review         │
│  neighborhood        │ No       │ 0.60           │ Geocode from address    │
│  problemDescription  │ Yes      │ 0.60           │ Flag for review         │
│  serviceType         │ No       │ 0.50           │ Default: "general"      │
│  urgency             │ No       │ 0.50           │ Default: "normal"       │
│  preferredDate       │ No       │ 0.70           │ Ask customer            │
│  preferredTime       │ No       │ 0.70           │ Ask customer            │
│                                                                             │
│  OVERALL CONFIDENCE CALCULATION                                             │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  overall = (                                                                │
│    transcription_confidence * 0.3 +                                         │
│    address_confidence * 0.25 +                                              │
│    problem_confidence * 0.25 +                                              │
│    avg(other_fields) * 0.2                                                  │
│  )                                                                          │
│                                                                             │
│  DECISION THRESHOLDS                                                        │
│  ────────────────────────────────────────────────────────────────────────   │
│  ≥ 0.70  │ Auto-create job, send confirmation                              │
│  ≥ 0.50  │ Queue for human review, respond "we're reviewing"               │
│  < 0.50  │ Request customer to resend or call                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow F: Payment Lifecycle

### F.1 Complete Payment Flow

```mermaid
sequenceDiagram
    autonumber
    
    participant C as Customer
    participant WA as WhatsApp
    participant API as CampoTech API
    participant DB as Database
    participant MP as Mercado Pago
    participant Q as Queue System
    participant AFIP as AFIP (Invoice)
    
    Note over C,AFIP: COMPLETE PAYMENT LIFECYCLE
    
    %% Invoice ready
    rect rgb(248, 248, 255)
        Note over API,DB: Step 1: Invoice Issued
        
        API->>DB: Invoice created with CAE
        API->>Q: Queue: job:notification
        Q->>WA: Send invoice + payment link
        WA->>C: "Invoice attached. Pay here: [link]"
    end
    
    %% Payment preference creation
    rect rgb(255, 250, 240)
        Note over API,MP: Step 2: Create Payment Preference
        
        API->>MP: POST /checkout/preferences
        Note right of API: items, payer, back_urls, notification_url
        
        MP-->>API: preference_id, init_point
        API->>DB: Store preference_id
    end
    
    %% Customer pays
    rect rgb(240, 255, 240)
        Note over C,MP: Step 3: Customer Payment
        
        C->>MP: Click payment link
        MP->>C: Show payment form
        
        C->>MP: Select installments (3 cuotas)
        MP->>C: Show TEA/CFT
        Note right of C: TEA: 89.24%, CFT: 96.12%
        
        C->>MP: Enter card details
        C->>MP: Confirm payment
        
        MP->>MP: Process with acquirer
        MP-->>C: Payment approved ✓
    end
    
    %% Webhook processing
    rect rgb(255, 255, 240)
        Note over MP,DB: Step 4: Webhook Processing
        
        MP->>API: POST /payments/webhook
        Note right of MP: type: payment, data.id: 12345
        
        API->>Q: Queue: payment:webhook
        Q->>DB: Check idempotency (mp_payment_id)
        
        alt New payment
            Q->>MP: GET /v1/payments/12345
            MP-->>Q: Payment details
            
            Q->>DB: Create payment record
            Note right of DB: amount, installments, TEA, CFT, status: approved
            
            Q->>DB: Update invoice status: paid
            Q->>DB: Update job: fully_completed
        else Already processed
            Q->>Q: Skip (idempotent)
        end
    end
    
    %% Confirmation
    rect rgb(240, 255, 240)
        Note over Q,C: Step 5: Confirmation
        
        Q->>Q: Queue: job:notification (payment_received)
        Q->>WA: Send template: payment_confirmed
        WA->>C: "Payment received! Thank you. Receipt attached."
    end
    
    %% Possible issues
    rect rgb(255, 230, 230)
        Note over C,Q: Alternative: Payment Issues
        
        alt Payment Rejected
            MP-->>C: Payment rejected
            MP->>API: Webhook: payment.rejected
            Q->>DB: Update payment: rejected
            Q->>WA: Send: payment_failed
            WA->>C: "Payment failed. Try again: [link]"
            
        else Chargeback
            MP->>API: Webhook: chargeback
            Q->>DB: Create dispute record
            Q->>DB: Update payment: in_dispute
            Q->>API: Alert: dispute opened
            Note over API: Manual intervention required
            
        else Refund requested
            API->>MP: POST /v1/payments/12345/refunds
            MP-->>API: Refund approved
            API->>DB: Update payment: refunded
            API->>WA: Send: refund_processed
        end
    end
```

### F.2 Payment State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PAYMENT STATE MACHINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌───────────┐                                       │
│                         │  PENDING  │                                       │
│                         └─────┬─────┘                                       │
│                               │                                             │
│               ┌───────────────┼───────────────┐                            │
│               ▼               ▼               ▼                             │
│        ┌───────────┐   ┌───────────┐   ┌───────────┐                       │
│        │PROCESSING │   │ REJECTED  │   │ CANCELLED │                       │
│        └─────┬─────┘   └───────────┘   └───────────┘                       │
│              │                                                              │
│              ▼                                                              │
│        ┌───────────┐                                                        │
│        │ APPROVED  │◄──────────────────────────────┐                       │
│        └─────┬─────┘                               │                        │
│              │                                     │                        │
│     ┌────────┼────────┬────────────┐              │                        │
│     ▼        ▼        ▼            ▼              │                        │
│ ┌────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐ │                        │
│ │REFUNDED│ │PARTIAL │ │IN_DISPUTE│ │CHARGEDBACK│ │                        │
│ └────────┘ │_REFUND │ └────┬─────┘ └───────────┘ │                        │
│            └────────┘      │                      │                        │
│                            │                      │                        │
│                    ┌───────┴───────┐              │                        │
│                    ▼               ▼              │                        │
│              ┌───────────┐   ┌───────────┐       │                        │
│              │DISPUTE_WON│   │DISPUTE_   │───────┘                        │
│              │(→APPROVED)│   │LOST       │                                 │
│              └───────────┘   │(→CHARGED- │                                 │
│                              │ BACK)     │                                 │
│                              └───────────┘                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Transitions:                                                               │
│  • pending → processing, rejected, cancelled                                │
│  • processing → approved, rejected                                          │
│  • approved → refunded, partial_refund, in_dispute, chargedback            │
│  • in_dispute → approved (won), chargedback (lost)                         │
│  • refunded, chargedback → (terminal)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

This document provides **6 complete end-to-end flow diagrams**:

| Flow | Description | Diagrams Included |
|------|-------------|-------------------|
| **A** | Complete Customer Journey | Sequence diagram, Job state machine, Invoice state machine |
| **B** | External Failure Cascade | AFIP failure, WhatsApp rate limits, MP webhook delays, Combined failures |
| **C** | Offline Technician Sync | Offline operation, Conflict resolution, Vector clock implementation |
| **D** | Abuse Detection | Decision flowchart, Detection rules, Attack sequence, Scoring model |
| **E** | Voice AI Pipeline | Complete processing flow, Confidence thresholds |
| **F** | Payment Lifecycle | Complete payment flow, Payment state machine |

All diagrams use:
- **Mermaid** sequence diagrams (render in any Mermaid-compatible viewer)
- **ASCII** diagrams (universal compatibility)
- **State machines** with valid transitions
- **Decision trees** with clear branching logic

These diagrams provide unambiguous visual specifications for AI implementation.
