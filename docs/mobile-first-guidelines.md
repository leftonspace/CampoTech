# Mobile-First Development Guidelines

**Phase 9.10: Mobile-First Architecture**
**Last Updated:** 2024-12-09

## Core Principle

> A plumber starting their business with only a smartphone must be able to run their entire operation from the CampoTech mobile app. No laptop required.

## Market Reality: Argentine SMBs

```
Reality of Argentine tradespeople:

  👷 Juan wants to start a plumbing business

  What he has:
  ✅ Smartphone (probably Android)
  ✅ WhatsApp
  ✅ Tools and skills
  ❌ Laptop
  ❌ Office
  ❌ IT knowledge

  CampoTech must work 100% on his phone
  or we lose this customer to competitors
```

**Statistics:**
- 85%+ of Argentine SMB owners manage business primarily from phone
- Many tradespeople have never owned a laptop
- Field service = always on the move
- Phone is the office, cash register, and communication hub

## Design Principles

### 1. Mobile-First, Not Mobile-Also

**Wrong approach:**
```
1. Design for web dashboard
2. Scale down for mobile
3. Cut features due to screen size
```

**Correct approach:**
```
1. Design for mobile first
2. Scale up for web (add enhanced features)
3. Every feature must work on mobile
```

### 2. One-Hand Operation

Design for one-handed use. Users are often:
- On a ladder
- Holding tools
- In a vehicle
- Walking on site

**Guidelines:**
- Primary actions at bottom of screen (thumb zone)
- Large touch targets (minimum 44x44 points)
- Swipe gestures for common actions
- Avoid precise tapping requirements

### 3. Offline-First Architecture

**Assumption:** User will be offline 30%+ of the time

**Requirements:**
- All read operations work offline
- Critical write operations queue for sync
- Clear offline indicators
- Conflict resolution for concurrent edits
- Graceful degradation, not failure

### 4. Voice-First for Data Entry

Typing on mobile is slow. Voice input should be available for:
- Job descriptions
- Notes
- Customer names
- Addresses

**Implementation:**
```typescript
// Use system speech-to-text
import { Speech } from 'expo-speech';

// Voice button on all text inputs > 50 chars expected
<VoiceInput
  onTranscript={(text) => setDescription(text)}
  language="es-AR"
/>
```

### 5. Camera-First Documentation

The phone camera is the primary documentation tool:
- Before/after job photos
- Customer signatures
- Receipts and invoices
- Problem documentation

**Guidelines:**
- One-tap photo capture
- Auto-upload when online
- Compressed for mobile data
- Offline storage with sync

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold Start | < 4 seconds | Time to interactive |
| RAM Usage | < 150 MB | Average during use |
| App Size | < 50 MB | Download size |
| First Paint | < 2 seconds | Visible content |
| Touch Response | < 100 ms | Action feedback |
| Offline Sync | < 5 seconds | Queue processing |

## Technical Implementation

### State Management

Use WatermelonDB for offline-first data:

```typescript
// All data goes through local database first
import { database } from './watermelon/database';

// Sync happens in background
const sync = new SyncService();
sync.startBackgroundSync();
```

### API Design for Mobile

```typescript
// Bad: Multiple round trips
const customer = await api.getCustomer(id);
const jobs = await api.getCustomerJobs(id);
const invoices = await api.getCustomerInvoices(id);

// Good: Single request with includes
const customer = await api.getCustomer(id, {
  include: ['jobs', 'invoices', 'lastContact'],
});
```

### Network Optimization

```typescript
// Use delta sync, not full refresh
const changes = await api.sync({
  lastSyncAt: lastSync,
  tables: ['jobs', 'customers'],
});

// Compress requests
const response = await api.post('/sync', data, {
  headers: { 'Accept-Encoding': 'gzip' },
});
```

### Battery Optimization

```typescript
// Batch operations
const pendingOps = await queue.getPending();
if (pendingOps.length >= 5 || timeSinceLastSync > 60000) {
  await sync.process(pendingOps);
}

// Reduce location updates when stationary
if (speed < 1) {
  locationInterval = 60000; // 1 minute
} else {
  locationInterval = 10000; // 10 seconds
}
```

## UI/UX Guidelines

