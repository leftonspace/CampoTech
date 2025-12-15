# CampoTech - Implementation Roadmap

*Powered by CampoTech*

---

## Overview

This roadmap outlines the complete implementation plan for CampoTech, organized in phases. Each phase builds upon the previous one.

---

## Implementation Status Overview

| Component | Status | Notes |
|-----------|--------|-------|
| **apps/web - Core** | ✅ 80% | Dashboard, Jobs, Customers, Invoices working |
| **apps/web - Auth** | ✅ Complete | Login, Signup, OTP, Registration flow |
| **apps/web - Landing** | ❌ Missing | Blocks production deployment |
| **apps/web - Rating** | ❌ Missing | High priority |
| **apps/mobile** | ⚠️ 70% | Technician features exist, needs cleanup |
| **apps/mobile - Consumer** | ⚠️ Remove | Should be in consumer-mobile |
| **apps/consumer-mobile** | ⚠️ 30% | Has screens, needs app structure |
| **apps/admin** | ❌ Not Started | Your internal dashboard |
| **apps/developer-portal** | ⚠️ Partial | Exists but incomplete |

---

## Phase Summary

| Phase | Name | Goal | Dependencies |
|-------|------|------|--------------|
| 1 | apps/web Corrections | Fix existing codebase | None |
| 2 | Business Dashboard Polish | Production-ready web app | Phase 1 |
| 3 | Technician Mobile App | Complete apps/mobile | Phase 2 |
| 4 | CampoTech Admin System | Your internal dashboard | Phase 2 |
| 5 | Consumer Marketplace | apps/consumer-mobile | Phase 3, 4 |
| 6 | Marketplace + Ratings Launch | Go live with marketplace | Phase 5 |
| 7 | Developer Portal | API documentation | Phase 6 |

---

## Phase 1: apps/web Corrections

**Goal**: Fix all issues in the existing web codebase

**Reference Document**: `docs/APPS-WEB-CORRECTIONS.md`

**Status**: ⚠️ In Progress - Some auth/core features complete, key items pending

### Tasks

#### 1.1 Create Landing Page ❌ NOT STARTED
- [ ] Create `apps/web/app/page.tsx`
- [ ] Hero section with CampoTech value proposition
- [ ] Features overview section
- [ ] Pricing table with 3 tiers ($25, $55, $120)
- [ ] Call-to-action buttons (Sign Up, Login)
- [ ] Footer with legal links
- [ ] Mobile responsive design

#### 1.2 Update Tier Pricing ❌ NOT STARTED
- [ ] Modify `apps/web/lib/config/tier-limits.ts`
- [ ] Change BASICO from $12 → $25
- [ ] Change PROFESIONAL from $18 → $55
- [ ] Change EMPRESARIAL from $25 → $120
- [ ] Rename "Básico" → "Inicial" in display
- [ ] Update tier limits per vision document

#### 1.3 Simplify Role System ❌ NOT STARTED
- [ ] Create database migration for role changes
- [ ] Update `apps/web/prisma/schema.prisma` (3 roles only)
- [ ] Update `apps/web/types/index.ts`
- [ ] Update `apps/web/lib/config/field-permissions.ts`
- [ ] Update all UI components showing role selections
- [ ] Test role-based access throughout app

#### 1.4 Create Rating System ❌ NOT STARTED
- [ ] Add Rating model to Prisma schema
- [ ] Run database migration
- [ ] Create `apps/web/app/rate/[token]/page.tsx`
- [ ] Create `apps/web/app/api/ratings/route.ts`
- [ ] Create token generation when job completes
- [ ] Add rating link to job completion WhatsApp message

#### 1.5 Update Tracking Page
- [ ] Modify `apps/web/app/track/[token]/page.tsx`
- [ ] Add documents section (Invoice PDF, Report PDF)
- [ ] Add inline rating form after completion
- [ ] Add "Save this WhatsApp" prompt
- [ ] Progress bar styling improvements

#### 1.6 Add PDF Watermark
- [ ] Locate PDF generation services
- [ ] Add "Powered by CampoTech" to invoice PDFs
- [ ] Add "Powered by CampoTech" to report PDFs
- [ ] Test watermark appearance

