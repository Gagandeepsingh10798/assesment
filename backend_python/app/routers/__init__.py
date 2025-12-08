from .health import router as health_router
from .codes import router as codes_router
from .reimbursement import router as reimbursement_router
from .ntap import router as ntap_router
from .tpt import router as tpt_router
from .files import router as files_router, upload_router
from .chat import router as chat_router

__all__ = [
    "health_router",
    "codes_router",
    "reimbursement_router",
    "ntap_router",
    "tpt_router",
    "files_router",
    "upload_router",
    "chat_router",
]