### Navigation

```
Bottom Tab Navigation (5 max):
├── Hoy (Today's jobs)
├── Trabajos (All jobs)
├── Clientes (Customers)
├── Facturas (Invoices)
└── Perfil (Profile/Settings)
```

### Touch Targets

```typescript
// Minimum touch target size
const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    padding: 12,
  },
});
```

### Loading States

```typescript
// Always show skeleton loaders, never blank screens
<View>
  {loading ? (
    <JobCardSkeleton />
  ) : (
    <JobCard job={job} />
  )}
</View>
```

### Error Handling

```typescript
// User-friendly errors in Spanish
const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Sin conexión. Guardado para sincronizar.',
  SYNC_FAILED: 'Error sincronizando. Reintentando...',
  VALIDATION_ERROR: 'Por favor completá todos los campos.',
};
```

## Argentine Localization

### Language

- All UI in Spanish (Argentina)
- Use "vos" form, not "tú"
- Currency: ARS with $ symbol
- Date format: DD/MM/YYYY
- Time format: 24h (14:30, not 2:30 PM)

### Phone Numbers

```typescript
// Always display Argentine format
formatPhone('+5491155551234') // → 11 5555-1234

// Accept multiple input formats
normalizePhone('11 5555 1234')  // → +5491155551234
normalizePhone('011-5555-1234') // → +5491155551234
normalizePhone('5491155551234') // → +5491155551234
```

### CUIT Validation

```typescript
// Validate Argentine tax ID
validateCUIT('20-12345678-9') // Returns validation result
formatCUIT('20123456789')    // → 20-12345678-9
```

## Accessibility

### Minimum Requirements

- Font scaling support (up to 200%)
- High contrast mode support
- Screen reader labels (Spanish)
- Haptic feedback for actions
- Error messages visible without color only

### Implementation

```typescript
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Llamar al cliente"
  accessibilityHint="Abre la app de teléfono"
  accessibilityRole="button"
  onPress={handleCall}
>
  <PhoneIcon />
</TouchableOpacity>
```

## Testing Requirements

### Device Coverage

Test on:
- Low-end Android (Motorola E series)
- Mid-range Android (Samsung A series)
- iPhone SE (smallest current iPhone)
- iPhone 12+ (modern iOS)

### Scenarios

1. **Offline mode**: Airplane mode for 10+ minutes
2. **Slow network**: 3G simulation
3. **Background**: App backgrounded for 1+ hour
4. **Low battery**: Battery saver mode
5. **Interruptions**: Incoming calls during operations

### Performance Profiling

```bash
# Android
npx react-native run-android --variant=release
adb shell dumpsys meminfo <package>

# iOS
npx react-native run-ios --configuration Release
# Use Instruments for memory profiling
```

## Feature Development Workflow

1. **Design mobile first**: Wireframe for phone screen
2. **Define offline behavior**: What works without network?
3. **Implement mobile**: React Native with Expo
4. **Add web enhancements**: Additional features for larger screens
5. **Test on low-end devices**: Ensure performance targets met
6. **Update parity checklist**: Document implementation status

## Code Organization

```
apps/mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Auth flow
│   ├── (tabs)/            # Main tab screens
│   └── _layout.tsx        # Root layout
├── components/            # Shared components
│   ├── forms/            # Form inputs
│   ├── job/              # Job-specific
│   ├── customer/         # Customer-specific
│   └── offline/          # Offline indicators
├── lib/                  # Utilities
│   ├── api/              # API client
│   ├── auth/             # Auth context
│   ├── hooks/            # Custom hooks
│   └── sync/             # Sync service
├── watermelon/           # Offline database
│   ├── models/           # Data models
│   └── schema.ts         # Schema definition
└── constants/            # App constants
```

## Review Checklist

Before merging any mobile feature:

- [ ] Works offline with proper feedback
- [ ] Syncs correctly when online
- [ ] Touch targets >= 44 points
- [ ] Loading states implemented
- [ ] Error handling in Spanish
- [ ] Tested on low-end Android
- [ ] RAM < 150MB during feature use
- [ ] Feature documented in parity checklist
- [ ] Voice input for text fields (where applicable)
- [ ] One-hand operation possible
