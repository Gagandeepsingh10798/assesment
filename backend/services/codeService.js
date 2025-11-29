/**
 * Code Intelligence Service
 * Provides efficient loading, indexing, and querying of medical codes (CPT, HCPCS, ICD-10/Dx, PCS)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CMS Conversion Factors (2025 approximate values)
const CONVERSION_FACTORS = {
  FACILITY_CF: 33.89,      // Medicare Physician Fee Schedule Facility
  NONFACILITY_CF: 33.89,   // Medicare Physician Fee Schedule Non-Facility
  ASC_CF: 50.0,            // ASC Payment Rate modifier
  IPPS_MULTIPLIER: 1.5,    // Inpatient multiplier factor
};

// APC Payment Rate lookup (approximate 2025 values for common APCs)
const APC_RATES = {
  5193: 11639,  // Dialysis circuit intervention
  5054: 2850,   // Level 4 device implant
  5055: 4200,   // Level 5 device implant
  5056: 6500,   // Level 6 device implant
  5183: 8500,   // Level 3 Vascular intervention
  5192: 9200,   // Level 2 Dialysis circuit
  5194: 14500,  // Level 4 Dialysis circuit
  // Add more as needed
};

// Default mock payments for demonstration
const DEFAULT_PAYMENTS = {
  IPPS: 0,
  HOPD: 0,
  ASC: 0,
  OBL: 0,
};

class CodeService {
  constructor() {
    this.codes = [];
    this.codeIndex = new Map();      // code -> full object
    this.typeIndex = new Map();       // type -> [codes]
    this.searchIndex = [];            // Array for text search
    this.isLoaded = false;
    this.loadError = null;
  }

  /**
   * Load and index the codes JSON file
   */
  async loadCodes() {
    if (this.isLoaded) return;

    try {
      const dataPath = path.join(__dirname, '..', 'data', 'codes_2025.json');
      console.log('Loading codes from:', dataPath);
      
      const startTime = Date.now();
      
      // Read and parse JSON
      const rawData = fs.readFileSync(dataPath, 'utf8');
      this.codes = JSON.parse(rawData);
      
      console.log(`Loaded ${this.codes.length} codes in ${Date.now() - startTime}ms`);
      
      // Build indexes
      this.buildIndexes();
      
      this.isLoaded = true;
      console.log(`Indexing complete in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('Error loading codes:', error.message);
      this.loadError = error;
      throw error;
    }
  }

  /**
   * Build in-memory indexes for fast lookup
   */
  buildIndexes() {
    console.log('Building indexes...');
    
    // Clear existing indexes
    this.codeIndex.clear();
    this.typeIndex.clear();
    this.searchIndex = [];
    
    for (const codeObj of this.codes) {
      // Index by code
      this.codeIndex.set(codeObj.code, codeObj);
      
      // Index by type
      const type = this.normalizeType(codeObj.type);
      if (!this.typeIndex.has(type)) {
        this.typeIndex.set(type, []);
      }
      this.typeIndex.get(type).push(codeObj);
      
      // Build search index (code + description tokens)
      this.searchIndex.push({
        code: codeObj.code,
        searchText: `${codeObj.code} ${codeObj.description}`.toLowerCase(),
        type: type,
      });
    }
    
    console.log('Index stats:');
    console.log('  - Code index size:', this.codeIndex.size);
    console.log('  - Types:', Array.from(this.typeIndex.keys()));
    for (const [type, codes] of this.typeIndex) {
      console.log(`    - ${type}: ${codes.length} codes`);
    }
  }

  /**
   * Normalize type name for consistent querying
   */
  normalizeType(type) {
    if (!type) return 'OTHER';
    const upperType = type.toUpperCase();
    if (upperType === 'DX') return 'ICD10';
    if (upperType === 'PCS') return 'ICD10-PCS';
    return upperType;
  }

  /**
   * Get all codes with pagination and filtering
   */
  getAllCodes(options = {}) {
    const { 
      limit = 50, 
      offset = 0, 
      type = null,
      sortBy = 'code',
      sortOrder = 'asc'
    } = options;

    let results = type 
      ? (this.typeIndex.get(type.toUpperCase()) || [])
      : this.codes;

    // Sort
    results = [...results].sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      const comparison = aVal.toString().localeCompare(bVal.toString());
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Paginate
    const paginated = results.slice(offset, offset + limit);

    return {
      codes: paginated.map(c => this.formatCodeSummary(c)),
      total: results.length,
      limit,
      offset,
      hasMore: offset + limit < results.length,
    };
  }

  /**
   * Get a single code by code string
   */
  getCode(code) {
    const codeObj = this.codeIndex.get(code) || this.codeIndex.get(code.toUpperCase());
    if (!codeObj) return null;
    return this.formatCodeDetail(codeObj);
  }

  /**
   * Search codes by query string
   */
  searchCodes(query, options = {}) {
    const { limit = 50, type = null } = options;
    
    if (!query || query.trim().length < 2) {
      return { codes: [], total: 0, query };
    }

    const searchTerm = query.toLowerCase().trim();
    const terms = searchTerm.split(/\s+/);
    
    // Score-based search
    const results = [];
    
    for (const item of this.searchIndex) {
      // Filter by type if specified
      if (type && item.type !== type.toUpperCase()) continue;
      
      let score = 0;
      
      // Exact code match gets highest score
      if (item.code.toLowerCase() === searchTerm) {
        score = 100;
      } else if (item.code.toLowerCase().includes(searchTerm)) {
        score = 80;
      }
      
      // Term matching in description
      for (const term of terms) {
        if (item.searchText.includes(term)) {
          score += 10;
        }
      }
      
      if (score > 0) {
        results.push({ code: item.code, score });
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Get full code objects for top results
    const topResults = results.slice(0, limit).map(r => {
      const codeObj = this.codeIndex.get(r.code);
      return this.formatCodeSummary(codeObj);
    });

    return {
      codes: topResults,
      total: results.length,
      query,
    };
  }

  /**
   * Format code for summary listing
   */
  formatCodeSummary(codeObj) {
    return {
      code: codeObj.code,
      description: codeObj.description,
      category: this.getCategory(codeObj),
      type: this.normalizeType(codeObj.type),
      labels: codeObj.labels || [],
    };
  }

  /**
   * Format code for detailed view with payments
   */
  formatCodeDetail(codeObj) {
    const payments = this.calculatePayments(codeObj);
    const metadata = this.extractMetadata(codeObj);

    return {
      code: codeObj.code,
      description: codeObj.description,
      category: this.getCategory(codeObj),
      type: this.normalizeType(codeObj.type),
      labels: codeObj.labels || [],
      payments,
      optional: {
        drg: metadata.drg || null,
        apc: metadata.apc || null,
        si: metadata.si || null,
        rank: metadata.rank || null,
        modifiers: metadata.modifiers || [],
        effectiveDate: metadata.effectiveDate || null,
      },
      rawMetadata: codeObj.metadata,
    };
  }

  /**
   * Get category from code structure
   */
  getCategory(codeObj) {
    // Derive category from labels or type
    if (codeObj.labels && codeObj.labels.length > 0) {
      return codeObj.labels[0];
    }
    
    const type = this.normalizeType(codeObj.type);
    
    // CPT categories based on code ranges
    if (type === 'CPT') {
      const codeNum = parseInt(codeObj.code, 10);
      if (codeObj.code.endsWith('F')) return 'Category II - Performance Measurement';
      if (codeObj.code.endsWith('T')) return 'Category III - Emerging Technology';
      if (codeNum >= 10000 && codeNum <= 19999) return 'Integumentary System';
      if (codeNum >= 20000 && codeNum <= 29999) return 'Musculoskeletal System';
      if (codeNum >= 30000 && codeNum <= 32999) return 'Respiratory System';
      if (codeNum >= 33000 && codeNum <= 37999) return 'Cardiovascular System';
      if (codeNum >= 38000 && codeNum <= 38999) return 'Hemic and Lymphatic Systems';
      if (codeNum >= 40000 && codeNum <= 49999) return 'Digestive System';
      if (codeNum >= 50000 && codeNum <= 53999) return 'Urinary System';
      if (codeNum >= 54000 && codeNum <= 55999) return 'Male Genital System';
      if (codeNum >= 56000 && codeNum <= 59999) return 'Female Genital System';
      if (codeNum >= 60000 && codeNum <= 60999) return 'Endocrine System';
      if (codeNum >= 61000 && codeNum <= 64999) return 'Nervous System';
      if (codeNum >= 65000 && codeNum <= 68999) return 'Eye and Ocular Adnexa';
      if (codeNum >= 69000 && codeNum <= 69999) return 'Auditory System';
      if (codeNum >= 70000 && codeNum <= 79999) return 'Radiology';
      if (codeNum >= 80000 && codeNum <= 89999) return 'Pathology and Laboratory';
      if (codeNum >= 90000 && codeNum <= 99999) return 'Medicine';
      return 'CPT';
    }
    
    if (type === 'HCPCS') return 'HCPCS Level II';
    if (type === 'ICD10') return 'ICD-10 Diagnosis';
    if (type === 'ICD10-PCS') return 'ICD-10 Procedure';
    
    return type;
  }

  /**
   * Calculate payment values for different sites of service
   */
  calculatePayments(codeObj) {
    const payments = { ...DEFAULT_PAYMENTS };
    const type = this.normalizeType(codeObj.type);
    
    // Only calculate payments for CPT and HCPCS codes
    if (type !== 'CPT' && type !== 'HCPCS') {
      return payments;
    }

    const metadata = codeObj.metadata?.CPT || codeObj.metadata?.HCPCS || {};
    
    // Calculate OBL (Office-Based Lab / Non-Facility) payment
    // OBL = NONFACILITY_RVU * Conversion Factor
    if (metadata.NONFACILITY_RVU && metadata.NONFACILITY_RVU > 0) {
      payments.OBL = Math.round(metadata.NONFACILITY_RVU * CONVERSION_FACTORS.NONFACILITY_CF);
    }
    
    // Calculate HOPD (Hospital Outpatient) payment from APC
    if (metadata.APC && APC_RATES[metadata.APC]) {
      payments.HOPD = APC_RATES[metadata.APC];
    } else if (metadata.FACILITY_RVU && metadata.FACILITY_RVU > 0) {
      // Estimate from Facility RVU if no APC rate
      payments.HOPD = Math.round(metadata.FACILITY_RVU * CONVERSION_FACTORS.FACILITY_CF * 35);
    }
    
    // Calculate ASC (Ambulatory Surgical Center) payment
    // ASC is typically 60-80% of HOPD for surgical procedures
    if (payments.HOPD > 0) {
      payments.ASC = Math.round(payments.HOPD * 0.65);
    } else if (metadata.FACILITY_RVU && metadata.FACILITY_RVU > 0) {
      payments.ASC = Math.round(metadata.FACILITY_RVU * CONVERSION_FACTORS.ASC_CF * 20);
    }
    
    // Calculate IPPS (Inpatient Prospective Payment System) payment
    // IPPS is typically higher than HOPD for procedures
    if (payments.HOPD > 0) {
      payments.IPPS = Math.round(payments.HOPD * CONVERSION_FACTORS.IPPS_MULTIPLIER);
    } else if (metadata.FACILITY_RVU && metadata.FACILITY_RVU > 0) {
      payments.IPPS = Math.round(metadata.FACILITY_RVU * CONVERSION_FACTORS.FACILITY_CF * 50);
    }

    return payments;
  }

  /**
   * Extract metadata for display
   */
  extractMetadata(codeObj) {
    const type = this.normalizeType(codeObj.type);
    const typeKey = codeObj.type;
    const metadata = codeObj.metadata?.[typeKey] || {};

    return {
      apc: metadata.APC?.toString() || null,
      si: metadata.SI || null,
      rank: metadata.RANK || null,
      facilityRvu: metadata.FACILITY_RVU || null,
      nonfacilityRvu: metadata.NONFACILITY_RVU || null,
      mueUnit: metadata.MUE_UNIT || null,
      modifiers: metadata.MODIFIERS || [],
      effectiveDate: metadata.EFFECTIVE_DATE || null,
      guidelines: metadata.GUIDELINES || null,
      drg: null, // DRG mapping would come from separate data
    };
  }

  /**
   * Get payment for a specific site of service
   */
  getPaymentForSite(code, siteOfService) {
    const codeDetail = this.getCode(code);
    if (!codeDetail) return null;
    
    const site = siteOfService.toUpperCase();
    const siteMap = {
      'IPPS': 'IPPS',
      'INPATIENT': 'IPPS',
      'DRG': 'IPPS',
      'HOPD': 'HOPD',
      'OPPS': 'HOPD',
      'HOSPITAL_OUTPATIENT': 'HOPD',
      'ASC': 'ASC',
      'AMBULATORY': 'ASC',
      'OBL': 'OBL',
      'OFFICE': 'OBL',
      'NONFACILITY': 'OBL',
      'PHYSICIAN': 'OBL',
    };
    
    const normalizedSite = siteMap[site] || site;
    return codeDetail.payments[normalizedSite] || 0;
  }

  /**
   * Get statistics about loaded codes
   */
  getStats() {
    const stats = {
      totalCodes: this.codes.length,
      isLoaded: this.isLoaded,
      types: {},
    };
    
    for (const [type, codes] of this.typeIndex) {
      stats.types[type] = codes.length;
    }
    
    return stats;
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isLoaded && !this.loadError;
  }
}

// Singleton instance
const codeService = new CodeService();

export default codeService;
export { CodeService };

