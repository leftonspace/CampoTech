"""
LangGraph Voice Processing Workflow

This workflow handles the complete voice message processing pipeline:
1. Transcribe audio with Whisper
2. Extract structured job data with GPT-4
3. Route based on confidence threshold
4. Auto-create job, send confirmation, or queue for human review
"""

from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.config import settings
from app.integrations import (
    add_to_review_queue,
    create_job,
    download_audio,
    extract_job_data,
    format_confirmation_message,
    send_message,
    transcribe_audio,
    update_message_status,
)
from app.models.schemas import ConversationMessage, JobExtraction
from app.services.translation import detect_and_translate, translate_for_customer


class VoiceProcessingState(TypedDict):
    """State object that flows through the workflow."""
    
    # Input
    message_id: str
    audio_url: str
    customer_phone: str
    organization_id: str
    conversation_history: list[ConversationMessage]
    
    # Phase 5.2: Translation settings (from organization)
    business_languages: list[str]  # Languages the business team speaks
    
    # Phase 5.5: Workflow permissions (from AIConfiguration)
    workflow_permissions: dict  # JSON permissions from workflowPermissions field
    
    # Processing state
    status: Literal[
        "transcribing",
        "translating",
        "extracting",
        "routing",
        "confirming",
        "creating",
        "completed",
        "failed",
        "human_review",
    ]
    
    # Outputs
    transcription: str | None
    extraction: JobExtraction | None
    confidence: float | None
    job_id: str | None
    error: str | None
    
    # Phase 5.2: Translation tracking
    detected_language: str | None           # ISO code of detected language
    detected_language_name: str | None      # Full name of detected language
    original_transcription: str | None      # Original transcription (if translated)
    translated_transcription: str | None    # Spanish translation (if needed)
    language_confidence: float | None       # Confidence of language detection
    
    # Workflow tracking
    confirmation_sent: bool
    confirmation_message_id: str | None


# ============================================================================
# PERMISSION HELPERS (Phase 5.5)
# ============================================================================


def check_permission(state: VoiceProcessingState, permission: str) -> bool:
    """
    Check if a specific workflow permission is enabled.
    
    Phase 5.5: Workflow Permissions
    
    Permissions:
    - suggestResponses: Suggest text responses
    - translateMessages: Auto-translate messages
    - suggestActions: Suggest job creation, assignments, etc.
    - accessDatabase: Query business data
    - accessSchedule: Check calendar availability
    - autoApproveSmallPriceAdjustments: Auto-approve minor discounts
    - autoApproveThresholdPercent: Max % for auto-approval
    - autoAssignTechnicians: Auto-assign available technicians
    """
    permissions = state.get("workflow_permissions", {})
    
    # Default to True for most permissions (permissive default)
    defaults = {
        "suggestResponses": True,
        "translateMessages": True,
        "suggestActions": True,
        "accessDatabase": True,
        "accessSchedule": True,
        "autoApproveSmallPriceAdjustments": False,
        "autoApproveThresholdPercent": 5,
        "autoAssignTechnicians": False,
    }
    
    return permissions.get(permission, defaults.get(permission, True))


# ============================================================================
# WORKFLOW NODES
# ============================================================================


async def transcribe_node(state: VoiceProcessingState) -> VoiceProcessingState:
    """Node: Download and transcribe audio."""
    try:
        # Download audio from WhatsApp
        audio_data = await download_audio(state["audio_url"])
        
        # Transcribe with Whisper (auto-detect language for Phase 5.2)
        transcription = await transcribe_audio(audio_data, language="es")
        
        # Update message in database
        await update_message_status(
            message_id=state["message_id"],
            transcription=transcription,
            status="transcribed",
        )
        
        return {
            **state,
            "transcription": transcription,
            "status": "translating",  # Phase 5.2: Next step is translation check
            "error": None,
        }
        
    except Exception as e:
        return {
            **state,
            "status": "failed",
            "error": f"Transcription failed: {str(e)}",
        }


