# AI Agent Task: Complete Phase 15 - Consumer Marketplace

## Context

You are working on **CampoTech**, a field service management platform for Argentine tradespeople. The project is ~92% complete with Phase 15 (Consumer Marketplace) being the final phase requiring implementation.

**Phase 15 Goal:** Create a two-sided marketplace where:
- **Consumers (FREE)** can find service providers, request quotes, track technicians, and leave reviews
- **Businesses (PAID subscribers)** receive qualified leads from consumer requests

**Key Differentiator:** FREE for consumers (competitors charge 10-15% fee)

---

## Repository Structure

```
/home/user/CampoTech/
├── apps/
│   ├── mobile/           # React Native + Expo technician app (EXTEND THIS)
│   ├── web/              # Next.js admin dashboard
│   └── customer-portal/  # Next.js customer self-service portal
├── src/
│   ├── modules/
│   │   └── consumer/     # Consumer marketplace backend (ALREADY COMPLETE)
│   ├── integrations/     # WhatsApp, AFIP, MercadoPago, Voice AI
│   └── api/public/       # Third-party API
├── database/migrations/  # All migrations exist (050-054 for consumer)
├── packages/sdk/         # TypeScript & Python SDKs
└── docs/                 # Architecture documentation
```

---

## What's Already Implemented (DO NOT RECREATE)

### Backend Services (`src/modules/consumer/`)
All backend services are complete:
- `profiles/` - Consumer profile CRUD, repository, routes
- `auth/` - Consumer authentication, middleware
- `discovery/` - Business discovery, ranking, geo-search, badges
- `quotes/` - Quote service, repository, routes
- `requests/` - Service request handling
- `reviews/` - Review service and repository
- `leads/` - Business leads dashboard service
- `mode-switch/` - Dual profile mode switching
- `marketing/` - Referrals, SEO pages
- `analytics/` - Marketplace analytics
- `notifications/` - Push, WhatsApp notifications
- `trust/` - Verification service

### Database Migrations
All exist in `database/migrations/`:
- `050_create_consumer_profiles.sql`
- `051_create_service_requests.sql`
- `052_create_consumer_reviews.sql`
- `053_create_mode_switch_leads.sql`
- `054_create_referral_system.sql`

---

## TASK 1: Consumer Mobile App (~80 hours)

### Location: `apps/mobile/app/(consumer)/`

Create a consumer-facing section of the existing mobile app. Follow existing patterns in `apps/mobile/`.

### 1.1 Route Structure
Create the following files:

```
apps/mobile/app/(consumer)/
├── _layout.tsx                    # Consumer tab navigation
├── index.tsx                      # Home - Category search
├── search/
│   ├── index.tsx                  # Search results
│   ├── [category].tsx             # Category-specific results
│   └── filters.tsx                # Filter modal
├── business/
│   └── [id].tsx                   # Business profile view
├── request/
│   ├── new.tsx                    # Create service request
│   ├── [id]/
│   │   ├── index.tsx              # Request detail
│   │   └── quotes.tsx             # Compare quotes
├── jobs/
│   ├── index.tsx                  # My jobs list
│   └── [id].tsx                   # Job detail + tracking
├── reviews/
│   └── new/[jobId].tsx            # Submit review
└── profile/
    └── index.tsx                  # Consumer profile
```

### 1.2 Consumer Home Screen (`index.tsx`)

**Design Requirements:**
```
┌─────────────────────────────────────────┐
│ 📍 Palermo, Buenos Aires        [👤]    │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔍 ¿Qué necesitás?              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Categorías populares                   │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 🔧 │ │ ⚡ │ │ ❄️ │ │ 🔨 │      │
│  │Plom.│ │Elec.│ │Aire │ │Const│      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                         │
│  ⭐ Mejor valorados cerca tuyo          │
│  [BusinessCard components...]           │
│                                         │
│  📋 Mis solicitudes (2)                 │
│  [ServiceRequestCard components...]     │
│                                         │
├─────────────────────────────────────────┤
│ 🏠   🔍   ➕   📋   👤                 │
│ Home Search New  Jobs Profile           │
└─────────────────────────────────────────┘
```

