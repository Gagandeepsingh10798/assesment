/**
 * ReimbursementScenario Domain Model
 * Represents a reimbursement calculation scenario
 */

import config from '../config/index.js';

// Site of service definitions
const SITES_OF_SERVICE = {
  IPPS: { key: 'IPPS', name: 'Inpatient (DRG)', description: 'Inpatient Prospective Payment System' },
  HOPD: { key: 'HOPD', name: 'Hospital Outpatient (OPPS)', description: 'Outpatient Prospective Payment System' },
  ASC: { key: 'ASC', name: 'Ambulatory Surgical Center', description: 'ASC Payment System' },
  OBL: { key: 'OBL', name: 'Office-Based Lab', description: 'Physician Fee Schedule (Non-Facility)' },
};

// Site mapping for input normalization
const SITE_MAPPING = {
  'IPPS': SITES_OF_SERVICE.IPPS,
  'INPATIENT': SITES_OF_SERVICE.IPPS,
  'DRG': SITES_OF_SERVICE.IPPS,
  'HOPD': SITES_OF_SERVICE.HOPD,
  'OPPS': SITES_OF_SERVICE.HOPD,
  'HOSPITAL_OUTPATIENT': SITES_OF_SERVICE.HOPD,
  'ASC': SITES_OF_SERVICE.ASC,
  'AMBULATORY': SITES_OF_SERVICE.ASC,
  'OBL': SITES_OF_SERVICE.OBL,
  'OFFICE': SITES_OF_SERVICE.OBL,
  'NONFACILITY': SITES_OF_SERVICE.OBL,
  'PHYSICIAN': SITES_OF_SERVICE.OBL,
};

/**
 * Classification types
 */
const Classifications = {
  PROFITABLE: 'profitable',
  BREAK_EVEN: 'break-even',
  LOSS: 'loss',
};

/**
 * ReimbursementScenario model class
 */
class ReimbursementScenario {
  constructor(params) {
    this.code = params.code;
    this.siteOfService = params.siteOfService;
    this.deviceCost = params.deviceCost;
    this.ntapAddOn = params.ntapAddOn || 0;
    this.codeDetail = params.codeDetail || null;
    
    // Calculated values
    this._siteInfo = null;
    this._basePayment = null;
    this._results = null;
  }

  /**
   * Create scenario from request data
   */
  static fromRequest(data) {
    return new ReimbursementScenario({
      code: data.code,
      siteOfService: data.siteOfService,
      deviceCost: parseFloat(data.deviceCost) || 0,
      ntapAddOn: parseFloat(data.ntapAddOn) || 0,
    });
  }

  /**
   * Validate scenario inputs
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];

    if (!this.code || typeof this.code !== 'string') {
      errors.push('Code is required and must be a string');
    }

    if (!this.siteOfService || typeof this.siteOfService !== 'string') {
      errors.push('Site of service is required and must be a string');
    } else {
      const normalizedSite = this._normalizeSite(this.siteOfService);
      if (!normalizedSite) {
        errors.push(`Invalid site of service: ${this.siteOfService}. Valid options: ${Object.keys(SITES_OF_SERVICE).join(', ')}`);
      }
    }

    if (this.deviceCost === undefined || this.deviceCost === null) {
      errors.push('Device cost is required');
    } else if (typeof this.deviceCost !== 'number' || this.deviceCost < 0) {
      errors.push('Device cost must be a non-negative number');
    }

    if (this.ntapAddOn !== undefined && this.ntapAddOn !== null) {
      if (typeof this.ntapAddOn !== 'number' || this.ntapAddOn < 0) {
        errors.push('NTAP add-on must be a non-negative number');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Normalize site of service input
   */
  _normalizeSite(site) {
    if (!site) return null;
    const key = site.toUpperCase().replace(/[^A-Z]/g, '');
    return SITE_MAPPING[key] || null;
  }

  /**
   * Get normalized site info
   */
  get siteInfo() {
    if (!this._siteInfo) {
      this._siteInfo = this._normalizeSite(this.siteOfService);
    }
    return this._siteInfo;
  }

