# =============================================================================
# PHASE 6: VOICE-TO-INVOICE AI
# =============================================================================
#
# Invoice Extraction Service
#
# This service:
# 1. Takes a voice memo transcription
# 2. Extracts parts, services, and labor from technician reports
# 3. Matches extracted items to the organization's pricebook
# 4. Generates a draft invoice suggestion for review
# =============================================================================

import json
import os
import re
import time
from datetime import datetime
from decimal import Decimal
from typing import Optional, Sequence

import httpx
from openai import OpenAI

from app.models.invoice_extraction import (
    ExtractedPart,
    ExtractedService,
    InvoiceSuggestion,
    MatchedLineItem,
    TechnicianReportExtraction,
)


# =============================================================================
# CONFIGURATION
# =============================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
CAMPOTECH_API_URL = os.getenv("CAMPOTECH_API_URL", "http://localhost:3000")
CAMPOTECH_API_KEY = os.getenv("CAMPOTECH_SERVICE_KEY", "")

# Confidence thresholds
HIGH_CONFIDENCE_THRESHOLD = 0.85
MEDIUM_CONFIDENCE_THRESHOLD = 0.70
LOW_CONFIDENCE_THRESHOLD = 0.50


# =============================================================================
# EXTRACTION PROMPT
# =============================================================================

EXTRACTION_SYSTEM_PROMPT = """Eres un sistema experto en extraer información de reportes de trabajo de técnicos en Argentina.

Tu tarea es analizar la transcripción de un reporte de voz de un técnico y extraer la información estructurada.

## Contexto
- Los técnicos de CampoTech reportan trabajo completado mediante notas de voz
- Mencionan: partes usadas, materiales, servicios realizados, tiempo trabajado
- Hablan en español argentino informal
- Pueden mencionar marcas, modelos, cantidades, precios

## Reglas de Extracción

### Partes/Materiales
- Extrae TODAS las partes y materiales mencionados
- Incluye cantidades ("dos caños", "3 metros de cable" → quantity: 3, unit: "metro")
- Unidades comunes: unidad, metro, kg, litro, rollo, caja
- Si no se menciona cantidad, asume 1

### Servicios/Mano de Obra
- Identifica todos los servicios realizados
- Tipos: diagnostico, reparacion, instalacion, mantenimiento, limpieza, calibracion
- Si menciona duración, extráela ("estuve 2 horas" → duration_minutes: 120)

### Tiempo
- arrival_time: hora de llegada si se menciona
- departure_time: hora de salida si se menciona
- total_labor_hours: tiempo total trabajado

### Estado Final
- equipment_status: funcionando, requiere_seguimiento, no_reparable
- follow_up_required: true si menciona volver o revisar después

## Formato de Salida
Responde SOLO con JSON válido siguiendo el schema proporcionado."""


EXTRACTION_USER_PROMPT = """Analiza este reporte de voz de un técnico y extrae la información:

TRANSCRIPCIÓN:
{transcription}

CONTEXTO DEL TRABAJO:
- Tipo de servicio: {service_type}
- Equipo: {equipment_info}

Extrae:
1. Resumen del trabajo (job_summary)
2. Trabajo realizado detallado (work_performed)
3. Lista de partes/materiales usados (parts_used) con cantidades
4. Lista de servicios realizados (services_performed)
5. Tiempo trabajado si se menciona
6. Estado final del equipo (equipment_status)
7. Si requiere seguimiento (follow_up_required)
8. Si menciona fotos o firma

Responde en JSON siguiendo este schema exacto:
{schema}"""


# =============================================================================
# PRICEBOOK MATCHING
# =============================================================================

