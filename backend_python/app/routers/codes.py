"""
Code Router
Handles medical code lookup and search operations
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.services import code_service

router = APIRouter(prefix="/codes", tags=["Codes"])


@router.get("")
async def get_codes(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    type: Optional[str] = None,
    sortBy: str = Query("code"),
    sortOrder: str = Query("asc", pattern="^(asc|desc)$")
):
    """
    Get all codes with pagination and filtering
    GET /api/codes
    """
    result = code_service.get_all_codes(
        limit=limit,
        offset=offset,
        code_type=type,
        sort_by=sortBy,
        sort_order=sortOrder,
    )
    
    return {
        "data": result["codes"],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
        "page": (result["offset"] // result["limit"]) + 1,
        "totalPages": (result["total"] + result["limit"] - 1) // result["limit"],
        "hasMore": result["hasMore"],
    }


@router.get("/search")
async def search_codes(
    q: str = Query("", description="Search query"),
    limit: int = Query(50, ge=1, le=500),
    type: Optional[str] = None
):
    """
    Search codes by query
    GET /api/codes/search
    """
    if not q or len(q.strip()) < 2:
        return {
            "data": [],
            "total": 0,
            "query": q or "",
            "message": "Query must be at least 2 characters",
        }
    
    result = code_service.search_codes(
        query=q,
        limit=limit,
        code_type=type,
    )
    
    return {
        "data": result["codes"],
        "total": result["total"],
        "query": result["query"],
    }


@router.get("/stats")
async def get_code_stats():
    """
    Get code statistics
    GET /api/codes/stats
    """
    return code_service.get_stats()


@router.get("/{code}")
async def get_code_by_code(code: str):
    """
    Get single code by code string
    GET /api/codes/:code
    """
    code_detail = code_service.get_code(code)
    
    if not code_detail:
        raise HTTPException(status_code=404, detail=f"Code not found: {code}")
    
    return code_detail

