/**
 * Chat Controller
 * Handles AI chat operations with Google GenAI
 */

import genaiService from '../services/genaiService.js';
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
- Loss: Margin < -5% of Total Payment`;

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
 * Process chat message
 * POST /api/chat
 */
export const processChat = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    throw ApiError.badRequest('Message is required');
  }

  // Extract code references and get context
  const codeRefs = extractCodeReferences(message);
  const codeContext = getCodeContext(codeRefs);

  // Build context string
  let contextString = '';
  if (codeContext.length > 0) {
    contextString = '\n\n[Code Database Results]\n';
    for (const code of codeContext) {
      contextString += `Code: ${code.code}\n`;
      contextString += `Description: ${code.description}\n`;
      contextString += `Category: ${code.category}\n`;
      if (code.payments) {
        contextString += `Payments: IPPS=$${code.payments.IPPS}, HOPD=$${code.payments.HOPD}, ASC=$${code.payments.ASC}, OBL=$${code.payments.OBL}\n`;
      }
      contextString += '\n';
    }
  }

  try {
    // Generate response using GenAI service
    const result = await genaiService.generateChatResponse(
      message,
      SYSTEM_PROMPT,
      contextString
    );

    res.json({
      text: result.text,
      citations: result.citations,
      codeContext: codeContext.length > 0 ? codeContext : undefined,
    });
  } catch (error) {
    console.error('Chat error:', error);
    throw ApiError.internal('Failed to process chat message: ' + error.message);
  }
};

export default {
  processChat,
};

