# Guía de Configuración del Asistente IA para WhatsApp

Esta guía te ayudará a configurar el asistente de inteligencia artificial para que responda automáticamente los mensajes de WhatsApp de tus clientes.

## Requisitos Previos

- Plan **PROFESIONAL** o superior
- Número exclusivo de WhatsApp configurado (ver [Guía de Configuración de WhatsApp](./WHATSAPP-SETUP.md))

---

## Acceder a la Configuración

1. Andá a **Configuración** → **Asistente IA**
2. Activá el switch **"Asistente IA Activo"**

---

## Configuración General

### Respuesta Automática

Cuando está activada, la IA responderá automáticamente a los mensajes de clientes si tiene suficiente confianza en la respuesta.

- **Activada**: La IA responde sin intervención humana
- **Desactivada**: Los mensajes se almacenan para que los respondas manualmente

### Niveles de Confianza

La IA evalúa qué tan segura está de su respuesta. Podés ajustar estos umbrales:

| Umbral | Valor Recomendado | Descripción |
|--------|-------------------|-------------|
| **Confianza para responder** | 70% | Si la IA tiene menos confianza, transfiere a un humano |
| **Confianza para crear trabajo** | 85% | Si tiene menos confianza, pide confirmación al cliente |

### Tono del Asistente

Elegí cómo querés que la IA se comunique:

- **Amigable y Profesional** (Recomendado): Cálido pero eficiente, usa "vos"
- **Formal**: Respetuoso y distante, usa "usted"
- **Casual**: Relajado y cercano, como un vecino

---

## Información de la Empresa

Completar esta sección es **fundamental** para que la IA responda correctamente.

### Datos Básicos

- **Nombre de la empresa**: Cómo te presentás a los clientes
- **Descripción**: Qué hace tu empresa (2-3 oraciones)
- **Zonas de servicio**: Dónde trabajás (ej: "CABA, Zona Norte, Vicente López")

### Servicios

Listá cada servicio que ofrecés con:
- Nombre del servicio
- Descripción breve
- Rango de precio (opcional)

**Ejemplo:**
```
Nombre: Instalación de aire acondicionado
Descripción: Instalación completa con materiales incluidos
Precio: Desde $45.000
```

### Información de Precios

Explicá tu estructura de precios:
- Visitas de diagnóstico
- Rangos de precios por servicio
- Costos adicionales (fin de semana, urgencias)

### Métodos de Pago

Listá las formas de pago que aceptás:
- Efectivo
- Transferencia bancaria
- Tarjetas de crédito/débito
- Mercado Pago
- etc.

### Políticas

- **Cancelación**: Reglas para cancelar turnos
- **Garantía**: Qué garantía ofrecés por tus trabajos

---

## Horarios de Atención

Configurá los días y horarios en que operás:

1. Activá/desactivá cada día de la semana
2. Para días activos, establecé el horario de apertura y cierre
3. Configurá el mensaje de fuera de horario

### Mensaje Fuera de Horario

Este mensaje se envía cuando un cliente escribe fuera del horario de atención:

**Ejemplo:**
```
¡Hola! Gracias por contactarnos. En este momento estamos fuera de
horario. Te responderemos mañana a primera hora.

Nuestro horario es de Lunes a Viernes de 9 a 18hs.
```

### Mensaje de Bienvenida (Opcional)

Se envía cuando un cliente nuevo escribe por primera vez:

**Ejemplo:**
```
¡Hola! Bienvenido a Climatización del Sur. Soy el asistente virtual
y estoy acá para ayudarte. ¿En qué te puedo ayudar?
```

---

## Preguntas Frecuentes (FAQ)

Agregá preguntas comunes con sus respuestas para que la IA las use:

### Cómo Agregar una FAQ

1. Hacé clic en **"Agregar pregunta"**
2. Escribí la pregunta tal como la haría un cliente
3. Escribí la respuesta ideal

### Ejemplos de FAQs Útiles

| Pregunta | Respuesta |
|----------|-----------|
| ¿Hacen instalaciones los fines de semana? | Sí, trabajamos sábados con un costo adicional del 30%. Los domingos no atendemos. |
| ¿Cuánto tarda una instalación? | Una instalación standard tarda entre 2 y 3 horas. |
| ¿Tienen garantía? | Sí, ofrecemos 6 meses de garantía en mano de obra y 1 año en repuestos. |
| ¿Trabajan en Pilar? | Sí, cubrimos toda la Zona Norte incluyendo Pilar, con un costo de traslado de $3.000. |

---

## Configuración Avanzada

