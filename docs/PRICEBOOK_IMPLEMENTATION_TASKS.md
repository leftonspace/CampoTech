# Pricebook Integration: Implementation Tasks

> **Objetivo:** Implementar todas las funcionalidades faltantes para que el documento `PRICEBOOK_SCENARIOS.md` sea 100% preciso con la realidad del sistema.

**Fecha de creación:** 27 de Enero de 2026  
**Prioridades:** 🔴 Crítico | 🟠 Alto | 🟡 Medio | 🟢 Bajo

---

## ✅ Integrations Completed (27-ene-2026)

The following component/UI integrations have been completed:

| Component | Location | Status |
|-----------|----------|--------|
| `MultiVisitProgress` | `/dashboard/jobs/[id]/page.tsx` | ✅ Integrated |
| `PerVisitQuoteBreakdown` | `/dashboard/jobs/[id]/page.tsx` | ✅ Integrated |
| `RelatedItemsSuggestions` | `PricebookLineItems.tsx` | ✅ Integrated |
| "Enviar Email" button | `/dashboard/invoices/[id]/page.tsx` | ✅ Added |
| Email error handling UI | Invoice detail page | ✅ Added |

> Components are conditionally rendered based on job type (MULTIPLE_VISITS) and context.

---

## Índice de Tareas

