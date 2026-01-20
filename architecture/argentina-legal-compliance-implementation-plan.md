# Argentina Legal Compliance Implementation Plan

> **Document Version**: 1.0  
> **Created**: January 16, 2026  
> **Status**: Planning  
> **Based On**: Comprehensive codebase audit and knowledge base review

---

## Executive Summary

This document outlines the phased implementation plan to achieve full legal compliance for CampoTech operations in Argentina. The plan is organized into 5 main phases covering all regulatory areas identified in the codebase audit.

### Current Compliance Status

| Area | Status | Risk Level |
|------|--------|------------|
| AFIP / Fiscal | ✅ 85% Complete | 🟢 LOW |
| Consumer Protection (Ley 24.240) | ✅ 90% Complete | 🟢 LOW |
| Data Protection (Ley 25.326) | 🟡 70% Complete | 🟡 MEDIUM |
| Labor Law | ⚠️ 40% Complete | 🔴 CRITICAL |
| AI Transparency | 🟡 60% Complete | 🟡 MEDIUM |
| Professional Regulations | ✅ 85% Complete | 🟢 LOW |
| Digital Evidence | ✅ 80% Complete | 🟢 LOW |

---

## Phase 1: Critical Compliance (Labor Law & Missing Consents)

**Priority**: 🔴 CRITICAL  
**Timeline**: Week 1-2  
**Risk Mitigation**: Prevents labor lawsuits and DNPDP penalties

### 1.1 Independent Contractor Disclaimer

**Objective**: Prevent "Uberization" labor claims by establishing clear contractor status.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 1.1.1 | Create `ContractorAgreementScreen` component | `apps/mobile/app/(onboarding)/contractor-agreement.tsx` | ⬜ TODO |
| 1.1.2 | Add `contractorDisclaimerAcceptedAt` field to TeamMember schema | `apps/web/prisma/schema.prisma` | ⬜ TODO |
| 1.1.3 | Create API endpoint to record disclaimer acceptance | `apps/mobile/app/api/contractor-agreement/route.ts` | ⬜ TODO |
| 1.1.4 | Add first-login gate in mobile app navigation | `apps/mobile/app/_layout.tsx` | ⬜ TODO |
| 1.1.5 | Store acceptance with IP address and timestamp | Database migration | ⬜ TODO |

**Disclaimer Text (Required)**:
```
"Reconozco que presto servicios como contratista independiente/monotributista. 
El uso de esta plataforma no establece una relación de dependencia laboral con 
[Nombre Org]. Mantengo autonomía técnica, utilizo mis propias herramientas y 
tengo libertad para aceptar o rechazar servicios sin penalización alguna."
```

#### Acceptance Criteria
- [ ] Technician cannot proceed past onboarding without accepting
- [ ] Acceptance stored with timestamp, IP, and device info
- [ ] Re-acceptance required if disclaimer text changes
- [ ] Audit log created for legal evidence

---

### 1.2 Rejection Penalty Audit

**Objective**: Ensure no code penalizes technicians for rejecting jobs.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 1.2.1 | Grep audit for `rejection`, `penalty`, `score_deduction` | All `/apps/mobile`, `/apps/web` | ⬜ TODO |
| 1.2.2 | Remove any visibility penalties for job rejection | TBD based on audit | ⬜ TODO |
| 1.2.3 | Document in `/docs/compliance/LABOR-COMPLIANCE.md` | New file | ⬜ TODO |
| 1.2.4 | Add code review checklist item for rejection penalties | `.github/PULL_REQUEST_TEMPLATE.md` | ⬜ TODO |

---

### 1.3 International Data Transfer Consent

**Objective**: Comply with Ley 25.326 for data stored outside Argentina (Supabase US, OpenAI).

**Current Status**: ❌ NOT IMPLEMENTED

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 1.3.1 | Add consent checkbox to Organization registration | `apps/web/app/(public)/register/page.tsx` | ⬜ TODO |
| 1.3.2 | Add consent checkbox to Technician onboarding | `apps/mobile/app/(onboarding)/` | ⬜ TODO |
| 1.3.3 | Add `dataTransferConsentAt` field to User schema | `apps/web/prisma/schema.prisma` | ⬜ TODO |
| 1.3.4 | Store consent record with IP address | Database migration | ⬜ TODO |
| 1.3.5 | Block account creation without consent | API validation | ⬜ TODO |

