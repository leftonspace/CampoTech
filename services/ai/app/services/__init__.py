"""
AI Services Module
==================

Contains reusable services for the AI system.
"""

from app.services.translation import (
    detect_language,
    translate,
    translate_for_customer,
    detect_and_translate,
    LanguageResult,
    TranslationResult,
    SUPPORTED_LANGUAGES,
)

__all__ = [
    "detect_language",
    "translate",
    "translate_for_customer",
    "detect_and_translate",
    "LanguageResult",
    "TranslationResult",
    "SUPPORTED_LANGUAGES",
]
