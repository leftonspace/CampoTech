# CampoTech Landing Page & Subscription System

## Complete Implementation Plan

This document outlines the comprehensive plan for building CampoTech's public-facing landing page and subscription payment system for the Argentine market.

---

## Table of Contents

1. [Landing Page Design](#1-landing-page-design)
2. [Subscription Plans & Pricing](#2-subscription-plans--pricing)
3. [Payment System Architecture](#3-payment-system-architecture)
4. [Payment Methods Implementation](#4-payment-methods-implementation)
5. [Bank Account & Money Flow](#5-bank-account--money-flow)
6. [Implementation Phases](#6-implementation-phases)
7. [Technical Requirements](#7-technical-requirements)
8. [Legal & Compliance](#8-legal--compliance)

---

## 1. Landing Page Design

### 1.1 Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVBAR                                  │
│  Logo    Funciones    Precios    Contacto    [Ingresar] [Probar]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      HERO SECTION                               │
│         "Gestión completa para servicios técnicos"              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                   FEATURES CAROUSEL                             │
│         [◀] Feature Cards (swipeable) [▶]                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    HOW IT WORKS                                 │
│              3-step visual explanation                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                   PRICING SECTION                               │
│            3 plan cards with comparison                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                   TESTIMONIALS                                  │
│              Customer quotes + logos                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    FINAL CTA                                    │
│           "Empezá tu prueba gratis de 14 días"                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        FOOTER                                   │
│   Links | Legal | Social Media | Contact | Payment Methods      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Hero Section

**Headline:** "Gestión completa para empresas de climatización"

**Subheadline:** "Organizá trabajos, facturá con AFIP, cobrá con MercadoPago. Todo en un solo lugar."

**CTA Buttons:**
- Primary: "Empezar gratis" → `/signup`
- Secondary: "Ver demo" → Video modal or `/demo`

**Visual:**
- Dashboard mockup on desktop/tablet
- Phone mockup showing technician app
- Floating UI elements showing notifications

### 1.3 Features Carousel

| # | Feature | Icon | Title | Description |
|---|---------|------|-------|-------------|
| 1 | Jobs | 📅 | Agenda de Trabajos | Asigná técnicos, agendá visitas, seguí el estado en tiempo real desde cualquier dispositivo |
| 2 | Invoicing | 🧾 | Facturación AFIP | Facturas A, B y C electrónicas con CAE automático. Cumplí con AFIP sin esfuerzo |
| 3 | Payments | 💳 | Cobros Integrados | MercadoPago, transferencias, efectivo. Tus clientes pagan como prefieran |
| 4 | WhatsApp | 💬 | WhatsApp Business | Notificaciones automáticas, recordatorios de citas, atención al cliente |
| 5 | Mobile | 📱 | App para Técnicos | Tus técnicos reciben trabajos, actualizan estado y suben fotos desde el celular |
| 6 | Reports | 📊 | Reportes y Métricas | Rendimiento de técnicos, facturación mensual, trabajos pendientes |
| 7 | Customers | 👥 | Base de Clientes | Historial completo, equipos instalados, direcciones con mapa |
| 8 | Voice AI | 🎙️ | Asistente por Voz | Creá trabajos dictando por WhatsApp. La IA transcribe y agenda |

### 1.4 How It Works Section

```
Step 1                    Step 2                    Step 3
┌─────────┐              ┌─────────┐              ┌─────────┐
│  📝     │              │  📱     │              │  💰     │
│ Registrá│     →        │ Gestioná│     →        │ Cobrá   │
│tu empresa│             │ trabajos│              │y facturá│
└─────────┘              └─────────┘              └─────────┘
Creá tu cuenta           Asigná técnicos,         Generá facturas
en 2 minutos con         agendá citas y           AFIP y recibí
tu CUIT                  seguí en tiempo real     pagos al instante
```

### 1.5 Social Proof Section

**Stats Bar:**
- "500+ trabajos gestionados"
- "50+ empresas activas"
- "98% satisfacción"
- "$2M+ facturado"

**Testimonials (3 rotating):**
```
"CampoTech nos ahorró 10 horas semanales en administración.
Ahora mis técnicos tienen todo en el celular."

— Juan Pérez, ClimaTech Buenos Aires
```

**Logo Bar:** "Empresas que confían en nosotros"
- 6-8 company logos (can be placeholder initially)

### 1.6 Footer

```
┌────────────────────────────────────────────────────────────────┐
│ CAMPOTECH                                                      │
│                                                                │
│ Producto        Empresa         Legal           Contacto       │
│ ─────────       ───────         ─────           ────────       │
│ Funciones       Nosotros        Términos        WhatsApp       │
│ Precios         Blog            Privacidad      Email          │
│ Integraciones   Empleos         Cookies         Tel            │
│ API Docs                                                       │
│                                                                │
│ ─────────────────────────────────────────────────────────────  │
│ Métodos de pago:  [MP] [Visa] [MC] [USDT] [Transfer]           │
│                                                                │
│ © 2024 CampoTech. Hecho en Argentina 🇦🇷                        │
│ Instagram | LinkedIn | Twitter                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Subscription Plans & Pricing

### 2.1 Plan Structure

| Feature | INICIAL | PROFESIONAL | EMPRESA |
|---------|---------|-------------|---------|
| **Precio mensual** | $15.000 ARS | $25.000 ARS | $45.000 ARS |
| **Precio anual** (20% dto) | $144.000/año | $240.000/año | $432.000/año |
| **USD equivalente** | ~$15/mes | ~$25/mes | ~$45/mes |
| | | | |
| Usuarios | 1 | 5 | Ilimitados |
| Trabajos/mes | 50 | 200 | Ilimitados |
| Clientes | 100 | 500 | Ilimitados |
| | | | |
| Facturación AFIP | ✅ | ✅ | ✅ |
| MercadoPago | ✅ | ✅ | ✅ |
| App técnicos | ✅ | ✅ | ✅ |
| | | | |
| WhatsApp Business | ❌ | ✅ | ✅ |
| Reportes avanzados | ❌ | ✅ | ✅ |
| Voice AI | ❌ | ❌ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| Soporte prioritario | ❌ | ❌ | ✅ |
| Onboarding dedicado | ❌ | ❌ | ✅ |

### 2.2 Trial & Conversion

```
Free Trial Flow:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Signup   │ →  │ 14 días  │ →  │ Reminder │ →  │ Convert  │
│          │    │ full     │    │ día 10   │    │ or churn │
│          │    │ access   │    │ día 13   │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     ↓
              Plan PROFESIONAL
              features enabled
```

**Trial Rules:**
- 14 días gratis con plan PROFESIONAL
- No requiere tarjeta para empezar
- Email/WhatsApp reminders día 3, 7, 10, 13
- Downgrade automático a INICIAL si no paga (o suspend)

### 2.3 Billing Cycle

| Cycle | Discount | When to Charge |
|-------|----------|----------------|
| Mensual | 0% | Día de signup cada mes |
| Trimestral | 10% | Cada 3 meses |
| Anual | 20% | Una vez al año |

---

## 3. Payment System Architecture

### 3.1 Database Models

```prisma
// Add to schema.prisma

model Subscription {
  id              String             @id @default(cuid())
  organizationId  String             @unique
  plan            SubscriptionPlan   @default(TRIAL)
  status          SubscriptionStatus @default(TRIALING)
  billingCycle    BillingCycle       @default(MONTHLY)

  // Dates
  trialEndsAt     DateTime?
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  canceledAt      DateTime?

  // Payment
  paymentMethod   PaymentMethodType?
  mpSubscriptionId String?           // MercadoPago subscription ID

  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  organization    Organization       @relation(fields: [organizationId], references: [id])
  payments        SubscriptionPayment[]

  @@map("subscriptions")
}

model SubscriptionPayment {
  id              String        @id @default(cuid())
  subscriptionId  String
  amount          Decimal       @db.Decimal(10, 2)
  currency        String        @default("ARS")
  status          PaymentStatus @default(PENDING)
  paymentMethod   PaymentMethodType

  // External references
  externalId      String?       // MP payment ID, crypto tx hash, etc.
  externalData    Json?         // Full response from payment provider

  // Dates
  paidAt          DateTime?
  failedAt        DateTime?
  refundedAt      DateTime?

  createdAt       DateTime      @default(now())

  subscription    Subscription  @relation(fields: [subscriptionId], references: [id])

  @@map("subscription_payments")
}

enum SubscriptionPlan {
  TRIAL
  INICIAL
  PROFESIONAL
  EMPRESA
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  SUSPENDED
}

enum BillingCycle {
  MONTHLY
  QUARTERLY
  YEARLY
}

enum PaymentMethodType {
  MERCADOPAGO
  CREDIT_CARD
  DEBIT_CARD
  BANK_TRANSFER
  CRYPTO_USDT
  CRYPTO_BTC
  CASH
}
```

### 3.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│  Landing Page → Pricing → Checkout → Payment Selection          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES                                 │
│  /api/subscriptions/create                                      │
│  /api/subscriptions/checkout                                    │
│  /api/subscriptions/webhook                                     │
│  /api/payments/[provider]/callback                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PAYMENT PROVIDERS                             │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │MercadoPago│  │ Stripe   │  │ Crypto   │  │  Bank    │        │
│  │Checkout  │  │ (cards)  │  │ Binance  │  │ Transfer │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR ACCOUNTS                                │
│                                                                 │
│  MercadoPago Business Account → Withdraw to Bank                │
│  Binance Account → Convert to ARS → Bank                        │
│  Bank Account (CBU) ← Direct transfers                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Payment Methods Implementation

### 4.1 MercadoPago (Primary - 80% of payments)

**Why MercadoPago:**
- Most popular in Argentina
- Handles credit/debit cards
- Supports recurring subscriptions
- QR code payments
- Instant bank transfers (CVU)

**Implementation:**

```typescript
// lib/payments/mercadopago.ts

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  options: { timeout: 5000 }
});

export async function createSubscription(
  organizationId: string,
  plan: 'INICIAL' | 'PROFESIONAL' | 'EMPRESA',
  billingCycle: 'MONTHLY' | 'YEARLY'
) {
  const prices = {
    INICIAL: { MONTHLY: 15000, YEARLY: 144000 },
    PROFESIONAL: { MONTHLY: 25000, YEARLY: 240000 },
    EMPRESA: { MONTHLY: 45000, YEARLY: 432000 },
  };

  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [{
        id: `${plan}-${billingCycle}`,
        title: `CampoTech ${plan}`,
        description: `Suscripción ${billingCycle === 'MONTHLY' ? 'mensual' : 'anual'}`,
        quantity: 1,
        unit_price: prices[plan][billingCycle],
        currency_id: 'ARS',
      }],
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_URL}/subscription/success`,
        failure: `${process.env.NEXT_PUBLIC_URL}/subscription/failure`,
        pending: `${process.env.NEXT_PUBLIC_URL}/subscription/pending`,
      },
      auto_return: 'approved',
      external_reference: organizationId,
      notification_url: `${process.env.NEXT_PUBLIC_URL}/api/webhooks/mercadopago`,
    }
  });

  return result;
}
```

**MercadoPago Account Setup:**
1. Create MercadoPago Business account at https://www.mercadopago.com.ar/developers
2. Complete identity verification (DNI/CUIT)
3. Link bank account for withdrawals
4. Get API credentials (Access Token)
5. Set up webhook notifications

**Fees:**
- Credit card: 4.99% + IVA
- Debit card: 2.99% + IVA
- Account money: 0.5% + IVA
- Bank transfer: Free

### 4.2 Credit/Debit Cards via Stripe

**Why Stripe (in addition to MP):**
- Better international card support
- Lower fees for some card types
- Better developer experience
- Subscription management built-in

**Implementation:**

```typescript
// lib/payments/stripe.ts

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function createCheckoutSession(
  organizationId: string,
  priceId: string, // Stripe Price ID
  customerEmail: string
) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: customerEmail,
    client_reference_id: organizationId,
    success_url: `${process.env.NEXT_PUBLIC_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    metadata: { organizationId },
  });

  return session;
}
```

**Stripe Setup for Argentina:**
1. Create Stripe account (stripe.com)
2. Note: Stripe Argentina has limitations - may need US entity
3. Alternative: Use Stripe Atlas to create US company
4. Or: Use MercadoPago for local, Stripe for international

### 4.3 Cryptocurrency (USDT/BTC)

**Why Crypto:**
- Hedge against peso devaluation
- International customers
- Lower fees for large amounts
- Popular with tech-savvy businesses

**Options:**

#### Option A: Binance Pay (Recommended)
```typescript
// lib/payments/binance.ts

export async function createCryptoPayment(
  organizationId: string,
  amountUSD: number,
  currency: 'USDT' | 'BTC' | 'ETH'
) {
  // Binance Pay API
  const response = await fetch('https://bpay.binanceapi.com/binancepay/openapi/v2/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': Date.now().toString(),
      'BinancePay-Nonce': generateNonce(),
      'BinancePay-Certificate-SN': process.env.BINANCE_API_KEY!,
      'BinancePay-Signature': generateSignature(payload),
    },
    body: JSON.stringify({
      merchantTradeNo: `CT-${organizationId}-${Date.now()}`,
      orderAmount: amountUSD,
      currency: currency,
      goods: {
        goodsType: '02', // Virtual goods
        goodsCategory: 'Software',
        referenceGoodsId: organizationId,
        goodsName: 'CampoTech Subscription',
      },
      returnUrl: `${process.env.NEXT_PUBLIC_URL}/subscription/success`,
      cancelUrl: `${process.env.NEXT_PUBLIC_URL}/pricing`,
      webhookUrl: `${process.env.NEXT_PUBLIC_URL}/api/webhooks/binance`,
    }),
  });

  return response.json();
}
```

#### Option B: Direct Wallet (Manual)
```
Show QR code with wallet address:
- USDT (TRC20): TYourWalletAddress...
- BTC: bc1yourwalletaddress...

User sends crypto → Webhook detects → Activate subscription
```

**Crypto Account Setup:**
1. Create Binance account with verification
2. Enable Binance Pay Merchant
3. Get API keys
4. Set up webhook for payment notifications
5. Configure auto-convert to USDT or withdraw to bank via P2P

### 4.4 Bank Transfer (CBU/CVU)

**Direct bank transfer for businesses that prefer it:**

```typescript
// lib/payments/bank-transfer.ts

export function getBankTransferDetails(organizationId: string) {
  return {
    bank: 'Banco Galicia', // or your bank
    accountHolder: 'CampoTech SRL',
    cbu: '0070999030004123456789', // Your CBU
    alias: 'CAMPOTECH.PAGOS',
    cuit: '30-12345678-9',
    reference: `CT-${organizationId}`, // Customer puts this in description
    instructions: [
      '1. Realizá la transferencia desde tu banco',
      '2. Usá la referencia indicada en el concepto',
      '3. Envianos el comprobante por WhatsApp',
      '4. Activamos tu cuenta en 24hs hábiles',
    ],
  };
}
```

**Manual Verification Flow:**
1. Customer initiates bank transfer payment
2. System generates unique reference code
3. Customer transfers to your CBU with reference
4. Admin dashboard shows pending bank payments
5. Admin verifies in bank statement
6. Admin clicks "Confirm Payment"
7. System activates subscription

### 4.5 Cash Payment (Rapipago/PagoFácil)

**For customers without digital payment methods:**

```typescript
// Using MercadoPago's cash payment network

export async function createCashPayment(
  organizationId: string,
  amount: number
) {
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [{
        title: 'CampoTech Subscription',
        quantity: 1,
        unit_price: amount,
        currency_id: 'ARS',
      }],
      payment_methods: {
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
        ],
        // Only allow: Rapipago, PagoFácil, etc.
      },
      external_reference: organizationId,
    }
  });

  return result;
}
```

---

## 5. Bank Account & Money Flow

### 5.1 Required Accounts

| Account | Purpose | Setup |
|---------|---------|-------|
| **MercadoPago Business** | Receive card/MP payments | mercadopago.com.ar |
| **Bank Account (CBU)** | Receive transfers, withdraw MP | Any Argentine bank |
| **Binance** | Receive crypto | binance.com |
| **Stripe** (Optional) | International cards | stripe.com |

### 5.2 Money Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER PAYS                               │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │  MP    │    │ Crypto │    │  Bank  │    │  Card  │
    │Payment │    │ USDT   │    │Transfer│    │ Stripe │
    └────────┘    └────────┘    └────────┘    └────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │   MP   │    │Binance │    │  Your  │    │ Stripe │
    │Account │    │Account │    │  Bank  │    │Account │
    │ (ARS)  │    │ (USDT) │    │  (ARS) │    │ (USD)  │
    └────────┘    └────────┘    └────────┘    └────────┘
         │              │                          │
         │              │                          │
         ▼              ▼                          ▼
    ┌─────────────────────────────────────────────────┐
    │              YOUR BANK ACCOUNT                  │
    │                  (ARS)                          │
    │                                                 │
    │  Options:                                       │
    │  • MP → Withdraw to bank (free, instant)        │
    │  • Binance → P2P sell to ARS → Bank             │
    │  • Stripe → Wire to US account → Transfer       │
    └─────────────────────────────────────────────────┘
                         │
                         ▼
    ┌─────────────────────────────────────────────────┐
    │              BUSINESS EXPENSES                  │
    │  • Hosting (Vercel, Supabase)                   │
    │  • Twilio SMS                                   │
    │  • OpenAI API                                   │
    │  • Salaries                                     │
    │  • Taxes (Monotributo/Resp. Inscripto)          │
    └─────────────────────────────────────────────────┘
```

