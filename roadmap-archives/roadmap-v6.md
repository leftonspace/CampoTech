# CampoTech: Argentina MVP Roadmap v6
## 12 Core Workflows | Minimal Onboarding | Reliability-First | Production-Ready

---

# EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Core Workflows** | 12 |
| **MVP Timeline** | 16 weeks (+2 for Voice AI + Offline) |
| **Architecture** | 8 modules + Infrastructure Layer |
| **Onboarding** | 2 fields only (CUIT + Company Name) |
| **Default Mode** | Simple (Advanced unlockable) |
| **Reliability Target** | Zero user-facing errors from API failures |
| **Offline Support** | Full technician workflow without connectivity |
| **Target Devices** | Moto G7+, Samsung A10+, Xiaomi Redmi 8+ |
| **Monthly Cost (100 users)** | $280-520 |

---

# DOCUMENT CHANGELOG

| Version | Changes |
|---------|---------|
| v1-v3 | Feature-focused (too complex) |
| v4 | Modular + realistic timeline |
| v5 | + Minimal onboarding, fallback systems, observability, panic modes |
| **v6** | + Voice AI pipeline, offline mode, Android performance, concurrency, rollback, costs |

---

# CRITICAL GAPS ADDRESSED IN V6

| Gap | Problem | Solution |
|-----|---------|----------|
| Voice AI | No dataset, no annotation, no human fallback | Full annotation pipeline, human review queue, 200-sample dataset |
| Offline Mode | Technicians can't work in basements/rooftops | WatermelonDB local-first, sync queue, offline job completion |
| Old Android | App crashes on cheap phones | Performance budget, lazy loading, image compression, startup optimization |
| Concurrency | Duplicate invoices, payments, messages | Idempotency keys, distributed locks, deduplication |
| Rollback | No recovery from bad deploys | Feature flags, blue-green, version pinning, kill switches |
| Costs | No budget planning | Detailed cost model per user, per action |

---

# SECTION 1: VOICE AI PIPELINE (COMPLETE)

## The Problem

Argentine WhatsApp voice messages are chaotic:

```
TYPICAL MESSAGE:
"Che loco fijate que tengo una pérdida en el baño, 
[dog barking] no sé si es la canilla o qué onda, 
[traffic noise] estoy en Palermo, Honduras y Serrano más o menos,
[child yelling] llamame cuando puedas dale"

CHALLENGES:
- Background noise (traffic, dogs, kids, TV)
- Bad microphones (cheap phones, WhatsApp compression)
- Zero structure (stream of consciousness)
- Lunfardo slang ("che", "loco", "qué onda", "dale")
- Implicit info ("cerca de la estación" - which station?)
- Numbers spoken fast ("cuatro cinco seis siete ocho nueve")
- Address variations ("Honduras y Serrano" vs "Honduras 4500")
```

## Voice AI Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VOICE AI PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WhatsApp Audio                                                          │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────┐                                                    │
│  │ Audio Download  │  OGG/OPUS format, variable quality                 │
│  │ + Preprocessing │  Normalize volume, reduce noise (optional)         │
│  └────────┬────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────┐                                                    │
│  │ Whisper ASR     │  Model: whisper-1                                  │
│  │ (Transcription) │  Language: es                                      │
│  │                 │  Prompt: Argentine Spanish context                 │
│  └────────┬────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────┐                                                    │
│  │ GPT-4o          │  Few-shot examples (20+)                           │
│  │ (Extraction)    │  Structured output (JSON)                          │
│  │                 │  Confidence scores per field                       │
│  └────────┬────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────┐     ┌─────────────────┐                           │
│  │ Confidence      │────▶│ HIGH (≥0.7)     │──▶ Auto-create job        │
│  │ Router          │     │                 │                            │
│  │                 │     ├─────────────────┤                           │
│  │                 │────▶│ MEDIUM (0.4-0.7)│──▶ Create draft + review  │
│  │                 │     │                 │                            │
│  │                 │     ├─────────────────┤                           │
│  │                 │────▶│ LOW (<0.4)      │──▶ Human review queue     │
│  └─────────────────┘     └─────────────────┘                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    HUMAN REVIEW QUEUE                            │   │
│  │                                                                  │   │
│  │  • Play original audio                                          │   │
│  │  • Show transcription                                           │   │
│  │  • Show AI extraction                                           │   │
│  │  • Allow corrections                                            │   │
│  │  • Corrections feed back to training set                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Voice AI Dataset Requirements

### Initial Dataset (Pre-Launch)

**Minimum: 200 real audio samples**

| Category | Samples | Purpose |
|----------|---------|---------|
| Clean audio, clear speech | 50 | Baseline accuracy |
| Background noise (traffic, dogs) | 40 | Noise robustness |
| Bad microphone quality | 30 | WhatsApp compression handling |
| Lunfardo/slang heavy | 30 | Argentine Spanish handling |
| Fast talkers | 20 | Speed handling |
| Multiple topics in one message | 20 | Complex extraction |
| Partial/incomplete info | 10 | Graceful degradation |

**How to collect:**
1. **Week -4 to -2**: Record 100 samples ourselves (team members, friends)
2. **Week -2 to 0**: Partner with 2-3 friendly plumbers for 100 real samples
3. **Ongoing**: Every human correction becomes a training sample

### Dataset Schema

```typescript
// types/voice-ai-dataset.ts

interface VoiceAITrainingSample {
  id: string;
  
  // Audio
  audio_url: string;
  audio_duration_seconds: number;
  audio_quality: 'clean' | 'noisy' | 'poor';
  
  // Transcription
  whisper_transcription: string;
  human_transcription?: string; // Ground truth
  transcription_accuracy?: number; // WER score
  
  // Extraction
  ai_extraction: ExtractedJobData;
  human_extraction: ExtractedJobData; // Ground truth
  extraction_accuracy?: number; // Field-by-field score
  
  // Metadata
  noise_types: string[]; // ['traffic', 'dog', 'child', 'tv']
  slang_used: string[]; // ['che', 'loco', 'dale', 'onda']
  speaker_characteristics: {
    speed: 'slow' | 'normal' | 'fast';
    accent: 'porteño' | 'interior' | 'mixed';
    clarity: 'clear' | 'mumbled' | 'unclear';
  };
  
  // Source
  source: 'synthetic' | 'beta_user' | 'production_correction';
  created_at: Date;
}

interface ExtractedJobData {
  customer_name?: { value: string; confidence: number };
  phone?: { value: string; confidence: number };
  address?: { value: string; confidence: number };
  neighborhood?: { value: string; confidence: number };
  problem_description?: { value: string; confidence: number };
  service_type?: { value: string; confidence: number };
  urgency?: { value: 'normal' | 'urgent' | 'emergency'; confidence: number };
  preferred_date?: { value: string; confidence: number };
  preferred_time?: { value: string; confidence: number };
}
```

### Annotation Pipeline

