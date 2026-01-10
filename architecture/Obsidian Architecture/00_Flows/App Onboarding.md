---
tags:
  - flow
  - onboarding
  - ux
status: 🟡 Conceptual
type: User Experience
---

# 🎓 App Onboarding & Education

> [!TIP] **Goal**
> "Show, don't just tell." Users learn by doing. We use interactive walkthroughs to teach workflows.

## 🧭 The "Interactive Guide" System
*A "How-to" center accessible via a Floating Action Button or Top Menu.*

### 📂 Categories
1.  **Jobs & Work Orders:** "How to create a job", "How to assign a technician".
2.  **Clients:** "Import contacts", "Verify client CUIT".
3.  **Finance:** "Check monthly income", "Export invoice".

### 🖱️ Interaction Model (Driver.js / Joyride)
Upon selecting a guide:
1.  **Spotlight:** The screen dims, highlighting the relevant button.
2.  **Arrow & Tooltip:** "Click here to add a new Job."
3.  **Step-by-Step:** The guide moves *with* the user as they navigate pages.

### 🤖 "Smart Context" (LangGraph Idea)
*Future Implementation:*
- If a user is stuck on a form for > 20s, a pop-up asks: *"Need help filling this?"*
- **Contextual Sidebar:** Shows workflows relevant to the *current page* (e.g., on Jobs list, show "Job Filters" guide).

## 📸 Mockup Idea
- **Top Right:** "Subscribe" Button (Primary CTA).
- **Bottom Right:** "?" Bubble (Help Center).
- **Overlay:** Card with "Welcome! Let's set up your first job."
