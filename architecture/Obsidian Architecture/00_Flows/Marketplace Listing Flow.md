---
tags:
  - flow
  - marketplace
status: 🟢 Functional
type: User Flow
updated: 2026-02-13
---

# 🏪 Marketplace Listing Flow

> [!SUCCESS] **Goal**
> How an organization goes from signup to being discoverable in the CampoTech marketplace.

---

## 🔄 Progressive Trust Path

```
STEP 1: SIGNUP
  │  Phone verification → Organization created
  │  BusinessPublicProfile auto-created
  │
  ▼
STEP 2: ONBOARDING
  │  Complete onboarding checklist
  │  Add company name, logo, description
  │  Configure service categories
  │
  ▼
STEP 3: VERIFICATION
  │  CUIT validation (Mod-11) → 🏛️ badge
  │  Insurance (ART) upload → 🛡️ badge
  │  Background check → 📋 badge
  │  Trade license → 🎓 badge
  │
  ▼
STEP 4: MARKETPLACE PROFILE
  │  Auto-populated from org data
  │  Editable via /dashboard/marketplace/profile
  │  Service area defined (radius/province/polygon)
  │
  ▼
STEP 5: GO LIVE
  │  marketplaceVisible = true (auto for verified)
  │  canReceiveJobs = true
  │  At least 1 technician online (GPS)
  │
  ▼
STEP 6: DISCOVERABLE
     Appears in marketplace search results
     Public profile at /perfil/[slug]
     Analytics tracking begins
```

---

## ✅ Minimum Requirements for Marketplace Visibility

| Requirement | Mandatory? | Automated? |
|:---|:---:|:---:|
| Valid organization account | ✅ | ✅ |
| BusinessPublicProfile created | ✅ | ✅ (auto) |
| Profile is active | ✅ | ✅ (default) |
| CUIT verified | ✅ | Manual |
| At least 1 online member | ✅ | Via mobile GPS |
| `marketplaceVisible = true` | ✅ | Auto for verified |
| `canReceiveJobs = true` | ✅ | Manual toggle |

---

## 🔗 Connections

- **Parent:** [[Marketplace Overview]]
- **Related:** [[Verification Flow]], [[Business Profile Service]], [[Marketplace Smart Matching]]
- **Admin:** [[Growth Engine]] (for scraped profiles path)

---

*From anonymous tradesperson to verified, discoverable professional — in as few steps as possible.*
