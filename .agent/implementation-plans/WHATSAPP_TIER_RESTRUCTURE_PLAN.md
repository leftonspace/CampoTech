# WhatsApp Tier Restructure - Implementation Plan

**Created:** 2026-02-06  
**Status:** PLANNING  
**Strategy:** "Acceso Anticipado" - Beta WhatsApp for First 20 Customers

---

## Executive Summary

### The Approach
- **First 20 PROFESIONAL customers** get WhatsApp AI with a dedicated number
- **Everyone else** gets wa.me links (manual WhatsApp) + joins a waitlist
- **When someone cancels**, their spot goes to next in line
- **Full rollout** when Tech Provider approval is obtained from Meta

### Why This Strategy
1. ✅ **No broken promises** - Only offer what you can deliver (20 numbers max initially)
2. ✅ **Creates urgency** - "Solo 20 cupos disponibles" drives early signups
3. ✅ **Honest marketing** - Builds trust with your audience
4. ✅ **Self-regulating** - Churn opens spots for waitlist
5. ✅ **Scalable later** - Easy to increase limit when approved

### Tier Structure

| Tier | Price | WhatsApp Feature |
|------|-------|------------------|
| FREE | $0 | wa.me links only |
| INICIAL | $20/mo | wa.me links only |
| PROFESIONAL | $35/mo | Acceso Anticipado (if spot available) or Waitlist + wa.me |
| EMPRESA | $55/mo | Priority Waitlist + wa.me links |

---

# PART A: CODEBASE IMPLEMENTATION

## Phase 1: Database Schema

### 1.1 Add WhatsApp Waitlist Model

**File:** `apps/web/prisma/schema.prisma`

```prisma
// Add this new model
model WhatsAppWaitlist {
  id              String         @id @default(cuid())
  organizationId  String         @unique @map("organization_id")
  organization    Organization   @relation(fields: [organizationId], references: [id])
  
  // Position tracking
  position        Int            @map("position")
  joinedAt        DateTime       @default(now()) @map("joined_at")
  
  // Status
  status          WaitlistStatus @default(WAITING)
  notifiedAt      DateTime?      @map("notified_at")
  offeredUntil    DateTime?      @map("offered_until")
  activatedAt     DateTime?      @map("activated_at")
  
  // Metadata
  tier            String         @default("PROFESIONAL")
  emailsSent      Int            @default(0) @map("emails_sent")
  
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")
  
  @@index([status, position])
  @@map("whatsapp_waitlist")
}

enum WaitlistStatus {
  WAITING
  OFFERED
  ACTIVATED
  DECLINED
  EXPIRED
  CANCELLED
}

// Add to Organization model
// whatsappWaitlist WhatsAppWaitlist?
```

### 1.2 Migration Command

```bash
pnpm prisma migrate dev --name add_whatsapp_waitlist
```

---

## Phase 2: Waitlist Service

### 2.1 Create Waitlist Service

**File:** `apps/web/lib/services/whatsapp-waitlist.service.ts`