```typescript
// services/voice-ai/AnnotationPipeline.ts

export class AnnotationPipeline {
  /**
   * Process a voice message through the full pipeline
   */
  async process(message: WhatsAppVoiceMessage): Promise<VoiceProcessingResult> {
    const startTime = Date.now();
    
    // 1. Download and preprocess audio
    const audio = await this.downloadAudio(message.media_url);
    const preprocessed = await this.preprocessAudio(audio);
    
    // 2. Transcribe with Whisper
    const transcription = await this.transcribe(preprocessed);
    
    // 3. Extract entities with GPT-4o
    const extraction = await this.extractEntities(transcription);
    
    // 4. Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(extraction);
    
    // 5. Route based on confidence
    const routing = this.routeByConfidence(overallConfidence);
    
    // 6. Store for potential training
    await this.storeForTraining({
      audio_url: message.media_url,
      transcription,
      extraction,
      confidence: overallConfidence,
      routing,
      duration: Date.now() - startTime
    });
    
    return {
      transcription,
      extraction,
      confidence: overallConfidence,
      routing,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Transcribe with Argentine Spanish context
   */
  private async transcribe(audio: Buffer): Promise<string> {
    const response = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'es',
      // Context prompt helps with Argentine-specific terms
      prompt: `Transcripción de mensaje de WhatsApp en español argentino. 
               Contexto: servicios de plomería, electricidad, gas, aire acondicionado.
               Términos comunes: pérdida, canilla, cañería, termotanque, disyuntor, 
               enchufe, toma, split, compresor.
               Barrios de Buenos Aires: Palermo, Belgrano, Recoleta, Núñez, Caballito.
               Expresiones: che, loco, dale, qué onda, fijate, bárbaro.`
    });
    
    return response.text;
  }

  /**
   * Extract entities with few-shot examples
   */
  private async extractEntities(transcription: string): Promise<ExtractedJobData> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: EXTRACTION_SYSTEM_PROMPT
        },
        // Few-shot examples (critical for accuracy)
        ...this.getFewShotExamples(),
        {
          role: 'user',
          content: `Extraé los datos del siguiente mensaje:\n\n"${transcription}"`
        }
      ],
      temperature: 0.1 // Low temperature for consistent extraction
    });
    
    return JSON.parse(response.choices[0].message.content!);
  }

  /**
   * 20+ few-shot examples covering edge cases
   */
  private getFewShotExamples(): ChatCompletionMessageParam[] {
    return [
      // Example 1: Clean, complete message
      {
        role: 'user',
        content: 'Extraé los datos del siguiente mensaje:\n\n"Hola, soy María García, tengo una pérdida en el baño. Estoy en Honduras 4500, Palermo. Mi teléfono es 1156789012. Sería para mañana a la mañana si puede ser."'
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          customer_name: { value: 'María García', confidence: 0.95 },
          phone: { value: '1156789012', confidence: 0.95 },
          address: { value: 'Honduras 4500', confidence: 0.90 },
          neighborhood: { value: 'Palermo', confidence: 0.95 },
          problem_description: { value: 'Pérdida en el baño', confidence: 0.90 },
          service_type: { value: 'plomería', confidence: 0.85 },
          urgency: { value: 'normal', confidence: 0.80 },
          preferred_date: { value: 'mañana', confidence: 0.85 },
          preferred_time: { value: 'mañana (AM)', confidence: 0.80 }
        })
      },
      
      // Example 2: Lunfardo heavy, background noise indicated
      {
        role: 'user',
        content: 'Extraé los datos del siguiente mensaje:\n\n"Che loco qué onda, mirá tengo un tema con la canilla de la cocina que pierde, está re jodida, necesito que vengas urgente si podés, estoy por Scalabrini y Santa Fe más o menos, llamame al cuatro cinco seis siete ocho nueve cero uno, dale gracias"'
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          customer_name: { value: null, confidence: 0 },
          phone: { value: '45678901', confidence: 0.70 },
          address: { value: 'Scalabrini Ortiz y Santa Fe', confidence: 0.75 },
          neighborhood: { value: 'Palermo', confidence: 0.60 },
          problem_description: { value: 'Canilla de cocina pierde agua', confidence: 0.85 },
          service_type: { value: 'plomería', confidence: 0.90 },
          urgency: { value: 'urgent', confidence: 0.85 },
          preferred_date: { value: null, confidence: 0 },
          preferred_time: { value: null, confidence: 0 }
        })
      },
      
      // Example 3: Incomplete, needs clarification
      {
        role: 'user',
        content: 'Extraé los datos del siguiente mensaje:\n\n"Hola necesito un técnico para el aire, no enfría bien"'
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          customer_name: { value: null, confidence: 0 },
          phone: { value: null, confidence: 0 },
          address: { value: null, confidence: 0 },
          neighborhood: { value: null, confidence: 0 },
          problem_description: { value: 'Aire acondicionado no enfría bien', confidence: 0.85 },
          service_type: { value: 'aire_acondicionado', confidence: 0.90 },
          urgency: { value: 'normal', confidence: 0.50 },
          preferred_date: { value: null, confidence: 0 },
          preferred_time: { value: null, confidence: 0 }
        })
      },
      
      // Example 4: Multiple issues in one message
      {
        role: 'user',
        content: 'Extraé los datos del siguiente mensaje:\n\n"Buenas, mirá tengo varios temas, primero el termo no calienta bien el agua, y después tengo una canilla en el baño que gotea, ah y también me parece que hay una pérdida en algún lado porque me vino alta la boleta del agua, estoy en Belgrano, Cabildo al 2400"'
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          customer_name: { value: null, confidence: 0 },
          phone: { value: null, confidence: 0 },
          address: { value: 'Cabildo 2400', confidence: 0.85 },
          neighborhood: { value: 'Belgrano', confidence: 0.95 },
          problem_description: { value: 'Termotanque no calienta bien, canilla gotea en baño, posible pérdida de agua', confidence: 0.80 },
          service_type: { value: 'plomería', confidence: 0.85 },
          urgency: { value: 'normal', confidence: 0.70 },
          preferred_date: { value: null, confidence: 0 },
          preferred_time: { value: null, confidence: 0 }
        })
      },
      
      // Example 5: Fast phone number dictation
      {
        role: 'user',
        content: 'Extraé los datos del siguiente mensaje:\n\n"Mi número es once quince cuarenta y cinco sesenta y siete ochenta y nueve"'
      },
      {
        role: 'assistant',
        content: JSON.stringify({
          customer_name: { value: null, confidence: 0 },
          phone: { value: '1115456789', confidence: 0.75 },
          address: { value: null, confidence: 0 },
          neighborhood: { value: null, confidence: 0 },
          problem_description: { value: null, confidence: 0 },
          service_type: { value: null, confidence: 0 },
          urgency: { value: null, confidence: 0 },
          preferred_date: { value: null, confidence: 0 },
          preferred_time: { value: null, confidence: 0 }
        })
      },
      
      // Add 15+ more examples covering:
      // - Wrong Whisper transcription of addresses
      // - Ambiguous time references ("esta semana", "en estos días")
      // - Emergency keywords ("urgente", "se inunda", "olor a gas")
      // - Gas-specific safety issues
      // - Electrical issues (disyuntor, cortocircuito)
      // ... etc
    ];
  }

  /**
   * Calculate overall confidence from individual fields
   */
  private calculateOverallConfidence(extraction: ExtractedJobData): number {
    const criticalFields = ['problem_description', 'service_type'];
    const importantFields = ['phone', 'address', 'neighborhood'];
    
    let score = 0;
    let weight = 0;
    
    // Critical fields have higher weight
    for (const field of criticalFields) {
      const data = extraction[field as keyof ExtractedJobData];
      if (data && typeof data === 'object' && 'confidence' in data) {
        score += data.confidence * 2;
        weight += 2;
      }
    }
    
    // Important fields
    for (const field of importantFields) {
      const data = extraction[field as keyof ExtractedJobData];
      if (data && typeof data === 'object' && 'confidence' in data) {
        score += data.confidence;
        weight += 1;
      }
    }
    
    return weight > 0 ? score / weight : 0;
  }

  /**
   * Route based on confidence thresholds
   */
  private routeByConfidence(confidence: number): VoiceRouting {
    if (confidence >= 0.7) {
      return {
        action: 'auto_create',
        reason: 'High confidence extraction',
        humanReviewRequired: false
      };
    } else if (confidence >= 0.4) {
      return {
        action: 'create_draft',
        reason: 'Medium confidence - review recommended',
        humanReviewRequired: true,
        priority: 'normal'
      };
    } else {
      return {
        action: 'human_queue',
        reason: 'Low confidence - manual processing required',
        humanReviewRequired: true,
        priority: 'high'
      };
    }
  }
}

const EXTRACTION_SYSTEM_PROMPT = `Sos un asistente que extrae información de mensajes de voz de clientes de servicios técnicos en Argentina.

CONTEXTO:
- Los mensajes son de clientes que necesitan plomeros, electricistas, gasistas o técnicos de aire acondicionado
- El español es argentino (voseo, lunfardo, expresiones locales)
- Los barrios mencionados son de Buenos Aires y alrededores

REGLAS:
1. Extraé SOLO la información que está explícitamente en el mensaje
2. Si algo no está claro o no se menciona, poné null con confidence 0
3. El confidence debe reflejar qué tan seguro estás de la extracción:
   - 0.9-1.0: Información clara y explícita
   - 0.7-0.9: Información presente pero podría haber ambigüedad menor
   - 0.5-0.7: Información inferida o parcial
   - 0.3-0.5: Información muy ambigua
   - 0-0.3: Prácticamente adivinando
4. Para teléfonos: normalizá a 10 dígitos sin prefijo, sin espacios
5. Para direcciones: normalizá a "Calle Número" o "Calle1 y Calle2"
6. Para urgencia:
   - "emergency": menciona inundación, olor a gas, cortocircuito con chispas
   - "urgent": dice "urgente", "lo antes posible", "hoy si puede"
   - "normal": todo lo demás

TIPOS DE SERVICIO:
- plomería: pérdidas, canillas, cañerías, termotanque, inodoro, desagüe
- electricidad: disyuntor, enchufe, toma, cables, cortocircuito
- gas: calefón, estufa, horno, olor a gas, piloto
- aire_acondicionado: split, no enfría, no calienta, compresor, pérdida de gas

RESPUESTA:
Respondé SOLO con un objeto JSON válido, sin explicaciones adicionales.`;
```

### Human Review Queue UI

