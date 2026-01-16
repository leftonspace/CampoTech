"""
Translation Service
==================

Phase 5.2: Translation Core

Provides language detection and translation capabilities using GPT-4.
Optimized for Argentine Spanish with dialect-aware translations.

Features:
- Language detection with confidence scoring
- Translation with Argentine Spanish dialect awareness
- Support for technical terms and brand names preservation
"""

from typing import Optional
from pydantic import BaseModel
from app.integrations.openai_client import client


class LanguageResult(BaseModel):
    """Result of language detection."""
    code: str           # ISO 639-1 code: "en", "pt", "fr", etc.
    name: str           # Full name: "English", "Portuguese"
    confidence: float   # 0.0 - 1.0


class TranslationResult(BaseModel):
    """Result of translation."""
    text: str
    source_language: str
    target_language: str


# Common languages expected for CampoTech's international customers
SUPPORTED_LANGUAGES = {
    "es": "Español",
    "en": "English",
    "pt": "Português",
    "fr": "Français",
    "it": "Italiano",
    "de": "Deutsch",
    "zh": "中文",
    "ja": "日本語",
    "ko": "한국어",
    "ru": "Русский",
    "ar": "العربية",
    "he": "עברית",
}


async def detect_language(text: str) -> LanguageResult:
    """
    Detect the language of the given text using GPT-4o-mini.
    
    Args:
        text: The text to analyze
        
    Returns:
        LanguageResult with language code, name, and confidence
    """
    if not text or len(text.strip()) < 3:
        # Default to Spanish for very short or empty texts
        return LanguageResult(code="es", name="Español", confidence=0.5)
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are a language detection system. Analyze the text and return JSON with:
- "code": ISO 639-1 language code (e.g., "en", "es", "pt")
- "name": Full language name in that language (e.g., "English", "Español", "Português")
- "confidence": Your confidence level from 0.0 to 1.0

Be aware of:
- Mixed language messages (return the primary language)
- Argentine Spanish variations (still return "es")
- Short messages may have lower confidence
- Technical terms in English within other languages

Return only valid JSON, no additional text."""
                },
                {"role": "user", "content": text}
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=100,
        )
        
        result = LanguageResult.model_validate_json(
            response.choices[0].message.content or '{"code": "es", "name": "Español", "confidence": 0.5}'
        )
        return result
        
    except Exception as e:
        print(f"Language detection error: {e}")
        # Default to Spanish on error
        return LanguageResult(code="es", name="Español", confidence=0.5)


async def translate(
    text: str,
    source_lang: str,
    target_lang: str = "es",
) -> str:
    """
    Translate text between languages with Argentine Spanish awareness.
    
    Args:
        text: The text to translate
        source_lang: Source language ISO code
        target_lang: Target language ISO code (default: "es" for Spanish)
        
    Returns:
        Translated text
    """
    if not text or source_lang == target_lang:
        return text
    
    # Get language names for context
    source_name = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
    target_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
    
    # Argentine Spanish specific instructions
    spanish_instructions = ""
    if target_lang == "es":
        spanish_instructions = """
When translating TO Spanish, use Argentine dialect:
- Use "vos" instead of "tú" (e.g., "vos querés" not "tú quieres")
- Use "che" and other Rioplatense expressions naturally
- Use "bacha" not "lavabo", "canilla" not "grifo", "pileta" not "piscina"
- Use "heladera" not "refrigerador", "frazada" not "manta"
- Use local HVAC terminology (aire acondicionado split, etc.)
"""
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a professional translator for a field service company in Argentina.
Translate the following message from {source_name} to {target_name}.
{spanish_instructions}
Rules:
- Preserve technical terms, brand names, and model numbers
- Keep proper nouns unchanged
- Maintain the tone and formality of the original
- For addresses and phone numbers, keep the original format
- Return ONLY the translation, no explanations or notes"""
                },
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            max_tokens=1000,
        )
        
        return response.choices[0].message.content or text
        
    except Exception as e:
        print(f"Translation error: {e}")
        return text  # Return original on error


async def translate_for_customer(
    text: str,
    customer_language: str,
) -> str:
    """
    Translate a Spanish response for sending to a customer in their language.
    
    Args:
        text: Spanish text to translate
        customer_language: Customer's language ISO code
        
    Returns:
        Translated text for the customer
    """
    if customer_language == "es":
        return text
        
    return await translate(text, source_lang="es", target_lang=customer_language)


async def detect_and_translate(
    text: str,
    business_languages: list[str],
) -> tuple[str, LanguageResult, str | None]:
    """
    Detect language and translate if needed.
    
    Args:
        text: The text to analyze and potentially translate
        business_languages: Languages the business team speaks
        
    Returns:
        Tuple of (final_text, language_result, translated_text_or_none)
    """
    # Detect the language
    lang_result = await detect_language(text)
    
    # If the language is one the business speaks, no translation needed
    if lang_result.code in business_languages:
        return text, lang_result, None
    
    # Translate to Spanish
    translated = await translate(text, source_lang=lang_result.code, target_lang="es")
    
    return translated, lang_result, translated