async def fetch_pricebook(organization_id: str) -> Sequence[dict]:
    """Fetch the organization's pricebook from CampoTech API."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{CAMPOTECH_API_URL}/api/settings/pricebook",
                headers={
                    "x-organization-id": organization_id,
                    "x-service-key": CAMPOTECH_API_KEY,
                },
                timeout=10.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("items", [])
            
            return []
    except Exception as e:
        print(f"Error fetching pricebook: {e}")
        return []


def calculate_match_score(extracted_name: str, catalog_name: str) -> float:
    """
    Calculate similarity score between extracted item and catalog item.
    Uses simple token matching - can be enhanced with embeddings later.
    """
    # Normalize both strings
    def normalize(s: str) -> set[str]:
        s = s.lower()
        s = re.sub(r'[^\w\s]', '', s)
        tokens = s.split()
        # Remove common stopwords
        stopwords = {'de', 'la', 'el', 'un', 'una', 'para', 'con', 'por', 'y', 'en'}
        return {t for t in tokens if t not in stopwords and len(t) > 2}
    
    extracted_tokens = normalize(extracted_name)
    catalog_tokens = normalize(catalog_name)
    
    if not extracted_tokens or not catalog_tokens:
        return 0.0
    
    # Jaccard similarity
    intersection = len(extracted_tokens & catalog_tokens)
    union = len(extracted_tokens | catalog_tokens)
    
    return intersection / union if union > 0 else 0.0


def match_to_pricebook(
    extracted_name: str,
    extracted_unit: str,
    pricebook: Sequence[dict],
    item_type: str = "any"
) -> tuple[Optional[dict], float, list[dict]]:
    """
    Match an extracted item to the pricebook.
    
    Returns:
    - best_match: Best matching PriceItem or None
    - confidence: Match confidence score
    - alternatives: List of alternative matches with scores
    """
    if not pricebook:
        return None, 0.0, []
    
    # Filter by type if specified
    if item_type == "part":
        candidates = [p for p in pricebook if p.get("type") == "PRODUCT"]
    elif item_type == "service":
        candidates = [p for p in pricebook if p.get("type") == "SERVICE"]
    else:
        candidates = pricebook
    
    if not candidates:
        candidates = pricebook
    
    # Score all candidates
    scored = []
    for item in candidates:
        name = item.get("name", "")
        description = item.get("description", "")
        
        # Calculate score considering both name and description
        name_score = calculate_match_score(extracted_name, name)
        desc_score = calculate_match_score(extracted_name, description) * 0.7
        
        # Bonus for unit match
        unit_bonus = 0.1 if item.get("unit", "").lower() == extracted_unit.lower() else 0
        
        total_score = min(1.0, max(name_score, desc_score) + unit_bonus)
        
        if total_score > 0.2:
            scored.append({
                "id": item.get("id"),
                "name": name,
                "price": item.get("price"),
                "unit": item.get("unit"),
                "type": item.get("type"),
                "score": total_score,
            })
    
    # Sort by score
    scored.sort(key=lambda x: x["score"], reverse=True)
    
    best_match = scored[0] if scored else None
    best_confidence = best_match["score"] if best_match else 0.0
    alternatives = scored[1:4] if len(scored) > 1 else []  # Top 3 alternatives
    
    return best_match, best_confidence, alternatives


# =============================================================================
# MAIN EXTRACTION SERVICE
# =============================================================================

async def extract_invoice_data(
    transcription: str,
    organization_id: str,
    job_id: str,
    service_type: Optional[str] = None,
    equipment_info: Optional[str] = None,
) -> InvoiceSuggestion:
    """
    Main entry point for voice-to-invoice extraction.
    
    1. Extracts structured data from transcription using GPT-4
    2. Fetches organization's pricebook
    3. Matches extracted items to pricebook
    4. Generates invoice suggestion with calculated totals
    """
    start_time = time.time()
    
    # Initialize OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    # Define the expected schema
    schema = {
        "job_summary": "string - brief summary",
        "work_performed": "string - detailed work description",
        "parts_used": [
            {
                "name": "string - part name",
                "quantity": "number - how many",
                "unit": "string - unidad, metro, kg, etc.",
                "source_text": "string - original text mentioning this"
            }
        ],
        "services_performed": [
            {
                "description": "string - what was done",
                "duration_minutes": "number or null",
                "service_type": "string - diagnostico, reparacion, instalacion, etc.",
                "source_text": "string"
            }
        ],
        "arrival_time": "string or null - e.g. '9:30'",
        "departure_time": "string or null",
        "total_labor_hours": "number or null",
        "equipment_status": "string - funcionando, requiere_seguimiento, no_reparable",
        "recommendations": "string or null",
        "follow_up_required": "boolean",
        "follow_up_notes": "string or null",
        "photos_mentioned": "boolean",
        "signature_obtained": "boolean"
    }
    
    # Call GPT-4 for extraction
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": EXTRACTION_USER_PROMPT.format(
                    transcription=transcription,
                    service_type=service_type or "No especificado",
                    equipment_info=equipment_info or "No especificado",
                    schema=json.dumps(schema, ensure_ascii=False, indent=2),
                )}
            ],
            temperature=0.1,
            max_tokens=2000,
        )
        
        extracted_json = json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Extraction error: {e}")
        extracted_json = {}
    
    # Parse into our models
    parts = [
        ExtractedPart(
            name=p.get("name", ""),
            quantity=float(p.get("quantity", 1)),
            unit=p.get("unit", "unidad"),
            source_text=p.get("source_text", ""),
            confidence=0.8,  # GPT extraction confidence
        )
        for p in extracted_json.get("parts_used", [])
    ]
    
    services = [
        ExtractedService(
            description=s.get("description", ""),
            duration_minutes=s.get("duration_minutes"),
            service_type=s.get("service_type"),
            source_text=s.get("source_text", ""),
            confidence=0.8,
        )
        for s in extracted_json.get("services_performed", [])
    ]
    
    extraction = TechnicianReportExtraction(
        job_summary=extracted_json.get("job_summary"),
        work_performed=extracted_json.get("work_performed"),
        parts_used=parts,
        services_performed=services,
        arrival_time=extracted_json.get("arrival_time"),
        departure_time=extracted_json.get("departure_time"),
        total_labor_hours=extracted_json.get("total_labor_hours"),
        equipment_status=extracted_json.get("equipment_status"),
        recommendations=extracted_json.get("recommendations"),
        follow_up_required=extracted_json.get("follow_up_required", False),
        follow_up_notes=extracted_json.get("follow_up_notes"),
        photos_mentioned=extracted_json.get("photos_mentioned", False),
        signature_obtained=extracted_json.get("signature_obtained", False),
        overall_confidence=0.8,
    )
    
    # Fetch pricebook and match items
    pricebook = await fetch_pricebook(organization_id)
    
    line_items: list[MatchedLineItem] = []
    review_notes: list[str] = []
    
    # Match parts to pricebook
    for part in parts:
        match, confidence, alternatives = match_to_pricebook(
            part.name, part.unit, pricebook, item_type="part"
        )
        
        if match and confidence >= HIGH_CONFIDENCE_THRESHOLD:
            # High confidence match
            unit_price = Decimal(str(match.get("price", 0)))
            total = unit_price * Decimal(str(part.quantity))
            
            line_items.append(MatchedLineItem(
                description=match["name"],
                quantity=part.quantity,
                unit=match.get("unit", part.unit),
                unit_price=unit_price,
                total=total,
                source_type="part",
                source_text=part.source_text,
                matched_price_item_id=match["id"],
                matched_price_item_name=match["name"],
                match_confidence=confidence,
                alternative_matches=alternatives,
                needs_review=False,
            ))
        elif match and confidence >= MEDIUM_CONFIDENCE_THRESHOLD:
            # Medium confidence - needs review
            unit_price = Decimal(str(match.get("price", 0)))
            total = unit_price * Decimal(str(part.quantity))
            
            line_items.append(MatchedLineItem(
                description=match["name"],
                quantity=part.quantity,
                unit=match.get("unit", part.unit),
                unit_price=unit_price,
                total=total,
                source_type="part",
                source_text=part.source_text,
                matched_price_item_id=match["id"],
                matched_price_item_name=match["name"],
                match_confidence=confidence,
                alternative_matches=alternatives,
                needs_review=True,
                review_reason=f"Coincidencia media ({int(confidence*100)}%): '{part.name}' → '{match['name']}'",
            ))
            review_notes.append(f"Revisar: '{part.name}' coincide parcialmente con '{match['name']}'")
        else:
            # Low/no confidence - custom item, needs pricing
            line_items.append(MatchedLineItem(
                description=part.name,
                quantity=part.quantity,
                unit=part.unit,
                unit_price=None,
                total=None,
                source_type="part",
                source_text=part.source_text,
                matched_price_item_id=None,
                matched_price_item_name=None,
                match_confidence=confidence if match else 0.0,
                alternative_matches=alternatives,
                needs_review=True,
                review_reason=f"Parte no encontrada en catálogo: '{part.name}'",
            ))
            review_notes.append(f"Agregá precio para: '{part.name}'")
    
    # Match services to pricebook
    for service in services:
        match, confidence, alternatives = match_to_pricebook(
            service.description, "hora", pricebook, item_type="service"
        )
        
        # Calculate hours from duration
        hours = service.duration_minutes / 60 if service.duration_minutes else 1.0
        
        if match and confidence >= MEDIUM_CONFIDENCE_THRESHOLD:
            unit_price = Decimal(str(match.get("price", 0)))
            total = unit_price * Decimal(str(hours))
            
            line_items.append(MatchedLineItem(
                description=match["name"],
                quantity=hours,
                unit=match.get("unit", "hora"),
                unit_price=unit_price,
                total=total,
                source_type="service",
                source_text=service.source_text,
                matched_price_item_id=match["id"],
                matched_price_item_name=match["name"],
                match_confidence=confidence,
                alternative_matches=alternatives,
                needs_review=confidence < HIGH_CONFIDENCE_THRESHOLD,
                review_reason=f"Servicio: '{service.description}'" if confidence < HIGH_CONFIDENCE_THRESHOLD else None,
            ))
        else:
            # Custom service
            line_items.append(MatchedLineItem(
                description=service.description,
                quantity=hours,
                unit="hora",
                unit_price=None,
                total=None,
                source_type="service",
                source_text=service.source_text,
                matched_price_item_id=None,
                matched_price_item_name=None,
                match_confidence=0.0,
                alternative_matches=alternatives,
                needs_review=True,
                review_reason=f"Servicio no encontrado: '{service.description}'",
            ))
            review_notes.append(f"Agregá precio para servicio: '{service.description}'")
    
    # Calculate totals (only for priced items)
    subtotal = sum(
        item.total for item in line_items 
        if item.total is not None
    )
    tax_rate = Decimal("21.0") / Decimal("100")
    tax_amount = subtotal * tax_rate
    total = subtotal + tax_amount
    
    # Calculate overall confidence
    priced_items = [i for i in line_items if i.unit_price is not None]
    overall_confidence = (
        sum(i.match_confidence for i in priced_items) / len(priced_items)
        if priced_items else 0.0
    )
    
    processing_time = int((time.time() - start_time) * 1000)
    
    return InvoiceSuggestion(
        job_id=job_id,
        organization_id=organization_id,
        line_items=line_items,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        extraction=extraction,
        transcription=transcription,
        processing_duration_ms=processing_time,
        generated_at=datetime.now().isoformat(),
        requires_review=any(item.needs_review for item in line_items),
        review_notes=review_notes,
        overall_match_confidence=overall_confidence,
    )