```typescript
// app/(dashboard)/voice-review/page.tsx

export default async function VoiceReviewPage() {
  const pendingReviews = await getVoiceReviewQueue();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          Mensajes de voz para revisar ({pendingReviews.length})
        </h1>
        <Badge variant={pendingReviews.length > 10 ? 'destructive' : 'secondary'}>
          {pendingReviews.length} pendientes
        </Badge>
      </div>

      {pendingReviews.map((review) => (
        <VoiceReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}

function VoiceReviewCard({ review }: { review: VoiceReview }) {
  const [corrections, setCorrections] = useState(review.ai_extraction);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <div>
            <CardTitle className="text-base">
              Mensaje de {review.customer_phone || 'número desconocido'}
            </CardTitle>
            <CardDescription>
              {formatRelativeTime(review.created_at)} • 
              Confianza: {Math.round(review.confidence * 100)}%
            </CardDescription>
          </div>
          <Badge variant={review.confidence < 0.4 ? 'destructive' : 'warning'}>
            {review.routing.reason}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Audio Player */}
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsPlaying(!isPlaying);
              toggleAudio(review.audio_url);
            }}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1">
            <AudioWaveform url={review.audio_url} isPlaying={isPlaying} />
          </div>
          <span className="text-sm text-muted-foreground">
            {review.audio_duration}s
          </span>
        </div>

        {/* Transcription */}
        <div>
          <Label className="text-sm font-medium">Transcripción (Whisper)</Label>
          <p className="mt-1 p-3 bg-gray-50 rounded-lg text-sm">
            "{review.transcription}"
          </p>
        </div>

        {/* AI Extraction with corrections */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Nombre del cliente</Label>
            <Input
              value={corrections.customer_name?.value || ''}
              onChange={(e) => updateCorrection('customer_name', e.target.value)}
              placeholder="No detectado"
              className={getConfidenceClass(review.ai_extraction.customer_name?.confidence)}
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input
              value={corrections.phone?.value || ''}
              onChange={(e) => updateCorrection('phone', e.target.value)}
              placeholder="No detectado"
              className={getConfidenceClass(review.ai_extraction.phone?.confidence)}
            />
          </div>
          <div>
            <Label>Dirección</Label>
            <Input
              value={corrections.address?.value || ''}
              onChange={(e) => updateCorrection('address', e.target.value)}
              placeholder="No detectado"
              className={getConfidenceClass(review.ai_extraction.address?.confidence)}
            />
          </div>
          <div>
            <Label>Barrio</Label>
            <Select
              value={corrections.neighborhood?.value || ''}
              onValueChange={(v) => updateCorrection('neighborhood', v)}
            >
              <SelectTrigger className={getConfidenceClass(review.ai_extraction.neighborhood?.confidence)}>
                <SelectValue placeholder="Seleccionar barrio" />
              </SelectTrigger>
              <SelectContent>
                {BUENOS_AIRES_NEIGHBORHOODS.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Descripción del problema</Label>
            <Textarea
              value={corrections.problem_description?.value || ''}
              onChange={(e) => updateCorrection('problem_description', e.target.value)}
              placeholder="No detectado"
              className={getConfidenceClass(review.ai_extraction.problem_description?.confidence)}
            />
          </div>
          <div>
            <Label>Tipo de servicio</Label>
            <Select
              value={corrections.service_type?.value || ''}
              onValueChange={(v) => updateCorrection('service_type', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plomería">Plomería</SelectItem>
                <SelectItem value="electricidad">Electricidad</SelectItem>
                <SelectItem value="gas">Gas</SelectItem>
                <SelectItem value="aire_acondicionado">Aire acondicionado</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Urgencia</Label>
            <Select
              value={corrections.urgency?.value || 'normal'}
              onValueChange={(v) => updateCorrection('urgency', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="emergency">Emergencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => discardMessage(review.id)}>
          Descartar mensaje
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => requestCallback(review.id)}>
            Llamar al cliente
          </Button>
          <Button onClick={() => createJobFromReview(review.id, corrections)}>
            Crear trabajo
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function getConfidenceClass(confidence?: number): string {
  if (!confidence || confidence === 0) return 'border-gray-300';
  if (confidence >= 0.7) return 'border-green-300 bg-green-50';
  if (confidence >= 0.4) return 'border-yellow-300 bg-yellow-50';
  return 'border-red-300 bg-red-50';
}
```

### Voice AI Accuracy Metrics

```typescript
// services/voice-ai/AccuracyTracker.ts

export class VoiceAccuracyTracker {
  /**
   * Track accuracy after human correction
   */
  async recordCorrection(
    original: VoiceProcessingResult,
    corrected: ExtractedJobData
  ): Promise<void> {
    const metrics = this.calculateMetrics(original.extraction, corrected);
    
    await this.store({
      processing_id: original.id,
      timestamp: new Date(),
      overall_confidence: original.confidence,
      actual_accuracy: metrics.overallAccuracy,
      field_accuracies: metrics.fieldAccuracies,
      transcription_wer: await this.calculateWER(original.transcription, corrected),
      false_positives: metrics.falsePositives,
      false_negatives: metrics.falseNegatives
    });

    // Update rolling averages
    await this.updateRollingAverages();
    
    // Alert if accuracy drops below threshold
    const recentAccuracy = await this.getRecentAccuracy();
    if (recentAccuracy < 0.6) {
      await this.alertService.sendWarning({
        title: 'Voice AI accuracy dropping',
        message: `Recent accuracy: ${Math.round(recentAccuracy * 100)}%. Review few-shot examples.`
      });
    }
  }

  /**
   * Get accuracy dashboard data
   */
  async getDashboardMetrics(): Promise<VoiceAIDashboard> {
    return {
      // Overall metrics
      totalProcessed: await this.getTotalProcessed(),
      averageAccuracy: await this.getAverageAccuracy(),
      averageConfidence: await this.getAverageConfidence(),
      
      // Routing breakdown
      autoCreated: await this.getCountByRouting('auto_create'),
      draftCreated: await this.getCountByRouting('create_draft'),
      humanQueued: await this.getCountByRouting('human_queue'),
      
      // Field-level accuracy
      fieldAccuracies: {
        customer_name: await this.getFieldAccuracy('customer_name'),
        phone: await this.getFieldAccuracy('phone'),
        address: await this.getFieldAccuracy('address'),
        neighborhood: await this.getFieldAccuracy('neighborhood'),
        problem_description: await this.getFieldAccuracy('problem_description'),
        service_type: await this.getFieldAccuracy('service_type'),
        urgency: await this.getFieldAccuracy('urgency')
      },
      
      // Trends
      accuracyTrend: await this.getAccuracyTrend(30), // Last 30 days
      
      // Problem areas
      commonErrors: await this.getCommonErrors(),
      lowConfidencePatterns: await this.getLowConfidencePatterns()
    };
  }
}
```

---

# SECTION 2: OFFLINE MODE (TECHNICIAN APP)

## The Problem

Argentine technicians work in:
- Basements (no signal)
- Rooftops (weak signal)
- Boiler rooms (concrete walls)
- Remote areas (spotty 3G)

They need to complete jobs without connectivity.

## Offline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OFFLINE-FIRST ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                      MOBILE APP                                 │    │
│  │                                                                 │    │
│  │  ┌─────────────────┐    ┌─────────────────┐                   │    │
│  │  │   UI Layer      │    │  Sync Manager   │                   │    │
│  │  │   (React)       │    │                 │                   │    │
│  │  └────────┬────────┘    └────────┬────────┘                   │    │
│  │           │                      │                             │    │
│  │           ▼                      ▼                             │    │
│  │  ┌──────────────────────────────────────────────────────┐     │    │
│  │  │              WatermelonDB (Local Database)            │     │    │
│  │  │                                                       │     │    │
│  │  │  jobs  │  customers  │  photos  │  sync_queue        │     │    │
│  │  └──────────────────────────────────────────────────────┘     │    │
│  │                          │                                     │    │
│  │                          │ Sync when online                   │    │
│  │                          ▼                                     │    │
│  │  ┌──────────────────────────────────────────────────────┐     │    │
│  │  │              Sync Queue (Pending Actions)             │     │    │
│  │  │                                                       │     │    │
│  │  │  • Status updates                                     │     │    │
│  │  │  • Photo uploads                                      │     │    │
│  │  │  • Signatures                                         │     │    │
│  │  │  • Job completions                                    │     │    │
│  │  │  • Notes/comments                                     │     │    │
│  │  └──────────────────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                    │                                    │
│                                    │ When connectivity restored        │
│                                    ▼                                    │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                         SUPABASE                                │    │
│  │                                                                 │    │
│  │  Real-time subscriptions │ REST API │ Storage (photos)        │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## WatermelonDB Schema

```typescript
// apps/mobile/database/schema.ts

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    // Jobs table (synced)
    tableSchema({
      name: 'jobs',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'customer_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'scheduled_date', type: 'number', isIndexed: true },
        { name: 'scheduled_time_start', type: 'string', isOptional: true },
        { name: 'address', type: 'string', isOptional: true },
        { name: 'lat', type: 'number', isOptional: true },
        { name: 'lng', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'signature_local_path', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        // Sync metadata
        { name: 'sync_status', type: 'string' }, // synced, pending, conflict
        { name: 'local_changes', type: 'string', isOptional: true }, // JSON of pending changes
      ]
    }),

    // Customers table (synced, read-mostly)
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string', isIndexed: true },
        { name: 'address', type: 'string', isOptional: true },
        { name: 'neighborhood', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'sync_status', type: 'string' },
      ]
    }),

    // Photos table (upload queue)
    tableSchema({
      name: 'photos',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'local_uri', type: 'string' },
        { name: 'server_url', type: 'string', isOptional: true },
        { name: 'type', type: 'string' }, // before, after, other
        { name: 'upload_status', type: 'string' }, // pending, uploading, uploaded, failed
        { name: 'upload_attempts', type: 'number' },
        { name: 'created_at', type: 'number' },
      ]
    }),

    // Sync queue (pending actions)
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'action_type', type: 'string' }, // status_update, photo_upload, job_complete, note_add
        { name: 'entity_type', type: 'string' }, // job, customer, photo
        { name: 'entity_id', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON
        { name: 'status', type: 'string' }, // pending, processing, completed, failed
        { name: 'attempts', type: 'number' },
        { name: 'last_attempt', type: 'number', isOptional: true },
        { name: 'error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ]
    }),

    // Price book (cached, rarely changes)
    tableSchema({
      name: 'price_book',
      columns: [
        { name: 'server_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'tax_rate', type: 'number' },
      ]
    }),
  ]
});
```

## Sync Manager

