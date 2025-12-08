/**
 * Chat Controller
 * Handles AI chat operations with Multi-Agent Orchestration
 * 
 * Flow:
 * 1. User sends query
 * 2. Query Classifier determines query type (SQL/PDF/General)
 * 3. Route to appropriate agent
 * 4. Return response with context and citations
 */

import agentService from '../services/agentService.js';
import codeService from '../services/codeService.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * System prompt for the AI
 */
const SYSTEM_PROMPT = `You are a reimbursement intelligence specialist and medical coding expert. Your role is to answer questions about:
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
- OBL: Office-Based Lab (physician fee schedule)`;

/**
 * Extract code references from message
 */
function extractCodeReferences(message) {
  const patterns = [
    /\b(\d{5}[A-Z]?)\b/g,       // CPT codes (5 digits, optional letter)
    /\b([A-Z]\d{4})\b/g,        // HCPCS codes (letter + 4 digits)
    /\b([A-Z]\d{2}\.\d{1,2})\b/g, // ICD-10 codes
  ];

  const codes = new Set();
  for (const pattern of patterns) {
    const matches = message.match(pattern);
    if (matches) {
      matches.forEach(m => codes.add(m));
    }
  }
  return Array.from(codes);
}

/**
 * Get code context for AI
 */
function getCodeContext(codes) {
  const context = [];
  for (const code of codes) {
    const codeDetail = codeService.getCode(code);
    if (codeDetail) {
      context.push({
        code: codeDetail.code,
        description: codeDetail.description,
        category: codeDetail.category,
        payments: codeDetail.payments,
      });
    }
  }
  return context;
}

/**
 * Process chat message with Multi-Agent Orchestration
 * POST /api/chat
 * 
 * Flow:
 * 1. Classify query type (SQL, PDF, or General)
 * 2. Route to appropriate agent
 * 3. Return enriched response
 */
export const processChat = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    throw ApiError.badRequest('Message is required');
  }

  console.log('\n========================================');
  console.log('Chat Request:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
  console.log('========================================');

  try {
    // Initialize agent service if needed
    await agentService.initialize();

    // Process through multi-agent system
    const result = await agentService.processQuery(message, SYSTEM_PROMPT);

    // Build response
    const response = {
      text: result.text,
      citations: result.citations,
      queryType: result.queryType,
      classification: result.classification,
    };

    // Add SQL-specific data if present
    if (result.sqlQuery) {
      response.sqlQuery = result.sqlQuery;
      response.sqlExplanation = result.sqlExplanation;
    }
    
    if (result.sqlResults) {
      response.sqlResults = {
        success: result.sqlResults.success,
        queryType: result.sqlResults.queryType,
        message: result.sqlResults.message,
        previewExecuted: result.sqlResults.previewExecuted,
        resultCount: result.sqlResults.data?.codes?.length || 
                     (result.sqlResults.data?.code ? 1 : 0) ||
                     (result.sqlResults.data?.stats ? 1 : 0) ||
                     0,
      };
    }

    // Add code context if present
    if (result.codeContext && result.codeContext.length > 0) {
      const codeDetails = getCodeContext(result.codeContext);
      if (codeDetails.length > 0) {
        response.codeContext = codeDetails;
      }
    }

    console.log('Response query type:', response.queryType);
    console.log('Response length:', response.text?.length || 0);
    console.log('========================================\n');

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    throw ApiError.internal('Failed to process chat message: ' + error.message);
  }
};

/**
 * Get agent status
 * GET /api/chat/status
 */
export const getAgentStatus = async (req, res) => {
  const status = {
    agentService: agentService.isInitialized,
    codeService: codeService.isReady(),
    codeStats: codeService.isReady() ? codeService.getStats() : null,
    availableAgents: ['classifier', 'sql', 'pdf', 'general'],
  };

  res.json(status);
};

export default {
  processChat,
  getAgentStatus,
};