**Implementation:**
```typescript
// apps/mobile/app/(consumer)/index.tsx
import { View, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { CategoryGrid } from '@/components/consumer/CategoryGrid';
import { BusinessCard } from '@/components/consumer/BusinessCard';
import { ServiceRequestCard } from '@/components/consumer/ServiceRequestCard';
import { useConsumerLocation } from '@/lib/consumer/hooks/use-location';
import { useTopBusinesses } from '@/lib/consumer/hooks/use-discovery';
import { useMyRequests } from '@/lib/consumer/hooks/use-requests';

export default function ConsumerHome() {
  const router = useRouter();
  const { location, neighborhood } = useConsumerLocation();
  const { businesses, isLoading } = useTopBusinesses(location);
  const { requests } = useMyRequests();

  // ... implementation
}
```

### 1.3 Components to Create

Create in `apps/mobile/components/consumer/`:

```typescript
// CategoryGrid.tsx - 2x4 grid of service categories
const CATEGORIES = [
  { id: 'plumbing', name: 'Plomería', icon: '🔧' },
  { id: 'electrical', name: 'Electricidad', icon: '⚡' },
  { id: 'hvac', name: 'Aire Acond.', icon: '❄️' },
  { id: 'construction', name: 'Construcción', icon: '🔨' },
  { id: 'locksmith', name: 'Cerrajería', icon: '🔒' },
  { id: 'painting', name: 'Pintura', icon: '🎨' },
  { id: 'gas', name: 'Gas', icon: '🔥' },
  { id: 'more', name: 'Más', icon: '➕' },
];

// BusinessCard.tsx - Business preview card
interface BusinessCardProps {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  category: string;
  distance: number;
  responseTime: string;
  badges: string[];
}

// RatingStars.tsx - Star rating display (1-5)
// ReviewCard.tsx - Individual review display
// QuoteCard.tsx - Quote comparison card
// RequestForm.tsx - Service request creation form
// ServiceRequestCard.tsx - My requests list item
```

### 1.4 API Hooks

Create in `apps/mobile/lib/consumer/hooks/`:

```typescript
// use-discovery.ts
export function useTopBusinesses(location: LatLng) {
  // Call GET /api/consumer/discovery/top?lat=X&lng=Y
}

export function useSearchBusinesses(query: string, filters: SearchFilters) {
  // Call GET /api/consumer/discovery/search
}

// use-requests.ts
export function useMyRequests() {
  // Call GET /api/consumer/requests
}

export function useCreateRequest() {
  // Call POST /api/consumer/requests
}

// use-quotes.ts
export function useRequestQuotes(requestId: string) {
  // Call GET /api/consumer/requests/:id/quotes
}

export function useAcceptQuote() {
  // Call POST /api/consumer/quotes/:id/accept
}
```

### 1.5 Mode Switching

Add mode switcher to app root. Reference existing patterns:
- Check `apps/mobile/app/_layout.tsx`
- Add profile type detection
- Create mode toggle in header/settings

```typescript
// apps/mobile/lib/consumer/mode-switch.ts
type AppMode = 'business' | 'consumer';

interface UserProfiles {
  businessProfile?: { organizationId: string; role: string };
  consumerProfile?: { consumerId: string };
}

export function useAppMode() {
  // Detect available profiles
  // Allow switching between modes
  // Persist selection
}
```

### 1.6 Business Profile View

```typescript
// apps/mobile/app/(consumer)/business/[id].tsx
// Display:
// - Business name, logo, cover photo
// - Rating breakdown (overall, punctuality, quality, price, communication)
// - Service list with prices
// - Recent reviews (paginated)
// - Trust badges
// - Contact buttons (only after quote accepted)
// - "Solicitar presupuesto" CTA button
```

