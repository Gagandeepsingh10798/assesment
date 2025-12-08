"""
Health Router
Handles health check and status endpoints
"""

from fastapi import APIRouter
import time

from app.services import code_service, genai_service

router = APIRouter(prefix="/health", tags=["Health"])

# Track startup time
_start_time = time.time()


@router.get("")
async def get_health():
    """
    Health check endpoint
    GET /api/health
    """
    return {
        "status": "ok",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "uptime": time.time() - _start_time,
        "googleGenAI": genai_service.get_status(),
        "codeService": {
            "isReady": code_service.is_ready(),
            "stats": code_service.get_stats() if code_service.is_ready() else None,
        },
    }

