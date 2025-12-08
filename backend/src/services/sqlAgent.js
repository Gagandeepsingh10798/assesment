/**
 * SQL Agent Service
 * 
 * Converts natural language queries into SQL queries
 * that can be executed against a medical codes database
 * 
 * Features:
 * - Generates readable SQL queries from natural language
 * - Returns SQL query string for user to copy/execute
 * - Also executes query against in-memory data for preview
 * 
 * Database Schema (for SQL generation):
 * CREATE TABLE codes (
 *   code VARCHAR(20) PRIMARY KEY,
 *   description TEXT,
 *   type VARCHAR(20),  -- CPT, HCPCS, ICD10, ICD10-PCS
 *   category VARCHAR(100),
 *   labels JSON,
 *   ipps_payment DECIMAL(10,2),
 *   hopd_payment DECIMAL(10,2),
 *   asc_payment DECIMAL(10,2),
 *   obl_payment DECIMAL(10,2),
 *   apc VARCHAR(10),
 *   facility_rvu DECIMAL(10,4),
 *   nonfacility_rvu DECIMAL(10,4)
 * );
 */

import { GoogleGenAI } from '@google/genai';
import config from '../config/index.js';
import codeService from './codeService.js';

// SQL Query types
const SqlQueryType = {
  SELECT: 'SELECT',
  COUNT: 'COUNT',
  AGGREGATE: 'AGGREGATE',
};

// Database schema for SQL generation
const DATABASE_SCHEMA = `
-- Medical Codes Database Schema
CREATE TABLE codes (
  code VARCHAR(20) PRIMARY KEY,           -- Unique code identifier (e.g., '36903', 'A0001', 'N39.0')
  description TEXT,                        -- Full description of the code
  type VARCHAR(20),                        -- Code type: 'CPT', 'HCPCS', 'ICD10', 'ICD10-PCS'
  category VARCHAR(100),                   -- Category (e.g., 'Cardiovascular System', 'Medicine')
  labels JSON,                             -- Array of labels/tags
  ipps_payment DECIMAL(10,2),             -- Inpatient (DRG) payment amount
  hopd_payment DECIMAL(10,2),             -- Hospital Outpatient payment amount
  asc_payment DECIMAL(10,2),              -- Ambulatory Surgical Center payment amount
  obl_payment DECIMAL(10,2),              -- Office-Based Lab payment amount
  apc VARCHAR(10),                         -- APC code (for outpatient)
  facility_rvu DECIMAL(10,4),             -- Facility RVU value
  nonfacility_rvu DECIMAL(10,4)           -- Non-facility RVU value
);

-- Sample data counts:
-- Total records: 164,009
-- CPT codes: 10,779
-- HCPCS codes: 3
-- ICD-10 codes: 74,279
-- ICD-10-PCS codes: 78,948
`;

