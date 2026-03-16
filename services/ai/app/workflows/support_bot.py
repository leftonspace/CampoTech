"""
Phase 7.3: Support Bot Workflow

LangGraph workflow for customer support that:
1. Classifies user issues into categories
2. Provides FAQ-based answers
3. Escalates complex issues to human support

Categories:
- facturacion: AFIP, invoices, billing
- pagos: Mercado Pago, subscriptions
- whatsapp: WhatsApp AI, credits
- cuenta: Login, settings
- app_movil: Mobile app issues
- otro: Unknown - escalate to human
"""

from typing import TypedDict, Literal, Optional, Any
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
import httpx

from app.config import settings


# ═══════════════════════════════════════════════════════════════════════════════
# STATE DEFINITION
# ═══════════════════════════════════════════════════════════════════════════════

SupportCategory = Literal[
    "facturacion",
    "pagos", 
    "whatsapp",
    "cuenta",
    "app_movil",
    "otro"
]

class SupportBotState(TypedDict):
    """State for the support bot workflow."""
    messages: list[dict]
    user_id: Optional[str]
    organization_id: Optional[str]
    issue_category: Optional[SupportCategory]
    resolved: bool
    escalate_to_human: bool
    session_id: str
    last_response: Optional[str]


# ═══════════════════════════════════════════════════════════════════════════════
# FAQ DATA
# ═══════════════════════════════════════════════════════════════════════════════

# Business Knowledge Base - for public visitors and sales questions
BUSINESS_KNOWLEDGE = """
## Sobre CampoTech

CampoTech es una plataforma de gestión para profesionales de servicios técnicos en Argentina.
Ideal para: técnicos de aire acondicionado, electricistas, plomeros, cerrajeros, gasistas, y más.

## Planes y Precios (ARS)

### Plan Gratis - $0/mes
- Hasta 3 trabajos activos
- 1 usuario (técnico)
- Facturación manual básica
- Sin integración WhatsApp AI
- Perfecto para empezar

### Plan Inicial - $25.000/mes (o $250.000/año - 2 meses gratis)
- Trabajos ilimitados
- Hasta 5 técnicos
- Integración AFIP completa (Factura A, B, C)
- WhatsApp básico (link directo)
- Agenda y calendario
- Reportes básicos

### Plan Profesional - $55.000/mes (o $550.000/año - 2 meses gratis)
- Todo de Inicial +
- Técnicos ilimitados
- WhatsApp AI con número propio
- 100 créditos AI incluidos/mes
- Procesamiento de audios con IA
- Inventario y control de stock
- Gestión de flota de vehículos
- Reportes avanzados

### Plan Empresa - $120.000/mes (o $1.200.000/año - 2 meses gratis)
- Todo de Profesional +
- Múltiples sucursales
- API personalizada
- Soporte prioritario
- Dashboard ejecutivo
- Integración personalizada
- Capacitación incluida

## Prueba Gratuita

- **21 días de prueba gratis** en cualquier plan pago
- Sin tarjeta de crédito
- Acceso a todas las funciones del plan
- Tus datos se mantienen si te suscribís
- Cancelá cuando quieras, sin compromiso

## Características Principales

### Gestión de Trabajos
- Crear y asignar trabajos
- Calendario visual
- Estados: pendiente, en progreso, completado
- Notas y fotos por trabajo
- Historial completo

### Facturación con AFIP
- Factura electrónica automática (A, B, C)
- Conexión directa con AFIP
- PDF profesional
- Envío automático por WhatsApp/email
- Notas de crédito y débito

### Integración WhatsApp
- Plan Inicial: Link directo a tu WhatsApp
- Plan Profesional+: Número propio de WhatsApp Business
- WhatsApp AI: Los clientes envían audios, la IA transcribe y crea trabajos
- Notificaciones automáticas (confirmación, recordatorio, factura)
- Inbox compartido para tu equipo

### Pagos con Mercado Pago
- Link de pago en cada factura
- Cobro automático
- Cuotas sin interés
- QR de Mercado Pago
- Conciliación automática

### App Móvil
- Disponible para iOS y Android
- Funciona sin internet (sincroniza después)
- GPS para registro de visitas
- Cámara para fotos de trabajos
- Firma del cliente

## Soporte

- Email: soporte@campotech.com.ar
- Respuesta en 24 horas hábiles (días hábiles)
- Centro de ayuda: /ayuda
- Chat con IA 24/7

## Requisitos para AFIP

1. Ser monotributista o responsable inscripto
2. Tener certificado digital de AFIP (.pfx)
3. Punto de venta autorizado para facturación electrónica
4. CUIT activo

## Seguridad

- Datos encriptados
- Servidores en Argentina
- Cumplimiento RGPD
- Backup automático diario
"""

