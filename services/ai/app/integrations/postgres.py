"""
PostgreSQL integration for database operations.
"""

from typing import Any, Optional

import httpx

from app.config import settings


async def create_job(
    organization_id: str,
    customer_phone: str,
    extraction_data: dict[str, Any],
    source: str = "voice_ai",
) -> dict[str, Any]:
    """
    Create a new job in the CampoTech database via API.
    
    Args:
        organization_id: Organization ID
        customer_phone: Customer phone for linking
        extraction_data: Extracted job data
        source: Source of the job creation
        
    Returns:
        Created job data including ID
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.CAMPOTECH_API_URL}/api/jobs",
            json={
                "organization_id": organization_id,
                "customer_phone": customer_phone,
                "title": extraction_data.get("title", "Nuevo trabajo"),
                "description": extraction_data.get("description", ""),
                "service_type": extraction_data.get("service_type"),
                "address": extraction_data.get("address"),
                "city": extraction_data.get("city"),
                "province": extraction_data.get("province"),
                "scheduled_date": extraction_data.get("preferred_date"),
                "scheduled_time": extraction_data.get("preferred_time"),
                "urgency": extraction_data.get("urgency", "normal"),
                "appliance_brand": extraction_data.get("appliance_brand"),
                "appliance_model": extraction_data.get("appliance_model"),
                "metadata": {
                    "source": source,
                    "extraction_confidence": extraction_data.get("overall_confidence"),
                    "field_confidences": extraction_data.get("field_confidences"),
                },
            },
            headers={
                "Authorization": f"Bearer {settings.CAMPOTECH_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()


async def add_to_review_queue(
    organization_id: str,
    message_id: str,
    transcription: str,
    extraction_data: dict[str, Any],
    confidence: float,
    customer_phone: str,
) -> dict[str, Any]:
    """
    Add a voice message to the human review queue.
    
    Args:
        organization_id: Organization ID
        message_id: WhatsApp message ID
        transcription: Transcribed text
        extraction_data: Extracted data for review
        confidence: Overall confidence score
        customer_phone: Customer phone number
        
    Returns:
        Created review queue entry
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.CAMPOTECH_API_URL}/api/voice-review",
            json={
                "organization_id": organization_id,
                "message_id": message_id,
                "transcription": transcription,
                "extraction": extraction_data,
                "confidence": confidence,
                "customer_phone": customer_phone,
                "status": "pending_review",
            },
            headers={
                "Authorization": f"Bearer {settings.CAMPOTECH_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()


async def update_message_status(
    message_id: str,
    transcription: Optional[str] = None,
    extraction_data: Optional[dict[str, Any]] = None,
    confidence: Optional[float] = None,
    status: Optional[str] = None,
) -> dict[str, Any]:
    """
    Update a WhatsApp message with processing results.
    
    Args:
        message_id: WhatsApp message ID
        transcription: Transcribed text
        extraction_data: Extracted data
        confidence: Confidence score
        status: New status
        
    Returns:
        Updated message data
    """
    update_data: dict[str, Any] = {}
    if transcription is not None:
        update_data["transcription"] = transcription
    if extraction_data is not None:
        update_data["extraction_data"] = extraction_data
    if confidence is not None:
        update_data["extraction_confidence"] = confidence
    if status is not None:
        update_data["ai_processing_status"] = status
    
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{settings.CAMPOTECH_API_URL}/api/whatsapp/messages/{message_id}",
            json=update_data,
            headers={
                "Authorization": f"Bearer {settings.CAMPOTECH_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()
