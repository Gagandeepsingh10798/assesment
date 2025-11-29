/**
 * Code Intelligence Service
 * Provides efficient loading, indexing, and querying of medical codes (CPT, HCPCS, ICD-10/Dx, PCS)
 * Supports loading from chunked JSON files for better memory management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Code } from '../models/Code.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CodeService {
  constructor() {
    this.codes = [];
    this.codeIndex = new Map();      // code -> full object
    this.typeIndex = new Map();       // type -> [codes]
    this.searchIndex = [];            // Array for text search
    this._isLoaded = false;
    this.loadError = null;
    this.manifest = null;            // Manifest info when loading chunks
  }

  /**
   * Load and index codes - supports both chunked and single file loading
   */
  async loadCodes() {
    if (this._isLoaded) return;

    try {
      const chunksDir = path.join(__dirname, '..', '..', 'data', 'codes_chunks');
      const manifestPath = path.join(chunksDir, 'manifest.json');
      
      // Check if chunked files exist
      if (fs.existsSync(manifestPath)) {
        await this.loadFromChunks(chunksDir, manifestPath);
      } else {
        // Fallback to single file loading
        await this.loadFromSingleFile();
      }
      
      this._isLoaded = true;
    } catch (error) {
      console.error('Error loading codes:', error.message);
      this.loadError = error;
      throw error;
    }
  }

  /**
   * Load codes from chunked JSON files
   */
  async loadFromChunks(chunksDir, manifestPath) {
    console.log('Loading codes from chunked files...');
    const startTime = Date.now();
    
    // Read manifest
    const manifestData = fs.readFileSync(manifestPath, 'utf8');
    this.manifest = JSON.parse(manifestData);
    
    console.log(`Manifest: ${this.manifest.chunkCount} chunks, ${this.manifest.totalCodes} total codes`);
    
    // Load each chunk
    let loadedCodes = 0;
    for (let i = 0; i < this.manifest.chunks.length; i++) {
      const chunk = this.manifest.chunks[i];
      const chunkPath = path.join(chunksDir, chunk.fileName);
      
      const chunkStart = Date.now();
      const chunkData = fs.readFileSync(chunkPath, 'utf8');
      const chunkCodes = JSON.parse(chunkData);
      
      // Add to main codes array
      this.codes.push(...chunkCodes);
      loadedCodes += chunkCodes.length;
      
      console.log(`  Loaded ${chunk.fileName}: ${chunkCodes.length} codes (${Date.now() - chunkStart}ms)`);
    }
    
    console.log(`Loaded ${loadedCodes} codes from ${this.manifest.chunkCount} chunks in ${Date.now() - startTime}ms`);
    
    // Build indexes
    this.buildIndexes();
    
    console.log(`Total loading + indexing: ${Date.now() - startTime}ms`);
  }

  /**
   * Load codes from single JSON file (legacy/fallback)
   */
  async loadFromSingleFile() {
    const dataPath = path.join(__dirname, '..', '..', 'data', 'codes_2025.json');
    console.log('Loading codes from single file:', dataPath);
    
    const startTime = Date.now();
    
    // Read and parse JSON
    const rawData = fs.readFileSync(dataPath, 'utf8');
    this.codes = JSON.parse(rawData);
    
    console.log(`Loaded ${this.codes.length} codes in ${Date.now() - startTime}ms`);
    
    // Build indexes
    this.buildIndexes();
    
    console.log(`Indexing complete in ${Date.now() - startTime}ms`);
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
    try {
      const code = Code.fromRaw(codeObj);
      return code.toSummary();
    } catch (error) {
      // Fallback formatting
      return {
        code: codeObj.code,
        description: codeObj.description,
        category: codeObj.labels?.[0] || this.normalizeType(codeObj.type),
        type: this.normalizeType(codeObj.type),
        labels: codeObj.labels || [],
      };
    }
  }

  /**
   * Format code for detailed view with payments
   */
  formatCodeDetail(codeObj) {
    try {
      const code = Code.fromRaw(codeObj);
      return code.toDetail();
    } catch (error) {
      // Fallback formatting
      return {
        code: codeObj.code,
        description: codeObj.description,
        category: codeObj.labels?.[0] || this.normalizeType(codeObj.type),
        type: this.normalizeType(codeObj.type),
        labels: codeObj.labels || [],
        payments: { IPPS: 0, HOPD: 0, ASC: 0, OBL: 0 },
        optional: {},
        rawMetadata: codeObj.metadata,
      };
    }
  }

  /**
   * Get statistics about loaded codes
   */
  getStats() {
    const stats = {
      totalCodes: this.codes.length,
      isLoaded: this._isLoaded,
      types: {},
      loadMethod: this.manifest ? 'chunked' : 'single-file',
    };
    
    if (this.manifest) {
      stats.chunks = {
        count: this.manifest.chunkCount,
        targetSizeMB: this.manifest.targetChunkSizeMB,
        createdAt: this.manifest.createdAt,
      };
    }
    
    for (const [type, codes] of this.typeIndex) {
      stats.types[type] = codes.length;
    }
    
    return stats;
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this._isLoaded && !this.loadError;
  }
}

// Singleton instance
const codeService = new CodeService();

export default codeService;
export { CodeService };