FAQ_DATABASE: dict[str, list[dict[str, str]]] = {
    # Sales & Pre-sales Questions (for public visitors)
    "ventas": [
        {
            "q": "¿Cuánto cuesta CampoTech?",
            "a": "Tenemos 4 planes: Gratis ($0), Inicial ($25.000/mes), Profesional ($55.000/mes) y Empresa ($120.000/mes). Todos los planes pagos tienen 21 días de prueba gratis sin tarjeta."
        },
        {
            "q": "¿Hay prueba gratis?",
            "a": "¡Sí! Tenés 21 días de prueba gratis en cualquier plan pago, sin necesidad de tarjeta de crédito. Podés probar todas las funciones y cancelar si no te convence."
        },
        {
            "q": "¿Puedo cambiar de plan después?",
            "a": "Sí, podés subir o bajar de plan cuando quieras. El cambio se prorratea automáticamente."
        },
        {
            "q": "¿Hay descuento por pago anual?",
            "a": "Sí, el pago anual equivale a 10 meses (2 meses gratis). Por ejemplo, Profesional anual es $550.000 en vez de $660.000."
        },
    ],
    "caracteristicas": [
        {
            "q": "¿Qué incluye CampoTech?",
            "a": "CampoTech incluye: gestión de trabajos/agenda, facturación AFIP, cobros con Mercado Pago, integración WhatsApp, app móvil, reportes, y mucho más. Las funciones disponibles dependen del plan."
        },
        {
            "q": "¿Funciona con AFIP?",
            "a": "Sí, CampoTech se conecta directamente con AFIP para emitir Facturas A, B y C electrónicas. Necesitás tu certificado digital de AFIP y un punto de venta autorizado."
        },
        {
            "q": "¿Tiene app para celular?",
            "a": "Sí, tenemos app para iOS y Android. Tus técnicos pueden ver trabajos, navegar con GPS, sacar fotos, y registrar visitas incluso sin internet."
        },
        {
            "q": "¿Cómo funciona el WhatsApp AI?",
            "a": "Con el plan Profesional o superior, recibís un número de WhatsApp Business propio. Los clientes te escriben o envían audios, y la IA entiende el mensaje y puede crear trabajos automáticamente."
        },
    ],
    "facturacion": [
        {
            "q": "¿Cómo cargo mi certificado AFIP?",
            "a": "Andá a Configuración > AFIP > Subir certificado. Necesitás el archivo .crt y tu clave privada .key. Si tenés dudas, seguí nuestra guía paso a paso en /ayuda"
        },
        {
            "q": "¿Qué hago si AFIP rechaza mi factura?",
            "a": "Los rechazos más comunes son: 1) CUIT inválido del cliente, 2) Punto de venta no autorizado, 3) Fecha inválida. Revisá el mensaje de error específico en el historial de facturas."
        },
        {
            "q": "¿Puedo emitir Factura A y B?",
            "a": "Sí, si sos Responsable Inscripto podés emitir Factura A (a otros RI) y Factura B (a consumidores finales). Monotributistas emiten Factura C."
        },
        {
            "q": "¿Cómo configuro mi punto de venta?",
            "a": "El punto de venta se configura en AFIP primero, luego lo agregás en CampoTech en Configuración > AFIP > Punto de Venta."
        },
    ],
    "pagos": [
        {
            "q": "¿Qué métodos de pago aceptan?",
            "a": "Aceptamos Mercado Pago (tarjetas crédito/débito, saldo en cuenta) y efectivo en Rapipago/Pago Fácil."
        },
        {
            "q": "¿Cómo cambio mi plan?",
            "a": "Andá a Configuración > Suscripción > Cambiar plan. El cambio es inmediato y se prorratea el costo."
        },
        {
            "q": "¿Puedo cancelar mi suscripción?",
            "a": "Sí, podés cancelar cuando quieras desde Configuración > Suscripción > Cancelar. No hay penalidad por cancelación."
        },
        {
            "q": "¿Hay reembolsos?",
            "a": "Ofrecemos reembolso completo en los primeros 7 días. Después, la cancelación aplica para el próximo período."
        },
    ],
    "whatsapp": [
        {
            "q": "¿Cómo funcionan los créditos?",
            "a": "1 crédito = 1 conversación de WhatsApp con IA. Una conversación incluye todos los mensajes hasta que se cierra. Los créditos no vencen."
        },
        {
            "q": "¿Qué pasa si me quedo sin créditos?",
            "a": "La primera vez que te quedás sin créditos, se activan 50 créditos de emergencia (uso único). Después, tu WhatsApp vuelve al modo gratuito con link directo."
        },
        {
            "q": "¿Necesito un número especial?",
            "a": "Para WhatsApp AI necesitás un número de WhatsApp Business dedicado. La opción gratuita usa link a tu número personal."
        },
        {
            "q": "¿Por qué no recibo mensajes?",
            "a": "Verificá: 1) Que el número esté activo en Configuración > WhatsApp, 2) Que tengas créditos disponibles, 3) Que el webhook esté funcionando."
        },
    ],
    "cuenta": [
        {
            "q": "¿Cómo cambio mi contraseña?",
            "a": "Andá a Configuración > Cuenta > Cambiar contraseña. También podés usar 'Olvidé mi contraseña' desde la pantalla de login."
        },
        {
            "q": "¿Cómo agrego un técnico a mi equipo?",
            "a": "Andá a Configuración > Equipo > Invitar miembro. Ingresá el email y seleccioná el rol (Técnico o Administrador)."
        },
        {
            "q": "¿Puedo tener múltiples organizaciones?",
            "a": "Sí, podés crear varias organizaciones y cambiar entre ellas desde el menú de usuario arriba a la derecha."
        },
        {
            "q": "¿Cómo elimino mi cuenta?",
            "a": "Podés solicitar eliminación en Configuración > Cuenta > Eliminar cuenta. Te eliminaremos completamente en 30 días máximo."
        },
        {
            "q": "¿Por qué no puedo editar el número de teléfono de un empleado?",
            "a": "El número de teléfono está bloqueado por seguridad y cumplimiento normativo. El sistema usa el número para autenticación y para mantener un historial verificable de trabajos realizados. Esto protege tanto a tu empresa como a tus clientes."
        },
        {
            "q": "¿Qué hago si un empleado cambió de número de teléfono?",
            "a": "El procedimiento correcto es: 1️⃣ Desactivar el usuario anterior (desmarcar 'Usuario activo' para archivarlo), 2️⃣ Crear un nuevo usuario con el número nuevo. Esto preserva el historial de trabajos del perfil anterior y mantiene la trazabilidad requerida para oficios matriculados."
        },
        {
            "q": "¿Por qué tengo que crear un nuevo usuario en vez de cambiar el número?",
            "a": "Cada perfil de usuario representa una identidad única vinculada a su historial de trabajos. Para profesionales matriculados (gasistas, electricistas), esto es un requisito legal para mantener la trazabilidad de quién firmó cada trabajo. Archivar y crear nuevo es el proceso seguro."
        },
        {
            "q": "¿Se pierde la información cuando desactivo un usuario?",
            "a": "No, al desactivar un usuario solo lo 'archivás'. Su historial de trabajos, chats y datos quedan guardados permanentemente. Podés consultarlos cuando necesites."
        },
    ],
    "app_movil": [
        {
            "q": "¿La app funciona sin internet?",
            "a": "Sí, la app guarda los trabajos del día localmente. Cuando recuperes conexión, se sincroniza automáticamente."
        },
        {
            "q": "¿Por qué no me funciona el GPS?",
            "a": "Verificá que la app tenga permisos de ubicación en Configuración del celular > Aplicaciones > CampoTech > Permisos."
        },
        {
            "q": "¿Cómo subo fotos de un trabajo?",
            "a": "Abrí el trabajo, tocá el botón de cámara o galería, y seleccioná las fotos. Se suben cuando tengas conexión."
        },
        {
            "q": "¿Por qué la app está lenta?",
            "a": "Probá: 1) Cerrar y abrir la app, 2) Verificar conexión a internet, 3) Actualizar la app a la última versión."
        },
    ],
    "otro": [
        {
            "q": "¿Tienen soporte humano?",
            "a": "Sí, podés escribirnos a soporte@campotech.com.ar y te respondemos en 24 horas hábiles."
        },
    ],
}


