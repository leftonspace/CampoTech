"""
WhatsApp API integration for sending messages.
"""

from typing import Any, Optional

import httpx

from app.config import settings


async def send_message(
    to: str,
    text: str,
    organization_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Send a WhatsApp text message via CampoTech's WhatsApp API.
    
    Args:
        to: Recipient phone number
        text: Message text
        organization_id: Organization ID for routing
        
    Returns:
        API response with message ID
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.CAMPOTECH_API_URL}/api/whatsapp/send",
            json={
                "to": to,
                "type": "text",
                "text": {"body": text},
                "organization_id": organization_id,
            },
            headers={
                "Authorization": f"Bearer {settings.CAMPOTECH_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()


async def send_interactive_buttons(
    to: str,
    body: str,
    buttons: list[dict[str, str]],
    organization_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Send an interactive button message.
    
    Args:
        to: Recipient phone number
        body: Message body text
        buttons: List of button configs [{"id": "btn_1", "title": "Yes"}, ...]
        organization_id: Organization ID for routing
        
    Returns:
        API response with message ID
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.CAMPOTECH_API_URL}/api/whatsapp/send",
            json={
                "to": to,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {"text": body},
                    "action": {
                        "buttons": [
                            {
                                "type": "reply",
                                "reply": {"id": btn["id"], "title": btn["title"]},
                            }
                            for btn in buttons[:3]  # Max 3 buttons
                        ]
                    },
                },
                "organization_id": organization_id,
            },
            headers={
                "Authorization": f"Bearer {settings.CAMPOTECH_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()


async def get_conversation_history(
    phone: str,
    organization_id: str,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """
    Get conversation history for a phone number.
    
    Args:
        phone: Customer phone number
        organization_id: Organization ID
        limit: Max messages to retrieve
        
    Returns:
        List of message objects
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.CAMPOTECH_API_URL}/api/whatsapp/conversations/{phone}",
            params={"organization_id": organization_id, "limit": limit},
            headers={
                "Authorization": f"Bearer {settings.CAMPOTECH_API_KEY}",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json().get("messages", [])
