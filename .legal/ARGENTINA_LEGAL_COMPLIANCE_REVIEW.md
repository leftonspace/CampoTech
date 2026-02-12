# CampoTech: Argentina Legal Compliance Review Document
**Prepared for Legal Consultation**  
**Date**: February 12, 2026  
**Purpose**: Pre-consultation legal review checklist for Argentine regulatory compliance

---

## Executive Summary

CampoTech is a SaaS platform for field service management targeting the Argentine market. This document consolidates all legal/regulatory considerations identified to date for review by legal counsel specializing in Argentine commercial law.

**Business Model**: B2B SaaS (Software as a Service) - NOT a marketplace  
**Target Market**: Field service businesses (HVAC, Plumbing, Electrical) in Argentina  
**Critical Distinction**: We provide software tools; liability for services remains with the service company (our client)

---

## 1. CRITICAL LEGAL PILLARS

### 1.1 Core Regulatory Framework

| Legal Area | Principal Law | Business Impact | Current Status |
|------------|---------------|-----------------|----------------|
| **Data Protection** | Ley 25.326 | CRM, DNI storage, AI processing, international data transfer | ✅ Implemented |
| **Consumer Protection** | Ley 24.240 | Recurring billing, cancellation rights, quote variance | ⚠️ Needs Review |
| **Tax/Fiscal** | AFIP Regulations (RG 4290) | Electronic invoicing, Monotributo limits, price controls | ✅ Implemented |
| **Digital Evidence** | Ley 25.506 | Legal weight of logs/photos for insurance claims | ✅ Implemented |
| **Labor Law** | Ley 20.744 (Contract Law) | Independent contractor vs employee classification | ⚠️ HIGH PRIORITY |
| **AI Transparency** | Ley 27.452 / Res 424 | Bot disclosure, human-in-the-loop requirements | ✅ Implemented |
| **Trade Licensing** | Provincial Registries | Matrícula requirements (Gas/Electric) | ✅ Implemented |

---

## 2. HIGHEST RISK AREAS (REQUIRE LEGAL REVIEW)

### 🔴 CRITICAL: Labor Law Compliance

**Issue**: Avoiding "Uberization" lawsuits - platform cannot appear to create employer-employee relationship

**Current Mitigation**:
- Platform explicitly positions as "software tool" not "marketplace"
- No schedule setting by platform
- No wage enforcement
- No penalties for job rejection
- Client companies maintain 100% discretion over their workers

**QUESTIONS FOR LAWYER**:
1. Is our current independent contractor disclaimer sufficient?
2. Should we require clients to have their own labor contracts on file?
3. What documentation should we maintain to prove SaaS vs marketplace distinction?
4. Are there specific clauses we should avoid in Terms of Service?

**Current Disclaimer Location**: First mobile login for technicians

---

### 🔴 CRITICAL: Tax Compliance (AFIP)

**Issue**: Monotributo Category K limits - businesses risk automatic exclusion if they exceed revenue limits

**Current Implementation**:
- **80% Threshold**: Critical alert to org admin
- **99% Threshold**: Hard block on new electronic invoices
- Rolling 365-day monitoring of `amount_ars`

**Technical Implementation**: `lib/services/fiscal-health.service.ts`

**QUESTIONS FOR LAWYER**:
1. Is our "hard block" at 99% legally defensible if a client sues saying we prevented business?
2. Should we have disclaimers that monitoring is "informational only"?
3. What liability do we have if our calculation is wrong and client gets excluded from Monotributo?
4. Should clients sign acknowledgment that they're responsible for their own tax compliance?

---

## 3. DATA PROTECTION (Ley 25.326)

### 3.1 International Data Transfer

**Compliance Requirement**: Explicit consent for data stored outside Argentina

**Current Implementation**: ✅ COMPLETE
- Checkbox on signup: *"Entiendo y acepto que mis datos personales serán alojados en servidores fuera de Argentina (EE.UU.) conforme a la Ley 25.326"*
- Consent logged with timestamp, IP address, user agent
- Stored in `Organization.settings.consent` field

**Infrastructure**:
- Supabase (us-east-1) - Database
- OpenAI (US) - AI processing  
- Resend (US) - Email delivery

