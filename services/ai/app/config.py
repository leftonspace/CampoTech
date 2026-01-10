"""
CampoTech AI Service - Application Configuration
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    
    # Database
    DATABASE_URL: str = ""
    
    # Redis
    REDIS_URL: str = ""
    
    # LangSmith
    LANGSMITH_API_KEY: str = ""
    LANGSMITH_PROJECT: str = "campotech-ai"
    LANGCHAIN_TRACING_V2: bool = False
    
    # WhatsApp API
    WHATSAPP_API_URL: str = "http://localhost:3000/api/whatsapp"
    WHATSAPP_API_KEY: str = ""
    
    # CampoTech Backend
    CAMPOTECH_API_URL: str = "http://localhost:3000"
    CAMPOTECH_API_KEY: str = ""
    
    # Service config
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Voice processing
    CONFIDENCE_AUTO_CREATE_THRESHOLD: float = 0.85
    CONFIDENCE_CONFIRM_THRESHOLD: float = 0.50
    CONFIRMATION_TIMEOUT_HOURS: int = 2
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