### 5.3 Withdrawal Schedule

| Source | Frequency | Method | Time |
|--------|-----------|--------|------|
| MercadoPago | Daily or manual | Transfer to CBU | Instant |
| Binance | Weekly | P2P → Bank | 1-24 hours |
| Stripe | Rolling 7 days | Wire transfer | 3-5 days |
| Bank transfers | Already in bank | N/A | Instant |

### 5.4 Accounting Integration

```typescript
// Track all payments for accounting

interface PaymentRecord {
  date: Date;
  source: 'MERCADOPAGO' | 'STRIPE' | 'BINANCE' | 'BANK_TRANSFER';
  grossAmount: number;
  fees: number;
  netAmount: number;
  currency: 'ARS' | 'USD' | 'USDT';
  exchangeRate?: number; // For non-ARS
  invoiceId?: string; // AFIP invoice if applicable
  organizationId: string;
}
```

---

## 6. Implementation Phases

### Phase 1: Landing Page (Week 1)
**Goal:** Public-facing website that converts visitors

| Task | Priority | Estimate |
|------|----------|----------|
| Create `app/page.tsx` (landing page) | P0 | 4h |
| Hero section with mockups | P0 | 2h |
| Features carousel component | P0 | 3h |
| Pricing section component | P0 | 2h |
| How it works section | P1 | 1h |
| Testimonials section | P1 | 1h |
| Footer component | P1 | 1h |
| Mobile responsive design | P0 | 2h |
| SEO meta tags | P1 | 1h |

