/**
 * Agent Service - Multi-Agent Orchestration Layer
 * 
 * This service provides:
 * 1. Query Classification - Determines which agent should handle the query
 * 2. Agent Routing - Routes queries to appropriate agents (SQL or PDF)
 * 3. Response Aggregation - Combines responses from multiple agents if needed
 */

import { GoogleGenAI } from '@google/genai';
import config from '../config/index.js';
import sqlAgent from './sqlAgent.js';
import genaiService from './genaiService.js';
import codeService from './codeService.js';

// Query types
const QueryType = {
  SQL: 'sql',           // Database queries about codes, payments, statistics
  PDF: 'pdf',           // Document search queries
  GENERAL: 'general',   // General questions that may need both
};

class AgentService {
  constructor() {
    this.ai = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the agent service
   */
  async initialize() {
    if (!config.genai.apiKey) {
      console.warn('GOOGLE_API_KEY not configured - Agent service disabled');
      return false;
    }

    try {
      this.ai = new GoogleGenAI({ apiKey: config.genai.apiKey });
      this.isInitialized = true;
      console.log('Agent Service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Agent service:', error.message);
      return false;
    }
  }

  /**
   * Classify user query to determine which agent should handle it
   * @param {string} query - User's natural language query
   * @returns {Promise<{type: string, confidence: number, reasoning: string}>}
   */
  async classifyQuery(query) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const classificationPrompt = `You are a query classifier for a medical reimbursement application. 
Analyze the user's query and classify it into ONE of these categories:

1. **sql** - Questions that require querying a database of medical codes (CPT, HCPCS, ICD-10, ICD-10-PCS).
   Examples:
   - "Show me all CPT codes related to cardiovascular procedures"
   - "What are the payment rates for code 36903?"
   - "Find codes with HOPD payment greater than $10,000"
   - "How many ICD-10 codes are in the database?"
   - "List the top 10 highest paying procedures"
   - "What is the description for code 99213?"
   - "Search for codes containing 'knee replacement'"
   - "Compare payments for different sites of service"

2. **pdf** - Questions that reference uploaded documents, files, or specific content from user-uploaded PDFs.
   Examples:
   - "What does my uploaded document say about..."
   - "Summarize the PDF I uploaded"
   - "Find information in my files about..."
   - "According to the document..."
   - "What are the key points from the uploaded file?"

3. **general** - General questions about medical reimbursement concepts, CMS policies, or explanations that don't require specific database queries or file searches.
   Examples:
   - "Explain how NTAP works"
   - "What is the difference between DRG and APC?"
   - "How does the Medicare reimbursement process work?"
   - "What are the eligibility criteria for TPT?"

User Query: "${query}"

Respond ONLY with a JSON object in this exact format (no markdown, no extra text):
{"type": "sql|pdf|general", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

    try {
      const result = await this.ai.models.generateContent({
        model: config.genai.model,
        contents: classificationPrompt,
        config: {
          temperature: 0.1, // Low temperature for consistent classification
        }
      });

      const responseText = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('Query Classification:', parsed);
        return {
          type: parsed.type || QueryType.GENERAL,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || 'No reasoning provided',
        };
      }

      // Default to general if parsing fails
      return {
        type: QueryType.GENERAL,
        confidence: 0.5,
        reasoning: 'Failed to parse classification response',
      };
    } catch (error) {
      console.error('Classification error:', error.message);
      // Fallback: Use keyword-based classification
      return this.keywordClassification(query);
    }
  }

  /**
   * Fallback keyword-based classification
   */
  keywordClassification(query) {
    const lowerQuery = query.toLowerCase();

    // SQL indicators
    const sqlKeywords = [
      'code', 'codes', 'cpt', 'hcpcs', 'icd', 'icd-10', 'payment', 'payments',
      'find', 'search', 'list', 'show', 'get', 'how many', 'count', 'total',
      'highest', 'lowest', 'average', 'compare', 'filter', 'where', 'greater than',
      'less than', 'between', 'top', 'all', 'database', 'ipps', 'hopd', 'asc', 'obl',
      'rvu', 'apc', 'drg', 'procedure', 'diagnosis'
    ];

    // PDF indicators
    const pdfKeywords = [
      'uploaded', 'document', 'file', 'pdf', 'attachment', 'my file',
      'the document', 'according to', 'from the file', 'summarize'
    ];

    const sqlScore = sqlKeywords.filter(k => lowerQuery.includes(k)).length;
    const pdfScore = pdfKeywords.filter(k => lowerQuery.includes(k)).length;

    if (pdfScore > sqlScore && pdfScore > 0) {
      return { type: QueryType.PDF, confidence: 0.7, reasoning: 'Keyword match: PDF-related terms' };
    }
    if (sqlScore > 0) {
      return { type: QueryType.SQL, confidence: 0.7, reasoning: 'Keyword match: Database-related terms' };
    }
    return { type: QueryType.GENERAL, confidence: 0.5, reasoning: 'No specific keywords matched' };
  }

  /**
   * Process query through appropriate agent(s)
   * @param {string} query - User's query
   * @param {string} systemPrompt - System prompt for the AI
   * @returns {Promise<{text: string, citations: object, queryType: string, sqlResults?: object}>}
   */
  async processQuery(query, systemPrompt) {
    // Step 1: Classify the query
    const classification = await this.classifyQuery(query);
    console.log(`\n=== Agent Routing ===`);
    console.log(`Query: "${query.substring(0, 100)}..."`);
    console.log(`Classification: ${classification.type} (confidence: ${classification.confidence})`);
    console.log(`Reasoning: ${classification.reasoning}`);

    let response = {
      text: '',
      citations: {
        groundingChunks: [],
        groundingSupports: [],
        webSearchQueries: [],
        fileSearchResults: [],
        processedChunks: [],
      },
      queryType: classification.type,
      classification,
    };

    // Step 2: Route to appropriate agent
    switch (classification.type) {
      case QueryType.SQL:
        response = await this.handleSqlQuery(query, systemPrompt, response);
        break;

      case QueryType.PDF:
        response = await this.handlePdfQuery(query, systemPrompt, response);
        break;

      case QueryType.GENERAL:
      default:
        response = await this.handleGeneralQuery(query, systemPrompt, response);
        break;
    }

    console.log(`=== Agent Complete ===\n`);
    return response;
  }

  /**
   * Handle SQL/Database queries
   */
  async handleSqlQuery(query, systemPrompt, response) {
    console.log('Routing to SQL Agent...');

    try {
      // Get SQL agent result
      const sqlResult = await sqlAgent.processQuery(query);
      
      // Include the generated SQL query in the response
      response.sqlQuery = sqlResult.sqlQuery;
      response.sqlExplanation = sqlResult.explanation;
      response.sqlResults = {
        success: sqlResult.success,
        queryType: sqlResult.queryType,
        message: sqlResult.message,
        previewExecuted: sqlResult.previewExecuted,
        data: sqlResult.data,
      };

      // Format the results for the AI to explain
      let contextForAI = '';
      
      contextForAI = `\n[Generated SQL Query]\n${sqlResult.sqlQuery}\n\n`;
      contextForAI += `[Query Explanation]\n${sqlResult.explanation}\n\n`;
      
      if (sqlResult.success && sqlResult.data) {
        const data = sqlResult.data;
        
        if (data.codes && data.codes.length > 0) {
          contextForAI += `[Preview Results - ${sqlResult.message}]\n`;
          contextForAI += `Total Results: ${data.total || data.codes.length}\n\n`;
          
          // Format code results
          contextForAI += `Sample Results:\n`;
          data.codes.slice(0, 15).forEach((code, i) => {
            contextForAI += `${i + 1}. ${code.code}: ${code.description?.substring(0, 100)}...\n`;
            contextForAI += `   Type: ${code.type}, Category: ${code.category}\n`;
            if (code.payments) {
              contextForAI += `   Payments: IPPS=$${code.payments.IPPS}, HOPD=$${code.payments.HOPD}, ASC=$${code.payments.ASC}, OBL=$${code.payments.OBL}\n`;
            }
          });
          
          if (data.codes.length > 15) {
            contextForAI += `\n... and ${data.codes.length - 15} more results in preview\n`;
          }
        } else if (data.stats) {
          contextForAI += `[Database Statistics]\n`;
          contextForAI += JSON.stringify(data.stats, null, 2);
        } else if (data.code) {
          // Single code result
          contextForAI += `[Code Details]\n`;
          contextForAI += `Code: ${data.code}\n`;
          contextForAI += `Description: ${data.description}\n`;
          contextForAI += `Type: ${data.type}\n`;
          contextForAI += `Category: ${data.category}\n`;
          if (data.payments) {
            contextForAI += `Payments:\n`;
            contextForAI += `  - IPPS (Inpatient): $${data.payments.IPPS}\n`;
            contextForAI += `  - HOPD (Hospital Outpatient): $${data.payments.HOPD}\n`;
            contextForAI += `  - ASC (Ambulatory): $${data.payments.ASC}\n`;
            contextForAI += `  - OBL (Office-Based): $${data.payments.OBL}\n`;
          }
        }
      } else {
        contextForAI += `\n[Query Result]\n${sqlResult.message || 'No results found'}`;
      }

      // Generate explanation using AI
      const aiPrompt = `The user asked: "${query}"

I generated this SQL query for them:
${contextForAI}

Please provide a helpful response that:
1. Briefly acknowledges the SQL query was generated
2. Summarizes the results found
3. Highlights any interesting findings or patterns
4. Note that the user can copy and run the SQL query manually in their database`;

      const aiResult = await this.ai.models.generateContent({
        model: config.genai.model,
        contents: aiPrompt,
        config: {
          systemInstruction: systemPrompt,
        }
      });

      response.text = aiResult.text || aiResult.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate response';
      response.citations.processedChunks.push({
        index: 1,
        type: 'database',
        source: 'Code Database',
        title: `SQL Query: ${sqlResult.queryType}`,
        content: sqlResult.sqlQuery,
      });

    } catch (error) {
      console.error('SQL Agent error:', error.message);
      response.text = `I encountered an error while querying the database: ${error.message}. Please try rephrasing your question.`;
    }

    return response;
  }

  /**
   * Handle PDF/Document queries
   */
  async handlePdfQuery(query, systemPrompt, response) {
    console.log('Routing to PDF Agent...');

    try {
      const pdfResult = await genaiService.generateChatResponse(query, systemPrompt, '');
      response.text = pdfResult.text;
      response.citations = pdfResult.citations;
      response.hasFileSearch = pdfResult.hasFileSearch;
      response.hasWebSearch = pdfResult.hasWebSearch;
    } catch (error) {
      console.error('PDF Agent error:', error.message);
      response.text = `I encountered an error while searching documents: ${error.message}`;
    }

    return response;
  }

  /**
   * Handle general queries (may use both SQL and PDF)
   */
  async handleGeneralQuery(query, systemPrompt, response) {
    console.log('Routing to General Agent (PDF + context)...');

    // Extract any code references for context
    const codeRefs = this.extractCodeReferences(query);
    let codeContext = '';

    if (codeRefs.length > 0) {
      codeContext = '\n\n[Code Database Results]\n';
      for (const code of codeRefs) {
        const codeDetail = codeService.getCode(code);
        if (codeDetail) {
          codeContext += `Code: ${codeDetail.code}\n`;
          codeContext += `Description: ${codeDetail.description}\n`;
          codeContext += `Category: ${codeDetail.category}\n`;
          if (codeDetail.payments) {
            codeContext += `Payments: IPPS=$${codeDetail.payments.IPPS}, HOPD=$${codeDetail.payments.HOPD}, ASC=$${codeDetail.payments.ASC}, OBL=$${codeDetail.payments.OBL}\n`;
          }
          codeContext += '\n';
        }
      }
    }

    try {
      const result = await genaiService.generateChatResponse(query, systemPrompt, codeContext);
      response.text = result.text;
      response.citations = result.citations;
      response.hasFileSearch = result.hasFileSearch;
      response.hasWebSearch = result.hasWebSearch;
      if (codeContext) {
        response.codeContext = codeRefs;
      }
    } catch (error) {
      console.error('General Agent error:', error.message);
      response.text = `I encountered an error: ${error.message}`;
    }

    return response;
  }

  /**
   * Extract code references from message
   */
  extractCodeReferences(message) {
    const patterns = [
      /\b(\d{5}[A-Z]?)\b/g,       // CPT codes
      /\b([A-Z]\d{4})\b/g,        // HCPCS codes
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
}

// Singleton instance
const agentService = new AgentService();

export default agentService;
export { AgentService, QueryType };

