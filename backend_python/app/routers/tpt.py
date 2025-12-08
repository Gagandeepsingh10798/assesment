"""
TPT Router
Handles Transitional Pass-Through Payment operations
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import (
    calculate_tpt_payment,
    check_tpt_eligibility,
    get_approved_tpt_technologies,
    generate_tpt_application,
    get_available_apcs,
)

router = APIRouter(prefix="/tpt", tags=["TPT"])


class TptCalculateRequest(BaseModel):
    """Request model for TPT calculation"""
    deviceCost: float
    apcCode: Optional[str] = None
    packagedPayment: Optional[float] = None


class TptEligibilityRequest(BaseModel):
    """Request model for TPT eligibility check"""
    deviceName: str
    manufacturer: Optional[str] = None
    deviceCost: float
    apcCode: Optional[str] = None
    fdaApprovalDate: Optional[str] = None
    fdaApprovalType: Optional[str] = None
    category: str = "device"


class TptApplicationRequest(BaseModel):
    """Request model for TPT application generation"""
    deviceName: str
    manufacturer: str
    manufacturerAddress: Optional[str] = None
    contactName: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    deviceDescription: Optional[str] = None
    deviceCost: Optional[float] = None
    category: str = "device"
    indicatedProcedures: List[str] = []
    applicableAPCs: List[str] = []
    fdaApprovalDate: Optional[str] = None
    fdaApprovalType: Optional[str] = None
    fdaNumber: Optional[str] = None
    hcpcsCode: Optional[str] = None
    clinicalBenefit: Optional[str] = None


@router.post("/calculate")
async def calculate_payment(request: TptCalculateRequest):
    """
    Calculate TPT payment
    POST /api/tpt/calculate
    """
    if not request.deviceCost:
        raise HTTPException(status_code=400, detail="Device cost is required")
    
    result = calculate_tpt_payment({
        "deviceCost": request.deviceCost,
        "apcCode": request.apcCode,
        "packagedPayment": request.packagedPayment,
    })
    
    return result


@router.post("/eligibility")
async def check_eligibility(request: TptEligibilityRequest):
    """
    Check TPT eligibility
    POST /api/tpt/eligibility
    """
    if not request.deviceName or not request.deviceCost:
        raise HTTPException(status_code=400, detail="Device name and cost are required")
    
    result = check_tpt_eligibility({
        "deviceName": request.deviceName,
        "manufacturer": request.manufacturer,
        "deviceCost": request.deviceCost,
        "apcCode": request.apcCode,
        "fdaApprovalDate": request.fdaApprovalDate,
        "fdaApprovalType": request.fdaApprovalType,
        "category": request.category,
    })
    
    return result


@router.post("/application")
async def generate_application(request: TptApplicationRequest):
    """
    Generate TPT application document
    POST /api/tpt/application
    """
    if not request.deviceName or not request.manufacturer:
        raise HTTPException(status_code=400, detail="Device name and manufacturer are required")
    
    document = generate_tpt_application(request.model_dump())
    
    return document


@router.get("/approved-list")
async def get_approved_list():
    """
    Get approved TPT technologies list
    GET /api/tpt/approved-list
    """
    return get_approved_tpt_technologies()


@router.get("/apcs")
async def get_apcs():
    """
    Get available APC codes
    GET /api/tpt/apcs
    """
    return {"apcs": get_available_apcs()}

