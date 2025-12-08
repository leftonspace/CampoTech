# CampoTech: Argentina MVP Roadmap v5
## 12 Core Workflows | Minimal Onboarding | Reliability-First Architecture

---

# EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Core Workflows** | 12 |
| **MVP Timeline** | 14 weeks |
| **Architecture** | 8 modules + Infrastructure Layer |
| **Onboarding** | 2 fields only (CUIT + Company Name) |
| **Default Mode** | Simple (Advanced unlockable) |
| **Reliability Target** | Zero user-facing errors from API failures |

---

# DOCUMENT CHANGELOG

| Version | Changes |
|---------|---------|
| v1-v3 | Feature-focused (too complex) |
| v4 | Modular + realistic timeline |
| **v5** | + Minimal onboarding, fallback systems, observability, panic modes, simple-first UX |

---

# DESIGN PRINCIPLES (NON-NEGOTIABLE)

## Principle 1: One Shot Culture

> "Argentine users don't give second chances. The app must work perfectly the first time."

**Rules:**
- First task completion < 2 minutes
- Zero visible errors in first session
- If something fails, handle it invisibly

## Principle 2: Aggressive Minimal Onboarding

> "If you accidentally reintroduce a setup wizard, Argentine users WILL drop."

**Rules:**
- **Maximum 2 required fields at signup:** CUIT + Company Name
- Everything else deferred to first use
- No blocking wizards, ever

## Principle 3: Reliability Over Sophistication

> "When something fails in Argentina, you need to know immediately before the user complains."

**Rules:**
- Every external API has a fallback
- Every background job is monitored
- Panic modes auto-activate on failure
- Silent failures are bugs

## Principle 4: Simple by Default

> "Argentine tradespeople don't like complexity. They want what works."

**Rules:**
- Simple mode is default (never ask)
- Advanced features hidden until requested
- Maximum 3 choices per screen
- One primary action per context

---

# ONBOARDING FLOW (MINIMAL)

## What We Ask at Signup

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIGNUP SCREEN                            │
│                                                                 │
│   📱 Tu número de celular                                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  +54 9 11 1234-5678                                     │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│                    [ Continuar ]                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       OTP VERIFICATION                          │
│                                                                 │
│   Ingresá el código que te enviamos                            │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ]                   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     COMPANY INFO (2 fields only)                │
│                                                                 │
│   CUIT de tu empresa                                           │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  20-12345678-9                                          │  │
│   └─────────────────────────────────────────────────────────┘  │
│   ✓ Auto-completamos el nombre desde AFIP                      │
│                                                                 │
│   Nombre de tu empresa                                          │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Servicios Técnicos González                            │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│                    [ Empezar a usar ]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     🎉 USER IS IN THE APP
                     (No more setup screens)
```

## What We Defer (Just-in-Time Setup)

| Feature | When We Ask | Trigger |
|---------|-------------|---------|
| AFIP Certificate | First invoice attempt | "Para facturar, necesitamos tu certificado AFIP" |
| IVA Condition | First invoice attempt | Auto-detected from CUIT or asked inline |
| Mercado Pago | First payment link | "Conectá Mercado Pago para cobrar" |
| WhatsApp Business | First message send | "Vinculá WhatsApp para enviar mensajes" |
| Price Book | First line item add | "Agregá tus servicios para facturar más rápido" |
| Team Members | First assignment to other | "Invitá a tu equipo" |
| Bank Info | First transfer payment | "Agregá tu CBU para transferencias" |

## Just-in-Time Setup Implementation

```typescript
// services/JustInTimeSetup.ts
export class JustInTimeSetup {
  /**
   * Check if feature is ready, if not show inline setup
   * NEVER block the user with a full-screen wizard
   */
  async checkAndPrompt(feature: SetupFeature, context: SetupContext): Promise<SetupResult> {
    const org = await getOrganization(context.orgId);
    const check = this.featureChecks[feature];
    
    if (check.isReady(org)) {
      return { ready: true };
    }

    // Return inline prompt, not a blocking wizard
    return {
      ready: false,
      prompt: {
        type: 'inline', // NEVER 'fullscreen' or 'wizard'
        title: check.promptTitle,
        message: check.promptMessage,
        action: check.setupAction,
        // Always offer a way to continue without setup
        skip: check.skipOption
      }
    };
  }