def get_faqs_for_category(category: str) -> str:
    """Get formatted FAQs for a category."""
    faqs = FAQ_DATABASE.get(category, FAQ_DATABASE["otro"])
    formatted = []
    for faq in faqs:
        formatted.append(f"P: {faq['q']}\nR: {faq['a']}")
    return "\n\n".join(formatted)


# ═══════════════════════════════════════════════════════════════════════════════
# WORKFLOW NODES
# ═══════════════════════════════════════════════════════════════════════════════

async def classify_issue(state: SupportBotState) -> dict[str, Any]:
    """Classify the user's issue into a category."""
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Sos el asistente de soporte de CampoTech, una app para profesionales de servicios técnicos.
        
Tu tarea es clasificar el mensaje del usuario en UNA de estas categorías:
- ventas: preguntas sobre precios, planes, prueba gratis, costos, comparación de planes
- caracteristicas: preguntas sobre qué hace CampoTech, funcionalidades, integraciones, cómo funciona
- facturacion: problemas con AFIP, facturas, certificados, CBU, punto de venta
- pagos: problemas de pago, suscripción actual, Mercado Pago, tarjetas
- whatsapp: WhatsApp AI, créditos de mensajes, número de WhatsApp
- cuenta: login, contraseña, configuración, perfil, equipo
- app_movil: app móvil, cámara, GPS, fotos, sincronización
- otro: si no encaja claramente en ninguna de las anteriores

