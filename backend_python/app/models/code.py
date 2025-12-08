"""
Code Domain Model
Represents a medical procedure code (CPT, HCPCS, ICD-10)
"""

from typing import Optional, Dict, List, Any
from pydantic import BaseModel
from app.config import settings


# APC Payment Rate lookup (approximate 2025 values)
APC_RATES = {
    5193: 11639,
    5054: 2850,
    5055: 4200,
    5056: 6500,
    5183: 8500,
    5192: 9200,
    5194: 14500,
}


class CodeMetadata(BaseModel):
    """Code metadata model"""
    apc: Optional[str] = None
    si: Optional[str] = None
    rank: Optional[int] = None
    facility_rvu: Optional[float] = None
    nonfacility_rvu: Optional[float] = None
    mue_unit: Optional[str] = None
    modifiers: List[str] = []
    effective_date: Optional[str] = None
    guidelines: Optional[str] = None
    drg: Optional[str] = None


class CodePayments(BaseModel):
    """Code payments by site of service"""
    IPPS: float = 0
    HOPD: float = 0
    ASC: float = 0
    OBL: float = 0


class CodeSummary(BaseModel):
    """Code summary for listings"""
    code: str
    description: str
    category: str
    type: str
    labels: List[str] = []


class CodeDetail(BaseModel):
    """Code detail for single code view"""
    code: str
    description: str
    category: str
    type: str
    labels: List[str] = []
    payments: CodePayments
    optional: Dict[str, Any] = {}
    raw_metadata: Optional[Dict[str, Any]] = None