**QUESTIONS FOR LAWYER**:
1. Is our current consent language sufficient?
2. Do we need DNPDP registration before launch? (We're a SaaS platform, not the data controller)
3. Should we offer an "Argentina-only" hosting option for sensitive clients?
4. What are penalties for non-compliance?

---

### 3.2 ARCO Rights (Access, Rectification, Cancellation, Opposition)

**Compliance Requirement**: Users can request data access/deletion within 10 business days

**Current Implementation**: ✅ COMPLETE
- Public portal: `/data-request` (no login required)
- Email OTP verification
- DNI identity proofing
- Automatic legal deadline calculation (10 business days)
- Audit logging of all PII access
- One-time-use expiring download URLs

**Technical Stack**:
- Service: `lib/services/data-access-request.ts`
- Model: `DataAccessRequest`, `DataAccessRequestAuditLog`

**QUESTIONS FOR LAWYER**:
1. Is 10 business days the correct timeline?
2. What happens if we miss the deadline?
3. Should we charge for data export requests?
4. Can we reject frivolous/spam requests?

---

### 3.3 Account Deletion & Data Retention

**Conflict**: "Right to be Forgotten" vs AFIP 10-year retention requirement

**Current Solution**: Anonymization Strategy
- **Hard Delete**: Photos, documents, personal files
- **Anonymize**: User records (name → "Usuario Eliminado #HASH", email/phone → null)
- **Retain**: Invoices, employment records, audit logs (with anonymized user reference)

**30-Day Grace Period**: Mandatory waiting period before final deletion

**QUESTIONS FOR LAWYER**:
1. Does our anonymization approach satisfy both Ley 25.326 and AFIP requirements?
2. What's the minimum retention for employment records? (We have 10 years)
3. Can users demand "hard delete" of invoices, or can we refuse citing AFIP?
4. Should we have a "Legal Hold" process if user is involved in litigation?

---

### 3.4 Biometric Data (DNI & Selfies)

**Issue**: National Identity Documents are "Sensitive Data" under Ley 25.326

**Current Storage**:
- DNI photos: Encrypted in Supabase Storage
- Access: Admin-only (NOT shown to customers/guards)
- Purpose: Identity verification for marketplace trust
- Retention: Deleted when account closed OR moved to cold storage

**QUESTIONS FOR LAWYER**:
1. Is storing DNI photos legally justified for "professional verification"?
2. Should we get separate consent specifically for biometric data?
3. What security standards are required? (We use AES-256-GCM)
4. Can we share verified status without sharing the actual DNI image?

---

## 4. CONSUMER PROTECTION (Ley 24.240)

### 4.1 "Botón de Arrepentimiento" (Right of Repentance)

**Requirement**: Consumers can cancel purchases within 10 days (for digital services)

**Current Strategy**: 30-day account deletion waiting period (exceeds requirement)

**QUESTIONS FOR LAWYER**:
1. Does this law apply to B2B SaaS subscriptions, or only B2C purchases?
2. If it applies, should we have a dedicated `/arrepentimiento` page?
3. What triggers the 10-day clock - signup or first payment?
4. Can we charge for services already delivered if user cancels?

---

### 4.2 Recurring Billing & Subscription Terms

**Current Practice**:
- Monthly/annual subscriptions
- Auto-renewal with 30-day notice
- Cancellation anytime via dashboard

**QUESTIONS FOR LAWYER**:
1. Are there specific disclosures required for auto-renewal in Argentina?
2. How much notice must we give before charging renewal?  
3. Can we prorate refunds, or must they be full refunds?
4. What are requirements for displaying prices (ARS vs USD)?

---

## 5. PAYMENT & FINANCIAL COMPLIANCE

### 5.1 MercadoPago Integration (OAuth)

**Implementation**:
- Clients connect their own MP accounts
- We store encrypted `MP_ACCESS_TOKEN` per organization
- Webhook signature validation (HMAC-SHA256)
- Idempotency for payments

**Current Architecture**: Organizations own their payment accounts; we never touch money

**QUESTIONS FOR LAWYER**:
1. Do we need financial services licenses since we integrate with MercadoPago?
2. Are there specific disclosures required for OAuth connections?
3. If a payment fails or is fraudulent, what's our liability?
4. Should we have insurance for payment-related disputes?

---

### 5.2 On-Site Collection Methods

**Local Payment Standards** (implemented):
- **Efectivo** (Cash)
- **Mercado Pago** (QR/Link)
- **Transferencia** (Bank Transfer - "Transferencias 3.0")

**Recording**: Technician records payment method + amount on mobile device

**QUESTIONS FOR LAWYER**:
1. Are we liable if a technician records a false payment?
2. Should we require organizations to reconcile payments monthly?
3. What disclosures about cash handling should be in technician contracts?

---

## 6. FISCAL & TAX COMPLIANCE

### 6.1 Electronic Invoicing (AFIP)

**Current Implementation**:
- CAE (Código de Autorización Electrónico) generation
- Immutable once CAE assigned
- 10-year retention requirement
- Fiscal document naming: "Factura" (not "Invoice")

**Legal Naming Policy** ("Legal Shield"):
- **Presupuesto**: Non-fiscal estimate
- **Factura**: Official AFIP invoice with CAE
- **Recibo**: Proof of payment (separate from invoice)

**QUESTIONS FOR LAWYER**:
1. If our system issues an incorrect CAE, who's liable - us or the client?
2. Can we charge extra for electronic invoicing features?
3. What happens if AFIP changes regulations - are we required to update software?
4. Should we disclaim responsibility for AFIP compliance in our Terms?

---

### 6.2 CUIT Validation

**Current Implementation**:
- Mod-11 algorithm validation
- Required for MercadoPago connection
- Used for B2B customer records

**Storage**: Encrypted `afipCertificateEncrypted`, `afipPrivateKeyEncrypted`

**QUESTIONS FOR LAWYER**:
1. Are we allowed to store AFIP credentials (even if encrypted)?
2. Should clients sign a data processing agreement specifically for AFIP data?
3. If we're breached and AFIP credentials leak, what's our liability?

---

## 7. PROFESSIONAL LICENSING & TRADE REGULATIONS

### 7.1 "Smart Compliance" Tiered Approach

**Issue**: ~76% labor informality in Argentina - blocking unlicensed workers kills supply

**Our Strategy**:
- **Tier 1 (Hard Block)** 🔴: GASISTA requires validated Matrícula (provincial gas registry)
- **Tier 2 (Soft Warning)** 🟠: ELECTRICISTA shows warning badge if not validated
- **Tier 3 (Optional)** 🔵: Other trades use licensing as quality differentiator only

**Registry Verification**:
- Automated scraping of public registries (Gasnor, ERSEP, ENARGAS, CACAAV)
- "✓ Registry-Verified" green badge for matches
- Generic badge for user-declared credentials ("Información declarada por el usuario")

**QUESTIONS FOR LAWYER**:
1. Can we legally "soft block" gasistas without licenses, or is that discriminatory?
2. If an unlicensed electrician causes damage, can the client sue us for "allowing" the dispatch?
3. Should our disclaimers state that license verification is "informational only"?
4. What happens if our scraper data is outdated and we show a revoked license as valid?

---

### 7.2 Labor Benchmarks (Wage Suggestions)

**Issue**: Providing wage suggestions could imply we're setting prices (marketplace behavior)

**Current Approach**: 
- Non-binding suggestions (e.g., UOCRA scales)
- Explicit disclaimers: "Consultative only - owner has 100% discretion"
- No penalties for ignoring suggestions

**QUESTIONS FOR LAWYER**:
1. Does providing wage suggestions create implied employer relationship?
2. Should we remove this feature entirely to reduce risk?
3. If we keep it, what disclaimers are required?
4. Can unions sue us for "undermining" official rates if clients pay less?

---

## 8. LIABILITY FRAMEWORK

### 8.1 SaaS vs Marketplace Distinction

**Critical Legal Position**: We are a **software provider**, NOT a service marketplace

**Key Differentiators**:
- We don't dispatch technicians (clients do)
- We don't set prices or schedules
- We don't take commissions on jobs
- We don't handle payments (OAuth to clients' accounts)
- We don't employ or contract technicians