```typescript
// apps/mobile/services/SyncManager.ts

import NetInfo from '@react-native-community/netinfo';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';

export class SyncManager {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timer | null = null;

  constructor() {
    // Listen to connectivity changes
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      // Trigger sync when coming back online
      if (wasOffline && this.isOnline) {
        this.syncAll();
      }
    });

    // Periodic sync when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncAll();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Queue an action for sync
   */
  async queueAction(action: SyncAction): Promise<void> {
    await database.write(async () => {
      await database.get('sync_queue').create(record => {
        record.action_type = action.type;
        record.entity_type = action.entityType;
        record.entity_id = action.entityId;
        record.payload = JSON.stringify(action.payload);
        record.status = 'pending';
        record.attempts = 0;
        record.created_at = Date.now();
      });
    });

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncAll();
    }
  }

  /**
   * Sync all pending actions
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing || !this.isOnline) {
      return { success: false, reason: this.isSyncing ? 'already_syncing' : 'offline' };
    }

    this.isSyncing = true;

    try {
      // 1. Download new/updated data from server
      await this.pullFromServer();

      // 2. Upload pending local changes
      await this.pushToServer();

      // 3. Upload pending photos
      await this.uploadPendingPhotos();

      return { success: true, syncedAt: new Date() };
    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, error };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull updates from server
   */
  private async pullFromServer(): Promise<void> {
    const lastSync = await this.getLastSyncTimestamp();
    
    // Fetch jobs updated since last sync
    const { data: jobs } = await supabase
      .from('jobs')
      .select('*')
      .gte('updated_at', lastSync.toISOString())
      .eq('assigned_to', currentUserId);

    // Upsert to local database
    await database.write(async () => {
      for (const job of jobs) {
        const existing = await database.get('jobs')
          .query(Q.where('server_id', job.id))
          .fetch();

        if (existing.length > 0) {
          // Check for conflicts
          const local = existing[0];
          if (local.sync_status === 'pending') {
            // Local has pending changes, mark as conflict
            await local.update(record => {
              record.sync_status = 'conflict';
            });
          } else {
            // Safe to update
            await local.update(record => {
              record.title = job.title;
              record.status = job.status;
              // ... other fields
              record.sync_status = 'synced';
            });
          }
        } else {
          // Create new local record
          await database.get('jobs').create(record => {
            record.server_id = job.id;
            record.title = job.title;
            // ... other fields
            record.sync_status = 'synced';
          });
        }
      }
    });

    await this.setLastSyncTimestamp(new Date());
  }

  /**
   * Push pending changes to server
   */
  private async pushToServer(): Promise<void> {
    const pendingActions = await database.get('sync_queue')
      .query(
        Q.where('status', 'pending'),
        Q.sortBy('created_at', Q.asc)
      )
      .fetch();

    for (const action of pendingActions) {
      try {
        await database.write(async () => {
          await action.update(record => {
            record.status = 'processing';
            record.attempts = record.attempts + 1;
            record.last_attempt = Date.now();
          });
        });

        const payload = JSON.parse(action.payload);
        
        switch (action.action_type) {
          case 'status_update':
            await this.syncStatusUpdate(action.entity_id, payload);
            break;
          case 'job_complete':
            await this.syncJobCompletion(action.entity_id, payload);
            break;
          case 'note_add':
            await this.syncNote(action.entity_id, payload);
            break;
        }

        // Mark as completed
        await database.write(async () => {
          await action.update(record => {
            record.status = 'completed';
          });
        });

      } catch (error) {
        console.error('Failed to sync action:', error);
        
        await database.write(async () => {
          await action.update(record => {
            record.status = action.attempts >= 5 ? 'failed' : 'pending';
            record.error = (error as Error).message;
          });
        });
      }
    }
  }

  /**
   * Upload pending photos with compression
   */
  private async uploadPendingPhotos(): Promise<void> {
    const pendingPhotos = await database.get('photos')
      .query(
        Q.where('upload_status', Q.oneOf(['pending', 'failed'])),
        Q.where('upload_attempts', Q.lt(5))
      )
      .fetch();

    for (const photo of pendingPhotos) {
      try {
        await database.write(async () => {
          await photo.update(record => {
            record.upload_status = 'uploading';
            record.upload_attempts = record.upload_attempts + 1;
          });
        });

        // Compress before upload
        const compressed = await this.compressPhoto(photo.local_uri);
        
        // Upload to Supabase Storage
        const fileName = `${photo.job_id}/${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
          .from('job-photos')
          .upload(fileName, compressed);

        if (error) throw error;

        const publicUrl = supabase.storage
          .from('job-photos')
          .getPublicUrl(fileName).data.publicUrl;

        await database.write(async () => {
          await photo.update(record => {
            record.upload_status = 'uploaded';
            record.server_url = publicUrl;
          });
        });

      } catch (error) {
        console.error('Failed to upload photo:', error);
        
        await database.write(async () => {
          await photo.update(record => {
            record.upload_status = 'failed';
          });
        });
      }
    }
  }

  /**
   * Compress photo for upload (critical for slow connections)
   */
  private async compressPhoto(uri: string): Promise<Blob> {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }], // Max 1200px wide
      { compress: 0.7, format: SaveFormat.JPEG }
    );
    
    const response = await fetch(manipulated.uri);
    return await response.blob();
  }
}
```

## Offline-Aware Job Completion

```typescript
// apps/mobile/screens/JobCompleteScreen.tsx

export function JobCompleteScreen({ jobId }: { jobId: string }) {
  const { isOnline } = useNetworkStatus();
  const syncManager = useSyncManager();
  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<PriceBookItem[]>([]);

  const handleComplete = async () => {
    // 1. Save everything locally first (works offline)
    await database.write(async () => {
      // Update job status locally
      await job.update(record => {
        record.status = 'completed';
        record.signature_local_path = signature;
        record.sync_status = 'pending';
        record.local_changes = JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString(),
          services: selectedServices,
          photos: photos.map(p => p.local_uri)
        });
      });

      // Save photos locally
      for (const photo of photos) {
        await database.get('photos').create(record => {
          record.job_id = jobId;
          record.local_uri = photo.uri;
          record.type = photo.type;
          record.upload_status = 'pending';
          record.upload_attempts = 0;
          record.created_at = Date.now();
        });
      }
    });

    // 2. Queue sync action
    await syncManager.queueAction({
      type: 'job_complete',
      entityType: 'job',
      entityId: jobId,
      payload: {
        services: selectedServices,
        signature_path: signature,
        completed_at: new Date().toISOString()
      }
    });

    // 3. Show appropriate feedback
    if (isOnline) {
      // Will sync immediately
      Toast.show({
        type: 'success',
        text1: 'Trabajo completado',
        text2: 'Enviando factura al cliente...'
      });
    } else {
      // Will sync when back online
      Toast.show({
        type: 'info',
        text1: 'Trabajo completado',
        text2: 'Se enviará la factura cuando tengas conexión'
      });
    }

    // Navigate to next job
    navigation.navigate('Home');
  };

  return (
    <ScrollView>
      {/* Offline indicator */}
      {!isOnline && (
        <View className="bg-yellow-100 p-3 flex-row items-center">
          <WifiOff className="h-4 w-4 text-yellow-800 mr-2" />
          <Text className="text-yellow-800 text-sm">
            Modo sin conexión - Los datos se sincronizarán automáticamente
          </Text>
        </View>
      )}

      {/* Rest of the completion form... */}
      <PhotoCapture photos={photos} onPhotosChange={setPhotos} />
      <ServiceSelector 
        selected={selectedServices} 
        onSelectionChange={setSelectedServices}
        // Price book is cached locally
      />
      <SignaturePad onSignature={setSignature} />
      
      <Button onPress={handleComplete}>
        Completar trabajo
      </Button>
    </ScrollView>
  );
}
```

---

# SECTION 3: OLD ANDROID PERFORMANCE REQUIREMENTS

## Target Devices

| Device | RAM | Storage | Year | Market Share |
|--------|-----|---------|------|--------------|
| Moto G7 | 4GB | 64GB | 2019 | ~15% |
| Moto G8 | 4GB | 64GB | 2020 | ~12% |
| Samsung A10 | 2GB | 32GB | 2019 | ~10% |
| Samsung A20 | 3GB | 32GB | 2019 | ~8% |
| Xiaomi Redmi 8 | 3-4GB | 32-64GB | 2019 | ~10% |
| Xiaomi Redmi 9 | 3-4GB | 32-64GB | 2020 | ~8% |

**Critical constraint:** Samsung A10 with 2GB RAM is our floor.

## Performance Budget

```typescript
// apps/mobile/performance/budgets.ts

export const PERFORMANCE_BUDGETS = {
  // Startup
  coldStart: {
    target: 3000,    // 3 seconds max
    acceptable: 4000, // 4 seconds acceptable
    fail: 5000       // 5 seconds = fail
  },
  warmStart: {
    target: 1000,
    acceptable: 1500,
    fail: 2000
  },

  // Navigation
  screenTransition: {
    target: 300,
    acceptable: 500,
    fail: 800
  },

  // Interactions
  buttonResponse: {
    target: 100,
    acceptable: 200,
    fail: 400
  },
  listScroll: {
    target: 16,  // 60fps
    acceptable: 32, // 30fps minimum
    fail: 50
  },

  // Data operations
  jobListLoad: {
    target: 500,
    acceptable: 1000,
    fail: 2000
  },
  photoCapture: {
    target: 1000,
    acceptable: 2000,
    fail: 3000
  },
  photoCompress: {
    target: 2000,
    acceptable: 3000,
    fail: 5000
  },

  // Memory
  heapSize: {
    target: 150,     // 150MB max
    acceptable: 200,
    fail: 256        // Will crash on 2GB devices
  },

  // Bundle size
  jsBundle: {
    target: 2 * 1024 * 1024,   // 2MB
    acceptable: 3 * 1024 * 1024,
    fail: 5 * 1024 * 1024
  },
  appSize: {
    target: 30 * 1024 * 1024,  // 30MB
    acceptable: 50 * 1024 * 1024,
    fail: 80 * 1024 * 1024
  }
};
```

## Performance Optimizations

```typescript
// apps/mobile/performance/optimizations.ts

/**
 * 1. LAZY LOADING - Don't load screens until needed
 */
// navigation/AppNavigator.tsx
const HomeScreen = React.lazy(() => import('../screens/HomeScreen'));
const JobDetailScreen = React.lazy(() => import('../screens/JobDetailScreen'));
const SettingsScreen = React.lazy(() => import('../screens/SettingsScreen'));

