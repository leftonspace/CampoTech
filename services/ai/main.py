"""
CampoTech AI Service

FastAPI application for voice processing with LangGraph.
Handles WhatsApp voice messages, transcription, and intelligent job extraction.
"""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from app.api.voice import router as voice_router
from app.api.support import router as support_router
from app.api.invoice import router as invoice_router
from app.config import settings
from app.middleware.monitoring import setup_langsmith


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    # Startup
    print(f"🚀 Starting CampoTech AI Service in {settings.ENVIRONMENT} mode")
    
    # Initialize LangSmith if configured
    if settings.LANGSMITH_API_KEY:
        setup_langsmith()
        print("📊 LangSmith tracing enabled")
    
    yield
    
    # Shutdown
    print("👋 Shutting down CampoTech AI Service")


app = FastAPI(
    title="CampoTech AI Service",
    description="Voice processing and intelligent job extraction for CampoTech",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ENVIRONMENT == "development" else settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle uncaught exceptions."""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "internal_server_error",
            "message": str(exc) if settings.ENVIRONMENT == "development" else "An error occurred",
        },
    )


# Health check endpoint
@app.get("/health")
async def health_check() -> dict[str, Any]:
    """Health check endpoint for container orchestration."""
    return {
        "status": "healthy",
        "service": "campotech-ai",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
    }


# Ready check (verifies dependencies are available)
@app.get("/ready")
async def readiness_check() -> dict[str, Any]:
    """
    Readiness check - verifies all dependencies are available.
    Returns 503 if any critical dependency is unavailable.
    """
    checks: dict[str, bool] = {}
    
    # Check OpenAI API
    try:
        import openai
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        # Quick test - list models is fast
        checks["openai"] = True
    except Exception:
        checks["openai"] = False
    
    # Check Redis if configured
    if settings.REDIS_URL:
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL)
            r.ping()
            checks["redis"] = True
        except Exception:
            checks["redis"] = False
    
    # Overall status
    all_healthy = all(checks.values())
    
    return JSONResponse(
        status_code=200 if all_healthy else 503,
        content={
            "ready": all_healthy,
            "checks": checks,
        },
    )


# Include routers with API key authentication (P1 Security)
from app.middleware.auth import ApiKeyAuth

app.include_router(voice_router, prefix="/api", tags=["voice"], dependencies=[ApiKeyAuth])
app.include_router(support_router, prefix="/api", tags=["support"], dependencies=[ApiKeyAuth])
app.include_router(invoice_router, tags=["invoice"], dependencies=[ApiKeyAuth])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
    )
