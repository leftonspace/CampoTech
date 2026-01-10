"""
Pydantic models for API request/response schemas.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class VoiceProcessingStatus(str, Enum):
    """Status of voice processing workflow."""
    
    TRANSCRIBING = "transcribing"
    EXTRACTING = "extracting"
    CONFIRMING = "confirming"
    COMPLETED = "completed"
    FAILED = "failed"
    HUMAN_REVIEW = "human_review"


class ConversationMessage(BaseModel):
    """A message in the conversation history."""
    
    role: str = Field(..., description="Message role: 'customer' or 'business'")
    content: str = Field(..., description="Message content")
    timestamp: Optional[datetime] = None
    message_type: str = Field(default="text", description="Type: 'text', 'audio', 'image'")


class VoiceProcessingRequest(BaseModel):
    """Request to process a voice message."""
    
    message_id: str = Field(..., description="WhatsApp message ID")
    audio_url: str = Field(..., description="URL to download the audio file")
    customer_phone: str = Field(..., description="Customer's phone number")
    organization_id: str = Field(..., description="Organization ID in CampoTech")
    conversation_history: list[ConversationMessage] = Field(
        default_factory=list,
        description="Previous messages in the conversation"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "wamid.HBgNNTQ5...",
                "audio_url": "https://lookaside.fbsbx.com/whatsapp/...",
                "customer_phone": "5491155551234",
                "organization_id": "org_abc123",
                "conversation_history": [
                    {
                        "role": "customer",
                        "content": "Hola, necesito un técnico",
                        "timestamp": "2026-01-07T10:00:00Z",
                        "message_type": "text"
                    }
                ]
            }
        }


class ExtractedJobField(BaseModel):
    """An extracted field from the voice message."""
    
    field: str = Field(..., description="Field name")
    value: Any = Field(..., description="Extracted value")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score 0-1")
    source: str = Field(default="transcription", description="Where this was extracted from")


class JobExtraction(BaseModel):
    """Extracted job data from voice message."""
    
    title: Optional[str] = None
    description: Optional[str] = None
    service_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    urgency: Optional[str] = None  # "normal", "urgente", "emergencia"
    customer_name: Optional[str] = None
    appliance_brand: Optional[str] = None
    appliance_model: Optional[str] = None
    problem_description: Optional[str] = None
    
    # Confidence tracking per field
    field_confidences: dict[str, float] = Field(default_factory=dict)
    overall_confidence: float = Field(default=0.0, ge=0, le=1)


class VoiceProcessingResponse(BaseModel):
    """Response from voice processing."""
    
    success: bool
    status: VoiceProcessingStatus
    message_id: str
    transcription: Optional[str] = None
    extraction: Optional[JobExtraction] = None
    confidence: Optional[float] = None
    job_id: Optional[str] = None
    workflow_id: Optional[str] = None
    error: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "status": "completed",
                "message_id": "wamid.HBgNNTQ5...",
                "transcription": "Hola, soy Juan. Tengo un problema con mi heladera Samsung...",
                "extraction": {
                    "title": "Reparación de heladera",
                    "service_type": "refrigeracion",
                    "appliance_brand": "Samsung",
                    "problem_description": "No enfría correctamente",
                    "overall_confidence": 0.92
                },
                "confidence": 0.92,
                "job_id": "job_xyz789"
            }
        }


class WorkflowResumeRequest(BaseModel):
    """Request to resume a paused workflow after customer reply."""
    
    workflow_id: str = Field(..., description="LangGraph workflow ID")
    customer_reply: str = Field(..., description="Customer's reply message")
    reply_type: str = Field(default="text", description="Type of reply: 'text', 'yes', 'no'")


class WorkflowResumeResponse(BaseModel):
    """Response after resuming a workflow."""
    
    success: bool
    workflow_id: str
    new_status: VoiceProcessingStatus
    job_id: Optional[str] = None
    message: Optional[str] = None