**Under Ley 24.240**: The "Provider" is the Service Company (our client), not CampoTech

**QUESTIONS FOR LAWYER**:
1. Is this distinction clear enough in our Terms of Service?
2. Should we require clients to indemnify us for service-related claims?
3. What insurance should we carry? (We currently have: E&O, Cyber Liability)
4. Should we disclaim liability for service quality in multiple places in the UI?

---

### 8.2 Digital Evidence for Insurance Claims

**Feature**: Platform logs + photos as evidence for vehicle/property insurance claims

**Current Implementation**:
- Immutable "Forensic Snapshots" of vehicle/driver at job start
- GPS timestamps
- Photo metadata preservation
- Ley 25.506 compliance (digital evidence law)

**QUESTIONS FOR LAWYER**:
1. If an insurance company rejects a claim despite our logs, can the client sue us?
2. Should we certify timestamps with a third-party authority?
3. What disclaimers should we add to forensic reports?
4. Can we charge extra for "certified" evidence packages?

---

## 9. AI & AUTOMATION COMPLIANCE

### 9.1 AI Transparency (Ley 27.452)

**Requirement**: Bots must disclose they are automated

**Current Implementation**: ✅ COMPLETE
- WhatsApp bot labeled "Asistente Virtual de [CompanyName]"
- Support chat clearly states "Bot" in header
- "Human-in-the-loop" for complex queries