async def translate_node(state: VoiceProcessingState) -> VoiceProcessingState:
    """
    Node: Detect language and translate if needed.
    
    Phase 5.2: Translation Core
    - Detects the language of the transcription
    - If not Spanish and not a language the business speaks, translates to Spanish
    - Preserves original for display while using translation for extraction
    
    Phase 5.5: Respects translateMessages permission
    """
    try:
        # Phase 5.5: Check if translation is permitted
        if not check_permission(state, "translateMessages"):
            return {
                **state,
                "status": "extracting",
                "detected_language": "es",
                "detected_language_name": "Español (traducción deshabilitada)",
            }
        
        transcription = state.get("transcription")
        if not transcription:
            return {
                **state,
                "status": "extracting",
                "detected_language": "es",
                "detected_language_name": "Español",
            }
        
        # Get business languages (default to just Spanish)
        business_languages = state.get("business_languages", ["es"])
        
        # Detect and translate if needed
        final_text, lang_result, translated = await detect_and_translate(
            transcription,
            business_languages,
        )
        
        # Prepare state update
        update = {
            **state,
            "status": "extracting",
            "detected_language": lang_result.code,
            "detected_language_name": lang_result.name,
            "language_confidence": lang_result.confidence,
        }
        
        if translated:
            # Store both original and translation
            update["original_transcription"] = transcription
            update["translated_transcription"] = translated
            update["transcription"] = translated  # Use translation for extraction
            
            # Update message in database with translation info
            await update_message_status(
                message_id=state["message_id"],
                detected_language=lang_result.code,
                original_content=transcription,
                translated_content=translated,
            )
        
        return update
        
    except Exception as e:
        # On translation error, continue with original transcription
        return {
            **state,
            "status": "extracting",
            "detected_language": "es",
            "detected_language_name": "Español",
            "error": f"Translation warning: {str(e)}",  # Non-fatal
        }


async def extract_node(state: VoiceProcessingState) -> VoiceProcessingState:
    """Node: Extract structured job data from transcription."""
    try:
        if not state["transcription"]:
            return {
                **state,
                "status": "failed",
                "error": "No transcription available",
            }
        
        # Extract job data
        extraction = await extract_job_data(
            transcription=state["transcription"],
            conversation_history=state["conversation_history"],
        )
        
        # Update message in database
        await update_message_status(
            message_id=state["message_id"],
            extraction_data=extraction.model_dump(),
            confidence=extraction.overall_confidence,
            status="extracted",
        )
        
        return {
            **state,
            "extraction": extraction,
            "confidence": extraction.overall_confidence,
            "status": "routing",
            "error": None,
        }
        
    except Exception as e:
        return {
            **state,
            "status": "failed",
            "error": f"Extraction failed: {str(e)}",
        }


def route_by_confidence(state: VoiceProcessingState) -> str:
    """
    Conditional routing based on extraction confidence.
    
    Returns the name of the next node to execute.
    """
    confidence = state.get("confidence", 0)
    
    if confidence >= settings.CONFIDENCE_AUTO_CREATE_THRESHOLD:
        # High confidence - auto create job
        return "auto_create"
    elif confidence >= settings.CONFIDENCE_CONFIRM_THRESHOLD:
        # Medium confidence - ask for confirmation
        return "confirm"
    else:
        # Low confidence - human review
        return "human_review"


async def send_confirmation_node(state: VoiceProcessingState) -> VoiceProcessingState:
    """Node: Send confirmation message to customer."""
    try:
        if not state["extraction"]:
            return {**state, "status": "failed", "error": "No extraction data"}
        
        # Format confirmation message
        message = format_confirmation_message(state["extraction"])
        
        # Send via WhatsApp
        response = await send_message(
            to=state["customer_phone"],
            text=message,
            organization_id=state["organization_id"],
        )
        
        # Update status - now waiting for reply
        await update_message_status(
            message_id=state["message_id"],
            status="awaiting_confirmation",
        )
        
        return {
            **state,
            "status": "confirming",
            "confirmation_sent": True,
            "confirmation_message_id": response.get("message_id"),
        }
        
    except Exception as e:
        # If confirmation fails, fall back to human review
        return {
            **state,
            "status": "human_review",
            "error": f"Confirmation failed: {str(e)}",
        }


async def auto_create_job_node(state: VoiceProcessingState) -> VoiceProcessingState:
    """Node: Automatically create job with high confidence extraction."""
    try:
        if not state["extraction"]:
            return {**state, "status": "failed", "error": "No extraction data"}
        
        # Create job in database
        job = await create_job(
            organization_id=state["organization_id"],
            customer_phone=state["customer_phone"],
            extraction_data=state["extraction"].model_dump(),
            source="voice_ai_auto",
        )
        
        # Send confirmation to customer
        title = state["extraction"].title or "tu trabajo"
        await send_message(
            to=state["customer_phone"],
            text=(
                f"✅ *Trabajo creado:* {title}\n\n"
                "Te avisamos cuando asignemos un técnico.\n"
                "Podés ver el estado en cualquier momento escribiendo *estado*."
            ),
            organization_id=state["organization_id"],
        )
        
        # Update message status
        await update_message_status(
            message_id=state["message_id"],
            status="job_created",
        )
        
        return {
            **state,
            "status": "completed",
            "job_id": job.get("id"),
            "error": None,
        }
        
    except Exception as e:
        # If auto-create fails, queue for review
        return {
            **state,
            "status": "human_review",
            "error": f"Job creation failed: {str(e)}",
        }


