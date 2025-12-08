"""
FastAPI Application Main Entry Point
Reimbursement Intelligence Module - Python Backend Server
"""

import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings, validate_config
from app.services import code_service, genai_service
from app.routers import (
    health_router,
    codes_router,
    reimbursement_router,
    ntap_router,
    tpt_router,
    files_router,
    upload_router,
    chat_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("=" * 50)
    print("Initializing services...")
    print("=" * 50)
    
    # Validate configuration
    warnings = validate_config()
    if warnings:
        print("Configuration warnings:")
        for w in warnings:
            print(f"  - {w}")
    
    # Initialize code service (load medical codes)
    try:
        await code_service.load_codes()
        print("✓ Code service initialized")
    except Exception as error:
        print(f"✗ Failed to initialize code service: {error}")
    
    # Initialize GenAI service
    try:
        genai_initialized = await genai_service.initialize()
        if genai_initialized:
            print("✓ GenAI service initialized")
        else:
            print("⚠ GenAI service not available (API key not configured)")
    except Exception as error:
        print(f"✗ Failed to initialize GenAI service: {error}")
    
    print("=" * 50)
    
    yield
    
    # Shutdown
    print("Shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Reimbursement Intelligence Module",
    description="Backend API for medical code lookup, reimbursement calculations, and AI chat",
    version=settings.api_version,
    lifespan=lifespan,
)

# ===================
# Middleware
# ===================

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging (development)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log incoming requests in development mode"""
    if settings.env == "development":
        print(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} {request.method} {request.url.path}")
    
    response = await call_next(request)
    return response


# ===================
# Exception Handlers
# ===================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc),
            "path": str(request.url.path),
        }
    )


# ===================
# API Routes
# ===================

# Mount all API routes under /api
app.include_router(health_router, prefix="/api")
app.include_router(codes_router, prefix="/api")
app.include_router(reimbursement_router, prefix="/api")
app.include_router(ntap_router, prefix="/api")
app.include_router(tpt_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Reimbursement Intelligence Module - Python Backend",
        "version": settings.api_version,
        "status": "running",
        "api_base": "/api",
    }


# ===================
# Server Startup
# ===================

def print_startup_banner():
    """Print startup banner"""
    banner = f"""
╔════════════════════════════════════════════════════════════╗
║  Reimbursement Intelligence Module - Python Backend        ║
╠════════════════════════════════════════════════════════════╣
║  Status:      Running                                      ║
║  Port:        {settings.port}                                          ║
║  Environment: {settings.env:<41}║
║  API Base:    /api                                         ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET  /api/health          - Health check                ║
║    GET  /api/codes           - List codes                  ║
║    GET  /api/codes/:code     - Code details                ║
║    GET  /api/codes/search    - Search codes                ║
║    POST /api/reimbursement/scenario - Calculate scenario   ║
║    POST /api/ntap/calculate  - NTAP calculation            ║
║    POST /api/tpt/calculate   - TPT calculation             ║
║    POST /api/chat            - AI chat                     ║
║    GET  /api/files           - List files                  ║
║    POST /api/upload          - Upload file                 ║
╚════════════════════════════════════════════════════════════╝
    """
    print(banner)


if __name__ == "__main__":
    import uvicorn
    
    print_startup_banner()
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.env == "development",
    )

