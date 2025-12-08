"""
Reimbursement Router
Handles reimbursement scenario calculations
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services import code_service
from app.models import ReimbursementScenario

router = APIRouter(prefix="/reimbursement", tags=["Reimbursement"])


class ScenarioRequest(BaseModel):
    """Request model for reimbursement scenario"""
    code: str
    siteOfService: str
    deviceCost: float
    ntapAddOn: float = 0


@router.post("/scenario")
async def calculate_scenario(request: ScenarioRequest):
    """
    Calculate reimbursement scenario
    POST /api/reimbursement/scenario
    """
    scenario = ReimbursementScenario.from_request(request.model_dump())
    
    # Validate inputs
    validation = scenario.validate()
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail={"errors": validation["errors"]})
    
    # Get code details
    code_detail = code_service.get_code(scenario.code)
    if not code_detail:
        raise HTTPException(status_code=404, detail=f"Code not found: {scenario.code}")
    
    # Calculate scenario
    scenario.calculate(code_detail)
    
    return scenario.to_response()


@router.get("/compare/{code}")
async def compare_all_sites(
    code: str,
    deviceCost: float = Query(0),
    ntapAddOn: float = Query(0)
):
    """
    Compare reimbursement across all sites
    GET /api/reimbursement/compare/:code
    """
    code_detail = code_service.get_code(code)
    if not code_detail:
        raise HTTPException(status_code=404, detail=f"Code not found: {code}")
    
    sites = ReimbursementScenario.get_valid_sites()
    comparisons = []
    
    for site in sites:
        scenario = ReimbursementScenario(
            code=code,
            site_of_service=site["key"],
            device_cost=deviceCost,
            ntap_add_on=ntapAddOn,
        )
        
        try:
            scenario.calculate(code_detail)
            result = scenario.to_response()
            comparisons.append({
                "site": result["siteOfService"],
                "siteKey": result["siteKey"],
                "basePayment": result["basePayment"],
                "totalPayment": result["totalPayment"],
                "margin": result["margin"],
                "marginPercentage": result["marginPercentage"],
                "classification": result["classification"],
            })
        except Exception:
            # Skip invalid scenarios
            pass
    
    # Sort by margin (highest first)
    comparisons.sort(key=lambda x: x["margin"], reverse=True)
    
    return {
        "code": code,
        "description": code_detail.get("description"),
        "deviceCost": deviceCost,
        "ntapAddOn": ntapAddOn,
        "comparisons": comparisons,
        "bestSite": comparisons[0] if comparisons else None,
        "worstSite": comparisons[-1] if comparisons else None,
    }


@router.get("/sites")
async def get_valid_sites():
    """
    Get valid sites of service
    GET /api/reimbursement/sites
    """
    return {
        "sites": ReimbursementScenario.get_valid_sites(),
        "thresholds": ReimbursementScenario.get_thresholds(),
    }

