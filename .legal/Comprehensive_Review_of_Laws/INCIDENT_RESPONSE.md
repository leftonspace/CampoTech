# Plan de Respuesta a Incidentes de Seguridad

## CampoTech — Resolución AAIP 47/2018 + Convenio 108+ (Ley N° 27.699)

> **Versión:** 1.0
> **Fecha:** 2026-02-12
> **Clasificación:** CONFIDENCIAL — Solo para equipo de gestión
> **Referencia Legal:** Resolución AAIP 47/2018 (mejores prácticas), Convenio 108+ (Ley N° 27.699), Ley 25.326, Resolución 126/2024 AAIP

---

## Índice

1. [Principios Generales](#1-principios-generales)
2. [Equipo de Respuesta a Incidentes (IRT)](#2-equipo-de-respuesta-a-incidentes-irt)
3. [Clasificación de Incidentes](#3-clasificación-de-incidentes)
4. [PLAYBOOK A — Fuga de Claves Privadas AFIP](#4-playbook-a--fuga-de-claves-privadas-afip)
5. [PLAYBOOK B — Fuga de Datos de Ubicación/Biométricos](#5-playbook-b--fuga-de-datos-de-ubicaciónbiométricos)
6. [PLAYBOOK C — Compromiso de Tokens WhatsApp Business](#6-playbook-c--compromiso-de-tokens-whatsapp-business)
7. [Plantillas de Notificación Legal](#7-plantillas-de-notificación-legal)
8. [Línea de Tiempo Regulatoria](#8-línea-de-tiempo-regulatoria)
9. [Post-Incidente y Lecciones Aprendidas](#9-post-incidente-y-lecciones-aprendidas)

---

## 1. Principios Generales

### 1.1 Obligación de Notificación

Bajo el marco legal argentino actual y emergente:

| Marco Legal | Estado | Plazo de Notificación | A Quién |
|-------------|--------|----------------------|---------|
| **Ley 25.326** (LPDP) | Vigente | No especifica (interpretar como "sin demora") | AAIP (ex-DNPDP) |
| **Resolución AAIP 47/2018** | Vigente (recomendación) | "Lo antes posible" | AAIP |
| **Convenio 108+** (Ley 27.699) | Ratificado, pendiente de reglamentación | **72 horas** | AAIP + Titulares afectados |
| **Resolución 126/2024 AAIP** | Vigente | N/A (régimen sancionatorio) | N/A |
| **Proyecto de Ley PDP** | En trámite parlamentario | **72 horas** (proyectado) | AAIP + Titulares |

### 1.2 Principio Rector

> **"Notificar aunque no sea obligatorio."**
>
> La Resolución AAIP 47/2018 establece que la notificación proactiva de brechas es evidencia de buena fe y diligencia debida. En caso de auditoría o sanción bajo Resolución 126/2024, la notificación temprana es un atenuante significativo.

### 1.3 Definición de "Incidente de Seguridad"

Para los fines de este plan, un incidente de seguridad es:

> Cualquier acceso, uso, divulgación, modificación o destrucción no autorizada de datos personales almacenados en los sistemas de CampoTech, incluyendo:
> - Acceso no autorizado a la base de datos PostgreSQL (Supabase)
> - Exfiltración de datos a través de APIs o consultas SQL
> - Compromiso de credenciales de acceso (tokens, claves API)
> - Acceso físico no autorizado a sistemas de almacenamiento
> - Ataques de ingeniería social que resulten en divulgación de datos

---

## 2. Equipo de Respuesta a Incidentes (IRT)

### 2.1 Estructura

| Rol | Responsabilidad | Contacto |
|-----|-----------------|----------|
| **Líder IRT** (CTO/CISO) | Decisiones técnicas, coordinación | [COMPLETAR] |
| **Asesor Legal** | Notificaciones regulatorias, análisis legal | [COMPLETAR] |
| **Ingeniero de Infraestructura** | Contención técnica, análisis forense | [COMPLETAR] |
| **DPO (Delegado de Protección de Datos)** | Comunicación con AAIP, evaluación de impacto | [COMPLETAR] |
| **Comunicaciones** | Notificación a clientes, comunicados públicos | [COMPLETAR] |

### 2.2 Cadena de Escalación

```
Detección automática (kill-zone-monitor.ts / tripwires.ts)
         │
         ▼
  [Ingeniero Turno On-Call]  ← Alerta Slack/PagerDuty
         │
         ├── Falso Positivo → Documentar y cerrar
         │
         ▼
   [Líder IRT + Asesor Legal]  ← Convocatoria en < 30 minutos
         │
         ▼
   [IRT Completo]  ← Si se confirma brecha
         │
         ▼
   [AAIP + Titulares]  ← Dentro de 72 horas (Convenio 108+)
```

---

## 3. Clasificación de Incidentes

| Nivel | Criterio | Tiempo de Respuesta | Ejemplos |
|-------|----------|---------------------|----------|
| **P0 — Catastrófico** | Claves criptográficas comprometidas; suplantación fiscal posible | **Inmediato** (< 1 hora) | Fuga de `afipPrivateKeyEncrypted` |
| **P1 — Crítico** | PII de múltiples organizaciones; datos de ubicación en tiempo real | **< 4 horas** | Dump de `technician_locations`, compromiso de `accessToken` WA |
| **P2 — Alto** | PII de una organización; datos financieros limitados | **< 24 horas** | Acceso no autorizado a datos de 1 cliente |
| **P3 — Medio** | Metadata operacional; logs sin PII directa | **< 72 horas** | Acceso a logs de auditoría sin datos personales |
| **P4 — Bajo** | Intento fallido; detección sin exfiltración confirmada | **< 1 semana** | Tripwire activado sin evidencia de exfiltración |

---

## 4. PLAYBOOK A — Fuga de Claves Privadas AFIP

### 🔴 Clasificación: P0 — CATASTRÓFICO

**Escenario:** Un atacante obtiene acceso a los campos `afipPrivateKeyEncrypted` y/o `afipCertificateEncrypted` de la tabla `organizations`. Con estas claves puede:
- Emitir facturas electrónicas fraudulentas (comprobantes tipo A, B, C) ante AFIP
- Generar CAEs válidos en nombre de las organizaciones afectadas
- Cometer evasión fiscal imputada a los clientes de CampoTech
- Constituir delito penal: falsificación de documento público electrónico (Art. 292 CP)

### Paso 1: Contención Inmediata (T+0 a T+30 min)

```
ACCIÓN                                  RESPONSABLE         VERIFICACIÓN
─────────────────────────────────────────────────────────────────────────
1.1 Activar lockdown del usuario         Ingeniero On-Call   Redis: security:lockdown:{userId}
    sospechoso (tripwires.ts lo hace
    automáticamente si el threshold
    de LOCKDOWN fue alcanzado)

1.2 Revocar TODAS las sesiones           Ingeniero On-Call   refreshTokens revoked = true
    activas del usuario comprometido

1.3 Rotar la clave maestra de cifrado    Líder IRT           AFIP_ENCRYPTION_KEY en Railway
    (AFIP_ENCRYPTION_KEY)                                    Variables / Supabase Vault

1.4 Inhabilitar endpoints de AFIP        Ingeniero On-Call   Feature flag: AFIP_DISABLED=true
    temporalmente

1.5 Capturar snapshot forense            Ingeniero On-Call   pg_dump de audit_logs WHERE
    de audit_logs                                            action IN ('SECURITY_ALERT',
                                                             'SECURITY_LOCKDOWN')
```

### Paso 2: Evaluación de Alcance (T+30 min a T+2 horas)

```
ACCIÓN                                  RESPONSABLE         QUERY/VERIFICACIÓN
─────────────────────────────────────────────────────────────────────────
2.1 Determinar CUÁNTAS organizaciones    Ingeniero           SELECT COUNT(DISTINCT org_id)
    fueron accedidas por el atacante                         FROM audit_logs
                                                             WHERE user_id = '[ATTACKER]'
                                                             AND entity_type = 'Organization'
                                                             AND action = 'VIEW'
                                                             AND created_at > '[PERIODO]';

2.2 Verificar si las claves cifradas     Ingeniero           Analizar audit_logs con
    fueron efectivamente descifradas                         metadata->'afipFieldsRequested'
    (requieren la clave maestra AES)

2.3 Listar organizaciones afectadas      Ingeniero           SELECT id, name, afip_cuit
    con AFIP configurado                                     FROM organizations
                                                             WHERE afip_private_key_encrypted
                                                             IS NOT NULL;

2.4 Verificar si se emitieron facturas   Asesor Legal        Consultar AFIP WebService de
    fraudulentas desde las claves                            Comprobantes para cada CUIT
    comprometidas                                            afectado
```

### Paso 3: Revocación de Certificados AFIP (T+2 a T+6 horas)

**⚠️ ACCIÓN CRÍTICA — Requiere intervención de cada organización afectada**

Para CADA organización afectada:

```
3.1 NOTIFICAR al responsable de la organización:
    - Llamada telefónica directa (NO WhatsApp, NO email — canal puede estar comprometido)
    - Informar: "Sus credenciales AFIP almacenadas en CampoTech pueden haber sido comprometidas"

3.2 INSTRUIR al responsable a:
    a) Ingresar a https://auth.afip.gob.ar/contribuyente_/
    b) Ir a "Administración de Certificados Digitales"
    c) REVOCAR el certificado digital actual
    d) Generar un nuevo par de claves (CSR)
    e) Asociar el nuevo certificado al servicio wsfe (facturación electrónica)

3.3 VERIFICAR en AFIP:
    a) Acceder al WebService de Comprobantes
    b) Consultar últimos comprobantes emitidos
    c) Identificar cualquier comprobante NO emitido por la organización
    d) Si se detectan comprobantes fraudulentos → Art. 292 CP → denuncia penal

3.4 RECIBIR el nuevo certificado del cliente:
    a) El cliente genera un nuevo CSR
    b) CampoTech almacena con la nueva clave maestra (rotada en Paso 1.3)
    c) Verificar que la facturación electrónica funcione correctamente
```

### Paso 4: Notificación Regulatoria (T+6 a T+72 horas)

→ Ver [Plantilla A en Sección 7.1](#71-plantilla-a--notificación-a-aaip-por-compromiso-de-credenciales-afip)

### Paso 5: Remediación Técnica (T+72 horas a T+2 semanas)

```
5.1 Implementar cifrado doble (envelope encryption):
    - Clave maestra de organización (derivada de KMS)
    - Clave de datos por registro (única por organización)

5.2 Agregar campo-level encryption con HSM (Hardware Security Module):
    - Migrar AFIP_ENCRYPTION_KEY a AWS KMS o Google Cloud KMS
    - Eliminar la clave del environment variables

5.3 Implementar "select exclusion" por defecto en Prisma:
    - Nunca incluir afipPrivateKeyEncrypted en findMany()
    - Solo accesible vía getCredentials() con audit trail

5.4 Auditoría de código:
    - Identificar TODOS los puntos donde se accede a afipPrivateKeyEncrypted
    - Asegurar que SOLO AFIPCredentialsService.getCredentials() lo accede
    - Eliminar cualquier otro acceso directo
```

---

## 5. PLAYBOOK B — Fuga de Datos de Ubicación/Biométricos

### 🟠 Clasificación: P1 — CRÍTICO

**Escenario:** Un atacante obtiene acceso a las tablas `technician_locations`, `technician_location_history`, y/o `tracking_sessions`. Con estos datos puede:
- Rastrear la ubicación en tiempo real de técnicos
- Reconstruir rutas y patrones de movimiento
- Inferir domicilios particulares, rutinas, y horarios
- Facilitar acoso, stalking, robo, o violencia física

**Consideración especial bajo Ley 25.326:** Los datos de geolocalización continua de empleados son datos sensibles que pueden revelar hábitos, estado de salud (visitas a hospitales), afiliación religiosa (visitas a templos), y actividad política (visitas a sedes partidarias).

### Paso 1: Contención Inmediata (T+0 a T+1 hora)

```
1.1 Desactivar tracking en tiempo real:
    - Feature flag: LOCATION_TRACKING_DISABLED=true
    - Detener la ingesta de nuevas ubicaciones

1.2 Lockdown del usuario atacante (automático vía tripwires.ts)

1.3 Revocar todos los TrackingTokens activos:
    UPDATE tracking_tokens SET revoked_at = NOW()
    WHERE revoked_at IS NULL;

1.4 Deshabilitar endpoints de ubicación:
    - /api/tracking/*
    - /api/technician-location/*
```

### Paso 2: Evaluación de Alcance (T+1 a T+4 horas)

```
2.1 Determinar técnicos afectados:
    SELECT DISTINCT user_id FROM technician_location_history
    WHERE recorded_at BETWEEN '[INICIO_BRECHA]' AND '[FIN_BRECHA]';

2.2 Calcular ventana de exposición:
    - ¿Cuántos días/horas de historial fueron potencialmente accedidos?
    - ¿Se accedió a ubicaciones en tiempo real o solo historial?

2.3 Evaluar si se cruzaron datos de ubicación con PII:
    - ¿Se accedió también a la tabla users (nombres, teléfonos)?
    - ¿Se correlacionaron ubicaciones con datos de clientes (address)?
```

### Paso 3: Notificación a Titulares (T+4 a T+48 horas)

```
3.1 Notificar a CADA técnico afectado:
    - Llamada telefónica directa
    - Explicar qué datos fueron potencialmente expuestos
    - Ofrecer:
      a) Información sobre los datos exactos accedidos
      b) Recomendaciones de seguridad personal
      c) Canal de contacto directo para preguntas

3.2 Notificar a las organizaciones empleadoras:
    - Los técnicos son empleados de las organizaciones clientes
    - La organización tiene obligación como responsable del tratamiento
    - Proporcionar informe técnico del incidente
```

### Paso 4: Notificación Regulatoria (T+48 a T+72 horas)

→ Ver [Plantilla B en Sección 7.2](#72-plantilla-b--notificación-a-aaip-por-fuga-de-datos-de-ubicaciónbiométricos)

---

## 6. PLAYBOOK C — Compromiso de Tokens WhatsApp Business

### 🟠 Clasificación: P1 — CRÍTICO

**Escenario:** Un atacante obtiene los `accessToken`, `webhookSecret`, y/o `webhookVerifyToken` de la tabla `whatsapp_business_accounts`. Con estos puede:
- Enviar mensajes de spam/phishing desde números verificados de clientes
- Interceptar webhooks entrantes (leer mensajes de clientes finales)
- Dañar la reputación de marca de los clientes
- Violar la política de Meta — resulta en suspensión permanente del número

### Paso 1: Contención Inmediata (T+0 a T+30 min)

```
1.1 Identificar cuentas comprometidas:
    SELECT id, organization_id, display_phone_number, status
    FROM whatsapp_business_accounts
    WHERE access_token IS NOT NULL;

1.2 Rotar TODOS los tokens de las cuentas afectadas:
    - Para cada cuenta: generar nuevo System User Token en Meta Business Suite
    - Actualizar en la base de datos con cifrado

1.3 Rotar webhookVerifyToken y webhookSecret:
    UPDATE whatsapp_business_accounts
    SET webhook_verify_token = gen_random_uuid()::text,
        webhook_secret = gen_random_uuid()::text
    WHERE id IN ('[AFFECTED_IDS]');

1.4 Re-registrar webhooks en Meta Cloud API:
    - Para cada número: POST /v18.0/{phone-number-id}/register
    - Actualizar webhook URL con nuevo verify token

1.5 Monitorear logs de mensajes salientes:
    SELECT * FROM wa_outbound_queue
    WHERE created_at > '[HORA_BRECHA]'
    AND status = 'SENT'
    ORDER BY created_at DESC;
    -- Buscar mensajes no autorizados
```

### Paso 2: Evaluación de Impacto (T+30 min a T+4 horas)

```
2.1 Verificar mensajes fraudulentos enviados:
    - Revisar wa_messages para mensajes outbound no originados por el sistema
    - Verificar si se recibieron reportes de spam de usuarios finales

2.2 Evaluar exposición de conversaciones inbound:
    - Si webhookSecret fue comprometido, webhooks pudieron ser interceptados
    - Revisar wa_webhook_logs por IPs no reconocidas

2.3 Notificar a Meta:
    - business-api-support@fb.com
    - Reportar compromiso de tokens
    - Solicitar invalidación de tokens antiguos por su lado
```

---

## 7. Plantillas de Notificación Legal

### 7.1 Plantilla A — Notificación a AAIP por Compromiso de Credenciales AFIP

```
                                                    Buenos Aires, [FECHA]

Sra. Directora de la Agencia de Acceso a la Información Pública (AAIP)
Av. Pte. Julio A. Roca 710, Piso 2°
Ciudad Autónoma de Buenos Aires (C1067ABP)

Ref.: NOTIFICACIÓN DE INCIDENTE DE SEGURIDAD — Resolución AAIP 47/2018
      Convenio 108+ (Ley N° 27.699), Art. 7° bis

De nuestra consideración:

La empresa CAMPOTECH S.A.S. [o razón social correspondiente], CUIT [XX-XXXXXXXX-X],
con domicilio en [DOMICILIO LEGAL], en su carácter de ENCARGADO DEL TRATAMIENTO de
datos personales conforme al Art. 2° de la Ley 25.326, notifica a esta Agencia
el siguiente incidente de seguridad:

1. NATURALEZA DEL INCIDENTE

   Se ha detectado un acceso no autorizado a credenciales criptográficas
   (certificados digitales y claves privadas) emitidas por la AFIP, almacenadas
   de forma cifrada (AES-256-GCM) en nuestra base de datos en la nube.

   Estos certificados son utilizados por nuestros clientes (organizaciones
   suscriptas a la plataforma CampoTech) para la emisión de comprobantes
   electrónicos a través del WebService de Facturación Electrónica (WSFE)
   de AFIP, conforme a la RG 4290/2018.

2. FECHA DE DETECCIÓN Y PERIODO ESTIMADO DE EXPOSICIÓN

   - Fecha de detección: [FECHA Y HORA UTC-3]
   - Periodo estimado de exposición: [DESDE] hasta [HASTA]
   - Método de detección: Sistema automatizado de anomalías
     (kill-zone-monitor / tripwires)

3. CATEGORÍAS DE DATOS AFECTADOS

   a) Credenciales criptográficas AFIP (certificados digitales y claves privadas)
   b) CUITs de las organizaciones afectadas
   c) Puntos de venta AFIP asociados

   NOTA: Las claves privadas se almacenan cifradas con AES-256-GCM. Para
   que un atacante las utilice, debería además obtener la clave maestra
   de cifrado, almacenada en un sistema separado (variables de entorno
   del servidor de aplicaciones).

4. NÚMERO DE TITULARES AFECTADOS

   [N] organizaciones y sus respectivos responsables (titulares de los
   certificados AFIP), representando aproximadamente [N] personas físicas
   como firmantes autorizados.

5. CONSECUENCIAS PROBABLES

   - Emisión de comprobantes electrónicos fraudulentos ante AFIP
   - Perjuicio fiscal para las organizaciones afectadas
   - Riesgo de responsabilidad tributaria por operaciones no realizadas
   - Posible configuración de delitos contra la fe pública (Art. 292 CP)

6. MEDIDAS ADOPTADAS

   a) Revocación de certificados comprometidos vía AFIP
   b) Rotación de la clave maestra de cifrado
   c) Bloqueo de acceso del actor sospechoso
   d) Notificación individual a cada organización afectada con instrucciones
      para revocar y regenerar sus certificados AFIP
   e) Preservación de evidencia forense (logs de auditoría)
   f) Denuncia penal ante la Justicia Federal [si corresponde]

7. MEDIDAS FUTURAS PLANIFICADAS

   a) Migración a Hardware Security Module (HSM) para gestión de claves
   b) Implementación de cifrado envelope (doble capa)
   c) Auditoría de seguridad integral por tercero independiente

8. DATOS DE CONTACTO DEL DPO

   Nombre: [NOMBRE DEL DPO]
   Email: [EMAIL]
   Teléfono: [TELÉFONO]

Sin otro particular, saludamos a Ud. atentamente.

[FIRMA]
[NOMBRE DEL REPRESENTANTE LEGAL]
[CARGO]
CAMPOTECH S.A.S.
CUIT: [XX-XXXXXXXX-X]
```

---

### 7.2 Plantilla B — Notificación a AAIP por Fuga de Datos de Ubicación/Biométricos

```
                                                    Buenos Aires, [FECHA]

Sra. Directora de la Agencia de Acceso a la Información Pública (AAIP)
Av. Pte. Julio A. Roca 710, Piso 2°
Ciudad Autónoma de Buenos Aires (C1067ABP)

Ref.: NOTIFICACIÓN DE INCIDENTE DE SEGURIDAD — Resolución AAIP 47/2018
      Ley 25.326, Art. 2° (datos sensibles) y Art. 9° (seguridad de datos)
      Convenio 108+ (Ley N° 27.699), Art. 7° bis

De nuestra consideración:

La empresa CAMPOTECH S.A.S. [o razón social correspondiente], CUIT [XX-XXXXXXXX-X],
con domicilio en [DOMICILIO LEGAL], en su carácter de ENCARGADO DEL TRATAMIENTO de
datos personales conforme al Art. 2° de la Ley 25.326, notifica a esta Agencia
el siguiente incidente de seguridad que involucra DATOS SENSIBLES:

1. NATURALEZA DEL INCIDENTE

   Se ha detectado un acceso no autorizado a datos de geolocalización en
   tiempo real y/o históricos de trabajadores técnicos de campo. Estos datos
   incluyen:

   - Coordenadas GPS (latitud/longitud) con precisión de hasta 8 decimales
   - Velocidad y dirección de movimiento
   - Altitud
   - Historial completo de ubicaciones con marcas temporales
   - Trazas de rutas (polilíneas de navegación)

   Conforme al criterio de esta Agencia y la jurisprudencia internacional
   del Convenio 108+, los datos de geolocalización continua de trabajadores
   constituyen DATOS SENSIBLES en tanto permiten inferir:
   - Domicilio particular y hábitos de movilidad
   - Visitas a establecimientos de salud (datos de salud, Art. 2° Ley 25.326)
   - Concurrencia a establecimientos religiosos (datos de creencias)
   - Actividad sindical o política
   - Patrones de comportamiento personal

2. FECHA DE DETECCIÓN Y PERIODO ESTIMADO DE EXPOSICIÓN

   - Fecha de detección: [FECHA Y HORA UTC-3]
   - Periodo estimado de exposición: [DESDE] hasta [HASTA]
   - Período de datos históricos potencialmente accedidos: [RANGO DE FECHAS]
   - Método de detección: Sistema automatizado de anomalías
     (monitor de "Kill Zone" para datos de ubicación)

3. CATEGORÍAS DE DATOS AFECTADOS

   a) Datos de geolocalización en tiempo real (tabla: technician_locations)
      - Latitud, longitud, precisión, velocidad, dirección, altitud
      - Estado de conexión (online/offline) y última conexión

   b) Historial de ubicaciones (tabla: technician_location_history)
      - Registro cronológico completo de posiciones
      - Asociado a sesiones de trabajo específicas

   c) Sesiones de rastreo (tabla: tracking_sessions)
      - Dirección de destino (dirección del cliente)
      - Polilínea de la ruta seguida
      - ETA y distancia recorrida

   NOTA: Estos datos, correlacionados con la tabla de usuarios (nombres,
   teléfonos), permiten la identificación directa e inequívoca de cada
   persona afectada.

4. NÚMERO DE TITULARES AFECTADOS

   [N] técnicos de campo pertenecientes a [N] organizaciones, todos ellos
   trabajadores en relación de dependencia de las organizaciones clientes
   de CampoTech.

5. CONSECUENCIAS PROBABLES

   - Violación de la intimidad y privacidad de los trabajadores afectados
   - Riesgo de acoso, stalking o violencia física
   - Posible revelación de información de salud (inferida por ubicación)
   - Vulneración del derecho a la autodeterminación informativa
   - Afectación de la seguridad personal de los técnicos y sus familias

6. MEDIDAS ADOPTADAS

   a) Desactivación inmediata del sistema de rastreo en tiempo real
   b) Revocación de todos los tokens de acceso a tracking activos
   c) Bloqueo del usuario/sesión responsable del acceso no autorizado
   d) Notificación personal telefónica a cada técnico afectado
   e) Notificación a las organizaciones empleadoras (responsables del
      tratamiento en la relación laboral)
   f) Preservación de evidencia digital forense
   g) Evaluación de riesgos para la integridad física de los afectados

7. MEDIDAS FUTURAS PLANIFICADAS

   a) Implementación de acceso a ubicaciones solo por token temporal
      (TTL de 15 minutos, vinculado a trabajo activo)
   b) Anonimización automática de historial de ubicaciones > 30 días
   c) Separación de datos de ubicación en base de datos independiente
      con controles de acceso adicionales
   d) Auditoría de seguridad por tercero independiente

8. EVALUACIÓN DE IMPACTO (DPIA)

   Dada la naturaleza sensible de los datos comprometidos, se procederá
   a realizar una Evaluación de Impacto en la Protección de Datos (DPIA)
   conforme a las recomendaciones de esta Agencia, cuyos resultados serán
   comunicados oportunamente.

9. DATOS DE CONTACTO DEL DPO

   Nombre: [NOMBRE DEL DPO]
   Email: [EMAIL]
   Teléfono: [TELÉFONO]

Sin otro particular, saludamos a Ud. atentamente.

[FIRMA]
[NOMBRE DEL REPRESENTANTE LEGAL]
[CARGO]
CAMPOTECH S.A.S.
CUIT: [XX-XXXXXXXX-X]
```

---

### 7.3 Plantilla C — Notificación a Titulares Afectados (Técnicos)

```
Asunto: Notificación Importante de Seguridad — CampoTech

Estimado/a [NOMBRE DEL TÉCNICO]:

Le escribimos para informarle sobre un incidente de seguridad que
afectó datos relacionados con su cuenta en la plataforma CampoTech.

¿QUÉ PASÓ?
El [FECHA], detectamos un acceso no autorizado a datos de [ubicación /
credenciales / comunicaciones] almacenados en nuestros sistemas.

¿QUÉ DATOS FUERON AFECTADOS?
Los datos que pueden haber sido expuestos incluyen:
- [Listado específico según el incidente]

¿QUÉ ESTAMOS HACIENDO?
1. Hemos bloqueado el acceso no autorizado inmediatamente
2. Hemos notificado a la autoridad competente (AAIP)
3. Hemos [acciones específicas tomadas]

¿QUÉ PUEDE HACER USTED?
- [Recomendaciones específicas según el tipo de datos]
- Si nota actividad sospechosa, contáctenos inmediatamente

CONTACTO DIRECTO:
Para cualquier pregunta o inquietud, puede comunicarse con nuestro
equipo de seguridad:
- Email: seguridad@campotech.com.ar
- Teléfono: [NÚMERO]
- Horario: Lunes a Viernes, 9:00 a 18:00

Lamentamos este incidente y reafirmamos nuestro compromiso con la
protección de sus datos personales.

Atentamente,
Equipo de Seguridad de CampoTech
```

---

## 8. Línea de Tiempo Regulatoria

```
T+0          Detección del incidente (automática vía kill-zone-monitor)
  │
T+15 min     Ingeniero on-call notificado (Slack/PagerDuty)
  │
T+30 min     Líder IRT + Asesor Legal convocados
  │           Contención técnica iniciada
  │
T+1 hora     Evaluación de alcance en progreso
  │           ¿Datos personales afectados? → SÍ → continuar
  │
T+4 horas    Alcance determinado. Clasificación final del incidente.
  │           Identificación de titulares afectados.
  │
T+24 horas   Notificación a titulares críticos (técnicos con datos
  │           de ubicación, orgs con AFIP comprometido)
  │
T+48 horas   Borrador de notificación a AAIP revisado por Asesor Legal
  │
T+72 horas   ⚠️ DEADLINE Convenio 108+ ⚠️
  │           Notificación formal enviada a AAIP
  │           Confirmación de recepción solicitada
  │
T+1 semana   Informe preliminar de lecciones aprendidas
  │
T+2 semanas  Implementación de remediaciones técnicas iniciada
  │
T+1 mes      Informe final a AAIP (si se solicitó)
  │           Actualización del plan de respuesta
  │
T+3 meses    Auditoría de seguridad completa por tercero independiente
```

---

## 9. Post-Incidente y Lecciones Aprendidas

### 9.1 Debriefing (T+1 semana)

Todo el IRT debe participar en una sesión de retrospección que cubra:

1. **Línea de tiempo real vs. planificada** — ¿Se cumplieron los plazos?
2. **Efectividad de la detección** — ¿El kill-zone-monitor / tripwires detectó el incidente? ¿Cuánto tiempo tardó?
3. **Efectividad de la contención** — ¿Se logró detener la exfiltración? ¿Cuántos datos fueron comprometidos?
4. **Comunicación** — ¿La cadena de escalación funcionó? ¿Se notificó a tiempo?
5. **Brechas en el plan** — ¿Qué escenarios no estaban contemplados?

### 9.2 Métricas de Evaluación

| Métrica | Objetivo | Cómo se Mide |
|---------|----------|--------------|
| MTTD (Mean Time to Detect) | < 5 minutos | Timestamp de detección - timestamp de primer acceso anómalo |
| MTTC (Mean Time to Contain) | < 30 minutos | Timestamp de contención - timestamp de detección |
| MTTN (Mean Time to Notify) | < 72 horas | Timestamp de notificación a AAIP - timestamp de detección |
| Registros expuestos | 0 (objetivo ideal) | Count de registros accedidos en la ventana de exposición |
| Falsos positivos | < 3/mes | Count de alertas no confirmadas como incidentes |

### 9.3 Actualización del Plan

Este plan debe ser revisado y actualizado:
- **Trimestralmente** — revisión de thresholds y procedimientos
- **Después de cada incidente** — incorporar lecciones aprendidas
- **Ante cambios regulatorios** — nuevo proyecto de ley PDP, reglamentación de Convenio 108+
- **Ante cambios de infraestructura** — nuevas tablas sensibles, nuevos proveedores

---

> **Documento generado:** 2026-02-12
> **Autor:** CISO, CampoTech
> **Próxima revisión:** 2026-05-12
> **Clasificación:** CONFIDENCIAL
