---
tags:
  - reference
  - documentation
  - structure
status: 🟢 Active
type: Reference Document
---

# 📐 Page Structure Reference

> [!INFO] **Purpose**
> This document serves as a comprehensive reference for understanding and reproducing the structure of pages in CampoTech. It defines standard patterns, layouts, and conventions used across all pages.

---

## 🏗️ Standard Page Anatomy

Every page in CampoTech follows a consistent structure:

```
┌────────────────────────────────────────────────────────────────┐
│  HEADER (16px height, sticky)                                   │
│  ├─ Mobile Menu Toggle (lg:hidden)                              │
│  ├─ Search Bar (hidden md:block)                                │
│  └─ Right Section: Notifications | User Menu                    │
├────────────────────────────────────────────────────────────────┤
│  TRIAL BANNER (conditional - shows during trial period)         │
├────────────────────────────────────────────────────────────────┤
│  ACCESS BANNER (conditional - verification/subscription warns)  │
├────────────────────────────────────────────────────────────────┤
│  MAIN CONTENT (flex-1, p-6)                                     │
│  └─ Page-specific content                                       │
└────────────────────────────────────────────────────────────────┘
```

---

## 📁 Frontmatter Template

All documentation pages use this YAML frontmatter:

```yaml
---
tags:
  - page | flow | component | reference
  - [category: app | public | settings | auth]
  - [priority: core | feature | optional]
status: 🟢 Functional | 🟡 In Progress | 🔴 Missing | ⚪ Planned
type: Page | User Flow | Component | Reference
path: apps/web/app/[path]/page.tsx  # Optional: file path
---
```

### Status Legend:
| Emoji | Meaning | Description |
|:---:|:---|:---|
| 🟢 | Functional | Fully implemented and working |
| 🟡 | In Progress | Partially implemented or needs polish |
| 🔴 | Missing/Blocked | Not implemented or blocked by dependencies |
| ⚪ | Planned | Designed but not started |

---

## 🧩 Standard Sections

### 1. Page Header (Required)
```markdown
# [Emoji] Page Title

> [!TYPE] **Goal/Purpose**
> Brief description of what this page does and why it exists.
```

**Callout Types:**
- `[!INFO]` - General information
- `[!TIP]` - User guidance
- `[!SUCCESS]` - Objectives/Goals
- `[!WARNING]` - Critical requirements
- `[!NOTE]` - Contextual notes

### 2. Visual Preview (Recommended)
```markdown
## 📸 Preview
![[page-name-preview.png]]
```

### 3. Key Components/Widgets (For Pages)
```markdown
## 🧩 Key Widgets
1. **[Widget Name]:** Description
   - Subcomponent details
   - User actions
```

### 4. Interaction Map (For Flows)
```markdown
## 🔗 Interaction Map

| Element | Action | Result |
|:---|:---|:---|
| [Button Name] | `Click` | [[Target Page]] |
```

### 5. Technical Context (Required)
```markdown
## 🛠️ Technical Context
- **Component Path:** `apps/web/app/[path]/page.tsx`
- **API Endpoints:** `POST /api/[endpoint]`
- **State Management:** [Description]
```

### 6. Connections (Required)
```markdown
## 🔗 Connections
- **Parent:** [[Parent Page]]
- **Children:** [[Child 1]], [[Child 2]]
- **Related:** [[Related Feature]]
```

---

## 📱 Responsive Breakpoints

CampoTech uses these Tailwind breakpoints:

| Breakpoint | Min Width | Usage |
|:---|:---|:---|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop (sidebar toggle) |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Extra large |

---

## 🎨 UI Component Patterns

### Cards
```tsx
<div className="card">
  <div className="card-header">
    <h2 className="card-title">Title</h2>
  </div>
  <div className="card-content">
    {/* Content */}
  </div>
</div>
```

### Stat Cards
```tsx
<StatCard
  title="Label"
  value={number | string}
  icon={LucideIcon}
  color="teal | coral | pink | green"
  trend={string | null}
  loading={boolean}
/>
```

### Quick Action Buttons
```tsx
<QuickActionButton
  href="/path"
  icon={LucideIcon}
  label="Label"
  primary={boolean}
/>
```

---

## 🔐 Access Control Patterns

### Role-Based Access
Modules are filtered by user role:
- **OWNER:** Full access to all modules
- **ADMIN:** Administrative access
- **TECHNICIAN:** Limited to own work orders

### Tier-Based Access
Premium features show lock icons and trigger upgrade modals:
```tsx
if (item.tierLocked) {
  return <button onClick={() => handleLockedClick(item.name, item.feature)}>
    <Lock className="w-4 h-4" />
  </button>
}
```

---

## 📂 File Organization

```
architecture/Obsidian Architecture/
├── Pages/
│   ├── [Public Pages]     # Landing, Login, Signup
│   ├── [Dashboard Pages]  # Core app pages
│   ├── [Settings Pages]   # Configuration pages
│   └── [Feature Flows]    # Multi-step processes
├── Components/
│   └── [Shared Components]
├── assets/
│   └── [Screenshots & Mockups]
└── Sitemap.canvas
```

---

## 🔄 Page Lifecycle

```
User Request → Route Match → Layout Render → Page Render
                    ↓              ↓
              Auth Check    Banner Checks
                    ↓              ↓
              Redirect?    Show Warnings?
```

---

## ✅ Documentation Checklist

When creating a new page document:

- [ ] Proper frontmatter with tags and status
- [ ] Clear page title with appropriate emoji
- [ ] Purpose callout explaining the goal
- [ ] Visual preview (if applicable)
- [ ] Key widgets/components listed
- [ ] Interaction map for clickable elements
- [ ] Technical context with file paths
- [ ] Connections to parent/child pages
- [ ] Notes on current gaps or TODOs

---

*This reference is the source of truth for page documentation standards.*