// Wrap in Suspense with minimal loading indicator
<Suspense fallback={<LoadingSpinner />}>
  <HomeScreen />
</Suspense>

/**
 * 2. IMAGE OPTIMIZATION
 */
// components/JobPhoto.tsx
import FastImage from 'react-native-fast-image';

export function JobPhoto({ uri }: { uri: string }) {
  // Use FastImage for better caching and performance
  return (
    <FastImage
      source={{
        uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable
      }}
      resizeMode={FastImage.resizeMode.cover}
      style={{ width: 100, height: 100 }}
    />
  );
}

// Photo compression before save
export async function compressForStorage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }], // Smaller for thumbnails
    { compress: 0.6, format: SaveFormat.JPEG }
  );
  return result.uri;
}

export async function compressForUpload(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }], // Larger for server
    { compress: 0.7, format: SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * 3. LIST VIRTUALIZATION
 */
// components/JobList.tsx
import { FlashList } from '@shopify/flash-list';

export function JobList({ jobs }: { jobs: Job[] }) {
  return (
    <FlashList
      data={jobs}
      renderItem={({ item }) => <JobCard job={item} />}
      estimatedItemSize={120} // Critical for FlashList performance
      // Don't render items off-screen
      removeClippedSubviews={true}
      // Reduce memory usage
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

/**
 * 4. REDUCE RE-RENDERS
 */
// components/JobCard.tsx
export const JobCard = React.memo(function JobCard({ job }: { job: Job }) {
  // Memoize expensive computations
  const formattedDate = useMemo(
    () => formatDate(job.scheduled_date),
    [job.scheduled_date]
  );
  
  const formattedTime = useMemo(
    () => formatTime(job.scheduled_time_start),
    [job.scheduled_time_start]
  );

  return (
    <View>
      <Text>{job.title}</Text>
      <Text>{formattedDate} - {formattedTime}</Text>
    </View>
  );
}, (prev, next) => {
  // Custom comparison - only re-render if these change
  return prev.job.id === next.job.id &&
         prev.job.status === next.job.status &&
         prev.job.updated_at === next.job.updated_at;
});

/**
 * 5. STARTUP OPTIMIZATION
 */
// App.tsx
export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      // Load critical data first
      await Promise.all([
        loadUser(),
        loadCachedJobs(), // From WatermelonDB, fast
      ]);
      
      // Defer non-critical initialization
      requestAnimationFrame(() => {
        initializePushNotifications();
        initializeSyncManager();
      });
      
      setIsReady(true);
    }
    prepare();
  }, []);

  if (!isReady) {
    return <SplashScreen />;
  }

  return <AppNavigator />;
}

/**
 * 6. MEMORY MANAGEMENT
 */
// hooks/useMemoryWarning.ts
import { useEffect } from 'react';
import { AppState, Platform, NativeModules } from 'react-native';

export function useMemoryWarning() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Clear caches when memory is low
      AppState.addEventListener('memoryWarning', () => {
        // Clear image cache
        FastImage.clearMemoryCache();
        
        // Force garbage collection hint
        if (global.gc) {
          global.gc();
        }
        
        console.warn('Memory warning received, caches cleared');
      });
    }
  }, []);
}

/**
 * 7. BUNDLE SIZE OPTIMIZATION
 */
// babel.config.js
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    // Remove console.log in production
    ['transform-remove-console', { exclude: ['error', 'warn'] }],
    // Tree shaking for lodash
    'lodash',
    // Hermes optimization
    ['@babel/plugin-transform-flow-strip-types'],
  ],
};

// metro.config.js
module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true, // Critical for startup
      },
    }),
  },
};
```

## Performance Testing Matrix

```typescript
// apps/mobile/performance/testing.ts

export const DEVICE_TEST_MATRIX = [
  {
    device: 'Samsung A10',
    ram: '2GB',
    android: '9',
    critical: true, // Lowest spec we support
    tests: [
      'cold_start_under_4s',
      'job_list_scroll_30fps',
      'photo_capture_under_3s',
      'no_oom_after_50_photos',
      'offline_job_complete'
    ]
  },
  {
    device: 'Moto G7',
    ram: '4GB',
    android: '10',
    critical: true,
    tests: [
      'cold_start_under_3s',
      'job_list_scroll_60fps',
      'photo_capture_under_2s',
      'offline_sync_queue_100_items'
    ]
  },
  {
    device: 'Xiaomi Redmi 8',
    ram: '3GB',
    android: '9',
    critical: true,
    tests: [
      'cold_start_under_3s',
      'heap_under_150mb',
      'background_sync_no_battery_drain'
    ]
  }
];

// Automated performance test
export async function runPerformanceTests(device: TestDevice): Promise<TestResults> {
  const results: TestResults = {
    device: device.device,
    timestamp: new Date(),
    tests: []
  };

  // Cold start test
  const coldStart = await measureColdStart();
  results.tests.push({
    name: 'cold_start',
    value: coldStart,
    passed: coldStart < PERFORMANCE_BUDGETS.coldStart.acceptable
  });

  // Memory test
  const heapSize = await measureHeapSize();
  results.tests.push({
    name: 'heap_size',
    value: heapSize,
    passed: heapSize < PERFORMANCE_BUDGETS.heapSize.acceptable
  });

  // Scroll test
  const scrollFps = await measureScrollFps();
  results.tests.push({
    name: 'scroll_fps',
    value: scrollFps,
    passed: scrollFps >= 30
  });

  return results;
}
```

---

# SECTION 4: CONCURRENCY & LOCKING STRATEGY

## The Problem

Without proper locking:
- AFIP retry creates duplicate invoices
- MP webhook + reconciliation double-processes payment
- WhatsApp retry sends duplicate messages
- Panic mode switches cause race conditions

## Idempotency Keys

```typescript
// infrastructure/idempotency/IdempotencyService.ts

export class IdempotencyService {
  constructor(private redis: Redis) {}

