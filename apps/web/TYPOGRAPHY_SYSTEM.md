# CampoTech Typography & Icon System

> **Design Language Reference for Consistent UI**
>
> All typography and icon sizing classes are defined in `styles/globals.css`.
> Use these semantic classes instead of ad-hoc Tailwind utilities.

---

## 📝 Typography Classes

### Page Structure

| Class | Use Case | Tailwind Equivalent |
|-------|----------|---------------------|
| `.page-title` | Main heading at top of each page | `text-2xl font-bold text-gray-900 tracking-tight` |
| `.page-subtitle` | Optional description under page title | `text-sm text-muted-foreground mt-1` |
| `.section-title` | Major sections within a page | `text-lg font-semibold text-gray-900` |
| `.section-subtitle` | Description under section titles | `text-sm text-gray-500 mt-0.5` |

**Example:**
```tsx
<div className="mb-6">
  <h1 className="page-title">Equipo</h1>
  <p className="page-subtitle">Gestioná tu equipo de trabajo</p>
</div>

<div className="mt-8">
  <h2 className="section-title">Gestión de Disponibilidad</h2>
  <p className="section-subtitle">Configura horarios base y marca excepciones</p>
</div>
```

---

### Modals & Dialogs

| Class | Use Case | Tailwind Equivalent |
|-------|----------|---------------------|
| `.modal-title` | Title in modal headers | `text-lg font-semibold text-gray-900` |

**Example:**
```tsx
<div className="flex items-center justify-between border-b p-4">
  <h2 className="modal-title">Nuevo miembro</h2>
  <button onClick={onClose}>
    <X className="icon-md text-gray-400" />
  </button>
</div>
```

---

### Cards

| Class | Use Case | Tailwind Equivalent |
|-------|----------|---------------------|
| `.card-title` | Main card heading (existing) | `text-2xl font-semibold leading-none tracking-tight` |
| `.card-section-title` | Section headers inside cards | `text-base font-semibold text-gray-900` |
| `.card-description` | Description text in cards (existing) | `text-sm text-muted-foreground` |

---

### Statistics & Metrics

| Class | Use Case | Tailwind Equivalent |
|-------|----------|---------------------|
| `.stat-value` | Large numbers in stat cards | `text-2xl font-bold text-gray-900` |
| `.stat-value-sm` | Smaller stat numbers | `text-xl font-bold text-gray-900` |
| `.stat-label` | Label under stat values | `text-xs text-gray-500 font-medium` |

**Example:**
```tsx
<div className="text-center">
  <p className="stat-value">24</p>
  <p className="stat-label">Trabajos Hoy</p>
</div>

{/* For colored stats, override the color */}
<p className="stat-value text-green-600">95%</p>
<p className="stat-value text-red-600">3</p>
```

---

### Forms

| Class | Use Case | Tailwind Equivalent |
|-------|----------|---------------------|
| `.form-label` | Labels for form fields | `block text-sm font-medium text-gray-700 mb-1` |
| `.form-hint` | Help text under form fields | `text-xs text-gray-500 mt-1` |
| `.form-error` | Error messages for form fields | `text-xs text-red-600 mt-1` |

**Example:**
```tsx
<div>
  <label className="form-label">Email *</label>
  <input className="input" type="email" />
  <p className="form-hint">Se enviará una notificación al empleado</p>
  {error && <p className="form-error">{error}</p>}
</div>
```

---

### Tables

| Class | Use Case | Tailwind Equivalent |
|-------|----------|---------------------|
| `.table-header` | Table column headers | `text-xs font-medium text-gray-500 uppercase tracking-wider` |
| `.table-cell` | Regular table cell text | `text-sm text-gray-900` |
| `.table-cell-muted` | Secondary/muted cell text | `text-sm text-gray-500` |

---

### Empty States

| Class | Use Case | Tailwind Equivalent |
|-------|----------|---------------------|
| `.empty-title` | Empty state heading | `text-lg font-semibold text-gray-900` |
| `.empty-description` | Empty state description | `text-sm text-gray-500 mt-1` |

