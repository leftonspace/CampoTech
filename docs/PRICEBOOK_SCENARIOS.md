# Escenarios de Uso: Integración de Catálogo de Precios

> **Documento de referencia** para entender el flujo completo de trabajo con el sistema de catálogo de precios (Pricebook) de CampoTech. Cada escenario detalla las acciones en la vida real y las correspondientes acciones en el sistema.

---

## Índice

1. [Escenario 1: Presupuesto de Instalación de Aire Acondicionado](#escenario-1-presupuesto-de-instalación-de-aire-acondicionado)
2. [Escenario 2: Diagnóstico en Sitio Cambia el Alcance](#escenario-2-diagnóstico-en-sitio-cambia-el-alcance)
3. [Escenario 3: Proyecto de Plomería Multi-Visita](#escenario-3-proyecto-de-plomería-multi-visita)
4. [Escenario 4: Reparación de Emergencia sin Presupuesto Previo](#escenario-4-reparación-de-emergencia-sin-presupuesto-previo)
5. [Escenario 5: Presupuesto Aprobado → Generación de Factura AFIP](#escenario-5-presupuesto-aprobado--generación-de-factura-afip)
6. [Escenario 6: Técnico Propone Precio Diferente](#escenario-6-técnico-propone-precio-diferente)
7. [Escenario 7: Búsqueda en Catálogo por Especialidad](#escenario-7-búsqueda-en-catálogo-por-especialidad)

---

## Escenario 1: Presupuesto de Instalación de Aire Acondicionado

### Contexto
Un cliente potencial contacta a la empresa para solicitar la instalación de un aire acondicionado split en su departamento. Necesita saber el costo antes de confirmar el trabajo.

### Paso a Paso Completo

#### 1.1 Contacto Inicial del Cliente

**En la vida real:**
- El cliente Juan Pérez llama al teléfono de la empresa o envía un mensaje por WhatsApp: *"Hola, quiero instalar un aire split de 3000 frigorías en mi living. ¿Cuánto sale?"*

**En el sistema (WhatsApp Copilot):**
1. El mensaje llega al panel de WhatsApp en `Dashboard → Mensajes`
2. El Copilot de IA detecta la intención y sugiere respuesta:
   ```
   ¡Hola Juan! Gracias por contactarnos. 
   Para darte un presupuesto preciso, necesito saber:
   - ¿En qué piso está el departamento?
   - ¿La unidad exterior iría en balcón o fachada?
   - ¿Tenés ya el equipo o necesitás que lo consigamos?
   ```
3. El administrador aprueba o edita la respuesta y la envía

#### 1.2 Recopilación de Información

**En la vida real:**
- Juan responde: *"Es un 5to piso, la externa va en el balcón. Ya tengo el equipo, es un BGH de 3000 frigorías."*

**En el sistema:**
1. El administrador abre el panel de cliente (o crea uno nuevo si no existe)
2. Registra la dirección: `Av. Corrientes 1234, 5° B, CABA`
3. Agrega notas: "Cliente tiene equipo BGH 3000f. Instalación en balcón."

#### 1.3 Creación del Trabajo y Presupuesto

**En el sistema (Dashboard Web):**

1. **Crear nuevo trabajo:**
   - Click en `Dashboard → Trabajos → + Nuevo Trabajo`
   - Completa el formulario:
     - **Cliente:** Juan Pérez
     - **Título:** Instalación de aire acondicionado split
     - **Tipo de servicio:** AIRE_ACONDICIONADO
     - **Dirección:** Av. Corrientes 1234, 5° B, CABA
     - **Prioridad:** Normal
     - **Descripción:** "Instalación de split BGH 3000 frigorías en living. Equipo provisto por cliente. Unidad exterior en balcón 5to piso."
   - Guarda el trabajo (queda en estado PENDIENTE)

2. **Agregar items del catálogo:**
   - Abre el trabajo creado → Click en `Editar`
   - En la sección **"Items del Catálogo"**:
   
   | Acción | Búsqueda | Item Seleccionado | Precio |
   |--------|----------|-------------------|--------|
   | Buscar | "instalación split" | Instalación Split hasta 4500 frigorías | $45.000 |
   | Buscar | "caño cobre" | Caño de cobre 1/4" x 3m | $8.500 |
   | Buscar | "caño cobre" | Caño de cobre 3/8" x 3m | $9.200 |
   | Buscar | "soporte" | Soporte exterior reforzado | $12.000 |
   | Buscar | "cableado" | Cableado eléctrico instalación (hasta 10m) | $6.800 |

3. **Revisión del presupuesto:**
   ```
   PRESUPUESTO - Trabajo #JOB-2026-0847
   ─────────────────────────────────────────────
   Instalación Split hasta 4500 frigorías    $45.000
   Caño de cobre 1/4" x 3m                    $8.500
   Caño de cobre 3/8" x 3m                    $9.200
   Soporte exterior reforzado                $12.000
   Cableado eléctrico (hasta 10m)             $6.800
   ─────────────────────────────────────────────
   Subtotal:                                 $81.500
   IVA (21%):                                $17.115
   ─────────────────────────────────────────────
   TOTAL:                                    $98.615
   ```

#### 1.4 Envío del Presupuesto al Cliente

**En el sistema:**
1. Desde el detalle del trabajo, click en `Acciones → Enviar WhatsApp`
2. El sistema genera mensaje pre-armado:
   ```
   Hola Juan, te paso el presupuesto para la instalación del split:

   📋 Trabajo: Instalación de aire acondicionado split
   📍 Dirección: Av. Corrientes 1234, 5° B

   💰 Detalle:
   • Instalación Split hasta 4500 frigorías - $45.000
   • Caños de cobre (gas y líquido) - $17.700
   • Soporte exterior reforzado - $12.000
   • Cableado eléctrico - $6.800

   Subtotal: $81.500
   IVA (21%): $17.115
   ────────────────
   Total: $98.615

   El trabajo demora aproximadamente 3-4 horas.
   ¿Te queda bien para agendar?
   ```
3. El administrador envía el mensaje

**En la vida real:**
- Juan recibe el WhatsApp, consulta con su pareja
- Responde: *"Dale, agendamos para el sábado a la mañana si puede ser"*

#### 1.5 Confirmación y Programación

**En el sistema:**
1. El administrador abre el trabajo
2. Click en `Editar` → Sección **Programación de visitas**:
   - **Fecha:** Sábado 01/02/2026
   - **Hora inicio:** 09:00
   - **Hora fin:** 13:00
3. Sección **Técnicos asignados**:
   - Selecciona "Carlos Rodríguez" (verificando disponibilidad en verde ✓)
4. Guarda → Estado cambia a **ASIGNADO**

**Notificaciones automáticas:**
- Carlos recibe notificación push en su app móvil
- Juan recibe WhatsApp de confirmación:
  ```
  ✅ Trabajo confirmado
  
  📅 Sábado 01/02/2026 a las 09:00
  👨‍🔧 Técnico: Carlos Rodríguez
  📍 Av. Corrientes 1234, 5° B
  
  Carlos te contactará cuando esté en camino.
  ```

#### 1.6 Día del Trabajo

**En la vida real:**
- Carlos sale de la oficina con los materiales
- Marca en la app "En camino"

**En el sistema (App Móvil):**
1. Carlos abre el trabajo en su lista
2. Toca `Iniciar viaje` → Estado cambia a **EN_CAMINO**
3. Juan recibe WhatsApp automático:
   ```
   🚗 Carlos está en camino a tu domicilio.
   Tiempo estimado: 25 minutos.
   ```

**En la vida real:**
- Carlos llega, toca el timbre, sube al 5° B
- Inspecciona el lugar de instalación
- Comienza el trabajo

**En el sistema:**
1. Carlos toca `Llegué` → Estado cambia a **EN_TRABAJO**

#### 1.7 Finalización del Trabajo

**En la vida real:**
- Carlos termina la instalación (3.5 horas)
- Prueba el equipo, todo funciona
- Limpia la zona de trabajo

**En el sistema (App Móvil):**
1. Carlos toca `Completar trabajo`
2. **Paso 1 - Notas:**
   - "Instalación completada sin inconvenientes. Equipo funcionando correctamente. Carga de gas completa."
   - Los materiales ya están cargados desde el presupuesto
3. **Paso 2 - Fotos:**
   - Toma foto de la unidad interior instalada
   - Toma foto de la unidad exterior en balcón
   - Toma foto del termostato mostrando temperatura
4. **Paso 3 - Firma:**
   - Juan firma en la pantalla del celular

5. Toca `Completar trabajo` → Estado cambia a **COMPLETADO**

#### 1.8 Post-Trabajo

**En el sistema:**
- El trabajo se sincroniza con el servidor
- Las fotos se suben a Supabase Storage
- Se actualiza el historial del cliente

**WhatsApp automático al cliente:**
```
✅ Trabajo completado

Gracias por confiar en CampoTech, Juan.

📋 Resumen:
• Instalación de split BGH 3000f
• Técnico: Carlos Rodríguez
• Duración: 3.5 horas

💰 Total: $98.615

¿Cómo querés abonar?
1️⃣ Efectivo
2️⃣ Transferencia
3️⃣ Mercado Pago
```

---

## Escenario 2: Diagnóstico en Sitio Cambia el Alcance

### Contexto
Un cliente reporta que su calefón no enciende. Se agenda una visita de diagnóstico. Al llegar, el técnico descubre que el problema es más grave de lo esperado.

### Paso a Paso Completo

#### 2.1 Contacto y Creación del Trabajo

**En la vida real:**
- María González llama: *"Mi calefón no prende, sale la chispa pero no agarra la llama"*

**En el sistema:**
1. administrador crea trabajo:
   - **Título:** Revisión calefón - No enciende
   - **Tipo:** GAS
   - **Descripción:** "Cliente reporta que el calefón hace chispa pero no enciende. Posible problema de válvula o sensor."
   
2. Agrega item de diagnóstico del catálogo:
   - "Diagnóstico y revisión equipo a gas" - $8.000

3. Presupuesto inicial:
   ```
   Diagnóstico y revisión equipo a gas    $8.000
   ─────────────────────────────────────────────
   Subtotal:                              $8.000
   IVA (21%):                             $1.680
   ─────────────────────────────────────────────
   TOTAL:                                 $9.680
   ```

#### 2.2 Visita de Diagnóstico

**En la vida real:**
- Técnico Martín llega al domicilio
- Revisa el calefón durante 20 minutos
- Descubre: válvula de gas dañada + intercambiador con fuga

**En el sistema (App Móvil - Opción Voice-to-Invoice):**

1. Martín toca el botón de micrófono 🎤
2. Graba su informe hablando:
   > *"Terminé la revisión del calefón. Es un Orbis modelo 315 de unos 8 años. El problema principal es que la válvula de gas está dañada, no abre correctamente. Además encontré que el intercambiador tiene una fuga pequeña en la soldadura inferior. Los repuestos que necesito son: válvula de gas modelo VG200 que sale quince mil pesos, intercambiador de calor original Orbis a veinticinco mil, y habría que sumar dos horas de mano de obra a ocho mil la hora para el reemplazo."*

3. La IA procesa la transcripción y extrae:
   ```
   ╔══════════════════════════════════════════════════════╗
   ║  IA Extracción Completada                            ║
   ╠══════════════════════════════════════════════════════╣
   ║  Se extrajeron 3 items                               ║
   ║  Total estimado: $56.000                             ║
   ║                                                      ║
   ║  Revisá los items antes de continuar.                ║
   ╚══════════════════════════════════════════════════════╝
   ```

4. Items extraídos automáticamente:
   | Item | Cantidad | Precio Unit. | Total |
   |------|----------|--------------|-------|
   | Válvula de gas VG200 | 1 | $15.000 | $15.000 |
   | Intercambiador de calor Orbis | 1 | $25.000 | $25.000 |
   | Mano de obra | 2 hrs | $8.000 | $16.000 |

5. Martín revisa, ajusta si es necesario, y guarda

#### 2.3 Comunicación del Nuevo Presupuesto

**En el sistema (Dashboard Web):**
El administrador ve que el trabajo tiene items actualizados:

```
PRESUPUESTO ACTUALIZADO - Trabajo #JOB-2026-0892
─────────────────────────────────────────────────
Diagnóstico y revisión equipo a gas         $8.000
Válvula de gas VG200                       $15.000
Intercambiador de calor Orbis              $25.000
Mano de obra reparación (2 hrs)            $16.000
─────────────────────────────────────────────────
Subtotal:                                  $64.000
IVA (21%):                                 $13.440
─────────────────────────────────────────────────
TOTAL:                                     $77.440
```

**WhatsApp al cliente:**
```
Hola María, te paso el diagnóstico del calefón:

🔍 Problemas encontrados:
• Válvula de gas dañada (no abre correctamente)
• Intercambiador con fuga en soldadura

💰 Presupuesto de reparación:
• Diagnóstico (ya realizado): $8.000
• Válvula de gas VG200: $15.000
• Intercambiador de calor: $25.000
• Mano de obra (2 hrs): $16.000

Subtotal: $64.000
IVA: $13.440
────────────────
Total: $77.440

⚠️ Nota: Sin la reparación, el calefón no es seguro de usar.

¿Querés que procedamos con el arreglo? Podemos volver mañana con los repuestos.
```

**En la vida real:**
- María consulta el presupuesto
- Responde: *"Sí, procedan. ¿Mañana a la tarde puede ser?"*

#### 2.4 Segunda Visita - Reparación

**En el sistema:**
1. administrador agenda segunda visita para mañana 14:00-17:00
2. Asigna al mismo técnico (Martín)
3. Estado: **ASIGNADO**

**En la vida real:**
- Martín compra los repuestos
- Al día siguiente, vuelve al domicilio
- Realiza la reparación completa
- Prueba el calefón, funciona perfectamente

**En el sistema (App Móvil):**
1. Martín completa el trabajo con:
   - Notas: "Reparación completada. Se reemplazó válvula y intercambiador. Calefón probado 10 minutos sin fugas."
   - Fotos del trabajo terminado
   - Firma de María

2. Estado → **COMPLETADO**

---

## Escenario 3: Proyecto de Plomería Multi-Visita

### Contexto
Un cliente necesita remodelar completamente el baño. El trabajo requiere múltiples visitas: demolición, instalación de cañerías, y colocación de artefactos.

### Paso a Paso Completo

#### 3.1 Consulta Inicial

**En la vida real:**
- Roberto Sánchez contacta: *"Quiero hacer el baño completo de nuevo. Cambiar todo: inodoro, bidet, vanitory, ducha. Y las cañerías tienen 40 años, hay que cambiarlas."*

**En el sistema:**
1. administrador crea trabajo con:
   - **Modo de precio:** HÍBRIDO (combina total fijo + por visita)
   - **Tipo de duración:** MULTI_VISITA
   - **Descripción detallada:** "Remodelación completa de baño. Incluye demolición, cambio de cañerías PPF, instalación de sanitarios nuevos."

#### 3.2 Visita de Relevamiento

**En el sistema:**
1. Se agenda **Visita 1** - Relevamiento
2. Técnico visita, toma medidas, evalúa estado

**En el sistema (Post-visita):**
administrador arma presupuesto detallado por visitas:

```
═══════════════════════════════════════════════════════
PRESUPUESTO REMODELACIÓN BAÑO
Cliente: Roberto Sánchez
Fecha: 05/02/2026
═══════════════════════════════════════════════════════

📅 VISITA 1 - Demolición (1 día)
─────────────────────────────────────────────────────────
Demolición de baño completo                       $35.000
Retiro de sanitarios existentes                   $12.000
Retiro de escombros (volquete incluido)           $18.000
─────────────────────────────────────────────────────────
Subtotal Visita 1:                                $65.000

📅 VISITA 2 - Cañerías (2 días)
─────────────────────────────────────────────────────────
Instalación cañería PPF completa                  $45.000
Caño PPF 1/2" (x10 unidades)                      $12.000
Caño PPF 3/4" (x5 unidades)                        $9.000
Conexiones y accesorios PPF                        $8.500
Instalación desagües PVC                          $22.000
─────────────────────────────────────────────────────────
Subtotal Visita 2:                                $96.500

📅 VISITA 3 - Artefactos (1 día)
─────────────────────────────────────────────────────────
Instalación inodoro                               $12.000
Instalación bidet                                 $10.000
Instalación vanitory                              $15.000
Instalación grifería ducha                        $14.000
Instalación grifería lavatorio                     $8.000
─────────────────────────────────────────────────────────
Subtotal Visita 3:                                $59.000

═══════════════════════════════════════════════════════
RESUMEN TOTAL
─────────────────────────────────────────────────────────
Subtotal Materiales y Mano de Obra:              $220.500
IVA (21%):                                        $46.305
─────────────────────────────────────────────────────────
TOTAL PRESUPUESTO:                               $266.805

💳 FORMA DE PAGO SUGERIDA:
• Seña inicial (30%): $80.041
• Después de Visita 2: $93.382
• Al finalizar: $93.382
═══════════════════════════════════════════════════════
```

#### 3.3 Aprobación y Seña

**En la vida real:**
- Roberto aprueba el presupuesto
- Transfiere la seña de $80.041

**En el sistema:**
1. administrador registra el depósito:
   - En el trabajo → `Información de Precios`
   - **Seña Recibida:** $80.041
   - **Método:** Transferencia
   - El sistema muestra: "Saldo pendiente: $186.764"

2. Programa las 3 visitas en el calendario

#### 3.4 Visita 1 - Demolición

**En la vida real:**
- Equipo de 2 técnicos llega con herramientas
- Demolición completa del baño en 8 horas
- Volquete retira escombros

**En el sistema (App Móvil):**
1. Técnico principal registra:
   - Notas: "Demolición completada. Baño vacío y limpio. Se encontró cañería de plomo (previsto PPF igual)."
   - Fotos: antes, durante, después
2. Items de esta visita se marcan como ejecutados

#### 3.5 Visita 2 - Cañerías

**En la vida real:**
- 2 días de trabajo
- Día 1: Instalación de cañerías de agua
- Día 2: Instalación de desagües

**En el sistema:**
1. Cada día se registra el progreso
2. Al finalizar, se agregan notas:
   - "Cañerías PPF instaladas. Prueba de presión OK. Desagües con pendiente correcta."

**Comunicación con cliente:**
El administrador envía WhatsApp con fotos:
```
📸 Actualización de obra - Día 3

Roberto, te muestro cómo van las cañerías:
[Foto 1: Cañerías de agua]
[Foto 2: Desagües instalados]

Todo avanza según lo planeado. Mañana arrancamos con los artefactos.

¿Tenés los sanitarios o los compramos nosotros?
```

#### 3.6 Visita 3 - Artefactos

**En la vida real:**
- Técnico instala todos los artefactos
- Prueba funcionamiento completo
- Limpieza final

**En el sistema (App Móvil):**
1. Completa el trabajo con:
   - Notas detalladas de instalación
   - Fotos de cada artefacto instalado
   - Firma del cliente

2. Estado final → **COMPLETADO**

**Sistema automático:**
```
Total del trabajo:            $266.805
Seña abonada:                 -$80.041
─────────────────────────────────────────
Saldo a cobrar:              $186.764
```

---

## Escenario 4: Reparación de Emergencia sin Presupuesto Previo

### Contexto
Domingo 22:30 - Una clienta llama desesperada porque su termotanque está perdiendo agua y está inundando la cocina.

### Paso a Paso Completo

#### 4.1 Llamada de Emergencia

**En la vida real:**
- Laura Martínez llama al número de emergencias
- "¡Por favor necesito ayuda! Mi termotanque está perdiendo un montón de agua, está todo inundado la cocina!"

**En el sistema:**
1. administrador de guardia crea trabajo URGENTE:
   - **Prioridad:** URGENTE 🔴
   - **Título:** EMERGENCIA - Pérdida termotanque
   - **Descripción:** "Pérdida de agua activa. Cliente indica inundación en cocina. Requiere atención inmediata."
   - NO se agregan items de catálogo (no hay tiempo)

2. Asigna al técnico de guardia (Pedro)
3. Estado: **ASIGNADO**

#### 4.2 Respuesta del Técnico

**En el sistema (App Móvil):**
1. Pedro recibe notificación push con sonido de emergencia
2. Acepta el trabajo
3. Marca `En camino`

**WhatsApp automático:**
```
🚨 EMERGENCIA - Técnico en camino

Laura, Pedro está yendo a tu domicilio.
Tiempo estimado: 15 minutos.

Mientras tanto:
1. Cerrá la llave de paso del agua
2. Cortá la electricidad del termotanque
3. Secá lo que puedas

Pedro te llama cuando esté llegando.
```

#### 4.3 Trabajo en Sitio

**En la vida real:**
- Pedro llega, evalúa la situación
- Termotanque viejo (15 años) con tanque perforado
- No tiene reparación, hay que reemplazarlo
- Cierra el paso de agua, seca, pero no puede hacer más esta noche

**En el sistema (App Móvil):**
1. Pedro registra la situación:
   - Notas: "Termotanque con perforación en tanque interior. Sin reparación posible. Se cerró paso de agua y se dejó seguro. Cliente informada que mañana primera hora se reemplaza."

2. Agrega items manualmente:
   | Item | Precio |
   |------|--------|
   | Servicio de emergencia nocturno | $25.000 |
   | Diagnóstico urgente | $10.000 |

3. Trabajo queda EN PROGRESO (no completado)

#### 4.4 Día Siguiente - Reemplazo

**En la vida real:**
- Pedro vuelve a las 8:00 con termotanque nuevo
- Desinstala el viejo, instala el nuevo
- Prueba funcionamiento

**En el sistema (Dashboard):**
administrador agrega items del catálogo:
```
ITEMS AGREGADOS:
─────────────────────────────────────────────
Servicio de emergencia nocturno            $25.000
Diagnóstico urgente                        $10.000
Desinstalación termotanque existente       $12.000
Instalación termotanque eléctrico          $28.000
Mangueras conexión (x2)                     $4.500
─────────────────────────────────────────────
Subtotal:                                  $79.500
IVA (21%):                                 $16.695
─────────────────────────────────────────────
TOTAL (mano de obra):                      $96.195

Nota: El termotanque nuevo lo compró la clienta aparte.
```

#### 4.5 Finalización

**En el sistema (App Móvil):**
1. Pedro completa el trabajo:
   - Notas: "Termotanque Rheem 80L instalado y funcionando. Se probó calentamiento. Sin pérdidas."
   - Fotos del equipo instalado
   - Firma de Laura

2. Estado → **COMPLETADO**

---

## Escenario 5: Presupuesto Aprobado → Generación de Factura AFIP

### Contexto
Un comercio necesita factura A para un trabajo de instalación eléctrica. El presupuesto ya fue aprobado y el trabajo completado.

### Paso a Paso Completo

#### 5.1 Datos del Cliente

**En el sistema:**
Cliente registrado como:
- **Nombre:** Ferretería San Martín SRL
- **CUIT:** 30-71234567-9
- **Condición IVA:** Responsable Inscripto
- **Email:** admin@ferreteriasamartin.com.ar

#### 5.2 Trabajo Completado

El trabajo tiene los siguientes items:

```
TRABAJO #JOB-2026-0912 - COMPLETADO
─────────────────────────────────────────────
Instalación tablero eléctrico trifásico     $85.000
Cableado industrial (50m)                   $32.000
Termomagnéticas 32A (x6)                    $18.000
Disyuntor diferencial 40A                   $12.500
Mano de obra instalación (8 hrs)            $48.000
─────────────────────────────────────────────
Subtotal:                                  $195.500
IVA (21%):                                  $41.055
─────────────────────────────────────────────
TOTAL:                                     $236.555
```

#### 5.3 Generación de Factura

**En el sistema (Dashboard):**
1. En el detalle del trabajo, click en `Crear Factura`
2. Se abre formulario pre-llenado:
   - **Tipo de Factura:** A (automático por ser Resp. Inscripto)
   - **Punto de Venta:** 0001
   - **Fecha de Emisión:** Hoy
   - **Fecha de Vencimiento:** +30 días

3. Líneas de factura (heredadas del trabajo):
   | Descripción | Cantidad | Unitario | Subtotal |
   |-------------|----------|----------|----------|
   | Instalación tablero eléctrico trifásico | 1 | $85.000 | $85.000 |
   | Cableado industrial | 50 m | $640 | $32.000 |
   | Termomagnética 32A | 6 | $3.000 | $18.000 |
   | Disyuntor diferencial 40A | 1 | $12.500 | $12.500 |
   | Mano de obra instalación | 8 hrs | $6.000 | $48.000 |

4. Click en `Emitir Factura`

#### 5.4 Proceso AFIP

**En el sistema (automático):**
1. Se envía solicitud a AFIP vía web service
2. AFIP responde con:
   - **CAE:** 74123456789012
   - **Vencimiento CAE:** 10 días
3. Se genera PDF con código QR
4. Se guarda en Supabase Storage

**Cambios en el trabajo:**
- `pricingLockedAt` = fecha/hora actual
- `pricingLockedById` = ID del usuario que emitió

**En la sección de Items del Catálogo:**
```
🔒 Precios bloqueados
Los items no pueden modificarse porque ya se generó factura.
Factura: A 0001-00000847
CAE: 74123456789012
```

#### 5.5 Envío al Cliente

**En el sistema:**
1. Click en `Enviar por Email`
2. Se envía automáticamente a admin@ferreteriasamartin.com.ar

**Email enviado:**
```
Asunto: Factura A 0001-00000847 - CampoTech

Estimados Ferretería San Martín,

Adjuntamos la factura correspondiente al trabajo realizado:

Factura: A 0001-00000847
Fecha: 08/02/2026
Total: $236.555,00

CAE: 74123456789012
Vencimiento CAE: 18/02/2026

Adjunto: Factura_A_0001-00000847.pdf

Datos para transferencia:
CBU: 0000000000000000000000
Alias: campotech.pagos

Gracias por confiar en CampoTech.
```

#### 5.6 Intento de Modificación (Bloqueado)

**En el sistema:**
Si alguien intenta editar los items del trabajo:

```
⚠️ No se puede modificar

El precio está bloqueado porque ya se generó factura.
Factura: A 0001-00000847
Fecha de bloqueo: 08/02/2026 15:32

Para modificar, debe anularse la factura primero.
```

**En la API:**
Si se intenta POST/PUT/DELETE a `/api/jobs/{id}/line-items`:
```json
{
  "success": false,
  "error": "El precio está bloqueado (ya se generó factura)"
}
```
HTTP Status: 403 Forbidden

---

## Escenario 6: Técnico Propone Precio Diferente

### Contexto
Se presupuestó una reparación de aire acondicionado en $50.000. El técnico llega y descubre que el problema es más simple de lo esperado.

### Paso a Paso Completo

#### 6.1 Presupuesto Original

**En el sistema:**
Trabajo creado con items del catálogo:
```
PRESUPUESTO ORIGINAL - #JOB-2026-0923
─────────────────────────────────────────────
Diagnóstico aire acondicionado              $12.000
Recarga de gas R410A (2 kg)                 $24.000
Limpieza de filtros y serpentina            $8.000
Mano de obra reparación                     $6.000
─────────────────────────────────────────────
Subtotal:                                   $50.000
IVA (21%):                                  $10.500
─────────────────────────────────────────────
TOTAL:                                      $60.500
```

**Cliente aprobó.** Trabajo agendado.

#### 6.2 Descubrimiento en Sitio

**En la vida real:**
- Técnico Luciano llega al domicilio
- Revisa el aire acondicionado
- Descubre que solo era un capacitor dañado
- No necesita recarga de gas
- Reparación mucho más simple

**En el sistema (App Móvil):**
1. Luciano abre los items del trabajo
2. Elimina "Recarga de gas R410A" (-$24.000)
3. Modifica cantidad de "Mano de obra" de 1 a 0.5 hrs (-$3.000)
4. Agrega item: "Capacitor 35 µF" - $2.500

Nueva lista:
```
Diagnóstico aire acondicionado              $12.000
Capacitor 35 µF                              $2.500
Limpieza de filtros y serpentina            $8.000
Mano de obra reparación (0.5 hrs)           $3.000
─────────────────────────────────────────────
Subtotal:                                   $25.500
```

#### 6.3 Propuesta del Técnico

**En el sistema (App Móvil):**
1. Luciano propone precio en sección "Precio de esta visita":
   - **Estimado original:** $50.000
   - **Precio real:** $25.500
   - **Motivo:** "El problema era solo un capacitor dañado. No necesitaba recarga de gas. Trabajo más simple de lo previsto."

2. Completa el trabajo con firma del cliente

#### 6.4 Vista del administrador

**En el sistema (Dashboard):**
El trabajo aparece con indicador de variación:

```
╔════════════════════════════════════════════════════════╗
║  ⚠️ VARIACIÓN DE PRECIO                               ║
╠════════════════════════════════════════════════════════╣
║  Estimado:     $50.000                                 ║
║  Propuesto:    $25.500                                 ║
║  Diferencia:   -$24.500 (49% menos)                    ║
╠════════════════════════════════════════════════════════╣
║  Motivo del técnico:                                   ║
║  "El problema era solo un capacitor dañado.            ║
║   No necesitaba recarga de gas."                       ║
╚════════════════════════════════════════════════════════╝

[Aprobar precio propuesto] [Mantener original] [Ajustar]
```

#### 6.5 Decisión y Comunicación

**En el sistema:**
1. administrador clickea `Aprobar precio propuesto`
2. `finalTotal` se actualiza a $25.500 + IVA = $30.855

**WhatsApp al cliente:**
```
✅ Trabajo completado - Buenas noticias!

Hola, te escribimos de CampoTech.

El técnico encontró que el problema era más simple de lo esperado. Solo necesitaba un capacitor nuevo.

💰 Precio actualizado:
   Original estimado: $60.500
   Precio final: $30.855 ✨

Ahorraste $29.645!

¿Cómo preferís abonar?
1️⃣ Efectivo
2️⃣ Transferencia
3️⃣ Mercado Pago
```

#### 6.6 Caso Contrario: Precio Mayor

**Escenario alternativo:**
Si el técnico hubiera encontrado un problema peor (compresor dañado), el sistema también lo maneja:

```
╔════════════════════════════════════════════════════════╗
║  ⚠️ VARIACIÓN DE PRECIO - REQUIERE APROBACIÓN         ║
╠════════════════════════════════════════════════════════╣
║  Estimado:     $50.000                                 ║
║  Propuesto:    $185.000                                ║
║  Diferencia:   +$135.000 (270% más)                    ║
╠════════════════════════════════════════════════════════╣
║  Motivo del técnico:                                   ║
║  "Compresor quemado. Requiere reemplazo completo."     ║
╠════════════════════════════════════════════════════════╣
║  ⚠️ Variación mayor al 10% - Requiere autorización    ║
╚════════════════════════════════════════════════════════╝

[Contactar cliente primero] [Aprobar] [Rechazar]
```

El administrador contacta al cliente antes de aprobar un aumento significativo.

---

## Escenario 7: Búsqueda en Catálogo por Especialidad

### Contexto
Un administrador nuevo necesita armar un presupuesto para un trabajo de refrigeración comercial, pero no conoce los nombres exactos de los items.

### Paso a Paso Completo

#### 7.1 Situación

**En la vida real:**
- Cliente tiene una heladera comercial que no enfría bien
- administrador no es técnico, no sabe qué servicios aplican

#### 7.2 Búsqueda Inteligente

**En el sistema (Dashboard - Sección Items del Catálogo):**

1. **Búsqueda inicial:**
   - Escribe: "refri"
   - Resultados muestran todos los items relacionados

2. **Filtro por tipo:**
   - Selecciona filtro: `Tipo: SERVICIO`
   - Resultados filtrados:
   
   | Item | Tipo | Precio |
   |------|------|--------|
   | Diagnóstico equipo refrigeración | SERVICIO | $15.000 |
   | Recarga gas R404A (comercial) | SERVICIO | $45.000/kg |
   | Recarga gas R134A | SERVICIO | $28.000/kg |
   | Limpieza condensador industrial | SERVICIO | $22.000 |
   | Reparación compresor comercial | SERVICIO | $65.000 |

3. **Búsqueda de materiales:**
   - Cambia filtro: `Tipo: MATERIAL`
   - Escribe: "R404"
   - Resultados:
   
   | Item | Tipo | Precio |
   |------|------|--------|
   | Gas refrigerante R404A x 1kg | MATERIAL | $18.500 |
   | Filtro secador R404A 3/8" | MATERIAL | $8.200 |

#### 7.3 Armado del Presupuesto

**En el sistema:**
1. Click en (+) de "Diagnóstico equipo refrigeración"
   - Se agrega con cantidad 1

2. Click en (+) de "Recarga gas R404A"
   - Modifica cantidad a 2 (kg)

3. Click en (+) de "Gas refrigerante R404A x 1kg"
   - Modifica cantidad a 2

4. Click en (+) de "Limpieza condensador industrial"

**Presupuesto resultante:**
```
PRESUPUESTO - Refrigeración Comercial
─────────────────────────────────────────────────
Diagnóstico equipo refrigeración (x1)       $15.000
Recarga gas R404A (x2 kg)                   $90.000
Gas refrigerante R404A (x2 kg)              $37.000
Limpieza condensador industrial (x1)        $22.000
─────────────────────────────────────────────────
Subtotal:                                  $164.000
IVA (21%):                                  $34.440
─────────────────────────────────────────────────
TOTAL:                                     $198.440
```

#### 7.4 Ayuda del Sistema

**Funciones adicionales:**

1. **Sugerencias relacionadas:**
   Al agregar "Recarga gas R404A", el sistema sugiere:
   ```
   💡 Items frecuentemente agregados juntos:
   • Gas refrigerante R404A x 1kg
   • Filtro secador R404A
   ```

2. **Descripción expandida:**
   Hover sobre cualquier item muestra detalles:
   ```
   Diagnóstico equipo refrigeración
   ─────────────────────────────────
   Código: REFRI-DIAG-001
   Categoría: Refrigeración
   Incluye: Hasta 1 hora de revisión...
   Unidad: unidad
   Última actualización: 15/01/2026
   ```

3. **Búsqueda por código:**
   Si el técnico dice "Necesitamos el REFRI-DIAG-001":
   - administrador busca "REFRI-DIAG-001"
   - Encuentra exactamente ese item

---

## Resumen: Funcionalidades del Sistema por Rol

### administrador (Dashboard Web)

| Función | Ubicación | Uso |
|---------|-----------|-----|
| Crear presupuesto | EditJobModal → Items del Catálogo | Buscar, agregar, ajustar cantidades |
| Ver items de trabajo | JobDetail → Sección Precios | Resumen con totales |
| Aprobar variaciones | JobDetail → Alerta de variación | Decidir precio final |
| Generar factura | JobDetail → Crear Factura | Emite con CAE de AFIP |
| Comunicar por WhatsApp | JobDetail → Enviar WhatsApp | Presupuestos, confirmaciones |

### Técnico (App Móvil)

| Función | Ubicación | Uso |
|---------|-----------|-----|
| Voice-to-Invoice | Completar trabajo → 🎤 | Dictar reporte, IA extrae items |
| Agregar materiales | Completar trabajo → Agregar | Manual: nombre, cantidad, precio |
| Proponer precio | Completar trabajo → Precio real | Ajustar si difiere del estimado |
| Justificar variación | Completar trabajo → Motivo | Requerido si variación >10% |

### Cliente (WhatsApp)

| Comunicación | Momento | Contenido |
|--------------|---------|-----------|
| Presupuesto | Post-creación | Detalle de items y totales |
| Confirmación | Post-agenda | Fecha, hora, técnico asignado |
| En camino | Técnico sale | ETA, instrucciones |
| Completado | Post-trabajo | Resumen, solicitud de pago |
| Factura | Post-emisión | PDF adjunto, datos bancarios |

---

## Anexo: Cumplimiento AFIP

### Bloqueo de Precios

Una vez emitida factura electrónica con CAE:
- `pricingLockedAt` se establece
- Items del catálogo quedan en modo lectura
- API rechaza modificaciones (HTTP 403)
- Se requiere anular factura para desbloquear

### Auditoría

Cada modificación de items registra:
- Usuario que realizó el cambio
- Fecha y hora
- Valor anterior y nuevo
- Motivo (si aplica)

Esta trazabilidad cumple con requisitos de AFIP para facturación electrónica.

---

*Documento generado: Enero 2026*
*Versión del sistema: CampoTech v2.0*
