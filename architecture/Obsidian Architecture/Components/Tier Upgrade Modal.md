---
tags:
  - component
  - modal
  - upgrade
status: 🟢 Functional
type: Component
path: apps/web/components/upgrade/tier-upgrade-modal.tsx
---

# 🔒 Tier Upgrade Modal

> [!INFO] **Purpose**
> Displayed when users attempt to access features locked behind a higher subscription tier. Encourages upgrade while explaining the value.

---

## 📸 Preview
![[upgrade-modal.png]]

---

## 🧩 Modal Structure

### Header
| Element | Content |
|:---|:---|
| Icon | Lock icon or feature icon |
| Title | "Desbloquea {feature_name}" |

### Body
| Section | Content |
|:---|:---|
| Message | "Esta función está disponible en el plan {tier_name}" |
| Feature Benefits | List of what the feature enables |
| Current Plan | Shows user's current tier |
| Required Plan | Shows minimum tier needed |

### Actions
| Button | Style | Action |
|:---|:---|:---|
| Ver Planes | Primary | Navigate to billing |
| Cerrar | Secondary | Dismiss modal |

---

## 🔄 Trigger Conditions

### From Sidebar Navigation
```typescript
if (item.tierLocked) {
  handleLockedClick(item.name, item.feature);
}
```

### From Feature Button
```typescript
if (!hasFeatureAccess(tier, 'WHATSAPP_AI')) {
  openUpgradeModal('WhatsApp AI');
}
```

---

## 🎨 Modal Design

```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-amber-500" />
        Desbloquea {moduleName}
      </DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Esta función está disponible en planes superiores.
      </p>
      
      {/* Feature benefits */}
      <ul className="space-y-2">
        {benefits.map(benefit => (
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            {benefit}
          </li>
        ))}
      </ul>
      
      {/* Plan comparison */}
      <div className="flex justify-between p-3 bg-muted rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Tu plan actual</p>
          <p className="font-medium">{currentTier}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Necesitás</p>
          <p className="font-medium text-primary">{requiredTier}</p>
        </div>
      </div>
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cerrar</Button>
      <Button onClick={goToBilling}>Ver Planes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 📊 Feature-Tier Mapping

| Feature | Minimum Tier |
|:---|:---|
| `WHATSAPP_AI` | PROFESIONAL |
| `ADVANCED_REPORTS` | PROFESIONAL |
| `MULTI_LOCATION` | EMPRESA |
| `API_ACCESS` | EMPRESA |
| `FLEET_MANAGEMENT` | PROFESIONAL |

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| X Button | `Click` | Close modal |
| Cerrar | `Click` | Close modal |
| Ver Planes | `Click` | Navigate → [[Billing Settings]] |
| Overlay | `Click` | Close modal |
| Escape Key | `Press` | Close modal |

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/components/upgrade/tier-upgrade-modal.tsx`
- **Feature Flags:** `@/lib/config/feature-flags.ts`
- **Tier Limits:** `@/lib/config/tier-limits.ts`

### Props Interface
```typescript
interface TierUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: FeatureId;
  moduleName?: string;
  currentTier: SubscriptionTier;
}
```

### State in Parent
```typescript
const [upgradeModal, setUpgradeModal] = useState<{
  isOpen: boolean;
  moduleName?: string;
  feature?: FeatureId;
}>({ isOpen: false });
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Layout]]
- **Triggered By:**
  - [[Sidebar Navigation]] (locked items)
  - [[Feature Buttons]] (gated actions)
- **Leads To:**
  - [[Billing Settings]]
  - [[Subscription Flow]]

---

## 📝 Notes

- [ ] TODO: Add pricing preview in modal
- [ ] TODO: Trial extension option
- [ ] TODO: Feature demo video
- [ ] Consider: A/B test different messaging
- [ ] Consider: Discount code input field