  /**
   * Calculate the scenario
   * @param {Object} codeDetail - Code details with payments
   */
  calculate(codeDetail) {
    this.codeDetail = codeDetail;
    
    if (!this.siteInfo) {
      throw new Error(`Invalid site of service: ${this.siteOfService}`);
    }

    const basePayment = codeDetail.payments[this.siteInfo.key] || 0;
    const addOnPayment = Math.max(0, this.ntapAddOn);
    const totalPayment = basePayment + addOnPayment;
    const margin = totalPayment - this.deviceCost;
    const classification = this._classifyMargin(margin, totalPayment);

    this._results = {
      basePayment,
      addOnPayment,
      totalPayment,
      margin,
      marginPercentage: totalPayment > 0 ? ((margin / totalPayment) * 100) : 0,
      classification,
    };

    return this._results;
  }

  /**
   * Classify margin
   */
  _classifyMargin(margin, totalPayment) {
    const { profitableMinMargin, breakEvenMinMargin } = config.reimbursement;

    if (totalPayment === 0) {
      return margin >= 0 ? Classifications.BREAK_EVEN : Classifications.LOSS;
    }

    const marginRatio = margin / totalPayment;

    if (marginRatio >= profitableMinMargin) {
      return Classifications.PROFITABLE;
    } else if (marginRatio >= breakEvenMinMargin) {
      return Classifications.BREAK_EVEN;
    } else {
      return Classifications.LOSS;
    }
  }

  /**
   * Convert to response format
   */
  toResponse() {
    if (!this._results || !this.codeDetail) {
      throw new Error('Scenario must be calculated before converting to response');
    }

    return {
      code: this.codeDetail.code,
      description: this.codeDetail.description,
      siteOfService: this.siteInfo.name,
      siteKey: this.siteInfo.key,
      basePayment: this._results.basePayment,
      addOnPayment: this._results.addOnPayment,
      totalPayment: this._results.totalPayment,
      deviceCost: this.deviceCost,
      margin: this._results.margin,
      marginPercentage: this._results.marginPercentage.toFixed(1),
      classification: this._results.classification,
      breakdown: {
        basePayment: {
          label: 'Base Payment',
          value: this._results.basePayment,
          source: `${this.codeDetail.code} @ ${this.siteInfo.name}`,
        },
        addOnPayment: {
          label: 'NTAP Add-On',
          value: this._results.addOnPayment,
          source: this._results.addOnPayment > 0 ? 'New Technology Add-on Payment' : 'Not applied',
        },
        totalPayment: {
          label: 'Total Payment',
          value: this._results.totalPayment,
          formula: 'Base + Add-On',
        },
        deviceCost: {
          label: 'Device Cost',
          value: this.deviceCost,
          source: 'User provided',
        },
        margin: {
          label: 'Margin',
          value: this._results.margin,
          formula: 'Total Payment - Device Cost',
        },
      },
      codeDetails: {
        type: this.codeDetail.type,
        category: this.codeDetail.category,
        allPayments: this.codeDetail.payments,
        apc: this.codeDetail.optional?.apc,
      },
    };
  }

  /**
   * Get valid sites of service
   */
  static getValidSites() {
    return Object.values(SITES_OF_SERVICE);
  }

  /**
   * Get classification thresholds
   */
  static getThresholds() {
    const { profitableMinMargin, breakEvenMinMargin } = config.reimbursement;
    
    return {
      profitable: {
        condition: `Margin > ${profitableMinMargin * 100}% of Total Payment`,
        color: 'green',
        label: 'Profitable',
      },
      'break-even': {
        condition: `Margin between ${breakEvenMinMargin * 100}% and ${profitableMinMargin * 100}%`,
        color: 'yellow',
        label: 'Break-Even',
      },
      loss: {
        condition: `Margin < ${breakEvenMinMargin * 100}% of Total Payment`,
        color: 'red',
        label: 'Loss',
      },
    };
  }
}

export default ReimbursementScenario;
export { ReimbursementScenario, SITES_OF_SERVICE, Classifications };