### 1.7 Service Request Flow

Multi-step form in `apps/mobile/app/(consumer)/request/new.tsx`:

```
Step 1: Select category → service type
Step 2: Describe problem (text + optional photos + optional voice note)
Step 3: Enter address (with map picker)
Step 4: Select urgency + preferred time
Step 5: Review & submit
```

### 1.8 Quote Comparison

```typescript
// apps/mobile/app/(consumer)/request/[id]/quotes.tsx
// Display all received quotes sorted by:
// - Price (low to high)
// - Rating (high to low)
// - Response time

// Each quote shows:
// - Business name + rating
// - Quote amount
// - Estimated timeline
// - Message from business
// - "Ver perfil" and "Aceptar" buttons
```

---

## TASK 2: Review Fraud Detection (~20 hours)

### Location: `src/modules/consumer/reviews/`

### 2.1 Fraud Detection Service

Create `src/modules/consumer/reviews/fraud-detection.service.ts`:

```typescript
interface FraudSignal {
  type: 'velocity' | 'similarity' | 'device' | 'behavior' | 'rating_pattern';
  score: number; // 0-1, higher = more suspicious
  reason: string;
}

interface FraudAnalysis {
  overallScore: number; // 0-1
  signals: FraudSignal[];
  recommendation: 'approve' | 'flag' | 'reject';
}

export class FraudDetectionService {
  async analyzeReview(review: ReviewInput): Promise<FraudAnalysis> {
    const signals: FraudSignal[] = [];

    // 1. Velocity check - too many reviews from same user/device
    signals.push(await this.checkVelocity(review));

    // 2. Text similarity - copied or template reviews
    signals.push(await this.checkTextSimilarity(review));

    // 3. Device fingerprinting - multiple accounts same device
    signals.push(await this.checkDevicePattern(review));

    // 4. Behavioral patterns - review without actual service
    signals.push(await this.checkBehaviorPattern(review));

    // 5. Rating patterns - sudden spikes, all 5-star or 1-star
    signals.push(await this.checkRatingPattern(review));

    return this.calculateOverallScore(signals);
  }

  private async checkVelocity(review: ReviewInput): Promise<FraudSignal> {
    // Check reviews per hour/day from same consumer
    // Check reviews per hour/day for same business
  }

  private async checkTextSimilarity(review: ReviewInput): Promise<FraudSignal> {
    // Use fuzzy matching against recent reviews
    // Detect template-like patterns
  }

  private async checkRatingPattern(review: ReviewInput): Promise<FraudSignal> {
    // Analyze rating distribution for business
    // Detect sudden rating spikes
    // Flag if all recent reviews are 5-star
  }
}
```

### 2.2 Moderation Queue

