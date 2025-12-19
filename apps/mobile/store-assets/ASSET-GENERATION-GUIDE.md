# CampoTech App Asset Generation Guide

## Quick Reference

This guide helps you create all required assets for App Store and Google Play submissions.

---

## 1. App Icon

### Design Guidelines
- **Symbol**: Wrench + location pin combination, or stylized "CT" monogram
- **Background**: Solid green (#16a34a)
- **Foreground**: White icon/symbol
- **Style**: Clean, modern, recognizable at small sizes

### Files to Create

#### iOS App Icon
| Size | Filename | Usage |
|------|----------|-------|
| 1024x1024 | `icon-1024.png` | App Store |
| 180x180 | `icon-180.png` | iPhone (60pt @3x) |
| 120x120 | `icon-120.png` | iPhone (60pt @2x) |
| 87x87 | `icon-87.png` | iPhone Spotlight (29pt @3x) |
| 80x80 | `icon-80.png` | iPad Spotlight (40pt @2x) |
| 60x60 | `icon-60.png` | iPhone Notification (20pt @3x) |

**Note**: iOS icons should NOT have rounded corners - the system adds them.

#### Android Adaptive Icon
```
assets/
├── adaptive-icon.png      (432x432, transparent, foreground layer)
├── adaptive-icon-bg.png   (432x432, solid #16a34a, background layer)
└── icon.png               (1024x1024, full icon for legacy)
```

### Color Codes
```
Primary Green: #16a34a (RGB: 22, 163, 74)
Secondary Green: #059669 (RGB: 5, 150, 105)
White: #ffffff
Dark Text: #111827
```

---

## 2. Splash Screen

### Specifications
- **Size**: 1284x2778 (iPhone 14 Pro Max)
- **Background**: #16a34a (brand green)
- **Logo**: White CampoTech logo, centered
- **Format**: PNG

### File
```
assets/
└── splash.png (1284x2778)
```

---

## 3. Screenshots

### Required Dimensions

#### iOS Screenshots
| Device | Size | Required |
|--------|------|----------|
| iPhone 6.7" | 1290 x 2796 | Yes (14 Pro Max) |
| iPhone 6.5" | 1284 x 2778 | Yes (13 Pro Max) |
| iPhone 5.5" | 1242 x 2208 | Yes (8 Plus) |
| iPad 12.9" | 2048 x 2732 | Optional |

#### Android Screenshots
| Device | Size | Required |
|--------|------|----------|
| Phone | 1080 x 1920 (min) | Yes |
| 7" Tablet | 1200 x 1920 | Optional |
| 10" Tablet | 1600 x 2560 | Optional |

### Screenshot Content (8 recommended)

1. **hero-today.png** - Today's Jobs screen
   - Caption: "Tu día organizado"
   - Show: Job list with status colors

2. **hero-job-detail.png** - Job Detail screen
   - Caption: "Todo el detalle en un lugar"
   - Show: Job with photos, customer info, status

3. **hero-map.png** - Live Map
   - Caption: "Seguimiento en tiempo real"
   - Show: Map with technician markers

4. **hero-calendar.png** - Week Calendar
   - Caption: "Planificá tu semana"
   - Show: Week view with jobs

5. **hero-team.png** - Team Management
   - Caption: "Tu equipo, bajo control"
   - Show: Team list with metrics

6. **hero-analytics.png** - Analytics Dashboard
   - Caption: "Datos para crecer"
   - Show: Charts and KPIs

7. **hero-offline.png** - Offline Mode
   - Caption: "Funciona sin internet"
   - Show: Offline banner with pending sync

8. **hero-voice.png** - Voice Reports
   - Caption: "Reportes con tu voz"
   - Show: Voice recording interface

### Screenshot Template
```
┌─────────────────────────────┐
│      Status Bar (dark)       │
├─────────────────────────────┤
│                             │
│     [Device Frame]          │
│                             │
│     ┌─────────────────┐     │
│     │                 │     │
│     │   App Screen    │     │
│     │   Content       │     │
│     │                 │     │
│     └─────────────────┘     │
│                             │
├─────────────────────────────┤
│    📱 Caption Text          │
│    Brief description        │
└─────────────────────────────┘
```

---

## 4. Google Play Feature Graphic

### Specifications
- **Size**: 1024 x 500 pixels
- **Format**: PNG or JPEG
- **Content**:
  - CampoTech logo (left side)
  - Tagline: "Organizá tu negocio de servicios"
  - Phone mockup showing app (right side)
  - Green gradient background

### Example Layout
```
┌────────────────────────────────────────────────────────┐
│  🔧                                    ┌──────────┐   │
│  CampoTech                             │          │   │
│                                        │  Phone   │   │
│  Organizá tu negocio                   │  mockup  │   │
│  de servicios como                     │          │   │
│  un profesional                        └──────────┘   │
│                                                        │
│  ⬇️ DESCARGAR GRATIS                                   │
└────────────────────────────────────────────────────────┘
```

---

## 5. Notification Icon (Android)

### Specifications
- **Size**: 96 x 96 pixels
- **Format**: PNG with transparency
- **Design**: White silhouette only (system colors it)
- **Content**: Simple wrench or "C" icon

### File
```
assets/
└── notification-icon.png (96x96, white on transparent)
```

---

## 6. Promo Video (Optional)

### Specifications
- **Duration**: 15-30 seconds
- **Format**: MP4 or upload to YouTube
- **Resolution**: 1080p minimum
- **Content**:
  1. Show logo (2 sec)
  2. Demo main features (20 sec)
  3. Call to action (5 sec)

---

## Tools Recommended

### Free Options
- **Figma**: Design icons and screenshots
- **Canva**: Quick graphics and feature graphic
- **App Mockup**: Device frame generators
- **Remove.bg**: Background removal

### Professional Options
- **Adobe Illustrator**: Vector icon design
- **Sketch**: iOS-focused design
- **Photoshop**: Photo editing and compositing

---

## File Organization

```
store-assets/
├── icons/
│   ├── ios/
│   │   ├── icon-1024.png
│   │   ├── icon-180.png
│   │   └── ...
│   └── android/
│       ├── icon-512.png
│       ├── adaptive-icon.png
│       └── adaptive-icon-bg.png
├── screenshots/
│   ├── ios/
│   │   ├── 6.7/
│   │   ├── 6.5/
│   │   └── 5.5/
│   └── android/
│       ├── phone/
│       ├── 7-tablet/
│       └── 10-tablet/
├── feature-graphic/
│   └── feature-graphic-1024x500.png
├── splash/
│   └── splash.png
└── promo/
    └── promo-video.mp4
```

---

## Checklist Before Submission

### Icons
- [ ] All sizes generated
- [ ] No transparency on iOS icons
- [ ] Adaptive icon layers correct for Android
- [ ] Looks good at small sizes (29pt)

### Screenshots
- [ ] All required sizes
- [ ] Spanish text visible and readable
- [ ] No placeholder content
- [ ] Status bar time is 9:41 (Apple standard)
- [ ] Full battery icon shown
- [ ] WiFi/signal at full

### Feature Graphic
- [ ] Correct dimensions (1024x500)
- [ ] Text is readable
- [ ] Brand colors consistent
- [ ] No text in bottom 15%

### General
- [ ] File sizes under limits
- [ ] PNG format for transparency
- [ ] JPEG for photos (smaller size)
- [ ] Consistent visual style across all assets
