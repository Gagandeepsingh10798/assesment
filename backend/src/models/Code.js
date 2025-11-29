/**
 * Code Domain Model
 * Represents a medical procedure code (CPT, HCPCS, ICD-10)
 */

import config from '../config/index.js';

// APC Payment Rate lookup (approximate 2025 values)
const APC_RATES = {
  5193: 11639,
  5054: 2850,
  5055: 4200,
  5056: 6500,
  5183: 8500,
  5192: 9200,
  5194: 14500,
};

/**
 * Code model class
 */
class Code {
  constructor(data) {
    this.code = data.code;
    this.description = data.description;
    this.type = data.type;
    this.labels = data.labels || [];
    this.metadata = data.metadata || {};
  }

  /**
   * Create Code instance from raw data
   */
  static fromRaw(rawData) {
    if (!rawData || !rawData.code) {
      throw new Error('Invalid code data: code is required');
    }
    return new Code(rawData);
  }

  /**
   * Normalize code type
   */
  get normalizedType() {
    if (!this.type) return 'OTHER';
    const upperType = this.type.toUpperCase();
    if (upperType === 'DX') return 'ICD10';
    if (upperType === 'PCS') return 'ICD10-PCS';
    return upperType;
  }

  /**
   * Get category based on code structure
   */
  get category() {
    if (this.labels && this.labels.length > 0) {
      return this.labels[0];
    }

    const type = this.normalizedType;

    if (type === 'CPT') {
      return this._getCptCategory();
    }

    if (type === 'HCPCS') return 'HCPCS Level II';
    if (type === 'ICD10') return 'ICD-10 Diagnosis';
    if (type === 'ICD10-PCS') return 'ICD-10 Procedure';

    return type;
  }

  /**
   * Get CPT category based on code range
   */
  _getCptCategory() {
    const codeNum = parseInt(this.code, 10);

    if (this.code.endsWith('F')) return 'Category II - Performance Measurement';
    if (this.code.endsWith('T')) return 'Category III - Emerging Technology';
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

  /**
   * Calculate payments for all sites of service
   */
  calculatePayments() {
    const payments = { IPPS: 0, HOPD: 0, ASC: 0, OBL: 0 };
    const type = this.normalizedType;

    if (type !== 'CPT' && type !== 'HCPCS') {
      return payments;
    }

    const metadata = this.metadata?.CPT || this.metadata?.HCPCS || {};
    const { facilityConversionFactor, nonFacilityConversionFactor, ippsMultiplier } = config.cms;

    // OBL (Office-Based Lab / Non-Facility) payment
    if (metadata.NONFACILITY_RVU && metadata.NONFACILITY_RVU > 0) {
      payments.OBL = Math.round(metadata.NONFACILITY_RVU * nonFacilityConversionFactor);
    }

    // HOPD (Hospital Outpatient) payment from APC
    if (metadata.APC && APC_RATES[metadata.APC]) {
      payments.HOPD = APC_RATES[metadata.APC];
    } else if (metadata.FACILITY_RVU && metadata.FACILITY_RVU > 0) {
      payments.HOPD = Math.round(metadata.FACILITY_RVU * facilityConversionFactor * 35);
    }

    // ASC (Ambulatory Surgical Center) payment - typically 65% of HOPD
    if (payments.HOPD > 0) {
      payments.ASC = Math.round(payments.HOPD * 0.65);
    } else if (metadata.FACILITY_RVU && metadata.FACILITY_RVU > 0) {
      payments.ASC = Math.round(metadata.FACILITY_RVU * 50 * 20);
    }

    // IPPS (Inpatient) payment
    if (payments.HOPD > 0) {
      payments.IPPS = Math.round(payments.HOPD * ippsMultiplier);
    } else if (metadata.FACILITY_RVU && metadata.FACILITY_RVU > 0) {
      payments.IPPS = Math.round(metadata.FACILITY_RVU * facilityConversionFactor * 50);
    }

    return payments;
  }

  /**
   * Extract metadata for display
   */
  extractMetadata() {
    const typeKey = this.type;
    const metadata = this.metadata?.[typeKey] || {};

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
      drg: null,
    };
  }

  /**
   * Convert to summary format (for listings)
   */
  toSummary() {
    return {
      code: this.code,
      description: this.description,
      category: this.category,
      type: this.normalizedType,
      labels: this.labels,
    };
  }

  /**
   * Convert to detail format (for single code view)
   */
  toDetail() {
    const payments = this.calculatePayments();
    const metadata = this.extractMetadata();

    return {
      code: this.code,
      description: this.description,
      category: this.category,
      type: this.normalizedType,
      labels: this.labels,
      payments,
      optional: {
        drg: metadata.drg,
        apc: metadata.apc,
        si: metadata.si,
        rank: metadata.rank,
        modifiers: metadata.modifiers,
        effectiveDate: metadata.effectiveDate,
      },
      rawMetadata: this.metadata,
    };
  }

  /**
   * Get payment for specific site of service
   */
  getPaymentForSite(siteOfService) {
    const payments = this.calculatePayments();
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

    const site = siteOfService.toUpperCase();
    const normalizedSite = siteMap[site] || site;
    return payments[normalizedSite] || 0;
  }
}

export default Code;
export { Code, APC_RATES };

