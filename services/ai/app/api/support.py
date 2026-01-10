"""
Phase 7.3: Support Bot API Router

FastAPI router for the AI support chat functionality.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid

from app.workflows.support_bot import process_support_message


router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    """A single chat message."""
    role: str  # "user" or "assistant"
    content: str


class SupportChatRequest(BaseModel):
    """Request for support chat."""
    messages: list[ChatMessage]
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    session_id: Optional[str] = None


class SupportChatResponse(BaseModel):
    """Response from support chat."""
    response: str
    category: Optional[str] = None
    escalated: bool = False
    resolved: bool = False
    session_id: str


# ═══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/support/chat", response_model=SupportChatResponse)
async def chat_with_support_bot(request: SupportChatRequest) -> SupportChatResponse:
    """
    Process a support chat message.
    
    The bot will:
    1. Classify the user's issue
    2. Provide an FAQ-based answer
    3. Escalate to human support if needed
    """
    
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")
    
    # Ensure we have a session ID
    session_id = request.session_id or str(uuid.uuid4())
    
    # Convert messages to dict format
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    
    try:
        result = await process_support_message(
            messages=messages,
            user_id=request.user_id,
            organization_id=request.organization_id,
            session_id=session_id,
        )
        
        return SupportChatResponse(
            response=result["response"],
            category=result.get("category"),
            escalated=result.get("escalated", False),
            resolved=result.get("resolved", False),
            session_id=session_id,
        )
        
    except Exception as e:
        print(f"[Support Bot API] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error processing support message"
        )


@router.get("/support/categories")
async def get_support_categories() -> dict:
    """Get available support categories."""
    return {
        "categories": [
            {"id": "facturacion", "name": "Facturación AFIP", "icon": "🧾"},
            {"id": "pagos", "name": "Pagos y Suscripción", "icon": "💳"},
            {"id": "whatsapp", "name": "WhatsApp AI", "icon": "📱"},
            {"id": "cuenta", "name": "Cuenta y Configuración", "icon": "⚙️"},
            {"id": "app_movil", "name": "App Móvil", "icon": "📲"},
            {"id": "otro", "name": "Otro", "icon": "❓"},
        ]
    }