IMPORTANTE: Si alguien pregunta por precios, planes, o "cuánto cuesta" -> ventas
Si alguien pregunta qué es CampoTech o cómo funciona -> caracteristicas
Si alguien tiene un PROBLEMA con un servicio existente -> usar la categoría del problema

Respondé SOLO con la palabra de la categoría, sin explicación."""),
        ("user", "{message}")
    ])
    
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        api_key=settings.OPENAI_API_KEY,
    )
    chain = prompt | llm
    
    # Get the last user message
    last_message = ""
    for msg in reversed(state["messages"]):
        if msg.get("role") == "user":
            last_message = msg.get("content", "")
            break
    
    response = await chain.ainvoke({"message": last_message})
    category = response.content.strip().lower()
    
    # Validate category
    valid_categories = ["ventas", "caracteristicas", "facturacion", "pagos", "whatsapp", "cuenta", "app_movil", "otro"]
    if category not in valid_categories:
        category = "otro"
    
    return {"issue_category": category}


async def provide_answer(state: SupportBotState) -> dict[str, Any]:
    """Provide an FAQ-based answer to the user's question."""
    
    category = state.get("issue_category", "otro")
    faqs = get_faqs_for_category(category)
    
    # For sales/features questions, include the full business knowledge
    is_sales_question = category in ["ventas", "caracteristicas"]
    knowledge_base = BUSINESS_KNOWLEDGE if is_sales_question else ""
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Sos el asistente de CampoTech, una plataforma de gestión para profesionales de servicios técnicos en Argentina.

⚠️ RESTRICCIÓN IMPORTANTE:
SOLO podés responder preguntas relacionadas con CampoTech, incluyendo:
- Precios, planes y suscripciones
- Funcionalidades de la plataforma
- Facturación electrónica con AFIP
- Integración WhatsApp
- App móvil
- Mercado Pago
- Soporte técnico de la plataforma
- Información general sobre gestión de servicios técnicos

Si alguien pregunta algo NO relacionado con CampoTech (recetas, matemáticas, programación general, 
cualquier otro tema), respondé EXACTAMENTE:
"¡Hola! Soy el asistente de CampoTech y solo puedo ayudarte con consultas sobre nuestra plataforma 
de gestión para técnicos. 😊

¿Tenés alguna pregunta sobre nuestros planes, funciones, facturación con AFIP, o cómo funciona CampoTech?"

NO respondas preguntas fuera de CampoTech bajo ninguna circunstancia.

{knowledge_base}

Usá esta información de FAQs para responder al usuario:

{faqs}

Reglas:
1. Respondé en español argentino, de forma amigable y profesional.
2. Si la pregunta es sobre precios/planes/funciones, usá la información del knowledge base.
3. La prueba gratis es de 21 DÍAS, no 14.
4. Si la pregunta está cubierta, dá una respuesta completa y útil.
5. SOLO escalá a humano si realmente no podés responder (problemas técnicos muy específicos).
6. Para preguntas de ventas/características, NUNCA escales - responde con la información disponible.
7. Si mencionás ir a una página, usá el formato "Andá a X > Y > Z".
8. Siempre preguntá si hay algo más en lo que puedas ayudar.
9. Usá emojis ocasionalmente para ser más amigable.
10. RECHAZÁ amablemente cualquier pregunta no relacionada con CampoTech.