  private featureChecks: Record<SetupFeature, FeatureCheck> = {
    afip_invoice: {
      isReady: (org) => !!org.afip_cert && !!org.afip_punto_venta,
      promptTitle: 'Configurar facturación',
      promptMessage: 'Para facturar necesitás cargar tu certificado AFIP',
      setupAction: 'afip_setup',
      skipOption: {
        label: 'Crear borrador sin facturar',
        action: 'create_draft'
      }
    },
    
    mercado_pago: {
      isReady: (org) => !!org.mp_access_token,
      promptTitle: 'Conectar Mercado Pago',
      promptMessage: 'Vinculá tu cuenta para generar links de pago',
      setupAction: 'mp_oauth',
      skipOption: {
        label: 'Cobrar en efectivo',
        action: 'cash_payment'
      }
    },
    
    whatsapp: {
      isReady: (org) => !!org.whatsapp_phone_id && org.whatsapp_verified,
      promptTitle: 'Conectar WhatsApp',
      promptMessage: 'Vinculá tu número para enviar mensajes',
      setupAction: 'whatsapp_setup',
      skipOption: {
        label: 'Copiar mensaje',
        action: 'copy_to_clipboard'
      }
    },
    
    price_book: {
      isReady: (org) => true, // Always ready, just empty
      promptTitle: null, // No prompt, just empty state
      skipOption: {
        label: 'Escribir manualmente',
        action: 'manual_entry'
      }
    }
  };
}
```

## Inline Setup Components (Never Fullscreen)

```typescript
// components/setup/InlineAfipSetup.tsx
export function InlineAfipSetup({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<'upload' | 'verify'>('upload');

  // This appears INLINE in the invoice creation flow
  // NOT as a separate screen or wizard
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileKey className="h-4 w-4" />
          Configurar facturación AFIP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {step === 'upload' && (
          <>
            <p className="text-sm text-muted-foreground">
              Subí tu certificado digital (.crt y .key)
            </p>
            <CertificateUploader onUpload={handleUpload} />
          </>
        )}
        
        {step === 'verify' && (
          <>
            <p className="text-sm text-muted-foreground">
              Verificando con AFIP...
            </p>
            <Spinner />
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Crear borrador por ahora
        </Button>
        <Button size="sm" onClick={handleContinue}>
          Continuar
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

# SIMPLE MODE UI (DEFAULT)

## Mobile Home Screen (Simple Mode)

```
┌─────────────────────────────────────────┐
│  Buenos días, Juan 👋                   │
│  Hoy tenés 3 trabajos                   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔵 9:00 - María García          │   │
│  │    Pérdida en baño              │   │
│  │    Palermo                       │   │
│  │                                  │   │
│  │    [ Estoy en camino → ]        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ⚪ 14:00 - Carlos López         │   │
│  │    Aire no enfría               │   │
│  │    Belgrano                      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ⚪ 17:00 - Ana Rodríguez        │   │
│  │    Instalación termotanque      │   │
│  │    Núñez                         │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  [ 🏠 Hoy ]  [ 💬 Mensajes ]  [ ⚙️ ]   │
└─────────────────────────────────────────┘
```

## Job Flow (Simple Mode - One Action Per Screen)

```
Job Status: SCHEDULED
┌─────────────────────────────────────────┐
│  María García                           │
│  📍 Honduras 4500, Palermo              │
│  📞 Llamar  💬 WhatsApp  🗺️ Navegar    │
├─────────────────────────────────────────┤
│  Pérdida en el baño, gotea la canilla  │
│  del lavatorio.                         │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────────────────────┐    │
│     │     ESTOY EN CAMINO  →      │    │
│     └─────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

                    │
                    │ One tap
                    ▼

Job Status: EN_CAMINO
┌─────────────────────────────────────────┐
│  ✓ Avisamos a María que estás          │
│    en camino                            │
├─────────────────────────────────────────┤
│  María García                           │
│  📍 Honduras 4500, Palermo              │
│  ETA: 15 minutos                        │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────────────────────┐    │
│     │        LLEGUÉ  →            │    │
│     └─────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

                    │
                    │ One tap
                    ▼

Job Status: WORKING
┌─────────────────────────────────────────┐
│  Trabajo en progreso                    │
│  ⏱️ 00:45:30                            │
├─────────────────────────────────────────┤
│  📷 Agregar fotos                       │
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │  +  │ │     │ │     │               │
│  └─────┘ └─────┘ └─────┘               │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────────────────────┐    │
│     │      TERMINÉ  →             │    │
│     └─────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

                    │
                    │ One tap
                    ▼

Job Status: COMPLETING
┌─────────────────────────────────────────┐
│  ¿Qué hiciste?                          │
├─────────────────────────────────────────┤
│  Servicios comunes:                     │
│  ┌─────────────────────────────────┐   │
│  │ ○ Cambio de canilla    $15,000 │   │
│  │ ○ Destape simple       $8,000  │   │
│  │ ○ Reparación general   $12,000 │   │
│  │ + Agregar otro                  │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  Firma del cliente                      │
│  ┌─────────────────────────────────┐   │
│  │          ✍️                      │   │
│  │    [Tocar para firmar]          │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────────────────────┐    │
│     │  COMPLETAR Y COBRAR  →      │    │
│     └─────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

                    │
                    │ One tap → Everything happens automatically:
                    │ • Invoice created (or draft if AFIP down)
                    │ • Payment link generated (or alternatives)
                    │ • WhatsApp sent (or queued)
                    ▼

Job Status: COMPLETED
┌─────────────────────────────────────────┐
│  ✅ Trabajo completado                  │
├─────────────────────────────────────────┤
│  Factura enviada a María               │
│  Link de pago enviado por WhatsApp     │
├─────────────────────────────────────────┤
│  Total: $15,000                         │
│  Estado: Pendiente de pago              │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────────────────────────┐    │
│     │    VER PRÓXIMO TRABAJO      │    │
│     └─────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

## Simple vs Advanced Mode

```typescript
// types/settings.ts
interface OrgSettings {
  // UI Mode
  ui_mode: 'simple' | 'advanced';
  
  // Simple mode hides these (default: all false)
  show_calendar: boolean;
  show_reports: boolean;
  show_price_book_management: boolean;
  show_automation_rules: boolean;
  show_team_management: boolean;
  
  // Auto-actions (default: all true in simple mode)
  auto_invoice_on_complete: boolean;
  auto_send_whatsapp: boolean;
  auto_create_payment_link: boolean;
}

const DEFAULT_SIMPLE_SETTINGS: OrgSettings = {
  ui_mode: 'simple',
  show_calendar: false,
  show_reports: false,
  show_price_book_management: false,
  show_automation_rules: false,
  show_team_management: false,
  auto_invoice_on_complete: true,
  auto_send_whatsapp: true,
  auto_create_payment_link: true
};

const ADVANCED_SETTINGS: OrgSettings = {
  ui_mode: 'advanced',
  show_calendar: true,
  show_reports: true,
  show_price_book_management: true,
  show_automation_rules: true,
  show_team_management: true,
  auto_invoice_on_complete: true, // Still default on
  auto_send_whatsapp: true,
  auto_create_payment_link: true
};
```

## Unlock Advanced Mode

```typescript
// components/settings/AdvancedModeToggle.tsx
export function AdvancedModeToggle() {
  const { settings, updateSettings } = useSettings();
  const [showConfirm, setShowConfirm] = useState(false);

  if (settings.ui_mode === 'advanced') {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium">Modo avanzado activado</p>
          <p className="text-sm text-muted-foreground">
            Tenés acceso a todas las funciones
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => updateSettings({ ui_mode: 'simple' })}
        >
          Volver a modo simple
        </Button>
      </div>
    );
  }

  return (
    <>
      <button
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setShowConfirm(true)}
      >
        ¿Necesitás más opciones? Activar modo avanzado
      </button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modo avanzado</DialogTitle>
            <DialogDescription>
              Vas a ver más opciones: calendario completo, reportes, 
              gestión de equipo y más. Podés volver al modo simple 
              cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              updateSettings({ ui_mode: 'advanced' });
              setShowConfirm(false);
            }}>
              Activar modo avanzado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

# FALLBACK SYSTEMS (RELIABILITY-FIRST)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER ACTIONS                                   │
│   Create Job │ Complete Job │ Send Message │ Create Payment             │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION LAYER                               │
│                                                                          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │ Health Check │  │ Rate Limiter │  │ Circuit      │                  │
│   │ (per API)    │  │ (per API)    │  │ Breaker      │                  │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│          │                 │                 │                           │
│          └─────────────────┴─────────────────┘                           │
│                            │                                             │
│                            ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    PANIC MODE CONTROLLER                         │   │
│   │                                                                  │   │
│   │   AFIP: [NORMAL] [DEGRADED] [PANIC]                             │   │
│   │   WhatsApp: [NORMAL] [DEGRADED] [PANIC]                         │   │
│   │   MercadoPago: [NORMAL] [DEGRADED] [PANIC]                      │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│    AFIP     │ │  WhatsApp   │ │ MercadoPago │ │   OpenAI    │
│   Module    │ │   Module    │ │   Module    │ │   Module    │
│             │ │             │ │             │ │             │
│ Fallback:   │ │ Fallback:   │ │ Fallback:   │ │ Fallback:   │
│ Draft mode  │ │ SMS/In-app  │ │ Cash/CBU    │ │ Manual entry│
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         QUEUE SYSTEM                                     │
│                                                                          │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│   │ AFIP Queue  │ │ WhatsApp Q  │ │ Payment Q   │ │ Voice Q     │       │
│   │ (retry CAE) │ │ (outbound)  │ │ (reconcile) │ │ (process)   │       │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                          │
│                    ┌─────────────────────────┐                          │
│                    │   DEAD LETTER QUEUE     │                          │
│                    │   (failed after 5 tries)│                          │
│                    └─────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       OBSERVABILITY LAYER                                │
│                                                                          │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│   │   Logging   │ │   Metrics   │ │   Alerts    │ │  Dashboard  │       │
│   │ (structured)│ │ (counters)  │ │ (Slack/SMS) │ │  (admin)    │       │
│   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Panic Mode Controller

```typescript
// infrastructure/panic/PanicModeController.ts

export type ServiceStatus = 'normal' | 'degraded' | 'panic';

export interface ServiceHealth {
  status: ServiceStatus;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
  panicActivatedAt?: Date;
}

export class PanicModeController {
  private health: Map<string, ServiceHealth> = new Map();
  private readonly DEGRADED_THRESHOLD = 3;  // failures
  private readonly PANIC_THRESHOLD = 5;     // failures
  private readonly RECOVERY_THRESHOLD = 3;  // successes to recover

  constructor(
    private alertService: AlertService,
    private metricsService: MetricsService
  ) {
    // Initialize all services as normal
    ['afip', 'whatsapp', 'mercadopago', 'openai'].forEach(service => {
      this.health.set(service, {
        status: 'normal',
        lastCheck: new Date(),
        consecutiveFailures: 0
      });
    });
  }

  /**
   * Record a success - may recover from panic
   */
  async recordSuccess(service: string): Promise<void> {
    const health = this.health.get(service)!;
    
    health.consecutiveFailures = 0;
    health.lastCheck = new Date();
    
    if (health.status !== 'normal') {
      // Check if we should recover
      const recentSuccesses = await this.getRecentSuccessCount(service);
      if (recentSuccesses >= this.RECOVERY_THRESHOLD) {
        await this.recover(service);
      }
    }

    this.metricsService.increment(`${service}.success`);
  }

  /**
   * Record a failure - may trigger degraded or panic
   */
  async recordFailure(service: string, error: Error): Promise<void> {
    const health = this.health.get(service)!;
    
    health.consecutiveFailures++;
    health.lastCheck = new Date();
    health.lastError = error.message;

    this.metricsService.increment(`${service}.failure`);

    if (health.consecutiveFailures >= this.PANIC_THRESHOLD && health.status !== 'panic') {
      await this.enterPanicMode(service, error);
    } else if (health.consecutiveFailures >= this.DEGRADED_THRESHOLD && health.status === 'normal') {
      await this.enterDegradedMode(service);
    }
  }

  /**
   * Enter panic mode - activate fallbacks
   */
  private async enterPanicMode(service: string, error: Error): Promise<void> {
    const health = this.health.get(service)!;
    health.status = 'panic';
    health.panicActivatedAt = new Date();

    // Alert immediately
    await this.alertService.sendCritical({
      title: `🚨 PANIC: ${service.toUpperCase()} DOWN`,
      message: `Service ${service} has entered panic mode after ${health.consecutiveFailures} consecutive failures.\n\nLast error: ${error.message}`,
      channel: 'ops-critical' // Slack channel
    });

    // Also SMS to on-call
    await this.alertService.sendSMS({
      to: process.env.ONCALL_PHONE!,
      message: `PANIC: ${service} down. Check dashboard immediately.`
    });

    // Log for audit
    console.error(`[PANIC] ${service} entered panic mode`, {
      service,
      consecutiveFailures: health.consecutiveFailures,
      error: error.message,
      stack: error.stack
    });

    this.metricsService.increment(`${service}.panic_activated`);
  }

  /**
   * Enter degraded mode - start using fallbacks
   */
  private async enterDegradedMode(service: string): Promise<void> {
    const health = this.health.get(service)!;
    health.status = 'degraded';

    await this.alertService.sendWarning({
      title: `⚠️ DEGRADED: ${service.toUpperCase()}`,
      message: `Service ${service} is experiencing issues. ${health.consecutiveFailures} consecutive failures.`,
      channel: 'ops-alerts'
    });

    this.metricsService.increment(`${service}.degraded_activated`);
  }

  /**
   * Recover from panic/degraded
   */
  private async recover(service: string): Promise<void> {
    const health = this.health.get(service)!;
    const previousStatus = health.status;
    
    health.status = 'normal';
    health.panicActivatedAt = undefined;

    await this.alertService.sendInfo({
      title: `✅ RECOVERED: ${service.toUpperCase()}`,
      message: `Service ${service} has recovered from ${previousStatus} mode.`,
      channel: 'ops-alerts'
    });

    this.metricsService.increment(`${service}.recovered`);
  }

  /**
   * Get current status for a service
   */
  getStatus(service: string): ServiceHealth {
    return this.health.get(service)!;
  }

  /**
   * Check if we should use fallback
   */
  shouldUseFallback(service: string): boolean {
    const health = this.health.get(service)!;
    return health.status === 'panic' || health.status === 'degraded';
  }
}
```

## AFIP Fallback System

```typescript
// modules/afip/services/AfipFallbackService.ts

export class AfipFallbackService {
  constructor(
    private panicController: PanicModeController,
    private draftService: DraftInvoiceService,
    private queueService: AfipQueueService,
    private metricsService: MetricsService
  ) {}

  /**
   * Create invoice with automatic fallback
   */
  async createInvoice(data: InvoiceData): Promise<InvoiceResult> {
    const afipStatus = this.panicController.getStatus('afip');

    // If in panic mode, go straight to draft
    if (afipStatus.status === 'panic') {
      return await this.createDraftInvoice(data, 'afip_panic');
    }

    // Try AFIP first
    try {
      const result = await this.attemptAfipInvoice(data);
      await this.panicController.recordSuccess('afip');
      return result;
    } catch (error) {
      await this.panicController.recordFailure('afip', error as Error);
      
      // Fallback to draft
      return await this.createDraftInvoice(data, 'afip_error');
    }
  }

  /**
   * Create draft invoice (fallback)
   */
  private async createDraftInvoice(
    data: InvoiceData, 
    reason: string
  ): Promise<InvoiceResult> {
    const draft = await this.draftService.create({
      ...data,
      status: 'draft',
      afip_status: 'pending',
      fallback_reason: reason
    });

    // Queue for background processing
    await this.queueService.enqueue(draft.id, {
      priority: data.priority || 'normal',
      maxRetries: 10,
      retryDelay: 'exponential' // 1m, 2m, 4m, 8m, 16m, 30m, 30m, 30m...
    });

    this.metricsService.increment('afip.fallback_to_draft');

    return {
      success: true,
      invoice: draft,
      status: 'draft',
      message: 'Factura creada como borrador. Se procesará automáticamente cuando AFIP esté disponible.',
      // User doesn't need to know about AFIP issues
      userFacing: {
        title: 'Factura creada ✓',
        message: 'Enviando a AFIP...',
        showSpinner: true
      }
    };
  }

  /**
   * Attempt real AFIP invoice
   */
  private async attemptAfipInvoice(data: InvoiceData): Promise<InvoiceResult> {
    // Health check first (cached for 60s)
    const health = await this.checkAfipHealth();
    if (!health.available) {
      throw new AfipUnavailableError('AFIP health check failed');
    }

    // Actual AFIP call with timeout
    const result = await Promise.race([
      this.afipService.requestCAE(data),
      this.timeout(30000) // 30 second timeout
    ]);

    return {
      success: true,
      invoice: await this.finalizeInvoice(data, result),
      status: 'issued',
      cae: result.cae
    };
  }

  /**
   * Check AFIP health (cached)
   */
  private async checkAfipHealth(): Promise<{ available: boolean }> {
    const cacheKey = 'afip_health';
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await Promise.race([
        this.afipService.feDummy(),
        this.timeout(5000)
      ]);

      const available = response.AppServer === 'OK' && 
                       response.DbServer === 'OK' && 
                       response.AuthServer === 'OK';

      await this.cache.set(cacheKey, JSON.stringify({ available }), 'EX', 60);
      return { available };
    } catch {
      await this.cache.set(cacheKey, JSON.stringify({ available: false }), 'EX', 60);
      return { available: false };
    }
  }
}
```

## WhatsApp Fallback System

```typescript
// modules/whatsapp/services/WhatsAppFallbackService.ts

export class WhatsAppFallbackService {
  constructor(
    private panicController: PanicModeController,
    private smsService: SMSService,
    private notificationService: InAppNotificationService,
    private queueService: WhatsAppQueueService
  ) {}

  /**
   * Send message with automatic fallback chain
   */
  async sendMessage(message: OutboundMessage): Promise<SendResult> {
    const waStatus = this.panicController.getStatus('whatsapp');

    // Fallback chain based on status
    if (waStatus.status === 'panic') {
      return await this.sendWithFallback(message);
    }

    // Try WhatsApp first
    try {
      // Check rate limit
      const canSend = await this.rateLimiter.checkLimit(
        `wa_${message.org_id}`,
        50,  // 50 messages
        60   // per minute
      );

      if (!canSend.allowed) {
        // Queue for later, don't fail
        return await this.queueForLater(message, 'rate_limited');
      }

      const result = await this.whatsAppService.send(message);
      await this.panicController.recordSuccess('whatsapp');
      return result;

    } catch (error) {
      await this.panicController.recordFailure('whatsapp', error as Error);
      return await this.sendWithFallback(message);
    }
  }

  /**
   * Fallback chain: SMS → In-App → Queue
   */
  private async sendWithFallback(message: OutboundMessage): Promise<SendResult> {
    // 1. Try SMS for critical messages
    if (message.priority === 'critical') {
      try {
        await this.smsService.send({
          to: message.to,
          body: this.convertToSMS(message)
        });
        
        this.metricsService.increment('whatsapp.fallback_to_sms');
        
        return {
          success: true,
          channel: 'sms',
          message: 'Enviado por SMS'
        };
      } catch (smsError) {
        console.warn('SMS fallback failed:', smsError);
      }
    }

    // 2. Create in-app notification for the business owner
    await this.notificationService.create({
      org_id: message.org_id,
      type: 'message_pending',
      title: 'Mensaje pendiente',
      body: `No pudimos enviar mensaje a ${message.to}. Se reintentará automáticamente.`,
      data: { messageId: message.id }
    });

    // 3. Queue for retry
    await this.queueService.enqueue(message, {
      maxRetries: 5,
      retryDelay: 'exponential'
    });

    this.metricsService.increment('whatsapp.fallback_to_queue');

    return {
      success: true,
      channel: 'queued',
      message: 'Mensaje en cola. Se enviará cuando WhatsApp esté disponible.'
    };
  }

  /**
   * Convert rich message to SMS (160 chars)
   */
  private convertToSMS(message: OutboundMessage): string {
    const templates: Record<string, (params: any) => string> = {
      'job_confirmed': (p) => 
        `CampoTech: Trabajo confirmado ${p.job_date} ${p.job_time}`,
      'technician_en_route': (p) => 
        `CampoTech: Técnico en camino, llega en ${p.eta} min`,
      'payment_request': (p) => 
        `CampoTech: Pagá $${p.total}: ${p.payment_link}`,
      'payment_confirmed': (p) =>
        `CampoTech: Recibimos tu pago de $${p.amount}. Gracias!`
    };

    const converter = templates[message.template];
    if (converter) {
      return converter(message.params).slice(0, 160);
    }

    return 'CampoTech: Tenés un mensaje. Abrí la app.';
  }
}
```

## Mercado Pago Fallback System

```typescript
// modules/mercadopago/services/MercadoPagoFallbackService.ts

export class MercadoPagoFallbackService {
  constructor(
    private panicController: PanicModeController,
    private reconciliationService: ReconciliationService
  ) {}

  /**
   * Create payment options with fallbacks
   */
  async createPaymentOptions(invoice: Invoice): Promise<PaymentOptions> {
    const mpStatus = this.panicController.getStatus('mercadopago');
    const options: PaymentOption[] = [];

    // 1. Try Mercado Pago (unless in panic)
    if (mpStatus.status !== 'panic') {
      try {
        const mpLink = await this.mercadoPagoService.createPreference(invoice);
        await this.panicController.recordSuccess('mercadopago');
        
        options.push({
          type: 'mercadopago',
          available: true,
          primary: true,
          link: mpLink.init_point,
          qr: await this.generateQR(mpLink.id),
          label: 'Pagar con Mercado Pago',
          sublabel: 'Hasta 12 cuotas'
        });
      } catch (error) {
        await this.panicController.recordFailure('mercadopago', error as Error);
        
        options.push({
          type: 'mercadopago',
          available: false,
          message: 'Mercado Pago no disponible temporalmente'
        });
      }
    } else {
      options.push({
        type: 'mercadopago',
        available: false,
        message: 'Mercado Pago no disponible temporalmente'
      });
    }

    // 2. Always offer cash
    options.push({
      type: 'cash',
      available: true,
      primary: !options.some(o => o.primary),
      label: 'Efectivo',
      action: 'record_cash_payment'
    });

    // 3. Always offer bank transfer
    const bankInfo = await this.getBankInfo(invoice.org_id);
    if (bankInfo) {
      options.push({
        type: 'transfer',
        available: true,
        label: 'Transferencia bancaria',
        bankInfo: {
          cbu: bankInfo.cbu,
          alias: bankInfo.alias,
          bank: bankInfo.bank,
          holder: bankInfo.holder
        }
      });
    }

    return {
      invoiceId: invoice.id,
      total: invoice.total,
      options
    };
  }

  /**
   * Manual reconciliation page (for when webhooks fail)
   */
  async getReconciliationData(orgId: string): Promise<ReconciliationData> {
    // Get invoices pending payment for > 1 hour
    const pending = await this.getPendingInvoices(orgId, { olderThan: '1 hour' });
    
    const reconciliationItems: ReconciliationItem[] = [];

    for (const invoice of pending) {
      if (!invoice.mp_preference_id) continue;

      try {
        // Query MP directly
        const mpPayments = await this.mercadoPagoService.searchPayments({
          external_reference: invoice.id
        });

        const approvedPayment = mpPayments.results.find(p => p.status === 'approved');

        if (approvedPayment) {
          reconciliationItems.push({
            invoice,
            mpPayment: approvedPayment,
            status: 'found_not_synced',
            action: 'sync'
          });
        } else {
          reconciliationItems.push({
            invoice,
            status: 'not_paid',
            action: 'remind_customer'
          });
        }
      } catch (error) {
        reconciliationItems.push({
          invoice,
          status: 'mp_error',
          error: (error as Error).message,
          action: 'manual_check'
        });
      }
    }

    return {
      items: reconciliationItems,
      lastRun: await this.getLastReconciliationTime(orgId)
    };
  }
}
```

---

# OBSERVABILITY LAYER (CRITICAL)

## Structured Logging

```typescript
// infrastructure/logging/Logger.ts

export interface LogContext {
  service: string;
  action: string;
  orgId?: string;
  userId?: string;
  jobId?: string;
  invoiceId?: string;
  duration?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export class Logger {
  private static instance: Logger;

  /**
   * Structured log entry
   */
  log(level: 'info' | 'warn' | 'error', message: string, context: LogContext): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: context.service,
      action: context.action,
      org_id: context.orgId,
      user_id: context.userId,
      job_id: context.jobId,
      invoice_id: context.invoiceId,
      duration_ms: context.duration,
      error: context.error ? {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack
      } : undefined,
      ...context.metadata
    };

    // In production, send to logging service (e.g., LogTail, Datadog)
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService(entry);
    }

    // Always log to console in structured format
    console.log(JSON.stringify(entry));
  }

  info(message: string, context: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context: LogContext): void {
    this.log('error', message, context);
  }
}

// Usage example
logger.info('Invoice created', {
  service: 'afip',
  action: 'create_invoice',
  orgId: org.id,
  invoiceId: invoice.id,
  duration: 1250,
  metadata: {
    invoice_type: 'B',
    total: 15000,
    cae: '12345678901234'
  }
});

logger.error('AFIP CAE request failed', {
  service: 'afip',
  action: 'request_cae',
  orgId: org.id,
  invoiceId: invoice.id,
  error: error,
  metadata: {
    afip_error_code: error.code,
    retry_count: 3
  }
});
```

## Metrics Service

```typescript
// infrastructure/metrics/MetricsService.ts

export class MetricsService {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment counter
   */
  increment(metric: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(metric, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    // Send to metrics service (e.g., Prometheus, Datadog)
    this.flush(metric, 'counter', value, tags);
  }

  /**
   * Set gauge value
   */
  gauge(metric: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(metric, tags);
    this.gauges.set(key, value);
    this.flush(metric, 'gauge', value, tags);
  }

  /**
   * Record histogram value (for latencies)
   */
  histogram(metric: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(metric, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    this.flush(metric, 'histogram', value, tags);
  }

  /**
   * Timer helper
   */
  startTimer(metric: string, tags?: Record<string, string>): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.histogram(metric, duration, tags);
    };
  }
}

// Key metrics to track
const METRICS = {
  // API Health
  'afip.request.duration': 'histogram',
  'afip.request.success': 'counter',
  'afip.request.failure': 'counter',
  'afip.panic_mode': 'gauge',  // 1 or 0
  
  'whatsapp.request.duration': 'histogram',
  'whatsapp.request.success': 'counter',
  'whatsapp.request.failure': 'counter',
  'whatsapp.rate_limited': 'counter',
  'whatsapp.panic_mode': 'gauge',
  
  'mercadopago.request.duration': 'histogram',
  'mercadopago.request.success': 'counter',
  'mercadopago.request.failure': 'counter',
  'mercadopago.panic_mode': 'gauge',
  
  // Queue Health
  'queue.afip.size': 'gauge',
  'queue.afip.oldest_job_age': 'gauge',
  'queue.afip.processed': 'counter',
  'queue.afip.failed': 'counter',
  
  'queue.whatsapp.size': 'gauge',
  'queue.whatsapp.processed': 'counter',
  'queue.whatsapp.failed': 'counter',
  
  // Dead Letter Queue (critical!)
  'dlq.size': 'gauge',
  'dlq.added': 'counter',
  
  // Business Metrics
  'jobs.created': 'counter',
  'jobs.completed': 'counter',
  'invoices.created': 'counter',
  'invoices.draft_fallback': 'counter',
  'payments.received': 'counter',
  'payments.amount': 'counter',
  
  // User Experience
  'onboarding.started': 'counter',
  'onboarding.completed': 'counter',
  'onboarding.dropped': 'counter',
  'first_job.time_to_complete': 'histogram'
};
```

## Alert Service

```typescript
// infrastructure/alerts/AlertService.ts

export interface Alert {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  channel?: string;
  metadata?: Record<string, any>;
}

export class AlertService {
  constructor(
    private slack: SlackClient,
    private sms: SMSService
  ) {}

  /**
   * Send info alert (Slack only)
   */
  async sendInfo(alert: Omit<Alert, 'severity'>): Promise<void> {
    await this.slack.send({
      channel: alert.channel || 'ops-info',
      text: `ℹ️ ${alert.title}`,
      blocks: this.formatBlocks({ ...alert, severity: 'info' })
    });
  }

  /**
   * Send warning alert (Slack)
   */
  async sendWarning(alert: Omit<Alert, 'severity'>): Promise<void> {
    await this.slack.send({
      channel: alert.channel || 'ops-alerts',
      text: `⚠️ ${alert.title}`,
      blocks: this.formatBlocks({ ...alert, severity: 'warning' })
    });
  }

  /**
   * Send critical alert (Slack + SMS to on-call)
   */
  async sendCritical(alert: Omit<Alert, 'severity'>): Promise<void> {
    // Slack with @channel
    await this.slack.send({
      channel: alert.channel || 'ops-critical',
      text: `🚨 <!channel> ${alert.title}`,
      blocks: this.formatBlocks({ ...alert, severity: 'critical' })
    });

    // SMS to on-call
    const oncallPhone = process.env.ONCALL_PHONE;
    if (oncallPhone) {
      await this.sms.send({
        to: oncallPhone,
        body: `CRITICAL: ${alert.title}. ${alert.message.slice(0, 100)}`
      });
    }
  }

  /**
   * Pre-defined alerts
   */
  static ALERTS = {
    AFIP_PANIC: (failures: number) => ({
      title: 'AFIP en modo pánico',
      message: `AFIP no responde después de ${failures} intentos. Modo borrador activado automáticamente.`,
      channel: 'ops-critical'
    }),
    
    WHATSAPP_PANIC: (failures: number) => ({
      title: 'WhatsApp en modo pánico',
      message: `WhatsApp no responde después de ${failures} intentos. Mensajes enviándose por SMS.`,
      channel: 'ops-critical'
    }),
    
    DLQ_GROWING: (size: number) => ({
      title: 'Dead Letter Queue creciendo',
      message: `Hay ${size} jobs fallidos en la DLQ. Requiere revisión manual.`,
      channel: 'ops-alerts'
    }),
    
    QUEUE_STUCK: (queue: string, age: number) => ({
      title: `Cola ${queue} trabada`,
      message: `El job más viejo tiene ${age} minutos. Posible problema de procesamiento.`,
      channel: 'ops-alerts'
    })
  };
}
```

## Admin Dashboard (Queue Monitoring)

```typescript
// app/(admin)/dashboard/page.tsx

export default async function AdminDashboard() {
  const health = await getSystemHealth();
  const queues = await getQueueStats();
  const alerts = await getRecentAlerts();

  return (
    <div className="space-y-6">
      {/* Service Health */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <ServiceHealthCard 
              name="AFIP"
              status={health.afip.status}
              lastCheck={health.afip.lastCheck}
              failures={health.afip.consecutiveFailures}
            />
            <ServiceHealthCard 
              name="WhatsApp"
              status={health.whatsapp.status}
              lastCheck={health.whatsapp.lastCheck}
              failures={health.whatsapp.consecutiveFailures}
            />
            <ServiceHealthCard 
              name="Mercado Pago"
              status={health.mercadopago.status}
              lastCheck={health.mercadopago.lastCheck}
              failures={health.mercadopago.consecutiveFailures}
            />
            <ServiceHealthCard 
              name="OpenAI"
              status={health.openai.status}
              lastCheck={health.openai.lastCheck}
              failures={health.openai.consecutiveFailures}
            />
          </div>
        </CardContent>
      </Card>

      {/* Queue Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Colas de Procesamiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <QueueCard 
              name="AFIP (CAE)"
              pending={queues.afip.pending}
              processing={queues.afip.processing}
              failed={queues.afip.failed}
              oldestAge={queues.afip.oldestAge}
            />
            <QueueCard 
              name="WhatsApp"
              pending={queues.whatsapp.pending}
              processing={queues.whatsapp.processing}
              failed={queues.whatsapp.failed}
              oldestAge={queues.whatsapp.oldestAge}
            />
            <QueueCard 
              name="Voice AI"
              pending={queues.voice.pending}
              processing={queues.voice.processing}
              failed={queues.voice.failed}
              oldestAge={queues.voice.oldestAge}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dead Letter Queue (Critical) */}
      {queues.dlq.size > 0 && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600">
              ⚠️ Dead Letter Queue ({queues.dlq.size} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DLQTable items={queues.dlq.items} />
            <div className="mt-4 flex gap-2">
              <Button onClick={retryAllDLQ}>
                Reintentar todos
              </Button>
              <Button variant="outline" onClick={exportDLQ}>
                Exportar para análisis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertList alerts={alerts} />
        </CardContent>
      </Card>

      {/* Manual Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliación de Pagos</CardTitle>
          <CardDescription>
            Pagos que pueden haber llegado pero no se sincronizaron
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReconciliationPanel />
        </CardContent>
      </Card>
    </div>
  );
}

// Service health card component
function ServiceHealthCard({ name, status, lastCheck, failures }: ServiceHealthProps) {
  const statusColors = {
    normal: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    panic: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    normal: '✓ Normal',
    degraded: '⚠ Degradado',
    panic: '🚨 Pánico'
  };

  return (
    <div className={`p-4 rounded-lg ${statusColors[status]}`}>
      <div className="font-semibold">{name}</div>
      <div className="text-2xl font-bold">{statusLabels[status]}</div>
      <div className="text-sm mt-2">
        Última verificación: {formatRelativeTime(lastCheck)}
      </div>
      {failures > 0 && (
        <div className="text-sm">
          Fallos consecutivos: {failures}
        </div>
      )}
    </div>
  );
}
```

---

# DATABASE SCHEMA (COMPLETE)

```sql
-- ============================================
-- MODULE 1: AUTH & ONBOARDING
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Minimal required fields (onboarding)
  name TEXT NOT NULL,
  cuit TEXT UNIQUE NOT NULL,
  
  -- Deferred setup (just-in-time)
  iva_condition TEXT, -- Set when first invoice
  
  -- AFIP (deferred to first invoice)
  afip_punto_venta INTEGER,
  afip_cert BYTEA,
  afip_key BYTEA,
  afip_cert_expiry DATE,
  afip_homologated BOOLEAN DEFAULT false,
  afip_setup_completed_at TIMESTAMPTZ,
  
  -- Mercado Pago (deferred to first payment)
  mp_access_token TEXT,
  mp_refresh_token TEXT,
  mp_user_id TEXT,
  mp_connected_at TIMESTAMPTZ,
  
  -- WhatsApp (deferred to first message)
  whatsapp_phone_id TEXT,
  whatsapp_business_id TEXT,
  whatsapp_verified BOOLEAN DEFAULT false,
  whatsapp_setup_completed_at TIMESTAMPTZ,
  
  -- Bank info (deferred to first transfer)
  bank_cbu TEXT,
  bank_alias TEXT,
  bank_name TEXT,
  bank_holder TEXT,
  
  -- Settings (simple by default)
  settings JSONB DEFAULT '{
    "ui_mode": "simple",
    "show_calendar": false,
    "show_reports": false,
    "auto_invoice_on_complete": true,
    "auto_send_whatsapp": true,
    "auto_create_payment_link": true
  }',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MODULE 2: CRM
-- ============================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  doc_type TEXT DEFAULT 'dni',
  doc_number TEXT,
  iva_condition TEXT DEFAULT 'consumidor_final',
  address TEXT,
  address_extra TEXT,
  neighborhood TEXT,
  city TEXT DEFAULT 'Buenos Aires',
  province TEXT DEFAULT 'CABA',
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  whatsapp_thread_id TEXT,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, phone)
);

-- ============================================
-- MODULE 3: JOBS
-- ============================================

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  assigned_to UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  job_type TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  photos TEXT[],
  notes TEXT,
  signature_url TEXT,
  invoice_id UUID,
  source TEXT DEFAULT 'manual',
  source_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MODULE 4: AFIP
-- ============================================

CREATE TABLE price_book (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 21.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  job_id UUID REFERENCES jobs(id),
  -- Invoice identification
  invoice_number INTEGER,
  temp_number TEXT, -- For drafts before CAE
  invoice_type TEXT NOT NULL,
  punto_venta INTEGER,
  -- AFIP authorization
  cae TEXT,
  cae_expiry DATE,
  qr_data TEXT,
  -- Amounts
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  -- Status
  status TEXT DEFAULT 'draft', -- draft, pending_cae, issued, paid, cancelled, failed
  afip_status TEXT DEFAULT 'pending', -- pending, processing, success, failed
  afip_error TEXT,
  afip_attempts INTEGER DEFAULT 0,
  fallback_reason TEXT, -- Why draft was created instead of real invoice
  -- PDF
  pdf_url TEXT,
  -- Timestamps
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MODULE 5: MERCADO PAGO
-- ============================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  method TEXT NOT NULL, -- mercadopago, cash, transfer
  status TEXT DEFAULT 'pending',
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_status TEXT,
  installments INTEGER DEFAULT 1,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MODULE 6: WHATSAPP
-- ============================================

CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  job_id UUID REFERENCES jobs(id),
  wa_message_id TEXT UNIQUE,
  direction TEXT NOT NULL,
  message_type TEXT,
  content TEXT,
  media_url TEXT,
  template_name TEXT,
  transcription TEXT,
  ai_extracted_data JSONB,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  fallback_channel TEXT, -- If sent via SMS or queued
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INFRASTRUCTURE: QUEUES & OBSERVABILITY
-- ============================================

-- Generic job queue (for all background processing)
CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL, -- afip, whatsapp, payment_sync, voice_ai
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, dlq
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt TIMESTAMPTZ,
  next_attempt TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Dead Letter Queue (failed jobs for manual review)
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID REFERENCES job_queue(id),
  queue_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL,
  last_error TEXT NOT NULL,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  resolution TEXT, -- retried, discarded, manual_fix
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service health tracking
CREATE TABLE service_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL, -- afip, whatsapp, mercadopago, openai
  status TEXT NOT NULL, -- normal, degraded, panic
  consecutive_failures INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts log
CREATE TABLE alerts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL, -- info, warning, critical
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_customers_org_phone ON customers(org_id, phone);
CREATE INDEX idx_jobs_org_status ON jobs(org_id, status);
CREATE INDEX idx_jobs_org_date ON jobs(org_id, scheduled_date);
CREATE INDEX idx_invoices_org_status ON invoices(org_id, status);
CREATE INDEX idx_invoices_afip_status ON invoices(afip_status) WHERE afip_status = 'pending';
CREATE INDEX idx_payments_status ON payments(status) WHERE status = 'pending';
CREATE INDEX idx_messages_org_customer ON whatsapp_messages(org_id, customer_id);
CREATE INDEX idx_queue_pending ON job_queue(queue_name, next_attempt) WHERE status = 'pending';
CREATE INDEX idx_dlq_unreviewed ON dead_letter_queue(created_at) WHERE reviewed = false;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
```

---

# DEVELOPMENT TIMELINE (14 Weeks)

## Pre-Development Checklist (Day -7 to 0)

| Task | Day | Notes |
|------|-----|-------|
| Submit WhatsApp templates | -7 | 5 templates, takes 1-5 days |
| Generate AFIP test certificates | -7 | Start homologación |
| Create MP sandbox account | -5 | |
| Set up Supabase project | -3 | |
| Set up Sentry | -3 | Error tracking from day 1 |
| Set up Slack channels | -2 | ops-info, ops-alerts, ops-critical |
| Initialize repository | -1 | |

## Week-by-Week Breakdown

### Week 1-2: Foundation + Simple UI

| Deliverable | Module | Notes |
|-------------|--------|-------|
| Phone OTP login | Auth | Minimal onboarding |
| 2-field signup | Auth | CUIT + Company name only |
| CUIT auto-fetch | Auth | Get company name from AFIP |
| Customer CRUD | CRM | |
| Job CRUD | Jobs | |
| Simple mode UI | All | Default, no calendar |
| Logging setup | Infra | Structured from day 1 |

**QA Checkpoint:** User can sign up in < 90 seconds, create customer, create job

### Week 3-5: AFIP Integration (Critical Path)

| Deliverable | Module | Notes |
|-------------|--------|-------|
| WSAA token service | AFIP | With refresh logic |
| WSFEv1 integration | AFIP | Invoice types A/B/C |
| CAE request | AFIP | With timeout + retry |
| Draft invoice system | AFIP | Fallback when AFIP down |
| AFIP queue | Infra | Background CAE requests |
| PDF generation | AFIP | With QR code |
| Health monitor | Infra | AFIP health checks |
| Panic mode | Infra | Auto-switch to draft |
| Just-in-time AFIP setup | Auth | Only when first invoice |

**QA Checkpoint:** Real CAE from AFIP homologación, draft fallback works

### Week 6-7: Payments + WhatsApp

| Deliverable | Module | Notes |
|-------------|--------|-------|
| MP OAuth | MP | Just-in-time setup |
| Payment preferences | MP | With cuotas + TEA/CFT |
| Payment fallbacks | MP | Cash, transfer always |
| Webhook handler | MP | With reconciliation |
| WhatsApp inbox | WhatsApp | |
| Template messages | WhatsApp | 5 templates |
| SMS fallback | WhatsApp | For critical messages |
| Rate limiting | Infra | Per-service limits |
| Just-in-time WA setup | Auth | Only when first send |

**QA Checkpoint:** Payment link works, WhatsApp sends, fallbacks work

### Week 8-9: Voice AI (Iterative)

| Deliverable | Module | Notes |
|-------------|--------|-------|
| Audio download | Voice | From WhatsApp |
| Whisper transcription | Voice | Spanish-AR |
| Entity extraction v1 | Voice | Basic prompts |
| Entity extraction v2 | Voice | Edge cases, slang |
| Confidence scoring | Voice | Human review queue |
| Few-shot examples | Voice | Training data |
| Job creation | Voice | From extraction |

**QA Checkpoint:** Voice messages create jobs with 70%+ accuracy

### Week 10-12: Mobile App

| Deliverable | Module | Notes |
|-------------|--------|-------|
| Phone OTP login | Mobile | |
| Today's jobs | Mobile | Simple mode default |
| One-tap actions | Mobile | Status changes |
| Photo capture | Mobile | With compression |
| Signature pad | Mobile | |
| Completion flow | Mobile | Auto-invoice |
| Push notifications | Mobile | |
| Error handling | Mobile | Graceful, retry |
| Android testing | Mobile | Old devices too |

**QA Checkpoint:** Complete job from mobile, invoice sent, works on old Android

### Week 13: Integration Testing + Observability

| Deliverable | Notes |
|-------------|-------|
| End-to-end flow testing | Full user journey |
| AFIP production testing | With real certs |
| Panic mode testing | Kill APIs, verify fallback |
| Queue monitoring | Dashboard complete |
| Alert testing | Verify Slack + SMS |
| DLQ handling | Manual review process |
| Load testing | 100 concurrent users |

### Week 14: Launch

| Day | Task |
|-----|------|
| 1 | App Store submissions |
| 2-3 | Wait for approval (buffer for rejection) |
| 4 | Production deployment |
| 5 | First 5 pilot customers |

---

# SUCCESS METRICS

## Launch Day (Week 14)

| Metric | Target |
|--------|--------|
| Signup to first job | < 2 minutes |
| First job to paid invoice | < 30 seconds (after completion) |
| Visible errors | 0 |
| AFIP fallback working | Verified |
| WhatsApp fallback working | Verified |
| MP fallback working | Verified |

## Month 1

| Metric | Target |
|--------|--------|
| Pilot customers | 10 |
| Onboarding completion rate | > 80% |
| First job completion rate | > 70% |
| Panic mode activations | < 5 |
| DLQ items | < 10 |

## Month 3

| Metric | Target |
|--------|--------|
| Paying customers | 50 |
| Monthly churn | < 10% |
| Voice AI accuracy | > 80% |
| App Store rating | > 4.0 |
| Zero-touch invoices | > 90% |

---

# ANTI-PATTERNS TO AVOID

## ❌ DON'T: Add setup steps to onboarding

```
// BAD - Adding "just one more field"
const ONBOARDING_FIELDS = ['cuit', 'company_name', 'iva_condition', 'email'];
```

```
// GOOD - Only 2 fields, forever
const ONBOARDING_FIELDS = ['cuit', 'company_name'];
```

## ❌ DON'T: Show complex UI by default

```
// BAD - Showing calendar in simple mode
{settings.ui_mode === 'simple' && <Calendar />}
```

```
// GOOD - Only today's jobs in simple mode
{settings.ui_mode === 'simple' && <TodaysJobs />}
{settings.ui_mode === 'advanced' && <Calendar />}
```

## ❌ DON'T: Let API failures reach the user

```
// BAD - Showing raw error
catch (error) {
  toast.error(error.message); // "WSFE Error 10016: CAE rechazado"
}
```

```
// GOOD - Handle gracefully, fallback
catch (error) {
  await handleAfipError(error);
  // User sees: "Factura creada ✓" (draft in background)
}
```

## ❌ DON'T: Have silent background job failures

```
// BAD - Fire and forget
queue.add(job);
```

```
// GOOD - Track, alert, retry
const result = await queue.add(job);
if (result.status === 'failed') {
  await alertService.sendWarning(...);
  await dlq.add(job);
}
```

## ❌ DON'T: Skip monitoring setup

```
// BAD - "We'll add monitoring later"
// (You won't know when things break)
```

```
// GOOD - Monitoring from day 1
logger.info('Invoice created', { ... });
metrics.increment('invoices.created');
if (isDraft) metrics.increment('invoices.draft_fallback');
```

---

# FINAL CHECKLIST

## Before Launch

- [ ] Signup flow is exactly 2 fields (CUIT + name)
- [ ] Simple mode is default, no way to "accidentally" see advanced
- [ ] AFIP fallback to draft is working
- [ ] WhatsApp fallback to SMS is working
- [ ] MP fallback to cash/transfer is working
- [ ] All queues have monitoring
- [ ] DLQ is being watched
- [ ] Alerts are going to Slack + SMS
- [ ] Admin dashboard shows queue health
- [ ] Reconciliation page exists for MP
- [ ] Tested on old Android phones
- [ ] First job completion is < 2 minutes
- [ ] Zero cryptic errors visible to users

## Launch Day Monitoring

- [ ] Watch panic mode dashboard
- [ ] Watch queue sizes
- [ ] Watch DLQ
- [ ] Watch error rates in Sentry
- [ ] Have manual override ready for each service
- [ ] Be ready to switch to 100% draft mode if needed

---

*Document Version: 5.0 (Minimal Onboarding + Reliability-First)*
*Last Updated: December 2025*
*Core Principle: "Works perfectly the first time, every time"*