class Code:
    """Code model class"""
    
    def __init__(self, data: Dict[str, Any]):
        self.code = data.get("code", "")
        self.description = data.get("description", "")
        self.type = data.get("type", "")
        self.labels = data.get("labels", [])
        self.metadata = data.get("metadata", {})
    
    @classmethod
    def from_raw(cls, raw_data: Dict[str, Any]) -> "Code":
        """Create Code instance from raw data"""
        if not raw_data or not raw_data.get("code"):
            raise ValueError("Invalid code data: code is required")
        return cls(raw_data)
    
    @property
    def normalized_type(self) -> str:
        """Normalize code type"""
        if not self.type:
            return "OTHER"
        upper_type = self.type.upper()
        if upper_type == "DX":
            return "ICD10"
        if upper_type == "PCS":
            return "ICD10-PCS"
        return upper_type
    
    @property
    def category(self) -> str:
        """Get category based on code structure"""
        if self.labels and len(self.labels) > 0:
            return self.labels[0]
        
        code_type = self.normalized_type
        
        if code_type == "CPT":
            return self._get_cpt_category()
        
        if code_type == "HCPCS":
            return "HCPCS Level II"
        if code_type == "ICD10":
            return "ICD-10 Diagnosis"
        if code_type == "ICD10-PCS":
            return "ICD-10 Procedure"
        
        return code_type
    
    def _get_cpt_category(self) -> str:
        """Get CPT category based on code range"""
        if self.code.endswith("F"):
            return "Category II - Performance Measurement"
        if self.code.endswith("T"):
            return "Category III - Emerging Technology"
        
        try:
            code_num = int(self.code.rstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ"))
        except ValueError:
            return "CPT"
        
        if 10000 <= code_num <= 19999:
            return "Integumentary System"
        if 20000 <= code_num <= 29999:
            return "Musculoskeletal System"
        if 30000 <= code_num <= 32999:
            return "Respiratory System"
        if 33000 <= code_num <= 37999:
            return "Cardiovascular System"
        if 38000 <= code_num <= 38999:
            return "Hemic and Lymphatic Systems"
        if 40000 <= code_num <= 49999:
            return "Digestive System"
        if 50000 <= code_num <= 53999:
            return "Urinary System"
        if 54000 <= code_num <= 55999:
            return "Male Genital System"
        if 56000 <= code_num <= 59999:
            return "Female Genital System"
        if 60000 <= code_num <= 60999:
            return "Endocrine System"
        if 61000 <= code_num <= 64999:
            return "Nervous System"
        if 65000 <= code_num <= 68999:
            return "Eye and Ocular Adnexa"
        if 69000 <= code_num <= 69999:
            return "Auditory System"
        if 70000 <= code_num <= 79999:
            return "Radiology"
        if 80000 <= code_num <= 89999:
            return "Pathology and Laboratory"
        if 90000 <= code_num <= 99999:
            return "Medicine"
        
        return "CPT"
    
    def calculate_payments(self) -> Dict[str, float]:
        """Calculate payments for all sites of service"""
        payments = {"IPPS": 0, "HOPD": 0, "ASC": 0, "OBL": 0}
        code_type = self.normalized_type
        
        if code_type not in ("CPT", "HCPCS"):
            return payments
        
        metadata = self.metadata.get("CPT") or self.metadata.get("HCPCS") or {}
        
        # OBL (Office-Based Lab / Non-Facility) payment
        nonfacility_rvu = metadata.get("NONFACILITY_RVU", 0)
        if nonfacility_rvu and nonfacility_rvu > 0:
            payments["OBL"] = round(nonfacility_rvu * settings.non_facility_conversion_factor)
        
        # HOPD (Hospital Outpatient) payment from APC
        apc = metadata.get("APC")
        facility_rvu = metadata.get("FACILITY_RVU", 0)
        
        if apc and apc in APC_RATES:
            payments["HOPD"] = APC_RATES[apc]
        elif facility_rvu and facility_rvu > 0:
            payments["HOPD"] = round(facility_rvu * settings.facility_conversion_factor * 35)
        
        # ASC (Ambulatory Surgical Center) payment - typically 65% of HOPD
        if payments["HOPD"] > 0:
            payments["ASC"] = round(payments["HOPD"] * 0.65)
        elif facility_rvu and facility_rvu > 0:
            payments["ASC"] = round(facility_rvu * 50 * 20)
        
        # IPPS (Inpatient) payment
        if payments["HOPD"] > 0:
            payments["IPPS"] = round(payments["HOPD"] * settings.ipps_multiplier)
        elif facility_rvu and facility_rvu > 0:
            payments["IPPS"] = round(facility_rvu * settings.facility_conversion_factor * 50)
        
        return payments
    
    def extract_metadata(self) -> Dict[str, Any]:
        """Extract metadata for display"""
        type_key = self.type
        metadata = self.metadata.get(type_key, {})
        
        return {
            "apc": str(metadata.get("APC")) if metadata.get("APC") else None,
            "si": metadata.get("SI"),
            "rank": metadata.get("RANK"),
            "facility_rvu": metadata.get("FACILITY_RVU"),
            "nonfacility_rvu": metadata.get("NONFACILITY_RVU"),
            "mue_unit": metadata.get("MUE_UNIT"),
            "modifiers": metadata.get("MODIFIERS", []),
            "effective_date": metadata.get("EFFECTIVE_DATE"),
            "guidelines": metadata.get("GUIDELINES"),
            "drg": None,
        }
    
    def to_summary(self) -> Dict[str, Any]:
        """Convert to summary format (for listings)"""
        return {
            "code": self.code,
            "description": self.description,
            "category": self.category,
            "type": self.normalized_type,
            "labels": self.labels,
        }
    
    def to_detail(self) -> Dict[str, Any]:
        """Convert to detail format (for single code view)"""
        payments = self.calculate_payments()
        metadata = self.extract_metadata()
        
        return {
            "code": self.code,
            "description": self.description,
            "category": self.category,
            "type": self.normalized_type,
            "labels": self.labels,
            "payments": payments,
            "optional": {
                "drg": metadata["drg"],
                "apc": metadata["apc"],
                "si": metadata["si"],
                "rank": metadata["rank"],
                "modifiers": metadata["modifiers"],
                "effectiveDate": metadata["effective_date"],
            },
            "rawMetadata": self.metadata,
        }
    
    def get_payment_for_site(self, site_of_service: str) -> float:
        """Get payment for specific site of service"""
        payments = self.calculate_payments()
        site_map = {
            "IPPS": "IPPS",
            "INPATIENT": "IPPS",
            "DRG": "IPPS",
            "HOPD": "HOPD",
            "OPPS": "HOPD",
            "HOSPITAL_OUTPATIENT": "HOPD",
            "ASC": "ASC",
            "AMBULATORY": "ASC",
            "OBL": "OBL",
            "OFFICE": "OBL",
            "NONFACILITY": "OBL",
            "PHYSICIAN": "OBL",
        }
        
        site = site_of_service.upper()
        normalized_site = site_map.get(site, site)
        return payments.get(normalized_site, 0)

