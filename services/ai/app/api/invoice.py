"""
Invoice API Routes

Phase 6: Voice-to-Invoice AI endpoints for extracting invoice data from voice memos.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.invoice_extraction import extract_invoice_data
from app.models.invoice_extraction import InvoiceSuggestion


router = APIRouter()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class InvoiceExtractionRequest(BaseModel):
    """Request to extract invoice data from a voice memo."""
    
    transcription: str = Field(..., description="Transcribed text from voice memo")
    organization_id: str = Field(..., description="Organization ID")
    job_id: str = Field(..., description="Job ID this report is for")
    service_type: Optional[str] = Field(None, description="Type of service performed")
    equipment_info: Optional[str] = Field(None, description="Equipment being serviced")
    
    class Config:
        json_schema_extra = {
            "example": {
                "transcription": "Bueno, terminé el trabajo del aire. Cambié el filtro, usé dos caños de cobre de medio metro cada uno, y gasté medio kilo de soldadura. Estuve dos horas, el equipo quedó funcionando perfecto. El cliente firmó conforme.",
                "organization_id": "org_123",
                "job_id": "job_456",
                "service_type": "INSTALACION",
                "equipment_info": "Aire acondicionado split Samsung 3000 frigorías"
            }
        }


class InvoiceExtractionResponse(BaseModel):
    """Response with generated invoice suggestion."""
    
    success: bool
    suggestion: Optional[InvoiceSuggestion] = None
    error: Optional[str] = None
    
    # Quick summary for UI
    line_item_count: int = 0
    items_needing_review: int = 0
    estimated_total: str = "0.00"
    processing_time_ms: int = 0


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post(
    "/invoice/extract",
    response_model=InvoiceExtractionResponse,
    summary="Extract invoice data from voice memo",
    description="Phase 6: Extracts parts, services, and pricing from a transcribed voice report",
)
async def extract_invoice(request: InvoiceExtractionRequest) -> InvoiceExtractionResponse:
    """
    Extract invoice data from a technician's voice report.
    
    This endpoint:
    1. Parses the transcription for parts, materials, and services
    2. Matches extracted items to the organization's pricebook
    3. Calculates totals and generates a draft invoice
    4. Flags items that need manual review/pricing
    
    The returned suggestion should be reviewed by the technician before
    creating actual JobLineItem records.
    """
    try:
        suggestion = await extract_invoice_data(
            transcription=request.transcription,
            organization_id=request.organization_id,
            job_id=request.job_id,
            service_type=request.service_type,
            equipment_info=request.equipment_info,
        )
        
        items_needing_review = sum(
            1 for item in suggestion.line_items if item.needs_review
        )
        
        return InvoiceExtractionResponse(
            success=True,
            suggestion=suggestion,
            line_item_count=len(suggestion.line_items),
            items_needing_review=items_needing_review,
            estimated_total=f"{suggestion.total:.2f}",
            processing_time_ms=suggestion.processing_duration_ms,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invoice extraction failed: {str(e)}",
        )


@router.post(
    "/invoice/extract-from-audio",
    response_model=InvoiceExtractionResponse,
    summary="Extract invoice from audio file",
    description="Transcribes audio and extracts invoice data in one step",
)
async def extract_invoice_from_audio(
    audio_url: str,
    organization_id: str,
    job_id: str,
    service_type: Optional[str] = None,
    equipment_info: Optional[str] = None,
) -> InvoiceExtractionResponse:
    """
    Combined endpoint: transcribe audio + extract invoice.
    
    Useful for direct integration where transcription hasn't been done yet.
    """
    from app.integrations.openai_client import transcribe_audio
    
    try:
        # Step 1: Transcribe
        transcription = await transcribe_audio(audio_url)
        
        if not transcription:
            return InvoiceExtractionResponse(
                success=False,
                error="Failed to transcribe audio",
            )
        
        # Step 2: Extract invoice data
        suggestion = await extract_invoice_data(
            transcription=transcription,
            organization_id=organization_id,
            job_id=job_id,
            service_type=service_type,
            equipment_info=equipment_info,
        )
        
        items_needing_review = sum(
            1 for item in suggestion.line_items if item.needs_review
        )
        
        return InvoiceExtractionResponse(
            success=True,
            suggestion=suggestion,
            line_item_count=len(suggestion.line_items),
            items_needing_review=items_needing_review,
            estimated_total=f"{suggestion.total:.2f}",
            processing_time_ms=suggestion.processing_duration_ms,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio processing failed: {str(e)}",
        )
