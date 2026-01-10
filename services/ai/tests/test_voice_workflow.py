"""
Tests for voice processing workflow.
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.models import VoiceProcessingRequest, VoiceProcessingStatus
from app.workflows.voice_processing import (
    VoiceProcessingState,
    build_voice_workflow,
    route_by_confidence,
)


class TestRouteByConfidence:
    """Tests for confidence-based routing."""
    
    def test_high_confidence_routes_to_auto_create(self):
        """High confidence (>= 0.85) should auto-create."""
        state: VoiceProcessingState = {
            "message_id": "test",
            "audio_url": "",
            "customer_phone": "",
            "organization_id": "",
            "conversation_history": [],
            "status": "routing",
            "transcription": "Test",
            "extraction": None,
            "confidence": 0.92,
            "job_id": None,
            "error": None,
            "confirmation_sent": False,
            "confirmation_message_id": None,
        }
        
        assert route_by_confidence(state) == "auto_create"
    
    def test_medium_confidence_routes_to_confirm(self):
        """Medium confidence (0.50-0.84) should request confirmation."""
        state: VoiceProcessingState = {
            "message_id": "test",
            "audio_url": "",
            "customer_phone": "",
            "organization_id": "",
            "conversation_history": [],
            "status": "routing",
            "transcription": "Test",
            "extraction": None,
            "confidence": 0.65,
            "job_id": None,
            "error": None,
            "confirmation_sent": False,
            "confirmation_message_id": None,
        }
        
        assert route_by_confidence(state) == "confirm"
    
    def test_low_confidence_routes_to_human_review(self):
        """Low confidence (< 0.50) should queue for human review."""
        state: VoiceProcessingState = {
            "message_id": "test",
            "audio_url": "",
            "customer_phone": "",
            "organization_id": "",
            "conversation_history": [],
            "status": "routing",
            "transcription": "Test",
            "extraction": None,
            "confidence": 0.35,
            "job_id": None,
            "error": None,
            "confirmation_sent": False,
            "confirmation_message_id": None,
        }
        
        assert route_by_confidence(state) == "human_review"


class TestVoiceWorkflow:
    """Tests for the complete workflow."""
    
    def test_workflow_builds_successfully(self):
        """Workflow should compile without errors."""
        workflow = build_voice_workflow()
        assert workflow is not None
    
    @pytest.mark.asyncio
    async def test_workflow_handles_transcription_error(self):
        """Workflow should handle transcription failures gracefully."""
        # This would require mocking the integrations
        # Placeholder for now
        pass


class TestConfirmationMessage:
    """Tests for confirmation message formatting."""
    
    def test_format_basic_confirmation(self):
        """Should format a basic confirmation message."""
        from app.integrations.openai_client import format_confirmation_message
        from app.models import JobExtraction
        
        extraction = JobExtraction(
            title="Reparación de heladera",
            service_type="refrigeracion",
            appliance_brand="Samsung",
            problem_description="No enfría",
            overall_confidence=0.75,
        )
        
        message = format_confirmation_message(extraction)
        
        assert "Reparación de heladera" in message
        assert "Samsung" in message
        assert "Refrigeración" in message
        assert "¿Es correcto?" in message