class SqlAgent {
  constructor() {
    this.ai = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the SQL agent
   */
  async initialize() {
    if (!config.genai.apiKey) {
      console.warn('GOOGLE_API_KEY not configured - SQL Agent using fallback');
      return false;
    }

    try {
      this.ai = new GoogleGenAI({ apiKey: config.genai.apiKey });
      this.isInitialized = true;
      console.log('SQL Agent initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize SQL Agent:', error.message);
      return false;
    }
  }

  /**
   * Process a natural language query and convert to SQL
   * @param {string} query - Natural language query
   * @returns {Promise<{success: boolean, sqlQuery: string, queryType: string, data: object, message: string}>}
   */
  async processQuery(query) {
    console.log('SQL Agent processing:', query);

    // Ensure code service is loaded
    if (!codeService.isReady()) {
      await codeService.loadCodes();
    }

    // Initialize AI if not done
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Generate SQL query using LLM
    const sqlResult = await this.generateSqlQuery(query);
    console.log('Generated SQL:', sqlResult.sqlQuery);

    // Execute the query against in-memory data for preview
    const executionResult = await this.executePreview(sqlResult);

    return {
      ...sqlResult,
      ...executionResult,
    };
  }

  /**
   * Use LLM to generate SQL query from natural language
   */
  async generateSqlQuery(query) {
    if (!this.ai) {
      return this.generateSqlFallback(query);
    }

    const sqlPrompt = `You are a SQL query generator for a medical codes database. Convert the user's natural language query into a valid SQL query.

${DATABASE_SCHEMA}

User Query: "${query}"

IMPORTANT RULES:
1. Generate a valid SQL query that would work in PostgreSQL/MySQL
2. Use proper SQL syntax with correct column names from the schema
3. For text search, use LIKE with wildcards: WHERE description LIKE '%keyword%'
4. For payment comparisons, use the appropriate payment column (ipps_payment, hopd_payment, asc_payment, obl_payment)
5. Always include a LIMIT clause (default 50) unless counting
6. Use ORDER BY for sorted results
7. For multiple conditions, use AND/OR appropriately

Respond ONLY with a JSON object (no markdown, no extra text):
{
  "sqlQuery": "SELECT ... FROM codes WHERE ... ORDER BY ... LIMIT 50",
  "queryType": "SELECT|COUNT|AGGREGATE",
  "explanation": "Brief explanation of what the query does"
}`;

    try {
      const result = await this.ai.models.generateContent({
        model: config.genai.model,
        contents: sqlPrompt,
        config: {
          temperature: 0.1,
        }
      });

      const responseText = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          sqlQuery: parsed.sqlQuery || this.generateDefaultQuery(query),
          queryType: parsed.queryType || SqlQueryType.SELECT,
          explanation: parsed.explanation || 'Query generated from natural language',
        };
      }

      return this.generateSqlFallback(query);
    } catch (error) {
      console.error('LLM SQL generation error:', error.message);
      return this.generateSqlFallback(query);
    }
  }

  /**
   * Fallback rule-based SQL generation
   */
  generateSqlFallback(query) {
    const lowerQuery = query.toLowerCase();

    // Check for specific code lookup
    const codeMatch = query.match(/\b(\d{5}[A-Z]?|[A-Z]\d{4}|[A-Z]\d{2}\.\d{1,2})\b/i);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      return {
        success: true,
        sqlQuery: `SELECT code, description, type, category, 
       ipps_payment, hopd_payment, asc_payment, obl_payment
FROM codes 
WHERE code = '${code}';`,
        queryType: SqlQueryType.SELECT,
        explanation: `Lookup details for code ${code}`,
      };
    }

    // Check for count/statistics
    if (lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('total')) {
      const typeMatch = lowerQuery.match(/\b(cpt|hcpcs|icd-?10|icd-?10-?pcs)\b/i);
      if (typeMatch) {
        const type = this.normalizeType(typeMatch[1]);
        return {
          success: true,
          sqlQuery: `SELECT COUNT(*) as total_count, type
FROM codes 
WHERE type = '${type}'
GROUP BY type;`,
          queryType: SqlQueryType.COUNT,
          explanation: `Count of ${type} codes in the database`,
        };
      }
      return {
        success: true,
        sqlQuery: `SELECT type, COUNT(*) as count
FROM codes 
GROUP BY type
ORDER BY count DESC;`,
        queryType: SqlQueryType.COUNT,
        explanation: 'Count of codes by type',
      };
    }

    // Check for type filtering
    const typeMatch = lowerQuery.match(/\b(cpt|hcpcs|icd-?10|icd-?10-?pcs)\b/i);
    if (typeMatch) {
      const type = this.normalizeType(typeMatch[1]);
      const searchTerm = this.extractSearchTerm(query);
      
      if (searchTerm) {
        return {
          success: true,
          sqlQuery: `SELECT code, description, type, category,
       ipps_payment, hopd_payment, asc_payment, obl_payment
FROM codes 
WHERE type = '${type}' 
  AND (description LIKE '%${searchTerm}%' OR code LIKE '%${searchTerm}%')
ORDER BY code
LIMIT 50;`,
          queryType: SqlQueryType.SELECT,
          explanation: `Search ${type} codes containing "${searchTerm}"`,
        };
      }
      
      return {
        success: true,
        sqlQuery: `SELECT code, description, type, category,
       ipps_payment, hopd_payment, asc_payment, obl_payment
FROM codes 
WHERE type = '${type}'
ORDER BY code
LIMIT 50;`,
        queryType: SqlQueryType.SELECT,
        explanation: `List ${type} codes`,
      };
    }

    // Check for payment queries
    const paymentMatch = lowerQuery.match(/\b(ipps|hopd|asc|obl)\b.*?(greater|less|more|above|below|over|under|>|<)\s*(than)?\s*\$?(\d+)/i);
    if (paymentMatch) {
      const field = paymentMatch[1].toLowerCase() + '_payment';
      const operator = ['less', 'below', 'under', '<'].includes(paymentMatch[2].toLowerCase()) ? '<' : '>';
      const value = parseInt(paymentMatch[4]);
      
      return {
        success: true,
        sqlQuery: `SELECT code, description, type, category,
       ipps_payment, hopd_payment, asc_payment, obl_payment
FROM codes 
WHERE ${field} ${operator} ${value}
ORDER BY ${field} ${operator === '>' ? 'DESC' : 'ASC'}
LIMIT 50;`,
        queryType: SqlQueryType.SELECT,
        explanation: `Codes with ${field.replace('_', ' ')} ${operator} $${value}`,
      };
    }

    // Check for highest/lowest payments
    if (lowerQuery.includes('highest') || lowerQuery.includes('top') || lowerQuery.includes('most expensive')) {
      const paymentField = this.detectPaymentField(lowerQuery) || 'hopd_payment';
      return {
        success: true,
        sqlQuery: `SELECT code, description, type, category,
       ipps_payment, hopd_payment, asc_payment, obl_payment
FROM codes 
WHERE ${paymentField} > 0
ORDER BY ${paymentField} DESC
LIMIT 20;`,
        queryType: SqlQueryType.SELECT,
        explanation: `Top 20 codes by ${paymentField.replace('_', ' ')}`,
      };
    }

    if (lowerQuery.includes('lowest') || lowerQuery.includes('cheapest')) {
      const paymentField = this.detectPaymentField(lowerQuery) || 'hopd_payment';
      return {
        success: true,
        sqlQuery: `SELECT code, description, type, category,
       ipps_payment, hopd_payment, asc_payment, obl_payment
FROM codes 
WHERE ${paymentField} > 0
ORDER BY ${paymentField} ASC
LIMIT 20;`,
        queryType: SqlQueryType.SELECT,
        explanation: `Bottom 20 codes by ${paymentField.replace('_', ' ')}`,
      };
    }

    // Default to text search
    const searchTerm = this.extractSearchTerm(query);
    if (searchTerm && searchTerm.length >= 2) {
      return {
        success: true,
        sqlQuery: `SELECT code, description, type, category,
       ipps_payment, hopd_payment, asc_payment, obl_payment
FROM codes 
WHERE description LIKE '%${searchTerm}%'
   OR code LIKE '%${searchTerm}%'
ORDER BY 
  CASE WHEN code LIKE '${searchTerm}%' THEN 1
       WHEN code LIKE '%${searchTerm}%' THEN 2
       ELSE 3 END,
  code
LIMIT 50;`,
        queryType: SqlQueryType.SELECT,
        explanation: `Search codes containing "${searchTerm}"`,
      };
    }

    return this.generateDefaultQuery(query);
  }

  /**
   * Generate a default query
   */
  generateDefaultQuery(query) {
    return {
      success: true,
      sqlQuery: `SELECT code, description, type, category,
       ipps_payment, hopd_payment, asc_payment, obl_payment
FROM codes 
ORDER BY code
LIMIT 50;`,
      queryType: SqlQueryType.SELECT,
      explanation: 'List first 50 codes',
    };
  }

  /**
   * Normalize type string
   */
  normalizeType(type) {
    const upperType = type.toUpperCase().replace(/-/g, '');
    if (upperType === 'ICD10PCS') return 'ICD10-PCS';
    if (upperType === 'ICD10') return 'ICD10';
    return upperType;
  }

  /**
   * Detect payment field from query
   */
  detectPaymentField(query) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('ipps') || lowerQuery.includes('inpatient')) return 'ipps_payment';
    if (lowerQuery.includes('hopd') || lowerQuery.includes('outpatient')) return 'hopd_payment';
    if (lowerQuery.includes('asc') || lowerQuery.includes('ambulatory')) return 'asc_payment';
    if (lowerQuery.includes('obl') || lowerQuery.includes('office')) return 'obl_payment';
    return null;
  }

  /**
   * Extract meaningful search terms from query
   */
  extractSearchTerm(query) {
    const stopWords = ['what', 'is', 'are', 'the', 'a', 'an', 'show', 'me', 'find', 'get', 'list', 'all',
      'codes', 'code', 'related', 'to', 'for', 'with', 'about', 'please', 'can', 'you', 'i', 'want',
      'cpt', 'hcpcs', 'icd', 'icd10', 'pcs', 'search', 'query', 'database'];
    
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w));
    
    return words.join(' ');
  }

  /**
   * Execute query preview against in-memory data
   */
  async executePreview(sqlResult) {
    const { sqlQuery, queryType } = sqlResult;

    try {
      // Parse the SQL query to extract parameters
      const parsed = this.parseSqlQuery(sqlQuery);
      
      let data = null;
      let message = '';

      if (parsed.isCount) {
        // Handle count queries
        const stats = codeService.getStats();
        if (parsed.type) {
          const count = stats.types[parsed.type] || 0;
          data = { 
            count,
            type: parsed.type,
            stats 
          };
          message = `Found ${count.toLocaleString()} ${parsed.type} codes`;
        } else {
          data = { stats };
          message = `Database contains ${stats.totalCodes.toLocaleString()} total codes`;
        }
      } else if (parsed.code) {
        // Single code lookup
        const codeDetail = codeService.getCode(parsed.code);
        if (codeDetail) {
          data = codeDetail;
          message = `Found code ${parsed.code}`;
        } else {
          message = `Code ${parsed.code} not found`;
        }
      } else if (parsed.searchTerm || parsed.type) {
        // Search or filter
        const searchResult = parsed.searchTerm 
          ? codeService.searchCodes(parsed.searchTerm, { limit: parsed.limit || 50, type: parsed.type })
          : codeService.getAllCodes({ type: parsed.type, limit: parsed.limit || 50 });
        
        // Add payment data to results
        const codesWithPayments = searchResult.codes.map(code => {
          const fullCode = codeService.getCode(code.code);
          return fullCode || code;
        });

        data = {
          codes: codesWithPayments,
          total: searchResult.total,
        };
        message = `Found ${searchResult.total.toLocaleString()} matching codes (showing ${codesWithPayments.length})`;
      } else {
        // Default list
        const listResult = codeService.getAllCodes({ limit: parsed.limit || 50 });
        const codesWithPayments = listResult.codes.map(code => {
          const fullCode = codeService.getCode(code.code);
          return fullCode || code;
        });

        data = {
          codes: codesWithPayments,
          total: listResult.total,
        };
        message = `Showing ${codesWithPayments.length} of ${listResult.total.toLocaleString()} codes`;
      }

      return {
        success: true,
        data,
        message,
        previewExecuted: true,
      };
    } catch (error) {
      console.error('Preview execution error:', error.message);
      return {
        success: false,
        data: null,
        message: `Preview execution failed: ${error.message}`,
        previewExecuted: false,
      };
    }
  }

  /**
   * Parse SQL query to extract parameters for preview execution
   */
  parseSqlQuery(sqlQuery) {
    const lowerSql = sqlQuery.toLowerCase();
    const result = {
      isCount: lowerSql.includes('count('),
      code: null,
      type: null,
      searchTerm: null,
      limit: 50,
      orderBy: null,
      orderDir: 'asc',
    };

    // Extract specific code
    const codeMatch = sqlQuery.match(/code\s*=\s*'([^']+)'/i);
    if (codeMatch) {
      result.code = codeMatch[1];
    }

    // Extract type
    const typeMatch = sqlQuery.match(/type\s*=\s*'([^']+)'/i);
    if (typeMatch) {
      result.type = typeMatch[1];
    }

    // Extract LIKE search term
    const likeMatch = sqlQuery.match(/(?:description|code)\s+LIKE\s+'%([^%]+)%'/i);
    if (likeMatch) {
      result.searchTerm = likeMatch[1];
    }

    // Extract LIMIT
    const limitMatch = sqlQuery.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      result.limit = parseInt(limitMatch[1]);
    }

    // Extract ORDER BY
    const orderMatch = sqlQuery.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
    if (orderMatch) {
      result.orderBy = orderMatch[1];
      result.orderDir = orderMatch[2]?.toLowerCase() || 'asc';
    }

    return result;
  }
}

// Singleton instance
const sqlAgent = new SqlAgent();

export default sqlAgent;
export { SqlAgent, SqlQueryType, DATABASE_SCHEMA };