```typescript
/**
 * WhatsApp Waitlist Service
 * 
 * Manages the "Acceso Anticipado" program for WhatsApp AI.
 * First 20 PROFESIONAL customers get instant access,
 * everyone else joins the waitlist.
 */

import { prisma } from '@/lib/prisma';
import { addHours } from 'date-fns';
import { numberInventoryService } from './number-inventory.service';

const MAX_EARLY_ACCESS_SPOTS = 20;
const OFFER_EXPIRATION_HOURS = 48;

export const whatsAppWaitlistService = {
  
  /**
   * Check available spots for landing page counter
   */
  async getAvailability(): Promise<{ 
    spotsLeft: number; 
    available: boolean;
    waitlistCount: number;
  }> {
    const [activeCount, waitlistCount] = await Promise.all([
      prisma.organization.count({
        where: {
          whatsappTier: 'BSP_PROVISIONED',
          subscriptionStatus: 'active',
        },
      }),
      prisma.whatsAppWaitlist.count({
        where: { status: 'WAITING' },
      }),
    ]);
    
    const spotsLeft = Math.max(0, MAX_EARLY_ACCESS_SPOTS - activeCount);
    return { 
      spotsLeft, 
      available: spotsLeft > 0,
      waitlistCount,
    };
  },
  
  /**
   * Try to assign a spot, or add to waitlist
   * Called when PROFESIONAL subscription activates
   */
  async handleProfesionalSignup(organizationId: string): Promise<{
    gotSpot: boolean;
    waitlistPosition?: number;
    phoneNumber?: string;
  }> {
    const { available } = await this.getAvailability();
    
    if (available) {
      // Assign number immediately
      const result = await numberInventoryService.instantAssign(organizationId, 'AR');
      
      if (result.success && result.number) {
        await prisma.organization.update({
          where: { id: organizationId },
          data: { whatsappTier: 'BSP_PROVISIONED' },
        });
        
        return { 
          gotSpot: true, 
          phoneNumber: result.number.phoneNumber,
        };
      }
    }
    
    // No spots available - add to waitlist
    const position = await this.joinWaitlist(organizationId);
    return { gotSpot: false, waitlistPosition: position };
  },
  
  /**
   * Add organization to waitlist
   */
  async joinWaitlist(organizationId: string): Promise<number> {
    // Check if already on waitlist
    const existing = await prisma.whatsAppWaitlist.findUnique({
      where: { organizationId },
    });
    
    if (existing) {
      return await this.getPosition(organizationId) ?? existing.position;
    }
    
    // Get next position
    const lastEntry = await prisma.whatsAppWaitlist.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    
    const newPosition = (lastEntry?.position ?? 0) + 1;
    
    await prisma.whatsAppWaitlist.create({
      data: {
        organizationId,
        position: newPosition,
        tier: 'PROFESIONAL',
      },
    });
    
    return newPosition;
  },
  
  /**
   * Get current position in waitlist (accounting for people who left)
   */
  async getPosition(organizationId: string): Promise<number | null> {
    const entry = await prisma.whatsAppWaitlist.findUnique({
      where: { organizationId },
      select: { position: true, status: true },
    });
    
    if (!entry || entry.status !== 'WAITING') {
      return null;
    }
    
    const aheadCount = await prisma.whatsAppWaitlist.count({
      where: {
        status: 'WAITING',
        position: { lt: entry.position },
      },
    });
    
    return aheadCount + 1;
  },
  
  /**
   * Offer spot to next person in line
   * Called when a customer cancels
   */
  async offerNextSpot(): Promise<{ offered: boolean; organizationId?: string }> {
    const nextInLine = await prisma.whatsAppWaitlist.findFirst({
      where: { status: 'WAITING' },
      orderBy: { position: 'asc' },
      include: { organization: true },
    });
    
    if (!nextInLine) {
      return { offered: false };
    }
    
    await prisma.whatsAppWaitlist.update({
      where: { id: nextInLine.id },
      data: {
        status: 'OFFERED',
        notifiedAt: new Date(),
        offeredUntil: addHours(new Date(), OFFER_EXPIRATION_HOURS),
      },
    });
    
    // TODO: Send email notification
    // await sendWhatsAppSpotAvailableEmail(nextInLine.organization);
    
    return { offered: true, organizationId: nextInLine.organizationId };
  },
  
  /**
   * Claim an offered spot
   * Called when customer clicks "Activate" from email/dashboard
   */
  async claimSpot(organizationId: string): Promise<{ success: boolean; error?: string }> {
    const entry = await prisma.whatsAppWaitlist.findUnique({
      where: { organizationId },
    });
    
    if (!entry || entry.status !== 'OFFERED') {
      return { success: false, error: 'No hay oferta disponible' };
    }
    
    if (entry.offeredUntil && entry.offeredUntil < new Date()) {
      await prisma.whatsAppWaitlist.update({
        where: { organizationId },
        data: { status: 'EXPIRED' },
      });
      await this.offerNextSpot();
      return { success: false, error: 'La oferta expiró' };
    }
    
    const result = await numberInventoryService.instantAssign(organizationId, 'AR');
    
    if (!result.success) {
      return { success: false, error: 'No hay números disponibles' };
    }
    
    await prisma.$transaction([
      prisma.whatsAppWaitlist.update({
        where: { organizationId },
        data: { status: 'ACTIVATED', activatedAt: new Date() },
      }),
      prisma.organization.update({
        where: { id: organizationId },
        data: { whatsappTier: 'BSP_PROVISIONED' },
      }),
    ]);
    
    return { success: true };
  },
  
  /**
   * Handle subscription cancellation - release spot
   */
  async handleCancellation(organizationId: string): Promise<void> {
    // Release number back to inventory
    await numberInventoryService.releaseByOrgId(organizationId, 'cancellation');
    
    // Reset org WhatsApp tier
    await prisma.organization.update({
      where: { id: organizationId },
      data: { whatsappTier: 'WAME_ONLY' },
    });
    
    // Offer spot to next in line
    await this.offerNextSpot();
  },
};
```

