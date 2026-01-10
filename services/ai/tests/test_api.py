"""
Tests for API endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


class TestHealthEndpoints:
    """Tests for health check endpoints."""
    
    def test_health_check(self):
        """Health endpoint should return 200."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        assert response.json()["service"] == "campotech-ai"
    
    def test_health_includes_version(self):
        """Health endpoint should include version."""
        response = client.get("/health")
        assert "version" in response.json()


class TestVoiceEndpoints:
    """Tests for voice processing endpoints."""
    
    def test_process_requires_body(self):
        """Process endpoint should require request body."""
        response = client.post("/api/voice/process")
        assert response.status_code == 422  # Validation error
    
    def test_process_validates_required_fields(self):
        """Process endpoint should validate required fields."""
        response = client.post(
            "/api/voice/process",
            json={"message_id": "test"}
        )
        assert response.status_code == 422
        # Should error on missing required fields
