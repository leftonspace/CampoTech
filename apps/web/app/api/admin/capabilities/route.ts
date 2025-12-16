/**
 * Admin Capabilities API
 * ======================
 *
 * GET: List all capabilities with their current status
 * POST: Create/update a capability override
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  Capabilities,
  getCapabilityService,
  CapabilityPath,
  CapabilityCategory,
} from '../../../../../../core/config/capabilities';

// Spanish descriptions for capabilities
const CAPABILITY_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  // External
  'external.afip': {
    name: 'AFIP - Facturación Electrónica',
    description: 'Emisión de facturas electrónicas con CAE',
  },
  'external.mercadopago': {
    name: 'MercadoPago',
    description: 'Procesamiento de pagos online y cuotas',
  },
  'external.whatsapp': {
    name: 'WhatsApp Business',
    description: 'Mensajería con clientes via WhatsApp',
  },
  'external.whatsapp_voice_ai': {
    name: 'Voice AI',
    description: 'Procesamiento de mensajes de voz con IA',
  },
  'external.push_notifications': {
    name: 'Notificaciones Push',
    description: 'Envío de notificaciones a la app móvil',
  },
  // Domain
  'domain.invoicing': {
    name: 'Facturación',
    description: 'Creación y gestión de facturas',
  },
  'domain.payments': {
    name: 'Pagos',
    description: 'Procesamiento y registro de pagos',
  },
  'domain.scheduling': {
    name: 'Agenda',
    description: 'Programación de trabajos y calendario',
  },
  'domain.job_assignment': {
    name: 'Asignación de Técnicos',
    description: 'Asignación automática de técnicos a trabajos',
  },
  'domain.offline_sync': {
    name: 'Sincronización Offline',
    description: 'Sincronización de datos sin conexión',
  },
  'domain.technician_gps': {
    name: 'GPS de Técnicos',
    description: 'Seguimiento de ubicación en tiempo real',
  },
  'domain.consumer_marketplace': {
    name: 'Marketplace de Consumidores',
    description: 'Portal de búsqueda para clientes',
  },
  'domain.customer_portal': {
    name: 'Portal del Cliente',
    description: 'Portal de seguimiento para clientes',
  },
  'domain.inventory_management': {
    name: 'Gestión de Inventario',
    description: 'Control de stock y materiales',
  },
  'domain.audit_logging': {
    name: 'Auditoría',
    description: 'Registro de cambios del sistema',
  },
  // Services
  'services.cae_queue': {
    name: 'Cola de CAE',
    description: 'Procesamiento en cola de solicitudes AFIP',
  },
  'services.whatsapp_queue': {
    name: 'Cola de WhatsApp',
    description: 'Procesamiento en cola de mensajes',
  },
  'services.whatsapp_aggregation': {
    name: 'Agregación WhatsApp',
    description: 'Balance de carga entre múltiples números',
  },
  'services.payment_reconciliation': {
    name: 'Reconciliación de Pagos',
    description: 'Conciliación automática con MercadoPago',
  },
  'services.abuse_detection': {
    name: 'Detección de Abuso',
    description: 'Protección contra actividad sospechosa',
  },
  'services.rate_limiting': {
    name: 'Límite de Velocidad',
    description: 'Protección contra sobrecarga de API',
  },
  'services.analytics_pipeline': {
    name: 'Análisis de Datos',
    description: 'Recolección de métricas y estadísticas',
  },
  'services.review_fraud_detection': {
    name: 'Detección de Fraude en Reseñas',
    description: 'Verificación automática de reseñas',
  },
  'services.notification_queue': {
    name: 'Cola de Notificaciones',
    description: 'Procesamiento en cola de notificaciones',
  },
  // UI
  'ui.simple_mode': {
    name: 'Modo Simple',
    description: 'Interfaz simplificada para nuevos usuarios',
  },
  'ui.advanced_mode': {
    name: 'Modo Avanzado',
    description: 'Funcionalidades avanzadas del sistema',
  },
  'ui.pricebook': {
    name: 'Lista de Precios',
    description: 'Gestión de precios predefinidos',
  },
  'ui.reporting_dashboard': {
    name: 'Panel de Reportes',
    description: 'Dashboard de análisis y estadísticas',
  },
  'ui.marketplace_dashboard': {
    name: 'Panel del Marketplace',
    description: 'Administración del marketplace',
  },
  'ui.whitelabel_portal': {
    name: 'Portal Personalizado',
    description: 'Configuración de marca del portal',
  },
};

// Map backend categories to UI categories
const CATEGORY_MAP: Record<CapabilityCategory, 'integration' | 'feature' | 'system'> = {
  external: 'integration',
  domain: 'feature',
  services: 'system',
  ui: 'feature',
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Check if user has owner role
    const roleUpper = session.role?.toUpperCase();
    if (roleUpper !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado - Se requiere rol de administrador' },
        { status: 403 }
      );
    }

    const service = getCapabilityService();
    const snapshot = await service.getFullSnapshot(session.organizationId);
    const overrides = await service.getAllOverrides();

    // Build capability list for UI
    const capabilities: Array<{
      id: string;
      name: string;
      description: string;
      enabled: boolean;
      category: 'integration' | 'feature' | 'system';
      source: string;
      lastChanged?: string;
      changedBy?: string;
      isPanicMode?: boolean;
      panicReason?: string;
    }> = [];

    for (const category of Object.keys(Capabilities) as CapabilityCategory[]) {
      const categoryObj = Capabilities[category];

      for (const capability of Object.keys(categoryObj)) {
        const path = `${category}.${capability}` as CapabilityPath;
        const state = (snapshot[category] as Record<string, { enabled: boolean; source: string }>)[capability];
        const info = CAPABILITY_DESCRIPTIONS[path] || {
          name: capability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `Capacidad: ${path}`,
        };

        // Find override for this capability
        const override = overrides.find(
          o => o.capability_path === path &&
              (o.org_id === session.organizationId || o.org_id === null)
        );

        capabilities.push({
          id: path,
          name: info.name,
          description: info.description,
          enabled: state?.enabled ?? true,
          category: CATEGORY_MAP[category],
          source: state?.source ?? 'static',
          lastChanged: override?.updated_at ? new Date(override.updated_at).toISOString() : undefined,
          changedBy: override?.disabled_by ?? undefined,
          isPanicMode: false, // Will be set by panic mode service
          panicReason: undefined,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: capabilities,
    });
  } catch (error) {
    console.error('Error fetching capabilities:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener capacidades' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Check if user has owner role
    const postRoleUpper = session.role?.toUpperCase();
    if (postRoleUpper !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado - Se requiere rol de administrador' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { capability, enabled, reason, global = false } = body;

    if (!capability) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el campo capability' },
        { status: 400 }
      );
    }

    const service = getCapabilityService();

    const override = await service.setOverride({
      org_id: global ? null : session.organizationId,
      capability_path: capability as CapabilityPath,
      enabled: Boolean(enabled),
      reason: reason || (enabled ? 'Activado manualmente' : 'Desactivado manualmente'),
    }, session.userId);

    if (!override) {
      return NextResponse.json(
        { success: false, error: 'No se pudo guardar el cambio. Verifique la configuración de base de datos.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: override,
      message: enabled
        ? `${capability} activado correctamente`
        : `${capability} desactivado correctamente`,
    });
  } catch (error) {
    console.error('Error updating capability:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar capacidad' },
      { status: 500 }
    );
  }
}