**Consent Text (Required)**:
```
"Entiendo y acepto que mis datos personales, incluyendo documentos de identidad 
y biometría, serán alojados en servidores ubicados fuera de la República Argentina 
(EE.UU./Canadá) bajo estrictos estándares de seguridad y cifrado. Otorgo mi 
consentimiento expreso para esta transferencia internacional de datos conforme 
a la Ley 25.326."
```

---

### 1.4 Voice Recording Consent

**Objective**: Obtain explicit consent before processing voice memos (AI transcription).

**Current Status**: Voice-to-Invoice implemented (`services/ai/app/api/invoice.py`) but no consent flow.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 1.4.1 | Add consent banner before first voice recording | `apps/mobile/components/voice/VoiceRecorder.tsx` | ⬜ TODO |
| 1.4.2 | Store consent in local storage and sync to server | Mobile app storage | ⬜ TODO |
| 1.4.3 | Add `voiceProcessingConsentAt` to TeamMember schema | `apps/web/prisma/schema.prisma` | ⬜ TODO |
| 1.4.4 | Block voice transcription if consent not granted | AI service validation | ⬜ TODO |

---

## Phase 2: AI Transparency & Disclosure

**Priority**: 🟡 HIGH  
**Timeline**: Week 2-3  
**Legal Basis**: Ley 27.452, Res 424

### 2.1 Bot Disclosure Labels

**Objective**: Clearly identify AI interactions as automated.

**Current Status**: AI chat exists (`PublicAIChatBubble`) but no explicit disclosure.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 2.1.1 | Add AI disclosure banner to `PublicAIChatBubble` | `apps/web/components/chat/PublicAIChatBubble.tsx` | ⬜ TODO |
| 2.1.2 | Add AI disclosure to WhatsApp AI responses | `apps/web/lib/services/whatsapp-ai-responder.ts` | ⬜ TODO |
| 2.1.3 | Add AI disclosure to Technician Copilot | `apps/mobile/components/copilot/CopilotPanel.tsx` | ⬜ TODO |
| 2.1.4 | Create reusable `AIDisclosureBanner` component | `apps/web/components/ui/AIDisclosureBanner.tsx` | ⬜ TODO |

**Disclosure Text**:
```
"🤖 Este chat utiliza inteligencia artificial. 
Un humano revisará nuestra conversación si es necesario."
```

**WhatsApp Prefix** (for AI messages):
```
"[IA] " 
```

---

### 2.2 Translation Disclaimer

**Objective**: Clarify AI translations are not legally binding.

**Current Status**: AI translation implemented (`WhatsApp AI Translation`) but no disclaimer.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 2.2.1 | Add disclaimer to translated message previews | `apps/web/app/dashboard/whatsapp/` | ⬜ TODO |
| 2.2.2 | Include disclaimer footer in translation confirmation | Translation UI | ⬜ TODO |
| 2.2.3 | Document in Terms of Service | `/apps/web/app/(legal)/terms/page.tsx` | ⬜ TODO |

**Disclaimer Text**:
```
"⚠️ Traducción automática generada por IA. 
No debe utilizarse como base para acuerdos contractuales."
```

---

### 2.3 AI Financial Approval Limits

**Objective**: Document liability limits for AI-assisted pricing/invoicing.

**Current Status**: Human-in-the-loop implemented but limits not documented.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 2.3.1 | Add financial approval limits to AI settings | `apps/web/app/dashboard/settings/ai-assistant/page.tsx` | ⬜ TODO |
| 2.3.2 | Enforce hard cap on AI auto-approvals | `apps/web/lib/services/pricing-compliance.ts` | ⬜ TODO |
| 2.3.3 | Document limits in Terms of Service | Legal page | ⬜ TODO |

---

## Phase 3: Cookie & Privacy Compliance

**Priority**: 🟡 MEDIUM  
**Timeline**: Week 3-4  
**Legal Basis**: Ley 25.326, GDPR-style best practices

### 3.1 Cookie Consent Banner

**Objective**: Obtain consent for non-essential cookies.

**Current Status**: ❌ NOT IMPLEMENTED (documented in `LEGAL-CHECKLIST.md` as TODO)

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 3.1.1 | Create `CookieConsentBanner` component | `apps/web/components/legal/CookieConsentBanner.tsx` | ⬜ TODO |
| 3.1.2 | Add to public layout | `apps/web/app/(public)/layout.tsx` | ⬜ TODO |
| 3.1.3 | Implement cookie preference storage | localStorage + API | ⬜ TODO |
| 3.1.4 | Create cookie management page | `apps/web/app/(legal)/cookies/page.tsx` | ⬜ TODO |
| 3.1.5 | Conditionally load analytics based on consent | Analytics integration | ⬜ TODO |

