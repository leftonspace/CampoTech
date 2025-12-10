/**
 * Maintenance Banner Component
 * ============================
 *
 * Shows a Spanish-language maintenance banner when a capability is disabled.
 * Auto-activates based on capability status.
 */

'use client';

import { AlertTriangle, X, Wrench } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface MaintenanceBannerProps {
  /** The capability that is disabled */
  capability?: string;
  /** Custom message to display */
  message?: string;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Variant styling */
  variant?: 'warning' | 'error' | 'info';
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Additional class names */
  className?: string;
}

const DEFAULT_MESSAGES: Record<string, string> = {
  // External integrations
  'external.afip': 'La facturación electrónica está temporalmente deshabilitada. Por favor, intente más tarde.',
  'external.mercadopago': 'Los pagos online están temporalmente deshabilitados. Por favor, intente más tarde.',
  'external.whatsapp': 'La mensajería por WhatsApp está temporalmente deshabilitada. Por favor, intente más tarde.',
  'external.whatsapp_voice_ai': 'El procesamiento de mensajes de voz está temporalmente deshabilitado.',
  'external.push_notifications': 'Las notificaciones push están temporalmente deshabilitadas.',
  // Domain capabilities
  'domain.invoicing': 'La creación de facturas está temporalmente deshabilitada. Por favor, intente más tarde.',
  'domain.payments': 'El registro de pagos está temporalmente deshabilitado. Por favor, intente más tarde.',
  'domain.scheduling': 'La programación de trabajos está temporalmente deshabilitada.',
  'domain.job_assignment': 'La asignación automática de técnicos está temporalmente deshabilitada.',
  'domain.offline_sync': 'La sincronización offline está temporalmente deshabilitada.',
  'domain.technician_gps': 'El seguimiento GPS está temporalmente deshabilitado.',
  'domain.consumer_marketplace': 'El marketplace está temporalmente deshabilitado.',
  'domain.customer_portal': 'El portal del cliente está temporalmente deshabilitado.',
  'domain.inventory_management': 'La gestión de inventario está temporalmente deshabilitada.',
  'domain.audit_logging': 'El registro de auditoría está temporalmente deshabilitado.',
  // Services
  'services.cae_queue': 'El procesamiento de CAE está temporalmente pausado. Las facturas se procesarán cuando se restablezca el servicio.',
  'services.whatsapp_queue': 'La cola de mensajes WhatsApp está temporalmente pausada.',
  'services.whatsapp_aggregation': 'El balance de carga de WhatsApp está temporalmente deshabilitado.',
  'services.payment_reconciliation': 'La reconciliación de pagos está temporalmente deshabilitada.',
  'services.abuse_detection': 'La detección de abuso está temporalmente deshabilitada.',
  'services.rate_limiting': 'Los límites de velocidad están temporalmente deshabilitados.',
  'services.analytics_pipeline': 'El análisis de datos está temporalmente deshabilitado.',
  'services.review_fraud_detection': 'La detección de fraude en reseñas está temporalmente deshabilitada.',
  'services.notification_queue': 'La cola de notificaciones está temporalmente pausada.',
  // UI
  'ui.simple_mode': 'El modo simple está temporalmente deshabilitado.',
  'ui.advanced_mode': 'El modo avanzado está temporalmente deshabilitado.',
  'ui.pricebook': 'La lista de precios está temporalmente deshabilitada.',
  'ui.reporting_dashboard': 'El panel de reportes está temporalmente deshabilitado.',
  'ui.marketplace_dashboard': 'El panel del marketplace está temporalmente deshabilitado.',
  'ui.whitelabel_portal': 'El portal personalizado está temporalmente deshabilitado.',
};

const VARIANT_STYLES = {
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: 'text-amber-500',
    dismiss: 'text-amber-600 hover:bg-amber-100',
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: 'text-red-500',
    dismiss: 'text-red-600 hover:bg-red-100',
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: 'text-blue-500',
    dismiss: 'text-blue-600 hover:bg-blue-100',
  },
};

/**
 * Displays a maintenance banner in Spanish when a capability is disabled
 */
export function MaintenanceBanner({
  capability,
  message,
  dismissible = true,
  variant = 'warning',
  onDismiss,
  className,
}: MaintenanceBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const displayMessage = message ||
    (capability && DEFAULT_MESSAGES[capability]) ||
    'Esta función está temporalmente deshabilitada. Por favor, intente más tarde.';

  const styles = VARIANT_STYLES[variant];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        styles.container,
        className
      )}
    >
      <div className={cn('shrink-0 mt-0.5', styles.icon)}>
        {variant === 'error' ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          <Wrench className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          {variant === 'error' ? 'Servicio no disponible' : 'En mantenimiento'}
        </p>
        <p className="mt-1 text-sm opacity-90">
          {displayMessage}
        </p>
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={cn(
            'shrink-0 rounded-md p-1.5 transition-colors',
            styles.dismiss
          )}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Full-page maintenance overlay for completely disabled features
 */
export function MaintenanceOverlay({
  capability,
  message,
  title = 'Función en mantenimiento',
}: {
  capability?: string;
  message?: string;
  title?: string;
}) {
  const displayMessage = message ||
    (capability && DEFAULT_MESSAGES[capability]) ||
    'Esta función está temporalmente deshabilitada. Por favor, intente más tarde.';

  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <Wrench className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-3 text-gray-600">{displayMessage}</p>
        <p className="mt-4 text-sm text-gray-500">
          Disculpe las molestias. Estamos trabajando para restablecer el servicio lo antes posible.
        </p>
      </div>
    </div>
  );
}

/**
 * Hook to check capability and show banner
 */
export function useCapabilityBanner(capability: string, enabled: boolean) {
  return {
    showBanner: !enabled,
    bannerProps: {
      capability,
      message: DEFAULT_MESSAGES[capability],
    },
  };
}

export default MaintenanceBanner;
