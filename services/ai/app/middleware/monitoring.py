"""
Monitoring middleware for LangSmith integration.

Provides tracing and observability for LangGraph workflows.
"""

import os
from functools import wraps
from typing import Any, Callable, TypeVar

from app.config import settings

T = TypeVar("T")


def setup_langsmith() -> None:
    """Initialize LangSmith tracing."""
    if settings.LANGSMITH_API_KEY:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGSMITH_PROJECT
        print(f"📊 LangSmith configured for project: {settings.LANGSMITH_PROJECT}")


def traceable(
    run_type: str = "chain",
    name: str | None = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator to trace function execution in LangSmith.
    
    Usage:
        @traceable(run_type="workflow", name="voice_processing")
        async def process_voice_workflow(state):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        # Try to import langsmith - gracefully handle if not available
        try:
            from langsmith.run_helpers import traceable as ls_traceable
            return ls_traceable(
                run_type=run_type,
                name=name or func.__name__,
            )(func)
        except ImportError:
            # LangSmith not available - return function unchanged
            @wraps(func)
            async def wrapper(*args: Any, **kwargs: Any) -> T:
                return await func(*args, **kwargs)
            return wrapper
    
    return decorator


class MetricsCollector:
    """
    Collect and report metrics for monitoring.
    
    In production, this would integrate with Prometheus/Grafana or similar.
    """
    
    def __init__(self) -> None:
        self._counters: dict[str, int] = {}
        self._histograms: dict[str, list[float]] = {}
    
    def increment(self, name: str, value: int = 1) -> None:
        """Increment a counter metric."""
        self._counters[name] = self._counters.get(name, 0) + value
    
    def observe(self, name: str, value: float) -> None:
        """Record a histogram observation."""
        if name not in self._histograms:
            self._histograms[name] = []
        self._histograms[name].append(value)
    
    def get_counter(self, name: str) -> int:
        """Get current counter value."""
        return self._counters.get(name, 0)
    
    def get_histogram_stats(self, name: str) -> dict[str, float]:
        """Get histogram statistics."""
        values = self._histograms.get(name, [])
        if not values:
            return {"count": 0, "avg": 0, "min": 0, "max": 0}
        
        return {
            "count": len(values),
            "avg": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
        }
    
    def get_all_metrics(self) -> dict[str, Any]:
        """Get all metrics."""
        return {
            "counters": self._counters,
            "histograms": {
                name: self.get_histogram_stats(name)
                for name in self._histograms
            },
        }


# Global metrics collector
metrics = MetricsCollector()


# Metric names
VOICE_PROCESSING_STARTED = "voice_processing_started"
VOICE_PROCESSING_COMPLETED = "voice_processing_completed"
VOICE_PROCESSING_FAILED = "voice_processing_failed"
VOICE_TRANSCRIPTION_DURATION = "voice_transcription_duration_seconds"
VOICE_EXTRACTION_DURATION = "voice_extraction_duration_seconds"
VOICE_CONFIDENCE_SCORE = "voice_confidence_score"
VOICE_AUTO_CREATED = "voice_auto_created"
VOICE_CONFIRMED = "voice_confirmed"
VOICE_HUMAN_REVIEW = "voice_human_review"