#### 1.7 Add Feature Toggles
- [ ] Add global feature flags to config
- [ ] `ratings_enabled` (default: false)
- [ ] `marketplace_listing` (default: false)
- [ ] `consumer_app_enabled` (default: false)
- [ ] Create admin API to toggle features

### Deliverables
- Landing page at `/` showing pricing
- Working rating system
- Simplified 3-role system
- Updated tracking page with documents
- PDF watermarks on all documents

---

## Phase 2: Business Dashboard Polish

**Goal**: Make apps/web production-ready for Argentina launch

**Dependencies**: Phase 1 complete

### Tasks

#### 2.1 Voice Reports Integration
- [ ] Create `apps/web/app/api/voice/transcribe/route.ts`
- [ ] Integrate OpenAI Whisper API
- [ ] Handle audio file uploads
- [ ] Return transcription with confidence score
- [ ] Handle noisy audio gracefully

#### 2.2 Market Position Analytics
- [ ] Create `apps/web/app/dashboard/analytics/market-position/page.tsx`
- [ ] Create `apps/web/app/api/analytics/market-position/route.ts`
- [ ] Calculate rating percentile
- [ ] Count competitors above
- [ ] Generate improvement tips
- [ ] Privacy: no competitor names exposed

#### 2.3 PDF Customization
- [ ] Create `apps/web/app/dashboard/settings/pdf-templates/page.tsx`
- [ ] Logo upload functionality
- [ ] Color picker for branding
- [ ] Custom footer text
- [ ] Template preview
- [ ] Save settings to organization

#### 2.4 WhatsApp AI Confidence System
- [ ] Review existing WhatsApp AI implementation
- [ ] Implement confidence scoring
- [ ] Auto-book on high confidence
- [ ] Escalate to owner on low confidence
- [ ] Log all decisions for training

#### 2.5 Job Completion Flow
- [ ] Implement payment confirmation flow
- [ ] Cash payment marking (with GPS + timestamp)
- [ ] MercadoPago payment confirmation
- [ ] Auto-generate documents after payment
- [ ] Auto-send WhatsApp with documents + rating link

#### 2.6 Argentina Legal Compliance
- [ ] Research document requirements per business type
- [ ] Implement business type selection in settings
- [ ] Configure required documents per type
- [ ] Ensure AFIP compliance
- [ ] Add disclaimers where needed

#### 2.7 Testing & QA
- [ ] Test all user flows
- [ ] Test role permissions
- [ ] Test tier limits
- [ ] Test WhatsApp integration
- [ ] Test PDF generation
- [ ] Test on mobile browsers
- [ ] Fix any TypeScript errors
- [ ] Run full build successfully

#### 2.8 Deployment
- [ ] Configure Vercel for apps/web
- [ ] Set environment variables
- [ ] Deploy to production
- [ ] Verify all features work
- [ ] Set up error monitoring (Sentry or similar)

### Deliverables
- Production-ready business dashboard
- Voice transcription working
- Market position analytics
- PDF customization
- Complete job flow with payment + documents
- Deployed on Vercel

---

## Phase 3: Technician Mobile App

**Goal**: Complete and deploy apps/mobile for technicians

**Dependencies**: Phase 2 complete

**Status**: ⚠️ Partial - Core exists, needs cleanup and consumer removal

### Tasks

#### 3.1 Review Existing Code ✅ ANALYZED
- [x] Audit `apps/mobile` codebase - WatermelonDB implemented, offline sync exists
- [ ] List missing features
- [ ] Identify bugs/issues
- [ ] Check API integrations

#### 3.2 Remove Consumer Features ❌ NOT STARTED (HIGH PRIORITY)
- [ ] Remove `apps/mobile/app/(consumer)/` folder entirely
- [ ] Remove `apps/mobile/lib/consumer/` if exists
- [ ] Keep only technician features in `(tabs)`
- [ ] Update navigation
- [ ] Clean up unused code
- [ ] Test technician-only app flow