---

## Phase 3: API Routes

### 3.1 Public Spots Counter API

**File:** `apps/web/app/api/whatsapp/spots-available/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { whatsAppWaitlistService } from '@/lib/services/whatsapp-waitlist.service';

export async function GET() {
  const availability = await whatsAppWaitlistService.getAvailability();
  return NextResponse.json(availability);
}
```

### 3.2 Claim Spot API

**File:** `apps/web/app/api/whatsapp/claim-spot/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { whatsAppWaitlistService } from '@/lib/services/whatsapp-waitlist.service';

export const POST = withAuth(async (request, { organizationId }) => {
  const result = await whatsAppWaitlistService.claimSpot(organizationId);
  
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  
  return NextResponse.json({ success: true });
});
```

### 3.3 Waitlist Position API

**File:** `apps/web/app/api/whatsapp/waitlist-position/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { whatsAppWaitlistService } from '@/lib/services/whatsapp-waitlist.service';

export const GET = withAuth(async (request, { organizationId }) => {
  const position = await whatsAppWaitlistService.getPosition(organizationId);
  
  // Check if they have an offer pending
  const entry = await prisma.whatsAppWaitlist.findUnique({
    where: { organizationId },
    select: { status: true, offeredUntil: true },
  });
  
  return NextResponse.json({
    position,
    status: entry?.status ?? null,
    offeredUntil: entry?.offeredUntil ?? null,
  });
});
```

---

## Phase 4: UI Components

### 4.1 Early Access Counter (Landing Page)

**File:** `apps/web/components/whatsapp/EarlyAccessCounter.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';

export function EarlyAccessCounter() {
  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-spots'],
    queryFn: () => fetch('/api/whatsapp/spots-available').then(r => r.json()),
    refetchInterval: 30000,
  });
  
  const spotsLeft = data?.spotsLeft ?? 0;
  const waitlistCount = data?.waitlistCount ?? 0;
  const percentage = ((20 - spotsLeft) / 20) * 100;
  
  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 rounded-xl h-32" />;
  }
  
  return (
    <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white">
      <h3 className="text-lg font-bold mb-2">
        🚀 WhatsApp IA - Acceso Anticipado
      </h3>
      
      {spotsLeft > 0 ? (
        <>
          <div className="text-4xl font-bold mb-2">
            {spotsLeft} <span className="text-xl">cupos disponibles</span>
          </div>
          <div className="w-full bg-white/30 rounded-full h-3 mb-3">
            <div 
              className="bg-white h-3 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-sm opacity-90">
            Los primeros 20 clientes PROFESIONAL obtienen WhatsApp con IA
          </p>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold mb-2">⏳ Cupos agotados</div>
          <p className="text-sm opacity-90">
            Unite a la lista de espera. Te avisamos cuando haya lugar.
          </p>
          <div className="mt-2 text-sm">
            📊 {waitlistCount} personas en espera
          </div>
        </>
      )}
    </div>
  );
}
```

### 4.2 Waitlist Status (Dashboard)