  /**
   * Execute an operation with idempotency guarantee
   */
  async executeOnce<T>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds: number = 86400 // 24 hours
  ): Promise<{ result: T; wasExecuted: boolean }> {
    const lockKey = `idempotency:${key}`;
    const resultKey = `idempotency:result:${key}`;

    // Check if already executed
    const existingResult = await this.redis.get(resultKey);
    if (existingResult) {
      return {
        result: JSON.parse(existingResult),
        wasExecuted: false
      };
    }

    // Try to acquire lock
    const acquired = await this.redis.set(
      lockKey,
      'locked',
      'NX', // Only set if not exists
      'EX', // Expire
      60    // 60 seconds lock timeout
    );

    if (!acquired) {
      // Another process is executing, wait and check result
      await this.waitForResult(resultKey);
      const result = await this.redis.get(resultKey);
      if (result) {
        return { result: JSON.parse(result), wasExecuted: false };
      }
      throw new Error('Idempotency lock timeout');
    }

    try {
      // Execute operation
      const result = await operation();

      // Store result
      await this.redis.setex(resultKey, ttlSeconds, JSON.stringify(result));

      return { result, wasExecuted: true };
    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  private async waitForResult(key: string, maxWaitMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.redis.get(key);
      if (result) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Usage examples:

// AFIP Invoice Creation
async function createInvoiceIdempotent(invoiceData: InvoiceData): Promise<Invoice> {
  const idempotencyKey = `invoice:${invoiceData.org_id}:${invoiceData.job_id}`;
  
  const { result, wasExecuted } = await idempotencyService.executeOnce(
    idempotencyKey,
    async () => {
      // This will only run once, even if called multiple times
      return await afipService.createInvoice(invoiceData);
    }
  );

  if (!wasExecuted) {
    console.log('Invoice already created, returning cached result');
  }

  return result;
}

// Mercado Pago Webhook Processing
async function processMPWebhook(webhookData: MPWebhook): Promise<void> {
  const idempotencyKey = `mp_webhook:${webhookData.id}`;
  
  await idempotencyService.executeOnce(
    idempotencyKey,
    async () => {
      await paymentService.processPayment(webhookData);
    }
  );
}

// WhatsApp Message Send
async function sendWhatsAppIdempotent(message: OutboundMessage): Promise<void> {
  const idempotencyKey = `wa_send:${message.org_id}:${message.template}:${message.to}:${message.params.job_id}`;
  
  await idempotencyService.executeOnce(
    idempotencyKey,
    async () => {
      await whatsAppService.send(message);
    },
    3600 // 1 hour TTL for message deduplication
  );
}
```

## Distributed Locks

```typescript
// infrastructure/locking/DistributedLock.ts

export class DistributedLock {
  constructor(private redis: Redis) {}

  /**
   * Acquire a distributed lock
   */
  async acquire(
    resource: string,
    ttlMs: number = 30000
  ): Promise<LockHandle | null> {
    const lockId = crypto.randomUUID();
    const key = `lock:${resource}`;

    const acquired = await this.redis.set(
      key,
      lockId,
      'NX',
      'PX',
      ttlMs
    );

    if (!acquired) {
      return null;
    }

    return {
      resource,
      lockId,
      release: async () => {
        // Only release if we still own the lock
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await this.redis.eval(script, 1, key, lockId);
      },
      extend: async (additionalMs: number) => {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("pexpire", KEYS[1], ARGV[2])
          else
            return 0
          end
        `;
        await this.redis.eval(script, 1, key, lockId, additionalMs);
      }
    };
  }

  /**
   * Execute with lock (auto-release)
   */
  async withLock<T>(
    resource: string,
    operation: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    const { ttlMs = 30000, waitMs = 5000, retryIntervalMs = 100 } = options;

    const startTime = Date.now();
    let lock: LockHandle | null = null;

    // Try to acquire lock with timeout
    while (Date.now() - startTime < waitMs) {
      lock = await this.acquire(resource, ttlMs);
      if (lock) break;
      await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
    }

    if (!lock) {
      throw new Error(`Failed to acquire lock for ${resource}`);
    }

    try {
      return await operation();
    } finally {
      await lock.release();
    }
  }
}

// Usage examples:

// AFIP Sequential Invoice Numbers
async function getNextInvoiceNumber(orgId: string, puntoVenta: number): Promise<number> {
  return await distributedLock.withLock(
    `invoice_number:${orgId}:${puntoVenta}`,
    async () => {
      // Get current max from AFIP
      const lastNumber = await afipService.getLastInvoiceNumber(orgId, puntoVenta);
      return lastNumber + 1;
    }
  );
}

// Organization Settings Update (prevent race)
async function updateOrgSettings(orgId: string, updates: Partial<OrgSettings>): Promise<void> {
  await distributedLock.withLock(
    `org_settings:${orgId}`,
    async () => {
      const current = await getOrgSettings(orgId);
      const merged = { ...current, ...updates };
      await saveOrgSettings(orgId, merged);
    }
  );
}
```

## Database-Level Constraints

```sql
-- Prevent duplicate invoices for same job
ALTER TABLE invoices ADD CONSTRAINT unique_job_invoice 
  UNIQUE (org_id, job_id) 
  WHERE status != 'cancelled';

-- Prevent duplicate payments for same invoice
ALTER TABLE payments ADD CONSTRAINT unique_invoice_payment
  UNIQUE (invoice_id, mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

-- Prevent duplicate WhatsApp messages (same template to same number for same job)
CREATE UNIQUE INDEX idx_unique_whatsapp_message 
  ON whatsapp_messages (org_id, template_name, customer_id, job_id)
  WHERE template_name IS NOT NULL 
    AND status != 'failed'
    AND created_at > NOW() - INTERVAL '1 hour';

-- MP webhook idempotency
CREATE TABLE mp_webhook_processed (
  webhook_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  result JSONB
);

-- Before processing webhook
INSERT INTO mp_webhook_processed (webhook_id) 
VALUES ($1) 
ON CONFLICT (webhook_id) DO NOTHING
RETURNING webhook_id;
-- If returns null, webhook was already processed
```

## Concurrency Test Cases

```typescript
// tests/concurrency/concurrency.test.ts

describe('Concurrency Safety', () => {
  describe('AFIP Invoice Creation', () => {
    it('should not create duplicate invoices when called concurrently', async () => {
      const invoiceData = createTestInvoiceData();
      
      // Call 10 times concurrently
      const promises = Array(10).fill(null).map(() => 
        createInvoiceIdempotent(invoiceData)
      );
      
      const results = await Promise.allSettled(promises);
      const successfulInvoices = results.filter(r => r.status === 'fulfilled');
      
      // Should all return the same invoice
      const invoiceIds = new Set(
        successfulInvoices.map(r => (r as PromiseFulfilledResult<Invoice>).value.id)
      );
      expect(invoiceIds.size).toBe(1);
      
      // Database should have exactly 1 invoice
      const count = await db.invoices.count({ job_id: invoiceData.job_id });
      expect(count).toBe(1);
    });
  });

  describe('Mercado Pago Webhooks', () => {
    it('should process webhook only once even if received multiple times', async () => {
      const webhookData = createTestWebhook();
      
      // Simulate webhook being sent 5 times
      const promises = Array(5).fill(null).map(() =>
        processMPWebhook(webhookData)
      );
      
      await Promise.allSettled(promises);
      
      // Payment should be marked paid exactly once
      const payment = await db.payments.findOne({ mp_payment_id: webhookData.data.id });
      expect(payment.status).toBe('paid');
      
      // Check audit log for single processing
      const processLogs = await db.mp_webhook_processed.count({ 
        webhook_id: webhookData.id 
      });
      expect(processLogs).toBe(1);
    });
  });

  describe('WhatsApp Messages', () => {
    it('should not send duplicate messages for same job notification', async () => {
      const message = createTestMessage();
      
      // Try to send 3 times rapidly
      const promises = Array(3).fill(null).map(() =>
        sendWhatsAppIdempotent(message)
      );
      
      await Promise.allSettled(promises);
      
      // Should have sent only 1 message
      const sentMessages = await db.whatsapp_messages.count({
        job_id: message.params.job_id,
        template_name: message.template,
        status: Q.notEq('failed')
      });
      expect(sentMessages).toBe(1);
    });
  });
});
```

---

# SECTION 5: ROLLBACK STRATEGY

## Feature Flags

```typescript
// infrastructure/feature-flags/FeatureFlags.ts

interface FeatureFlags {
  // Module-level flags
  afip_enabled: boolean;
  whatsapp_enabled: boolean;
  mercadopago_enabled: boolean;
  voice_ai_enabled: boolean;
  offline_mode_enabled: boolean;

  // Feature-level flags
  afip_draft_mode_only: boolean; // Force draft mode even when AFIP is healthy
  whatsapp_sms_fallback: boolean;
  voice_ai_auto_create: boolean; // Auto-create jobs from voice
  voice_ai_human_review_all: boolean; // Force all voice to human review

  // Rollout flags
  new_mobile_ui_enabled: boolean;
  new_completion_flow_enabled: boolean;
}

export class FeatureFlagService {
  private flags: FeatureFlags;
  private overrides: Map<string, Partial<FeatureFlags>> = new Map();

  constructor(private redis: Redis) {
    this.loadFlags();
  }

  /**
   * Check if a feature is enabled
   */
  async isEnabled(flag: keyof FeatureFlags, orgId?: string): Promise<boolean> {
    // Check org-specific override first
    if (orgId) {
      const orgOverride = await this.getOrgOverride(orgId);
      if (orgOverride && flag in orgOverride) {
        return orgOverride[flag] as boolean;
      }
    }

    // Check global flag
    return this.flags[flag];
  }

  /**
   * Emergency kill switch
   */
  async killSwitch(module: 'afip' | 'whatsapp' | 'mercadopago' | 'voice_ai'): Promise<void> {
    const flagKey = `${module}_enabled` as keyof FeatureFlags;
    
    await this.setFlag(flagKey, false);
    
    await this.alertService.sendCritical({
      title: `🚨 KILL SWITCH: ${module.toUpperCase()} disabled`,
      message: `Module ${module} has been disabled via kill switch. All ${module} operations will use fallbacks.`
    });

    // Log for audit
    await this.auditLog({
      action: 'kill_switch',
      module,
      timestamp: new Date(),
      triggeredBy: 'system' // or user ID
    });
  }

  /**
   * Re-enable after kill switch
   */
  async enableModule(module: string): Promise<void> {
    const flagKey = `${module}_enabled` as keyof FeatureFlags;
    await this.setFlag(flagKey, true);
    
    await this.alertService.sendInfo({
      title: `✅ Module re-enabled: ${module.toUpperCase()}`,
      message: `Module ${module} has been re-enabled.`
    });
  }

  /**
   * Gradual rollout to percentage of users
   */
  async isEnabledForPercentage(
    flag: keyof FeatureFlags,
    userId: string,
    percentage: number
  ): Promise<boolean> {
    // Consistent hashing so same user always gets same result
    const hash = this.hashUserId(userId);
    return hash < percentage;
  }
}

// Usage in code:
async function createInvoice(data: InvoiceData): Promise<Invoice> {
  const afipEnabled = await featureFlags.isEnabled('afip_enabled', data.org_id);
  const draftModeOnly = await featureFlags.isEnabled('afip_draft_mode_only', data.org_id);

  if (!afipEnabled || draftModeOnly) {
    // Use draft mode (fallback)
    return await draftInvoiceService.create(data);
  }

  // Normal AFIP flow
  return await afipService.createInvoice(data);
}
```

## Blue-Green Deployments

```yaml
# deployment/kubernetes/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: campotech-api-blue
spec:
  replicas: 2
  selector:
    matchLabels:
      app: campotech-api
      version: blue
  template:
    spec:
      containers:
        - name: api
          image: campotech/api:v1.2.3
          env:
            - name: DEPLOYMENT_COLOR
              value: "blue"

---

apiVersion: apps/v1
kind: Deployment
metadata:
  name: campotech-api-green
spec:
  replicas: 0  # Scaled down when not active
  selector:
    matchLabels:
      app: campotech-api
      version: green
  template:
    spec:
      containers:
        - name: api
          image: campotech/api:v1.2.4  # New version
          env:
            - name: DEPLOYMENT_COLOR
              value: "green"

---

# Service routes to active deployment
apiVersion: v1
kind: Service
metadata:
  name: campotech-api
spec:
  selector:
    app: campotech-api
    version: blue  # Change to 'green' to switch
```

```typescript
// scripts/deploy.ts

async function blueGreenDeploy(newVersion: string): Promise<void> {
  const currentColor = await getCurrentDeploymentColor(); // blue or green
  const newColor = currentColor === 'blue' ? 'green' : 'blue';

  console.log(`Deploying ${newVersion} to ${newColor}`);

  // 1. Deploy new version to inactive color
  await kubectl(`set image deployment/campotech-api-${newColor} api=campotech/api:${newVersion}`);
  await kubectl(`scale deployment/campotech-api-${newColor} --replicas=2`);

  // 2. Wait for healthy
  await waitForHealthy(`campotech-api-${newColor}`);

  // 3. Run smoke tests against new deployment
  const smokeTestsPassed = await runSmokeTests(newColor);
  if (!smokeTestsPassed) {
    console.error('Smoke tests failed, aborting deployment');
    await kubectl(`scale deployment/campotech-api-${newColor} --replicas=0`);
    throw new Error('Deployment aborted due to failed smoke tests');
  }

  // 4. Switch traffic
  await kubectl(`patch service campotech-api -p '{"spec":{"selector":{"version":"${newColor}"}}}'`);

  // 5. Monitor for 5 minutes
  console.log('Monitoring new deployment for 5 minutes...');
  const isStable = await monitorForErrors(5 * 60 * 1000);

  if (!isStable) {
    // 6. Automatic rollback
    console.error('Errors detected, rolling back...');
    await rollback(currentColor);
    throw new Error('Deployment rolled back due to errors');
  }

  // 7. Scale down old deployment
  await kubectl(`scale deployment/campotech-api-${currentColor} --replicas=0`);

  console.log(`Successfully deployed ${newVersion} to ${newColor}`);
}

async function rollback(targetColor: string): Promise<void> {
  console.log(`Rolling back to ${targetColor}`);
  
  // Switch traffic back
  await kubectl(`patch service campotech-api -p '{"spec":{"selector":{"version":"${targetColor}"}}}'`);
  
  // Scale down failed deployment
  const failedColor = targetColor === 'blue' ? 'green' : 'blue';
  await kubectl(`scale deployment/campotech-api-${failedColor} --replicas=0`);

  await alertService.sendCritical({
    title: '🔄 Deployment rolled back',
    message: `Rolled back to ${targetColor} due to errors in new deployment`
  });
}
```

## Mobile App Version Pinning

```typescript
// apps/mobile/services/VersionCheck.ts

export class VersionCheck {
  /**
   * Check if this app version is still supported
   */
  async checkVersion(): Promise<VersionCheckResult> {
    try {
      const response = await fetch(`${API_URL}/api/version-check`, {
        headers: {
          'X-App-Version': APP_VERSION,
          'X-Platform': Platform.OS
        }
      });

      const data = await response.json();

      if (data.forceUpdate) {
        return {
          status: 'force_update',
          message: data.message,
          storeUrl: data.storeUrl
        };
      }

      if (data.suggestUpdate) {
        return {
          status: 'suggest_update',
          message: data.message,
          canDismiss: true
        };
      }

      return { status: 'ok' };
    } catch (error) {
      // If version check fails, allow app to continue
      return { status: 'ok' };
    }
  }
}

// Server-side version configuration
// api/version-check/route.ts
const VERSION_CONFIG = {
  ios: {
    minSupported: '1.0.0',
    latestStable: '1.2.3',
    forceUpdateBelow: '1.0.0'
  },
  android: {
    minSupported: '1.0.0',
    latestStable: '1.2.3',
    forceUpdateBelow: '1.0.0'
  },
  // If we need to force everyone off a broken version
  brokenVersions: ['1.1.5', '1.1.6'] // Force update away from these
};

export async function GET(req: Request): Promise<Response> {
  const appVersion = req.headers.get('X-App-Version');
  const platform = req.headers.get('X-Platform') as 'ios' | 'android';

  const config = VERSION_CONFIG[platform];

  // Force update if broken version
  if (config.brokenVersions.includes(appVersion!)) {
    return Response.json({
      forceUpdate: true,
      message: 'Esta versión tiene un problema. Por favor actualizá la app.',
      storeUrl: getStoreUrl(platform)
    });
  }

  // Force update if below minimum
  if (semver.lt(appVersion!, config.forceUpdateBelow)) {
    return Response.json({
      forceUpdate: true,
      message: 'Tu versión ya no es compatible. Por favor actualizá.',
      storeUrl: getStoreUrl(platform)
    });
  }

  // Suggest update if not latest
  if (semver.lt(appVersion!, config.latestStable)) {
    return Response.json({
      suggestUpdate: true,
      message: `Hay una nueva versión disponible (${config.latestStable})`
    });
  }

  return Response.json({ ok: true });
}
```

## Rollback Runbook

```markdown
# Rollback Runbook

## Scenario 1: API Deployment Broke AFIP

**Symptoms:**
- AFIP errors spike in Sentry
- invoices.draft_fallback metric increasing
- User complaints about invoicing

**Immediate Actions:**
1. Enable AFIP kill switch:
   ```
   curl -X POST https://admin.campotech.com/api/kill-switch/afip \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
   This switches all invoicing to draft mode immediately.

2. If deployment caused it, rollback API:
   ```
   ./scripts/rollback.sh
   ```

3. Investigate logs while users continue working (in draft mode)

**Recovery:**
1. Deploy fix
2. Test in staging with AFIP homologación
3. Disable kill switch:
   ```
   curl -X POST https://admin.campotech.com/api/enable/afip \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
4. Process queued draft invoices

---

## Scenario 2: Mobile App Update Crashes on Old Phones

**Symptoms:**
- Crash reports from Sentry (Samsung A10, Moto G7)
- App store reviews mention crashes
- Support tickets

**Immediate Actions:**
1. Mark version as broken:
   ```
   // Update VERSION_CONFIG.brokenVersions
   brokenVersions: ['1.2.4']
   ```
   This forces users on 1.2.4 to update (back to 1.2.3)

2. If 1.2.3 also has issues, we can't force downgrade from stores.
   Instead:
   - Push emergency fix (1.2.5)
   - Enable feature flag to disable broken feature:
     ```
     curl -X POST https://admin.campotech.com/api/feature-flags \
       -d '{"new_completion_flow_enabled": false}'
     ```

**Recovery:**
1. Identify crash cause from Sentry
2. Test fix on physical devices (Samsung A10!)
3. Deploy 1.2.5
4. Remove 1.2.4 from brokenVersions

---

## Scenario 3: WhatsApp Rate Limited (Messages Not Sending)

**Symptoms:**
- whatsapp.rate_limited metric spiking
- Messages stuck in queue
- Users report clients not receiving notifications

**Immediate Actions:**
1. WhatsApp will auto-fallback to SMS for critical messages
2. Check if it's our issue or Meta's:
   ```
   curl https://www.whatsappstatus.com/api/status
   ```

3. If our issue (sending too fast):
   - Reduce rate limit:
     ```
     curl -X POST https://admin.campotech.com/api/rate-limits \
       -d '{"whatsapp_per_minute": 20}'  # Down from 50
     ```

4. If Meta's issue:
   - Enable SMS fallback for all (not just critical):
     ```
     curl -X POST https://admin.campotech.com/api/feature-flags \
       -d '{"whatsapp_sms_fallback_all": true}'
     ```

**Recovery:**
1. Monitor Meta status
2. Gradually restore rate limit
3. Disable SMS fallback for non-critical
```

---

# SECTION 6: COST ESTIMATES

## Monthly Infrastructure Costs

### Base Infrastructure (Fixed)

| Service | Plan | Monthly Cost | Notes |
|---------|------|--------------|-------|
| Supabase | Pro | $25 | Database + Auth + Storage |
| Vercel | Pro | $20 | API hosting |
| Upstash Redis | Pay-as-you-go | $10 | Rate limiting, caching, locks |
| Sentry | Team | $26 | Error tracking |
| LogTail | Free tier | $0 | Log aggregation (up to 1GB/day) |
| **Total Fixed** | | **$81** | |

### Variable Costs (Per-User/Per-Action)

| Service | Cost Basis | Unit Cost | Notes |
|---------|------------|-----------|-------|
| **OpenAI Whisper** | Per minute audio | $0.006/min | Voice transcription |
| **OpenAI GPT-4o** | Per 1K tokens | $0.01 input, $0.03 output | Entity extraction |
| **WhatsApp Cloud API** | Per conversation | $0.05-0.08/conv | Business-initiated |
| **Twilio SMS** | Per message | $0.05/msg | Fallback only |
| **AFIP SDK** | Per organization | $5-10/org/month | Third-party library |
| **Supabase Storage** | Per GB | $0.021/GB | Job photos |
| **Supabase Bandwidth** | Per GB | $0.09/GB | API traffic |

### Cost Per User Per Month (Detailed)

```typescript
// Assumptions for "typical" user:
// - 60 jobs/month (3 per day, 20 workdays)
// - 40% of jobs come from voice messages
// - 2 photos per job average
// - 4 WhatsApp messages per job (confirm, en route, complete, payment)
// - 10% of messages fall back to SMS
// - Average voice message: 30 seconds

const COST_PER_USER = {
  // Voice AI
  voiceTranscription: {
    jobsFromVoice: 60 * 0.4, // 24 jobs
    avgDurationMinutes: 0.5,
    costPerMinute: 0.006,
    monthly: 24 * 0.5 * 0.006 // $0.072
  },
  
  voiceExtraction: {
    jobsFromVoice: 24,
    avgInputTokens: 500,
    avgOutputTokens: 200,
    inputCost: 24 * 500 * 0.00001, // $0.12
    outputCost: 24 * 200 * 0.00003, // $0.144
    monthly: 0.264 // $0.264
  },

  // WhatsApp
  whatsApp: {
    conversationsPerMonth: 60, // 1 per job
    costPerConversation: 0.06, // avg business-initiated
    monthly: 60 * 0.06 // $3.60
  },

  // SMS (fallback)
  sms: {
    messagesPerMonth: 60 * 4 * 0.1, // 10% fallback
    costPerMessage: 0.05,
    monthly: 24 * 0.05 // $1.20
  },

  // Storage
  storage: {
    photosPerMonth: 60 * 2, // 120 photos
    avgPhotoSizeMB: 0.3, // After compression
    storageCost: 120 * 0.3 * 0.000021, // $0.0008
    monthly: 0.001 // Negligible
  },

  // AFIP SDK (amortized)
  afipSdk: {
    // If we pay $100/month for SDK supporting 100 users
    perUserCost: 1.00
  },

  // Supabase compute (amortized)
  supabaseCompute: {
    // Pro plan supports ~500 concurrent users comfortably
    // At 100 users, amortized
    perUserCost: 0.25
  }
};

const TOTAL_PER_USER = 
  COST_PER_USER.voiceTranscription.monthly +
  COST_PER_USER.voiceExtraction.monthly +
  COST_PER_USER.whatsApp.monthly +
  COST_PER_USER.sms.monthly +
  COST_PER_USER.storage.monthly +
  COST_PER_USER.afipSdk.perUserCost +
  COST_PER_USER.supabaseCompute.perUserCost;

// TOTAL: ~$6.39 per user per month
```

### Cost Projections by Scale

| Users | Fixed Costs | Variable Costs | Total Monthly | Cost/User |
|-------|-------------|----------------|---------------|-----------|
| 10 | $81 | $64 | $145 | $14.50 |
| 50 | $81 | $320 | $401 | $8.02 |
| 100 | $81 | $639 | $720 | $7.20 |
| 250 | $125* | $1,598 | $1,723 | $6.89 |
| 500 | $200* | $3,195 | $3,395 | $6.79 |
| 1000 | $400* | $6,390 | $6,790 | $6.79 |

*Fixed costs increase at scale: Supabase Team ($599), Vercel Team ($150), etc.

### Unit Economics

```typescript
const UNIT_ECONOMICS = {
  // Revenue
  avgRevenuePerUser: 20, // $20 ARPU (mix of $12, $25, $60 plans)
  
  // Costs
  avgCostPerUser: 6.39,
  
  // Gross Margin
  grossMargin: (20 - 6.39) / 20, // 68%
  
  // Customer Acquisition
  estimatedCAC: 30, // $30 via referrals + some ads
  
  // Lifetime Value (assuming 24 month avg lifetime)
  ltv: 20 * 24 * 0.68, // $326
  
  // LTV:CAC Ratio
  ltvCacRatio: 326 / 30, // 10.9x (excellent)
  
  // Payback Period
  paybackMonths: 30 / (20 * 0.68), // 2.2 months (excellent)
};
```

### Cost Optimization Strategies

```typescript
// 1. Voice AI Cost Reduction
// Cache common transcription results (same problem = same extraction)
const voiceCacheStrategy = {
  // Hash audio fingerprint → check cache before OpenAI call
  // 30% of messages are similar enough to cache
  savingsPercent: 0.3,
  monthlySavings: 24 * 0.336 * 0.3 // ~$2.42/user
};

// 2. WhatsApp Cost Reduction
// Use 24-hour free window aggressively
const whatsAppStrategy = {
  // If customer messaged in last 24h, response is free
  // Track last_customer_message_at
  // Send notifications within window when possible
  estimatedFreeTier: 0.4, // 40% of messages in free window
  savingsPercent: 0.4,
  monthlySavings: 3.60 * 0.4 // ~$1.44/user
};

// 3. Storage Optimization
// Aggressive photo compression + auto-delete after 6 months
const storageStrategy = {
  compressionTarget: 0.2, // 200KB per photo (vs 300KB)
  autoDeleteMonths: 6,
  savingsPercent: 0.33
};
```

### Budget Alerts

```typescript
// infrastructure/costs/BudgetMonitor.ts

export class BudgetMonitor {
  private readonly MONTHLY_BUDGET = 1000; // $1000/month cap initially
  private readonly ALERT_THRESHOLD = 0.8; // Alert at 80%

  /**
   * Check daily spend and alert if trending over budget
   */
  async checkBudget(): Promise<void> {
    const currentMonth = new Date().getMonth();
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), currentMonth + 1, 0).getDate();

    // Get current month spend
    const spend = await this.getCurrentMonthSpend();
    
    // Project end-of-month spend
    const dailyRate = spend / dayOfMonth;
    const projectedMonthly = dailyRate * daysInMonth;

    // Alert if projected to exceed budget
    if (projectedMonthly > this.MONTHLY_BUDGET * this.ALERT_THRESHOLD) {
      await this.alertService.sendWarning({
        title: '💰 Budget Alert',
        message: `Projected monthly spend: $${projectedMonthly.toFixed(2)}. ` +
                 `Budget: $${this.MONTHLY_BUDGET}. ` +
                 `Current spend: $${spend.toFixed(2)} (day ${dayOfMonth}/${daysInMonth})`
      });
    }

    // Log for dashboard
    await this.metricsService.gauge('costs.current_month', spend);
    await this.metricsService.gauge('costs.projected_month', projectedMonthly);
  }

  private async getCurrentMonthSpend(): Promise<number> {
    // Aggregate from various sources
    const [openai, whatsapp, sms, supabase] = await Promise.all([
      this.getOpenAISpend(),
      this.getWhatsAppSpend(),
      this.getSMSSpend(),
      this.getSupabaseSpend()
    ]);

    return openai + whatsapp + sms + supabase;
  }
}
```

---

# UPDATED TIMELINE (16 Weeks)

## Changes from v5

| Phase | v5 | v6 | Delta |
|-------|----|----|-------|
| Voice AI | 2 weeks | 3 weeks | +1 week for dataset + annotation pipeline |
| Mobile | 3 weeks | 4 weeks | +1 week for offline mode + performance |
| **Total** | **14 weeks** | **16 weeks** | **+2 weeks** |

## Week-by-Week (Updated)

### Pre-Development (Day -14 to 0)

| Task | Day | Notes |
|------|-----|-------|
| **Collect voice samples** | -14 to -7 | 100 synthetic + partner collection |
| Submit WhatsApp templates | -7 | 5 templates |
| Generate AFIP test certs | -7 | Start homologación |
| Create MP sandbox | -5 | |
| Set up infrastructure | -3 | Supabase, Redis, Sentry |
| Initialize repository | -1 | |

### Weeks 1-2: Foundation + Simple UI
*(Same as v5)*

### Weeks 3-5: AFIP Integration
*(Same as v5, + idempotency keys)*

### Weeks 6-7: Payments + WhatsApp
*(Same as v5, + distributed locks)*

### Weeks 8-10: Voice AI (Extended)

| Week | Deliverables |
|------|--------------|
| 8 | Whisper integration, basic extraction, 50% accuracy target |
| 9 | Few-shot examples, annotation UI, human review queue |
| 10 | Edge case handling, confidence routing, 70% accuracy target |

### Weeks 11-14: Mobile App (Extended)

| Week | Deliverables |
|------|--------------|
| 11 | Core app, WatermelonDB setup, auth |
| 12 | Job list, job detail, status updates, sync manager |
| 13 | Offline completion flow, photo handling, signature |
| 14 | Performance optimization, old device testing, polish |

### Week 15: Integration Testing + Observability
*(Same as v5 Week 13)*

### Week 16: Launch
*(Same as v5 Week 14)*

---

# SUCCESS METRICS (Updated)

## Launch Day (Week 16)

| Metric | Target |
|--------|--------|
| Signup to first job | < 2 minutes |
| First job to paid invoice | < 30 seconds |
| **Voice AI accuracy** | **≥ 70%** |
| **Offline job completion** | **Works on Samsung A10** |
| **Cold start (Samsung A10)** | **< 4 seconds** |
| Visible errors | 0 |
| Duplicate invoices | 0 |

## Month 1

| Metric | Target |
|--------|--------|
| Pilot customers | 10 |
| **Cost per user** | **< $8** |
| **Voice AI human review rate** | **< 30%** |
| **Offline sync success rate** | **> 95%** |
| Panic mode activations | < 5 |

## Month 3

| Metric | Target |
|--------|--------|
| Paying customers | 50 |
| **MRR** | **$1,000** |
| **Gross margin** | **> 65%** |
| Voice AI accuracy | > 80% |
| Monthly churn | < 10% |

---

# FINAL CHECKLIST (Updated)

## Before Launch

**Onboarding:**
- [ ] Signup is exactly 2 fields (CUIT + name)
- [ ] No blocking wizards anywhere
- [ ] All integrations are just-in-time

**Reliability:**
- [ ] AFIP fallback to draft working
- [ ] WhatsApp fallback to SMS working
- [ ] MP fallback to cash/transfer working
- [ ] Idempotency keys on all critical operations
- [ ] Distributed locks on sequential operations
- [ ] No duplicate invoices possible (DB constraint)
- [ ] No duplicate payments possible (DB constraint)

**Voice AI:**
- [ ] 200+ training samples collected
- [ ] Human review queue functional
- [ ] Accuracy ≥ 70% on test set
- [ ] Annotation pipeline captures corrections

**Mobile:**
- [ ] Offline job completion works
- [ ] Sync queue processes correctly
- [ ] Cold start < 4s on Samsung A10
- [ ] No OOM on 2GB RAM devices
- [ ] Photo compression working

**Observability:**
- [ ] All queues monitored
- [ ] DLQ being watched
- [ ] Alerts going to Slack + SMS
- [ ] Cost tracking dashboard

**Rollback:**
- [ ] Feature flags for all modules
- [ ] Kill switches tested
- [ ] Blue-green deployment ready
- [ ] Mobile version pinning configured

**Costs:**
- [ ] Budget alerts configured
- [ ] Cost per user tracking
- [ ] Token usage monitoring

---

*Document Version: 6.0 (Production-Ready)*
*Last Updated: December 2025*
*Timeline: 16 weeks*
*Budget: ~$720/month at 100 users*
