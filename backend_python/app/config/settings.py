"""
Application Configuration
Centralized configuration for the FastAPI backend application
"""

from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server configuration
    port: int = 3001
    env: str = "development"
    
    # API configuration
    api_base_path: str = "/api"
    api_version: str = "1.0.0"
    
    # File upload limits
    max_file_size: int = 500 * 1024 * 1024  # 500MB
    allowed_mime_types: List[str] = [
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/markdown",
    ]
    
    # Google GenAI configuration
    google_api_key: Optional[str] = None
    genai_model: str = "gemini-3-pro-preview"
    default_file_search_store: str = "default-file-search-store"
    
    # Reimbursement classification thresholds
    profitable_min_margin: float = 0.10  # Margin > 10% of total = profitable
    break_even_min_margin: float = -0.05  # Margin between -5% and 10% = break-even
    
    # CMS Conversion Factors (2025 approximate values)
    facility_conversion_factor: float = 33.89
    non_facility_conversion_factor: float = 33.89
    asc_multiplier: float = 50.0
    ipps_multiplier: float = 1.5
    
    # NTAP configuration
    ntap_percentage: float = 0.65
    ntap_max_cap: float = 150000
    ntap_cost_threshold_multiplier: float = 1.0
    
    # TPT configuration
    tpt_max_pass_through_duration: int = 3  # years
    
    # CORS configuration
    cors_origins: List[str] = ["*"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


# Singleton instance
settings = Settings()


def validate_config() -> List[str]:
    """Validate required configuration and return warnings"""
    warnings = []
    
    if not settings.google_api_key:
        warnings.append("GOOGLE_API_KEY is not set - GenAI features will be disabled")
    
    return warnings