**File:** `apps/web/components/whatsapp/WaitlistStatus.tsx`

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function WaitlistStatus() {
  const queryClient = useQueryClient();
  
  const { data } = useQuery({
    queryKey: ['waitlist-position'],
    queryFn: () => fetch('/api/whatsapp/waitlist-position').then(r => r.json()),
  });
  
  const claimMutation = useMutation({
    mutationFn: () => fetch('/api/whatsapp/claim-spot', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist-position'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
  });
  
  if (!data || data.position === null) {
    return null;
  }
  
  // Spot offered!
  if (data.status === 'OFFERED') {
    const expiresIn = data.offeredUntil 
      ? formatDistanceToNow(new Date(data.offeredUntil), { locale: es, addSuffix: true })
      : '48 horas';
    
    return (
      <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6">
        <h3 className="text-xl font-bold text-green-700 mb-2">
          🎉 ¡Tu turno llegó!
        </h3>
        <p className="text-gray-700 mb-2">
          Un cupo de WhatsApp IA se liberó. Tenés hasta {expiresIn} para activarlo.
        </p>
        <Button 
          onClick={() => claimMutation.mutate()}
          disabled={claimMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          {claimMutation.isPending ? 'Activando...' : 'Activar mi número WhatsApp'}
        </Button>
      </div>
    );
  }
  
  // In waitlist
  return (
    <div className="bg-gray-50 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-2">
        📋 Lista de espera - WhatsApp IA
      </h3>
      <div className="text-4xl font-bold text-primary mb-2">
        #{data.position}
      </div>
      <p className="text-sm text-gray-600">
        Tu posición en la lista. Te notificaremos cuando haya un cupo.
      </p>
      <p className="text-xs text-gray-500 mt-3">
        Mientras tanto, podés enviar mensajes usando "Enviar por WhatsApp".
      </p>
    </div>
  );
}
```

### 4.3 WhatsApp Actions (Jobs Page)

**File:** `apps/web/components/jobs/WhatsAppActions.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare, Bell, Send } from 'lucide-react';
import { generateWhatsAppLink, WhatsAppMessageTemplates } from '@/lib/whatsapp-links';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WhatsAppActionsProps {
  job: {
    number: string;
    customer: { name: string; phone: string | null } | null;
    scheduledDate?: string | null;
    scheduledTimeSlot?: { start?: string } | null;
  };
}

export function WhatsAppActions({ job }: WhatsAppActionsProps) {
  if (!job.customer?.phone) {
    return <p className="text-sm text-gray-500">Cliente sin teléfono</p>;
  }
  
  const formatDate = (date: string) => 
    format(new Date(date), 'dd/MM/yyyy', { locale: es });
  
  const handleConfirmation = () => {
    const date = job.scheduledDate ? formatDate(job.scheduledDate) : 'fecha a confirmar';
    const time = job.scheduledTimeSlot?.start || 'horario a confirmar';
    const message = WhatsAppMessageTemplates.job.confirmation(job.number, date, time);
    window.open(generateWhatsAppLink(job.customer!.phone!, message), '_blank');
  };
  
  const handleReminder = () => {
    const date = job.scheduledDate ? formatDate(job.scheduledDate) : 'mañana';
    const message = WhatsAppMessageTemplates.job.reminder(job.number, date);
    window.open(generateWhatsAppLink(job.customer!.phone!, message), '_blank');
  };
  
  const handleCustom = () => {
    const message = `Hola ${job.customer!.name}, `;
    window.open(generateWhatsAppLink(job.customer!.phone!, message), '_blank');
  };
  
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handleConfirmation}>
        <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
        Confirmar turno
      </Button>
      <Button variant="outline" size="sm" onClick={handleReminder}>
        <Bell className="w-4 h-4 mr-2 text-orange-500" />
        Recordatorio
      </Button>
      <Button variant="ghost" size="sm" onClick={handleCustom}>
        <Send className="w-4 h-4 mr-2" />
        Mensaje
      </Button>
    </div>
  );
}
```

---

## Phase 5: Integration Points

### 5.1 Hook into Subscription Activation

**File:** `apps/web/lib/subscription/payment-processor.ts`

Add after subscription activation:

```typescript
import { whatsAppWaitlistService } from '../services/whatsapp-waitlist.service';