Historial de la conversación:
{history}"""),
        ("user", "{message}")
    ])
    
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,
        api_key=settings.OPENAI_API_KEY,
    )
    chain = prompt | llm
    
    # Get conversation history
    history = ""
    for msg in state["messages"][:-1]:  # Exclude last message
        role = "Usuario" if msg.get("role") == "user" else "Asistente"
        content = msg.get("content", "")
        history += f"{role}: {content}\n"
    
    # Get the last user message
    last_message = ""
    for msg in reversed(state["messages"]):
        if msg.get("role") == "user":
            last_message = msg.get("content", "")
            break
    
    response = await chain.ainvoke({
        "message": last_message,
        "faqs": faqs,
        "knowledge_base": knowledge_base,
        "history": history or "(primera pregunta)",
    })
    
    answer = response.content
    
    # Check if escalation is needed - only for EXPLICIT escalation phrases
    # Be careful: words like "técnico" and "soporte" appear in normal answers!
    escalation_phrases = [
        "voy a escalar",
        "necesito escalar",
        "no puedo resolver",
        "no tengo esa información",
        "te contactará un humano",
        "equipo de soporte te contactará",
        "un agente te contactará",
        "no puedo ayudarte con eso específicamente",
    ]
    
    # For sales/features questions, NEVER escalate unless explicitly asked for human
    is_sales_question = state.get("issue_category") in ["ventas", "caracteristicas"]
    if is_sales_question:
        escalate = False  # Sales questions should never auto-escalate
    else:
        escalate = any(phrase in answer.lower() for phrase in escalation_phrases)
    
    # Update messages with the response
    new_messages = state["messages"] + [{"role": "assistant", "content": answer}]
    
    return {
        "messages": new_messages,
        "last_response": answer,
        "escalate_to_human": escalate,
        "resolved": not escalate,
    }


async def escalate_to_support(state: SupportBotState) -> dict[str, Any]:
    """Create a support ticket and notify the user."""
    
    # Try to create a support ticket via the API
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{settings.CAMPOTECH_API_URL}/api/support/report",
                json={
                    "type": "escalation",
                    "description": f"[AI Escalation] Category: {state.get('issue_category', 'unknown')}\n\nConversation:\n" + 
                        "\n".join([f"{m['role']}: {m['content']}" for m in state["messages"]]),
                    "context": {
                        "source": "ai_support_bot",
                        "user_id": state.get("user_id"),
                        "organization_id": state.get("organization_id"),
                        "session_id": state.get("session_id"),
                        "category": state.get("issue_category"),
                    },
                },
                timeout=10.0,
            )
    except Exception as e:
        print(f"[Support Bot] Failed to create escalation ticket: {e}")
    
    escalation_message = (
        "Tu consulta fue escalada a nuestro equipo de soporte. "
        "Te contactaremos por email en las próximas 24 horas hábiles. "
        "¿Hay algo más en lo que pueda ayudarte mientras tanto?"
    )
    
    new_messages = state["messages"] + [
        {"role": "assistant", "content": escalation_message}
    ]
    
    return {
        "messages": new_messages,
        "last_response": escalation_message,
    }


def should_escalate(state: SupportBotState) -> str:
    """Determine if we should escalate or end."""
    if state.get("escalate_to_human", False):
        return "escalate"
    return "end"


# ═══════════════════════════════════════════════════════════════════════════════
# GRAPH CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════════

def create_support_bot_graph() -> StateGraph:
    """Create the support bot LangGraph workflow."""
    
    graph = StateGraph(SupportBotState)
    
    # Add nodes
    graph.add_node("classify", classify_issue)
    graph.add_node("answer", provide_answer)
    graph.add_node("escalate", escalate_to_support)
    
    # Set entry point
    graph.set_entry_point("classify")
    
    # Add edges
    graph.add_edge("classify", "answer")
    graph.add_conditional_edges(
        "answer",
        should_escalate,
        {"escalate": "escalate", "end": END}
    )
    graph.add_edge("escalate", END)
    
    return graph.compile()


# Compiled graph instance
support_bot = create_support_bot_graph()


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

async def process_support_message(
    messages: list[dict],
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    session_id: str = "",
) -> dict[str, Any]:
    """
    Process a support chat message through the bot.
    
    Args:
        messages: List of chat messages [{"role": "user/assistant", "content": "..."}]
        user_id: Optional user ID for context
        organization_id: Optional organization ID for context
        session_id: Unique session identifier
        
    Returns:
        Dict with response and metadata
    """
    
    initial_state: SupportBotState = {
        "messages": messages,
        "user_id": user_id,
        "organization_id": organization_id,
        "issue_category": None,
        "resolved": False,
        "escalate_to_human": False,
        "session_id": session_id,
        "last_response": None,
    }
    
    result = await support_bot.ainvoke(initial_state)
    
    return {
        "response": result.get("last_response", "Lo siento, hubo un error. Por favor intentá de nuevo."),
        "category": result.get("issue_category"),
        "escalated": result.get("escalate_to_human", False),
        "resolved": result.get("resolved", False),
        "messages": result.get("messages", messages),
    }
