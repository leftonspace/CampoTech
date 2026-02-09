"""
Authentication Middleware for CampoTech AI Service

Phase 8 Security Remediation: P1
Provides API key authentication for all AI service endpoints.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.config import settings


async def verify_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None
) -> bool:
    """
    Verify the API key from request headers.
    
    Requires X-API-Key header to match CAMPOTECH_API_KEY environment variable.
    Returns True if valid, raises HTTPException if invalid or missing.
    """
    if not settings.CAMPOTECH_API_KEY:
        # If no API key is configured, allow requests (development mode)
        if settings.ENVIRONMENT == "development":
            return True
        # In production, block if no key is configured
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API key not configured on server",
        )
    
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    if x_api_key != settings.CAMPOTECH_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    return True


# Dependency for routes
ApiKeyAuth = Depends(verify_api_key)


async def verify_optional_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None
) -> bool:
    """
    Optional API key verification - used for endpoints that may be 
    accessed internally during development.
    """
    if settings.ENVIRONMENT == "development":
        return True
    
    return await verify_api_key(x_api_key)


OptionalApiKeyAuth = Depends(verify_optional_api_key)
