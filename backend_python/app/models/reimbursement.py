"""
ReimbursementScenario Domain Model
Represents a reimbursement calculation scenario
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from enum import Enum
import re
from app.config import settings


# Site of service definitions
class SiteOfService(str, Enum):
    IPPS = "IPPS"
    HOPD = "HOPD"
    ASC = "ASC"
    OBL = "OBL"


SITES_OF_SERVICE = {
    "IPPS": {"key": "IPPS", "name": "Inpatient (DRG)", "description": "Inpatient Prospective Payment System"},
    "HOPD": {"key": "HOPD", "name": "Hospital Outpatient (OPPS)", "description": "Outpatient Prospective Payment System"},
    "ASC": {"key": "ASC", "name": "Ambulatory Surgical Center", "description": "ASC Payment System"},
    "OBL": {"key": "OBL", "name": "Office-Based Lab", "description": "Physician Fee Schedule (Non-Facility)"},
}


# Site mapping for input normalization
SITE_MAPPING = {
    "IPPS": SITES_OF_SERVICE["IPPS"],
    "INPATIENT": SITES_OF_SERVICE["IPPS"],
    "DRG": SITES_OF_SERVICE["IPPS"],
    "HOPD": SITES_OF_SERVICE["HOPD"],
    "OPPS": SITES_OF_SERVICE["HOPD"],
    "HOSPITAL_OUTPATIENT": SITES_OF_SERVICE["HOPD"],
    "ASC": SITES_OF_SERVICE["ASC"],
    "AMBULATORY": SITES_OF_SERVICE["ASC"],
    "OBL": SITES_OF_SERVICE["OBL"],
    "OFFICE": SITES_OF_SERVICE["OBL"],
    "NONFACILITY": SITES_OF_SERVICE["OBL"],
    "PHYSICIAN": SITES_OF_SERVICE["OBL"],
}


class Classification(str, Enum):
    PROFITABLE = "profitable"
    BREAK_EVEN = "break-even"
    LOSS = "loss"


class ScenarioRequest(BaseModel):
    """Request model for reimbursement scenario"""
    code: str
    siteOfService: str
    deviceCost: float
    ntapAddOn: float = 0


class ReimbursementScenario:
    """ReimbursementScenario model class"""
    
    def __init__(
        self,
        code: str,
        site_of_service: str,
        device_cost: float,
        ntap_add_on: float = 0,
        code_detail: Optional[Dict[str, Any]] = None
    ):
        self.code = code
        self.site_of_service = site_of_service
        self.device_cost = device_cost
        self.ntap_add_on = ntap_add_on
        self.code_detail = code_detail
        
        # Calculated values
        self._site_info = None
        self._results = None
    
    @classmethod
    def from_request(cls, data: Dict[str, Any]) -> "ReimbursementScenario":
        """Create scenario from request data"""
        return cls(
            code=data.get("code", ""),
            site_of_service=data.get("siteOfService", ""),
            device_cost=float(data.get("deviceCost", 0)),
            ntap_add_on=float(data.get("ntapAddOn", 0)),
        )
    
    def _normalize_site(self, site: str) -> Optional[Dict[str, str]]:
        """Normalize site of service input"""
        if not site:
            return None
        key = re.sub(r'[^A-Z]', '', site.upper())
        return SITE_MAPPING.get(key)
    
    @property
    def site_info(self) -> Optional[Dict[str, str]]:
        """Get normalized site info"""
        if self._site_info is None:
            self._site_info = self._normalize_site(self.site_of_service)
        return self._site_info
    
    def validate(self) -> Dict[str, Any]:
        """Validate scenario inputs"""
        errors = []
        
        if not self.code or not isinstance(self.code, str):
            errors.append("Code is required and must be a string")
        
        if not self.site_of_service or not isinstance(self.site_of_service, str):
            errors.append("Site of service is required and must be a string")
        else:
            normalized_site = self._normalize_site(self.site_of_service)
            if not normalized_site:
                valid_sites = ", ".join(SITES_OF_SERVICE.keys())
                errors.append(f"Invalid site of service: {self.site_of_service}. Valid options: {valid_sites}")
        
        if self.device_cost is None:
            errors.append("Device cost is required")
        elif not isinstance(self.device_cost, (int, float)) or self.device_cost < 0:
            errors.append("Device cost must be a non-negative number")
        
        if self.ntap_add_on is not None:
            if not isinstance(self.ntap_add_on, (int, float)) or self.ntap_add_on < 0:
                errors.append("NTAP add-on must be a non-negative number")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
        }
    
    def _classify_margin(self, margin: float, total_payment: float) -> str:
        """Classify margin"""
        if total_payment == 0:
            return Classification.BREAK_EVEN if margin >= 0 else Classification.LOSS
        
        margin_ratio = margin / total_payment
        
        if margin_ratio >= settings.profitable_min_margin:
            return Classification.PROFITABLE
        elif margin_ratio >= settings.break_even_min_margin:
            return Classification.BREAK_EVEN
        else:
            return Classification.LOSS
    
    def calculate(self, code_detail: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate the scenario"""
        self.code_detail = code_detail
        
        if not self.site_info:
            raise ValueError(f"Invalid site of service: {self.site_of_service}")
        
        base_payment = code_detail.get("payments", {}).get(self.site_info["key"], 0)
        add_on_payment = max(0, self.ntap_add_on)
        total_payment = base_payment + add_on_payment
        margin = total_payment - self.device_cost
        classification = self._classify_margin(margin, total_payment)
        
        self._results = {
            "base_payment": base_payment,
            "add_on_payment": add_on_payment,
            "total_payment": total_payment,
            "margin": margin,
            "margin_percentage": ((margin / total_payment) * 100) if total_payment > 0 else 0,
            "classification": classification,
        }
        
        return self._results
    
    def to_response(self) -> Dict[str, Any]:
        """Convert to response format"""
        if not self._results or not self.code_detail:
            raise ValueError("Scenario must be calculated before converting to response")
        
        return {
            "code": self.code_detail.get("code"),
            "description": self.code_detail.get("description"),
            "siteOfService": self.site_info["name"],
            "siteKey": self.site_info["key"],
            "basePayment": self._results["base_payment"],
            "addOnPayment": self._results["add_on_payment"],
            "totalPayment": self._results["total_payment"],
            "deviceCost": self.device_cost,
            "margin": self._results["margin"],
            "marginPercentage": f"{self._results['margin_percentage']:.1f}",
            "classification": self._results["classification"],
            "breakdown": {
                "basePayment": {
                    "label": "Base Payment",
                    "value": self._results["base_payment"],
                    "source": f"{self.code_detail.get('code')} @ {self.site_info['name']}",
                },
                "addOnPayment": {
                    "label": "NTAP Add-On",
                    "value": self._results["add_on_payment"],
                    "source": "New Technology Add-on Payment" if self._results["add_on_payment"] > 0 else "Not applied",
                },
                "totalPayment": {
                    "label": "Total Payment",
                    "value": self._results["total_payment"],
                    "formula": "Base + Add-On",
                },
                "deviceCost": {
                    "label": "Device Cost",
                    "value": self.device_cost,
                    "source": "User provided",
                },
                "margin": {
                    "label": "Margin",
                    "value": self._results["margin"],
                    "formula": "Total Payment - Device Cost",
                },
            },
            "codeDetails": {
                "type": self.code_detail.get("type"),
                "category": self.code_detail.get("category"),
                "allPayments": self.code_detail.get("payments"),
                "apc": self.code_detail.get("optional", {}).get("apc"),
            },
        }
    
    @staticmethod
    def get_valid_sites() -> List[Dict[str, str]]:
        """Get valid sites of service"""
        return list(SITES_OF_SERVICE.values())
    
    @staticmethod
    def get_thresholds() -> Dict[str, Dict[str, str]]:
        """Get classification thresholds"""
        return {
            "profitable": {
                "condition": f"Margin > {settings.profitable_min_margin * 100}% of Total Payment",
                "color": "green",
                "label": "Profitable",
            },
            "break-even": {
                "condition": f"Margin between {settings.break_even_min_margin * 100}% and {settings.profitable_min_margin * 100}%",
                "color": "yellow",
                "label": "Break-Even",
            },
            "loss": {
                "condition": f"Margin < {settings.break_even_min_margin * 100}% of Total Payment",
                "color": "red",
                "label": "Loss",
            },
        }

