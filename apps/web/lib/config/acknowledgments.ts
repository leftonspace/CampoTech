/**
 * Legal Acknowledgments Configuration
 * ====================================
 *
 * Defines all legal acknowledgments required for verification and compliance.
 * These acknowledgments provide CampoTech's liability shield and ensure
 * users understand their responsibilities.
 *
 * Acknowledgment Types (matching Prisma enum AcknowledgmentType):
 * - terms_of_service: Platform terms acceptance
 * - verification_responsibility: Responsibility for verification info accuracy
 * - employee_responsibility: Responsibility for employee information
 * - data_accuracy: Per-submission accuracy confirmation
 * - update_obligation: Obligation to keep information updated
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AcknowledgmentType =
  | 'terms_of_service'
  | 'verification_responsibility'
  | 'employee_responsibility'
  | 'data_accuracy'
  | 'update_obligation';

export interface AcknowledgmentConfig {
  /** Acknowledgment type (matches Prisma enum) */
  type: AcknowledgmentType;
  /** Display title */
  title: string;
  /** Version of the acknowledgment text */
  version: string;
  /** Full text to display */
  text: string;
  /** Checkbox label for acceptance */
  checkbox: string;
  /** When this acknowledgment is required */
  required_for: AcknowledgmentTrigger;
  /** Whether this is a blocking requirement */
  isBlocking: boolean;
  /** Whether this shows as an inline checkbox (vs modal) */
  isInline: boolean;
}

export type AcknowledgmentTrigger =
  | 'registration'
  | 'tier2_completion'
  | 'first_employee'
  | 'each_submission'
  | 'annual_renewal';