**Deliverables:**
- [ ] Landing page live at `/`
- [ ] Pricing page at `/pricing`
- [ ] Mobile-optimized
- [ ] Links to `/login` and `/signup`

### Phase 2: Subscription Database (Week 1-2)
**Goal:** Track subscriptions and trials

| Task | Priority | Estimate |
|------|----------|----------|
| Add Subscription model to schema | P0 | 1h |
| Add SubscriptionPayment model | P0 | 1h |
| Run Prisma migration | P0 | 0.5h |
| Create subscription on user signup | P0 | 2h |
| Trial expiration check (cron) | P0 | 2h |
| Subscription status API | P0 | 2h |
| Feature gating by plan | P0 | 3h |

**Deliverables:**
- [ ] All new signups get 14-day trial
- [ ] Features limited by plan
- [ ] Trial expiration warnings

### Phase 3: MercadoPago Integration (Week 2)
**Goal:** Accept payments via MercadoPago

| Task | Priority | Estimate |
|------|----------|----------|
| Create MercadoPago business account | P0 | 1h |
| Install `mercadopago` SDK | P0 | 0.5h |
| Create checkout preference API | P0 | 2h |
| Build checkout page UI | P0 | 3h |
| Webhook handler for payments | P0 | 3h |
| Update subscription on payment | P0 | 2h |
| Payment success/failure pages | P0 | 1h |
| Test with sandbox | P0 | 2h |
| Go live with production keys | P0 | 1h |

