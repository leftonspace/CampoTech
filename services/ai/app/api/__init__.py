"""API package for FastAPI routes."""

from app.api.voice import router as voice_router
from app.api.support import router as support_router
from app.api.invoice import router as invoice_router

__all__ = ["voice_router", "support_router", "invoice_router"]