// In handlePaymentSuccess, after subscription is activated:
if (newTier === 'PROFESIONAL' || newTier === 'EMPRESA') {
  const result = await whatsAppWaitlistService.handleProfesionalSignup(organizationId);
  
  if (result.gotSpot) {
    console.log(`[Subscription] Org ${organizationId} got WhatsApp spot with number ${result.phoneNumber}`);
  } else {
    console.log(`[Subscription] Org ${organizationId} added to waitlist at position ${result.waitlistPosition}`);
  }
}
```

### 5.2 Hook into Subscription Cancellation

**File:** `apps/web/lib/services/subscription-cancellation.ts`

Add to cancellation flow:

```typescript
import { whatsAppWaitlistService } from './whatsapp-waitlist.service';

// In cancelSubscription, after marking as cancelled:
if (previousTier === 'PROFESIONAL' || previousTier === 'EMPRESA') {
  await whatsAppWaitlistService.handleCancellation(organizationId);
}
```

### 5.3 Cron Job for Expired Offers

**File:** `apps/web/app/api/cron/whatsapp-waitlist/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { whatsAppWaitlistService } from '@/lib/services/whatsapp-waitlist.service';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Expire old offers
  const expired = await prisma.whatsAppWaitlist.findMany({
    where: {
      status: 'OFFERED',
      offeredUntil: { lt: new Date() },
    },
  });
  
  for (const entry of expired) {
    await prisma.whatsAppWaitlist.update({
      where: { id: entry.id },
      data: { status: 'EXPIRED' },
    });
    await whatsAppWaitlistService.offerNextSpot();
  }
  
  // Fill any open spots
  const { spotsLeft } = await whatsAppWaitlistService.getAvailability();
  const pendingOffers = await prisma.whatsAppWaitlist.count({
    where: { status: 'OFFERED' },
  });
  
  const offersToMake = spotsLeft - pendingOffers;
  for (let i = 0; i < offersToMake; i++) {
    await whatsAppWaitlistService.offerNextSpot();
  }
  
  return NextResponse.json({ 
    expired: expired.length,
    newOffers: offersToMake,
  });
}
```

**Add to `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/whatsapp-waitlist",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## Phase 6: Landing Page Updates

### 6.1 Add Counter to Pricing Section

**File:** `apps/web/app/page.tsx`

In the pricing section, add the EarlyAccessCounter:

```typescript
import { EarlyAccessCounter } from '@/components/whatsapp/EarlyAccessCounter';

// In PricingSection, above the pricing cards:
<div className="max-w-md mx-auto mb-8">
  <EarlyAccessCounter />
</div>
```

### 6.2 Update PROFESIONAL Features List

```typescript
const profesionalFeatures = [
  '5 usuarios',
  '200 trabajos/mes',
  'App técnico',
  'Facturación AFIP',
  '📱 WhatsApp IA (Acceso Anticipado - 20 cupos)',  // Updated
  'Inventario completo',
  'Reportes de voz',
];
```

---

# PART B: EXTERNAL SETUP

## Step 1: Create Meta Business Account

