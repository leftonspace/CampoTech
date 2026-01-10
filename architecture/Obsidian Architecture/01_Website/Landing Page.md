---
tags:
  - page
  - structure
  - active
status: 🟢 Optimized
path: apps/web/app/page.tsx
type: Landing Page
---

# 🏠 Landing Page (Main Entry)

> [!INFO] **Objective**
> The **Command Center** of the user acquisition flow. It must convert visitors into trials by establishing immediate **Trust** (via CUIT verification) and answering the question *"Will this organizing my chaos?"*

---

## 📸 Visual Overview
![[landing-hero.png]]

### 🧠 Brainstorming & Notes
- [ ] *Idea: Should we add a video background? (Currently gradient)*
- [ ] *Feedback: "Verificación CUIT" badge color needs to be more visible?*
- [ ] **Critical:** The "Start Free" button must link directly to the simplified signup flow.
- [ ] **Suggestion:** Change Hero CTA from "Empezar ahora" to "Prueba Gratis 21 Días" to match the actual offer.

---

## 🔗 Connections & Interaction Map

| Component Area | User Action | Destination / Effect |
| :--- | :--- | :--- |
| **Hero CTA** | `Click` | [[Signup Flow]] *(Apps/Web/App/(Auth)/Signup)* |
| **Login Link** | `Click` | [[Login Page]] |
| **Feature Cards** | `Hover` | Scales up card (Micro-interaction) |
| **Feature Cards** | `Click` | Opens Detail Modal (Same Page) |
| **Footer: Legal** | `Click` | [[Legal Compliance]] |
| **Footer: Product** | `Click` | [[Product Strategy]] (Integrations/API) |
| **Footer: Company** | `Click` | [[Company Pages]] (Blog/About) |

### 🧩 Detailed Sections

#### 1. The Hook (Hero)
**File:** `HeroSection` in `page.tsx`
- **Key Element:** "Verificación CUIT integrada" badge.
- **Why:** Legitimacy in the Argentinian market.

#### 2. Cost & Value (Pricing)
![[landing-pricing.png]]
- **Tiers:** Linked to `subscription-matrix.ts` logic.
- **Trial Strategy:** "14 days free" is hardcoded in `HeroSection` text.
- **⚠️ GAP:** All buttons currently link to generic Signup. Need to pass `?plan=xxx` to autofill checkout later.

#### 3. The "Aha!" Moment (WhatsApp Demo)
![[landing-demo.png]]
- **Function:** Demonstrates the AI answering while the user sleeps.
- **Code:** `AIFeatureSection` handles the carousel logic.

---

## 🛠️ Technical Context
- **Main Component:** `d:\projects\CampoTech\apps\web\app\page.tsx`
- **Header:** `d:\projects\CampoTech\apps\web\components\layout\PublicHeader.tsx`
- **State Management:** Uses local state (`useState`) for Modals and Carousel. Only client-side interactive.

---
*To use this successfully: Open the **Sitemap.canvas** file to see how this page flows to others.*