---

### 3.2 Privacy Policy Acceptance

**Objective**: Require explicit acceptance of privacy policy at registration.

**Current Status**: Privacy policy page exists (`/privacy`) but no acceptance gate.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 3.2.1 | Add privacy policy checkbox to registration | Registration forms | ⬜ TODO |
| 3.2.2 | Store `privacyPolicyAcceptedAt` in User record | Schema + API | ⬜ TODO |
| 3.2.3 | Add privacy policy version tracking | Database field | ⬜ TODO |
| 3.2.4 | Require re-acceptance when policy changes | Middleware check | ⬜ TODO |

---

## Phase 4: Professional License Hard Blocks

**Priority**: 🟡 MEDIUM  
**Timeline**: Week 4-5  
**Legal Basis**: ENARGAS, ERSEP, CACAAV regulations

### 4.1 License Expiry Job Blocking

**Objective**: Prevent assignment of regulated jobs to unlicensed technicians.

**Current Status**: 
- ✅ Scrapers exist: ERSEP, CACAAV, Gasnor
- ✅ Verification requirements seeded
- ⚠️ No hard block on job assignment

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 4.1.1 | Add `requiredLicenseTypes` field to Job schema | `apps/web/prisma/schema.prisma` | ⬜ TODO |
| 4.1.2 | Create license validation service | `apps/web/lib/services/license-validation.ts` | ⬜ TODO |
| 4.1.3 | Add pre-assignment check in job dispatch | `apps/web/app/api/jobs/[id]/assign/route.ts` | ⬜ TODO |
| 4.1.4 | Show license warning in assignment UI | Job assignment modal | ⬜ TODO |
| 4.1.5 | Allow "soft override" with documented justification | Admin approval flow | ⬜ TODO |

---

### 4.2 Job-Level License Snapshot

**Objective**: Capture license status at moment of job completion (like vehicle snapshots).

**Current Status**: Vehicle snapshots exist but not license snapshots.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 4.2.1 | Add `licenseSnapshot` fields to Job completion | Job completion flow | ⬜ TODO |
| 4.2.2 | Include in Job Completion Report PDF | `apps/web/lib/reports/job-completion-report.ts` | ⬜ TODO |
| 4.2.3 | Store snapshot in forensic record | Cold archive | ⬜ TODO |

---

## Phase 5: Supporting Documentation & Legal Framework

**Priority**: 🟢 LOW  
**Timeline**: Week 5-6  
**Focus**: Documentation and terms clarification

### 5.1 Legal Pages Completion

**Current Status**:
- ✅ Privacy Policy (`/privacy`)
- ✅ Arrepentimiento (`/arrepentimiento`)
- ⚠️ Terms of Service (needs review)
- ❌ Cookie Policy
- ❌ Data Processing Agreement template

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 5.1.1 | Create Cookie Policy page | `apps/web/app/(legal)/cookies/page.tsx` | ⬜ TODO |
| 5.1.2 | Review and update Terms of Service | `apps/web/app/(legal)/terms/page.tsx` | ⬜ TODO |
| 5.1.3 | Add "Supporting Documentation" disclaimer | All report PDFs | ⬜ TODO |
| 5.1.4 | Create DPA template for vendors | `/docs/legal/` | ⬜ TODO |
| 5.1.5 | Add jurisdiction clause to Terms | Legal review | ⬜ TODO |

**Supporting Documentation Disclaimer**:
```
"Este documento es documentación de respaldo y no constituye prueba certificada. 
Para efectos legales, consulte con un profesional habilitado."
```

---

### 5.2 DNPDP Registration

**Objective**: Register databases with Argentina's data protection authority.

**Current Status**: ❌ NOT DONE (administrative task)

#### Tasks

| ID | Task | Owner | Status |
|----|------|-------|--------|
| 5.2.1 | Prepare database inventory document | Legal/IT | ⬜ TODO |
| 5.2.2 | Complete DNPDP registration forms | Legal | ⬜ TODO |
| 5.2.3 | Submit registration and obtain certificate | Legal | ⬜ TODO |
| 5.2.4 | Store certificate reference in compliance dashboard | Dev | ⬜ TODO |

---

### 5.3 Warranty Terms Clarification

**Objective**: Define service warranty obligations per Ley 24.240.

**Current Status**: `warrantyInfo` field exists but no legal definition.

#### Tasks

