"""SatQuery AI – /api/health endpoint."""
from datetime import datetime, timezone
from fastapi import APIRouter
from backend.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {
            "pipeline": "ready",
            "ai": "ready" if settings.gemini_api_key else "fallback-mode",
            "storage": "ready",
        },
        "gemini_configured": bool(settings.gemini_api_key),
        "ollama_url": settings.ollama_url,
    }