**Deliverables:**
- [ ] Customers can pay with MP
- [ ] Automatic subscription activation
- [ ] Payment receipts

### Phase 4: Additional Payment Methods (Week 3)
**Goal:** Offer crypto and bank transfer options

| Task | Priority | Estimate |
|------|----------|----------|
| Binance Pay integration | P1 | 4h |
| Bank transfer flow | P1 | 3h |
| Admin payment verification UI | P1 | 2h |
| Payment method selection UI | P0 | 2h |
| Crypto payment webhook | P1 | 2h |

**Deliverables:**
- [ ] 3+ payment options available
- [ ] Admin can verify bank transfers
- [ ] Crypto payments auto-confirm

### Phase 5: Billing Management (Week 3-4)
**Goal:** Self-service billing for customers

| Task | Priority | Estimate |
|------|----------|----------|
| Billing settings page | P0 | 3h |
| View current plan | P0 | 1h |
| Upgrade/downgrade flow | P0 | 4h |
| Cancel subscription | P0 | 2h |
| Payment history | P1 | 2h |
| Download invoices | P1 | 2h |
| Update payment method | P1 | 2h |

**Deliverables:**
- [ ] `/settings/billing` page
- [ ] Plan changes work
- [ ] Invoice download

### Phase 6: Automated Billing (Week 4)
**Goal:** Recurring payments work automatically