### Palabras de Transferencia

Si el cliente usa estas palabras, la conversación se transfiere automáticamente a un humano:

**Palabras por defecto:**
- "hablar con persona"
- "operador"
- "queja"
- "reclamo"

Podés agregar o quitar palabras según tu negocio.

### Usuario de Escalación

Seleccioná quién recibirá notificaciones cuando la IA transfiera una conversación:
- El dueño de la cuenta
- Un ADMIN específico
- Cualquier usuario con rol de atención

### Instrucciones Personalizadas

Agregá instrucciones específicas para el comportamiento de la IA:

**Ejemplos:**
```
- Siempre ofrecer presupuesto sin cargo
- Si preguntan por equipos, recomendar marca Daikin
- No dar información sobre la competencia
- Si el cliente menciona urgencia, priorizar disponibilidad inmediata
- Nunca prometer descuentos sin autorización
```

---

## Permisos de Acceso a Datos

Controlá qué información puede ver y compartir la IA con los clientes:

### Información de la Empresa
| Permiso | Recomendación | Descripción |
|---------|---------------|-------------|
| Información de la empresa | ✅ Activado | Nombre y descripción |
| Servicios ofrecidos | ✅ Activado | Lista de servicios |
| Información de precios | ✅ Activado | Precios y tarifas |
| Horarios de atención | ✅ Activado | Días y horarios |
| Zonas de cobertura | ✅ Activado | Áreas de servicio |
| Políticas | ✅ Activado | Cancelación, garantía, pagos |
| Preguntas frecuentes | ✅ Activado | Respuestas pre-configuradas |

### Información del Equipo
| Permiso | Recomendación | Descripción |
|---------|---------------|-------------|
| Nombres de técnicos | ❌ Desactivado | Por privacidad, decir "un técnico" |
| Disponibilidad de técnicos | ✅ Activado | Estado actual (disponible/ocupado) |
| Turnos disponibles | ✅ Activado | Horarios libres para agendar |

### Información Siempre Protegida

La IA **nunca** tiene acceso a:
- Salarios de empleados
- Datos personales de otros clientes
- Información financiera de la empresa
- Reportes de ingresos
- Notas internas

---

## Zona de Pruebas

Antes de activar la IA, probala:

1. Andá a la pestaña **"Probar"**
2. Escribí mensajes como si fueras un cliente
3. Observá cómo responde la IA
4. Ajustá la configuración según sea necesario

### Qué Probar

- Preguntas sobre servicios y precios
- Consultas sobre disponibilidad
- Pedidos de turno
- Quejas o reclamos
- Preguntas fuera del rubro

### Indicadores en la Prueba

Cada respuesta muestra:
- **Confianza**: Qué tan segura está la IA (0-100%)
- **Intención detectada**: Qué cree que quiere el cliente
- **Acciones**: Si sugiere crear trabajo o transferir

---

## Mejores Prácticas

### 1. Información Completa
Cuanto más información proporciones, mejores serán las respuestas.

### 2. FAQs Específicas
Agregá preguntas reales que te hagan tus clientes.

### 3. Revisar Conversaciones
Periódicamente revisá las conversaciones para:
- Detectar preguntas no respondidas
- Identificar nuevas FAQs a agregar
- Ajustar el tono o las respuestas

### 4. Horarios Precisos
Mantené actualizados los horarios, especialmente en feriados.

### 5. Probar Cambios
Después de cada cambio, usá la zona de pruebas.

---

## Solución de Problemas

### La IA da respuestas incorrectas

1. Verificá que la información de la empresa esté completa
2. Agregá FAQs específicas para esas preguntas
3. Revisá las instrucciones personalizadas
4. Ajustá el umbral de confianza

### La IA transfiere muy seguido

1. Bajá el umbral de "Confianza para responder"
2. Agregá más FAQs
3. Completá la información de servicios

### La IA crea trabajos incorrectamente

1. Subí el umbral de "Confianza para crear trabajo" a 90%
2. Verificá que los servicios estén bien definidos
3. Revisá las instrucciones personalizadas

### No se envían respuestas

1. Verificá que el asistente esté **activado**
2. Verificá que las respuestas automáticas estén habilitadas
3. Revisá si estás dentro del límite de mensajes
4. Verificá los horarios de atención

---

## Ver Más

- [Guía de Configuración de WhatsApp](./WHATSAPP-SETUP.md)
- [Dashboard de Conversaciones](/dashboard/whatsapp)
- [Uso y Límites](/dashboard/settings/whatsapp/usage)

---

*Última actualización: Diciembre 2024*
