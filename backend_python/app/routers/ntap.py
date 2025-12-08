"""
NTAP Router
Handles New Technology Add-on Payment operations
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import (
    calculate_ntap_payment,
    check_ntap_eligibility,
    get_approved_ntap_technologies,
    generate_ntap_application,
    get_available_drgs,
)

router = APIRouter(prefix="/ntap", tags=["NTAP"])


class NtapCalculateRequest(BaseModel):
    """Request model for NTAP calculation"""
    deviceCost: float
    drgCode: Optional[str] = None
    drgPayment: Optional[float] = None


class NtapEligibilityRequest(BaseModel):
    """Request model for NTAP eligibility check"""
    deviceName: str
    manufacturer: Optional[str] = None
    deviceCost: float
    drgCode: Optional[str] = None
    fdaApprovalDate: Optional[str] = None
    fdaApprovalType: Optional[str] = None
    clinicalImprovements: List[str] = []


class NtapApplicationRequest(BaseModel):
    """Request model for NTAP application generation"""
    deviceName: str
    manufacturer: str
    manufacturerAddress: Optional[str] = None
    contactName: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    deviceDescription: Optional[str] = None
    deviceCost: Optional[float] = None
    indicatedProcedures: List[str] = []
    applicableDRGs: List[str] = []
    fdaApprovalDate: Optional[str] = None
    fdaApprovalType: Optional[str] = None
    fdaNumber: Optional[str] = None
    clinicalTrials: List[str] = []
    clinicalImprovements: List[str] = []
    costJustification: Optional[str] = None


@router.post("/calculate")
async def calculate_payment(request: NtapCalculateRequest):
    """
    Calculate NTAP payment
    POST /api/ntap/calculate
    """
    if not request.deviceCost:
        raise HTTPException(status_code=400, detail="Device cost is required")
    
    result = calculate_ntap_payment({
        "deviceCost": request.deviceCost,
        "drgCode": request.drgCode,
        "drgPayment": request.drgPayment,
    })
    
    return result


@router.post("/eligibility")
async def check_eligibility(request: NtapEligibilityRequest):
    """
    Check NTAP eligibility
    POST /api/ntap/eligibility
    """
    if not request.deviceName or not request.deviceCost:
        raise HTTPException(status_code=400, detail="Device name and cost are required")
    
    result = check_ntap_eligibility({
        "deviceName": request.deviceName,
        "manufacturer": request.manufacturer,
        "deviceCost": request.deviceCost,
        "drgCode": request.drgCode,
        "fdaApprovalDate": request.fdaApprovalDate,
        "fdaApprovalType": request.fdaApprovalType,
        "clinicalImprovements": request.clinicalImprovements,
    })
    
    return result


@router.post("/application")
async def generate_application(request: NtapApplicationRequest):
    """
    Generate NTAP application document
    POST /api/ntap/application
    """
    if not request.deviceName or not request.manufacturer:
        raise HTTPException(status_code=400, detail="Device name and manufacturer are required")
    
    document = generate_ntap_application(request.model_dump())
    
    return document


@router.get("/approved-list")
async def get_approved_list():
    """
    Get approved NTAP technologies list
    GET /api/ntap/approved-list
    """
    return get_approved_ntap_technologies()


@router.get("/drgs")
async def get_drgs():
    """
    Get available DRG codes
    GET /api/ntap/drgs
    """
    return {"drgs": get_available_drgs()}