// ═══════════════════════════════════════════════════════════════════════════════
// ACKNOWLEDGMENT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const ACKNOWLEDGMENTS: Record<AcknowledgmentType, AcknowledgmentConfig> = {
  terms_of_service: {
    type: 'terms_of_service',
    title: 'Términos y Condiciones',
    version: '1.0',
    text: `Al usar CampoTech, aceptás los siguientes términos:

1. USO DE LA PLATAFORMA
CampoTech es una plataforma de gestión de servicios técnicos. Su uso está destinado exclusivamente a profesionales del rubro HVAC y servicios relacionados en Argentina.

2. CUENTA Y SEGURIDAD
Sos responsable de mantener la confidencialidad de tu cuenta y contraseña. Debés notificarnos inmediatamente cualquier uso no autorizado.

3. INFORMACIÓN PROPORCIONADA
Toda la información que proporciones debe ser veraz, completa y actualizada. CampoTech se reserva el derecho de suspender cuentas con información falsa o fraudulenta.

4. PROPIEDAD INTELECTUAL
Todo el contenido de la plataforma es propiedad de CampoTech. No podés copiar, modificar o distribuir ningún contenido sin autorización.

5. LIMITACIÓN DE RESPONSABILIDAD
CampoTech no es responsable por daños indirectos, pérdida de ingresos, o cualquier daño resultante del uso de la plataforma.

6. MODIFICACIONES
Nos reservamos el derecho de modificar estos términos. Te notificaremos de cambios importantes.

7. LEY APLICABLE
Estos términos se rigen por las leyes de la República Argentina, con jurisdicción en los tribunales de la Ciudad Autónoma de Buenos Aires.`,
    checkbox: 'Acepto los Términos y Condiciones de CampoTech',
    required_for: 'registration',
    isBlocking: true,
    isInline: false,
  },

  verification_responsibility: {
    type: 'verification_responsibility',
    title: 'Responsabilidad de Verificación',
    version: '1.0',
    text: `Declaro bajo juramento que toda la información y documentación proporcionada es verdadera, completa y actualizada.

Me comprometo a notificar a CampoTech de cualquier cambio en mi situación legal, fiscal, o profesional dentro de los 5 días hábiles de producido el cambio.

Entiendo que CampoTech no es responsable por información falsa, incompleta o desactualizada proporcionada por mi parte, y que proporcionar información falsa puede resultar en la suspensión permanente de mi cuenta y acciones legales.

Al aceptar, confirmo que:

• Toda la documentación presentada es auténtica
• La información fiscal (CUIT/CUIL) es correcta
• Estoy habilitado legalmente para ejercer mi actividad
• Notificaré cualquier cambio en mi situación dentro de 5 días hábiles
• Entiendo las consecuencias de proporcionar información falsa`,
    checkbox: 'Acepto la responsabilidad de mantener mi información actualizada',
    required_for: 'tier2_completion',
    isBlocking: true,
    isInline: false,
  },

  employee_responsibility: {
    type: 'employee_responsibility',
    title: 'Responsabilidad sobre Empleados',
    version: '1.0',
    text: `Como titular del negocio, asumo total responsabilidad por la veracidad de la información de mis empleados registrados.

Me comprometo a:

• Verificar la identidad de cada empleado antes de registrarlo
• Asegurar que la documentación de cada empleado esté vigente
• Notificar cambios en la situación de mis empleados
• Dar de baja empleados que ya no trabajen conmigo
• Responder por los actos de mis empleados realizados a través de la plataforma

CampoTech no es responsable por:

• Actos realizados por mis empleados
• Información incorrecta proporcionada sobre empleados
• Daños causados por empleados no verificados
• Incumplimiento de mis obligaciones como empleador

Entiendo que cualquier incumplimiento puede resultar en la suspensión de mi cuenta y la de mis empleados.`,
    checkbox: 'Acepto la responsabilidad sobre la información de mis empleados',
    required_for: 'first_employee',
    isBlocking: true,
    isInline: false,
  },

  update_obligation: {
    type: 'update_obligation',
    title: 'Obligación de Actualización',
    version: '1.0',
    text: `Entiendo que es mi responsabilidad mantener toda mi documentación actualizada. CampoTech me enviará recordatorios, pero la responsabilidad final es mía.

Si mi documentación vence o mi información cambia y no la actualizo, mi cuenta será suspendida automáticamente.

CampoTech no es responsable por pérdida de ingresos, trabajos, o clientes debido a la suspensión de mi cuenta por documentación vencida o información desactualizada.

Me comprometo a:

• Renovar documentación vencida antes de su vencimiento
• Actualizar cambios de domicilio, teléfono o email
• Informar cambios en mi situación fiscal
• Responder a solicitudes de re-verificación dentro de los plazos establecidos

Entiendo que:

• Recibiré recordatorios 30, 15 y 7 días antes del vencimiento
• La suspensión por documentación vencida es automática
• Podré reactivar mi cuenta una vez actualizada la documentación`,
    checkbox: 'Entiendo mi obligación de mantener la información actualizada',
    required_for: 'tier2_completion',
    isBlocking: true,
    isInline: false,
  },

  data_accuracy: {
    type: 'data_accuracy',
    title: 'Veracidad de Datos',
    version: '1.0',
    text: 'Confirmo que este documento/información es auténtico y vigente.',
    checkbox: 'Confirmo la veracidad de esta información',
    required_for: 'each_submission',
    isBlocking: true,
    isInline: true, // Shows as inline checkbox, not modal
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get acknowledgment config by type
 */
export function getAcknowledgment(type: AcknowledgmentType): AcknowledgmentConfig {
  return ACKNOWLEDGMENTS[type];
}

/**
 * Get all acknowledgments required for a specific trigger
 */
export function getAcknowledgmentsForTrigger(
  trigger: AcknowledgmentTrigger
): AcknowledgmentConfig[] {
  return Object.values(ACKNOWLEDGMENTS).filter(
    (ack) => ack.required_for === trigger
  );
}

/**
 * Get acknowledgments that should be shown as modals (not inline)
 */
export function getModalAcknowledgments(
  trigger: AcknowledgmentTrigger
): AcknowledgmentConfig[] {
  return getAcknowledgmentsForTrigger(trigger).filter((ack) => !ack.isInline);
}

/**
 * Get acknowledgments that should be shown inline
 */
export function getInlineAcknowledgments(
  trigger: AcknowledgmentTrigger
): AcknowledgmentConfig[] {
  return getAcknowledgmentsForTrigger(trigger).filter((ack) => ack.isInline);
}

/**
 * Get all blocking acknowledgment types
 */
export function getBlockingAcknowledgmentTypes(): AcknowledgmentType[] {
  return Object.values(ACKNOWLEDGMENTS)
    .filter((ack) => ack.isBlocking)
    .map((ack) => ack.type);
}

/**
 * Get acknowledgments required before completing Tier 2 verification
 */
export function getTier2RequiredAcknowledgments(): AcknowledgmentConfig[] {
  return [
    ACKNOWLEDGMENTS.verification_responsibility,
    ACKNOWLEDGMENTS.update_obligation,
  ];
}

/**
 * Get acknowledgments required before adding first employee
 */
export function getFirstEmployeeAcknowledgments(): AcknowledgmentConfig[] {
  return [ACKNOWLEDGMENTS.employee_responsibility];
}

/**
 * Get the inline acknowledgment for document submissions
 */
export function getSubmissionAcknowledgment(): AcknowledgmentConfig {
  return ACKNOWLEDGMENTS.data_accuracy;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACKNOWLEDGMENT DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format acknowledgment text for display (convert bullet points, etc.)
 */
export function formatAcknowledgmentText(text: string): string {
  // The text is already formatted with bullets, no transformation needed
  return text.trim();
}

/**
 * Get acknowledgment sections (split by double newline)
 */
export function getAcknowledgmentSections(text: string): string[] {
  return text.split('\n\n').filter((section) => section.trim().length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default ACKNOWLEDGMENTS;