**AI Processing**:
- OpenAI GPT-4 for natural language
- Voice transcription (Whisper)
- Invoice data extraction

**QUESTIONS FOR LAWYER**:
1. Is our current bot disclosure sufficient?
2. Do we need separate consent for AI processing of customer data?
3. If AI makes an error (wrong quote), who's liable?
4. Should we disclaim AI accuracy in Terms?

---

## 10. COMMUNICATION & MARKETING

### 10.1 WhatsApp Business Integration

**Current Practice**:
- Direct Meta Cloud API (not BSP)
- Manual "Deep Link" (wa.me) for lower tiers
- Automated messaging for job updates

**QUESTIONS FOR LAWYER**:
1. Are there Argentine laws about commercial messaging frequency?
2. Can users sue for "spam" if they get too many job updates?
3. What opt-out mechanisms are required?
4. Can we charge for WhatsApp features (since we pay Meta)?

---

## 11. TERMS OF SERVICE & CONTRACTS

### 11.1 Current Legal Pages

**Implemented**:
- `/privacy` - Privacy Policy
- `/terms` - Terms and Conditions  
- Signup consent checkboxes

**Missing** (potential):
- `/arrepentimiento` - Right of Repentance page
- Service Level Agreement (SLA)
- Data Processing Agreement (DPA) for AFIP data

**QUESTIONS FOR LAWYER**:
1. Should we have separate Terms for "Orgs" vs "Technicians" vs "Customers"?
2. Are there mandatory clauses required by Argentine law?
3. How often should we update Terms, and how much notice is required?
4. Can we force arbitration, or are courts mandatory in Argentina?

---

### 11.2 Liability Caps & Limitations

**Current Thinking**: Cap liability at 12 months of subscription fees

**QUESTIONS FOR LAWYER**:
1. Are liability caps enforceable in Argentina?
2. What types of liability CANNOT be limited (e.g., gross negligence)?
3. Should we exclude indirect/consequential damages?
4. What's reasonable for a B2B SaaS in Argentina?

---

## 12. DATA RETENTION MATRIX

| Record Type | Retention Period | Legal Basis | Deletion Policy |
|-------------|------------------|-------------|-----------------|
| **Invoices (Facturas)** | 10 years | RG AFIP 4290 / Código Civil | Never delete; archive to cold storage |
| **Employment Records** | 10 years post-termination | Ley 20.744 | Anonymize after termination |
| **Audit Logs** | 5 years | Ley 25.326 / Best Practice | Archive then delete |
| **Data Export Requests** | 7 days | Housekeeping | Auto-delete files |
| **Account Deletion Requests** | 30 days | Ley 25.326 | Grace period then execute |

**Automated Enforcement**: Weekly cron job (`/api/cron/retention-cleanup`)

**QUESTIONS FOR LAWYER**:
1. Are our retention periods correct?
2. Can we delete audit logs after 5 years, or should we keep indefinitely?
3. What if there's ongoing litigation - can we still delete after retention period?
4. Should we notify users before deleting archived data?

---

## 13. MARKET-SPECIFIC COMPLIANCE

### 13.1 Argentine Linguistic Standards

**Implementation**:
- "Nafta" (not "Gasolina") for GASOLINE
- "Patente" (not "Matrícula") for vehicle plates
- "CUIT" for Tax ID
- "Razón Social" for Legal Name
- Diacritic-insensitive search (José = Jose)

**QUESTIONS FOR LAWYER**:
1. Are there legal issues with using specific terminology? (e.g., AFIP might require exact wording)
2. Do contracts need to be in Spanish only, or can we include English versions?

---

### 13.2 Customer Type Classifications

| Type | Regulatory Fields | Legal Considerations |
|------|-------------------|---------------------|
| **PARTICULAR** | Name, Address | Standard consumer protection |
| **CONSORCIO** | CUIT, Razón Social | Building management - recurring billing |
| **COMERCIO** | CUIT, Rubro | Commercial urgency contracts |
| **INDUSTRIAL** | CUIT, PPE, Safety | Factory safety documentation requirements |
| **COUNTRY** | Lot Number | Gated community - digital badge requirements |

**QUESTIONS FOR LAWYER**:
1. Do we need different contract terms for each customer type?
2. Are there liability differences for B2B vs B2C?  
3. Should "CONSORCIO" have special protections under building management laws?

---