#### 3.3 Core Features
- [ ] Today's jobs view
- [ ] Job details page
- [ ] Status updates (pending → en route → arrived → working → complete)
- [ ] Customer info and navigation
- [ ] Contact customer (call, WhatsApp)

#### 3.4 Voice Reports
- [ ] Implement voice recording
- [ ] Send to transcription API
- [ ] Auto-fill report form
- [ ] Edit transcription if needed
- [ ] Submit report

#### 3.5 Inventory Management
- [ ] View vehicle stock
- [ ] Log material usage on job
- [ ] Request replenishment
- [ ] Scan barcode (if implemented)

#### 3.6 Photos & Signature
- [ ] Take photos during job
- [ ] Capture customer signature
- [ ] Upload to server
- [ ] Attach to job record

#### 3.7 Offline Support
- [ ] Cache today's jobs locally
- [ ] Queue updates when offline
- [ ] Sync when connection restored
- [ ] Show offline indicator

#### 3.8 Old Phone Compatibility
- [ ] Test on Android 6+
- [ ] Test on iPhone 6+
- [ ] Optimize performance
- [ ] Reduce bundle size
- [ ] Handle low memory gracefully

#### 3.9 Build & Deploy
- [ ] Configure EAS Build
- [ ] Build for Android
- [ ] Build for iOS
- [ ] Internal testing (TestFlight, internal track)
- [ ] Fix issues found in testing
- [ ] Prepare for app store submission

### Deliverables
- Complete technician mobile app
- Works on old phones
- Offline support
- Voice reports
- Inventory management
- Ready for app store submission

---

## Phase 4: CampoTech Admin System

**Goal**: Create your internal dashboard to manage CampoTech

**Dependencies**: Phase 2 complete

### Tasks

#### 4.1 Create apps/admin Structure
- [ ] Initialize Next.js app in `apps/admin`
- [ ] Set up Tailwind CSS
- [ ] Set up authentication (separate from business auth)
- [ ] Create basic layout

#### 4.2 Dashboard
- [ ] Total businesses subscribed
- [ ] Monthly recurring revenue (MRR)
- [ ] New signups this week/month
- [ ] Churn rate
- [ ] Active users count
- [ ] Quick stats cards

#### 4.3 Businesses Management
- [ ] List all businesses
- [ ] Search/filter businesses
- [ ] View business details
- [ ] View their customers
- [ ] View their jobs
- [ ] View their technicians
- [ ] Subscription status
- [ ] Add notes (for sales/support)

#### 4.4 Payments & Billing
- [ ] All subscription payments
- [ ] Failed payments list
- [ ] Past due accounts
- [ ] Revenue by tier chart
- [ ] Export for accountant (CSV)

#### 4.5 WhatsApp AI Training
- [ ] View all conversations (across businesses)
- [ ] Filter by AI handled vs escalated
- [ ] View confidence scores
- [ ] Mark conversations as good/bad examples
- [ ] Export training data

#### 4.6 AI Chat Assistant
- [ ] Natural language query interface
- [ ] Query your database
- [ ] "How many businesses signed up this month?"
- [ ] "Which businesses have past due payments?"
- [ ] "Show most active plumbers in Buenos Aires"

#### 4.7 Activity Map
- [ ] Live view of all technicians (all businesses)
- [ ] Jobs in progress markers
- [ ] Geographic coverage heatmap
- [ ] Filter by business type

#### 4.8 Analytics
- [ ] Growth metrics over time
- [ ] Feature adoption rates
- [ ] AI usage and costs
- [ ] Geographic distribution
- [ ] Business type distribution

#### 4.9 Legal & Documents
- [ ] Upload business contracts
- [ ] Store compliance documents
- [ ] Export for lawyer/accountant

#### 4.10 Deployment
- [ ] Deploy to separate Vercel project
- [ ] Secure with strong auth
- [ ] Restrict access (your accounts only)

### Deliverables
- Complete admin dashboard
- Business management
- Payment tracking
- AI training interface
- Activity map
- Analytics
- Deployed and secured

---

## Phase 5: Consumer Marketplace App