| Task | Priority | Estimate |
|------|----------|----------|
| MP recurring subscription setup | P0 | 4h |
| Failed payment handling | P0 | 3h |
| Dunning emails (payment failed) | P0 | 2h |
| Grace period logic | P0 | 2h |
| Suspend account after X failures | P0 | 2h |
| Reactivation flow | P1 | 2h |

**Deliverables:**
- [ ] Monthly charges auto-process
- [ ] Failed payments retry
- [ ] Accounts suspend after failures

### Phase 7: Analytics & Admin (Week 4-5)
**Goal:** Track revenue and manage subscriptions

| Task | Priority | Estimate |
|------|----------|----------|
| Admin subscription dashboard | P1 | 3h |
| MRR/ARR metrics | P1 | 2h |
| Churn tracking | P1 | 2h |
| Revenue by plan chart | P1 | 2h |
| Manual subscription override | P1 | 2h |
| Export payment data | P2 | 1h |

**Deliverables:**
- [ ] Admin can see all subscriptions
- [ ] Revenue metrics dashboard
- [ ] Export for accounting

---

## 7. Technical Requirements

### 7.1 Environment Variables

```env
# MercadoPago
MP_ACCESS_TOKEN=APP_USR-xxx
MP_PUBLIC_KEY=APP_USR-xxx
MP_WEBHOOK_SECRET=xxx

# Stripe (optional)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Binance Pay
BINANCE_API_KEY=xxx
BINANCE_API_SECRET=xxx
BINANCE_MERCHANT_ID=xxx

# Bank Transfer
BANK_CBU=0070999030004123456789
BANK_ALIAS=CAMPOTECH.PAGOS
BANK_HOLDER=CampoTech SRL
BANK_CUIT=30-12345678-9
```