| ID | Task | File/Location | Status |
|----|------|---------------|--------|
| 5.3.1 | Define standard warranty template | AI assistant settings | ⬜ TODO |
| 5.3.2 | Add warranty terms to invoice/quote PDFs | PDF generators | ⬜ TODO |
| 5.3.3 | Document warranty handling workflow | Operations docs | ⬜ TODO |

---

## Phase 6: Future Enhancements (6-12 months)

**Priority**: 🟢 LOW  
**Focus**: Advanced compliance features

### 6.1 Certified Digital Signatures

**Objective**: Integrate with ONTI or licensed providers for legal non-repudiation.

**Current Status**: ❌ NOT IMPLEMENTED

#### Tasks

| ID | Task | Status |
|----|------|--------|
| 6.1.1 | Research ONTI integration requirements | ⬜ TODO |
| 6.1.2 | Evaluate blockchain timestamping alternatives | ⬜ TODO |
| 6.1.3 | Implement for high-value contracts | ⬜ TODO |

---

### 6.2 Certified Timestamp Authority

**Objective**: Obtain court-admissible timestamps for critical events.

**Current Status**: Using system timestamps with SHA-256 integrity (supporting docs only).

#### Tasks

| ID | Task | Status |
|----|------|--------|
| 6.2.1 | Research TSA (Timestamp Authority) providers | ⬜ TODO |
| 6.2.2 | Integrate for invoice finalization events | ⬜ TODO |
| 6.2.3 | Integrate for job completion events | ⬜ TODO |

---

## Verification Checklist

### Pre-Launch Required
- [ ] Contractor disclaimer screen implemented and tested
- [ ] Rejection penalty audit completed (no penalties found)
- [ ] International data transfer consent implemented
- [ ] AI bot disclosure labels on all AI interfaces
- [ ] Voice recording consent flow implemented
- [ ] Privacy policy acceptance at registration

### Post-Launch Required (30 days)
- [ ] Cookie consent banner on public pages
- [ ] DNPDP registration submitted
- [ ] All legal pages reviewed by counsel
- [ ] Professional license hard blocks active

### Long-Term (6+ months)
- [ ] Certified digital signatures evaluated
- [ ] Timestamp authority integration evaluated

---

## Related Files Reference

### Already Implemented (✅)

| Feature | File Location |
|---------|---------------|
| ARCO Rights | `apps/web/lib/services/data-access-request.ts` |
| Botón de Arrepentimiento | `apps/web/app/(legal)/arrepentimiento/page.tsx` |
| Price Variance Compliance | `apps/web/lib/services/pricing-compliance.ts` |
| Monotributo Limits | `apps/web/lib/services/fiscal-health.service.ts` |
| AFIP CAE Integration | `src/integrations/afip/` |
| AFIP QR Generation | `src/integrations/afip/qr-generator.ts` |
| CUIT Validation | `apps/web/lib/cuit.ts` |
| VTV Tracking | `apps/web/lib/services/compliance-check.ts` |
| ERSEP Scraper | `apps/web/lib/scrapers/ersep-scraper.ts` |
| CACAAV Scraper | `apps/web/lib/scrapers/cacaav-playwright-scraper.ts` |
| Gasnor Scraper | `apps/web/lib/scrapers/gasnor-web-scraper.ts` |
| Job Completion Report | `apps/web/lib/reports/job-completion-report.ts` |
| Cold Archive SHA-256 | Infrastructure layer |
| GPS Tracking (job-scoped) | `apps/mobile/lib/hooks/use-tracking.ts` |

### Compliance Documentation

| Document | Location |
|----------|----------|
| Legal Checklist | `docs/compliance/LEGAL-CHECKLIST.md` |
| Data Retention Policy | `docs/compliance/DATA-RETENTION-POLICY.md` |
| Launch Checklist | `docs/checklists/LAUNCH-CHECKLIST.md` |

---

## Appendix: Legal Reference

| Law | Full Name | Key Requirements |
|-----|-----------|------------------|
| Ley 25.326 | Protección de Datos Personales | DNPDP registration, ARCO rights, consent |
| Ley 24.240 | Defensa del Consumidor | 10% price variance, 10-day withdrawal, transparency |
| Ley 25.506 | Firma Digital | Digital signature legal weight |
| Ley 27.452 | AI Transparency | Bot disclosure requirements |
| Res 424/2020 | Botón de Arrepentimiento | Visible withdrawal mechanism |
| RG 4291 | AFIP QR Codes | QR code on electronic invoices |
| Ley 20.744 | Contrato de Trabajo | Employment relationship indicators |

---

*This document is based on a comprehensive audit of the CampoTech codebase performed on January 16, 2026.*
