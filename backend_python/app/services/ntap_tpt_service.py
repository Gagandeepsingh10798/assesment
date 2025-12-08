"""
NTAP/TPT Service
Provides calculations, eligibility checking, and document generation for
New Technology Add-on Payment (NTAP) and Transitional Pass-Through (TPT) programs
"""

import json
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime

from app.config import settings


# Data storage
_ntap_data: Optional[Dict[str, Any]] = None
_tpt_data: Optional[Dict[str, Any]] = None


def _get_data_path() -> Path:
    """Get the path to the data directory"""
    current_dir = Path(__file__).parent.parent.parent
    data_dir = current_dir / "data"
    
    # If not found, check the original backend's data directory
    if not data_dir.exists():
        data_dir = current_dir.parent / "backend" / "data"
    
    return data_dir


def _load_data() -> None:
    """Load mock data files"""
    global _ntap_data, _tpt_data
    
    data_path = _get_data_path()
    
    if _ntap_data is None:
        ntap_path = data_path / "ntap_approved.json"
        with open(ntap_path, "r", encoding="utf-8") as f:
            _ntap_data = json.load(f)
    
    if _tpt_data is None:
        tpt_path = data_path / "tpt_approved.json"
        with open(tpt_path, "r", encoding="utf-8") as f:
            _tpt_data = json.load(f)


# ============================================
# NTAP CALCULATIONS
# ============================================

