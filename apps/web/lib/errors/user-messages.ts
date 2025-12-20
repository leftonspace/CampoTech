/**
 * CampoTech User-Facing Error Messages
 * ======================================
 *
 * Friendly, actionable error messages in Spanish.
 * Each message includes:
 * - Clear explanation
 * - Suggested next steps
 * - Contact support option when needed
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserMessage {
  code: string;
  title: string;
  message: string;
  suggestion?: string;
  supportContact?: boolean;
  retryable?: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export type ErrorCode =
  // Authentication
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'AUTH_EMAIL_NOT_VERIFIED'
  | 'AUTH_TOO_MANY_ATTEMPTS'

  // Verification
  | 'VERIFY_CUIT_INVALID'
  | 'VERIFY_CUIT_DUPLICATE'
  | 'VERIFY_CUIT_AFIP_UNAVAILABLE'
  | 'VERIFY_DNI_INVALID'
  | 'VERIFY_DNI_MISMATCH'
  | 'VERIFY_SELFIE_FAILED'
  | 'VERIFY_PHONE_INVALID'
  | 'VERIFY_PHONE_CODE_EXPIRED'
  | 'VERIFY_PHONE_TOO_MANY_ATTEMPTS'
  | 'VERIFY_DOCUMENT_EXPIRED'
  | 'VERIFY_DOCUMENT_REJECTED'
  | 'VERIFY_INCOMPLETE'

  // Payment
  | 'PAYMENT_FAILED'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_INSUFFICIENT_FUNDS'
  | 'PAYMENT_CARD_EXPIRED'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_TIMEOUT'
  | 'PAYMENT_REFUND_FAILED'

  // Subscription
  | 'SUB_TRIAL_EXPIRED'
  | 'SUB_PAYMENT_REQUIRED'
  | 'SUB_CANCELLED'
  | 'SUB_DOWNGRADE_SCHEDULED'
  | 'SUB_UPGRADE_FAILED'

  // Account/Organization
  | 'ORG_NOT_FOUND'
  | 'ORG_BLOCKED_SOFT'
  | 'ORG_BLOCKED_HARD'
  | 'ORG_DELETED'
  | 'ORG_OWNER_REQUIRED'

  // File Upload
  | 'UPLOAD_FAILED'
  | 'UPLOAD_TOO_LARGE'
  | 'UPLOAD_INVALID_FORMAT'
  | 'UPLOAD_TIMEOUT'

  // Network/System
  | 'NETWORK_ERROR'
  | 'NETWORK_TIMEOUT'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'UNKNOWN_ERROR';

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR MESSAGES (Spanish)
// ═══════════════════════════════════════════════════════════════════════════════

export const USER_MESSAGES: Record<ErrorCode, UserMessage> = {
  // ─────────────────────────────────────────────────────────────────────────────
  // Authentication Errors
  // ─────────────────────────────────────────────────────────────────────────────

  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    title: 'Credenciales incorrectas',
    message: 'El email o la contraseña son incorrectos.',
    suggestion: 'Verificá tus datos e intentá de nuevo. Si olvidaste tu contraseña, podés restablecerla.',
    retryable: true,
    severity: 'warning',
  },

  AUTH_SESSION_EXPIRED: {
    code: 'AUTH_SESSION_EXPIRED',
    title: 'Sesión expirada',
    message: 'Tu sesión ha expirado por seguridad.',
    suggestion: 'Por favor, iniciá sesión nuevamente para continuar.',
    retryable: true,
    severity: 'info',
  },

  AUTH_ACCOUNT_LOCKED: {
    code: 'AUTH_ACCOUNT_LOCKED',
    title: 'Cuenta bloqueada',
    message: 'Tu cuenta ha sido bloqueada temporalmente por seguridad.',
    suggestion: 'Esperá 30 minutos e intentá de nuevo, o contactá a soporte.',
    supportContact: true,
    severity: 'error',
  },

  AUTH_EMAIL_NOT_VERIFIED: {
    code: 'AUTH_EMAIL_NOT_VERIFIED',
    title: 'Email no verificado',
    message: 'Necesitás verificar tu email para continuar.',
    suggestion: 'Revisá tu bandeja de entrada y hacé clic en el enlace de verificación. Si no lo encontrás, revisá la carpeta de spam.',
    retryable: true,
    severity: 'warning',
  },

  AUTH_TOO_MANY_ATTEMPTS: {
    code: 'AUTH_TOO_MANY_ATTEMPTS',
    title: 'Demasiados intentos',
    message: 'Realizaste demasiados intentos de inicio de sesión.',
    suggestion: 'Esperá unos minutos antes de intentar de nuevo.',
    severity: 'warning',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Verification Errors
  // ─────────────────────────────────────────────────────────────────────────────

  VERIFY_CUIT_INVALID: {
    code: 'VERIFY_CUIT_INVALID',
    title: 'CUIT inválido',
    message: 'El número de CUIT ingresado no es válido.',
    suggestion: 'Verificá que el CUIT tenga 11 dígitos y el dígito verificador sea correcto. Formato: XX-XXXXXXXX-X',
    retryable: true,
    severity: 'warning',
  },

  VERIFY_CUIT_DUPLICATE: {
    code: 'VERIFY_CUIT_DUPLICATE',
    title: 'CUIT ya registrado',
    message: 'Este CUIT ya está registrado en otra organización.',
    suggestion: 'Si creés que esto es un error, contactá a soporte con la documentación correspondiente.',
    supportContact: true,
    severity: 'error',
  },

  VERIFY_CUIT_AFIP_UNAVAILABLE: {
    code: 'VERIFY_CUIT_AFIP_UNAVAILABLE',
    title: 'Verificación en proceso',
    message: 'La verificación automática no está disponible temporalmente.',
    suggestion: 'Tu solicitud fue enviada para revisión manual. Te notificaremos cuando esté lista (generalmente en 24-48 horas).',
    severity: 'info',
  },

  VERIFY_DNI_INVALID: {
    code: 'VERIFY_DNI_INVALID',
    title: 'DNI inválido',
    message: 'No pudimos procesar las imágenes del DNI.',
    suggestion: 'Asegurate de que las fotos estén bien iluminadas, sin reflejos y que se vean todos los datos claramente.',
    retryable: true,
    severity: 'warning',
  },

  VERIFY_DNI_MISMATCH: {
    code: 'VERIFY_DNI_MISMATCH',
    title: 'Datos no coinciden',
    message: 'Los datos del DNI no coinciden con los ingresados.',
    suggestion: 'Verificá que los datos que ingresaste sean exactamente iguales a los del DNI. Prestá atención a acentos y mayúsculas.',
    retryable: true,
    severity: 'warning',
  },

  VERIFY_SELFIE_FAILED: {
    code: 'VERIFY_SELFIE_FAILED',
    title: 'Verificación de selfie fallida',
    message: 'No pudimos verificar tu identidad con la selfie.',
    suggestion: 'Asegurate de estar en un lugar bien iluminado, mirando directo a la cámara. Evitá anteojos o accesorios que cubran tu rostro.',
    retryable: true,
    severity: 'warning',
  },

  VERIFY_PHONE_INVALID: {
    code: 'VERIFY_PHONE_INVALID',
    title: 'Número de teléfono inválido',
    message: 'El número de teléfono ingresado no es válido.',
    suggestion: 'Ingresá un número de celular argentino válido con código de área (ej: 11 2345-6789).',
    retryable: true,
    severity: 'warning',
  },

  VERIFY_PHONE_CODE_EXPIRED: {
    code: 'VERIFY_PHONE_CODE_EXPIRED',
    title: 'Código expirado',
    message: 'El código de verificación ha expirado.',
    suggestion: 'Solicitá un nuevo código haciendo clic en "Reenviar código".',
    retryable: true,
    severity: 'warning',
  },

  VERIFY_PHONE_TOO_MANY_ATTEMPTS: {
    code: 'VERIFY_PHONE_TOO_MANY_ATTEMPTS',
    title: 'Demasiados intentos',
    message: 'Superaste el límite de códigos de verificación por hoy.',
    suggestion: 'Intentá nuevamente mañana o contactá a soporte si necesitás ayuda urgente.',
    supportContact: true,
    severity: 'warning',
  },

  VERIFY_DOCUMENT_EXPIRED: {
    code: 'VERIFY_DOCUMENT_EXPIRED',
    title: 'Documento vencido',
    message: 'Uno de tus documentos ha vencido.',
    suggestion: 'Subí una versión actualizada del documento para mantener tu cuenta activa.',
    retryable: true,
    severity: 'warning',
  },

  VERIFY_DOCUMENT_REJECTED: {
    code: 'VERIFY_DOCUMENT_REJECTED',
    title: 'Documento rechazado',
    message: 'Tu documento fue rechazado durante la revisión.',
    suggestion: 'Revisá el motivo del rechazo y subí un nuevo documento que cumpla con los requisitos.',
    retryable: true,
    severity: 'warning',
  },

  VERIFY_INCOMPLETE: {
    code: 'VERIFY_INCOMPLETE',
    title: 'Verificación incompleta',
    message: 'Tu verificación de identidad no está completa.',
    suggestion: 'Completá todos los pasos de verificación para poder recibir trabajos.',
    retryable: true,
    severity: 'warning',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Payment Errors
  // ─────────────────────────────────────────────────────────────────────────────

  PAYMENT_FAILED: {
    code: 'PAYMENT_FAILED',
    title: 'Error en el pago',
    message: 'No pudimos procesar tu pago.',
    suggestion: 'Verificá los datos de tu tarjeta e intentá de nuevo. Si el problema persiste, probá con otro medio de pago.',
    retryable: true,
    severity: 'error',
  },

  PAYMENT_DECLINED: {
    code: 'PAYMENT_DECLINED',
    title: 'Pago rechazado',
    message: 'Tu banco rechazó la transacción.',
    suggestion: 'Contactá a tu banco para más información o intentá con otro medio de pago.',
    retryable: true,
    severity: 'error',
  },

  PAYMENT_INSUFFICIENT_FUNDS: {
    code: 'PAYMENT_INSUFFICIENT_FUNDS',
    title: 'Fondos insuficientes',
    message: 'No hay fondos suficientes para completar el pago.',
    suggestion: 'Verificá el saldo de tu cuenta o intentá con otro medio de pago.',
    retryable: true,
    severity: 'error',
  },

  PAYMENT_CARD_EXPIRED: {
    code: 'PAYMENT_CARD_EXPIRED',
    title: 'Tarjeta vencida',
    message: 'La tarjeta que intentás usar está vencida.',
    suggestion: 'Actualizá tu método de pago con una tarjeta vigente.',
    retryable: true,
    severity: 'error',
  },

  PAYMENT_PROCESSING: {
    code: 'PAYMENT_PROCESSING',
    title: 'Pago en proceso',
    message: 'Tu pago está siendo procesado.',
    suggestion: 'Esto puede demorar unos minutos. Te notificaremos cuando se complete.',
    severity: 'info',
  },

  PAYMENT_TIMEOUT: {
    code: 'PAYMENT_TIMEOUT',
    title: 'Tiempo de espera agotado',
    message: 'El procesamiento del pago tardó demasiado.',
    suggestion: 'No te preocupes, si se debitó el monto, te lo reintegraremos. Intentá de nuevo en unos minutos.',
    retryable: true,
    supportContact: true,
    severity: 'warning',
  },

  PAYMENT_REFUND_FAILED: {
    code: 'PAYMENT_REFUND_FAILED',
    title: 'Error en el reembolso',
    message: 'No pudimos procesar tu reembolso automáticamente.',
    suggestion: 'Nuestro equipo está trabajando en esto. Te contactaremos en las próximas 48 horas.',
    supportContact: true,
    severity: 'error',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Subscription Errors
  // ─────────────────────────────────────────────────────────────────────────────

  SUB_TRIAL_EXPIRED: {
    code: 'SUB_TRIAL_EXPIRED',
    title: 'Prueba gratuita finalizada',
    message: 'Tu período de prueba de 14 días ha terminado.',
    suggestion: 'Elegí un plan para seguir usando CampoTech y recibiendo trabajos.',
    severity: 'warning',
  },

  SUB_PAYMENT_REQUIRED: {
    code: 'SUB_PAYMENT_REQUIRED',
    title: 'Pago pendiente',
    message: 'Tu suscripción tiene un pago pendiente.',
    suggestion: 'Actualizá tu método de pago para mantener tu cuenta activa.',
    retryable: true,
    severity: 'warning',
  },

  SUB_CANCELLED: {
    code: 'SUB_CANCELLED',
    title: 'Suscripción cancelada',
    message: 'Tu suscripción ha sido cancelada.',
    suggestion: 'Podés reactivar tu suscripción en cualquier momento desde la sección de facturación.',
    severity: 'info',
  },

  SUB_DOWNGRADE_SCHEDULED: {
    code: 'SUB_DOWNGRADE_SCHEDULED',
    title: 'Cambio de plan programado',
    message: 'Tu plan cambiará al final del período de facturación actual.',
    suggestion: 'Seguirás teniendo acceso a las funciones actuales hasta esa fecha.',
    severity: 'info',
  },

  SUB_UPGRADE_FAILED: {
    code: 'SUB_UPGRADE_FAILED',
    title: 'Error al actualizar plan',
    message: 'No pudimos procesar la actualización de tu plan.',
    suggestion: 'Verificá tu método de pago e intentá de nuevo.',
    retryable: true,
    severity: 'error',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Account/Organization Errors
  // ─────────────────────────────────────────────────────────────────────────────

  ORG_NOT_FOUND: {
    code: 'ORG_NOT_FOUND',
    title: 'Organización no encontrada',
    message: 'No pudimos encontrar la organización solicitada.',
    suggestion: 'Verificá que el enlace sea correcto o contactá a soporte.',
    supportContact: true,
    severity: 'error',
  },

  ORG_BLOCKED_SOFT: {
    code: 'ORG_BLOCKED_SOFT',
    title: 'Acceso limitado',
    message: 'Tu cuenta tiene acceso limitado temporalmente.',
    suggestion: 'Actualizá tu suscripción o completá la verificación pendiente para restaurar el acceso completo.',
    severity: 'warning',
  },

  ORG_BLOCKED_HARD: {
    code: 'ORG_BLOCKED_HARD',
    title: 'Cuenta bloqueada',
    message: 'Tu cuenta está bloqueada.',
    suggestion: 'Contactá a soporte para resolver esta situación.',
    supportContact: true,
    severity: 'critical',
  },

  ORG_DELETED: {
    code: 'ORG_DELETED',
    title: 'Organización eliminada',
    message: 'Esta organización ha sido eliminada.',
    suggestion: 'Si creés que esto es un error, contactá a soporte dentro de los 30 días para recuperarla.',
    supportContact: true,
    severity: 'error',
  },

  ORG_OWNER_REQUIRED: {
    code: 'ORG_OWNER_REQUIRED',
    title: 'Acción solo para dueños',
    message: 'Solo el dueño de la organización puede realizar esta acción.',
    suggestion: 'Contactá al dueño de tu organización para solicitar este cambio.',
    severity: 'warning',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // File Upload Errors
  // ─────────────────────────────────────────────────────────────────────────────

  UPLOAD_FAILED: {
    code: 'UPLOAD_FAILED',
    title: 'Error al subir archivo',
    message: 'No pudimos subir tu archivo.',
    suggestion: 'Verificá tu conexión a internet e intentá de nuevo.',
    retryable: true,
    severity: 'error',
  },

  UPLOAD_TOO_LARGE: {
    code: 'UPLOAD_TOO_LARGE',
    title: 'Archivo muy grande',
    message: 'El archivo supera el tamaño máximo permitido.',
    suggestion: 'El tamaño máximo es 10MB. Reducí el tamaño del archivo e intentá de nuevo.',
    retryable: true,
    severity: 'warning',
  },

  UPLOAD_INVALID_FORMAT: {
    code: 'UPLOAD_INVALID_FORMAT',
    title: 'Formato no válido',
    message: 'El formato del archivo no está permitido.',
    suggestion: 'Los formatos aceptados son: JPG, PNG, PDF. Convertí tu archivo a uno de estos formatos.',
    retryable: true,
    severity: 'warning',
  },

  UPLOAD_TIMEOUT: {
    code: 'UPLOAD_TIMEOUT',
    title: 'Carga interrumpida',
    message: 'La carga del archivo tardó demasiado y fue cancelada.',
    suggestion: 'Verificá tu conexión a internet y que el archivo no sea muy grande. Intentá de nuevo.',
    retryable: true,
    severity: 'warning',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Network/System Errors
  // ─────────────────────────────────────────────────────────────────────────────

  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    title: 'Error de conexión',
    message: 'Hubo un problema con tu conexión a internet.',
    suggestion: 'Verificá tu conexión e intentá de nuevo.',
    retryable: true,
    severity: 'warning',
  },

  NETWORK_TIMEOUT: {
    code: 'NETWORK_TIMEOUT',
    title: 'Conexión lenta',
    message: 'La operación tardó demasiado.',
    suggestion: 'Tu conexión puede estar lenta. Intentá de nuevo en unos minutos.',
    retryable: true,
    severity: 'warning',
  },

  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    title: 'Servicio no disponible',
    message: 'El servicio no está disponible temporalmente.',
    suggestion: 'Estamos trabajando para resolver esto. Intentá de nuevo en unos minutos.',
    retryable: true,
    severity: 'error',
  },

  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    title: 'Demasiadas solicitudes',
    message: 'Realizaste demasiadas solicitudes en poco tiempo.',
    suggestion: 'Esperá unos minutos antes de intentar de nuevo.',
    severity: 'warning',
  },

  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    title: 'Error inesperado',
    message: 'Ocurrió un error inesperado.',
    suggestion: 'Si el problema persiste, contactá a soporte con el código de error.',
    supportContact: true,
    retryable: true,
    severity: 'error',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get user-friendly message for an error code
 */