### 7.2 Dependencies

```json
{
  "dependencies": {
    "mercadopago": "^2.0.0",
    "stripe": "^14.0.0",
    "@binance/connector": "^3.0.0"
  }
}
```

### 7.3 Cron Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `check-trial-expiry` | Daily | Warn users about expiring trials |
| `process-recurring` | Daily | Process due subscription payments |
| `cleanup-pending` | Daily | Cancel abandoned checkouts |
| `sync-mp-payments` | Hourly | Verify payment statuses |

### 7.4 Webhooks to Implement

| Endpoint | Source | Purpose |
|----------|--------|---------|
| `/api/webhooks/mercadopago` | MercadoPago | Payment notifications |
| `/api/webhooks/stripe` | Stripe | Subscription events |
| `/api/webhooks/binance` | Binance Pay | Crypto payments |

---

## 8. Legal & Compliance

### 8.1 Required Legal Pages

| Page | Content |
|------|---------|
| `/terms` | Términos y Condiciones de Uso |
| `/privacy` | Política de Privacidad (Ley 25.326) |
| `/refund` | Política de Reembolso |
| `/billing-terms` | Términos de Facturación |

### 8.2 AFIP Compliance

Since you're selling SaaS subscriptions in Argentina:

1. **Monotributo or Responsable Inscripto**
   - Monotributo: Up to ~$5M ARS/year revenue
   - RI: Above that, requires monthly IVA declarations

2. **Invoice Requirements**
   - Issue Factura C (Monotributo) or Factura A/B (RI) for each payment
   - Electronic invoices via AFIP web service
   - Keep for 10 years

3. **Currency Considerations**
   - If accepting USD/crypto, report in ARS at exchange rate
   - Keep records of all conversions

### 8.3 Consumer Protection (Ley 24.240)

- 10-day "arrepentimiento" (regret) period for online sales
- Clear pricing with all fees included
- Easy cancellation process
- Refund within 10 days if requested

### 8.4 Data Protection (Ley 25.326)

- Register database with AAIP if storing personal data
- Privacy policy required
- User consent for data collection
- Right to access/delete data

---

## Summary

This plan covers everything needed to launch CampoTech's public presence and subscription system:

1. **Landing Page** - Convert visitors to signups
2. **Subscription System** - Track plans and trials
3. **Payment Processing** - MercadoPago, crypto, transfers
4. **Billing Management** - Self-service for customers
5. **Admin Tools** - Revenue tracking and management

**Estimated Total Time:** 4-5 weeks for full implementation

**Priority Order:**
1. Landing page (can launch immediately)
2. MercadoPago integration (most customers)
3. Subscription tracking
4. Additional payment methods
5. Advanced billing features

---

*Document created: December 2024*
*Last updated: December 2024*
