# CampoTech: Legislative Stress Test
## Argentine Regulatory Liability Analysis

**Prepared by:** Senior Legal Compliance Auditor  
**Date:** February 12, 2026  
**Classification:** CONFIDENTIAL — Attorney-Client Prep Document  
**Methodology:** Cross-referencing current Argentine legislation, AFIP resolutions, Supreme Court jurisprudence, and **the actual CampoTech codebase** (Prisma schema, Next.js app, payment integrations)

---

> ⚠️ **DISCLAIMER**: This analysis is based on publicly available legal texts and published jurisprudence as of February 2026. It identifies regulatory *risks* and is NOT legal advice. All findings should be validated by licensed Argentine counsel (Abogado Matriculado) before any action.

---

## Table of Contents

1. [Hidden Obligations](#1-hidden-obligations)
   - 1.1 UIF / Anti-Money Laundering
   - 1.2 CERT-AR / Cybersecurity Breach Notification
   - 1.3 DNPDP / Database Registration
   - 1.4 AFIP RG 4290 — Electronic Invoicing
   - 1.5 Registro Nacional No Llame
   - 1.6 **INPI — Trademark Registration (NEW)**
2. [The "Uberization" Risk](#2-the-uberization-risk)
   - 2.1 Key Jurisprudence
   - 2.2 CampoTech Vulnerability Analysis
   - 2.3 Pending Reform
   - 2.4 **Art. 30 LCT — The "Solidarity" Nuclear Option (NEW)**
3. [Provincial Traps: Ingresos Brutos & Convenio Multilateral](#3-provincial-traps)
   - 3.1 Ingresos Brutos — Multi-Jurisdictional
   - 3.2 Specific Provincial Risks
   - 3.3 **SIRCREB / SIRCUPA — The Automatic Revenue Drain (NEW)**
4. [Software Liability & Consumer Defense](#4-software-liability)
   - 4.1 Product Liability (CCCN)
   - 4.2 Ley 24.240 Applicability
   - 4.3 **Ventanilla Federal & Legal Domicile Trap (NEW)**
5. [Data Sovereignty](#5-data-sovereignty)
6. [Cross-Cutting Risks & Summary Matrix](#6-cross-cutting-risks)
7. [Macro-Economic Legal Defense](#7-macro-economic-legal-defense)
   - 7.1 **The "Indexation" Prohibition (Ley 23.928 + DNU 70/2023)**
   - 7.2 **The "Cepo" & Profit Repatriation (MULC)**
   - 7.3 **Stamp Tax on Digital Acceptance ("Impuesto de Sellos")**

---

## 1. Hidden Obligations

### 1.1 🔴 UIF / Anti-Money Laundering (Ley 25.246 + Resolución UIF 76/2019)

**The Trap:** CampoTech integrates MercadoPago via OAuth and stores `MP_ACCESS_TOKEN` per organization (confirmed in codebase: `Organization.afipCertificateEncrypted`, MP integration at `src/integrations/mercadopago/`). While CampoTech does NOT process payments directly, the **Resolución UIF N° 76/2019** defines "Adquirentes, Agregadores, Agrupadores y Facilitadores de Pagos" as **sujetos obligados** (obligated parties) under anti-money laundering law.

**The Legal Question:** Does CampoTech's OAuth integration (where client organizations' MercadoPago accounts process payments and CampoTech creates `mp_preference_id` and tracks `mp_payment_status` — see `Job` model) constitute acting as a "Facilitador de Pagos"?

**Required Obligations if Classified as Sujeto Obligado:**

| Obligation | Legal Basis | Status in Codebase |
|------------|-------------|-------------------|
| Designate a UIF compliance officer ("Enlace") | Res. UIF 76/2019, Art. 5 | ❌ **NOT IMPLEMENTED** |
| File Reportes de Operación Sospechosa (ROS) within 150 calendar days | Ley 25.246, Art. 21(b); Res. UIF 76/2019 | ❌ **NOT IMPLEMENTED** |
| Implement KYC (Know Your Customer) for all organizations | Res. UIF 76/2019, Art. 10 | ⚠️ Partial (CUIT validation + identity verification exists, but not UIF-grade) |
| Maintain transaction monitoring systems | Res. UIF 76/2019, Art. 8 | ⚠️ Partial (fiscal health monitoring at `api/analytics/fiscal-health` but not AML-focused) |
| Report to UIF within 48 hours for terrorism financing suspicion | Ley 25.246, Art. 21 ter | ❌ **NOT IMPLEMENTED** |
| **Screen clients against RePET** (Registro Público de Personas y Entidades vinculadas a actos de Terrorismo) before onboarding | **Res. UIF 49/2024** | ❌ **NOT IMPLEMENTED** |
| Continuously monitor existing clients against RePET updates | **Res. UIF 49/2024**, Art. 3 | ❌ **NOT IMPLEMENTED** |

**Updated Risk (Res. UIF 200/2024):** The UIF has extended obligations to PSPs (Proveedores de Servicios de Pago) and non-financial lending entities, tightening enforcement in alignment with GAFI standards. This expansion makes the "facilitador" classification *more likely*, not less.

**Codebase Evidence:** CampoTech `apps/web` handles:
- `src/integrations/mercadopago/oauth/` — OAuth token management
- `src/integrations/mercadopago/webhook/` — Payment webhook processing  
- `src/integrations/mercadopago/chargeback/` — Chargeback handling
- `Job.mpPreferenceId`, `Job.mpPaymentStatus` — Payment status tracking
- `src/workers/payments/mp-reconciliation.service.ts` — Reconciliation

> **VERDICT:** CampoTech is creating payment preferences, processing webhook notifications, handling chargebacks, and reconciling payments. Claiming to "never touch money" while performing these operations is **legally precarious**. A UIF audit would likely find CampoTech operates as a *de facto* facilitador.

**Penalty:** Fines of ARS 1M to ARS 20M per violation (Ley 25.246, Art. 24). Criminal liability for directors if intentional omission.

**⚠️ Associate's Question — RePET Screening:**

> *"Does CampoTech need to screen clients against the 'List of Terrorists and Criminals' (RePET) before allowing them to use the platform?"*

**Answer:** **YES, if classified as sujeto obligado.** Res. UIF 49/2024 (published March 22, 2024 in the Boletín Oficial) **mandates** that all sujetos obligados must:
1. Verify that clients AND their beneficial owners are **not listed in RePET** before establishing any commercial relationship
2. **Continuously monitor** the RePET for matches against existing clients, beneficial owners, and recipients of transfers
3. Take **immediate action** (freezing, reporting) if a match is found

The RePET is a public registry maintained by the Ministry of Justice at [repet.jus.gob.ar](https://repet.jus.gob.ar). Since CampoTech onboards organizations including their CUIT and legal representatives, implementing a RePET check **at registration time** and periodically is technically straightforward — but is currently **completely absent** from the codebase.

---

### 1.2 🔴 CERT-AR / Cybersecurity Breach Notification (Res. 580/2011 + Convenio 108+)

**The Trap:** CampoTech stores encrypted AFIP credentials (`afipCertificateEncrypted`, `afipPrivateKeyEncrypted`), DNI photos, payment tokens, and personal data. Argentina's current Ley 25.326 does NOT mandate breach notification for private companies. However:

1. **Convenio 108+ (Ley N° 27.699, ratified 2022):** Once in force, requires notification to AAIP within **72 hours** of a breach affecting fundamental rights.
2. **Resolución AAIP 47/2018:** Recommends breach notification as "best practice" — regulators will use this recommendation as evidence of expected behavior if a breach occurs.
3. **Proyecto de Ley de Protección de Datos Personales:** Currently in Congress (as of Jan 2024), would make breach notification **mandatory**.
4. **Resolución 126/2024 (AAIP):** Unified sanctions regime for Ley 25.326 violations — fines now systematized and enforced.

**Codebase Status:**
- Security logging exists (`src/lib/security/log-redaction.ts`, `src/lib/logging/error-handler.ts`)
- Audit logs implemented (`AuditLog` model in Prisma)
- NO breach notification workflow or incident response plan found in codebase

> **VERDICT:** Even without a current legal *mandate*, the practical expectation is evolving. Storing AFIP private keys is particularly high-risk: if leaked, a malicious actor could issue fraudulent facturas on behalf of client organizations. The regulatory trend is clearly toward mandatory notification.

**Recommended Action:** Implement an incident response workflow with 72-hour notification capability *now*, before it becomes mandatory.

---

### 1.3 🟡 DNPDP / Database Registration (Ley 25.326, Art. 21; Decreto 1558/2001)

**The Trap:** The privacy page at `/privacy` states:

> *"CampoTech está inscripta en el Registro Nacional de Bases de Datos Personales de la Dirección Nacional de Protección de Datos Personales (DNPDP) conforme lo establecido en la Ley 25.326."*

**THIS MAY NOT YET BE TRUE.** The codebase includes:
- `DataAccessRequest` model (ARCO compliance)
- `UserConsentLog` model (consent tracking)
- Multiple data categories: DNI photos, GPS location, voice recordings, AFIP credentials

The DNPDP registration (now via AAIP) requires registering EACH database containing personal data. CampoTech has at minimum:
1. Employee/technician database (including biometric-adjacent data: DNI photos)
2. Customer database (names, addresses, phones)
3. Financial data (AFIP credentials, payment records)
4. Location data (GPS tracking sessions)
5. Communications data (WhatsApp messages, voice recordings)

**Each database may require separate registration.**

**Penalty:** Sanctions under Ley 25.326, Art. 31: fines, suspension of database, potential criminal liability under Art. 32.

---

### 1.4 🟡 AFIP RG 4290/2018 — Electronic Invoicing Agent Obligations

**Current Implementation:** CampoTech generates CAEs and manages electronic invoicing (confirmed: `Invoice.afipCae`, `Invoice.afipCaeExpiry`, `Invoice.afipQrCode`). The system stores AFIP certificates and private keys for organizations.

**Hidden Obligation:** Under RG 4290, the entity issuing electronic invoices on behalf of others may be classified as a **"Servicio de Facturación Tercerizado"** (outsourced invoicing service). This triggers:

| Obligation | Legal Basis | Status |
|------------|-------------|--------|
| AFIP registration as technology service provider | RG 4290, Cap. IV | ❓ Unknown |
| Data integrity and non-repudiation guarantees | RG 4290, Art. 33 | ✅ Implemented (immutability after `pricingLockedAt`) |
| 10-year retention of all issued invoices | Ley 11.683 (Ley de Procedimiento Tributario) | ⚠️ Planned but verify cold storage |
| Assist in AFIP audits of client organizations | RG 4290, Art. 38 | ❌ No audit facilitation tooling |

---

### 1.5 🟡 Registro Nacional No Llame (Ley 26.951 + Decreto 2501/2014)

CampoTech sends automated WhatsApp messages, SMS via outbound queue (`SmsOutboundQueue`, `WaOutboundQueue`), and uses Meta Cloud API for business messaging. Under Ley 26.951:

- Commercial contacts (including job notifications with commercial content) to numbers registered in the *Registro Nacional No Llame* are prohibited.
- Fine per violation: ARS 1,000 to ARS 100,000 (Res. 126/2024 updated sanctions).

**Codebase evidence:** No `No Llame` registry check was found before sending outbound messages.

---

### 1.6 🔴 INPI — Trademark Registration (Ley 22.362)

**The Trap:** Argentina operates on a **"first to file"** system for trademarks (Art. 4, Ley 22.362), meaning trademark ownership is acquired through **registration**, not through use. Unlike the US (where "first to use" provides some common-law protection), in Argentina, if someone else registers "CampoTech" before you, they legally own the brand — and can:
- Force removal from App Store / Play Store listings
- Send cease-and-desist letters
- Block domain registrations under `.ar` (NIC Argentina)
- Seek injunctive relief (medida cautelar) to shut down operations

**Required Registrations:**

| Nice Class | Coverage | CampoTech Relevance |
|-----------|----------|--------------------|
| **Class 9** | Software, downloadable apps, computer programs | Mobile app (React Native), desktop web app |
| **Class 35** | Business management, advertising, marketing services | Marketplace features, lead generation, business profiles |
| **Class 42** | SaaS, software development, IT services, cloud computing | Core SaaS platform, API services, AI features |
| **Class 36** | Financial services, payment processing | If classified as payment facilitator |

**Process:**
1. **Antecedent Search** at INPI database — verify no conflicting marks exist
2. **File application** via INPI online portal (requires CUIT/CUIL + Clave Fiscal Nivel 2)
3. **Publication** in Boletín de Marcas — 30-day opposition period
4. **Examination** (12-17 months typical timeline; can extend to 24 months if opposed)
5. **Registration** valid for 10 years, renewable

**Cost (as of 2024):** ARS ~17,680 per class (official INPI fee) + professional fees if using trademark attorney.

**⚠️ NEW: Starting March 1, 2026**, INPI will limit its examination to **absolute prohibitions and public order** only. Relative grounds (similarity with existing marks) will be handled exclusively via third-party oppositions. This means trademark squatters will have an even easier path unless valid marks are on file.

**Codebase Evidence of Brand Assets:**
- Logo and branding throughout `apps/web` and `apps/mobile`
- "Marca Blanca" (White Label) feature flag in `feature-flags.ts` — confirms brand identity is a product feature
- Public marketplace with branded pages
- Domain: campotech.app (presumably)

**Legal Defense Against Squatters (Art. 24, Ley 22.362):**
Marks registered by someone who "knew or should have known" they belonged to another, or by habitual squatters, can be nullified — but this requires **litigation**, which is expensive and slow (2-4 years).

> **VERDICT:** Register "CampoTech" with INPI in Classes **9, 35, and 42** immediately. This is a **pre-launch blocker**. The filing cost is minimal compared to the existential risk of a squatter blocking your operations.

---

## 2. The "Uberization" Risk

### 2.1 🔴 Key Argentine Jurisprudence — When "Just Software" Lost

#### Case 1: González v. Kadabra SA (Glovo) — April 2024
**Court:** Tribunal Nacional del Trabajo  
**Holding:** Recognized employment relationship between delivery worker and platform.

**Deciding Factors:**
1. **Prestación personal e infungible** — Workers could not freely send substitutes
2. **Remuneración** — Platform set price and paid workers
3. **Subordinación jurídica** — Platform controlled through algorithmic management, client complaint systems, and mandatory branded apparel

#### Case 2: Rappi / Tribunal de Trabajo N° 2, La Plata — 2021
**Court:** Tribunal de Trabajo N° 2 de La Plata  
**Holding:** Confirmed employment relationship; ratified multi-million peso fine against Rappi for worker misclassification.

**Deciding Factors:**
1. Platform maintained "power of direction and control" despite claiming freedom
2. Algorithmic assignment of tasks ≈ managerial direction
3. Economic dependence of workers on the platform

#### Case 3: Pedidos Ya — Reincorporación Order — 2021
**Court:** Justicia Nacional  
**Holding:** Ordered reinstatement of dismissed worker, establishing precedent for platform workers' organizational rights.

---

### 2.2 🔴 CampoTech Vulnerability Analysis Against These Rulings

**The legal test applied in ALL these cases has three prongs** (Art. 21-23, Ley 20.744):

| Factor | What courts look for | CampoTech Risk Assessment |
|--------|---------------------|--------------------------|
| **1. Control (Subordinación técnica)** | Does platform dictate HOW work is done? | 🟢 LOW — CampoTech doesn't dictate methods. BUT: `ServiceTypeConfig` defines service categories, UOCRA skill levels (`uocraLevel` field on User model) are referenced, and `confirmationCode` system requires technicians to follow prescribed workflows. |
| **2. Economic (Subordinación económica)** | Does platform control income? | ⚠️ **MEDIUM-HIGH** — Problematic features found in codebase: |
| | | - `OrganizationPricingSettings` + `OrganizationLaborRate` — Platform provides **wage rate tables** |
| | | - `uocraLevel` (NONE/AYUDANTE/MEDIO_OFICIAL/OFICIAL/OFICIAL_ESPECIALIZADO) mapped to hourly rates |
| | | - `User.hourlyRateOverride` — Platform infrastructure for rate setting |
| | | - `PriceItemHistory`, `PriceAdjustmentEvent` — Price change tracking |
| | | - `estimatedTotal`, `techProposedTotal`, `finalTotal` — Multi-stage pricing approval |
| | | - `varianceApprovedAt/By`, `varianceRejectedAt/By` — **Admin can REJECT technician-proposed prices** |
| **3. Disciplinary (Subordinación jurídica)** | Can platform sanction? | ⚠️ **MEDIUM** — Found: |
| | | - `complianceScore` on Organization — scoring system |
| | | - `ComplianceBlock` model — can **block organizations** |
| | | - `ComplianceAcknowledgment` — forced acknowledgments |
| | | - `canBeAssignedJobs` flag on User — can disable job assignment |
| | | - `verificationStatus` system gatekeeps marketplace access |

#### **The Smoking Gun: UOCRA Wage Scales**

The most dangerous feature in the codebase is the UOCRA wage scale system. The codebase at `apps/web/lib/team/trade-config.ts` contains:

```
UOCRA_CATEGORIES = [AYUDANTE, MEDIO_OFICIAL, OFICIAL, OFICIAL_ESPECIALIZADO]
```

This embedded in the `User.uocraLevel` field with `OrganizationLaborRate` tables and `hourlyRateOverride`:

- Maps directly to **CCT 76/75** (Convenio Colectivo de Trabajo de UOCRA)
- Implies CampoTech is classifying workers according to union scales
- A court could interpret this as: "The platform categorizes workers by skill level and provides wage benchmarks → therefore the platform controls compensation → therefore employment relationship exists"

> **VERDICT:** The existing disclaimer ("Consultative only — owner has 100% discretion") may be insufficient. Argentine courts have consistently looked at **substance over form**. The infrastructure for price control, variance approval/rejection, compliance blocking, and UOCRA categorization creates a pattern that courts would examine closely.

#### **The "Marketplace" Problem**

CampoTech's codebase reveals a public marketplace with:
- `marketplaceVisible` flag on Organization
- `MarketplaceClick` tracking for attribution
- `BusinessPublicProfile` model
- Lead generation from marketplace (`/dashboard/leads`)
- Review moderation (`/dashboard/marketplace/moderation`)

> Claiming to be "just software" while operating a **public marketplace** that generates leads, tracks attribution, moderates reviews, and controls visibility is contradictory. This is the exact pattern that Rappi/Glovo used — and lost.

---

### 2.3 🟡 Pending Reform: Workers' Classification (2025-2026)

A labor reform proposal in Congress (late 2025) contemplates:
- A new chapter for platform workers: not employees, but required to register as Monotributistas
- Mandatory accident insurance (Seguro de Accidentes Personales)
- Freedom to connect/disconnect without algorithmic sanctions
- Human customer service for complaints

**Impact on CampoTech:** If this reform passes, it would actually *help* CampoTech's position by creating a third category. However, it is NOT yet law, and the current Ley 20.744 framework still applies.

---

### 2.4 🔴 Art. 30 LCT — The "Solidarity" Nuclear Option

**The Gap Identified:** The Uberization analysis above focuses on *direct* employment relationship (Arts. 21-23 LCT). But there's a **second, independent path** to liability that doesn't require proving an employment relationship: **Article 30 of the Ley de Contrato de Trabajo (Ley 20.744)**.

**What Art. 30 Says:**

> *"Quienes cedan total o parcialmente a otros el establecimiento o explotación habilitado a su nombre, o contraten o subcontraten, cualquiera sea el acto que le dé origen, trabajos o servicios correspondientes a la actividad normal y específica propia del establecimiento, dentro o fuera de su ámbito, deberán exigir a sus contratistas o subcontratistas el adecuado cumplimiento de las normas relativas al trabajo y los organismos de seguridad social."*

**Translation:** If Company A contracts Company B to perform Company A's **"normal and specific activity,"** Company A is **jointly and severally liable** (solidariamente responsable) for ALL labor and social security obligations of Company B's workers.

#### How This Applies to CampoTech:

**The Critical Question:** Is plumbing/gas installation/HVAC work CampoTech's "normal and specific activity" (actividad normal y específica)?

| Position | Argument | Probability |
|----------|----------|-------------|
| **CampoTech's Defense** | "We are a SOFTWARE company. Our activity is SaaS. Plumbing is our CLIENT's activity, not ours." | Strengthened if CampoTech stays purely SaaS |
| **Plaintiff's Argument** | "CampoTech's BUSINESS is to organize, dispatch, price, and collect payment for field services. Without plumbers, CampoTech has no business. Therefore plumbing IS CampoTech's 'normal and specific activity.'" | Strengthened by marketplace features |

**Court Interpretation Spectrum:**

1. **Restrictive (CSJN tendency):** The activity must be the CORE object of the company. Software development ≠ plumbing. CampoTech wins.
2. **Broad (Cámara del Trabajo tendency):** If the contracted activity is **integral or complementary** to the company's productive process, solidarity applies. Since CampoTech cannot function without field service professionals, a court applying this standard could find solidarity.

**Codebase Features That Strengthen the Plaintiff's Case:**

| Feature | Codebase Location | Why It's Dangerous |
|---------|-------------------|-------------------|
| License verification (ENARGAS, CACAAV, ERSEP, Gasnor) | `lib/scrapers/cacaav-playwright-scraper.ts`, `scripts/scrape-cacaav-full.ts` | CampoTech **actively verifies** professional licenses — this looks like it's ensuring service quality for *its* activity |
| Service type configuration | `ServiceTypeConfig` model, `trade-config.ts` | Platform defines what types of work exist — looks like defining the "activity" |
| Dispatch/assignment | `canBeAssignedJobs` flag, scheduling system | Platform controls WHO does the work and WHEN |
| Quality control | `ComplianceScore`, review moderation | Platform controls quality of the "service" — like a principal would |
| Pricing control | `OrganizationLaborRate`, variance approval | Platform influences/controls price = controls the economic activity |
| Public marketplace | `marketplaceVisible`, `MarketplaceClick` | Platform is the **face** of the service to end consumers |

> **The Delicate Balance:** Your associate is correct — verifying gas licenses is legally prudent (for liability reasons) but creates an **Art. 30 risk**. A judge could say: "If plumbing isn't your activity, why are you verifying gas installation licenses? You're doing what a plumbing company does when it hires subcontractors."

**Practical Consequences if Art. 30 Applies:**

If a technician at a client organization sues their employer for unpaid wages, severance, or workplace injury, and the employer is insolvent or non-compliant:
- The technician can **also sue CampoTech** as solidariamente responsable
- CampoTech would be liable for **all** labor debts: wages, severance, social security contributions, ART (workplace risk insurance), fines
- There is **no cap** on this liability — it covers the full employment claim

**Key Jurisprudence:**
- A 2025 fallo from the Cámara del Trabajo found that **cleaning services** were the "normal and specific activity" of the contracting company because cleaning was integral to their business operations — confirming the broad interpretation.
- The CSJN has historically been more restrictive, but lower courts (where most labor cases are resolved) tend to apply the broader standard.

> **VERDICT:** Art. 30 is the **single most dangerous labor law provision** for CampoTech, even more than the Uberization risk. The Uberization argument requires proving a direct employment relationship. Art. 30 creates **automatic** joint and several liability for ALL client organizations' labor debts if a court determines that field services are CampoTech's "normal and specific activity." Given the marketplace features, license verification, and pricing control in the codebase, a broad-interpretation court would have substantial evidence.

**Recommended Mitigation:**
1. **Contractual clauses** requiring client organizations to certify compliance with labor and social security obligations (Art. 30 itself requires this — "deberán exigir... el adecuado cumplimiento")
2. **Periodic compliance verification** — request proof of ART, social security payments, payroll registration from client organizations
3. **Marketing discipline** — never describe CampoTech as performing field services; always position as "software for companies that perform field services"
4. **Consider removing marketplace features** or clearly separating the marketplace as a directory (not a service provider)

---

## 3. Provincial Traps

### 3.1 🔴 Ingresos Brutos — Multi-Jurisdictional Obligation

**The Problem:** CampoTech targets Buenos Aires, Córdoba, and Rosario (Santa Fe) as initial markets. If CampoTech has clients (organizations) in multiple provinces, the **Convenio Multilateral** applies.

#### The Legal Framework:

| Law/Regulation | What it does | CampoTech Impact |
|---------------|-------------|------------------|
| **Convenio Multilateral (1977)** | Distributes IIBB tax base across provinces where activity occurs | Must register and file in EVERY province with clients |
| **Art. 1° Convenio Multilateral** | Triggered when activities occur in 2+ jurisdictions | CampoTech has clients in BA + Córdoba + Santa Fe = **triggered** |
| **Comisión Arbitral RG 12/2025** | Updated NAES codes for digital services (effective Jan 2026) | New codes for "intermediación digital," "servicios tecnológicos" apply |
| **ARBA RN 25/2025 (Pcia. Bs. As.)** | Digital payment platforms act as withholding agents for IIBB | MercadoPago accounts of CampoTech clients subject to automatic retention |
| **SIRCUPA** | System for withholding IIBB from digital payment accounts | Provincial tax agencies can withhold from MP accounts |

#### What CampoTech Must Do:

1. **Register in the Convenio Multilateral** (SIFERE system) — **mandatory if operating in 2+ provinces**
2. **File monthly declarations (CM03)** distributing revenue across provinces
3. **File annual declaration (CM05)** with full-year distribution coefficients
4. **Register as local or Convenio Multilateral contributor** in each province where clients exist
5. **Apply the correct NAES activity code** — likely "servicios de programación informática" or the new 2026 digital intermediation codes

#### The "Sustento Territorial" Rule:

For SaaS companies, the Comisión Arbitral interprets that "sustento territorial" exists in a province if:
- Clients (subscribers) are domiciled there
- Services are consumed there
- The company incurs *any expense* attributable to that province (even marketing spend)

> **VERDICT:** CampoTech MUST register in the Convenio Multilateral. Having clients in Buenos Aires and Córdoba alone triggers the obligation. Each additional province where a client signs up creates a new registration requirement. **This is not optional.**

### 3.2 🟡 Specific Provincial Risks

| Province | Specific Trap | Citation |
|----------|--------------|---------|
| **Buenos Aires** | ARBA retentions on digital payment accruals (effective Oct/Nov 2025). MercadoPago accounts of CampoTech clients will have IIBB retained automatically. | RN ARBA 25/2025 |
| **Córdoba** | Dirección General de Rentas requires registration even for pure SaaS if consumed by Córdoba-domiciled entities. Rate: 3% to 4.75% depending on activity. | Código Tributario Provincial, Tít. II |
| **Santa Fe** (Rosario) | API (Administración Provincial de Impuestos) has aggressive enforcement for digital services. Has been early-adopting SIRCUPA. | Ley Impositiva Anual |
| **CABA** | AGIP applies Convenio Multilateral for any company with CABA-based clients. Must register as "contribuyente de Convenio." | Código Fiscal CABA, Art. 207 |

---

### 3.3 🔴 SIRCREB / SIRCUPA — The Automatic Revenue Drain

**The Trap Your Associate Identified:**

> *"Banks (and MercadoPago) are legally required to withhold tax (SIRCREB) from your transfers if you aren't correctly registered. You could lose 3-5% of your gross revenue to automatic withholdings if this isn't set up right."*

**This is 100% correct.** Here's how the two systems work:

#### SIRCREB (Bank Accounts — CBU)

| Detail | Description |
|--------|-------------|
| **Full Name** | Sistema de Recaudación y Control de Acreditaciones Bancarias |
| **Administered by** | Comisión Arbitral del Convenio Multilateral (COMARB) |
| **What it does** | Automatically withholds IIBB from **every bank account deposit** |
| **Withholding rate** | **0.1% to 5%** depending on activity, jurisdiction, and CM03 declaration |
| **Applied to** | All CBU (bank accounts) of Convenio Multilateral and local contributors |
| **Lookup** | sircreb.gov.ar (enter CUIT + period to see your alícuota) |

#### SIRCUPA (Digital Wallets — CVU)

| Detail | Description |
|--------|-------------|
| **Full Name** | Sistema Informático de Recaudación y Control de Acreditaciones en Cuentas de Pago |
| **What it does** | Same as SIRCREB but for **CVU** (virtual wallet accounts like MercadoPago) |
| **Applied to** | PSPs (Proveedores de Servicios de Pago) act as withholding agents |
| **Provincial Adoption** | Progressive — Buenos Aires (Oct 2025), Mendoza (Oct 2022), others ongoing |
| **Exclusions** | Transfers between same-owner accounts (CBU↔CVU of same CUIT) |

#### The Revenue Leak Scenario:

1. CampoTech receives SaaS subscription payments into its bank account or MercadoPago
2. If CampoTech is **not registered** in the Convenio Multilateral, the system assigns a **default maximum alícuota** (typically 3-5%)
3. This withholding happens **automatically** — the bank/PSP retains the amount before crediting to your account
4. Recovering over-withheld amounts requires filing declarations and requesting reimbursement — which can take **6-12 months**
5. Meanwhile, that 3-5% is **gone from your cash flow**

#### Additional Wrinkle for CampoTech:

CampoTech's CLIENT organizations also face SIRCREB/SIRCUPA withholdings on their MercadoPago accounts. Under RN ARBA 25/2025, when a client's customer pays via MercadoPago:
- MercadoPago withholds IIBB from the client organization's account
- If the client is incorrectly registered, they lose revenue
- The client may blame CampoTech for "setting up" their payment processing (via OAuth) without warning about tax withholdings

> **VERDICT:** SIRCREB/SIRCUPA withholdings are **not optional** — they happen automatically whether or not you're prepared. CampoTech must:
> 1. Register in Convenio Multilateral **before accepting any revenue**
> 2. File CM03 monthly declarations to set the correct (lower) withholding rate
> 3. Warn client organizations about IIBB withholdings on their MercadoPago accounts during onboarding
> 4. Consider adding an informational notice in the MercadoPago integration setup flow

---

## 4. Software Liability

### 4.1 🔴 Product Liability Under Código Civil y Comercial (CCCN)

**The Core Question:** If CampoTech's software deletes a client's invoice database, generates an incorrect CAE, or miscalculates Monotributo limits — is CampoTech liable despite Terms of Service disclaimers?

#### Applicable Articles:

| Article | Content | Application to CampoTech |
|---------|---------|--------------------------|
| **Art. 1757 CCCN** | "Toda persona responde por el daño causado por el **riesgo o vicio de las cosas**, o de las actividades que sean riesgosas o peligrosas. La responsabilidad es **objetiva**." | Software = "cosa" or "actividad riesgosa" → **objective liability** regardless of intent or negligence |
| **Art. 1758 CCCN** | Owner, guardian, or anyone who profits from the thing is jointly liable | CampoTech profits from the SaaS → jointly liable for software defects |
| **Art. 1723 CCCN** | "Obligación de resultado": when a specific outcome is promised, failure = breach | SaaS contract implicitly promises functionality → failure to deliver = breach |
| **Art. 1743 CCCN** | Waivers of liability for personal injury (daño a la persona) are void | Cannot waive liability for damages to persons caused by software errors |
| **Art. 40 Ley 24.240** | Joint and several liability for producers, distributors, and sellers of "cosas" | If CampoTech is classified as "proveedor" of a product (the software), Ley 24.240 consumer protection applies **and liability caps may be unenforceable** |

#### Critical Scenario Analysis:

**Scenario 1: Incorrect CAE Generation**
- CampoTech's `Invoice.afipCae` stores the CAE number
- If the system generates an incorrect CAE or issues duplicate invoices, the CLIENT faces AFIP sanctions
- Under Art. 1757 CCCN, CampoTech has **objective liability** for the defect
- A TOS clause disclaiming AFIP accuracy would likely be deemed **abusive** under Art. 37 Ley 24.240

**Scenario 2: Monotributo Hard Block at 99%**
- Codebase implements fiscal health monitoring (`fiscal-health.service.ts`)
- At 99% threshold: **hard block on new electronic invoices**
- If this calculation is wrong (e.g., currency rounding, timezone issues), a client could sue for:
  - **Lucro cesante** (lost profits from blocked billing)
  - **Daño emergente** (direct damages from inability to invoice)
- Under Art. 1723 CCCN, the monitoring creates an **obligation of result**: if you promise to track, you must track accurately

**Scenario 3: Data Loss / Invoice Deletion**
- Argentine doctrine treats software providers with an obligation analogous to **"obligation of result"** when they custody data
- Published case law (see: software antifuncional cases cited in SAIJ) has held providers liable for:
  - Lost sales records
  - Corrupted databases
  - System downtime during critical periods

> **VERDICT:** Argentine law following Art. 1757 CCCN imposes **OBJECTIVE LIABILITY** for software defects. This means:
> 1. CampoTech is liable *regardless of whether it was negligent*
> 2. Liability caps in TOS (the proposed "12 months of subscription fees") are likely **unenforceable** for consumer-facing aspects under Ley 24.240
> 3. For B2B contracts, liability caps *may* survive but only if:
>    - Explicitly negotiated (not just click-through acceptance)
>    - Do not limit liability for gross negligence (dolo) or personal injury
>    - Are proportionate to the risk

### 4.2 🟡 Ley 24.240 Applicability to B2B SaaS

**The Nuance:** CampoTech claims to be B2B. However:
- End-users include **technicians** who interact with the mobile app
- End-users include **customers** of the service companies (who receive WhatsApp messages, view invoices)
- **Consorcio** and **Particular** customer types are essentially consumers

Under Argentine jurisprudence, the definition of "consumidor" (Art. 1° Ley 24.240, modified by Ley 26.361) is **broad**: anyone who "acquires or uses goods or services as final destination." An organization admin using CampoTech as a management tool IS a consumer of the software.

> The `/arrepentimiento` page already acknowledges this reality by implementing the "Botón de Arrepentimiento" per Art. 34 Ley 24.240.

---

### 4.3 🔴 Consumer Defense — Ventanilla Federal & Legal Domicile (Ley 26.993 + Decreto 55/2025)

**Your Associate's Question:**

> *"If a user complains, they can summon you to a COPREC hearing. Since you are likely operating remotely (perhaps even from Canada/Gatineau), you need to know: Must you have a legal domicile in Buenos Aires just to receive these legal notifications? If you don't, you might be declared in default automatically."*

**Critical Update (February 2025):** The COPREC was **dissolved** effective February 3, 2025, by **Decreto 55/2025**. The Registro Nacional de Conciliadores and the COPREC financing fund were also eliminated. Pending cases were transferred to the Secretaría de Industria y Comercio.

**However, this does NOT eliminate the risk. It changes the venue:**

#### Current Consumer Complaint Channels (Post-COPREC, 2025+)

| Channel | Scope | Implication for CampoTech |
|---------|-------|--------------------------|
| **Ventanilla Única Federal** | National — receives complaints from all provinces, distributes to local jurisdiction | Consumer can file from ANY province; CampoTech must respond |
| **Secretaría de Industria y Comercio** (Ministerio de Economía) | National-level consumer complaints under Ley 24.240 | National jurisdiction applies |
| **OMIC** (Oficina Municipal de Información al Consumidor) | Municipal — each city has one | Consumer files locally; CampoTech may need to appear in that municipality |
| **Dirección Provincial de Defensa del Consumidor** | Provincial | Each province CampoTech operates in |
| **CABA: SCRC + DGDPC** | City of Buenos Aires — Servicio de Conciliación (judicial) + Dirección General de Defensa y Protección al Consumidor (administrative) | If any CABA-based clients/users |

#### The Legal Domicile Problem:

**Under Argentine law (Art. 36 Ley 24.240, modified by Ley 26.993 Art. 52):**

> *"En las causas iniciadas por el usuario o consumidor, será competente [...] el de la jurisdicción del domicilio real del consumidor."*

This means:
1. A consumer in Córdoba can sue CampoTech in Córdoba
2. A consumer in Rosario can sue in Rosario
3. A consumer in Jujuy can sue in Jujuy
4. **Any clause in TOS selecting a specific jurisdiction is VOID** (Art. 36 Ley 24.240)

**The Notification Trap:**

If CampoTech **does not have a legal domicile (domicilio legal) in Argentina**, or if its domicile is incorrect:
1. Consumer complaints / administrative summons cannot be delivered
2. After failed delivery, the authority issues notification **por edictos** (publication in the Boletín Oficial)
3. CampoTech, unaware, fails to respond
4. The authority declares CampoTech **en rebeldía** (in default)
5. Default = automatic adverse judgment — fines, sanctions, damages awarded to consumer WITHOUT CampoTech having been heard

**This is especially dangerous if CampoTech's legal entity or operators are outside Argentina (e.g., Canada).**

#### What CampoTech Must Do:

| Requirement | Status | Action |
|-------------|--------|--------|
| **Legal domicile in Argentina** (domicilio legal constituido) | ❓ Unknown | Verify and register |
| **Registered agent for service of process** or legal representative | ❓ Unknown | Appoint if operating from abroad |
| **Monitoring of Ventanilla Única Federal complaints** | ❌ Not implemented | Set up monitoring |
| **Response process within legal deadlines** | ❌ Not implemented | Build internal workflow |
| **Jurisdictional presence in key provinces** | ❌ Not established | Consider appointing provincial legal representatives |

**Post-COPREC Change:**
Unlike COPREC (which was free for consumers but relatively structured), the Ventanilla Federal and provincial channels may now require legal representation, which could **reduce** frivolous claims but **increase** the seriousness of those that proceed.

> **VERDICT:** The dissolution of COPREC does NOT eliminate CampoTech's exposure — it fragments it across more venues. CampoTech needs a **legal domicile in Argentina** (preferably Buenos Aires, where most tech companies incorporate) and should **appoint a representative** who can receive and respond to consumer complaints from ANY province. Operating from abroad without a legal domicile is an invitation for default judgments.

---

## 5. Data Sovereignty

### 5.1 🔴 International Data Transfer (Ley 25.326, Art. 12)

**Current Architecture:**
- Database: Supabase (us-east-1, USA)
- AI Processing: OpenAI (USA)
- Email: Resend (USA)
- Hosting: Vercel (USA)

**The Law:**

Art. 12 Ley 25.326 **prohibits** transfer of personal data to countries that do NOT provide "adequate levels of protection." The AAIP maintains a list of adequate countries.

**THE UNITED STATES IS NOT ON THE LIST.**

The list of countries with adequate protection includes: EU/EEA member states, UK, Switzerland, Guernsey, Jersey, Isle of Man, Faroe Islands, Canada (private sector only), Andorra, New Zealand, Uruguay, Israel (automated data only).

> 🚨 **The United States is conspicuously absent from this list.**

**Exceptions that CampoTech relies on:**

| Exception | Legal Basis | Current Implementation |
|-----------|-------------|----------------------|
| **Explicit consent of data subject** | Art. 12(a) Ley 25.326 | ✅ Implemented: "Entiendo y acepto que mis datos personales serán alojados en servidores fuera de Argentina (EE.UU.) conforme a la Ley 25.326" |
| **Standard contractual clauses** | Res. AAIP 198/2023 | ❌ NOT IMPLEMENTED |
| **Prior AAIP authorization** | Art. 12(b) Ley 25.326 | ❌ NOT OBTAINED |

**Risk Assessment:**
- Consent-only is the **weakest** legal basis for transfer
- Consent can be **withdrawn at any time** — what happens to already-transferred data?
- The AAIP's updated standard contractual clauses (Res. 198/2023) provide a stronger legal basis but require execution with each data processor (Supabase, OpenAI, Vercel, Resend)
- A pending agreement between Argentina and the US for "adequate protection" status could change this, but is NOT yet in effect

> **VERDICT:** CampoTech's current approach (consent-only) is fragile. A single client withdrawing consent would create an impossible situation regarding already-processed data. Should implement standard contractual clauses AND consider AAIP authorization.

---

### 5.2 🟡 Are Gas Installation Safety Certificates Subject to Data Localization?

**The Short Answer:** There is **NO explicit data localization requirement** for gas safety certificates under current Argentine law.

However:

1. **ENARGAS Normative (NAGs):** ENARGAS establishes technical norms (NAG-200, NAG-201, etc.) for gas installations. These norms require that **original certificates** be maintained by the licensed gasista and the distributing company (e.g., MetroGAS, Gasnor). ENARGAS does not regulate where *digital copies* are stored.

2. **Provincial Registries:** Matrícula registrations (which CampoTech verifies via automated scraping — `ENARGAS`, `CACAAV`, `ERSEP`, `Gasnor`) are public records maintained by provincial entities. CampoTech stores verification status, not the original certificates.

3. **Sector-Specific Considerations:**
   - If CampoTech stores **copies** of gas safety certificates (Certificados de Aptitud de Instalaciones), these are regulated documents under ENARGAS Resolution 2700
   - The distributing company is legally responsible for maintaining original records
   - Hosting *copies* in the US is not explicitly prohibited, but could create evidential challenges if needed in Argentine proceedings

4. **Critical Infrastructure Argument:** Under **Res. 580/2011** (Programa Nacional de Infraestructuras Críticas de Información), gas distribution networks are classified as critical infrastructure. However, this obligation falls on ENARGAS and the utility companies, NOT on third-party SaaS providers.

5. **DNI Photos / Biometric Data:** More concerning from a data localization perspective. Under proposed legislation and the Convenio 108+ (when in force), biometric data may face stricter localization requirements.

> **VERDICT:** No current law mandates Argentine-soil hosting for gas certificates or CampoTech data. But the regulatory trend is toward **greater data sovereignty requirements**, and CampoTech's storage of AFIP private keys outside Argentina is a practical vulnerability (even if not yet illegal).

---

### 5.3 🟡 AFIP Credentials Hosted in the United States

**Unique Risk:** CampoTech stores `afipCertificateEncrypted` and `afipPrivateKeyEncrypted` in Supabase (US). These are:
- Cryptographic keys capable of **issuing legally binding fiscal documents**
- If compromised, could enable **tax fraud** on behalf of client organizations
- Located in a jurisdiction subject to US surveillance laws (FISA, CLOUD Act)

> This is not a Ley 25.326 issue — it's a **Ley 11.683** (tax procedure) and potential **Código Penal** (criminal code, Art. 293 — forgery of public documents) issue. If a breach leads to fraudulent invoices being issued, CampoTech could face criminal exposure as an accessory.

---

## 6. Cross-Cutting Risks & Summary Matrix

### Risk Heat Map

| Risk Area | Severity | Probability | Legal Basis | Codebase Evidence | Immediate Action Required |
|-----------|----------|-------------|-------------|-------------------|--------------------------|
| **UIF / AML + RePET screening** | 🔴 Critical | High | Ley 25.246, Res. UIF 76/2019, 200/2024, **49/2024** | MP integration, payment reconciliation, chargeback handling, no RePET check | Yes — Legal opinion on "facilitador" classification + implement RePET screening |
| **Uberization lawsuits** | 🔴 Critical | High | Ley 20.744, Arts. 21-23; González v. Kadabra (2024) | UOCRA levels, labor rates, variance approval, compliance blocks, marketplace | Yes — Restructure wage suggestion feature |
| **Art. 30 LCT — Solidarity** | 🔴 Critical | High | **Ley 20.744, Art. 30** | License verification, marketplace, dispatch, pricing control, service type config | Yes — Contractual compliance requirements; marketing discipline |
| **INPI Trademark** | 🔴 Critical | **Certain** | **Ley 22.362** | Brand assets in web+mobile+marketplace; White Label feature flag | **Yes — File Classes 9, 35, 42 IMMEDIATELY** |
| **Ingresos Brutos / Convenio Multilateral** | 🔴 Critical | Certain | Convenio Multilateral (1977); RG CA 12/2025 | Multi-province client base | Yes — Register immediately |
| **SIRCREB / SIRCUPA withholdings** | 🔴 Critical | **Certain** | **SIRCREB (COMARB); SIRCUPA; RN ARBA 25/2025** | MercadoPago integration, bank accounts | Yes — Register in CM to set correct alícuota |
| **Indexation trap (TOS pricing)** | 🔴 Critical | **Certain** | **Ley 23.928 Arts. 7+10; DNU 70/2023** | Hardcoded ARS prices in checkout; TOS §5 lacks adjustment clause; `applyPriceAdjustment` is manual | **Yes — Rewrite TOS §5 with valid price revision clause** |
| **Software liability (objective)** | 🔴 Critical | Medium | CCCN Arts. 1757-1758, 1723; Ley 24.240, Art. 40 | CAE generation, fiscal monitoring, hard blocks | Yes — Review liability caps; implement SLA |
| **Impuesto de Sellos (click-wrap)** | 🟠 High | Medium | **Ley 25.506; Código Fiscal PBA/Córdoba** | Click-wrap acceptance in `/checkout` + `/terms`; "Al suscribirte aceptás los Términos" | Yes — Legal opinion on click-wrap vs firma digital distinction |
| **Profit repatriation (Cepo/MULC)** | 🟠 High | Medium | **BCRA Com. A 8226; Ley 19.359** | All revenue in ARS via MercadoPago; no USD-denominated pricing option | Yes — Structure repatriation mechanism with counsel |
| **Consumer defense / Ventanilla Federal** | 🟠 High | High | **Ley 24.240 Art. 36; Ley 26.993; Decreto 55/2025** | `/arrepentimiento` page exists; no complaint management workflow | Yes — Establish legal domicile + complaint response workflow |
| **Data transfer to USA** | 🟠 High | Medium | Ley 25.326, Art. 12; Res. AAIP 198/2023 | All data in Supabase (us-east-1) | Yes — Implement contractual clauses |
| **DNPDP registration** | 🟡 Medium | High | Ley 25.326, Art. 21 | Privacy page claims registration | Yes — Verify actual registration status |
| **Breach notification** | 🟡 Medium | Medium | Res. AAIP 47/2018; Convenio 108+ (Ley 27.699) | No IRP in codebase | Yes — Implement IRP workflow |
| **Registry No Llame** | 🟡 Medium | Medium | Ley 26.951 | Outbound WhatsApp/SMS queues | Yes — Add No Llame check |
| **Gas cert data localization** | 🟢 Low | Low | No current mandate | Stores verification status, not originals | No — Monitor legislative changes |

---

### Specific Legal Citations Referenced

| Citation | Full Name | Relevance |
|----------|-----------|-----------|
| **Ley 20.744** | Ley de Contrato de Trabajo | Employment relationship determination |
| **Ley 20.744, Art. 30** | Responsabilidad solidaria por subcontratación | **"Nuclear Option" — joint liability for client orgs' labor debts** |
| **Ley 22.362** | **Ley de Marcas y Designaciones** | **Trademark registration — "first to file" system** |
| **Ley 24.240** | Ley de Defensa del Consumidor | Consumer protection, "Botón de Arrepentimiento," provider liability |
| **Ley 24.240, Art. 36** | Competencia judicial — domicilio del consumidor | **Consumer can sue in ANY province** |
| **Ley 25.246** | Ley de Prevención de Lavado de Activos y Financiamiento del Terrorismo | AML obligations |
| **Ley 25.326** | Ley de Protección de Datos Personales | Data protection, international transfer, ARCO rights |
| **Ley 25.506** | Ley de Firma Digital | Digital evidence validity |
| **Ley 26.361** | Modificatoria Ley 24.240 | Broadened "consumidor" definition |
| **Ley 26.951** | Ley del Registro Nacional No Llame | Commercial messaging restrictions |
| **Ley 26.993** | **Servicio de Conciliación Previa en Relaciones de Consumo (COPREC)** | **Consumer conciliation — dissolved by Decreto 55/2025** |
| **Ley 27.555** | Ley de Teletrabajo | Remote work regulation, relevant to teleworking allegations |
| **Ley 27.699** | Ratificación Convenio 108+ | Future breach notification obligation |
| **Ley 11.683** | Ley de Procedimiento Tributario | AFIP procedures, 10-year retention |
| **CCCN Arts. 1757-1758** | Responsabilidad por riesgo de la cosa | Objective software liability |
| **CCCN Art. 1723** | Obligación de resultado | SaaS performance obligations |
| **CCCN Art. 1743** | Nulidad de cláusulas que limitan daño a la persona | Unwaivable personal injury liability |
| **Res. UIF 49/2024** | **Screening obligatorio contra RePET** | **Must screen clients against terrorism/criminal registry** |
| **Res. UIF 76/2019** | Sujetos obligados — sector medios de pago | PSP/Facilitador classification |
| **Res. UIF 200/2024** | Extensión obligaciones a PSP | Expanded AML scope |
| **Res. AAIP 47/2018** | Recomendación notificación brechas | Best-practice breach notification |
| **Res. AAIP 126/2024** | Régimen sancionatorio unificado | Updated penalty framework |
| **Res. AAIP 198/2023** | Cláusulas contractuales tipo transfer. internacional | Standard contractual clauses |
| **RG AFIP 4290/2018** | Facturación electrónica | Electronic invoicing obligations |
| **RN ARBA 25/2025** | Retenciones IIBB billeteras digitales (PBA) | IIBB withholding on digital payments |
| **RG CA 12/2025** | Actualización NAES (Convenio Multilateral) | New digital activity codes (eff. Jan 2026) |
| **Res. 580/2011** | Programa Nac. Infraestructuras Críticas | Cybersecurity framework |
| **CCT 76/75** | Convenio Colectivo UOCRA | Construction worker wage scales |
| **Decreto 55/2025** | **Disolución del COPREC** | **Consumer conciliation service dissolved; replaced by Ventanilla Federal** |
| **Decreto 1558/2001** | Reglamentario Ley 25.326 | Data protection implementation |
| **Ley 23.928** | **Ley de Convertibilidad — Prohibición de indexación** | **Arts. 7+10: ban on automatic price indexation to inflation indices** |
| **Ley 25.561** | **Ley de Emergencia Pública** | **Maintains indexation ban post-convertibility** |
| **DNU 70/2023** | **Decreto de Necesidad y Urgencia — Desregulación** | **Flexibilized indexation for leases; strengthened contractual autonomy; modified CCCN Art. 765 (moneda de pago)** |
| **BCRA Com. "A" 8226** | **Nuevo régimen cambiario (abril 2025)** | **Flotación con bandas; permite giro dividendos ejercicios desde 01/01/2025** |
| **BCRA Com. "A" 7999** | **BOPREAL para dividendos pre-2025** | **Bond subscription mechanism for legacy dividend repatriation** |
| **BCRA Com. "A" 8336** | **Restricción cruzada MULC/CCL** | **90-day cross-restriction between official and financial dollar markets** |
| **Ley 19.359** | **Régimen Penal Cambiario** | **Criminal sanctions for unauthorized FX transactions** |
| **Ley 25.506** | **Ley de Firma Digital** | **Distinguishes "firma digital" from "firma electrónica" — key for Impuesto de Sellos analysis** |
| **SIRCREB (COMARB)** | **Sistema de Recaudación y Control de Acreditaciones Bancarias** | **Automatic IIBB withholding on bank deposits** |
| **SIRCUPA** | **Sistema de Recaudación — Cuentas de Pago** | **Automatic IIBB withholding on MercadoPago/wallets** |
| **González v. Kadabra SA (2024)** | Fallo laboral Glovo | Platform worker employment |
| **Rappi - Trib. Trabajo La Plata (2021)** | Multa confirmada | Worker misclassification penalty |

---

### Priority Actions (Pre-Launch)

#### 🔴 CRITICAL (Block Launch)
1. **INPI trademark registration** — File Classes 9, 35, 42 immediately (Ley 22.362). Existential risk if squatted.
2. **Legal opinion on UIF/AML classification** — Determine if CampoTech is a "sujeto obligado" + implement RePET screening (Res. UIF 49/2024)
3. **Convenio Multilateral registration** — File before first cross-provincial client (prevents SIRCREB/SIRCUPA over-withholding)
4. **Restructure UOCRA wage features** — Decouple wage suggestions from platform; mitigate Art. 30 solidarity risk
5. **Verify DNPDP registration** — Confirm the claim in `/privacy` is actually true
6. **Establish legal domicile in Argentina** — Required to receive consumer complaints, administrative summons, and judicial notifications
7. **Rewrite TOS § 5 (Pricing)** — Replace current vague language with a DNU 70/2023-compliant "Price Revision" clause that avoids illegal indexation while protecting against inflation erosion

#### 🟠 HIGH (Within 30 days of launch)
8. **Art. 30 LCT compliance** — Add contractual clauses requiring client organizations to prove labor/social security compliance
9. **Standard contractual clauses with US processors** — Supabase, OpenAI, Vercel, Resend per Res. 198/2023
10. **Incident response plan** — 72-hour breach notification capability
11. **No Llame registry check** — Before outbound commercial messaging
12. **Review liability caps in TOS** — Ensure compliance with CCCN Art. 1743 and Ley 24.240
13. **Consumer complaint response workflow** — Monitor Ventanilla Federal + provincial channels
14. **Profit repatriation structure** — Establish legal mechanism for dividend repatriation (MULC access requirements, BOPREAL for legacy earnings)
15. **Impuesto de Sellos opinion** — Obtain legal opinion on click-wrap exposure in target provinces

#### 🟡 MEDIUM (Within 90 days of launch)
16. **B2B vs B2C distinction** — Separate TOS for organizations vs end-users
17. **Insurance review** — Ensure E&O covers software-caused fiscal errors AND Art. 30 solidarity claims
18. **Data processing agreements** — Specific DPAs for AFIP credential storage
19. **Marketplace positioning audit** — Ensure marketing doesn't self-classify as marketplace (critical for Art. 30 defense)
20. **SIRCREB/SIRCUPA information for clients** — Add IIBB withholding warning to MercadoPago onboarding flow
21. **USD-denominated pricing option** — Consider offering USD pricing to protect margins and simplify repatriation
22. **Dynamic pricing infrastructure** — Move hardcoded ARS prices from checkout page to server-side configuration to enable periodic adjustments

---

## 7. Macro-Economic Legal Defense

> *"Argentina is unique because it combines high inflation with strict currency controls. Your document covers taxes and labor, but it misses the laws regarding Money & Value."*

This section addresses the intersection of **inflation law, currency controls, and contract enforceability** — risks that are invisible in stable economies but existential in Argentina.

---

### 7.1 🔴 The "Indexation" Prohibition (Ley 23.928 + DNU 70/2023)

**The Legal Trap:**

Argentina's Ley de Convertibilidad (Ley 23.928, 1991) — which was NEVER fully repealed — prohibits **indexación** (automatic price adjustment based on inflation indices). Specifically:

> **Art. 7:** *"En ningún caso se admitirá la actualización monetaria, indexación por precios, variación de costos o repotenciación de deudas, cualquiera fuere su causa, haya o no mora del deudor..."*
>
> **Art. 10:** *"Deróganse, con efecto a partir del 1° del mes de abril de 1991, todas las normas legales o reglamentarias que establezcan o autoricen la indexación..."*

This prohibition survived the end of convertibility via **Ley 25.561** (2002) which maintained Arts. 7 and 10 in force.

**How This Applies to CampoTech:**

CampoTech's **current TOS Section 5** reads:

> *"Los precios y planes de suscripción están disponibles en nuestra página de precios. Los pagos se procesan a través de MercadoPago de forma segura."*

This is **dangerously vague** because:
1. It says NOTHING about price adjustments
2. It doesn't explain how prices change over time
3. In an economy with **211% annual inflation (2023)**, a client signing up at ARS 55,000/month could argue they're locked at that price indefinitely

**The Checkout Page Problem:**

```typescript
// apps/web/app/checkout/page.tsx (lines 35-57)
const PLANS = {
  INICIAL:      { priceARS: 25000,  priceUSD: 25  },
  PROFESIONAL:  { priceARS: 55000,  priceUSD: 55  },
  EMPRESA:      { priceARS: 120000, priceUSD: 120 },
};
```

Prices are **hardcoded in the client-side source code**. There is no server-side pricing configuration, no price versioning, and no mechanism for periodic adjustments.

**The DNU 70/2023 Liberalization (Partial):**

President Milei's DNU 70/2023 (December 2023) flexibilized some aspects:
- **Leases:** Explicitly exempted from Art. 10 — parties can freely agree indexation indices for rents
- **Currency freedom:** Modified CCCN Art. 765 — contracts can be denominated in any currency, and the debtor must pay in the agreed currency
- **Contractual autonomy:** Broadly strengthened freedom of contract

**HOWEVER:** The DNU 70/2023 did **NOT explicitly exempt SaaS/software contracts** from the indexation ban. The lease exemption is express; SaaS contracts must rely on the **general principle of contractual autonomy**, which is a weaker legal argument.

**What a Clever Client Could Do:**

1. Sign up for CampoTech PROFESIONAL at ARS 55,000/month
2. CampoTech eventually raises price to ARS 150,000/month (reflecting inflation)
3. Client refuses to pay the new price, citing Ley 23.928 Art. 7 — "you're indexing"
4. If TOS says "prices adjust based on IPC" → the clause is likely **void** as illegal indexation
5. Client pays ARS 55,000 for years while real value erodes to nothing

**Strategies to Discuss with Counsel:**

| Strategy | How It Works | Legal Strength |
|----------|-------------|----------------|
| **"Bonificación" Model** | Set list price HIGH (e.g., ARS 300,000). Offer "promotional discount" of 80% = ARS 60,000. Periodically *remove* the discount instead of *raising* the price. | ⚠️ Moderate — courts may see through it if challenged |
| **Periodic Renegotiation** | TOS states: "Prices are set for 3-month periods. At the end of each period, CampoTech will communicate the new price. If the client disagrees, they may cancel without penalty." | ✅ **Strongest** — avoids automatic adjustment; preserves client's right to cancel |
| **USD Denomination** | Price in USD, collect ARS equivalent at spot rate. DNU 70/2023 now explicitly allows this. | ✅ Strong — solves inflation problem; may create complications for Monotributo clients |
| **IPC with Floor/Cap** | "Prices adjust semi-annually by no less than X% and no more than Y%" | ❌ Risky — still looks like indexation |
| **"Cost Recovery" Clause** | "Prices reflect the cost of hosting, development, and operations. When these costs increase materially, CampoTech reserves the right to adjust." | ⚠️ Moderate — must be linked to real costs, not indices |

**Codebase Evidence:**
- `applyPriceAdjustment()` in `src/modules/pricebook/index.ts` exists for **client pricebooks** (materials/services), but is a manual bulk adjustment, not an automatic IPC-linked mechanism
- The `POST /items/price-adjustment` endpoint takes `adjustmentPercent` — this is purely for client organizations' own pricing, not CampoTech's SaaS subscription price
- No price versioning system, no billing plan versioning, no grandfathering logic

> **VERDICT:** CampoTech's TOS Section 5 is **legally deficient** for an inflationary economy. The combination of (a) vague pricing language, (b) hardcoded ARS prices, and (c) no adjustment mechanism creates a scenario where a client could lock CampoTech into an ARS 55,000/month contract indefinitely. The **periodic renegotiation model** with explicit right-to-cancel is the safest approach. Discuss with counsel whether DNU 70/2023's contractual autonomy principle is sufficient to support a cost-recovery clause for SaaS.

---

### 7.2 🔴 The "Cepo" & Profit Repatriation (MULC / BCRA)

**The Context:**

CampoTech has Canadian founders/operators. All revenue is collected in **Argentine Pesos (ARS)** via MercadoPago. Converting ARS to CAD/USD and remitting profits to Canada requires navigating Argentina's foreign exchange control regime — the infamous **"cepo cambiario."**

**Current Regulatory Framework (as of February 2026):**

| Event | Date | Impact |
|-------|------|--------|
| **Cepo lifting** | April 14, 2025 | BCRA Com. "A" 8226 — New floating-with-bands regime; reduced restrictions on USD purchases; authorized dividend distribution to non-residents |
| **Dividends from 2025+ exercises** | April 2025+ | Companies CAN remit dividends to non-resident shareholders from fiscal exercises started on or after Jan 1, 2025, via the MULC (official market) |
| **Pre-2025 legacy dividends** | Via BOPREAL | BCRA Com. "A" 7999 — Companies must subscribe to BOPREAL bonds ("Bonos para la Reconstrucción de una Argentina Libre") for dividends from pre-2025 exercises |
| **Daily limit** | Ongoing | Amounts exceeding **USD 100,000/day** require prior BCRA authorization ("calendarización") |
| **Cross-restriction** | Com. "A" 8336 (Sep 2025) | If CampoTech accesses MULC to buy USD, it **cannot** also buy bonds settling in FX (CCL/MEP) for **90 days** |

**The Practical Problem for CampoTech:**

1. **Revenue structure:** 100% ARS via MercadoPago → transferred to local bank account (CBU)
2. **Repatriation path:** ARS in bank → Purchase USD at MULC → Wire transfer to Canada
3. **Requirements for MULC access:**
   - Argentine entity (SRL/SA) or sucursal registered
   - Audited financial statements (balance cerrado)
   - Profits from **closed and approved** fiscal exercises (not interim cash)
   - CUIT + AFIP filings current
   - Not on any BCRA debtor list
4. **Timing:** First dividend repatriation from 2025 exercises would only be possible **after the 2025 fiscal year closes** (earliest: mid-2026 for Dec-31 closings)

**Alternative: Contado con Liquidación (CCL):**

The CCL mechanism involves:
1. Buy Argentine government bonds (e.g., Bonar, Global) with ARS
2. Sell those same bonds in USD in the foreign market
3. Receive USD abroad

**Warning:** The CCL is LEGAL for most entities but comes with:
- A 90-day "parking" period (must hold bonds before selling)
- The cross-restriction with MULC (Com. "A" 8336)
- A spread between official and CCL rates (currently narrowing but historically 20-80%)
- **Ley 19.359 (Régimen Penal Cambiario)** criminalizes unauthorized FX operations — penalties include fines of 1-10x the transaction amount + imprisonment

**CampoTech-Specific Risks:**

| Risk | Description | Severity |
|------|-------------|----------|
| **Cash trap** | Revenue accumulates in ARS, loses value daily to inflation, while repatriation requires waiting for fiscal year close + audit | 🔴 |
| **UIF conflict** | If CampoTech is classified as "sujeto obligado" (Section 1.1), using CCL to move funds could trigger AML scrutiny | 🟠 |
| **Transfer pricing** | If CampoTech charges the Argentine entity royalties or management fees to extract cash, AFIP will scrutinize under transfer pricing rules (Ley 27.430, Art. 17+) | 🟠 |
| **Tax leakage** | Dividends remitted through MULC were subject to **Impuesto PAÍS** (17.5% alícuota) — verify current status post-cepo relaxation | 🟠 |

> **VERDICT:** CampoTech needs a **corporate structure consultation** with an Argentine FX/corporate attorney before launch. Key questions:
> 1. Should CampoTech operate via an Argentine SRL, a sucursal (branch), or a simple agency arrangement?
> 2. What is the optimal mechanism for profit extraction? (Dividends via MULC, management fees, royalties, or CCL?)
> 3. Should subscription prices be denominated in USD (which DNU 70/2023 now allows) to avoid the ARS depreciation trap?
> 4. What are the current Impuesto PAÍS implications post-cepo relaxation?

---

### 7.3 🟠 Stamp Tax on Digital Acceptance ("Impuesto de Sellos")

**The Provincial Trap:**

Several Argentine provinces impose **Impuesto de Sellos** (Stamp Tax) on contracts and agreements formalized within their territory. The typical rate is **0.5% to 3%** of the contract value, depending on the province.

**The Digital Question:**

When a user on CampoTech's checkout page sees:

> *"Al suscribirte aceptás los Términos de Servicio y la Política de Privacidad"*

...and clicks the payment button, does this create a **"contrato instrumentado"** (formalized contract) subject to Stamp Tax?

**The Legal Analysis Hinges on Ley 25.506 (Firma Digital):**

| Concept | Ley 25.506 Classification | Stamp Tax Implication |
|---------|---------------------------|----------------------|
| **Firma Digital** (Digital Signature) | Uses certified digital certificate from authorized CA; has full legal equivalence to handwritten signature | ✅ Creates an "instrumento privado" → **subject to Stamp Tax** |
| **Firma Electrónica** (Electronic Signature) | Any electronic means of identification that doesn't meet "firma digital" requirements (includes click-wrap, email acceptance, checkboxes) | ⚠️ **Likely NOT** an "instrumento" → stamp tax applicability is **debatable** |

**CampoTech's Acceptance Pattern:**

The checkout flow uses a **click-wrap** model:
- User clicks "Pagar" button → implicit acceptance of TOS
- No digital certificate involved
- No qualified electronic signature
- This is a **firma electrónica**, NOT a **firma digital**

**Provincial Exposure Analysis:**

| Province | Stamp Tax Rate | Risk for CampoTech | Notes |
|----------|---------------|-------------------|---------|
| **Buenos Aires** | 3% general | 🟠 Medium | PBA follows firma digital distinction; click-wrap likely NOT taxable; but aggressive enforcement possible |
| **Córdoba** | Variable; currently no general alícuota for most contracts (since 2023) | 🟢 Low | Córdoba eliminated general stamp tax for most contracts via Ley 10.854; only specific categories (real estate) remain |
| **CABA** | 0.5-1% | 🟡 Low-Medium | AGIP could argue digital contracts are taxable |
| **Misiones** | Up to 1.5% | 🟠 Medium | Aggressive enforcement of stamp tax on all contracts |
| **Tucumán** | Up to 1% | 🟠 Medium | Known for broad interpretation of "instrumento" |
| **Santa Fe** | Up to 1% | 🟡 Low-Medium | Follows general firma digital distinction |

**The Litigation Trap:**

Your consideration about suing for non-payment is accurate. In Argentine courts:
1. CampoTech sues client in Province X for unpaid subscription
2. Client's defense: "The contract was never properly stamped"
3. Judge **may** require CampoTech to pay Stamp Tax + penalties before the case can proceed
4. If years of contracts are unstamped, the back-tax + interest + fines could be **substantial**

**The "Reverse Acceptance" Strategy (to discuss with counsel):**

Instead of CampoTech presenting TOS for user acceptance (which creates an "instrument"), consider:
1. User submits a "solicitud de servicio" (service request)
2. CampoTech responds with a "carta de aceptación" (acceptance letter)
3. The service begins upon CampoTech's acceptance, not the user's click
4. This reversal may avoid creating an "instrumento" in the user's province

**Additional Mitigation:**

- **Seat-of-contract clause:** TOS Section 10 currently states *"Cualquier disputa será resuelta por los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires."* If the contract is formed in CABA, Stamp Tax would follow CABA rules (lower rates, more lenient on digital)
- **However:** This clause is likely **void** for consumer claims (per Section 4.3 above — Ley 24.240 Art. 36 gives jurisdiction to the consumer's domicile)
- For **B2B contracts**, the CABA jurisdiction clause IS enforceable

> **VERDICT:** The click-wrap acceptance pattern (firma electrónica, not firma digital) should NOT trigger Stamp Tax under current case law in most provinces. However, provinces like Misiones and Tucumán have aggressive interpretations. CampoTech should: (1) obtain a tax opinion for each target province, (2) consider the "reverse acceptance" strategy, and (3) ensure that TOS Section 10's CABA jurisdiction clause is effective for B2B relationships (it won't help with consumer claims).

---

*Document Version: 3.0 — Updated with macro-economic legal defense section*  
*Analysis based on codebase as of February 12, 2026*  
*All cited laws accessible at [infoleg.gob.ar](https://www.infoleg.gob.ar)*  
*This document is NOT legal advice. Engage qualified Argentine counsel.*