Create database table (or add to existing):
```sql
CREATE TABLE review_moderation_queue (
  id UUID PRIMARY KEY,
  review_id UUID REFERENCES consumer_reviews(id),
  fraud_score DECIMAL(3,2),
  signals JSONB,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  moderator_id UUID REFERENCES users(id),
  moderated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 Moderation API Routes

Add to `src/modules/consumer/reviews/`:
```typescript
// moderation.routes.ts
router.get('/moderation/queue', requireAdmin, getModerationQueue);
router.post('/moderation/:id/approve', requireAdmin, approveReview);
router.post('/moderation/:id/reject', requireAdmin, rejectReview);
```

### 2.4 Admin Moderation UI

Create in `apps/web/app/dashboard/marketplace/moderation/page.tsx`:

```typescript
// Display queue of flagged reviews
// Show fraud signals with explanations
// Allow approve/reject with notes
// Bulk actions for efficiency
```

---

## TASK 3: Business Leads Dashboard UI (~20 hours)

### Location: `apps/web/app/dashboard/leads/`

### 3.1 Route Structure

```
apps/web/app/dashboard/leads/
├── page.tsx              # Lead inbox
├── [id]/page.tsx         # Lead detail
├── settings/page.tsx     # Lead preferences
└── analytics/page.tsx    # Lead performance
```

### 3.2 Lead Inbox Page

```typescript
// apps/web/app/dashboard/leads/page.tsx
export default function LeadsPage() {
  // Tabs: New (🔴), Quoted (⏳), Won (✅), Lost (❌)
  // Filters: Category, Distance, Budget, Date range
  // List of LeadCard components
}
```

**Lead Card Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ Instalación split 3000 frigorías                    🔴 Nueva │
│ 📍 Palermo, 2.1km • ⏱️ Esta semana • 💰 $15k-$50k          │
│                                                             │
│ "Necesito instalar un split en mi departamento de 2        │
│ ambientes. Ya tengo el equipo comprado..."                  │
│ 📷 3 fotos adjuntas                                         │
│                                                             │
│ [Ver detalle]  [Enviar presupuesto]  [No me interesa]      │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Quote Submission Form

```typescript
// apps/web/components/leads/QuoteForm.tsx
interface QuoteFormData {
  amount: number;
  description: string;
  estimatedDuration: string; // "2-3 horas", "1 día", etc.
  validUntil: Date;
  includesLabor: boolean;
  includesMaterials: boolean;
  notes?: string;
}
```

### 3.4 Lead Analytics

```typescript
// apps/web/app/dashboard/leads/analytics/page.tsx
// Metrics to display:
// - Total leads received (this month, trend)
// - Response rate (% responded within 2h)
// - Win rate (% of quotes accepted)
// - Average quote amount
// - Time to first response
// - Top performing categories
// - Geographic heatmap of leads
```

### 3.5 Lead Preferences

```typescript
// apps/web/app/dashboard/leads/settings/page.tsx
// Allow business to configure:
// - Service categories to receive
// - Maximum distance willing to travel
// - Budget range preferences
// - Availability schedule
// - Notification preferences (push, WhatsApp, email)
// - Auto-decline rules
```

---

## TASK 4: Testing & Polish (~30 hours)

### 4.1 Test Coverage

Add tests in `apps/mobile/__tests__/consumer/`:
```typescript
// CategoryGrid.test.tsx
// BusinessCard.test.tsx
// QuoteComparison.test.tsx
// RequestForm.test.tsx
```

Add tests in `src/modules/consumer/__tests__/`:
```typescript
// fraud-detection.service.test.ts
// ranking.service.test.ts
```

### 4.2 Performance Optimization

- Implement search result caching (Redis, 5min TTL)
- Add pagination to business search (cursor-based)
- Optimize geo-queries with PostGIS indexes
- Use React Query for client-side caching

### 4.3 A/B Testing Setup (Optional)

```typescript
// src/modules/consumer/experiments/
// - experiment.service.ts
// - variants.ts
// - analytics-integration.ts
```

---

## Reference Files

Study these existing implementations for patterns:

### Mobile App Patterns
- `apps/mobile/app/(tabs)/` - Tab navigation structure
- `apps/mobile/app/(tabs)/jobs/[id].tsx` - Detail page pattern
- `apps/mobile/components/job/JobCard.tsx` - Card component pattern
- `apps/mobile/lib/sync/sync-engine.ts` - Data fetching pattern

### Backend Service Patterns
- `src/modules/customer-portal/` - Similar consumer-facing service
- `src/modules/consumer/discovery/ranking.service.ts` - Ranking algorithm
- `src/modules/consumer/quotes/quote.service.ts` - Quote logic

### Web Dashboard Patterns
- `apps/web/app/dashboard/analytics/` - Dashboard page pattern
- `apps/web/components/analytics/` - Chart and widget patterns

---

## API Endpoints (Already Exist)

Backend routes are already implemented. Use these:

```
# Consumer Auth
POST /api/consumer/auth/login
POST /api/consumer/auth/verify

# Consumer Profile
GET  /api/consumer/profiles/me
PUT  /api/consumer/profiles/me