**Example:**
```tsx
<div className="text-center py-12">
  <Inbox className="icon-hero text-gray-400 mx-auto" />
  <h3 className="empty-title mt-4">No hay mensajes</h3>
  <p className="empty-description">Los mensajes aparecerán aquí</p>
</div>
```

---

### Badges & Chips

| Class | Use Case | Tailwind Equivalent |
|-------|----------|---------------------|
| `.badge-text` | Text inside badges/chips | `text-xs font-medium` |

---

## 🎯 Icon Size Classes

Use these semantic classes for consistent icon sizing across the app:

| Class | Size | Use Case |
|-------|------|----------|
| `.icon-xs` | 12px (h-3 w-3) | Inline with small text, badges |
| `.icon-sm` | 16px (h-4 w-4) | Buttons, form fields, list items |
| `.icon-md` | 20px (h-5 w-5) | Default size, navigation, cards |
| `.icon-lg` | 24px (h-6 w-6) | Prominent UI elements, small empty states |
| `.icon-xl` | 32px (h-8 w-8) | Feature icons, medium empty states |
| `.icon-2xl` | 40px (h-10 w-10) | Hero sections, onboarding |
| `.icon-hero` | 48px (h-12 w-12) | Splash screens, major empty states |

**Example:**
```tsx
{/* Button with icon */}
<button className="btn-primary">
  <Plus className="icon-sm mr-2" />
  Agregar
</button>

{/* Navigation item */}
<a className="flex items-center gap-3">
  <Home className="icon-md" />
  <span>Inicio</span>
</a>

{/* Empty state */}
<div className="text-center">
  <FileX className="icon-hero text-gray-300 mx-auto" />
  <p className="empty-title mt-4">No hay archivos</p>
</div>
```

---

## 🔄 Migration Guide

When refactoring existing pages, replace ad-hoc classes with semantic classes:

### Page Titles
```diff
- <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
+ <h1 className="page-title">Equipo</h1>
```

### Section Headers
```diff
- <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles</h2>
+ <h2 className="section-title mb-4">Detalles</h2>
```

### Modal Titles
```diff
- <h2 className="text-lg font-semibold text-gray-900">Nuevo miembro</h2>
+ <h2 className="modal-title">Nuevo miembro</h2>
```

### Stats
```diff
- <p className="text-2xl font-bold text-gray-900">{count}</p>
- <p className="text-xs text-gray-500">Total</p>
+ <p className="stat-value">{count}</p>
+ <p className="stat-label">Total</p>
```

### Form Labels
```diff
- <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
+ <label className="form-label">Email *</label>
```

### Icons
```diff
- <Plus className="h-4 w-4" />
+ <Plus className="icon-sm" />

- <Home className="h-5 w-5" />
+ <Home className="icon-md" />
```

---

## 📐 Design Principles

1. **Hierarchy**: Page Title > Section Title > Card Section Title > Body Text
2. **Consistency**: Same element type = same typography class
3. **Readability**: Base font size is 17px for optimal reading
4. **Semantic**: Class names describe purpose, not appearance

---

## 🎨 Color Overrides

Typography classes default to `text-gray-900`. Override when needed:

```tsx
{/* Success stat */}
<p className="stat-value text-green-600">95%</p>

{/* Warning stat */}
<p className="stat-value text-orange-500">3</p>

{/* Error stat */}
<p className="stat-value text-red-600">12</p>

{/* Teal branded stat */}
<p className="stat-value text-teal-600">{count}</p>
```

---

## ✅ Checklist for New Pages

When creating a new page, ensure you use:

- [ ] `.page-title` for the main heading
- [ ] `.page-subtitle` if there's a description
- [ ] `.section-title` for major sections
- [ ] `.modal-title` for any modals
- [ ] `.form-label` for form field labels
- [ ] `.stat-value` + `.stat-label` for stat cards
- [ ] Semantic icon classes (`.icon-sm`, `.icon-md`, etc.)