async def human_review_node(state: VoiceProcessingState) -> VoiceProcessingState:
    """Node: Add message to human review queue."""
    try:
        # Add to review queue
        await add_to_review_queue(
            organization_id=state["organization_id"],
            message_id=state["message_id"],
            transcription=state["transcription"] or "",
            extraction_data=state["extraction"].model_dump() if state["extraction"] else {},
            confidence=state["confidence"] or 0,
            customer_phone=state["customer_phone"],
        )
        
        # Notify customer
        await send_message(
            to=state["customer_phone"],
            text=(
                "📝 Recibimos tu mensaje de voz.\n"
                "Un operador lo revisará en breve y te contactará.\n"
                "Gracias por tu paciencia."
            ),
            organization_id=state["organization_id"],
        )
        
        # Update message status
        await update_message_status(
            message_id=state["message_id"],
            status="queued_for_review",
        )
        
        return {
            **state,
            "status": "human_review",
            "error": None,
        }
        
    except Exception as e:
        return {
            **state,
            "status": "failed",
            "error": f"Failed to queue for review: {str(e)}",
        }


async def handle_failure_node(state: VoiceProcessingState) -> VoiceProcessingState:
    """Node: Handle failed processing - notify and escalate."""
    try:
        # Update message status
        await update_message_status(
            message_id=state["message_id"],
            status="processing_failed",
        )
        
        # Always queue failed messages for human review
        await add_to_review_queue(
            organization_id=state["organization_id"],
            message_id=state["message_id"],
            transcription=state["transcription"] or "(transcription failed)",
            extraction_data={},
            confidence=0,
            customer_phone=state["customer_phone"],
        )
        
        # Notify customer
        await send_message(
            to=state["customer_phone"],
            text=(
                "❌ Tuvimos un problema procesando tu mensaje de voz.\n"
                "Un operador te contactará pronto.\n"
                "Disculpá las molestias."
            ),
            organization_id=state["organization_id"],
        )
        
    except Exception:
        pass  # Best effort - already in error state
    
    return state


# ============================================================================
# BUILD WORKFLOW GRAPH
# ============================================================================


def build_voice_workflow() -> StateGraph:
    """Build and compile the voice processing workflow."""
    
    # Create workflow graph
    workflow = StateGraph(VoiceProcessingState)
    
    # Add nodes
    workflow.add_node("transcribe", transcribe_node)
    workflow.add_node("translate", translate_node)  # Phase 5.2: Translation node
    workflow.add_node("extract", extract_node)
    workflow.add_node("confirm", send_confirmation_node)
    workflow.add_node("auto_create", auto_create_job_node)
    workflow.add_node("human_review", human_review_node)
    workflow.add_node("handle_failure", handle_failure_node)
    
    # Set entry point
    workflow.set_entry_point("transcribe")
    
    # Add edges
    # transcribe -> translate (if successful) or handle_failure
    workflow.add_conditional_edges(
        "transcribe",
        lambda state: "translate" if state["status"] != "failed" else "handle_failure",
        {
            "translate": "translate",
            "handle_failure": "handle_failure",
        },
    )
    
    # translate -> extract (always continues, translation errors are non-fatal)
    workflow.add_edge("translate", "extract")
    
    # extract -> route by confidence or handle_failure
    workflow.add_conditional_edges(
        "extract",
        lambda state: route_by_confidence(state) if state["status"] != "failed" else "handle_failure",
        {
            "auto_create": "auto_create",
            "confirm": "confirm",
            "human_review": "human_review",
            "handle_failure": "handle_failure",
        },
    )
    
    # Terminal edges
    workflow.add_edge("auto_create", END)
    workflow.add_edge("confirm", END)  # Confirmation flow continues async
    workflow.add_edge("human_review", END)
    workflow.add_edge("handle_failure", END)
    
    return workflow


# Compile the workflow
voice_workflow = build_voice_workflow().compile()
