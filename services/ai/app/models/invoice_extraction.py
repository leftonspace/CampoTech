# =============================================================================
# PHASE 6: VOICE-TO-INVOICE AI
# =============================================================================
#
# Extended Extraction Models for Invoice Generation
#
# This module extends the existing JobExtraction with additional fields
# for parts, materials, labor, and costs as described in voice memos.
# =============================================================================

from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class ExtractedPart(BaseModel):
    """A part or material mentioned in the voice report."""
    
    name: str = Field(..., description="Name of the part/material")
    quantity: float = Field(default=1.0, description="Quantity mentioned")
    unit: str = Field(default="unidad", description="Unit: unidad, metro, kg, litro, etc.")
    
    # AI will try to match to pricebook
    possible_catalog_matches: list[str] = Field(
        default_factory=list,
        description="Possible PriceItem names this could match"
    )
    
    # Extraction confidence
    confidence: float = Field(default=0.7, ge=0, le=1)
    
    # Original text span
    source_text: str = Field(default="", description="Verbatim text this was extracted from")


class ExtractedService(BaseModel):
    """A service or labor task mentioned in the voice report."""
    
    description: str = Field(..., description="Description of the service performed")
    
    # Time tracking
    duration_minutes: Optional[int] = Field(None, description="Duration if mentioned")
    
    # Service categorization
    service_type: Optional[str] = Field(None, description="Type: diagnostico, reparacion, instalacion, mantenimiento")
    
    # AI will try to match to pricebook
    possible_catalog_matches: list[str] = Field(
        default_factory=list,
        description="Possible PriceItem names this could match"
    )
    
    confidence: float = Field(default=0.7, ge=0, le=1)
    source_text: str = Field(default="")


class TechnicianReportExtraction(BaseModel):
    """
    Extended extraction for technician job completion reports.
    
    This extends the customer-facing JobExtraction with fields specific
    to post-job reporting: parts used, services performed, time tracking.
    """
    
    # Summary
    job_summary: Optional[str] = Field(None, description="Brief summary of work performed")
    work_performed: Optional[str] = Field(None, description="Detailed description of work")
    
    # Parts & Materials
    parts_used: list[ExtractedPart] = Field(
        default_factory=list,
        description="Parts and materials used"
    )
    
    # Services Performed
    services_performed: list[ExtractedService] = Field(
        default_factory=list,
        description="Services/labor performed"
    )
    
    # Time Tracking
    arrival_time: Optional[str] = Field(None, description="When technician arrived")
    departure_time: Optional[str] = Field(None, description="When technician left")
    total_labor_hours: Optional[float] = Field(None, description="Total hours worked")
    
    # Equipment Status
    equipment_status: Optional[str] = Field(
        None, 
        description="Final status: funcionando, requiere_seguimiento, no_reparable"
    )
    
    # Recommendations
    recommendations: Optional[str] = Field(None, description="Recommendations for customer")
    follow_up_required: bool = Field(default=False)
    follow_up_notes: Optional[str] = Field(None)
    
    # Photos mentioned
    photos_mentioned: bool = Field(default=False, description="Did tech mention taking photos?")
    
    # Customer signature
    signature_obtained: bool = Field(default=False)
    
    # Overall confidence
    overall_confidence: float = Field(default=0.0, ge=0, le=1)
    field_confidences: dict[str, float] = Field(default_factory=dict)


class MatchedLineItem(BaseModel):
    """
    A line item generated from extraction with pricing information.
    
    This represents the AI's suggestion for a JobLineItem, ready for
    technician review and approval.
    """
    
    # Core fields
    description: str
    quantity: float
    unit: str
    
    # Pricing (populated after pricebook matching)
    unit_price: Optional[Decimal] = None
    total: Optional[Decimal] = None
    tax_rate: Decimal = Field(default=Decimal("21.0"))
    
    # Source tracking
    source_type: str = Field(..., description="'part', 'service', or 'custom'")
    source_text: str = Field(default="", description="Original voice text")
    
    # PriceItem matching
    matched_price_item_id: Optional[str] = None
    matched_price_item_name: Optional[str] = None
    match_confidence: float = Field(default=0.0, ge=0, le=1)
    
    # Alternative matches for user selection
    alternative_matches: list[dict] = Field(
        default_factory=list,
        description="Alternative PriceItem matches with id, name, price"
    )
    
    # Review status
    needs_review: bool = Field(default=True)
    review_reason: Optional[str] = Field(None, description="Why this needs review")


class InvoiceSuggestion(BaseModel):
    """
    Complete AI-generated invoice suggestion.
    
    Contains all line items, totals, and metadata for technician review.
    """
    
    # Job context
    job_id: str
    organization_id: str
    
    # Generated line items
    line_items: list[MatchedLineItem] = Field(default_factory=list)
    
    # Calculated totals (provisional, before review)
    subtotal: Decimal = Field(default=Decimal("0"))
    tax_amount: Decimal = Field(default=Decimal("0"))
    total: Decimal = Field(default=Decimal("0"))
    
    # Original extraction
    extraction: TechnicianReportExtraction
    
    # Voice memo info
    voice_memo_id: Optional[str] = None
    transcription: str = Field(default="")
    
    # Processing metadata
    processing_duration_ms: int = Field(default=0)
    generated_at: str = Field(default="")
    
    # Review status
    requires_review: bool = Field(default=True)
    review_notes: list[str] = Field(default_factory=list)
    
    # Confidence
    overall_match_confidence: float = Field(default=0.0)
