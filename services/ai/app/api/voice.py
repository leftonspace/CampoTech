"""
Voice Processing API Routes

Endpoints for voice message processing and workflow management.
"""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.models import (
    VoiceProcessingRequest,
    VoiceProcessingResponse,
    VoiceProcessingStatus,
    WorkflowResumeRequest,
    WorkflowResumeResponse,
)
from app.workflows import voice_workflow, VoiceProcessingState

router = APIRouter()


@router.post(
    "/voice/process",
    response_model=VoiceProcessingResponse,
    summary="Process a voice message",
    description="Start the voice processing workflow for a WhatsApp voice message",
)
async def process_voice_message(request: VoiceProcessingRequest) -> VoiceProcessingResponse:
    """
    Process a voice message through the LangGraph workflow.
    
    This endpoint:
    1. Transcribes the audio with Whisper
    2. Extracts structured job data with GPT-4
    3. Routes based on confidence level
    4. Either auto-creates a job, asks for confirmation, or queues for review
    """
    try:
        # Initialize workflow state
        initial_state: VoiceProcessingState = {
            "message_id": request.message_id,
            "audio_url": request.audio_url,
            "customer_phone": request.customer_phone,
            "organization_id": request.organization_id,
            "conversation_history": request.conversation_history,
            "status": "transcribing",
            "transcription": None,
            "extraction": None,
            "confidence": None,
            "job_id": None,
            "error": None,
            "confirmation_sent": False,
            "confirmation_message_id": None,
        }
        
        # Execute workflow
        result = await voice_workflow.ainvoke(initial_state)
        
        # Map status to enum
        status_map = {
            "transcribing": VoiceProcessingStatus.TRANSCRIBING,
            "extracting": VoiceProcessingStatus.EXTRACTING,
            "confirming": VoiceProcessingStatus.CONFIRMING,
            "completed": VoiceProcessingStatus.COMPLETED,
            "failed": VoiceProcessingStatus.FAILED,
            "human_review": VoiceProcessingStatus.HUMAN_REVIEW,
        }
        
        return VoiceProcessingResponse(
            success=result["status"] not in ("failed",),
            status=status_map.get(result["status"], VoiceProcessingStatus.FAILED),
            message_id=request.message_id,
            transcription=result.get("transcription"),
            extraction=result.get("extraction"),
            confidence=result.get("confidence"),
            job_id=result.get("job_id"),
            workflow_id=None,  # Would be set if using persistent state
            error=result.get("error"),
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice processing failed: {str(e)}",
        )


@router.post(
    "/voice/resume",
    response_model=WorkflowResumeResponse,
    summary="Resume a paused workflow",
    description="Resume a workflow that is waiting for customer confirmation",
)
async def resume_workflow(request: WorkflowResumeRequest) -> WorkflowResumeResponse:
    """
    Resume a workflow after receiving customer's reply to confirmation.
    
    This is called when a customer responds to a confirmation message
    (yes/no or correction).
    """
    # TODO: Implement workflow state persistence with Redis/DB
    # For now, return placeholder
    return WorkflowResumeResponse(
        success=True,
        workflow_id=request.workflow_id,
        new_status=VoiceProcessingStatus.COMPLETED,
        message="Workflow resume not yet implemented - using synchronous flow",
    )


@router.get(
    "/voice/status/{message_id}",
    summary="Get processing status",
    description="Check the status of a voice message processing",
)
async def get_processing_status(message_id: str) -> dict[str, Any]:
    """
    Get the current processing status of a voice message.
    
    Returns the current state and any results available.
    """
    # TODO: Look up status from database
    return {
        "message_id": message_id,
        "status": "unknown",
        "message": "Status lookup not yet implemented",
    }


@router.post(
    "/voice/retry/{message_id}",
    summary="Retry failed processing",
    description="Retry processing for a failed voice message",
)
async def retry_processing(message_id: str) -> dict[str, Any]:
    """
    Retry processing for a message that previously failed.
    
    This re-fetches the audio and runs the full workflow again.
    """
    # TODO: Implement retry logic - fetch message from DB and reprocess
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Retry not yet implemented",
    )
