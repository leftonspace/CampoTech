---
description: Argentine-specific rules - AFIP, CUIT validation, localization, and regional conventions
---

# 🇦🇷 Argentine-Specific Rules

## Language & Localization

### UI Text Language
- **User-facing text:** Spanish (Argentine)
- **Code/comments:** English
- **Variable names:** English (camelCase)
- **Database columns:** English (snake_case)

### Spanish Conventions
```typescript
// ✅ Correct - Argentine Spanish
"Técnico en camino"
"Presupuesto aprobado"
"Factura emitida"

// ❌ Wrong - Mexican/Spanish Spain
"Técnico en ruta"      // Use "en camino"
"Cotización aprobada"  // Use "presupuesto"
"Factura expedida"     // Use "emitida"
```

### Common Terms
| English | Argentine Spanish |
|---------|-------------------|
| Technician | Técnico |
| Quote/Estimate | Presupuesto |
| Invoice | Factura |
| Customer | Cliente |
| On the way | En camino |
| Completed | Completado |
| Pending | Pendiente |
| Scheduled | Agendado |

## CUIT Validation

### CUIT Format
```
XX-XXXXXXXX-X
│  │        └── Verification digit (0-9)
│  └─────────── 8-digit document number
└───────────── Type prefix (20, 23, 24, 27, 30, 33, 34)
```

### Valid Type Prefixes
| Prefix | Entity Type |
|--------|-------------|
| 20 | Male individual |
| 23 | Individual (either gender) |
| 24 | Male individual |
| 27 | Female individual |
| 30 | Company (SA, SRL) |
| 33 | Company |
| 34 | Company |

### CUIT Validation Function
```typescript
export function validateCuit(cuit: string): boolean {
  // Remove dashes and spaces
  const clean = cuit.replace(/[-\s]/g, '');
  
  // Must be 11 digits
  if (!/^\d{11}$/.test(clean)) return false;
  
  // Valid prefixes
  const prefix = clean.substring(0, 2);
  const validPrefixes = ['20', '23', '24', '27', '30', '33', '34'];
  if (!validPrefixes.includes(prefix)) return false;
  
  // Verification digit calculation (Mod 11)
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i]) * weights[i];
  }
  const remainder = sum % 11;
  const verifier = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  
  return parseInt(clean[10]) === verifier;
}
```

### CUIT Formatting
```typescript
export function formatCuit(cuit: string): string {
  const clean = cuit.replace(/\D/g, '');
  if (clean.length !== 11) return cuit;
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}
```

## Phone Numbers

### Argentine Phone Format
```
+54 9 11 XXXX-XXXX  (Mobile Buenos Aires)
+54 11 XXXX-XXXX    (Landline Buenos Aires)
+54 9 351 XXX-XXXX  (Mobile Córdoba)
```

### Phone Validation
```typescript
export function validateArgentinePhone(phone: string): boolean {
  // Remove all non-digits
  const clean = phone.replace(/\D/g, '');
  
  // Should be 10-13 digits (with or without country code)
  if (clean.length < 10 || clean.length > 13) return false;
  
  // If starts with 54, must be valid Argentine number
  if (clean.startsWith('54')) {
    return clean.length >= 12;
  }
  
  return true;
}
```

### Phone Formatting for WhatsApp
```typescript
export function formatPhoneForWhatsApp(phone: string): string {
  let clean = phone.replace(/\D/g, '');
  
  // Add country code if missing
  if (!clean.startsWith('54')) {
    clean = '54' + clean;
  }
  
  // Mobile numbers need 9 after country code
  if (clean.length === 12 && !clean.startsWith('549')) {
    clean = '549' + clean.slice(2);
  }
  
  return clean;
}
```

## AFIP Integration

### Invoice Types
| Type | Name | Use Case |
|------|------|----------|
| A | Factura A | B2B (Responsable Inscripto to RI) |
| B | Factura B | B2C (RI to Consumidor Final) |
| C | Factura C | Monotributo to any |

### Determining Invoice Type
```typescript
export function getInvoiceType(
  sellerCondition: 'responsable_inscripto' | 'monotributo',
  buyerCondition: 'responsable_inscripto' | 'consumidor_final' | 'monotributo' | 'exento'
): 'A' | 'B' | 'C' {
  if (sellerCondition === 'monotributo') {
    return 'C';
  }
  
  if (buyerCondition === 'responsable_inscripto') {
    return 'A';
  }
  
  return 'B';
}
```

### CAE (Electronic Authorization Code)
- **CAE:** 14-digit authorization code from AFIP
- **CAE Expiry:** Usually 10 days from issue
- **Required for:** All electronic invoices

### AFIP Error Handling
```typescript
// Common AFIP error codes
const AFIP_ERRORS = {
  10016: 'Invalid CUIT',
  10017: 'Punto de venta not authorized',
  10048: 'Invalid date',
  10063: 'CAE already requested for this invoice',
  602: 'CUIT not registered as supplier',
};
```

## Currency & Pricing

### Currency Format
```typescript
export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);
}
// Output: $ 1.234,56
```

### Tax Rates
```typescript
const TAX_RATES = {
  IVA_GENERAL: 0.21,      // 21% - Most services
  IVA_REDUCED: 0.105,     // 10.5% - Some products
  IVA_EXEMPT: 0,          // Exempt items
};
```

## Addresses

### Address Format
```
Calle [Nombre] [Número], [Piso/Depto]
[Barrio/Localidad], [Provincia]
[Código Postal]
```

### Province Codes
```typescript
const PROVINCES = {
  'CABA': 'Ciudad Autónoma de Buenos Aires',
  'GBA': 'Gran Buenos Aires',
  'Buenos Aires': 'Provincia de Buenos Aires',
  'Córdoba': 'Córdoba',
  'Santa Fe': 'Santa Fe',
  // ... etc
};
```

## Date & Time

### Timezone
Always use Argentina timezone (ART = UTC-3):
```typescript
const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

function formatDateAR(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    timeZone: ARGENTINA_TZ,
  });
}
```

### Date Format
- **Display:** DD/MM/YYYY (e.g., 03/01/2026)
- **Database:** ISO 8601 (e.g., 2026-01-03T00:00:00Z)

## Testing with Argentine Data

### Valid Test CUITs
```typescript
// These are example valid CUIT formats (verify digit is correct)
const TEST_CUITS = [
  '20-12345678-9',  // Male individual
  '27-12345678-4',  // Female individual  
  '30-12345678-5',  // Company
];
```

### Test Phone Numbers
```typescript
const TEST_PHONES = [
  '+54 9 11 1234-5678',  // Mobile BA
  '+54 11 4567-8901',    // Landline BA
  '+54 9 351 123-4567',  // Mobile Córdoba
];
```