export function getUserMessage(code: ErrorCode): UserMessage {
  return USER_MESSAGES[code] || USER_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Map technical error to user-friendly code
 */
export function mapErrorToCode(error: Error | string): ErrorCode {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'NETWORK_TIMEOUT';
  }
  if (lowerMessage.includes('rate limit')) {
    return 'RATE_LIMITED';
  }

  // Auth errors
  if (lowerMessage.includes('invalid credentials') || lowerMessage.includes('wrong password')) {
    return 'AUTH_INVALID_CREDENTIALS';
  }
  if (lowerMessage.includes('session expired') || lowerMessage.includes('token expired')) {
    return 'AUTH_SESSION_EXPIRED';
  }

  // Payment errors
  if (lowerMessage.includes('insufficient funds')) {
    return 'PAYMENT_INSUFFICIENT_FUNDS';
  }
  if (lowerMessage.includes('card expired')) {
    return 'PAYMENT_CARD_EXPIRED';
  }
  if (lowerMessage.includes('payment declined') || lowerMessage.includes('payment rejected')) {
    return 'PAYMENT_DECLINED';
  }
  if (lowerMessage.includes('payment failed')) {
    return 'PAYMENT_FAILED';
  }

  // Verification errors
  if (lowerMessage.includes('cuit') && lowerMessage.includes('invalid')) {
    return 'VERIFY_CUIT_INVALID';
  }
  if (lowerMessage.includes('cuit') && lowerMessage.includes('duplicate')) {
    return 'VERIFY_CUIT_DUPLICATE';
  }
  if (lowerMessage.includes('afip') && lowerMessage.includes('unavailable')) {
    return 'VERIFY_CUIT_AFIP_UNAVAILABLE';
  }

  // Upload errors
  if (lowerMessage.includes('file too large') || lowerMessage.includes('size exceeded')) {
    return 'UPLOAD_TOO_LARGE';
  }
  if (lowerMessage.includes('invalid format') || lowerMessage.includes('unsupported type')) {
    return 'UPLOAD_INVALID_FORMAT';
  }
  if (lowerMessage.includes('upload failed')) {
    return 'UPLOAD_FAILED';
  }

  // Service errors
  if (lowerMessage.includes('service unavailable') || lowerMessage.includes('503')) {
    return 'SERVICE_UNAVAILABLE';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Format error for display with optional error ID
 */
export function formatUserError(
  code: ErrorCode,
  errorId?: string
): {
  title: string;
  message: string;
  suggestion: string;
  showSupport: boolean;
  canRetry: boolean;
  severity: UserMessage['severity'];
  errorRef?: string;
} {
  const userMessage = getUserMessage(code);

  return {
    title: userMessage.title,
    message: userMessage.message,
    suggestion: userMessage.suggestion || '',
    showSupport: userMessage.supportContact || false,
    canRetry: userMessage.retryable || false,
    severity: userMessage.severity,
    errorRef: errorId ? `Ref: ${errorId.slice(0, 8)}` : undefined,
  };
}

/**
 * Get support contact info
 */
export function getSupportContact(): {
  email: string;
  phone: string;
  hours: string;
  whatsapp?: string;
} {
  return {
    email: 'soporte@campotech.com.ar',
    phone: '+54 11 1234-5678',
    hours: 'Lunes a Viernes de 9:00 a 18:00 (Buenos Aires)',
    whatsapp: '+54 9 11 1234-5678',
  };
}