**Goal**: Complete apps/consumer-mobile for marketplace

**Dependencies**: Phase 3 complete, Phase 4 complete

**Status**: ⚠️ 30% - Has screens in src/screens, needs proper app structure

### Tasks

#### 5.1 Fix Package Configuration ❌ NOT STARTED
- [ ] Update `apps/consumer-mobile/package.json`
- [ ] Add all required dependencies
- [ ] Add scripts (dev, build, etc.)
- [ ] Configure Expo/React Native
- [ ] Create `apps/consumer-mobile/app/` folder with Expo Router
- [ ] Move screens from `src/screens/` to `app/` routes

#### 5.2 Review Existing Screens ✅ ANALYZED
- [ ] HomeScreen - categories, featured businesses
- [ ] SearchScreen - search/filter
- [ ] BusinessProfileScreen - business details
- [ ] CreateRequestScreen - post service request
- [ ] MyRequestsScreen - track requests
- [ ] JobTrackingScreen - track active job
- [ ] ChatScreen - messaging
- [ ] ReviewSubmissionScreen - rate experience
- [ ] ProfileScreen - user profile

#### 5.3 Home Screen
- [ ] Category grid (Plumber, Electrician, etc.)
- [ ] Voice/text search option
- [ ] Featured businesses section
- [ ] Location detection/selection

#### 5.4 Search & Discovery
- [ ] Category selection
- [ ] Filter options (distance, rating, availability)
- [ ] AI-powered recommendations
- [ ] Business cards with key info
- [ ] Sort options

#### 5.5 Business Profile
- [ ] Business info (name, description, contact)
- [ ] Rating and reviews
- [ ] Services offered
- [ ] Photos gallery
- [ ] Availability status
- [ ] "Contact on WhatsApp" button

#### 5.6 WhatsApp Integration
- [ ] Generate WhatsApp deep link
- [ ] Open WhatsApp with business number
- [ ] Pre-filled message (optional)

#### 5.7 Job Tracking
- [ ] Receive tracking link from business
- [ ] Show progress bar
- [ ] ETA display
- [ ] Contact technician option

#### 5.8 Rating Submission
- [ ] Receive rating link from business
- [ ] Simple star rating
- [ ] Optional comment
- [ ] Submit and thank you

#### 5.9 API Integration
- [ ] Connect to shared database
- [ ] Fetch businesses by location/category
- [ ] Fetch ratings
- [ ] No write access to business data

#### 5.10 Old Phone Compatibility
- [ ] Test on Android 6+
- [ ] Test on iPhone 6+
- [ ] Optimize performance
- [ ] Reduce bundle size

#### 5.11 Build & Internal Testing
- [ ] Configure EAS Build
- [ ] Build for Android
- [ ] Build for iOS
- [ ] Internal testing

### Deliverables
- Complete consumer marketplace app
- Category browsing
- AI recommendations
- WhatsApp connection
- Job tracking
- Rating submission
- Works on old phones

---

## Phase 6: Marketplace + Ratings Launch

**Goal**: Launch consumer marketplace alongside ratings system

**Dependencies**: Phase 5 complete

### Tasks

#### 6.1 Enable Feature Toggles
- [ ] Enable `ratings_enabled` globally
- [ ] Enable `marketplace_listing` for businesses
- [ ] Enable `consumer_app_enabled`

#### 6.2 Prepare Businesses
- [ ] Notify existing businesses about ratings launch
- [ ] Notify about marketplace launch
- [ ] Provide onboarding materials
- [ ] Answer questions

#### 6.3 App Store Submission
- [ ] Prepare app store listings (title, description, screenshots)
- [ ] Submit consumer app to Google Play
- [ ] Submit consumer app to Apple App Store
- [ ] Submit technician app to Google Play
- [ ] Submit technician app to Apple App Store
- [ ] Respond to any rejections

#### 6.4 Monitor Launch
- [ ] Monitor error rates
- [ ] Monitor AI performance
- [ ] Monitor ratings submissions
- [ ] Monitor marketplace usage

