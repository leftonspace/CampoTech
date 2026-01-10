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

FAQ_DATABASE: dict[str, list[dict[str, str]]] = {
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
            "a": "Andá a Configuración > Equipo > Invitar miembro. Ingresá el email y seleccioná el rol (Técnico o Despachador)."
        },
        {
            "q": "¿Puedo tener múltiples organizaciones?",
            "a": "Sí, podés crear varias organizaciones y cambiar entre ellas desde el menú de usuario arriba a la derecha."
        },
        {
            "q": "¿Cómo elimino mi cuenta?",
            "a": "Podés solicitar eliminación en Configuración > Cuenta > Eliminar cuenta. Te eliminaremos completamente en 30 días máximo."
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
- facturacion: problemas con AFIP, facturas, certificados, CBU, punto de venta
- pagos: problemas de pago, suscripción, Mercado Pago, tarjetas
- whatsapp: WhatsApp AI, créditos de mensajes, número de WhatsApp
- cuenta: login, contraseña, configuración, perfil, equipo
- app_movil: app móvil, cámara, GPS, fotos, sincronización
- otro: si no encaja claramente en ninguna de las anteriores

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
    valid_categories = ["facturacion", "pagos", "whatsapp", "cuenta", "app_movil", "otro"]
    if category not in valid_categories:
        category = "otro"
    
    return {"issue_category": category}


async def provide_answer(state: SupportBotState) -> dict[str, Any]:
    """Provide an FAQ-based answer to the user's question."""
    
    category = state.get("issue_category", "otro")
    faqs = get_faqs_for_category(category)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Sos el asistente de soporte de CampoTech, una app para profesionales de servicios técnicos.

Usá esta información de FAQs para responder al usuario:

{faqs}

Reglas:
1. Respondé en español argentino, de forma amigable y concisa.
2. Si la pregunta está cubierta por las FAQs, dá una respuesta útil.
3. Si la pregunta NO está cubierta o es muy específica, decí claramente que vas a escalar a un humano.
4. No inventes información que no está en las FAQs.
5. Si mencionás ir a una página de configuración, usá el formato "Andá a X > Y > Z".
6. Siempre preguntá si hay algo más en lo que puedas ayudar.

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
        "history": history or "(primera pregunta)",
    })
    
    answer = response.content
    
    # Check if escalation is needed
    escalation_phrases = [
        "escalar", "humano", "soporte", "no puedo resolver",
        "no tengo información", "caso específico", "técnico",
        "te contactaremos", "equipo de soporte"
    ]
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