1. [AFIP: Invoice → Pricing Lock](#1-afip-invoice--pricing-lock)
2. [WhatsApp: Quote Message Template](#2-whatsapp-quote-message-template)
3. [Multi-Visit: Duration Type Flag](#3-multi-visit-duration-type-flag)
4. [Multi-Visit: Per-Visit Quote Breakdown UI](#4-multi-visit-per-visit-quote-breakdown-ui)
5. [Variance: Approval Workflow UI](#5-variance-approval-workflow-ui)
6. [Variance: Proposed vs Estimated Display](#6-variance-proposed-vs-estimated-display)
7. [Mobile: Pricebook Search Component](#7-mobile-pricebook-search-component)
8. [Mobile: Emergency Notification Enhancement](#8-mobile-emergency-notification-enhancement)
9. [Invoice: Email PDF Sending](#9-invoice-email-pdf-sending)
10. [Pricebook: Related Items Suggestions](#10-pricebook-related-items-suggestions)
11. [WhatsApp: Message Template Customization UI](#11-whatsapp-message-template-customization-ui)
12. [Multi-Visit: Progress Tracking UI](#12-multi-visit-progress-tracking-ui)

---

## 1. AFIP: Invoice → Pricing Lock

### Prioridad: 🔴 Crítico

### Descripción
Cuando se crea una factura vinculada a un trabajo, el sistema debe bloquear automáticamente el pricing del trabajo para cumplir con normativa AFIP.

### Estado Actual
- ✅ Campo `pricingLockedAt` existe en schema
- ✅ Campo `pricingLockedById` existe en schema
- ✅ API de line-items verifica `pricingLockedAt` antes de modificar
- ❌ `InvoiceService.createInvoice()` NO actualiza el job

### Archivos a Modificar

#### 1.1 `src/services/invoice.service.ts`

**Ubicación:** Función `createInvoice()`, después de crear la factura

**Código a agregar:**
```typescript
// Después de: return prisma.invoice.create({ ... })
// Agregar lógica para bloquear pricing del job

// En createInvoice(), cambiar a transacción:
return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
        // ... existing code ...
    });
    
    // Lock job pricing if linked to a job
    if (jobId) {
        await tx.job.update({
            where: { id: jobId, organizationId: orgId },
            data: {
                pricingLockedAt: new Date(),
                pricingLockedById: userId, // Need to pass userId to this method
            },
        });
    }
    
    return invoice;
});
```

**Cambios requeridos:**
1. Modificar firma de `createInvoice()` para aceptar `userId`
2. Envolver en `$transaction`
3. Actualizar job con `pricingLockedAt`

#### 1.2 `apps/web/app/api/invoices/route.ts`

**Cambio:** Pasar `session.userId` a `InvoiceService.createInvoice()`

```typescript
// Línea ~100, cambiar:
const invoice = await InvoiceService.createInvoice(session.organizationId, body);
// A:
const invoice = await InvoiceService.createInvoice(session.organizationId, body, session.userId);
```

### Tests a Crear
- `tests/unit/invoice-pricing-lock.test.ts`
  - Test: Creating invoice locks job pricing
  - Test: Creating invoice without jobId doesn't fail
  - Test: Locked job rejects line item modifications

### Criterios de Aceptación
- [x] ✅ Al crear factura con `jobId`, el trabajo se bloquea (IMPLEMENTADO 27-ene-2026)
- [x] ✅ API `/api/jobs/[id]/line-items` rechaza cambios en trabajos bloqueados
- [x] ✅ UI muestra icono de candado en trabajos bloqueados (badge "Bloqueado" con Lock icon en JobCard)

> **Implementación completada:** Se modificó `InvoiceService.createInvoice()` para usar transacción y actualizar job con `pricingLockedAt`. Se agregó badge visual en la lista de trabajos.

---

## 2. WhatsApp: Quote Message Template

### Prioridad: 🟠 Alto

### Descripción
Crear template de WhatsApp específico para enviar presupuestos al cliente con desglose de items.

### Estado Actual
- ✅ Existe `WhatsAppMessageTemplates` en `lib/whatsapp-links.ts`
- ✅ Existe template de confirmación y reminder
- ❌ No existe template específico para presupuestos

### Archivos a Modificar

#### 2.1 `apps/web/lib/whatsapp-links.ts`

**Agregar nuevo template:**
```typescript
export const WhatsAppMessageTemplates = {
    // ... existing templates ...
    
    quote: (params: {
        customerName: string;
        jobNumber: string;
        lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
        subtotal: number;
        tax: number;
        total: number;
        businessName: string;
    }) => {
        const itemsText = params.lineItems
            .map(item => `• ${item.description} (x${item.quantity}): $${item.total.toLocaleString('es-AR')}`)
            .join('\n');
        
        return `Hola ${params.customerName}, te enviamos el presupuesto de ${params.businessName}:

📋 Trabajo: #${params.jobNumber}

💰 Detalle:
${itemsText}

────────────────
Subtotal: $${params.subtotal.toLocaleString('es-AR')}
IVA (21%): $${params.tax.toLocaleString('es-AR')}
*Total: $${params.total.toLocaleString('es-AR')}*

¿Querés que lo agendemos?`;
    },
};
```

#### 2.2 `apps/web/src/modules/whatsapp/notification-triggers.service.ts`

**Agregar función:**
```typescript
export function getQuoteWhatsAppLink(
    customerPhone: string,
    customerName: string,
    jobNumber: string,
    lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>,
    subtotal: number,
    tax: number,
    total: number,
    businessName: string
): string {
    const message = WhatsAppMessageTemplates.quote({
        customerName,
        jobNumber,
        lineItems,
        subtotal,
        tax,
        total,
        businessName,
    });
    return generateWhatsAppLink(customerPhone, message);
}
```

#### 2.3 `apps/web/app/dashboard/jobs/[id]/page.tsx`

**Agregar botón "Enviar Presupuesto":**
```tsx
// En la sección de acciones rápidas, agregar:
{lineItemsSummary && lineItemsSummary.itemCount > 0 && job.status === 'PENDING' && (
    <a
        href={getQuoteWhatsAppLink(
            job.customer?.phone,
            job.customer?.name,
            job.jobNumber,
            lineItems,
            lineItemsSummary.subtotal,
            lineItemsSummary.tax,
            lineItemsSummary.total,
            organization?.name
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary w-full justify-center"
    >
        <FileText className="mr-2 h-4 w-4" />
        Enviar Presupuesto
    </a>
)}
```

### Criterios de Aceptación
- [x] ✅ Botón "Enviar Presupuesto" aparece cuando hay line items y job está PENDING (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Abre WhatsApp Web con mensaje formateado
- [x] ✅ Incluye todos los items con precios
- [x] ✅ Muestra totales correctamente formateados (Intl.NumberFormat ARS)

> **Implementación completada:**
> - Agregado `quote` template en `WhatsAppMessageTemplates` con formato profesional
> - Creada función `generateQuoteWhatsAppLink()` en `lib/whatsapp-links.ts`
> - Agregado botón "Enviar Presupuesto" en quick actions del job detail page
> - Botón solo visible cuando hay line items y el job está en estado PENDING

---

## 3. Multi-Visit: Duration Type Flag

### Prioridad: 🟡 Medio

### Descripción
Agregar campo `durationType` para distinguir trabajos de una sola visita vs. multi-visita.

### Estado Actual
- ✅ Modelo `JobVisit` existe
- ✅ Se pueden crear múltiples visitas
- ❌ No hay flag explícito `MULTI_VISITA`

### Archivos a Modificar

#### 3.1 `apps/web/prisma/schema.prisma`

**Agregar enum y campo:**
```prisma
enum JobDurationType {
    SINGLE_VISIT
    MULTI_VISIT
}

model Job {
    // ... existing fields ...
    durationType JobDurationType @default(SINGLE_VISIT) @map("duration_type")
}
```

#### 3.2 Migración Prisma
```bash
pnpm prisma migrate dev --name add_job_duration_type
```

#### 3.3 `apps/web/components/jobs/NewJobModal.tsx`

**Agregar selector:**
```tsx
<div className="form-group">
    <label className="label">Tipo de duración</label>
    <select
        value={formData.durationType}
        onChange={(e) => setFormData({ ...formData, durationType: e.target.value })}
        className="input"
    >
        <option value="SINGLE_VISIT">Visita única</option>
        <option value="MULTI_VISIT">Múltiples visitas</option>
    </select>
</div>
```

#### 3.4 `apps/web/types/index.ts`

**Agregar tipo:**
```typescript
export type JobDurationType = 'SINGLE_VISIT' | 'MULTI_VISIT';

export interface Job {
    // ... existing fields ...
    durationType?: JobDurationType;
}
```

### Criterios de Aceptación
- [x] ✅ Campo durationType en schema (IMPLEMENTADO - ya existía en línea 324)
- [x] ✅ Trabajos multi-visita detectados automáticamente por visits.length en NewJobModal
- [x] ✅ API incluye campo en respuesta

> **Implementación completada:** El campo `durationType` con enum `JobDurationType` ya existe en el schema. El NewJobModal determina automáticamente el tipo (SINGLE_VISIT, MULTIPLE_VISITS, RECURRING) basándose en el número de visitas y recurrencia configurada.

---

## 4. Multi-Visit: Per-Visit Quote Breakdown UI

### Prioridad: 🟡 Medio

### Descripción
Mostrar desglose de items agrupados por visita en el presupuesto.

### Estado Actual
- ✅ `JobLineItem` tiene campo `jobVisitId`
- ❌ UI no agrupa items por visita
- ❌ No hay sección visual de "Visita 1", "Visita 2", etc.

### Archivos a Crear/Modificar

#### 4.1 `apps/web/components/jobs/PerVisitQuoteBreakdown.tsx` (NUEVO)

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';

interface Visit {
    id: string;
    visitNumber: number;
    scheduledDate: string | null;
    status: string;
    lineItems: LineItem[];
}

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

interface Props {
    jobId: string;
}

export function PerVisitQuoteBreakdown({ jobId }: Props) {
    const { data: visits } = useQuery({
        queryKey: ['job-visits', jobId],
        queryFn: async () => {
            const res = await fetch(`/api/jobs/${jobId}/visits?includeLineItems=true`);
            return res.json();
        },
    });

    if (!visits?.data?.length) return null;

    return (
        <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Desglose por Visita</h3>
            {visits.data.map((visit: Visit, index: number) => (
                <div key={visit.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">
                            📅 Visita {index + 1}
                            {visit.scheduledDate && ` - ${formatDate(visit.scheduledDate)}`}
                        </h4>
                        <span className={`badge badge-${visit.status.toLowerCase()}`}>
                            {visit.status}
                        </span>
                    </div>
                    <div className="space-y-1">
                        {visit.lineItems.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.description} (x{item.quantity})</span>
                                <span>${item.total.toLocaleString('es-AR')}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between font-medium">
                        <span>Subtotal Visita {index + 1}</span>
                        <span>
                            ${visit.lineItems.reduce((sum, i) => sum + i.total, 0).toLocaleString('es-AR')}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
```

#### 4.2 `apps/web/app/api/jobs/[id]/visits/route.ts`

**Modificar GET para incluir line items:**
```typescript
// Agregar opción includeLineItems
const includeLineItems = searchParams.get('includeLineItems') === 'true';

const visits = await prisma.jobVisit.findMany({
    where: { jobId: id },
    include: includeLineItems ? { lineItems: true } : undefined,
    orderBy: { visitNumber: 'asc' },
});
```

### Criterios de Aceptación
- [x] ✅ Trabajos multi-visita muestran desglose por visita (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Cada visita muestra sus items
- [x] ✅ Subtotal por visita calculado correctamente

> **Implementación completada:** 
> - Creado `apps/web/components/jobs/PerVisitQuoteBreakdown.tsx` - componente con acordeones expandibles por visita
> - Muestra items agrupados, subtotales por visita, y total del proyecto
> - Incluye indicadores de estado por visita (completada/en progreso/pendiente)

---

## 5. Variance: Approval Workflow UI

### Prioridad: 🔴 Crítico

### Descripción
Crear panel en dashboard para que dispatchers aprueben/rechacen variaciones de precio propuestas por técnicos.

### Estado Actual
- ✅ Backend tiene `validatePriceVariance()` en `pricing-calculator.ts`
- ✅ Campo `techProposedTotal` existe
- ✅ Campo `priceVarianceReason` existe
- ❌ NO hay UI para ver trabajos con variaciones pendientes
- ❌ NO hay botones de aprobar/rechazar

### Archivos a Crear/Modificar

#### 5.1 `apps/web/app/dashboard/jobs/pending-variance/page.tsx` (NUEVO)

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function PendingVariancePage() {
    const queryClient = useQueryClient();
    
    const { data: jobs, isLoading } = useQuery({
        queryKey: ['jobs-pending-variance'],
        queryFn: async () => {
            const res = await fetch('/api/jobs?hasPendingVariance=true');
            return res.json();
        },
    });

    const approveMutation = useMutation({
        mutationFn: async ({ jobId, action }: { jobId: string; action: 'approve' | 'reject' }) => {
            const res = await fetch(`/api/jobs/${jobId}/variance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs-pending-variance'] });
        },
    });

    if (isLoading) return <div>Cargando...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">
                <AlertTriangle className="inline mr-2 text-amber-500" />
                Variaciones de Precio Pendientes
            </h1>
            
            {jobs?.data?.length === 0 ? (
                <p className="text-gray-500">No hay variaciones pendientes de aprobación.</p>
            ) : (
                <div className="space-y-4">
                    {jobs?.data?.map((job: any) => {
                        const variance = ((job.techProposedTotal - job.estimatedTotal) / job.estimatedTotal) * 100;
                        const isIncrease = variance > 0;
                        
                        return (
                            <div key={job.id} className="card p-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium">{job.jobNumber}</h3>
                                        <p className="text-sm text-gray-500">{job.customer?.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">Estimado: ${job.estimatedTotal?.toLocaleString('es-AR')}</p>
                                        <p className={`font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                                            Propuesto: ${job.techProposedTotal?.toLocaleString('es-AR')}
                                        </p>
                                        <p className={`text-sm ${isIncrease ? 'text-red-500' : 'text-green-500'}`}>
                                            {isIncrease ? '+' : ''}{variance.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                                
                                {job.priceVarianceReason && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                        <p className="text-sm font-medium text-gray-700">Motivo del técnico:</p>
                                        <p className="text-sm text-gray-600">{job.priceVarianceReason}</p>
                                    </div>
                                )}
                                
                                <div className="mt-4 flex gap-3">
                                    <button
                                        onClick={() => approveMutation.mutate({ jobId: job.id, action: 'approve' })}
                                        disabled={approveMutation.isPending}
                                        className="btn-primary flex-1"
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Aprobar ${job.techProposedTotal?.toLocaleString('es-AR')}
                                    </button>
                                    <button
                                        onClick={() => approveMutation.mutate({ jobId: job.id, action: 'reject' })}
                                        disabled={approveMutation.isPending}
                                        className="btn-outline flex-1"
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Mantener Original
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
```

#### 5.2 `apps/web/app/api/jobs/route.ts`

**Agregar filtro `hasPendingVariance`:**
```typescript
// En GET handler, agregar:
const hasPendingVariance = searchParams.get('hasPendingVariance') === 'true';

if (hasPendingVariance) {
    where.techProposedTotal = { not: null };
    where.finalTotal = null; // Not yet approved
    where.OR = [
        {
            AND: [
                { estimatedTotal: { not: null } },
                // techProposedTotal differs from estimatedTotal
            ]
        }
    ];
}
```

#### 5.3 `apps/web/app/api/jobs/[id]/variance/route.ts` (NUEVO)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    const jobId = params.id;

    const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId: session.organizationId },
    });

    if (!job) {
        return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    if (action === 'approve') {
        // Set finalTotal to techProposedTotal
        await prisma.job.update({
            where: { id: jobId },
            data: {
                finalTotal: job.techProposedTotal,
                varianceApprovedAt: new Date(),
                varianceApprovedById: session.userId,
            },
        });
    } else if (action === 'reject') {
        // Set finalTotal to estimatedTotal, clear proposed
        await prisma.job.update({
            where: { id: jobId },
            data: {
                finalTotal: job.estimatedTotal,
                techProposedTotal: null,
                varianceRejectedAt: new Date(),
                varianceRejectedById: session.userId,
            },
        });
    }

    return NextResponse.json({ success: true });
}
```

#### 5.4 `apps/web/prisma/schema.prisma`

**Agregar campos de auditoría:**
```prisma
model Job {
    // ... existing fields ...
    varianceApprovedAt    DateTime? @map("variance_approved_at")
    varianceApprovedById  String?   @map("variance_approved_by_id")
    varianceRejectedAt    DateTime? @map("variance_rejected_at")
    varianceRejectedById  String?   @map("variance_rejected_by_id")
}
```

#### 5.5 Dashboard Navigation

**Agregar link en sidebar:**
```tsx
// En apps/web/components/layout/Sidebar.tsx o equivalente
<NavItem href="/dashboard/jobs/pending-variance" icon={AlertTriangle}>
    Variaciones Pendientes
    {pendingVarianceCount > 0 && (
        <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
            {pendingVarianceCount}
        </span>
    )}
</NavItem>
```

### Criterios de Aceptación
- [x] ✅ Página lista trabajos con variaciones pendientes (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Muestra precio estimado vs propuesto con %
- [x] ✅ Muestra motivo del técnico
- [x] ✅ Botón "Aprobar" actualiza `finalTotal` a propuesto
- [x] ✅ Botón "Rechazar" mantiene `estimatedTotal`
- [x] ✅ Contador indica cuántas pendientes hay (badge en botón "Variaciones de Precio" del header de Jobs)

> **Implementación completada:**
> - Creado `/api/jobs/[id]/variance/route.ts` con POST (approve/reject/adjust) y GET
> - Creado `/dashboard/jobs/pending-variance/page.tsx` con UI completa
> - Agregados campos `varianceApprovedAt`, `varianceApprovedById`, `varianceRejectedAt`, `varianceRejectedById` en schema
> - Creado componente `PriceVarianceAlert.tsx` para mostrar en detalle de trabajo
> - Agregado link "Variaciones de Precio" con badge contador en header de Jobs page

---

## 6. Variance: Proposed vs Estimated Display

### Prioridad: 🟠 Alto

### Descripción
Mostrar comparación visual entre precio estimado y propuesto por técnico en el detalle del trabajo.

### Estado Actual
- ✅ Campos existen en schema
- ❌ No hay UI que muestre la comparación

### Archivos a Modificar

#### 6.1 `apps/web/app/dashboard/jobs/[id]/page.tsx`

**Agregar sección de variación:**
```tsx
// Después de PricebookLineItems, agregar:
{job.techProposedTotal && job.estimatedTotal && 
 job.techProposedTotal !== job.estimatedTotal && (
    <div className="card p-6 border-amber-300 bg-amber-50">
        <h2 className="mb-4 flex items-center gap-2 font-medium text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            Variación de Precio
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                <p className="text-sm text-gray-500">Estimado original</p>
                <p className="text-lg font-semibold">
                    ${Number(job.estimatedTotal).toLocaleString('es-AR')}
                </p>
            </div>
            <div>
                <p className="text-sm text-gray-500">Propuesto por técnico</p>
                <p className={`text-lg font-bold ${
                    job.techProposedTotal > job.estimatedTotal 
                        ? 'text-red-600' 
                        : 'text-green-600'
                }`}>
                    ${Number(job.techProposedTotal).toLocaleString('es-AR')}
                </p>
            </div>
        </div>
        
        <div className="mt-2">
            <p className={`text-sm font-medium ${
                job.techProposedTotal > job.estimatedTotal 
                    ? 'text-red-600' 
                    : 'text-green-600'
            }`}>
                {job.techProposedTotal > job.estimatedTotal ? '+' : ''}
                {(((job.techProposedTotal - job.estimatedTotal) / job.estimatedTotal) * 100).toFixed(1)}%
            </p>
        </div>
        
        {job.priceVarianceReason && (
            <div className="mt-3 p-3 bg-white rounded">
                <p className="text-sm font-medium text-gray-700">Motivo:</p>
                <p className="text-sm text-gray-600">{job.priceVarianceReason}</p>
            </div>
        )}
        
        {!job.finalTotal && (
            <div className="mt-4 flex gap-3">
                <button className="btn-primary flex-1" onClick={handleApproveVariance}>
                    Aprobar
                </button>
                <button className="btn-outline flex-1" onClick={handleRejectVariance}>
                    Rechazar
                </button>
            </div>
        )}
    </div>
)}
```

### Criterios de Aceptación
- [x] ✅ Sección visible cuando hay variación (PriceVarianceAlert component, IMPLEMENTADO 27-ene-2026)
- [x] ✅ Muestra ambos precios con diferencia %
- [x] ✅ Indicador visual verde/rojo según dirección
- [x] ✅ Botones de acción si no está resuelto

> **Implementación completada:**
> - Se integró componente `PriceVarianceAlert` en job detail page
> - Muestra estimado vs propuesto con % de diferencia
> - Incluye botones Aprobar/Rechazar/Ajustar con llamada a API `/api/jobs/[id]/variance`

---

## 7. Mobile: Pricebook Search Component

### Prioridad: 🟠 Alto

### Descripción
Permitir a técnicos buscar y agregar items del catálogo desde el celular durante completar trabajo.

### Estado Actual
- ✅ Modelo `PriceBookItem` existe en WatermelonDB
- ✅ Sync engine sincroniza pricebook items
- ❌ No hay UI de búsqueda en mobile

### Archivos a Crear

#### 7.1 `apps/mobile/components/pricebook/PricebookSearch.tsx` (NUEVO)

```tsx
import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { database } from '../../watermelon/database';
import { Q } from '@nozbe/watermelondb';

interface PriceBookItem {
    id: string;
    name: string;
    description: string | null;
    unitPrice: number;
    unit: string;
    category: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (item: PriceBookItem) => void;
}

export function PricebookSearch({ visible, onClose, onSelect }: Props) {
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<PriceBookItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (search.length >= 2) {
            searchItems();
        } else {
            setItems([]);
        }
    }, [search]);

    const searchItems = async () => {
        setLoading(true);
        try {
            const priceBookItems = database.get('price_book_items');
            const results = await priceBookItems
                .query(
                    Q.or(
                        Q.where('name', Q.like(`%${search}%`)),
                        Q.where('description', Q.like(`%${search}%`))
                    ),
                    Q.where('is_active', true)
                )
                .fetch();
            
            setItems(results.map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                unitPrice: item.unitPrice,
                unit: item.unit,
                category: item.category,
            })));
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Buscar en Catálogo</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Feather name="x" size={24} color="#374151" />
                    </TouchableOpacity>
                </View>
                
                <View style={styles.searchContainer}>
                    <Feather name="search" size={20} color="#9ca3af" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar servicio o material..."
                        value={search}
                        onChangeText={setSearch}
                        autoFocus
                    />
                </View>
                
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.itemRow}
                            onPress={() => {
                                onSelect(item);
                                onClose();
                            }}
                        >
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                {item.description && (
                                    <Text style={styles.itemDesc} numberOfLines={1}>
                                        {item.description}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.itemPrice}>
                                <Text style={styles.priceText}>
                                    ${item.unitPrice.toLocaleString('es-AR')}
                                </Text>
                                <Text style={styles.unitText}>/{item.unit}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        search.length >= 2 && !loading ? (
                            <Text style={styles.emptyText}>
                                No se encontraron resultados
                            </Text>
                        ) : null
                    }
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: { fontSize: 18, fontWeight: '600', color: '#111827' },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        padding: 12,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111827' },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: '500', color: '#111827' },
    itemDesc: { fontSize: 14, color: '#6b7280', marginTop: 2 },
    itemPrice: { alignItems: 'flex-end' },
    priceText: { fontSize: 16, fontWeight: '600', color: '#16a34a' },
    unitText: { fontSize: 12, color: '#9ca3af' },
    emptyText: { textAlign: 'center', padding: 32, color: '#6b7280' },
});
```

#### 7.2 `apps/mobile/app/(tabs)/jobs/complete.tsx`

**Integrar búsqueda de catálogo:**
```tsx
// Agregar import
import { PricebookSearch } from '../../../components/pricebook/PricebookSearch';

// En el componente, agregar estado:
const [showPricebook, setShowPricebook] = useState(false);

// Agregar handler:
const handlePricebookSelect = (item: any) => {
    setMaterials([
        ...materials,
        {
            name: item.name,
            quantity: 1,
            price: item.unitPrice,
        },
    ]);
};

// En el JSX, agregar botón en la sección de materiales:
<TouchableOpacity
    style={styles.catalogButton}
    onPress={() => setShowPricebook(true)}
>
    <Feather name="book-open" size={20} color="#16a34a" />
    <Text style={styles.catalogButtonText}>Buscar en Catálogo</Text>
</TouchableOpacity>

// Agregar modal:
<PricebookSearch
    visible={showPricebook}
    onClose={() => setShowPricebook(false)}
    onSelect={handlePricebookSelect}
/>
```

### Criterios de Aceptación
- [x] ✅ Componente `PricebookSearch` creado (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Modal de búsqueda con campo de texto y filtro por categoría
- [x] ✅ Resultados de búsqueda local (WatermelonDB con Q.like)
- [x] ✅ Al seleccionar, retorna item con todos los datos necesarios
- [x] ✅ Funciona offline (usa database local)
- [x] ✅ Integración con pantalla `complete.tsx` (IMPLEMENTADO 27-ene-2026)

> **Implementación completada:**
> - Creado `apps/mobile/components/pricebook/PricebookSearch.tsx`
> - Búsqueda usa WatermelonDB queries con Q.like para nombre/descripción
> - Filtro por categorías dinámico
> - Formato de precios ARS con Intl.NumberFormat
> - Integrado en `complete.tsx` con botón "Buscar en Catálogo"
> - Al seleccionar item, se agrega a lista de materiales con precio pre-llenado

---

## 8. Mobile: Emergency Notification Enhancement

### Prioridad: 🟢 Bajo

### Descripción
Notificaciones especiales para trabajos URGENTES con sonido distintivo.

### Archivos a Modificar

#### 8.1 `apps/mobile/lib/notifications/push-handler.ts`

```typescript
// En la configuración de notificaciones:
async function handlePushNotification(notification: any) {
    const priority = notification.data?.priority;
    
    if (priority === 'urgent') {
        // Play special sound
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '🚨 EMERGENCIA',
                body: notification.body,
                sound: 'emergency_alert.wav', // Custom sound file
                priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null,
        });
    } else {
        // Normal notification
        await Notifications.scheduleNotificationAsync({
            content: {
                title: notification.title,
                body: notification.body,
                sound: 'default',
            },
            trigger: null,
        });
    }
}
```

#### 8.2 ~~Agregar sonido de emergencia~~ (No requerido)
- ~~Crear archivo `apps/mobile/assets/sounds/emergency_alert.wav`~~
- Decidido usar sonido del sistema por defecto

### Criterios de Aceptación
- [x] ✅ Trabajos URGENTES tienen vibración diferente (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Notificación muestra emoji 🚨
- [x] ✅ Prioridad alta en Android (aparece arriba, bypass DND)

> **Implementación completada:**
> - Agregado canal 'emergency' en Android con bypassDnd y vibración especial
> - Nueva función `scheduleEmergencyNotification()` con title "🚨 EMERGENCIA: ..."
> - Agregado campo `priority: 'urgent'` en NotificationData
> - ✅ Usa sonido del sistema por defecto (no se requiere custom sound)

---

## 9. Invoice: Email PDF Sending

### Prioridad: 🟡 Medio

### Descripción
Enviar factura PDF por email al cliente automáticamente o manualmente.

### Estado Actual
- ✅ Infrastructure de email existe (`lib/email/`)
- ✅ PDFs se generan
- ❌ No hay función de envío de factura por email

### Archivos a Crear/Modificar

#### 9.1 `apps/web/lib/email/invoice-emails.ts` (NUEVO)

```typescript
import { sendEmail } from './core';

interface InvoiceEmailParams {
    to: string;
    customerName: string;
    invoiceNumber: string;
    invoiceType: 'A' | 'B' | 'C';
    total: number;
    dueDate: string;
    cae?: string;
    caeExpiry?: string;
    pdfUrl: string;
    businessName: string;
    bankInfo: {
        cbu: string;
        alias: string;
    };
}

export async function sendInvoiceEmail(params: InvoiceEmailParams) {
    const subject = `Factura ${params.invoiceType} ${params.invoiceNumber} - ${params.businessName}`;
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Factura ${params.invoiceType} ${params.invoiceNumber}</h2>
            
            <p>Estimado/a ${params.customerName},</p>
            
            <p>Adjuntamos la factura correspondiente a los servicios prestados.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Número:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.invoiceNumber}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        <strong>$${params.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Vencimiento:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.dueDate}</td>
                </tr>
                ${params.cae ? `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>CAE:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.cae}</td>
                </tr>
                ` : ''}
            </table>
            
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Datos para Transferencia</h3>
                <p><strong>CBU:</strong> ${params.bankInfo.cbu}</p>
                <p style="margin-bottom: 0;"><strong>Alias:</strong> ${params.bankInfo.alias}</p>
            </div>
            
            <p>
                <a href="${params.pdfUrl}" 
                   style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px;">
                    Descargar Factura PDF
                </a>
            </p>
            
            <p style="color: #6b7280; font-size: 14px;">
                Gracias por confiar en ${params.businessName}.
            </p>
        </div>
    `;
    
    return sendEmail({
        to: params.to,
        subject,
        html,
        attachments: [
            {
                filename: `Factura_${params.invoiceNumber}.pdf`,
                path: params.pdfUrl,
            },
        ],
    });
}
```

#### 9.2 `apps/web/app/api/invoices/[id]/send-email/route.ts` (NUEVO)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendInvoiceEmail } from '@/lib/email/invoice-emails';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findFirst({
        where: { id: params.id, organizationId: session.organizationId },
        include: {
            customer: true,
            organization: true,
        },
    });

    if (!invoice) {
        return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.customer?.email) {
        return NextResponse.json(
            { success: false, error: 'Customer has no email address' },
            { status: 400 }
        );
    }

    await sendInvoiceEmail({
        to: invoice.customer.email,
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.type.replace('FACTURA_', '') as 'A' | 'B' | 'C',
        total: Number(invoice.total),
        dueDate: invoice.dueDate?.toLocaleDateString('es-AR') || '-',
        cae: invoice.caeNumber || undefined,
        caeExpiry: invoice.caeExpiryDate?.toLocaleDateString('es-AR'),
        pdfUrl: invoice.pdfUrl || '',
        businessName: invoice.organization?.tradeName || invoice.organization?.name || '',
        bankInfo: {
            cbu: invoice.organization?.bankCbu || '',
            alias: invoice.organization?.bankAlias || '',
        },
    });

    // Log email sent
    await prisma.invoice.update({
        where: { id: params.id },
        data: { emailSentAt: new Date() },
    });

    return NextResponse.json({ success: true });
}
```

#### 9.3 `apps/web/app/dashboard/invoices/[id]/page.tsx`

**Agregar botón de envío:**
```tsx
<button
    onClick={handleSendEmail}
    disabled={!invoice.customer?.email || sendingEmail}
    className="btn-outline"
>
    <Mail className="mr-2 h-4 w-4" />
    {sendingEmail ? 'Enviando...' : 'Enviar por Email'}
</button>
```

### Criterios de Aceptación
- [x] ✅ Botón "Enviar por Email" - API lista (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Deshabilitado si cliente no tiene email - validación en API
- [x] ✅ Email incluye todos los datos de factura (template profesional con CBU/Alias)
- [x] ✅ PDF adjunto (IMPLEMENTADO 27-ene-2026 - Resend descarga PDF desde URL)
- [x] ✅ Registro de cuándo se envió (campo emailSentAt)

> **Implementación completada:**
> - Creado `apps/web/lib/email/invoice-emails.ts` - templates profesionales HTML/texto
> - Creado `apps/web/app/api/invoices/[id]/send-email/route.ts` - POST para enviar, GET para status
> - Agregado soporte de attachments a `EmailProvider` interface y `ResendEmailProvider`
> - PDF se adjunta automáticamente - Resend descarga desde la URL del PDF
> - Incluye desglose de items, datos bancarios, y link a PDF en el cuerpo
> - Falta agregar botón en UI de detalle de factura

---

## 10. Pricebook: Related Items Suggestions

### Prioridad: 🟢 Bajo

### Descripción
Sugerir items relacionados cuando se agrega un item del catálogo.

### Estado Actual
- ❌ No existe lógica de sugerencias

### Archivos a Crear/Modificar

#### 10.1 `apps/web/prisma/schema.prisma`

**Agregar relación de items relacionados:**
```prisma
model PriceItem {
    // ... existing fields ...
    relatedItems    PriceItemRelation[] @relation("SourceItem")
    relatedToItems  PriceItemRelation[] @relation("RelatedItem")
}

model PriceItemRelation {
    id            String    @id @default(cuid())
    sourceItemId  String    @map("source_item_id")
    relatedItemId String    @map("related_item_id")
    sourceItem    PriceItem @relation("SourceItem", fields: [sourceItemId], references: [id])
    relatedItem   PriceItem @relation("RelatedItem", fields: [relatedItemId], references: [id])
    createdAt     DateTime  @default(now()) @map("created_at")
    
    @@unique([sourceItemId, relatedItemId])
    @@map("price_item_relations")
}
```

#### 10.2 `apps/web/components/jobs/PricebookLineItems.tsx`

**Mostrar sugerencias después de agregar:**
```tsx
// Después de agregar un item, mostrar:
{lastAddedItem && relatedItems.length > 0 && (
    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm font-medium text-blue-800">
            💡 Items frecuentemente agregados juntos:
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
            {relatedItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    className="text-sm px-3 py-1 bg-white rounded-full border border-blue-200 
                               hover:border-blue-400 transition-colors"
                >
                    + {item.name}
                </button>
            ))}
        </div>
    </div>
)}
```

### Criterios de Aceptación
- [x] ✅ Admin puede definir relaciones entre items (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Al agregar item, muestra sugerencias
- [x] ✅ Click en sugerencia agrega el item

> **Implementación completada:**
> - Agregado modelo `PriceItemRelation` en schema.prisma con peso y bidireccional
> - Creado `GET /api/pricebook/[id]/related` para obtener sugerencias
> - Creado `POST/GET/DELETE /api/pricebook/relations` para gestionar relaciones
> - Creado componente `RelatedItemsSuggestions.tsx` con UI estilo chips
> - Requiere migración de DB y regeneración de Prisma client

---

## 11. WhatsApp: Message Template Customization UI

### Prioridad: 🟢 Bajo

### Descripción
Permitir a organizaciones personalizar los templates de mensajes WhatsApp.

### Archivos a Crear

#### 11.1 `apps/web/app/dashboard/settings/whatsapp/templates/page.tsx` (NUEVO)

Página para editar templates de:
- Confirmación de trabajo
- Recordatorio
- Técnico en camino
- Trabajo completado
- Presupuesto

### Criterios de Aceptación
- [x] ✅ UI para editar cada template (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Variables disponibles ({{customerName}}, {{jobNumber}}, etc.)
- [x] ✅ Preview del mensaje
- [x] ✅ Guardar por organización

> **Implementación completada:**
> - Creada página `/dashboard/settings/whatsapp/templates` con editor completo
> - Templates: confirmación, técnico en camino, completado, presupuesto, recordatorio
> - Vista previa con variables de ejemplo
> - Guardado en campo `whatsappTemplates` (Json) en Organization
> - Creado API `GET/PUT /api/settings/whatsapp/templates`
> - Requiere migración de DB para nuevo campo

---

## 12. Multi-Visit: Progress Tracking UI

### Prioridad: 🟡 Medio

### Descripción
Indicador visual de progreso para trabajos multi-visita.

### Archivos a Modificar

#### 12.1 `apps/web/app/dashboard/jobs/[id]/page.tsx`

**Agregar barra de progreso:**
```tsx
{job.durationType === 'MULTI_VISIT' && (
    <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Progreso del Proyecto</h3>
            <span className="text-sm text-gray-500">
                {completedVisits}/{totalVisits} visitas
            </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
            <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${(completedVisits / totalVisits) * 100}%` }}
            />
        </div>
        <div className="flex justify-between mt-2">
            {visits.map((visit, i) => (
                <div
                    key={visit.id}
                    className={`flex items-center ${
                        visit.status === 'COMPLETED' ? 'text-emerald-600' : 'text-gray-400'
                    }`}
                >
                    {visit.status === 'COMPLETED' ? (
                        <CheckCircle className="h-4 w-4" />
                    ) : (
                        <Circle className="h-4 w-4" />
                    )}
                    <span className="ml-1 text-xs">V{i + 1}</span>
                </div>
            ))}
        </div>
    </div>
)}
```

### Criterios de Aceptación
- [x] ✅ Barra de progreso visible en trabajos multi-visita (IMPLEMENTADO 27-ene-2026)
- [x] ✅ Muestra visitas completadas vs total
- [x] ✅ Indicadores por visita (completada/pendiente)

> **Implementación completada:**
> - Creado `apps/web/components/jobs/MultiVisitProgress.tsx`
> - Incluye barra de progreso gradient, indicadores por visita con tooltips
> - Soporta modo compact para listas y modo full para detalle
> - Falta integrar en página de detalle de trabajo

---

## Resumen de Prioridades

### 🔴 Crítico (Implementar Primero)
1. [AFIP: Invoice → Pricing Lock](#1-afip-invoice--pricing-lock)
5. [Variance: Approval Workflow UI](#5-variance-approval-workflow-ui)

### 🟠 Alto (Segunda Prioridad)
2. [WhatsApp: Quote Message Template](#2-whatsapp-quote-message-template)
6. [Variance: Proposed vs Estimated Display](#6-variance-proposed-vs-estimated-display)
7. [Mobile: Pricebook Search Component](#7-mobile-pricebook-search-component)

### 🟡 Medio (Tercera Prioridad)
3. [Multi-Visit: Duration Type Flag](#3-multi-visit-duration-type-flag)
4. [Multi-Visit: Per-Visit Quote Breakdown UI](#4-multi-visit-per-visit-quote-breakdown-ui)
9. [Invoice: Email PDF Sending](#9-invoice-email-pdf-sending)
12. [Multi-Visit: Progress Tracking UI](#12-multi-visit-progress-tracking-ui)

### 🟢 Bajo (Cuando Haya Tiempo)
8. [Mobile: Emergency Notification Enhancement](#8-mobile-emergency-notification-enhancement)
10. [Pricebook: Related Items Suggestions](#10-pricebook-related-items-suggestions)
11. [WhatsApp: Message Template Customization UI](#11-whatsapp-message-template-customization-ui)

---

## Estimación de Esfuerzo

| Tarea | Complejidad | Horas Estimadas |
|-------|-------------|-----------------|
| 1. Invoice → Pricing Lock | Baja | 2-3h |
| 2. Quote Message Template | Baja | 2-3h |
| 3. Duration Type Flag | Baja | 1-2h |
| 4. Per-Visit Quote UI | Media | 4-6h |
| 5. Variance Approval UI | Alta | 6-8h |
| 6. Proposed vs Estimated | Media | 3-4h |
| 7. Mobile Pricebook Search | Alta | 6-8h |
| 8. Emergency Notifications | Baja | 2-3h |
| 9. Invoice Email | Media | 4-5h |
| 10. Related Suggestions | Media | 4-5h |
| 11. Template Customization | Alta | 8-10h |
| 12. Progress Tracking UI | Baja | 2-3h |
| **TOTAL** | | **44-60h** |

---

*Documento generado: 27 de Enero de 2026*
