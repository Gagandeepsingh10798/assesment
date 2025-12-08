"""
Chat Router
Handles AI chat operations
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re

from app.services import genai_service, code_service

router = APIRouter(prefix="/chat", tags=["Chat"])


# System prompt for the AI
SYSTEM_PROMPT = """You are a reimbursement intelligence specialist and medical coding expert. Your role is to answer questions about:
- Medical procedure codes (CPT, HCPCS)
- Diagnosis codes (ICD-10)
- Reimbursement pathways (IPPS, OPPS/HOPD, ASC, OBL)
- Payment analysis and financial scenarios for medical procedures
- Site of service payment comparisons
- NTAP (New Technology Add-on Payments)
- Margins and profitability analysis

IMPORTANT GUIDELINES:
1. You MUST only respond to questions related to medical codes, reimbursement, and healthcare billing
2. If asked about non-medical/reimbursement topics, politely decline and redirect to appropriate questions
3. When discussing procedure codes, always reference payment values by site of service when available
4. For reimbursement scenarios, explain:
   - Base payment
   - Add-on payment (if applicable)
   - Total payment
   - Margin
   - Classification (Profitable, Break-Even, Loss)
5. Use the provided search results, code database, and file content to provide accurate, cited answers.
6. Always cite your sources when providing information.
7. If a code is mentioned, try to look it up in the internal code database first.

CLASSIFICATION THRESHOLDS:
- Profitable: Margin > 10% of Total Payment
- Break-Even: Margin between -5% and 10% of Total Payment
- Loss: Margin < -5% of Total Payment

SITES OF SERVICE EXPLANATION:
- IPPS: Inpatient Prospective Payment System (DRG-based hospital inpatient)
- HOPD: Hospital Outpatient Department (APC-based outpatient)
- ASC: Ambulatory Surgical Center (separate payment rates)
- OBL: Office-Based Lab (physician fee schedule)"""


class ChatRequest(BaseModel):
    """Request model for chat"""
    message: str


def extract_code_references(message: str):
    """Extract code references from message"""
    patterns = [
        r'\b(\d{5}[A-Z]?)\b',           # CPT codes (5 digits, optional letter)
        r'\b([A-Z]\d{4})\b',             # HCPCS codes (letter + 4 digits)
        r'\b([A-Z]\d{2}\.\d{1,2})\b',    # ICD-10 codes
    ]
    
    codes = set()
    for pattern in patterns:
        matches = re.findall(pattern, message)
        codes.update(matches)
    
    return list(codes)


def get_code_context(codes):
    """Get code context for AI"""
    context = []
    for code in codes:
        code_detail = code_service.get_code(code)
        if code_detail:
            context.append({
                "code": code_detail.get("code"),
                "description": code_detail.get("description"),
                "category": code_detail.get("category"),
                "payments": code_detail.get("payments"),
            })
    return context


@router.post("")
async def process_chat(request: ChatRequest):
    """
    Process chat message
    POST /api/chat
    """
    if not request.message or not isinstance(request.message, str):
        raise HTTPException(status_code=400, detail="Message is required")
    
    message = request.message
    
    print("\n" + "=" * 40)
    print(f"Chat Request: {message[:100]}{'...' if len(message) > 100 else ''}")
    print("=" * 40)
    
    try:
        # Extract code references from message
        code_refs = extract_code_references(message)
        code_context = get_code_context(code_refs)
        
        # Build additional context from code database
        additional_context = ""
        if code_context:
            additional_context = "\n\nCode Database Context:\n"
            for ctx in code_context:
                additional_context += f"- {ctx['code']}: {ctx['description']}\n"
                if ctx.get('payments'):
                    payments = ctx['payments']
                    additional_context += f"  Payments: IPPS=${payments.get('IPPS', 0):,}, HOPD=${payments.get('HOPD', 0):,}, ASC=${payments.get('ASC', 0):,}, OBL=${payments.get('OBL', 0):,}\n"
        
        # Generate response using GenAI
        result = await genai_service.generate_chat_response(
            message=message,
            system_prompt=SYSTEM_PROMPT,
            additional_context=additional_context
        )
        
        # Build response with query type from agent
        response = {
            "text": result.get("text"),
            "citations": result.get("citations"),
            "queryType": result.get("queryType", "general"),
            "classification": result.get("classification"),
        }
        
        # Add SQL-specific data if present
        if result.get("sqlQuery"):
            response["sqlQuery"] = result.get("sqlQuery")
            response["sqlExplanation"] = result.get("sqlExplanation")
        
        # Add code context if present
        if code_context:
            response["codeContext"] = code_context
        
        # Add file search / web search flags
        response["hasFileSearch"] = result.get("hasFileSearch", False)
        response["hasWebSearch"] = result.get("hasWebSearch", False)
        
        print(f"Query Type: {response['queryType']}")
        print(f"Response length: {len(response.get('text', ''))}")
        print("=" * 40 + "\n")
        
        return response
    except Exception as error:
        print(f"Chat error: {error}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat message: {str(error)}")


@router.get("/status")
async def get_agent_status():
    """
    Get agent status
    GET /api/chat/status
    """
    return {
        "agentService": genai_service.is_initialized,
        "codeService": code_service.is_ready(),
        "codeStats": code_service.get_stats() if code_service.is_ready() else None,
        "availableAgents": ["classifier", "sql", "pdf", "general"],
    }