# Discovery
GET  /api/consumer/discovery/search
GET  /api/consumer/discovery/top
GET  /api/consumer/discovery/business/:id

# Service Requests
GET  /api/consumer/requests
POST /api/consumer/requests
GET  /api/consumer/requests/:id
GET  /api/consumer/requests/:id/quotes

# Quotes
POST /api/consumer/quotes/:id/accept
POST /api/consumer/quotes/:id/decline

# Reviews
POST /api/consumer/reviews
GET  /api/consumer/reviews/business/:id

# Business Leads (for dashboard)
GET  /api/consumer/leads
GET  /api/consumer/leads/:id
POST /api/consumer/leads/:id/quote
```

---

## Deliverables Checklist

### Task 1: Consumer Mobile App
- [ ] `apps/mobile/app/(consumer)/_layout.tsx` - Consumer tab navigation
- [ ] `apps/mobile/app/(consumer)/index.tsx` - Home with categories
- [ ] `apps/mobile/app/(consumer)/search/` - Search & filters
- [ ] `apps/mobile/app/(consumer)/business/[id].tsx` - Business profile
- [ ] `apps/mobile/app/(consumer)/request/new.tsx` - Create request
- [ ] `apps/mobile/app/(consumer)/request/[id]/quotes.tsx` - Compare quotes
- [ ] `apps/mobile/components/consumer/` - All components
- [ ] `apps/mobile/lib/consumer/hooks/` - API hooks
- [ ] Mode switching in app header

### Task 2: Fraud Detection
- [ ] `src/modules/consumer/reviews/fraud-detection.service.ts`
- [ ] `src/modules/consumer/reviews/moderation.routes.ts`
- [ ] `apps/web/app/dashboard/marketplace/moderation/page.tsx`
- [ ] Database migration for moderation queue

### Task 3: Leads Dashboard
- [ ] `apps/web/app/dashboard/leads/page.tsx` - Lead inbox
- [ ] `apps/web/app/dashboard/leads/[id]/page.tsx` - Lead detail
- [ ] `apps/web/app/dashboard/leads/settings/page.tsx` - Preferences
- [ ] `apps/web/app/dashboard/leads/analytics/page.tsx` - Analytics
- [ ] `apps/web/components/leads/` - LeadCard, QuoteForm, etc.

### Task 4: Testing
- [ ] Mobile component tests
- [ ] Fraud detection unit tests
- [ ] Integration tests for lead flow

---

## Git Instructions

1. Create feature branches from main:
   ```bash
   git checkout -b feature/consumer-mobile-app
   git checkout -b feature/fraud-detection
   git checkout -b feature/leads-dashboard
   ```

2. Commit frequently with descriptive messages:
   ```bash
   git commit -m "feat(consumer): Add category grid component"
   git commit -m "feat(fraud): Implement velocity check algorithm"
   ```

3. Push and create PRs for review

---

## Success Criteria

1. **Consumer can:**
   - Browse service categories
   - Search and filter businesses
   - View business profiles with ratings
   - Create service requests with photos
   - Compare and accept quotes
   - Track accepted jobs
   - Leave reviews

2. **Business can:**
   - View incoming leads in dashboard
   - Submit quotes with pricing
   - Track quote status (pending/won/lost)
   - See lead analytics
   - Configure lead preferences

3. **System can:**
   - Detect suspicious reviews
   - Queue flagged reviews for moderation
   - Allow admins to approve/reject

---

## Estimated Timeline

| Task | Hours | Priority |
|------|-------|----------|
| Consumer Mobile App | 80 | P0 |
| Fraud Detection | 20 | P1 |
| Leads Dashboard | 20 | P1 |
| Testing & Polish | 30 | P2 |
| **Total** | **150** | |

Start with Consumer Mobile App as it's the core user-facing feature.

---

## Questions?

If you need clarification on:
- Existing API response formats
- Component styling patterns
- Database schema details
- Business logic requirements

Reference the existing code or ask for clarification before implementing.
