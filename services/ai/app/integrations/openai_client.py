"""
OpenAI/Whisper integration for transcription and extraction.
"""

import json
from typing import Any

import httpx
import openai
from openai import AsyncOpenAI

from app.config import settings
from app.models.schemas import ConversationMessage, JobExtraction


# Initialize async client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def download_audio(audio_url: str) -> bytes:
    """Download audio file from WhatsApp media URL."""
    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(
            audio_url,
            headers={"Authorization": f"Bearer {settings.WHATSAPP_API_KEY}"},
            timeout=30.0,
        )
        response.raise_for_status()
        return response.content


async def transcribe_audio(audio_data: bytes, language: str = "es") -> str:
    """
    Transcribe audio using OpenAI Whisper API.
    
    Args:
        audio_data: Raw audio bytes
        language: Language code (default Spanish)
        
    Returns:
        Transcribed text
    """
    # Create a file-like object for the API
    # Note: In production, save to temp file with proper cleanup
    response = await client.audio.transcriptions.create(
        model="whisper-1",
        file=("audio.ogg", audio_data, "audio/ogg"),
        language=language,
        response_format="text",
        prompt=(
            "Transcripción de mensaje de voz de cliente en Argentina. "
            "Puede mencionar: electrodomésticos, reparaciones, direcciones, "
            "problemas técnicos, nombres de marcas como Samsung, LG, Philco, etc."
        ),
    )
    
    return response


async def extract_job_data(
    transcription: str,
    conversation_history: list[ConversationMessage],
) -> JobExtraction:
    """
    Extract structured job data from transcription using GPT-4.
    
    Args:
        transcription: Transcribed voice message text
        conversation_history: Previous conversation messages for context
        
    Returns:
        JobExtraction with extracted fields and confidence scores
    """
    # Build conversation context
    history_text = ""
    if conversation_history:
        history_text = "\n".join(
            f"[{msg.role}]: {msg.content}" 
            for msg in conversation_history[-10:]  # Last 10 messages
        )
    
    system_prompt = """Eres un asistente de CampoTech, una plataforma de servicios técnicos en Argentina.
Tu tarea es extraer información estructurada de mensajes de voz de clientes que solicitan servicios.

Extrae los siguientes campos cuando estén disponibles:
- title: Título corto del trabajo (ej: "Reparación de lavarropas")
- description: Descripción detallada del problema
- service_type: Tipo de servicio (refrigeracion, lavarropas, aire_acondicionado, electricidad, plomeria, gasista, cerrajeria, otros)
- address: Dirección completa
- city: Ciudad
- province: Provincia (Buenos Aires, Córdoba, Santa Fe, etc.)
- preferred_date: Fecha preferida (formato YYYY-MM-DD o texto como "mañana", "próxima semana")
- preferred_time: Horario preferido (mañana, tarde, noche, o rango horario)
- urgency: Nivel de urgencia (normal, urgente, emergencia)
- customer_name: Nombre del cliente
- appliance_brand: Marca del electrodoméstico
- appliance_model: Modelo del electrodoméstico
- problem_description: Descripción del problema técnico

Para cada campo extraído, asigna un nivel de confianza (0.0 a 1.0):
- 1.0: El cliente mencionó esto explícitamente
- 0.7-0.9: Se puede inferir con alta probabilidad
- 0.4-0.6: Se puede inferir pero con incertidumbre
- 0.0-0.3: Muy especulativo

Responde SOLO con JSON válido."""

    user_prompt = f"""Historial de conversación:
{history_text if history_text else "(Sin historial previo)"}

Nuevo mensaje de voz transcrito:
"{transcription}"

Extrae la información del trabajo en formato JSON con los campos especificados.
Incluye un diccionario "field_confidences" con la confianza de cada campo.
Incluye "overall_confidence" como promedio ponderado de las confianzas."""

    response = await client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=1000,
    )
    
    # Parse response
    try:
        result = json.loads(response.choices[0].message.content or "{}")
        
        # Build JobExtraction from response
        extraction = JobExtraction(
            title=result.get("title"),
            description=result.get("description"),
            service_type=result.get("service_type"),
            address=result.get("address"),
            city=result.get("city"),
            province=result.get("province"),
            preferred_date=result.get("preferred_date"),
            preferred_time=result.get("preferred_time"),
            urgency=result.get("urgency", "normal"),
            customer_name=result.get("customer_name"),
            appliance_brand=result.get("appliance_brand"),
            appliance_model=result.get("appliance_model"),
            problem_description=result.get("problem_description"),
            field_confidences=result.get("field_confidences", {}),
            overall_confidence=result.get("overall_confidence", 0.5),
        )
        
        return extraction
        
    except json.JSONDecodeError:
        # Return low-confidence extraction if parsing fails
        return JobExtraction(
            description=transcription,
            overall_confidence=0.3,
        )


def format_confirmation_message(extraction: JobExtraction) -> str:
    """
    Format a confirmation message to send to the customer.
    
    Args:
        extraction: Extracted job data
        
    Returns:
        Formatted WhatsApp message
    """
    parts = ["📝 *Resumen de tu pedido:*\n"]
    
    if extraction.title:
        parts.append(f"✅ *Servicio:* {extraction.title}")
    
    if extraction.service_type:
        service_names = {
            "refrigeracion": "Refrigeración",
            "lavarropas": "Lavarropas",
            "aire_acondicionado": "Aire Acondicionado",
            "electricidad": "Electricidad",
            "plomeria": "Plomería",
            "gasista": "Gasista",
            "cerrajeria": "Cerrajería",
            "otros": "Otros",
        }
        parts.append(f"🔧 *Tipo:* {service_names.get(extraction.service_type, extraction.service_type)}")
    
    if extraction.appliance_brand:
        brand_info = extraction.appliance_brand
        if extraction.appliance_model:
            brand_info += f" {extraction.appliance_model}"
        parts.append(f"📱 *Equipo:* {brand_info}")
    
    if extraction.problem_description:
        parts.append(f"❌ *Problema:* {extraction.problem_description}")
    
    if extraction.address:
        addr = extraction.address
        if extraction.city:
            addr += f", {extraction.city}"
        if extraction.province:
            addr += f" ({extraction.province})"
        parts.append(f"📍 *Dirección:* {addr}")
    
    if extraction.preferred_date or extraction.preferred_time:
        when = []
        if extraction.preferred_date:
            when.append(extraction.preferred_date)
        if extraction.preferred_time:
            when.append(extraction.preferred_time)
        parts.append(f"📅 *Cuándo:* {' - '.join(when)}")
    
    if extraction.urgency and extraction.urgency != "normal":
        urgency_emoji = "🔴" if extraction.urgency == "emergencia" else "🟡"
        parts.append(f"{urgency_emoji} *Urgencia:* {extraction.urgency.capitalize()}")
    
    parts.append("\n¿Es correcto? Respondé *Sí* para confirmar o contame qué debemos corregir.")
    
    return "\n".join(parts)
