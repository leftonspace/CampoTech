# CampoTech: Prueba de Estrés Legislativo
## Análisis de Responsabilidad Regulatoria Argentina

**Preparado por:** Auditor Senior de Cumplimiento Legal  
**Fecha:** 12 de febrero de 2026  
**Clasificación:** CONFIDENCIAL — Documento Preparatorio Abogado-Cliente  
**Metodología:** Cruce de referencias con legislación argentina vigente, resoluciones de AFIP, jurisprudencia de la Corte Suprema, y **el código fuente real de CampoTech** (esquema Prisma, aplicación Next.js, integraciones de pago)

---

> ⚠️ **DESCARGO DE RESPONSABILIDAD**: Este análisis se basa en textos legales de acceso público y jurisprudencia publicada a febrero de 2026. Identifica *riesgos* regulatorios y NO constituye asesoramiento jurídico. Todos los hallazgos deben ser validados por un abogado argentino matriculado antes de tomar cualquier acción.

---

## Tabla de Contenidos

1. [Obligaciones Ocultas](#1-obligaciones-ocultas)
   - 1.1 UIF / Antilavado de Activos
   - 1.2 CERT-AR / Notificación de Brechas de Ciberseguridad
   - 1.3 DNPDP / Registro de Bases de Datos
   - 1.4 AFIP RG 4290 — Facturación Electrónica
   - 1.5 Registro Nacional No Llame
   - 1.6 **INPI — Registro de Marca (NUEVO)**
2. [El Riesgo de "Uberización"](#2-el-riesgo-de-uberización)
   - 2.1 Jurisprudencia Clave
   - 2.2 Análisis de Vulnerabilidad de CampoTech
   - 2.3 Reforma Pendiente
   - 2.4 **Art. 30 LCT — La "Opción Nuclear" de Solidaridad (NUEVO)**
3. [Trampas Provinciales: Ingresos Brutos & Convenio Multilateral](#3-trampas-provinciales)
   - 3.1 Ingresos Brutos — Multijurisdiccional
   - 3.2 Riesgos Provinciales Específicos
   - 3.3 **SIRCREB / SIRCUPA — El Drenaje Automático de Ingresos (NUEVO)**
4. [Responsabilidad por Software y Defensa del Consumidor](#4-responsabilidad-por-software)
   - 4.1 Responsabilidad por Producto (CCCN)
   - 4.2 Aplicabilidad de la Ley 24.240
   - 4.3 **Ventanilla Federal y Trampa del Domicilio Legal (NUEVO)**
5. [Soberanía de Datos](#5-soberanía-de-datos)
6. [Riesgos Transversales y Matriz Resumen](#6-riesgos-transversales)
7. [Defensa Legal Macroeconómica](#7-defensa-legal-macroeconómica)
   - 7.1 **La Prohibición de "Indexación" (Ley 23.928 + DNU 70/2023)**
   - 7.2 **El "Cepo" y Repatriación de Ganancias (MULC)**
   - 7.3 **Impuesto de Sellos sobre Aceptación Digital**

---

## 1. Obligaciones Ocultas

### 1.1 🔴 UIF / Antilavado de Activos (Ley 25.246 + Resolución UIF 76/2019)

**La Trampa:** CampoTech integra MercadoPago vía OAuth y almacena `MP_ACCESS_TOKEN` por organización (confirmado en el código: `Organization.afipCertificateEncrypted`, integración MP en `src/integrations/mercadopago/`). Si bien CampoTech NO procesa pagos directamente, la **Resolución UIF N° 76/2019** define a los "Adquirentes, Agregadores, Agrupadores y Facilitadores de Pagos" como **sujetos obligados** bajo la ley de antilavado de activos.

**La Cuestión Jurídica:** ¿La integración OAuth de CampoTech (donde las cuentas de MercadoPago de las organizaciones cliente procesan los pagos y CampoTech crea `mp_preference_id` y rastrea `mp_payment_status` — ver modelo `Job`) constituye actuar como "Facilitador de Pagos"?

**Obligaciones Requeridas si se Clasifica como Sujeto Obligado:**

| Obligación | Base Legal | Estado en el Código |
|------------|-----------|---------------------|
| Designar un oficial de cumplimiento UIF ("Enlace") | Res. UIF 76/2019, Art. 5 | ❌ **NO IMPLEMENTADO** |
| Presentar Reportes de Operación Sospechosa (ROS) dentro de 150 días calendario | Ley 25.246, Art. 21(b); Res. UIF 76/2019 | ❌ **NO IMPLEMENTADO** |
| Implementar KYC (Conozca a su Cliente) para todas las organizaciones | Res. UIF 76/2019, Art. 10 | ⚠️ Parcial (existe validación de CUIT + verificación de identidad, pero no de grado UIF) |
| Mantener sistemas de monitoreo de transacciones | Res. UIF 76/2019, Art. 8 | ⚠️ Parcial (monitoreo de salud fiscal en `api/analytics/fiscal-health` pero no enfocado en AML) |
| Reportar a la UIF dentro de las 48 horas ante sospecha de financiamiento del terrorismo | Ley 25.246, Art. 21 ter | ❌ **NO IMPLEMENTADO** |
| **Verificar clientes contra el RePET** (Registro Público de Personas y Entidades vinculadas a actos de Terrorismo) antes del alta | **Res. UIF 49/2024** | ❌ **NO IMPLEMENTADO** |
| Monitorear continuamente clientes existentes contra actualizaciones del RePET | **Res. UIF 49/2024**, Art. 3 | ❌ **NO IMPLEMENTADO** |

**Riesgo Actualizado (Res. UIF 200/2024):** La UIF ha extendido las obligaciones a los PSP (Proveedores de Servicios de Pago) y entidades de préstamo no financieras, endureciendo la fiscalización en línea con los estándares del GAFI. Esta expansión hace la clasificación como "facilitador" *más probable*, no menos.

**Evidencia en el Código:** CampoTech `apps/web` maneja:
- `src/integrations/mercadopago/oauth/` — Gestión de tokens OAuth
- `src/integrations/mercadopago/webhook/` — Procesamiento de webhooks de pago  
- `src/integrations/mercadopago/chargeback/` — Manejo de contracargos
- `Job.mpPreferenceId`, `Job.mpPaymentStatus` — Seguimiento del estado de pagos
- `src/workers/payments/mp-reconciliation.service.ts` — Conciliación

> **VEREDICTO:** CampoTech está creando preferencias de pago, procesando notificaciones webhook, manejando contracargos y conciliando pagos. Afirmar que "nunca toca el dinero" mientras realiza estas operaciones es **jurídicamente precario**. Una auditoría de la UIF probablemente concluiría que CampoTech opera como facilitador *de facto*.

**Sanción:** Multas de ARS 1M a ARS 20M por infracción (Ley 25.246, Art. 24). Responsabilidad penal para directores en caso de omisión intencional.

**⚠️ Pregunta del Asociado — Verificación contra RePET:**

> *"¿CampoTech necesita verificar a sus clientes contra la 'Lista de Terroristas y Criminales' (RePET) antes de permitirles usar la plataforma?"*

**Respuesta:** **SÍ, si se clasifica como sujeto obligado.** La Res. UIF 49/2024 (publicada el 22 de marzo de 2024 en el Boletín Oficial) **obliga** a todos los sujetos obligados a:
1. Verificar que los clientes Y sus beneficiarios finales **no figuren en el RePET** antes de establecer cualquier relación comercial
2. **Monitorear continuamente** el RePET en busca de coincidencias con clientes existentes, beneficiarios finales y destinatarios de transferencias
3. Tomar **acción inmediata** (congelamiento, reporte) si se encuentra una coincidencia

El RePET es un registro público mantenido por el Ministerio de Justicia en [repet.jus.gob.ar](https://repet.jus.gob.ar). Dado que CampoTech da de alta organizaciones incluyendo su CUIT y representantes legales, implementar una verificación contra el RePET **al momento del registro** y periódicamente es técnicamente sencillo — pero actualmente está **completamente ausente** del código.

---

### 1.2 🔴 CERT-AR / Notificación de Brechas de Ciberseguridad (Res. 580/2011 + Convenio 108+)

**La Trampa:** CampoTech almacena credenciales AFIP encriptadas (`afipCertificateEncrypted`, `afipPrivateKeyEncrypted`), fotos de DNI, tokens de pago y datos personales. La actual Ley 25.326 de Argentina NO obliga a la notificación de brechas para empresas privadas. Sin embargo:

1. **Convenio 108+ (Ley N° 27.699, ratificada en 2022):** Una vez en vigor, exige notificación a la AAIP dentro de las **72 horas** de una brecha que afecte derechos fundamentales.
2. **Resolución AAIP 47/2018:** Recomienda la notificación de brechas como "buena práctica" — los reguladores usarán esta recomendación como evidencia de conducta esperada si ocurre una brecha.
3. **Proyecto de Ley de Protección de Datos Personales:** Actualmente en el Congreso (a enero de 2024), haría la notificación de brechas **obligatoria**.
4. **Resolución 126/2024 (AAIP):** Régimen sancionatorio unificado para violaciones de la Ley 25.326 — multas ahora sistematizadas y efectivamente aplicadas.

**Estado en el Código:**
- Existe registro de seguridad (`src/lib/security/log-redaction.ts`, `src/lib/logging/error-handler.ts`)
- Registros de auditoría implementados (modelo `AuditLog` en Prisma)
- NO se encontró un flujo de trabajo de notificación de brechas ni plan de respuesta a incidentes en el código

> **VEREDICTO:** Incluso sin un *mandato* legal actual, la expectativa práctica está evolucionando. Almacenar claves privadas de AFIP es particularmente riesgoso: si se filtran, un actor malicioso podría emitir facturas fraudulentas en nombre de las organizaciones cliente. La tendencia regulatoria claramente apunta hacia la notificación obligatoria.

**Acción Recomendada:** Implementar un flujo de respuesta a incidentes con capacidad de notificación en 72 horas *ahora*, antes de que sea obligatorio.

---

### 1.3 🟡 DNPDP / Registro de Bases de Datos (Ley 25.326, Art. 21; Decreto 1558/2001)

**La Trampa:** La página de privacidad en `/privacy` establece:

> *"CampoTech está inscripta en el Registro Nacional de Bases de Datos Personales de la Dirección Nacional de Protección de Datos Personales (DNPDP) conforme lo establecido en la Ley 25.326."*

**ESTO PUEDE NO SER CIERTO AÚN.** El código incluye:
- Modelo `DataAccessRequest` (cumplimiento ARCO)
- Modelo `UserConsentLog` (seguimiento de consentimiento)
- Múltiples categorías de datos: fotos de DNI, ubicación GPS, grabaciones de voz, credenciales AFIP

El registro ante la DNPDP (ahora vía AAIP) requiere registrar CADA base de datos que contenga datos personales. CampoTech tiene como mínimo:
1. Base de datos de empleados/técnicos (incluyendo datos cuasi-biométricos: fotos de DNI)
2. Base de datos de clientes (nombres, direcciones, teléfonos)
3. Datos financieros (credenciales AFIP, registros de pago)
4. Datos de ubicación (sesiones de rastreo GPS)
5. Datos de comunicaciones (mensajes de WhatsApp, grabaciones de voz)

**Cada base de datos puede requerir un registro por separado.**

**Sanción:** Sanciones bajo la Ley 25.326, Art. 31: multas, suspensión de la base de datos, potencial responsabilidad penal bajo el Art. 32.

---

### 1.4 🟡 AFIP RG 4290/2018 — Obligaciones como Agente de Facturación Electrónica

**Implementación Actual:** CampoTech genera CAEs y gestiona la facturación electrónica (confirmado: `Invoice.afipCae`, `Invoice.afipCaeExpiry`, `Invoice.afipQrCode`). El sistema almacena certificados AFIP y claves privadas para las organizaciones.

**Obligación Oculta:** Bajo la RG 4290, la entidad que emite facturas electrónicas en nombre de terceros puede ser clasificada como un **"Servicio de Facturación Tercerizado"**. Esto activa:

| Obligación | Base Legal | Estado |
|------------|-----------|--------|
| Registro ante AFIP como proveedor de servicios tecnológicos | RG 4290, Cap. IV | ❓ Desconocido |
| Garantías de integridad de datos y no repudio | RG 4290, Art. 33 | ✅ Implementado (inmutabilidad después de `pricingLockedAt`) |
| Conservación de todas las facturas emitidas durante 10 años | Ley 11.683 (Ley de Procedimiento Tributario) | ⚠️ Planificado pero verificar almacenamiento en frío |
| Asistencia en auditorías de AFIP a organizaciones cliente | RG 4290, Art. 38 | ❌ Sin herramientas de facilitación de auditoría |

---

### 1.5 🟡 Registro Nacional No Llame (Ley 26.951 + Decreto 2501/2014)

CampoTech envía mensajes automatizados por WhatsApp, SMS vía cola de salida (`SmsOutboundQueue`, `WaOutboundQueue`), y utiliza la API de Meta Cloud para mensajería empresarial. Bajo la Ley 26.951:

- Los contactos comerciales (incluyendo notificaciones de trabajo con contenido comercial) a números registrados en el *Registro Nacional No Llame* están prohibidos.
- Multa por infracción: ARS 1.000 a ARS 100.000 (sanciones actualizadas por Res. 126/2024).

**Evidencia en el código:** No se encontró verificación contra el registro *No Llame* antes de enviar mensajes salientes.

---

### 1.6 🔴 INPI — Registro de Marca (Ley 22.362)

**La Trampa:** Argentina opera bajo un sistema de **"primero en registrar"** para marcas (Art. 4, Ley 22.362), lo que significa que la titularidad de la marca se adquiere a través del **registro**, no del uso. A diferencia de EE.UU. (donde "primero en usar" brinda cierta protección de derecho consuetudinario), en Argentina, si alguien más registra "CampoTech" antes que vos, legalmente es dueño de la marca — y puede:
- Forzar la eliminación de los listados en App Store / Play Store
- Enviar cartas de cese y desistimiento
- Bloquear registros de dominio bajo `.ar` (NIC Argentina)
- Solicitar medidas cautelares para suspender las operaciones

**Registros Requeridos:**

| Clase de Niza | Cobertura | Relevancia para CampoTech |
|--------------|----------|--------------------------|
| **Clase 9** | Software, aplicaciones descargables, programas informáticos | App móvil (React Native), aplicación web de escritorio |
| **Clase 35** | Gestión empresarial, publicidad, servicios de marketing | Funciones de marketplace, generación de leads, perfiles comerciales |
| **Clase 42** | SaaS, desarrollo de software, servicios de TI, computación en la nube | Plataforma SaaS principal, servicios API, funciones de IA |
| **Clase 36** | Servicios financieros, procesamiento de pagos | Si se clasifica como facilitador de pagos |

**Proceso:**
1. **Búsqueda de antecedentes** en la base de datos del INPI — verificar que no existan marcas conflictivas
2. **Presentar solicitud** a través del portal online del INPI (requiere CUIT/CUIL + Clave Fiscal Nivel 2)
3. **Publicación** en el Boletín de Marcas — período de oposición de 30 días
4. **Examen** (plazo típico de 12-17 meses; puede extenderse a 24 meses si hay oposición)
5. **Registro** válido por 10 años, renovable

**Costo (a 2024):** ARS ~17.680 por clase (arancel oficial del INPI) + honorarios profesionales si se utiliza un abogado de marcas.

**⚠️ NUEVO: A partir del 1° de marzo de 2026**, el INPI limitará su examen a **prohibiciones absolutas y de orden público** únicamente. Los fundamentos relativos (similitud con marcas existentes) se manejarán exclusivamente mediante oposiciones de terceros. Esto significa que los usurpadores de marcas tendrán un camino aún más fácil a menos que las marcas válidas estén registradas.

**Evidencia de Activos de Marca en el Código:**
- Logo y marca presente en todo `apps/web` y `apps/mobile`
- Flag de funcionalidad "Marca Blanca" (White Label) en `feature-flags.ts` — confirma que la identidad de marca es una característica del producto
- Marketplace público con páginas con marca
- Dominio: campotech.app (presumiblemente)

**Defensa Legal Contra Usurpadores (Art. 24, Ley 22.362):**
Las marcas registradas por alguien que "conocía o debía conocer" que pertenecían a otro, o por usurpadores habituales, pueden ser anuladas — pero esto requiere **litigio**, que es costoso y lento (2-4 años).

> **VEREDICTO:** Registrar "CampoTech" ante el INPI en las Clases **9, 35 y 42** de inmediato. Esto es un **bloqueante previo al lanzamiento**. El costo de la solicitud es mínimo comparado con el riesgo existencial de que un usurpador bloquee las operaciones.

---

## 2. El Riesgo de "Uberización"

### 2.1 🔴 Jurisprudencia Clave Argentina — Cuando "Solo Software" Perdió

#### Caso 1: González c/ Kadabra SA (Glovo) — Abril 2024
**Tribunal:** Tribunal Nacional del Trabajo  
**Fallo:** Reconoció relación laboral entre trabajador de delivery y la plataforma.

**Factores Determinantes:**
1. **Prestación personal e infungible** — Los trabajadores no podían enviar sustitutos libremente
2. **Remuneración** — La plataforma fijaba el precio y pagaba a los trabajadores
3. **Subordinación jurídica** — La plataforma controlaba mediante gestión algorítmica, sistemas de quejas de clientes e indumentaria obligatoria con marca

#### Caso 2: Rappi / Tribunal de Trabajo N° 2, La Plata — 2021
**Tribunal:** Tribunal de Trabajo N° 2 de La Plata  
**Fallo:** Confirmó relación laboral; ratificó multa multimillonaria contra Rappi por clasificación errónea de trabajadores.

**Factores Determinantes:**
1. La plataforma mantenía "poder de dirección y control" a pesar de declarar libertad
2. La asignación algorítmica de tareas ≈ dirección gerencial
3. Dependencia económica de los trabajadores respecto de la plataforma

#### Caso 3: Pedidos Ya — Orden de Reincorporación — 2021
**Tribunal:** Justicia Nacional  
**Fallo:** Ordenó la reincorporación de un trabajador despedido, estableciendo precedente para los derechos organizacionales de los trabajadores de plataforma.

---

### 2.2 🔴 Análisis de Vulnerabilidad de CampoTech Frente a Estos Fallos

**El test jurídico aplicado en TODOS estos casos tiene tres componentes** (Art. 21-23, Ley 20.744):

| Factor | Qué buscan los tribunales | Evaluación de Riesgo para CampoTech |
|--------|--------------------------|-------------------------------------|
| **1. Control (Subordinación técnica)** | ¿La plataforma dicta CÓMO se realiza el trabajo? | 🟢 BAJO — CampoTech no dicta métodos. PERO: `ServiceTypeConfig` define categorías de servicio, se referencian niveles de habilidad UOCRA (campo `uocraLevel` en el modelo User), y el sistema de `confirmationCode` requiere que los técnicos sigan flujos de trabajo prescriptos. |
| **2. Económico (Subordinación económica)** | ¿La plataforma controla los ingresos? | ⚠️ **MEDIO-ALTO** — Funcionalidades problemáticas encontradas en el código: |
| | | - `OrganizationPricingSettings` + `OrganizationLaborRate` — La plataforma proporciona **tablas de tarifas salariales** |
| | | - `uocraLevel` (NONE/AYUDANTE/MEDIO_OFICIAL/OFICIAL/OFICIAL_ESPECIALIZADO) mapeado a tarifas por hora |
| | | - `User.hourlyRateOverride` — Infraestructura de la plataforma para establecer tarifas |
| | | - `PriceItemHistory`, `PriceAdjustmentEvent` — Seguimiento de cambios de precios |
| | | - `estimatedTotal`, `techProposedTotal`, `finalTotal` — Aprobación de precios en múltiples etapas |
| | | - `varianceApprovedAt/By`, `varianceRejectedAt/By` — **El administrador puede RECHAZAR precios propuestos por el técnico** |
| **3. Disciplinario (Subordinación jurídica)** | ¿La plataforma puede sancionar? | ⚠️ **MEDIO** — Encontrado: |
| | | - `complianceScore` en Organization — sistema de puntuación |
| | | - Modelo `ComplianceBlock` — puede **bloquear organizaciones** |
| | | - `ComplianceAcknowledgment` — reconocimientos forzados |
| | | - Flag `canBeAssignedJobs` en User — puede deshabilitar la asignación de trabajos |
| | | - El sistema `verificationStatus` condiciona el acceso al marketplace |

#### **La Prueba Contundente: Escalas Salariales UOCRA**

La funcionalidad más peligrosa del código es el sistema de escalas salariales UOCRA. El código en `apps/web/lib/team/trade-config.ts` contiene:

```
UOCRA_CATEGORIES = [AYUDANTE, MEDIO_OFICIAL, OFICIAL, OFICIAL_ESPECIALIZADO]
```

Esto está integrado en el campo `User.uocraLevel` con tablas `OrganizationLaborRate` y `hourlyRateOverride`:

- Se mapea directamente al **CCT 76/75** (Convenio Colectivo de Trabajo de UOCRA)
- Implica que CampoTech está clasificando trabajadores según escalas sindicales
- Un tribunal podría interpretar esto como: "La plataforma categoriza trabajadores por nivel de habilidad y proporciona referencias salariales → por lo tanto la plataforma controla la remuneración → por lo tanto existe relación laboral"

> **VEREDICTO:** El descargo existente ("Solo consultivo — el titular tiene 100% de discreción") puede ser insuficiente. Los tribunales argentinos han mirado consistentemente la **sustancia por sobre la forma**. La infraestructura para control de precios, aprobación/rechazo de variaciones, bloqueo por cumplimiento y categorización UOCRA crea un patrón que los tribunales examinarían de cerca.

#### **El Problema del "Marketplace"**

El código de CampoTech revela un marketplace público con:
- Flag `marketplaceVisible` en Organization
- Seguimiento de `MarketplaceClick` para atribución
- Modelo `BusinessPublicProfile`
- Generación de leads desde el marketplace (`/dashboard/leads`)
- Moderación de reseñas (`/dashboard/marketplace/moderation`)

> Afirmar ser "solo software" mientras se opera un **marketplace público** que genera leads, rastrea atribución, modera reseñas y controla la visibilidad es contradictorio. Este es exactamente el patrón que usaron Rappi/Glovo — y perdieron.

---

### 2.3 🟡 Reforma Pendiente: Clasificación de Trabajadores (2025-2026)

Una propuesta de reforma laboral en el Congreso (fines de 2025) contempla:
- Un nuevo capítulo para trabajadores de plataformas: no empleados, pero obligados a registrarse como Monotributistas
- Seguro obligatorio contra accidentes (Seguro de Accidentes Personales)
- Libertad de conectarse/desconectarse sin sanciones algorítmicas
- Atención al cliente humana para reclamos

**Impacto en CampoTech:** Si esta reforma se aprueba, en realidad *ayudaría* la posición de CampoTech al crear una tercera categoría. Sin embargo, aún NO es ley, y el marco actual de la Ley 20.744 sigue vigente.

---

### 2.4 🔴 Art. 30 LCT — La "Opción Nuclear" de Solidaridad

**La Brecha Identificada:** El análisis de Uberización anterior se enfoca en la relación laboral *directa* (Arts. 21-23 LCT). Pero hay un **segundo camino independiente** hacia la responsabilidad que no requiere probar una relación laboral: **el Artículo 30 de la Ley de Contrato de Trabajo (Ley 20.744)**.

**Lo Que Dice el Art. 30:**

> *"Quienes cedan total o parcialmente a otros el establecimiento o explotación habilitado a su nombre, o contraten o subcontraten, cualquiera sea el acto que le dé origen, trabajos o servicios correspondientes a la actividad normal y específica propia del establecimiento, dentro o fuera de su ámbito, deberán exigir a sus contratistas o subcontratistas el adecuado cumplimiento de las normas relativas al trabajo y los organismos de seguridad social."*

**Implicancia:** Si la Empresa A contrata a la Empresa B para realizar la **"actividad normal y específica"** de la Empresa A, la Empresa A es **solidariamente responsable** por TODAS las obligaciones laborales y de seguridad social de los trabajadores de la Empresa B.

#### Cómo Aplica Esto a CampoTech:

**La Pregunta Crítica:** ¿Es la plomería/instalación de gas/trabajo de HVAC la "actividad normal y específica" de CampoTech?

| Posición | Argumento | Probabilidad |
|----------|-----------|-------------|
| **Defensa de CampoTech** | "Somos una empresa de SOFTWARE. Nuestra actividad es SaaS. La plomería es la actividad de nuestro CLIENTE, no la nuestra." | Se fortalece si CampoTech se mantiene puramente como SaaS |
| **Argumento del Demandante** | "El NEGOCIO de CampoTech es organizar, despachar, cotizar y cobrar por servicios de campo. Sin plomeros, CampoTech no tiene negocio. Por lo tanto, la plomería ES la 'actividad normal y específica' de CampoTech." | Se fortalece por las funcionalidades del marketplace |

**Espectro de Interpretación Judicial:**

1. **Restrictiva (tendencia de la CSJN):** La actividad debe ser el objeto CENTRAL de la empresa. Desarrollo de software ≠ plomería. CampoTech gana.
2. **Amplia (tendencia de la Cámara del Trabajo):** Si la actividad contratada es **integral o complementaria** al proceso productivo de la empresa, aplica la solidaridad. Dado que CampoTech no puede funcionar sin profesionales de servicios de campo, un tribunal aplicando este estándar podría encontrar solidaridad.

**Funcionalidades del Código que Fortalecen el Caso del Demandante:**

| Funcionalidad | Ubicación en el Código | Por Qué es Peligrosa |
|---------------|----------------------|---------------------|
| Verificación de licencias (ENARGAS, CACAAV, ERSEP, Gasnor) | `lib/scrapers/cacaav-playwright-scraper.ts`, `scripts/scrape-cacaav-full.ts` | CampoTech **verifica activamente** licencias profesionales — esto parece como si estuviera asegurando la calidad del servicio de *su* actividad |
| Configuración de tipos de servicio | Modelo `ServiceTypeConfig`, `trade-config.ts` | La plataforma define qué tipos de trabajo existen — parece definir la "actividad" |
| Despacho/asignación | Flag `canBeAssignedJobs`, sistema de programación | La plataforma controla QUIÉN hace el trabajo y CUÁNDO |
| Control de calidad | `ComplianceScore`, moderación de reseñas | La plataforma controla la calidad del "servicio" — como lo haría un comitente |
| Control de precios | `OrganizationLaborRate`, aprobación de variaciones | La plataforma influye/controla el precio = controla la actividad económica |
| Marketplace público | `marketplaceVisible`, `MarketplaceClick` | La plataforma es la **cara** del servicio ante los consumidores finales |

> **El Equilibrio Delicado:** Tu asociado tiene razón — verificar licencias de gas es jurídicamente prudente (por razones de responsabilidad) pero crea un **riesgo del Art. 30**. Un juez podría decir: "Si la plomería no es tu actividad, ¿por qué estás verificando licencias de instalación de gas? Estás haciendo lo que hace una empresa de plomería cuando contrata subcontratistas."

**Consecuencias Prácticas si Aplica el Art. 30:**

Si un técnico en una organización cliente demanda a su empleador por salarios impagos, indemnización o accidente laboral, y el empleador es insolvente o incumplidor:
- El técnico puede **también demandar a CampoTech** como solidariamente responsable
- CampoTech sería responsable por **todas** las deudas laborales: salarios, indemnización, contribuciones de seguridad social, ART (seguro de riesgo laboral), multas
- **No hay tope** para esta responsabilidad — cubre la totalidad del reclamo laboral

**Jurisprudencia Clave:**
- Un fallo de 2025 de la Cámara del Trabajo determinó que los **servicios de limpieza** eran la "actividad normal y específica" de la empresa contratante porque la limpieza era integral a sus operaciones comerciales — confirmando la interpretación amplia.
- La CSJN históricamente ha sido más restrictiva, pero los tribunales inferiores (donde se resuelven la mayoría de los casos laborales) tienden a aplicar el estándar más amplio.

> **VEREDICTO:** El Art. 30 es la **disposición laboral más peligrosa** para CampoTech, incluso más que el riesgo de Uberización. El argumento de Uberización requiere probar una relación laboral directa. El Art. 30 crea responsabilidad solidaria **automática** por TODAS las deudas laborales de las organizaciones cliente si un tribunal determina que los servicios de campo son la "actividad normal y específica" de CampoTech. Dadas las funcionalidades del marketplace, la verificación de licencias y el control de precios en el código, un tribunal de interpretación amplia tendría evidencia sustancial.

**Mitigación Recomendada:**
1. **Cláusulas contractuales** que requieran que las organizaciones cliente certifiquen el cumplimiento de las obligaciones laborales y de seguridad social (el propio Art. 30 lo exige — "deberán exigir... el adecuado cumplimiento")
2. **Verificación periódica de cumplimiento** — solicitar prueba de ART, pagos de seguridad social, registro de nómina a las organizaciones cliente
3. **Disciplina de marketing** — nunca describir a CampoTech como prestando servicios de campo; siempre posicionar como "software para empresas que prestan servicios de campo"
4. **Considerar eliminar funcionalidades del marketplace** o separar claramente el marketplace como un directorio (no un proveedor de servicios)

---

## 3. Trampas Provinciales

### 3.1 🔴 Ingresos Brutos — Obligación Multijurisdiccional

**El Problema:** CampoTech apunta a Buenos Aires, Córdoba y Rosario (Santa Fe) como mercados iniciales. Si CampoTech tiene clientes (organizaciones) en múltiples provincias, aplica el **Convenio Multilateral**.

#### El Marco Legal:

| Normativa | Qué hace | Impacto en CampoTech |
|-----------|----------|---------------------|
| **Convenio Multilateral (1977)** | Distribuye la base imponible de IIBB entre provincias donde se realiza la actividad | Debe inscribirse y presentar declaraciones en CADA provincia donde tenga clientes |
| **Art. 1° Convenio Multilateral** | Se activa cuando las actividades se realizan en 2+ jurisdicciones | CampoTech tiene clientes en BA + Córdoba + Santa Fe = **activado** |
| **Comisión Arbitral RG 12/2025** | Códigos NAES actualizados para servicios digitales (vigente enero 2026) | Nuevos códigos para "intermediación digital", "servicios tecnológicos" aplican |
| **ARBA RN 25/2025 (Pcia. Bs. As.)** | Plataformas de pago digital actúan como agentes de retención para IIBB | Cuentas de MercadoPago de clientes de CampoTech sujetas a retención automática |
| **SIRCUPA** | Sistema de retención de IIBB sobre cuentas de pago digitales | Las agencias tributarias provinciales pueden retener de cuentas de MP |

#### Lo Que CampoTech Debe Hacer:

1. **Inscribirse en el Convenio Multilateral** (sistema SIFERE) — **obligatorio si opera en 2+ provincias**
2. **Presentar declaraciones juradas mensuales (CM03)** distribuyendo ingresos entre provincias
3. **Presentar declaración jurada anual (CM05)** con coeficientes de distribución del año completo
4. **Inscribirse como contribuyente local o de Convenio Multilateral** en cada provincia donde existan clientes
5. **Aplicar el código de actividad NAES correcto** — probablemente "servicios de programación informática" o los nuevos códigos de intermediación digital de 2026

#### La Regla de "Sustento Territorial":

Para empresas SaaS, la Comisión Arbitral interpreta que existe "sustento territorial" en una provincia si:
- Los clientes (suscriptores) están domiciliados allí
- Los servicios se consumen allí
- La empresa incurre en *cualquier gasto* atribuible a esa provincia (incluso gasto en marketing)

> **VEREDICTO:** CampoTech DEBE inscribirse en el Convenio Multilateral. Tener clientes en Buenos Aires y Córdoba por sí solo activa la obligación. Cada provincia adicional donde un cliente se registre crea un nuevo requisito de inscripción. **Esto no es opcional.**

### 3.2 🟡 Riesgos Provinciales Específicos

| Provincia | Trampa Específica | Cita |
|-----------|------------------|------|
| **Buenos Aires** | Retenciones de ARBA sobre acreditaciones de pago digital (vigente oct/nov 2025). Las cuentas de MercadoPago de los clientes de CampoTech tendrán IIBB retenido automáticamente. | RN ARBA 25/2025 |
| **Córdoba** | La Dirección General de Rentas requiere inscripción incluso para SaaS puro si es consumido por entidades domiciliadas en Córdoba. Alícuota: 3% a 4,75% según actividad. | Código Tributario Provincial, Tít. II |
| **Santa Fe** (Rosario) | La API (Administración Provincial de Impuestos) tiene fiscalización agresiva para servicios digitales. Ha sido precursora en la adopción de SIRCUPA. | Ley Impositiva Anual |
| **CABA** | La AGIP aplica Convenio Multilateral para cualquier empresa con clientes domiciliados en CABA. Debe inscribirse como "contribuyente de Convenio." | Código Fiscal CABA, Art. 207 |

---

### 3.3 🔴 SIRCREB / SIRCUPA — El Drenaje Automático de Ingresos

**La Trampa que Identificó Tu Asociado:**

> *"Los bancos (y MercadoPago) están legalmente obligados a retener impuestos (SIRCREB) de tus transferencias si no estás correctamente inscripto. Podrías perder entre el 3-5% de tus ingresos brutos por retenciones automáticas si esto no está bien configurado."*

**Esto es 100% correcto.** Así funcionan los dos sistemas:

#### SIRCREB (Cuentas Bancarias — CBU)

| Detalle | Descripción |
|---------|-------------|
| **Nombre Completo** | Sistema de Recaudación y Control de Acreditaciones Bancarias |
| **Administrado por** | Comisión Arbitral del Convenio Multilateral (COMARB) |
| **Qué hace** | Retiene automáticamente IIBB de **cada depósito en cuenta bancaria** |
| **Tasa de retención** | **0,1% a 5%** dependiendo de la actividad, jurisdicción y declaración CM03 |
| **Se aplica a** | Todas las CBU (cuentas bancarias) de contribuyentes de Convenio Multilateral y locales |
| **Consulta** | sircreb.gov.ar (ingresar CUIT + período para ver tu alícuota) |

#### SIRCUPA (Billeteras Digitales — CVU)

| Detalle | Descripción |
|---------|-------------|
| **Nombre Completo** | Sistema Informático de Recaudación y Control de Acreditaciones en Cuentas de Pago |
| **Qué hace** | Lo mismo que SIRCREB pero para **CVU** (cuentas de billeteras virtuales como MercadoPago) |
| **Se aplica a** | Los PSP (Proveedores de Servicios de Pago) actúan como agentes de retención |
| **Adopción Provincial** | Progresiva — Buenos Aires (oct 2025), Mendoza (oct 2022), otras en curso |
| **Exclusiones** | Transferencias entre cuentas del mismo titular (CBU↔CVU del mismo CUIT) |

#### El Escenario de Fuga de Ingresos:

1. CampoTech recibe pagos de suscripciones SaaS en su cuenta bancaria o MercadoPago
2. Si CampoTech **no está inscripto** en el Convenio Multilateral, el sistema asigna una **alícuota máxima por defecto** (típicamente 3-5%)
3. Esta retención ocurre **automáticamente** — el banco/PSP retiene el monto antes de acreditarlo en tu cuenta
4. Recuperar montos sobre-retenidos requiere presentar declaraciones y solicitar reintegro — lo que puede tomar **6-12 meses**
5. Mientras tanto, ese 3-5% **desaparece de tu flujo de caja**

#### Complicación Adicional para CampoTech:

Las organizaciones CLIENTE de CampoTech también enfrentan retenciones de SIRCREB/SIRCUPA en sus cuentas de MercadoPago. Bajo la RN ARBA 25/2025, cuando el cliente de una organización paga vía MercadoPago:
- MercadoPago retiene IIBB de la cuenta de la organización cliente
- Si el cliente está incorrectamente inscripto, pierde ingresos
- El cliente puede culpar a CampoTech por "configurar" su procesamiento de pagos (vía OAuth) sin advertir sobre las retenciones impositivas

> **VEREDICTO:** Las retenciones de SIRCREB/SIRCUPA **no son opcionales** — ocurren automáticamente estés o no preparado. CampoTech debe:
> 1. Inscribirse en el Convenio Multilateral **antes de aceptar cualquier ingreso**
> 2. Presentar declaraciones juradas mensuales CM03 para establecer la alícuota correcta (más baja)
> 3. Advertir a las organizaciones cliente sobre las retenciones de IIBB en sus cuentas de MercadoPago durante el proceso de alta
> 4. Considerar agregar un aviso informativo en el flujo de configuración de la integración con MercadoPago

---

## 4. Responsabilidad por Software

### 4.1 🔴 Responsabilidad por Producto Bajo el Código Civil y Comercial (CCCN)

**La Pregunta Central:** Si el software de CampoTech elimina la base de datos de facturas de un cliente, genera un CAE incorrecto, o calcula mal los límites del Monotributo — ¿es CampoTech responsable a pesar de los descargos en los Términos de Servicio?

#### Artículos Aplicables:

| Artículo | Contenido | Aplicación a CampoTech |
|----------|-----------|----------------------|
| **Art. 1757 CCCN** | "Toda persona responde por el daño causado por el **riesgo o vicio de las cosas**, o de las actividades que sean riesgosas o peligrosas. La responsabilidad es **objetiva**." | Software = "cosa" o "actividad riesgosa" → **responsabilidad objetiva** independientemente de la intención o negligencia |
| **Art. 1758 CCCN** | El dueño, guardián, o cualquiera que se beneficie de la cosa es solidariamente responsable | CampoTech se beneficia del SaaS → solidariamente responsable por defectos del software |
| **Art. 1723 CCCN** | "Obligación de resultado": cuando se promete un resultado específico, el incumplimiento = violación | El contrato SaaS promete implícitamente funcionalidad → la falta de entrega = incumplimiento |
| **Art. 1743 CCCN** | Las renuncias a la responsabilidad por daño a la persona son nulas | No se puede renunciar a la responsabilidad por daños a personas causados por errores de software |
| **Art. 40 Ley 24.240** | Responsabilidad solidaria para productores, distribuidores y vendedores de "cosas" | Si CampoTech se clasifica como "proveedor" de un producto (el software), aplica la protección al consumidor de la Ley 24.240 **y los topes de responsabilidad pueden ser inexigibles** |

#### Análisis de Escenarios Críticos:

**Escenario 1: Generación de CAE Incorrecto**
- El campo `Invoice.afipCae` de CampoTech almacena el número de CAE
- Si el sistema genera un CAE incorrecto o emite facturas duplicadas, el CLIENTE enfrenta sanciones de AFIP
- Bajo el Art. 1757 CCCN, CampoTech tiene **responsabilidad objetiva** por el defecto
- Una cláusula de TOS que descarte la precisión ante AFIP probablemente sería considerada **abusiva** bajo el Art. 37 Ley 24.240

**Escenario 2: Bloqueo Duro de Monotributo al 99%**
- El código implementa monitoreo de salud fiscal (`fiscal-health.service.ts`)
- Al umbral del 99%: **bloqueo duro de nuevas facturas electrónicas**
- Si este cálculo es erróneo (ej., redondeo de moneda, problemas de zona horaria), un cliente podría demandar por:
  - **Lucro cesante** (ganancias perdidas por facturación bloqueada)
  - **Daño emergente** (daños directos por imposibilidad de facturar)
- Bajo el Art. 1723 CCCN, el monitoreo crea una **obligación de resultado**: si prometés hacer seguimiento, debés hacerlo con precisión

**Escenario 3: Pérdida de Datos / Eliminación de Facturas**
- La doctrina argentina trata a los proveedores de software con una obligación análoga a la **"obligación de resultado"** cuando custodian datos
- La jurisprudencia publicada (ver: casos de software antifuncional citados en SAIJ) ha responsabilizado a proveedores por:
  - Registros de ventas perdidos
  - Bases de datos corruptas
  - Tiempo de inactividad del sistema durante períodos críticos

> **VEREDICTO:** La ley argentina siguiendo el Art. 1757 CCCN impone **RESPONSABILIDAD OBJETIVA** por defectos de software. Esto significa:
> 1. CampoTech es responsable *independientemente de si fue negligente*
> 2. Los topes de responsabilidad en los TOS (los propuestos "12 meses de cuota de suscripción") son probablemente **inexigibles** para aspectos orientados al consumidor bajo la Ley 24.240
> 3. Para contratos B2B, los topes de responsabilidad *pueden* sobrevivir pero solo si:
>    - Son explícitamente negociados (no solo aceptación por click)
>    - No limitan la responsabilidad por negligencia grave (dolo) o daño a la persona
>    - Son proporcionales al riesgo

### 4.2 🟡 Aplicabilidad de la Ley 24.240 al SaaS B2B

**El Matiz:** CampoTech dice ser B2B. Sin embargo:
- Los usuarios finales incluyen **técnicos** que interactúan con la app móvil
- Los usuarios finales incluyen **clientes** de las empresas de servicios (que reciben mensajes de WhatsApp, ven facturas)
- Los tipos de cliente **Consorcio** y **Particular** son esencialmente consumidores

Bajo la jurisprudencia argentina, la definición de "consumidor" (Art. 1° Ley 24.240, modificado por Ley 26.361) es **amplia**: cualquier persona que "adquiera o utilice bienes o servicios como destinatario final." Un administrador de organización usando CampoTech como herramienta de gestión ES un consumidor del software.

> La página `/arrepentimiento` ya reconoce esta realidad al implementar el "Botón de Arrepentimiento" conforme al Art. 34 Ley 24.240.

---

### 4.3 🔴 Defensa del Consumidor — Ventanilla Federal y Domicilio Legal (Ley 26.993 + Decreto 55/2025)

**La Pregunta de Tu Asociado:**

> *"Si un usuario se queja, te pueden citar a una audiencia COPREC. Como probablemente estés operando en forma remota (quizás incluso desde Canadá/Gatineau), necesitás saber: ¿debés tener un domicilio legal en Buenos Aires solo para recibir estas notificaciones legales? Si no lo tenés, podrían declararte en rebeldía automáticamente."*

**Actualización Crítica (Febrero 2025):** El COPREC fue **disuelto** con vigencia al 3 de febrero de 2025, por el **Decreto 55/2025**. El Registro Nacional de Conciliadores y el fondo de financiamiento del COPREC también fueron eliminados. Los casos pendientes fueron transferidos a la Secretaría de Industria y Comercio.

**Sin embargo, esto NO elimina el riesgo. Cambia la sede:**

#### Canales Actuales de Reclamo del Consumidor (Post-COPREC, 2025+)

| Canal | Alcance | Implicancia para CampoTech |
|-------|---------|---------------------------|
| **Ventanilla Única Federal** | Nacional — recibe reclamos de todas las provincias, distribuye a la jurisdicción local | El consumidor puede presentar desde CUALQUIER provincia; CampoTech debe responder |
| **Secretaría de Industria y Comercio** (Ministerio de Economía) | Reclamos de consumidores a nivel nacional bajo Ley 24.240 | Aplica jurisdicción nacional |
| **OMIC** (Oficina Municipal de Información al Consumidor) | Municipal — cada ciudad tiene una | El consumidor presenta localmente; CampoTech puede necesitar comparecer en ese municipio |
| **Dirección Provincial de Defensa del Consumidor** | Provincial | Cada provincia donde CampoTech opere |
| **CABA: SCRC + DGDPC** | Ciudad de Buenos Aires — Servicio de Conciliación (judicial) + Dirección General de Defensa y Protección al Consumidor (administrativa) | Si existen clientes/usuarios en CABA |

#### El Problema del Domicilio Legal:

**Bajo la ley argentina (Art. 36 Ley 24.240, modificado por Ley 26.993 Art. 52):**

> *"En las causas iniciadas por el usuario o consumidor, será competente [...] el de la jurisdicción del domicilio real del consumidor."*

Esto significa:
1. Un consumidor en Córdoba puede demandar a CampoTech en Córdoba
2. Un consumidor en Rosario puede demandar en Rosario
3. Un consumidor en Jujuy puede demandar en Jujuy
4. **Cualquier cláusula en los TOS que seleccione una jurisdicción específica es NULA** (Art. 36 Ley 24.240)

**La Trampa de las Notificaciones:**

Si CampoTech **no tiene un domicilio legal (domicilio legal) en Argentina**, o si su domicilio es incorrecto:
1. Los reclamos de consumidores / citaciones administrativas no pueden ser entregados
2. Después de la entrega fallida, la autoridad emite notificación **por edictos** (publicación en el Boletín Oficial)
3. CampoTech, sin enterarse, no responde
4. La autoridad declara a CampoTech **en rebeldía**
5. Rebeldía = sentencia adversa automática — multas, sanciones, daños otorgados al consumidor SIN que CampoTech haya sido escuchado

**Esto es especialmente peligroso si la entidad legal u operadores de CampoTech están fuera de Argentina (ej., Canadá).**

#### Lo Que CampoTech Debe Hacer:

| Requisito | Estado | Acción |
|-----------|--------|--------|
| **Domicilio legal en Argentina** (domicilio legal constituido) | ❓ Desconocido | Verificar y registrar |
| **Agente registrado para recepción de notificaciones** o representante legal | ❓ Desconocido | Designar si se opera desde el exterior |
| **Monitoreo de reclamos en la Ventanilla Única Federal** | ❌ No implementado | Configurar monitoreo |
| **Proceso de respuesta dentro de los plazos legales** | ❌ No implementado | Construir flujo de trabajo interno |
| **Presencia jurisdiccional en provincias clave** | ❌ No establecida | Considerar designar representantes legales provinciales |

**Cambio Post-COPREC:**
A diferencia del COPREC (que era gratuito para consumidores pero relativamente estructurado), la Ventanilla Federal y los canales provinciales pueden ahora requerir representación legal, lo que podría **reducir** los reclamos frívolos pero **aumentar** la seriedad de los que procedan.

> **VEREDICTO:** La disolución del COPREC NO elimina la exposición de CampoTech — la fragmenta en más sedes. CampoTech necesita un **domicilio legal en Argentina** (preferiblemente Buenos Aires, donde la mayoría de las empresas tecnológicas se constituyen) y debería **designar un representante** que pueda recibir y responder a reclamos de consumidores desde CUALQUIER provincia. Operar desde el exterior sin domicilio legal es una invitación a sentencias en rebeldía.

---

## 5. Soberanía de Datos

### 5.1 🔴 Transferencia Internacional de Datos (Ley 25.326, Art. 12)

**Arquitectura Actual:**
- Base de datos: Supabase (us-east-1, EE.UU.)
- Procesamiento de IA: OpenAI (EE.UU.)
- Email: Resend (EE.UU.)
- Hosting: Vercel (EE.UU.)

**La Ley:**

El Art. 12 de la Ley 25.326 **prohíbe** la transferencia de datos personales a países que NO provean "niveles adecuados de protección." La AAIP mantiene una lista de países adecuados.

**ESTADOS UNIDOS NO ESTÁ EN LA LISTA.**

La lista de países con protección adecuada incluye: estados miembros de la UE/EEE, Reino Unido, Suiza, Guernsey, Jersey, Isla de Man, Islas Feroe, Canadá (solo sector privado), Andorra, Nueva Zelanda, Uruguay, Israel (solo datos automatizados).

> 🚨 **Estados Unidos está conspicuamente ausente de esta lista.**

**Excepciones en las que CampoTech se apoya:**

| Excepción | Base Legal | Implementación Actual |
|-----------|-----------|----------------------|
| **Consentimiento explícito del titular de los datos** | Art. 12(a) Ley 25.326 | ✅ Implementado: "Entiendo y acepto que mis datos personales serán alojados en servidores fuera de Argentina (EE.UU.) conforme a la Ley 25.326" |
| **Cláusulas contractuales tipo** | Res. AAIP 198/2023 | ❌ NO IMPLEMENTADO |
| **Autorización previa de la AAIP** | Art. 12(b) Ley 25.326 | ❌ NO OBTENIDA |

**Evaluación de Riesgo:**
- El consentimiento como única base es la **más débil** para la transferencia
- El consentimiento puede ser **revocado en cualquier momento** — ¿qué pasa con los datos ya transferidos?
- Las cláusulas contractuales tipo actualizadas de la AAIP (Res. 198/2023) proveen una base legal más sólida pero requieren ejecución con cada procesador de datos (Supabase, OpenAI, Vercel, Resend)
- Un acuerdo pendiente entre Argentina y EE.UU. para el estatus de "protección adecuada" podría cambiar esto, pero aún NO está vigente

> **VEREDICTO:** El enfoque actual de CampoTech (solo consentimiento) es frágil. Un solo cliente que revoque su consentimiento crearía una situación imposible respecto a datos ya procesados. Debería implementar cláusulas contractuales tipo Y considerar la autorización de la AAIP.

---

### 5.2 🟡 ¿Los Certificados de Seguridad de Instalación de Gas Están Sujetos a Localización de Datos?

**La Respuesta Corta:** **NO** existe un requisito explícito de localización de datos para certificados de seguridad de gas bajo la ley argentina actual.

Sin embargo:

1. **Normativa ENARGAS (NAGs):** ENARGAS establece normas técnicas (NAG-200, NAG-201, etc.) para instalaciones de gas. Estas normas requieren que los **certificados originales** sean mantenidos por el gasista matriculado y la empresa distribuidora (ej., MetroGAS, Gasnor). ENARGAS no regula dónde se almacenan las *copias digitales*.

2. **Registros Provinciales:** Los registros de matrícula (que CampoTech verifica mediante scraping automatizado — `ENARGAS`, `CACAAV`, `ERSEP`, `Gasnor`) son registros públicos mantenidos por entidades provinciales. CampoTech almacena el estado de verificación, no los certificados originales.

3. **Consideraciones Sectoriales Específicas:**
   - Si CampoTech almacena **copias** de certificados de seguridad de gas (Certificados de Aptitud de Instalaciones), estos son documentos regulados bajo la Resolución ENARGAS 2700
   - La empresa distribuidora es legalmente responsable de mantener los registros originales
   - Alojar *copias* en EE.UU. no está explícitamente prohibido, pero podría crear desafíos probatorios si se necesitan en procedimientos argentinos

4. **Argumento de Infraestructura Crítica:** Bajo la **Res. 580/2011** (Programa Nacional de Infraestructuras Críticas de Información), las redes de distribución de gas se clasifican como infraestructura crítica. Sin embargo, esta obligación recae sobre ENARGAS y las empresas de servicios públicos, NO sobre proveedores de SaaS de terceros.

5. **Fotos de DNI / Datos Biométricos:** Más preocupante desde la perspectiva de localización de datos. Bajo la legislación propuesta y el Convenio 108+ (cuando entre en vigor), los datos biométricos pueden enfrentar requisitos de localización más estrictos.

> **VEREDICTO:** Ninguna ley actual exige hosting en suelo argentino para certificados de gas o datos de CampoTech. Pero la tendencia regulatoria apunta hacia **mayores requisitos de soberanía de datos**, y el almacenamiento de claves privadas de AFIP por parte de CampoTech fuera de Argentina es una vulnerabilidad práctica (aunque aún no sea ilegal).

---

### 5.3 🟡 Credenciales AFIP Alojadas en Estados Unidos

**Riesgo Único:** CampoTech almacena `afipCertificateEncrypted` y `afipPrivateKeyEncrypted` en Supabase (EE.UU.). Estas son:
- Claves criptográficas capaces de **emitir documentos fiscales legalmente vinculantes**
- Si se comprometen, podrían permitir **fraude fiscal** en nombre de las organizaciones cliente
- Ubicadas en una jurisdicción sujeta a las leyes de vigilancia de EE.UU. (FISA, CLOUD Act)

> Esto no es un problema de la Ley 25.326 — es un problema de la **Ley 11.683** (procedimiento tributario) y potencialmente del **Código Penal** (Art. 293 — falsificación de documentos públicos). Si una brecha lleva a la emisión de facturas fraudulentas, CampoTech podría enfrentar exposición penal como cómplice.

---

## 6. Riesgos Transversales y Matriz Resumen

### Mapa de Calor de Riesgos

| Área de Riesgo | Severidad | Probabilidad | Base Legal | Evidencia en el Código | Acción Inmediata Requerida |
|----------------|-----------|-------------|-----------|----------------------|---------------------------|
| **UIF / AML + verificación RePET** | 🔴 Crítico | Alta | Ley 25.246, Res. UIF 76/2019, 200/2024, **49/2024** | Integración MP, conciliación de pagos, manejo de contracargos, sin verificación RePET | Sí — Opinión legal sobre clasificación como "facilitador" + implementar verificación RePET |
| **Demandas por Uberización** | 🔴 Crítico | Alta | Ley 20.744, Arts. 21-23; González c/ Kadabra (2024) | Niveles UOCRA, tarifas laborales, aprobación de variaciones, bloqueos de cumplimiento, marketplace | Sí — Reestructurar funcionalidad de sugerencias salariales |
| **Art. 30 LCT — Solidaridad** | 🔴 Crítico | Alta | **Ley 20.744, Art. 30** | Verificación de licencias, marketplace, despacho, control de precios, configuración de tipos de servicio | Sí — Requisitos contractuales de cumplimiento; disciplina de marketing |
| **Marca INPI** | 🔴 Crítico | **Segura** | **Ley 22.362** | Activos de marca en web+mobile+marketplace; flag de White Label | **Sí — Solicitar Clases 9, 35, 42 INMEDIATAMENTE** |
| **Ingresos Brutos / Convenio Multilateral** | 🔴 Crítico | Segura | Convenio Multilateral (1977); RG CA 12/2025 | Base de clientes multiprovincial | Sí — Inscribirse inmediatamente |
| **Retenciones SIRCREB / SIRCUPA** | 🔴 Crítico | **Segura** | **SIRCREB (COMARB); SIRCUPA; RN ARBA 25/2025** | Integración MercadoPago, cuentas bancarias | Sí — Inscribirse en CM para establecer alícuota correcta |
| **Trampa de indexación (TOS precios)** | 🔴 Crítico | **Segura** | **Ley 23.928 Arts. 7+10; DNU 70/2023** | Precios ARS hardcodeados en checkout; TOS §5 sin cláusula de ajuste; `applyPriceAdjustment` es manual | **Sí — Reescribir TOS §5 con cláusula de revisión de precios válida** |
| **Responsabilidad por software (objetiva)** | 🔴 Crítico | Media | CCCN Arts. 1757-1758, 1723; Ley 24.240, Art. 40 | Generación de CAE, monitoreo fiscal, bloqueos duros | Sí — Revisar topes de responsabilidad; implementar SLA |
| **Impuesto de Sellos (click-wrap)** | 🟠 Alto | Media | **Ley 25.506; Código Fiscal PBA/Córdoba** | Aceptación click-wrap en `/checkout` + `/terms`; "Al suscribirte aceptás los Términos" | Sí — Opinión legal sobre distinción click-wrap vs firma digital |
| **Repatriación de ganancias (Cepo/MULC)** | 🟠 Alto | Media | **BCRA Com. A 8226; Ley 19.359** | Todos los ingresos en ARS vía MercadoPago; sin opción de precios en USD | Sí — Estructurar mecanismo de repatriación con asesor legal |
| **Defensa del consumidor / Ventanilla Federal** | 🟠 Alto | Alta | **Ley 24.240 Art. 36; Ley 26.993; Decreto 55/2025** | Existe página `/arrepentimiento`; sin flujo de gestión de reclamos | Sí — Establecer domicilio legal + flujo de respuesta a reclamos |
| **Transferencia de datos a EE.UU.** | 🟠 Alto | Media | Ley 25.326, Art. 12; Res. AAIP 198/2023 | Todos los datos en Supabase (us-east-1) | Sí — Implementar cláusulas contractuales |
| **Registro DNPDP** | 🟡 Medio | Alta | Ley 25.326, Art. 21 | La página de privacidad afirma el registro | Sí — Verificar estado real de registro |
| **Notificación de brechas** | 🟡 Medio | Media | Res. AAIP 47/2018; Convenio 108+ (Ley 27.699) | Sin IRP en el código | Sí — Implementar flujo de IRP |
| **Registro No Llame** | 🟡 Medio | Media | Ley 26.951 | Colas de salida WhatsApp/SMS | Sí — Agregar verificación No Llame |
| **Localización de datos de certificados de gas** | 🟢 Bajo | Baja | Sin mandato actual | Almacena estado de verificación, no originales | No — Monitorear cambios legislativos |

---

### Citas Legales Específicas Referenciadas

| Cita | Nombre Completo | Relevancia |
|------|----------------|-----------|
| **Ley 20.744** | Ley de Contrato de Trabajo | Determinación de relación laboral |
| **Ley 20.744, Art. 30** | Responsabilidad solidaria por subcontratación | **"Opción Nuclear" — responsabilidad solidaria por deudas laborales de organizaciones cliente** |
| **Ley 22.362** | **Ley de Marcas y Designaciones** | **Registro de marca — sistema de "primero en registrar"** |
| **Ley 24.240** | Ley de Defensa del Consumidor | Protección al consumidor, "Botón de Arrepentimiento", responsabilidad del proveedor |
| **Ley 24.240, Art. 36** | Competencia judicial — domicilio del consumidor | **El consumidor puede demandar en CUALQUIER provincia** |
| **Ley 25.246** | Ley de Prevención de Lavado de Activos y Financiamiento del Terrorismo | Obligaciones AML |
| **Ley 25.326** | Ley de Protección de Datos Personales | Protección de datos, transferencia internacional, derechos ARCO |
| **Ley 25.506** | Ley de Firma Digital | Validez de evidencia digital |
| **Ley 26.361** | Modificatoria Ley 24.240 | Definición ampliada de "consumidor" |
| **Ley 26.951** | Ley del Registro Nacional No Llame | Restricciones de mensajería comercial |
| **Ley 26.993** | **Servicio de Conciliación Previa en Relaciones de Consumo (COPREC)** | **Conciliación del consumidor — disuelto por Decreto 55/2025** |
| **Ley 27.555** | Ley de Teletrabajo | Regulación del trabajo remoto, relevante para alegaciones de teletrabajo |
| **Ley 27.699** | Ratificación Convenio 108+ | Futura obligación de notificación de brechas |
| **Ley 11.683** | Ley de Procedimiento Tributario | Procedimientos de AFIP, conservación de 10 años |
| **CCCN Arts. 1757-1758** | Responsabilidad por riesgo de la cosa | Responsabilidad objetiva por software |
| **CCCN Art. 1723** | Obligación de resultado | Obligaciones de rendimiento del SaaS |
| **CCCN Art. 1743** | Nulidad de cláusulas que limitan daño a la persona | Responsabilidad irrenunciable por daño a la persona |
| **Res. UIF 49/2024** | **Screening obligatorio contra RePET** | **Debe verificar clientes contra registro de terrorismo/criminales** |
| **Res. UIF 76/2019** | Sujetos obligados — sector medios de pago | Clasificación PSP/Facilitador |
| **Res. UIF 200/2024** | Extensión obligaciones a PSP | Alcance AML ampliado |
| **Res. AAIP 47/2018** | Recomendación notificación brechas | Buenas prácticas de notificación de brechas |
| **Res. AAIP 126/2024** | Régimen sancionatorio unificado | Marco de sanciones actualizado |
| **Res. AAIP 198/2023** | Cláusulas contractuales tipo transfer. internacional | Cláusulas contractuales tipo |
| **RG AFIP 4290/2018** | Facturación electrónica | Obligaciones de facturación electrónica |
| **RN ARBA 25/2025** | Retenciones IIBB billeteras digitales (PBA) | Retención de IIBB sobre pagos digitales |
| **RG CA 12/2025** | Actualización NAES (Convenio Multilateral) | Nuevos códigos de actividad digital (vig. enero 2026) |
| **Res. 580/2011** | Programa Nac. Infraestructuras Críticas | Marco de ciberseguridad |
| **CCT 76/75** | Convenio Colectivo UOCRA | Escalas salariales de la construcción |
| **Decreto 55/2025** | **Disolución del COPREC** | **Servicio de conciliación del consumidor disuelto; reemplazado por Ventanilla Federal** |
| **Decreto 1558/2001** | Reglamentario Ley 25.326 | Implementación de protección de datos |
| **Ley 23.928** | **Ley de Convertibilidad — Prohibición de indexación** | **Arts. 7+10: prohibición de indexación automática de precios a índices inflacionarios** |
| **Ley 25.561** | **Ley de Emergencia Pública** | **Mantiene la prohibición de indexación post-convertibilidad** |
| **DNU 70/2023** | **Decreto de Necesidad y Urgencia — Desregulación** | **Flexibilizó indexación para alquileres; fortaleció autonomía contractual; modificó CCCN Art. 765 (moneda de pago)** |
| **BCRA Com. "A" 8226** | **Nuevo régimen cambiario (abril 2025)** | **Flotación con bandas; permite giro de dividendos de ejercicios desde 01/01/2025** |
| **BCRA Com. "A" 7999** | **BOPREAL para dividendos pre-2025** | **Mecanismo de suscripción de bonos para repatriación de dividendos heredados** |
| **BCRA Com. "A" 8336** | **Restricción cruzada MULC/CCL** | **Restricción cruzada de 90 días entre mercado oficial y dólar financiero** |
| **Ley 19.359** | **Régimen Penal Cambiario** | **Sanciones penales por operaciones cambiarias no autorizadas** |
| **Ley 25.506** | **Ley de Firma Digital** | **Distingue "firma digital" de "firma electrónica" — clave para análisis de Impuesto de Sellos** |
| **SIRCREB (COMARB)** | **Sistema de Recaudación y Control de Acreditaciones Bancarias** | **Retención automática de IIBB sobre depósitos bancarios** |
| **SIRCUPA** | **Sistema de Recaudación — Cuentas de Pago** | **Retención automática de IIBB sobre MercadoPago/billeteras** |
| **González c/ Kadabra SA (2024)** | Fallo laboral Glovo | Relación laboral de trabajadores de plataforma |
| **Rappi - Trib. Trabajo La Plata (2021)** | Multa confirmada | Sanción por clasificación errónea de trabajadores |

---

### Acciones Prioritarias (Pre-Lanzamiento)

#### 🔴 CRÍTICO (Bloquea el Lanzamiento)
1. **Registro de marca INPI** — Solicitar Clases 9, 35, 42 inmediatamente (Ley 22.362). Riesgo existencial si es usurpada.
2. **Opinión legal sobre clasificación UIF/AML** — Determinar si CampoTech es "sujeto obligado" + implementar verificación RePET (Res. UIF 49/2024)
3. **Inscripción en Convenio Multilateral** — Presentar antes del primer cliente interprovincial (previene sobre-retención de SIRCREB/SIRCUPA)
4. **Reestructurar funcionalidades de escalas salariales UOCRA** — Desacoplar sugerencias salariales de la plataforma; mitigar riesgo de solidaridad del Art. 30
5. **Verificar registro en DNPDP** — Confirmar que la afirmación en `/privacy` es realmente verdadera
6. **Establecer domicilio legal en Argentina** — Requerido para recibir reclamos de consumidores, citaciones administrativas y notificaciones judiciales
7. **Reescribir TOS § 5 (Precios)** — Reemplazar el lenguaje vago actual con una cláusula de "Revisión de Precios" compatible con el DNU 70/2023 que evite la indexación ilegal mientras protege contra la erosión inflacionaria

#### 🟠 ALTO (Dentro de los 30 días del lanzamiento)
8. **Cumplimiento del Art. 30 LCT** — Agregar cláusulas contractuales que requieran que las organizaciones cliente prueben cumplimiento laboral/seguridad social
9. **Cláusulas contractuales tipo con procesadores en EE.UU.** — Supabase, OpenAI, Vercel, Resend conforme Res. 198/2023
10. **Plan de respuesta a incidentes** — Capacidad de notificación de brechas en 72 horas
11. **Verificación del registro No Llame** — Antes de mensajería comercial saliente
12. **Revisar topes de responsabilidad en TOS** — Asegurar cumplimiento con CCCN Art. 1743 y Ley 24.240
13. **Flujo de respuesta a reclamos de consumidores** — Monitorear Ventanilla Federal + canales provinciales
14. **Estructura de repatriación de ganancias** — Establecer mecanismo legal para repatriación de dividendos (requisitos de acceso al MULC, BOPREAL para ganancias heredadas)
15. **Opinión sobre Impuesto de Sellos** — Obtener opinión legal sobre exposición del click-wrap en provincias objetivo

#### 🟡 MEDIO (Dentro de los 90 días del lanzamiento)
16. **Distinción B2B vs B2C** — TOS separados para organizaciones vs usuarios finales
17. **Revisión de seguros** — Asegurar que E&O cubra errores fiscales causados por software Y reclamos de solidaridad del Art. 30
18. **Acuerdos de procesamiento de datos** — DPAs específicos para almacenamiento de credenciales AFIP
19. **Auditoría de posicionamiento del marketplace** — Asegurar que el marketing no auto-clasifique como marketplace (crítico para la defensa del Art. 30)
20. **Información de SIRCREB/SIRCUPA para clientes** — Agregar advertencia de retención de IIBB al flujo de alta de MercadoPago
21. **Opción de precios en USD** — Considerar ofrecer precios en USD para proteger márgenes y simplificar la repatriación
22. **Infraestructura de precios dinámicos** — Mover precios ARS hardcodeados de la página de checkout a configuración del lado del servidor para permitir ajustes periódicos

---

## 7. Defensa Legal Macroeconómica

> *"Argentina es única porque combina alta inflación con controles cambiarios estrictos. Tu documento cubre impuestos y empleo, pero omite las leyes sobre Dinero y Valor."*

Esta sección aborda la intersección entre **leyes de inflación, controles cambiarios y exigibilidad contractual** — riesgos que son invisibles en economías estables pero existenciales en Argentina.

---

### 7.1 🔴 La Prohibición de "Indexación" (Ley 23.928 + DNU 70/2023)

**La Trampa Legal:**

La Ley de Convertibilidad de Argentina (Ley 23.928, 1991) — que NUNCA fue completamente derogada — prohíbe la **indexación** (ajuste automático de precios basado en índices inflacionarios). Específicamente:

> **Art. 7:** *"En ningún caso se admitirá la actualización monetaria, indexación por precios, variación de costos o repotenciación de deudas, cualquiera fuere su causa, haya o no mora del deudor..."*
>
> **Art. 10:** *"Deróganse, con efecto a partir del 1° del mes de abril de 1991, todas las normas legales o reglamentarias que establezcan o autoricen la indexación..."*

Esta prohibición sobrevivió al fin de la convertibilidad mediante la **Ley 25.561** (2002) que mantuvo vigentes los Arts. 7 y 10.

**Cómo Aplica Esto a CampoTech:**

La **Sección 5 actual de los TOS** de CampoTech dice:

> *"Los precios y planes de suscripción están disponibles en nuestra página de precios. Los pagos se procesan a través de MercadoPago de forma segura."*

Esto es **peligrosamente vago** porque:
1. No dice NADA sobre ajustes de precios
2. No explica cómo cambian los precios con el tiempo
3. En una economía con **211% de inflación anual (2023)**, un cliente que se suscribe a ARS 55.000/mes podría argumentar que está fijado a ese precio indefinidamente

**El Problema de la Página de Checkout:**

```typescript
// apps/web/app/checkout/page.tsx (líneas 35-57)
const PLANS = {
  INICIAL:      { priceARS: 25000,  priceUSD: 25  },
  PROFESIONAL:  { priceARS: 55000,  priceUSD: 55  },
  EMPRESA:      { priceARS: 120000, priceUSD: 120 },
};
```

Los precios están **hardcodeados en el código fuente del lado del cliente**. No hay configuración de precios del lado del servidor, no hay versionado de precios, y no hay mecanismo para ajustes periódicos.

**La Liberalización del DNU 70/2023 (Parcial):**

El DNU 70/2023 del Presidente Milei (diciembre 2023) flexibilizó algunos aspectos:
- **Alquileres:** Explícitamente exceptuados del Art. 10 — las partes pueden acordar libremente índices de indexación para rentas
- **Libertad de moneda:** Modificó el Art. 765 CCCN — los contratos pueden denominarse en cualquier moneda, y el deudor debe pagar en la moneda pactada
- **Autonomía contractual:** Fortaleció ampliamente la libertad de contratación

**SIN EMBARGO:** El DNU 70/2023 **NO eximió explícitamente** los contratos SaaS/software de la prohibición de indexación. La exención para alquileres es expresa; los contratos SaaS deben apoyarse en el **principio general de autonomía contractual**, que es un argumento legal más débil.

**Lo Que un Cliente Astuto Podría Hacer:**

1. Se suscribe a CampoTech PROFESIONAL a ARS 55.000/mes
2. CampoTech eventualmente sube el precio a ARS 150.000/mes (reflejando la inflación)
3. El cliente se niega a pagar el nuevo precio, citando la Ley 23.928 Art. 7 — "estás indexando"
4. Si los TOS dicen "los precios se ajustan según el IPC" → la cláusula es probablemente **nula** por indexación ilegal
5. El cliente paga ARS 55.000 durante años mientras el valor real se erosiona hasta nada

**Estrategias para Discutir con el Abogado:**

| Estrategia | Cómo Funciona | Fortaleza Legal |
|------------|--------------|-----------------|
| **Modelo de "Bonificación"** | Establecer precio de lista ALTO (ej., ARS 300.000). Ofrecer "descuento promocional" del 80% = ARS 60.000. Periódicamente *quitar* el descuento en lugar de *subir* el precio. | ⚠️ Moderada — los tribunales pueden ver a través si se impugna |
| **Renegociación Periódica** | Los TOS establecen: "Los precios se fijan por períodos de 3 meses. Al final de cada período, CampoTech comunicará el nuevo precio. Si el cliente no está de acuerdo, puede cancelar sin penalidad." | ✅ **La más fuerte** — evita ajuste automático; preserva el derecho del cliente a cancelar |
| **Denominación en USD** | Precio en USD, cobrar equivalente en ARS al tipo de cambio spot. El DNU 70/2023 ahora permite esto explícitamente. | ✅ Fuerte — resuelve el problema inflacionario; puede crear complicaciones para clientes Monotributistas |
| **IPC con Piso/Techo** | "Los precios se ajustan semestralmente en no menos del X% y no más del Y%" | ❌ Riesgoso — aún parece indexación |
| **Cláusula de "Recupero de Costos"** | "Los precios reflejan el costo de hosting, desarrollo y operaciones. Cuando estos costos aumenten materialmente, CampoTech se reserva el derecho de ajustar." | ⚠️ Moderada — debe vincularse a costos reales, no a índices |

**Evidencia en el Código:**
- `applyPriceAdjustment()` en `src/modules/pricebook/index.ts` existe para **libros de precios de clientes** (materiales/servicios), pero es un ajuste masivo manual, no un mecanismo automático vinculado al IPC
- El endpoint `POST /items/price-adjustment` toma `adjustmentPercent` — esto es puramente para la fijación de precios de las propias organizaciones cliente, no para el precio de suscripción SaaS de CampoTech
- No hay sistema de versionado de precios, no hay versionado de planes de facturación, no hay lógica de grandfathering

> **VEREDICTO:** La Sección 5 de los TOS de CampoTech es **legalmente deficiente** para una economía inflacionaria. La combinación de (a) lenguaje de precios vago, (b) precios ARS hardcodeados, y (c) sin mecanismo de ajuste crea un escenario donde un cliente podría bloquear a CampoTech en un contrato de ARS 55.000/mes indefinidamente. El **modelo de renegociación periódica** con derecho explícito de cancelación es el enfoque más seguro. Discutir con el abogado si el principio de autonomía contractual del DNU 70/2023 es suficiente para sostener una cláusula de recupero de costos para SaaS.

---

### 7.2 🔴 El "Cepo" y Repatriación de Ganancias (MULC / BCRA)

**El Contexto:**

CampoTech tiene fundadores/operadores canadienses. Todos los ingresos se cobran en **Pesos Argentinos (ARS)** vía MercadoPago. Convertir ARS a CAD/USD y remitir ganancias a Canadá requiere navegar el régimen de control cambiario de Argentina — el infame **"cepo cambiario."**

**Marco Regulatorio Actual (a febrero de 2026):**

| Evento | Fecha | Impacto |
|--------|-------|---------|
| **Levantamiento del cepo** | 14 de abril de 2025 | BCRA Com. "A" 8226 — Nuevo régimen de flotación con bandas; restricciones reducidas para compra de USD; autorizada distribución de dividendos a no residentes |
| **Dividendos de ejercicios 2025+** | Abril 2025+ | Las empresas PUEDEN remitir dividendos a accionistas no residentes de ejercicios fiscales iniciados a partir del 1° de enero de 2025, vía el MULC (mercado oficial) |
| **Dividendos heredados pre-2025** | Vía BOPREAL | BCRA Com. "A" 7999 — Las empresas deben suscribir bonos BOPREAL ("Bonos para la Reconstrucción de una Argentina Libre") para dividendos de ejercicios pre-2025 |
| **Límite diario** | Vigente | Montos superiores a **USD 100.000/día** requieren autorización previa del BCRA ("calendarización") |
| **Restricción cruzada** | Com. "A" 8336 (sept 2025) | Si CampoTech accede al MULC para comprar USD, **no puede** también comprar bonos que liquidan en moneda extranjera (CCL/MEP) durante **90 días** |

**El Problema Práctico para CampoTech:**

1. **Estructura de ingresos:** 100% ARS vía MercadoPago → transferido a cuenta bancaria local (CBU)
2. **Ruta de repatriación:** ARS en banco → Compra USD en MULC → Transferencia bancaria a Canadá
3. **Requisitos para acceso al MULC:**
   - Entidad argentina (SRL/SA) o sucursal registrada
   - Estados financieros auditados (balance cerrado)
   - Ganancias de ejercicios fiscales **cerrados y aprobados** (no efectivo interino)
   - CUIT + presentaciones ante AFIP al día
   - No figurar en ninguna lista de deudores del BCRA
4. **Timing:** La primera repatriación de dividendos de ejercicios 2025 solo sería posible **después del cierre del ejercicio fiscal 2025** (lo más temprano: mediados de 2026 para cierres al 31 de diciembre)

**Alternativa: Contado con Liquidación (CCL):**

El mecanismo del CCL implica:
1. Comprar bonos del gobierno argentino (ej., Bonar, Global) con ARS
2. Vender esos mismos bonos en USD en el mercado extranjero
3. Recibir USD en el exterior

**Advertencia:** El CCL es LEGAL para la mayoría de las entidades pero viene con:
- Un período de "parking" de 90 días (debe mantener los bonos antes de vender)
- La restricción cruzada con el MULC (Com. "A" 8336)
- Un spread entre la tasa oficial y la del CCL (actualmente reduciéndose pero históricamente 20-80%)
- **Ley 19.359 (Régimen Penal Cambiario)** criminaliza operaciones cambiarias no autorizadas — las penas incluyen multas de 1-10x el monto de la transacción + prisión

**Riesgos Específicos de CampoTech:**

| Riesgo | Descripción | Severidad |
|--------|-------------|-----------|
| **Trampa de efectivo** | Los ingresos se acumulan en ARS, pierden valor diariamente por inflación, mientras la repatriación requiere esperar el cierre del ejercicio fiscal + auditoría | 🔴 |
| **Conflicto UIF** | Si CampoTech se clasifica como "sujeto obligado" (Sección 1.1), usar CCL para mover fondos podría disparar escrutinio AML | 🟠 |
| **Precios de transferencia** | Si CampoTech cobra regalías o fees de gestión a la entidad argentina para extraer efectivo, AFIP fiscalizará bajo las reglas de precios de transferencia (Ley 27.430, Art. 17+) | 🟠 |
| **Filtración fiscal** | Los dividendos remitidos a través del MULC estaban sujetos al **Impuesto PAÍS** (alícuota del 17,5%) — verificar estado actual post-relajación del cepo | 🟠 |

> **VEREDICTO:** CampoTech necesita una **consulta de estructura corporativa** con un abogado argentino especialista en comercio exterior/societario antes del lanzamiento. Preguntas clave:
> 1. ¿Debería CampoTech operar a través de una SRL argentina, una sucursal, o un simple acuerdo de representación?
> 2. ¿Cuál es el mecanismo óptimo para extracción de ganancias? (¿Dividendos vía MULC, fees de gestión, regalías, o CCL?)
> 3. ¿Deberían los precios de suscripción denominarse en USD (lo que el DNU 70/2023 ahora permite) para evitar la trampa de depreciación del ARS?
> 4. ¿Cuáles son las implicaciones actuales del Impuesto PAÍS post-relajación del cepo?

---

### 7.3 🟠 Impuesto de Sellos sobre Aceptación Digital

**La Trampa Provincial:**

Varias provincias argentinas imponen **Impuesto de Sellos** sobre contratos y acuerdos formalizados dentro de su territorio. La tasa típica es del **0,5% al 3%** del valor del contrato, dependiendo de la provincia.

**La Pregunta Digital:**

Cuando un usuario en la página de checkout de CampoTech ve:

> *"Al suscribirte aceptás los Términos de Servicio y la Política de Privacidad"*

...y hace click en el botón de pago, ¿esto crea un **"contrato instrumentado"** (contrato formalizado) sujeto al Impuesto de Sellos?

**El Análisis Legal Se Basa en la Ley 25.506 (Firma Digital):**

| Concepto | Clasificación Ley 25.506 | Implicancia para Impuesto de Sellos |
|----------|---------------------------|-------------------------------------|
| **Firma Digital** | Utiliza certificado digital certificado de CA autorizada; tiene plena equivalencia legal con firma manuscrita | ✅ Crea un "instrumento privado" → **sujeto a Impuesto de Sellos** |
| **Firma Electrónica** | Cualquier medio electrónico de identificación que no cumple los requisitos de "firma digital" (incluye click-wrap, aceptación por email, checkboxes) | ⚠️ **Probablemente NO** sea un "instrumento" → la aplicabilidad del impuesto de sellos es **debatible** |

**El Patrón de Aceptación de CampoTech:**

El flujo de checkout usa un modelo **click-wrap**:
- El usuario hace click en el botón "Pagar" → aceptación implícita de los TOS
- No hay certificado digital involucrado
- No hay firma electrónica calificada
- Esto es una **firma electrónica**, NO una **firma digital**

**Análisis de Exposición Provincial:**

| Provincia | Tasa Impuesto de Sellos | Riesgo para CampoTech | Notas |
|-----------|------------------------|----------------------|-------|
| **Buenos Aires** | 3% general | 🟠 Medio | PBA sigue la distinción de firma digital; click-wrap probablemente NO imponible; pero fiscalización agresiva posible |
| **Córdoba** | Variable; actualmente sin alícuota general para la mayoría de contratos (desde 2023) | 🟢 Bajo | Córdoba eliminó el impuesto de sellos general para la mayoría de los contratos vía Ley 10.854; solo categorías específicas (inmuebles) permanecen |
| **CABA** | 0,5-1% | 🟡 Bajo-Medio | AGIP podría argumentar que los contratos digitales son imponibles |
| **Misiones** | Hasta 1,5% | 🟠 Medio | Fiscalización agresiva del impuesto de sellos sobre todos los contratos |
| **Tucumán** | Hasta 1% | 🟠 Medio | Conocida por interpretación amplia de "instrumento" |
| **Santa Fe** | Hasta 1% | 🟡 Bajo-Medio | Sigue la distinción general de firma digital |

**La Trampa del Litigio:**

Tu consideración sobre demandar por falta de pago es acertada. En los tribunales argentinos:
1. CampoTech demanda a un cliente en la Provincia X por suscripción impaga
2. La defensa del cliente: "El contrato nunca fue debidamente sellado"
3. El juez **puede** requerir que CampoTech pague el Impuesto de Sellos + multas antes de que el caso pueda proceder
4. Si años de contratos no están sellados, el impuesto retroactivo + intereses + multas podrían ser **sustanciales**

**La Estrategia de "Aceptación Inversa" (para discutir con el abogado):**

En lugar de que CampoTech presente TOS para que el usuario acepte (lo que crea un "instrumento"), considerar:
1. El usuario presenta una "solicitud de servicio"
2. CampoTech responde con una "carta de aceptación"
3. El servicio comienza con la aceptación de CampoTech, no con el click del usuario
4. Esta inversión puede evitar crear un "instrumento" en la provincia del usuario

**Mitigación Adicional:**

- **Cláusula de sede del contrato:** La Sección 10 actual de los TOS establece *"Cualquier disputa será resuelta por los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires."* Si el contrato se forma en CABA, el Impuesto de Sellos seguiría las reglas de CABA (tasas más bajas, más permisivas con lo digital)
- **Sin embargo:** Esta cláusula es probablemente **nula** para reclamos de consumidores (según la Sección 4.3 anterior — el Art. 36 de la Ley 24.240 otorga jurisdicción al domicilio del consumidor)
- Para **contratos B2B**, la cláusula de jurisdicción CABA SÍ es exigible

> **VEREDICTO:** El patrón de aceptación click-wrap (firma electrónica, no firma digital) NO debería activar el Impuesto de Sellos bajo la jurisprudencia actual en la mayoría de las provincias. Sin embargo, provincias como Misiones y Tucumán tienen interpretaciones agresivas. CampoTech debería: (1) obtener una opinión impositiva para cada provincia objetivo, (2) considerar la estrategia de "aceptación inversa", y (3) asegurar que la cláusula de jurisdicción CABA de la Sección 10 de los TOS sea efectiva para relaciones B2B (no ayudará con reclamos de consumidores).

---

*Versión del Documento: 3.0 — Actualizado con sección de defensa legal macroeconómica*  
*Análisis basado en el código fuente a fecha del 12 de febrero de 2026*  
*Todas las leyes citadas accesibles en [infoleg.gob.ar](https://www.infoleg.gob.ar)*  
*Este documento NO constituye asesoramiento jurídico. Contrate un abogado argentino matriculado.*
