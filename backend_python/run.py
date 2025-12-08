#!/usr/bin/env python3
"""
Server Entry Point
Run the FastAPI application
"""

import uvicorn
from app.config import settings


def main():
    """Start the server"""
    banner = f"""
╔════════════════════════════════════════════════════════════╗
║  Reimbursement Intelligence Module - Python Backend        ║
╠════════════════════════════════════════════════════════════╣
║  Status:      Starting...                                  ║
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
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.env == "development",
    )


if __name__ == "__main__":
    main()