#### 6.5 AI Recommendations Without Ratings (Initial)
- [ ] AI recommends based on: location, availability, services
- [ ] Ratings data accumulates over time

#### 6.6 Enable AI Rating-Based Recommendations
- [ ] After sufficient rating data (1-3 months)
- [ ] Enable rating factor in AI recommendations
- [ ] Businesses with good ratings rise to top

### Deliverables
- Ratings system live
- Consumer app in app stores
- Technician app in app stores
- AI recommendations working
- Monitoring in place

---

## Phase 7: Developer Portal

**Goal**: Complete API documentation for third-party developers

**Dependencies**: Phase 6 complete (lowest priority)

### Tasks

#### 7.1 Review Existing Code
- [ ] Audit `apps/developer-portal` codebase
- [ ] List missing features
- [ ] Check API reference accuracy

#### 7.2 Documentation
- [ ] Getting started guide
- [ ] Authentication documentation
- [ ] API reference (all endpoints)
- [ ] Code examples (TypeScript, Python)
- [ ] Webhooks documentation
- [ ] Rate limits documentation

#### 7.3 Interactive Features
- [ ] API Playground (test endpoints)
- [ ] API key management console
- [ ] Usage dashboard

#### 7.4 SDK Development (Optional)
- [ ] TypeScript SDK
- [ ] Python SDK
- [ ] NPM/PyPI publishing

#### 7.5 Deployment
- [ ] Deploy to developers.campotech.com
- [ ] Set up SSL
- [ ] Set up analytics

### Deliverables
- Complete developer documentation
- Interactive API playground
- API key management
- Deployed at developers subdomain

---

## Ongoing Tasks (All Phases)

### Maintenance
- [ ] Monitor error rates
- [ ] Fix bugs as reported
- [ ] Update dependencies
- [ ] Security patches

### AI Training
- [ ] Weekly review of AI conversations
- [ ] Mark good/bad examples
- [ ] Monthly model fine-tuning
- [ ] Track improvement metrics

### Customer Support
- [ ] Respond to business inquiries
- [ ] Handle payment issues
- [ ] Provide onboarding support

### Growth
- [ ] Track acquisition metrics
- [ ] A/B test landing page
- [ ] Optimize conversion funnel
- [ ] Gather customer feedback

---

## Timeline Estimates

**Note**: These are rough estimates. Actual time depends on development resources.

| Phase | Estimated Duration |
|-------|-------------------|
| Phase 1 | 1-2 weeks |
| Phase 2 | 2-3 weeks |
| Phase 3 | 2-3 weeks |
| Phase 4 | 2-3 weeks |
| Phase 5 | 2-3 weeks |
| Phase 6 | 1-2 weeks |
| Phase 7 | 1-2 weeks |

**Total**: 11-18 weeks (with one developer)

---

## Success Metrics

### Phase 1-2 Success
- [ ] Web app deploys without errors
- [ ] All features work as documented
- [ ] TypeScript builds cleanly

### Phase 3 Success
- [ ] Technician app works on Android 6+
- [ ] Offline mode works
- [ ] Voice reports work

### Phase 4 Success
- [ ] Admin dashboard shows real data
- [ ] AI chat answers questions correctly
- [ ] All businesses visible

### Phase 5 Success
- [ ] Consumer app finds businesses by location
- [ ] WhatsApp links work
- [ ] App works on old phones

### Phase 6 Success
- [ ] Apps approved in app stores
- [ ] First ratings submitted
- [ ] First marketplace leads generated

### Phase 7 Success
- [ ] Documentation complete
- [ ] Third-party can integrate successfully

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| App store rejection | Follow guidelines carefully, prepare for iteration |
| WhatsApp API changes | Monitor Meta announcements, have fallback |
| AI costs too high | Set limits per tier, optimize prompts |
| Old phone crashes | Extensive testing, performance monitoring |
| AFIP changes | Monitor regulatory updates |
| Low initial adoption | Focus on value proposition, early adopter discounts |

---

## Document Version

- **Version**: 1.0
- **Last Updated**: December 2024
- **Author**: CampoTech Team

*Powered by CampoTech*