## 14. INSURANCE & RISK MANAGEMENT

### 14.1 Current Coverage (Review Needed)

- **E&O Insurance**: Errors & Omissions
- **Cyber Liability**: Data breach coverage
- **General Liability**: Basic business coverage

**Missing**:
- Professional Liability for software-caused financial loss?
- Directors & Officers (D&O)?

**QUESTIONS FOR LAWYER**:
1. What insurance is legally required for SaaS in Argentina?
2. What coverage should we require from CLIENT organizations?
3. Should we require technicians to have their own insurance as platform condition?

---

## 15. INTELLECTUAL PROPERTY

### 15.1 Client Data Ownership

**Current Position**: Client owns all their data; we only have license to process

**QUESTIONS FOR LAWYER**:
1. Is our IP clause in Terms sufficient?
2. Can AI training on client data create ownership issues?
3. If client leaves, can they demand we delete all AI models trained on their data?

---

## 16. CROSS-BORDER CONSIDERATIONS

### 16.1 If We Expand Beyond Argentina

**Current Infrastructure**: Already multi-country ready (supports +54, +56, +52, +1 phone codes)

**QUESTIONS FOR LAWYER**:
1. If we have Argentine clients but operate from [your jurisdiction], what laws apply?
2. Do we need an Argentine legal entity, or can we operate as foreign company?
3. What tax obligations do we have in Argentina?
4. Can we use international arbitration for cross-border disputes?

---

## 17. PREPARATION CHECKLIST FOR LAW FIRM

### Documents to Bring

1. ✅ This comprehensive review document
2. ✅ Current Terms of Service (`/terms`)
3. ✅ Current Privacy Policy (`/privacy`)
4. ✅ Sample signup consent flow (screenshots)
5. ✅ Data retention policy chart
6. ✅ SaaS vs Marketplace positioning doc
7. Technical architecture diagram (data flow)
8. Sample client contract / onboarding agreement
9. Current insurance policies
10. Business entity documents (corporation, tax registration)

### Key Questions to Answer

**Priority 1 (Highest Risk)**:
1. Labor law: Independent contractor classification strategy
2. Liability framework: SaaS vs marketplace legal boundaries
3. Tax compliance: AFIP integration and monotributo monitoring

**Priority 2 (High Risk)**:
1. Data protection: International transfer compliance
2. Professional licensing: "Soft block" approach legality
3. Wage suggestions: Avoiding implied employment relationship

**Priority 3 (Medium Risk)**:
1. Consumer protection: Subscription cancellation rights
2. AI transparency: Bot disclosure requirements
3. Payment integration: Financial services licensing

---

## 18. OPEN QUESTIONS

### Legal Structure
- [ ] Do we need an Argentine subsidiary or can we operate as foreign company?
- [ ] What are our tax obligations in Argentina?
- [ ] Do we need DNPDP registration before launch?

### Contracts
- [ ] Should we have separate agreements for orgs vs technicians vs customers?
- [ ] Can we enforce arbitration clauses in Argentina?
- [ ] What liability caps are enforceable?

### Compliance Timeline
- [ ] Which items must be resolved before MVP launch?
- [ ] Which can be "continuous compliance" post-launch?
- [ ] What's the risk/penalty matrix for each regulatory area?

---

## 19. CONTACT INFORMATION

**For Legal Review**:
- **Company**: CampoTech
- **Platform**: B2B SaaS for field service management
- **Target Market**: Argentina (Buenos Aires, Córdoba, Rosario initially)
- **Launch Timeline**: [To be discussed]
- **Current Phase**: Pre-launch legal review

**Related Documentation**:
- Technical Implementation: `/architecture` directory
- Security Audits: See KI "Monorepo Security Audit"
- Regulatory Artifacts: `.gemini/antigravity/knowledge/argentina_regulatory_compliance/`

---

## 20. NEXT STEPS

1. **Schedule Consultation**: Present this document to Argentine legal counsel
2. **Prioritize Risks**: Get lawyer's assessment of which risks need immediate action
3. **Document Updates**: Based on lawyer feedback, update Terms/Privacy/Consent flows
4. **Insurance Review**: Ensure adequate coverage for identified risks
5. **Compliance Roadmap**: Create timeline for addressing any legal gaps before launch

---

**Document Prepared By**: [Your Name]  
**Review Date**: February 12, 2026  
**Status**: Draft for Legal Consultation  
**Version**: 1.0

---

*This document consolidates existing implementation decisions and open legal questions. It is NOT legal advice. All positions should be reviewed and validated by qualified Argentine legal counsel before launch.*
