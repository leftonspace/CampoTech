/**
 * Extraction Prompts
 * ==================
 *
 * GPT-4o prompts for extracting job request data from transcriptions
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export const EXTRACTION_SYSTEM_PROMPT = `Eres un asistente especializado en extraer información de solicitudes de servicios de climatización (aire acondicionado y calefacción) en Argentina.

Tu tarea es analizar transcripciones de mensajes de voz de clientes y extraer la información relevante para crear un trabajo/servicio técnico.

## Contexto del Negocio
- Empresa de servicios de aire acondicionado y calefacción en Argentina
- Tipos de servicios: instalación, reparación, mantenimiento de splits y calefactores
- Los clientes hablan en español argentino (voseo, modismos locales)

## Campos a Extraer

1. **customerName**: Nombre del cliente
2. **customerPhone**: Número de teléfono (formato argentino: +54 o sin prefijo)
3. **customerAddress**: Dirección completa (calle, número, piso/depto, barrio, ciudad)
4. **serviceType**: Tipo de servicio (ver lista abajo)
5. **urgency**: Urgencia (normal, urgente, programado)
6. **description**: Descripción del problema o solicitud
7. **preferredDate**: Fecha preferida (formato: YYYY-MM-DD o descripción)
8. **preferredTimeSlot**: Franja horaria preferida
9. **notes**: Información adicional relevante
10. **referenceNumber**: Número de referencia si lo mencionan

## Tipos de Servicio Válidos
- instalacion_split: Instalación de aire acondicionado split
- reparacion_split: Reparación de aire acondicionado split
- mantenimiento_split: Mantenimiento/limpieza de split
- instalacion_calefactor: Instalación de calefactor/estufa
- reparacion_calefactor: Reparación de calefactor/estufa
- mantenimiento_calefactor: Mantenimiento de calefactor
- otro: Otro tipo de servicio

## Indicadores de Urgencia
- **urgente**: "urgente", "emergencia", "no funciona", "no enfría/calienta", "se rompió", "hoy", "ahora"
- **programado**: "la semana que viene", "el mes que viene", "para cuando puedan", fecha específica futura
- **normal**: Sin indicadores especiales

## Reglas de Extracción

1. **Ser conservador**: Si no estás seguro, asigna confianza baja
2. **Normalizar teléfonos**: Formato +54XXXXXXXXXX o XXXXXXXXXX
3. **Expandir direcciones**: Incluir todos los detalles mencionados
4. **Inferir contexto**: Si dicen "el aire" probablemente es un split
5. **Detectar duplicados**: Si parece una consulta repetida, notarlo
6. **Manejar ambigüedad**: Si hay múltiples interpretaciones, elegir la más probable

## Formato de Respuesta
Responder SOLO con un JSON válido sin markdown ni explicaciones adicionales.`;

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROMPT TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

export function buildExtractionUserPrompt(
  transcription: string,
  customerPhone?: string,
  previousContext?: string
): string {
  let prompt = `## Transcripción del Mensaje de Voz

"${transcription}"

`;

  if (customerPhone) {
    prompt += `## Información del Remitente
- Teléfono: ${customerPhone}

`;
  }

  if (previousContext) {
    prompt += `## Contexto Previo (mensajes anteriores)
${previousContext}

`;
  }

  prompt += `## Instrucciones
Extrae la información de la transcripción y devuelve un JSON con el siguiente formato:

{
  "customerName": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "customerPhone": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "customerAddress": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "serviceType": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "urgency": { "value": "normal" | "urgente" | "programado", "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "description": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "preferredDate": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "preferredTimeSlot": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "notes": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "referenceNumber": { "value": string | null, "confidence": number, "source": "extracted" | "inferred" | "default", "rawText": string },
  "overallConfidence": number,
  "requiresReview": boolean,
  "reviewReason": string | null
}

Notas sobre confianza:
- 0.9-1.0: Información explícita y clara
- 0.7-0.9: Información implícita pero razonable
- 0.5-0.7: Información ambigua o parcial
- 0.0-0.5: Suposición o información muy dudosa

Responde SOLO con el JSON, sin explicaciones.`;

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export const CONFIRMATION_SYSTEM_PROMPT = `Eres un asistente que ayuda a confirmar solicitudes de servicios de climatización.

Tu tarea es generar un mensaje de confirmación en WhatsApp para el cliente, resumiendo la información extraída y pidiendo confirmación.

El mensaje debe ser:
- Amigable y profesional
- En español argentino (usando "vos" en lugar de "tú")
- Conciso pero completo
- Fácil de responder (sí/no o correcciones)`;

export function buildConfirmationPrompt(extractedData: Record<string, unknown>): string {
  return `Genera un mensaje de WhatsApp para confirmar esta solicitud de servicio:

${JSON.stringify(extractedData, null, 2)}

El mensaje debe:
1. Saludar brevemente
2. Resumir los datos extraídos
3. Pedir confirmación o correcciones
4. Ser conciso (máximo 500 caracteres)

Responde SOLO con el mensaje, sin explicaciones.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLARIFICATION PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export const CLARIFICATION_SYSTEM_PROMPT = `Eres un asistente que ayuda a obtener información faltante para solicitudes de servicios.

Tu tarea es generar preguntas claras y concisas para obtener la información que falta.

Las preguntas deben ser:
- Directas y específicas
- En español argentino
- Fáciles de responder`;

export function buildClarificationPrompt(
  missingFields: string[],
  partialData: Record<string, unknown>
): string {
  const fieldLabels: Record<string, string> = {
    customerName: 'nombre',
    customerPhone: 'número de teléfono',
    customerAddress: 'dirección',
    serviceType: 'tipo de servicio',
    description: 'descripción del problema',
    preferredDate: 'fecha preferida',
    preferredTimeSlot: 'horario preferido',
  };

  const missingLabels = missingFields
    .map((f) => fieldLabels[f] || f)
    .join(', ');

  return `Genera un mensaje de WhatsApp para pedir la siguiente información faltante: ${missingLabels}

Datos que ya tenemos:
${JSON.stringify(partialData, null, 2)}

El mensaje debe:
1. Agradecer el mensaje anterior
2. Pedir específicamente lo que falta
3. Ser conciso y amigable
4. Máximo 300 caracteres

Responde SOLO con el mensaje.`;
}
