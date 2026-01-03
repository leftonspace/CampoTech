---
description: Error handling patterns - how errors should be handled consistently in CampoTech
---

# ⚠️ Error Handling Patterns

## Core Principles

1. **Never swallow errors silently** - Always log or report
2. **User-friendly messages** - Technical details in logs, friendly text to users
3. **Consistent structure** - Use standard error response format
4. **Recovery over failure** - Try to recover when possible

## Standard Error Response Format

### API Error Response
```typescript
interface ApiErrorResponse {
  error: {
    code: string;           // Machine-readable code
    message: string;        // User-friendly message
    details?: unknown;      // Additional context (dev only)
  };
  status: number;           // HTTP status code
}

// Example
{
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "No se encontró el cliente solicitado",
    "details": { "customerId": "cust_123" }
  },
  "status": 404
}
```

## API Route Error Handling

### Standard Pattern
```typescript
import { NextResponse } from 'next/server';
import { AppError, handleError } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    // Your logic here
    const data = await fetchData();
    return NextResponse.json(data);
    
  } catch (error) {
    return handleError(error);
  }
}
```

### Error Handler Implementation
```typescript
// lib/errors.ts

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown): NextResponse {
  console.error('[API Error]', error);
  
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  
  if (error instanceof Error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: { code: 'UNKNOWN_ERROR', message: 'Error desconocido' } },
    { status: 500 }
  );
}
```

## Common Error Codes

### Authentication Errors (401)
```typescript
throw new AppError('UNAUTHORIZED', 'No autorizado', 401);
throw new AppError('SESSION_EXPIRED', 'La sesión ha expirado', 401);
throw new AppError('INVALID_TOKEN', 'Token inválido', 401);
```

### Authorization Errors (403)
```typescript
throw new AppError('FORBIDDEN', 'No tiene permisos para esta acción', 403);
throw new AppError('ROLE_REQUIRED', 'Se requiere rol de administrador', 403);
throw new AppError('ORG_MISMATCH', 'No pertenece a esta organización', 403);
```

### Not Found Errors (404)
```typescript
throw new AppError('CUSTOMER_NOT_FOUND', 'Cliente no encontrado', 404);
throw new AppError('JOB_NOT_FOUND', 'Trabajo no encontrado', 404);
throw new AppError('INVOICE_NOT_FOUND', 'Factura no encontrada', 404);
```

### Validation Errors (400)
```typescript
throw new AppError('INVALID_CUIT', 'CUIT inválido', 400);
throw new AppError('INVALID_PHONE', 'Número de teléfono inválido', 400);
throw new AppError('MISSING_FIELD', 'Campo requerido faltante', 400, { field: 'name' });
```

### Business Logic Errors (422)
```typescript
throw new AppError('INVOICE_ALREADY_PAID', 'La factura ya está pagada', 422);
throw new AppError('JOB_CANNOT_CANCEL', 'No se puede cancelar un trabajo completado', 422);
throw new AppError('CAE_ALREADY_REQUESTED', 'Ya se solicitó CAE para esta factura', 422);
```

### External Service Errors (502/503)
```typescript
throw new AppError('AFIP_UNAVAILABLE', 'AFIP no disponible temporalmente', 503);
throw new AppError('WHATSAPP_ERROR', 'Error al enviar mensaje de WhatsApp', 502);
throw new AppError('MP_PAYMENT_FAILED', 'Error al procesar pago', 502);
```

## Service Layer Error Handling

### Service with Error Wrapping
```typescript
// lib/services/customer-service.ts

export async function getCustomer(id: string, orgId: string) {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id, orgId },
    });
    
    if (!customer) {
      throw new AppError('CUSTOMER_NOT_FOUND', 'Cliente no encontrado', 404);
    }
    
    return customer;
    
  } catch (error) {
    if (error instanceof AppError) throw error;
    
    console.error('[CustomerService] Error:', error);
    throw new AppError(
      'CUSTOMER_FETCH_ERROR',
      'Error al obtener cliente',
      500
    );
  }
}
```

## Client-Side Error Handling

### API Call Pattern
```typescript
async function fetchCustomers() {
  try {
    const response = await fetch('/api/customers');
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error al cargar clientes');
    }
    
    return await response.json();
    
  } catch (error) {
    // Show user-friendly toast/notification
    toast.error(error instanceof Error ? error.message : 'Error desconocido');
    throw error;
  }
}
```

### React Error Boundary
```typescript
// components/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center">
          <h2>Algo salió mal</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Logging Best Practices

### Log Levels
```typescript
console.error('[CRITICAL]', error);  // System failures
console.warn('[WARNING]', message);   // Recoverable issues
console.info('[INFO]', data);         // Important events
console.debug('[DEBUG]', details);    // Development only
```

### Structured Logging
```typescript
function logError(context: string, error: unknown, metadata?: object) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    ...metadata,
  }));
}
```

## External Service Error Handling

### AFIP Errors
```typescript
async function requestCAE(invoiceId: string) {
  try {
    const result = await afipService.requestCAE(invoiceId);
    return result;
    
  } catch (error) {
    // Log full error for debugging
    console.error('[AFIP] CAE request failed:', error);
    
    // Check for known AFIP error codes
    if (error instanceof AfipError) {
      if (error.code === 10016) {
        throw new AppError('INVALID_CUIT', 'CUIT inválido en AFIP', 400);
      }
      if (error.code === 10017) {
        throw new AppError('PV_NOT_AUTHORIZED', 'Punto de venta no autorizado', 400);
      }
    }
    
    // Generic AFIP error
    throw new AppError('AFIP_ERROR', 'Error al comunicarse con AFIP', 503);
  }
}
```

### WhatsApp Errors
```typescript
async function sendWhatsApp(to: string, template: string) {
  try {
    return await whatsappService.send(to, template);
    
  } catch (error) {
    console.error('[WhatsApp] Send failed:', error);
    
    // Fallback to SMS for critical messages
    if (isCriticalMessage(template)) {
      console.info('[WhatsApp] Falling back to SMS');
      return await smsService.send(to, template);
    }
    
    throw new AppError('WHATSAPP_SEND_FAILED', 'Error al enviar WhatsApp', 502);
  }
}
```

## Never Do This

```typescript
// ❌ Swallowing errors silently
try {
  await riskyOperation();
} catch (e) {
  // Silent fail - BAD!
}

// ❌ Exposing internal errors to users
catch (error) {
  return NextResponse.json({ error: error.stack }, { status: 500 });
}

// ❌ Generic error messages everywhere
throw new Error('Error'); // Not helpful!

// ❌ Catching errors just to re-throw
try {
  await operation();
} catch (e) {
  throw e; // Pointless!
}
```