def calculate_ntap_payment(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate NTAP payment for a technology
    Formula: NTAP = min(65% × (device_cost - DRG_payment), max_cap)
    """
    _load_data()
    
    device_cost = params.get("deviceCost")
    drg_code = params.get("drgCode")
    provided_drg_payment = params.get("drgPayment")
    
    # Get DRG base payment from data or use provided value
    drg_payment = provided_drg_payment or _ntap_data.get("drgBasePayments", {}).get(drg_code, 0)
    
    if not device_cost or device_cost <= 0:
        return {
            "error": True,
            "message": "Device cost is required and must be positive",
        }
    
    # NTAP calculation parameters
    ntap_percentage = _ntap_data.get("ntapPercentage", settings.ntap_percentage)
    max_cap = _ntap_data.get("maxNtapCap", settings.ntap_max_cap)
    
    # Calculate the cost difference
    cost_difference = device_cost - drg_payment
    
    # If device cost doesn't exceed DRG payment, no NTAP
    if cost_difference <= 0:
        return {
            "eligible": False,
            "deviceCost": device_cost,
            "drgCode": drg_code,
            "drgPayment": drg_payment,
            "costDifference": cost_difference,
            "ntapPayment": 0,
            "reason": "Device cost does not exceed DRG payment",
        }
    
    # Calculate NTAP payment
    calculated_ntap = cost_difference * ntap_percentage
    ntap_payment = min(calculated_ntap, max_cap)
    
    return {
        "eligible": True,
        "deviceCost": device_cost,
        "drgCode": drg_code,
        "drgPayment": drg_payment,
        "costDifference": cost_difference,
        "ntapPercentage": ntap_percentage * 100,
        "calculatedNtap": round(calculated_ntap),
        "maxCap": max_cap,
        "ntapPayment": round(ntap_payment),
        "totalReimbursement": round(drg_payment + ntap_payment),
        "breakdown": {
            "baseDrgPayment": drg_payment,
            "ntapAddOn": round(ntap_payment),
            "total": round(drg_payment + ntap_payment),
        },
    }


def check_ntap_eligibility(params: Dict[str, Any]) -> Dict[str, Any]:
    """Check NTAP eligibility based on criteria"""
    _load_data()
    
    device_name = params.get("deviceName")
    manufacturer = params.get("manufacturer")
    device_cost = params.get("deviceCost")
    drg_code = params.get("drgCode")
    fda_approval_date = params.get("fdaApprovalDate")
    fda_approval_type = params.get("fdaApprovalType")
    clinical_improvements = params.get("clinicalImprovements", [])
    
    eligibility_criteria = []
    overall_eligible = True
    needs_review = False
    
    # 1. Check FDA approval date (must be within 2-3 years)
    try:
        fda_date = datetime.fromisoformat(fda_approval_date.replace("Z", "+00:00"))
    except:
        fda_date = datetime.now()
    
    now = datetime.now()
    years_old = (now - fda_date.replace(tzinfo=None)).days / 365.25
    
    newness_criteria = {
        "criterion": "Newness",
        "description": "FDA approval within qualifying timeframe (2-3 years)",
        "met": years_old <= 3,
        "details": f"Approved {years_old:.1f} years ago - {'within timeframe' if years_old <= 3 else 'may not qualify as \"new\"'}",
    }
    eligibility_criteria.append(newness_criteria)
    if not newness_criteria["met"]:
        overall_eligible = False
    
    # 2. Check cost threshold
    drg_payment = _ntap_data.get("drgBasePayments", {}).get(drg_code, 0)
    cost_threshold_multiplier = _ntap_data.get("costThresholdMultiplier", settings.ntap_cost_threshold_multiplier)
    cost_threshold = drg_payment * cost_threshold_multiplier
    meets_threshold = device_cost > cost_threshold
    
    cost_criteria = {
        "criterion": "Cost Threshold",
        "description": "Device cost exceeds DRG payment threshold",
        "met": meets_threshold,
        "details": f"Device cost (${device_cost:,.0f}) {'exceeds' if meets_threshold else 'does not exceed'} threshold (${cost_threshold:,.0f})",
    }
    eligibility_criteria.append(cost_criteria)
    if not cost_criteria["met"]:
        overall_eligible = False
    
    # 3. Check not already in DRG weights
    not_in_weights_criteria = {
        "criterion": "Not in Current Weights",
        "description": "Technology not yet reflected in DRG payment weights",
        "met": True,  # Assume true for new technologies
        "details": "Requires CMS verification - assumed not in current weights for new FDA approvals",
    }
    eligibility_criteria.append(not_in_weights_criteria)
    needs_review = True
    
    # 4. Check substantial clinical improvement
    clinical_improvement_categories = [
        "Reduced mortality",
        "Reduced complications",
        "Reduced hospital stay",
        "Improved patient outcomes",
        "Reduced readmissions",
        "Treatment for unmet need",
    ]
    
    valid_improvements = [
        imp for imp in clinical_improvements
        if any(
            cat.lower() in imp.lower() or imp.lower() in cat.lower()
            for cat in clinical_improvement_categories
        )
    ]
    
    clinical_criteria = {
        "criterion": "Substantial Clinical Improvement",
        "description": "Demonstrates meaningful clinical benefit over existing treatments",
        "met": len(valid_improvements) > 0,
        "details": f"Claims: {', '.join(valid_improvements)}" if valid_improvements else "No clinical improvement claims provided - documentation required",
    }
    eligibility_criteria.append(clinical_criteria)
    if not clinical_criteria["met"]:
        needs_review = True
    
    # Calculate potential NTAP payment if eligible
    potential_payment = None
    if overall_eligible or needs_review:
        calculation = calculate_ntap_payment({"deviceCost": device_cost, "drgCode": drg_code})
        if not calculation.get("error"):
            potential_payment = calculation
    
    # Determine overall status
    status = "not_eligible"
    if overall_eligible and not needs_review:
        status = "likely_eligible"
    elif overall_eligible or needs_review:
        status = "needs_review"
    
    return {
        "status": status,
        "statusLabel": "Likely Eligible" if status == "likely_eligible" else "Needs Review" if status == "needs_review" else "Not Eligible",
        "technology": {
            "name": device_name,
            "manufacturer": manufacturer,
            "deviceCost": device_cost,
            "fdaApprovalDate": fda_approval_date,
            "fdaApprovalType": fda_approval_type,
        },
        "eligibilityCriteria": eligibility_criteria,
        "criteriaMetCount": len([c for c in eligibility_criteria if c["met"]]),
        "totalCriteria": len(eligibility_criteria),
        "potentialPayment": potential_payment,
        "recommendations": _generate_ntap_recommendations(eligibility_criteria, status),
    }


def _generate_ntap_recommendations(criteria: List[Dict[str, Any]], status: str) -> List[str]:
    """Generate recommendations based on eligibility criteria"""
    recommendations = []
    
    for c in criteria:
        if not c["met"]:
            if c["criterion"] == "Newness":
                recommendations.append("Consider applying in next fiscal year if technology becomes newly eligible")
            elif c["criterion"] == "Cost Threshold":
                recommendations.append("Review device pricing or identify additional costs that may be included")
            elif c["criterion"] == "Substantial Clinical Improvement":
                recommendations.append("Compile clinical trial data demonstrating improvement over existing treatments")
                recommendations.append("Document specific clinical benefits (mortality, complications, outcomes)")
    
    if status == "likely_eligible":
        recommendations.append("Prepare formal NTAP application for CMS submission")
        recommendations.append("Gather supporting clinical documentation and cost data")
    
    return recommendations


def get_approved_ntap_technologies() -> Dict[str, Any]:
    """Get list of approved NTAP technologies"""
    _load_data()
    return {
        "fiscalYear": _ntap_data.get("fiscalYear"),
        "lastUpdated": _ntap_data.get("lastUpdated"),
        "technologies": _ntap_data.get("technologies"),
        "totalCount": len(_ntap_data.get("technologies", [])),
    }


# ============================================
# TPT CALCULATIONS
# ============================================

def calculate_tpt_payment(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate TPT (Transitional Pass-Through) payment
    Formula: TPT = device_cost - packaged_APC_payment
    """
    _load_data()
    
    device_cost = params.get("deviceCost")
    apc_code = params.get("apcCode")
    provided_packaged_payment = params.get("packagedPayment")
    
    # Get APC base payment from data or use provided value
    apc_payment = provided_packaged_payment or _tpt_data.get("apcBasePayments", {}).get(apc_code, 0)
    
    if not device_cost or device_cost <= 0:
        return {
            "error": True,
            "message": "Device cost is required and must be positive",
        }
    
    # TPT is the difference between device cost and what's packaged in APC
    pass_through_payment = max(0, device_cost - (apc_payment * 0.1))  # Packaged portion is ~10% of APC
    
    return {
        "deviceCost": device_cost,
        "apcCode": apc_code,
        "apcPayment": apc_payment,
        "packagedAmount": round(apc_payment * 0.1),
        "passThroughPayment": round(pass_through_payment),
        "totalReimbursement": round(apc_payment + pass_through_payment),
        "breakdown": {
            "baseApcPayment": apc_payment,
            "devicePassThrough": round(pass_through_payment),
            "total": round(apc_payment + pass_through_payment),
        },
    }


def check_tpt_eligibility(params: Dict[str, Any]) -> Dict[str, Any]:
    """Check TPT eligibility"""
    _load_data()
    
    device_name = params.get("deviceName")
    manufacturer = params.get("manufacturer")
    device_cost = params.get("deviceCost")
    apc_code = params.get("apcCode")
    fda_approval_date = params.get("fdaApprovalDate")
    fda_approval_type = params.get("fdaApprovalType")
    category = params.get("category", "device")
    
    eligibility_criteria = []
    overall_eligible = True
    needs_review = False
    
    # 1. Check FDA approval date (must be recent)
    try:
        fda_date = datetime.fromisoformat(fda_approval_date.replace("Z", "+00:00"))
    except:
        fda_date = datetime.now()
    
    now = datetime.now()
    years_old = (now - fda_date.replace(tzinfo=None)).days / 365.25
    max_duration = _tpt_data.get("maxPassThroughDuration", settings.tpt_max_pass_through_duration)
    
    newness_criteria = {
        "criterion": "Newness",
        "description": f"Recent FDA approval (within {max_duration}-year window)",
        "met": years_old <= max_duration,
        "details": f"Approved {years_old:.1f} years ago - {'within' if years_old <= max_duration else 'exceeds'} {max_duration}-year window",
    }
    eligibility_criteria.append(newness_criteria)
    if not newness_criteria["met"]:
        overall_eligible = False
    
    # 2. Check category validity
    valid_categories = ["device", "drug", "biological"]
    category_criteria = {
        "criterion": "Eligible Category",
        "description": "Must be a device, drug, or biological",
        "met": category.lower() in valid_categories,
        "details": f"Category: {category} - {'Valid' if category.lower() in valid_categories else 'Invalid'}",
    }
    eligibility_criteria.append(category_criteria)
    if not category_criteria["met"]:
        overall_eligible = False
    
    # 3. Check cost significance
    apc_payment = _tpt_data.get("apcBasePayments", {}).get(apc_code, 0)
    cost_significant = apc_payment > 0 and device_cost > (apc_payment * 0.15)
    
    cost_criteria = {
        "criterion": "Cost Significance",
        "description": "Device cost represents significant portion of procedure cost",
        "met": cost_significant,
        "details": f"Device cost (${device_cost:,.0f}) is {((device_cost / apc_payment) * 100):.1f}% of APC payment" if apc_payment > 0 else "APC payment not specified",
    }
    eligibility_criteria.append(cost_criteria)
    if not cost_criteria["met"]:
        needs_review = True
    
    # 4. Check not already packaged
    not_packaged_criteria = {
        "criterion": "Not Packaged",
        "description": "Device/drug not already packaged into APC payment",
        "met": True,  # Assume true for new items
        "details": "Requires CMS verification - assumed not currently packaged for new approvals",
    }
    eligibility_criteria.append(not_packaged_criteria)
    needs_review = True
    
    # Calculate potential payment
    potential_payment = None
    if overall_eligible or needs_review:
        potential_payment = calculate_tpt_payment({"deviceCost": device_cost, "apcCode": apc_code})
    
    status = "not_eligible"
    if overall_eligible and not needs_review:
        status = "likely_eligible"
    elif overall_eligible or needs_review:
        status = "needs_review"
    
    return {
        "status": status,
        "statusLabel": "Likely Eligible" if status == "likely_eligible" else "Needs Review" if status == "needs_review" else "Not Eligible",
        "technology": {
            "name": device_name,
            "manufacturer": manufacturer,
            "deviceCost": device_cost,
            "category": category,
            "fdaApprovalDate": fda_approval_date,
            "fdaApprovalType": fda_approval_type,
        },
        "eligibilityCriteria": eligibility_criteria,
        "criteriaMetCount": len([c for c in eligibility_criteria if c["met"]]),
        "totalCriteria": len(eligibility_criteria),
        "potentialPayment": potential_payment,
        "recommendations": _generate_tpt_recommendations(eligibility_criteria, status),
    }


def _generate_tpt_recommendations(criteria: List[Dict[str, Any]], status: str) -> List[str]:
    """Generate recommendations based on eligibility criteria"""
    recommendations = []
    
    for c in criteria:
        if not c["met"]:
            if c["criterion"] == "Newness":
                recommendations.append("Pass-through status may have expired - verify with CMS")
            elif c["criterion"] == "Cost Significance":
                recommendations.append("Consider if separate payment is warranted given cost relative to APC")
    
    if status in ("likely_eligible", "needs_review"):
        recommendations.append("Prepare HCPCS code application if not already assigned")
        recommendations.append("Submit pass-through application to CMS with supporting cost data")
    
    return recommendations


def get_approved_tpt_technologies() -> Dict[str, Any]:
    """Get list of approved TPT technologies"""
    _load_data()
    return {
        "fiscalYear": _tpt_data.get("fiscalYear"),
        "lastUpdated": _tpt_data.get("lastUpdated"),
        "maxDuration": _tpt_data.get("maxPassThroughDuration", settings.tpt_max_pass_through_duration),
        "technologies": _tpt_data.get("technologies"),
        "totalCount": len(_tpt_data.get("technologies", [])),
    }


# ============================================
# APPLICATION DOCUMENT GENERATION
# ============================================

def generate_ntap_application(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate NTAP application document"""
    device_name = params.get("deviceName")
    manufacturer = params.get("manufacturer")
    manufacturer_address = params.get("manufacturerAddress")
    contact_name = params.get("contactName")
    contact_email = params.get("contactEmail")
    contact_phone = params.get("contactPhone")
    device_description = params.get("deviceDescription")
    device_cost = params.get("deviceCost")
    indicated_procedures = params.get("indicatedProcedures", [])
    applicable_drgs = params.get("applicableDRGs", [])
    fda_approval_date = params.get("fdaApprovalDate")
    fda_approval_type = params.get("fdaApprovalType")
    fda_number = params.get("fdaNumber")
    clinical_trials = params.get("clinicalTrials", [])
    clinical_improvements = params.get("clinicalImprovements", [])
    cost_justification = params.get("costJustification")
    
    application_date = datetime.now().strftime("%Y-%m-%d")
    now = datetime.now()
    fiscal_year = now.year + (1 if now.month >= 7 else 0)
    
    # Calculate potential payment
    drg_code = applicable_drgs[0] if applicable_drgs else None
    payment_calc = calculate_ntap_payment({"deviceCost": device_cost, "drgCode": drg_code}) if drg_code else None
    
    return {
        "documentType": "NTAP Application",
        "generatedDate": application_date,
        "fiscalYear": f"FY{fiscal_year}",
        "status": "DRAFT",
        "sections": {
            "coverPage": {
                "title": "NEW TECHNOLOGY ADD-ON PAYMENT APPLICATION",
                "subtitle": f"Fiscal Year {fiscal_year}",
                "technology": device_name,
                "applicant": manufacturer,
                "submissionDate": application_date,
            },
            "section1_applicantInfo": {
                "title": "Section 1: Applicant Information",
                "fields": {
                    "manufacturerName": manufacturer,
                    "manufacturerAddress": manufacturer_address or "[Address Required]",
                    "contactPerson": contact_name or "[Contact Name Required]",
                    "contactEmail": contact_email or "[Email Required]",
                    "contactPhone": contact_phone or "[Phone Required]",
                },
            },
            "section2_technologyDescription": {
                "title": "Section 2: Technology Description",
                "fields": {
                    "deviceName": device_name,
                    "description": device_description or "[Detailed description required]",
                    "mechanismOfAction": "[Describe how the technology works]",
                    "indicatedUse": "[FDA-approved indications]",
                    "targetPopulation": "[Patient population that would benefit]",
                },
            },
            "section3_regulatoryStatus": {
                "title": "Section 3: Regulatory Status",
                "fields": {
                    "fdaApprovalType": fda_approval_type or "[PMA/510(k)/BLA]",
                    "fdaApprovalNumber": fda_number or "[FDA Number Required]",
                    "fdaApprovalDate": fda_approval_date or "[Date Required]",
                    "labeledIndications": "[List all FDA-approved indications]",
                },
            },
            "section4_costAnalysis": {
                "title": "Section 4: Cost Analysis",
                "fields": {
                    "deviceCost": f"${device_cost:,.0f}" if device_cost else "[Cost Required]",
                    "applicableDRGs": ", ".join(applicable_drgs) or "[DRG codes required]",
                    "currentDRGPayments": f"${payment_calc['drgPayment']:,.0f}" if payment_calc and payment_calc.get("drgPayment") else "[Lookup required]",
                    "costExceedance": f"${payment_calc['costDifference']:,.0f}" if payment_calc and payment_calc.get("costDifference") else "[Calculate]",
                    "proposedNTAP": f"${payment_calc['ntapPayment']:,.0f}" if payment_calc and payment_calc.get("ntapPayment") else "[Calculate]",
                    "costJustification": cost_justification or "[Detailed cost justification required]",
                },
            },
            "section5_clinicalImprovement": {
                "title": "Section 5: Substantial Clinical Improvement",
                "fields": {
                    "improvementClaims": clinical_improvements if clinical_improvements else ["[List clinical improvement claims]"],
                    "supportingTrials": clinical_trials if clinical_trials else ["[List supporting clinical trials]"],
                    "comparatorTechnology": "[Current standard of care]",
                    "improvementMetrics": "[Quantified improvement data]",
                },
            },
        },
        "summary": {
            "totalSections": 5,
            "estimatedPayment": payment_calc.get("ntapPayment") if payment_calc else None,
            "completionStatus": _calculate_completion_status(params),
        },
    }


def generate_tpt_application(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate TPT application document"""
    device_name = params.get("deviceName")
    manufacturer = params.get("manufacturer")
    manufacturer_address = params.get("manufacturerAddress")
    contact_name = params.get("contactName")
    contact_email = params.get("contactEmail")
    contact_phone = params.get("contactPhone")
    device_description = params.get("deviceDescription")
    device_cost = params.get("deviceCost")
    category = params.get("category", "device")
    indicated_procedures = params.get("indicatedProcedures", [])
    applicable_apcs = params.get("applicableAPCs", [])
    fda_approval_date = params.get("fdaApprovalDate")
    fda_approval_type = params.get("fdaApprovalType")
    fda_number = params.get("fdaNumber")
    hcpcs_code = params.get("hcpcsCode")
    clinical_benefit = params.get("clinicalBenefit")
    
    application_date = datetime.now().strftime("%Y-%m-%d")
    calendar_year = datetime.now().year + 1
    
    # Calculate potential payment
    apc_code = applicable_apcs[0] if applicable_apcs else None
    payment_calc = calculate_tpt_payment({"deviceCost": device_cost, "apcCode": apc_code}) if apc_code else None
    
    return {
        "documentType": "TPT Application",
        "generatedDate": application_date,
        "calendarYear": f"CY{calendar_year}",
        "status": "DRAFT",
        "sections": {
            "coverPage": {
                "title": "TRANSITIONAL PASS-THROUGH PAYMENT APPLICATION",
                "subtitle": f"Calendar Year {calendar_year}",
                "technology": device_name,
                "category": category.capitalize(),
                "applicant": manufacturer,
                "submissionDate": application_date,
            },
            "section1_applicantInfo": {
                "title": "Section 1: Applicant Information",
                "fields": {
                    "manufacturerName": manufacturer,
                    "manufacturerAddress": manufacturer_address or "[Address Required]",
                    "contactPerson": contact_name or "[Contact Name Required]",
                    "contactEmail": contact_email or "[Email Required]",
                    "contactPhone": contact_phone or "[Phone Required]",
                },
            },
            "section2_productInfo": {
                "title": "Section 2: Product Information",
                "fields": {
                    "productName": device_name,
                    "category": category,
                    "description": device_description or "[Detailed description required]",
                    "hcpcsCode": hcpcs_code or "[HCPCS code required or pending]",
                    "unitOfService": "[Define unit of service]",
                },
            },
            "section3_costInfo": {
                "title": "Section 3: Cost Information",
                "fields": {
                    "productCost": f"${device_cost:,.0f}" if device_cost else "[Cost Required]",
                    "applicableAPCs": ", ".join(applicable_apcs) or "[APC codes required]",
                    "currentAPCPayment": f"${payment_calc['apcPayment']:,.0f}" if payment_calc and payment_calc.get("apcPayment") else "[Lookup required]",
                    "requestedPassThrough": f"${payment_calc['passThroughPayment']:,.0f}" if payment_calc and payment_calc.get("passThroughPayment") else "[Calculate]",
                },
            },
        },
        "summary": {
            "totalSections": 3,
            "estimatedPayment": payment_calc.get("passThroughPayment") if payment_calc else None,
            "completionStatus": _calculate_completion_status(params),
        },
    }


def _calculate_completion_status(params: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate document completion status"""
    required_fields = ["deviceName", "manufacturer", "deviceCost", "fdaApprovalDate"]
    provided_fields = [f for f in required_fields if params.get(f)]
    percentage = round((len(provided_fields) / len(required_fields)) * 100)
    
    return {
        "percentage": percentage,
        "missingRequired": [f for f in required_fields if not params.get(f)],
        "status": "Complete" if percentage == 100 else "In Progress" if percentage >= 50 else "Incomplete",
    }


# ============================================
# UTILITY FUNCTIONS
# ============================================

def get_available_drgs() -> List[Dict[str, Any]]:
    """Get available DRG codes"""
    _load_data()
    drg_payments = _ntap_data.get("drgBasePayments", {})
    return [
        {"code": code, "payment": payment}
        for code, payment in drg_payments.items()
    ]


def get_available_apcs() -> List[Dict[str, Any]]:
    """Get available APC codes"""
    _load_data()
    apc_payments = _tpt_data.get("apcBasePayments", {})
    return [
        {"code": code, "payment": payment}
        for code, payment in apc_payments.items()
    ]