1. Go to [business.facebook.com](https://business.facebook.com)
2. Click "Create Account"
3. Name: **CampoTech**
4. Complete business verification

## Step 2: Set Up WhatsApp Business API

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create App → Select "Business" type
3. Add WhatsApp product
4. Get your:
   - **WABA ID** (WhatsApp Business Account ID)
   - **App Secret**
   - **Access Token** (create permanent via System User)

## Step 3: Buy 20 Phone Numbers from Twilio

1. Sign up at [twilio.com](https://www.twilio.com)
2. Buy 20 Argentina mobile numbers (~$1.50/month each)
3. Note the phone numbers and Twilio SID

## Step 4: Register Numbers to WhatsApp

For each Twilio number:
1. Meta Developer Portal → WhatsApp → Phone Numbers
2. Add Phone Number
3. Verify via SMS (code goes to Twilio)
4. Request display name approval

## Step 5: Configure Environment

```bash
# .env
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_WABA_ID=123456789
WHATSAPP_APP_SECRET=xxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_random_string

TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
```

## Step 6: Add Numbers to Inventory

Use Prisma Studio or API to add numbers:

```bash
pnpm prisma studio
```

Add to `WhatsAppNumber` table:
- phoneNumber: +5411XXXXXXXX
- status: AVAILABLE
- countryCode: AR
- bspProvider: META_DIRECT

---

# IMPLEMENTATION CHECKLIST

## Pre-Development
- [ ] Create Meta Business Account
- [ ] Apply for WhatsApp access
- [ ] Set up Twilio account
- [ ] Buy 20 Argentina numbers

## Development
- [ ] Run Prisma migration (Phase 1)
- [ ] Create waitlist service (Phase 2)
- [ ] Create API routes (Phase 3)
- [ ] Create UI components (Phase 4)
- [ ] Hook into subscription flow (Phase 5)
- [ ] Update landing page (Phase 6)

## Testing
- [ ] Test signup with spots available → gets number
- [ ] Test signup with spots full → joins waitlist
- [ ] Test cancellation → spot offered to next
- [ ] Test claim spot flow
- [ ] Test expired offer → goes to next

## Launch
- [ ] Register 20 numbers to WhatsApp
- [ ] Add numbers to inventory database
- [ ] Verify cron job is scheduled
- [ ] Test full flow end-to-end

---

# MARKETING COPY

## Landing Page - Transparent Version

```
💬 WHATSAPP CON IA - ACCESO ANTICIPADO

Queremos ser honestos: WhatsApp Business tiene 
límites iniciales que estamos trabajando para ampliar.

Por ahora, los primeros 20 clientes PROFESIONAL 
obtienen su propio número WhatsApp con IA.

✅ Tu propio número dedicado
✅ IA que responde 24/7
✅ Agenda turnos automáticamente
✅ Recordatorios sin esfuerzo

Los demás clientes obtienen todas las funciones 
de PROFESIONAL + envío manual por WhatsApp + 
prioridad en la lista de espera.

Sin promesas falsas. Solo servicio real.

[Ver cuántos cupos quedan →]
```

## Email: Joined Waitlist

```
Asunto: Estás en la lista de espera para WhatsApp IA (#{{position}})

Hola {{name}},

¡Gracias por suscribirte a CampoTech PROFESIONAL!

Los 20 cupos de Acceso Anticipado para WhatsApp con IA 
están ocupados. Estás en la posición #{{position}}.

Te avisaremos apenas se libere un lugar.

Mientras tanto, podés usar todas las funciones incluyendo 
el envío manual de mensajes por WhatsApp desde cada trabajo.

¡Gracias por tu paciencia!
```

## Email: Spot Available

```
Asunto: 🎉 ¡Tu turno llegó! Activá WhatsApp IA ahora

Hola {{name}},

¡Un cupo de WhatsApp con IA se liberó y es tu turno!

Tenés 48 horas para activar tu número WhatsApp Business.

[ACTIVAR MI NÚMERO →]

Si no lo activás antes del {{expirationDate}}, 
el cupo pasará a la siguiente persona.

¡No te lo pierdas!
```

---

# COST SUMMARY

## Fixed Costs (Monthly)
| Item | Cost |
|------|------|
| 20 Twilio numbers | $30/month |
| Total fixed | $30/month |

## Per-Customer Costs (with WhatsApp)
| Item | Cost |
|------|------|
| Twilio number share | $1.50 |
| WhatsApp conversations | ~$1.50 |
| OpenAI AI responses | ~$0.50 |
| **Total** | **~$3.50/customer** |

## Revenue (at 20 customers with WhatsApp)
| Item | Amount |
|------|--------|
| 20 × $35/mo | $700 |
| Costs | -$100 |
| **Gross margin** | **$600 (86%)** |

---

# FUTURE SCALING

When you get Tech Provider approval from Meta:

1. Increase `MAX_EARLY_ACCESS_SPOTS` constant
2. Buy more Twilio numbers
3. Register to WhatsApp
4. Announce to waitlist: "We expanded capacity!"

The waitlist will automatically fill the new spots.
