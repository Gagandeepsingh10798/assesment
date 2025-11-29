/**
 * Reimbursement Calculation Service
 * Provides financial analysis for medical procedure reimbursement scenarios
 */

import codeService from './codeService.js';

// Classification thresholds (as percentage of total payment)
const CLASSIFICATION_THRESHOLDS = {
  PROFITABLE_MIN: 0.10,     // Margin > 10% of total = profitable
  BREAK_EVEN_MIN: -0.05,    // Margin between -5% and 10% = break-even
  // Below -5% = loss
};

// Site of service mapping
const SITE_MAPPING = {
  'IPPS': { name: 'Inpatient (DRG)', key: 'IPPS' },
  'INPATIENT': { name: 'Inpatient (DRG)', key: 'IPPS' },
  'DRG': { name: 'Inpatient (DRG)', key: 'IPPS' },
  'HOPD': { name: 'Hospital Outpatient (OPPS)', key: 'HOPD' },
  'OPPS': { name: 'Hospital Outpatient (OPPS)', key: 'HOPD' },
  'HOSPITAL_OUTPATIENT': { name: 'Hospital Outpatient (OPPS)', key: 'HOPD' },
  'ASC': { name: 'Ambulatory Surgical Center', key: 'ASC' },
  'AMBULATORY': { name: 'Ambulatory Surgical Center', key: 'ASC' },
  'OBL': { name: 'Office-Based Lab (Non-Facility)', key: 'OBL' },
  'OFFICE': { name: 'Office-Based Lab (Non-Facility)', key: 'OBL' },
  'NONFACILITY': { name: 'Office-Based Lab (Non-Facility)', key: 'OBL' },
  'PHYSICIAN': { name: 'Office-Based Lab (Non-Facility)', key: 'OBL' },
};

class ReimbursementService {
  /**
   * Calculate reimbursement scenario
   * @param {Object} params - Scenario parameters
   * @param {string} params.code - Procedure code (CPT/HCPCS)
   * @param {string} params.siteOfService - Site of service (IPPS/HOPD/ASC/OBL)
   * @param {number} params.deviceCost - Device/supply cost
   * @param {number} [params.ntapAddOn] - Optional NTAP add-on payment
   * @returns {Object} Reimbursement analysis
   */
  calculateScenario(params) {
    const { code, siteOfService, deviceCost, ntapAddOn = 0 } = params;

    // Validate inputs
    const validation = this.validateInputs(params);
    if (!validation.valid) {
      return {
        error: true,
        message: validation.message,
        details: validation.details,
      };
    }

    // Get code details
    const codeDetail = codeService.getCode(code);
    if (!codeDetail) {
      return {
        error: true,
        message: `Code not found: ${code}`,
        details: { code },
      };
    }

    // Normalize site of service
    const siteInfo = this.normalizeSite(siteOfService);
    if (!siteInfo) {
      return {
        error: true,
        message: `Invalid site of service: ${siteOfService}`,
        details: { siteOfService, validSites: Object.keys(SITE_MAPPING) },
      };
    }

    // Get base payment for site
    const basePayment = codeDetail.payments[siteInfo.key] || 0;
    
    // Calculate totals
    const addOnPayment = Math.max(0, ntapAddOn);
    const totalPayment = basePayment + addOnPayment;
    const margin = totalPayment - deviceCost;
    
    // Determine classification
    const classification = this.classifyMargin(margin, totalPayment);

    return {
      error: false,
      code: codeDetail.code,
      description: codeDetail.description,
      siteOfService: siteInfo.name,
      siteKey: siteInfo.key,
      basePayment,
      addOnPayment,
      totalPayment,
      deviceCost,
      margin,
      marginPercentage: totalPayment > 0 ? ((margin / totalPayment) * 100).toFixed(1) : 0,
      classification,
      breakdown: {
        basePayment: {
          label: 'Base Payment',
          value: basePayment,
          source: `${codeDetail.code} @ ${siteInfo.name}`,
        },
        addOnPayment: {
          label: 'NTAP Add-On',
          value: addOnPayment,
          source: addOnPayment > 0 ? 'New Technology Add-on Payment' : 'Not applied',
        },
        totalPayment: {
          label: 'Total Payment',
          value: totalPayment,
          formula: 'Base + Add-On',
        },
        deviceCost: {
          label: 'Device Cost',
          value: deviceCost,
          source: 'User provided',
        },
        margin: {
          label: 'Margin',
          value: margin,
          formula: 'Total Payment - Device Cost',
        },
      },
      codeDetails: {
        type: codeDetail.type,
        category: codeDetail.category,
        allPayments: codeDetail.payments,
        apc: codeDetail.optional.apc,
      },
    };
  }

  /**
   * Validate scenario inputs
   */
  validateInputs(params) {
    const errors = [];
    
    if (!params.code || typeof params.code !== 'string') {
      errors.push('Code is required and must be a string');
    }
    
    if (!params.siteOfService || typeof params.siteOfService !== 'string') {
      errors.push('Site of service is required and must be a string');
    }
    
    if (params.deviceCost === undefined || params.deviceCost === null) {
      errors.push('Device cost is required');
    } else if (typeof params.deviceCost !== 'number' || params.deviceCost < 0) {
      errors.push('Device cost must be a non-negative number');
    }
    
    if (params.ntapAddOn !== undefined && params.ntapAddOn !== null) {
      if (typeof params.ntapAddOn !== 'number' || params.ntapAddOn < 0) {
        errors.push('NTAP add-on must be a non-negative number');
      }
    }

    return {
      valid: errors.length === 0,
      message: errors.length > 0 ? 'Validation failed' : null,
      details: errors,
    };
  }

  /**
   * Normalize site of service to standard key
   */
  normalizeSite(siteOfService) {
    if (!siteOfService) return null;
    const key = siteOfService.toUpperCase().replace(/[^A-Z]/g, '');
    return SITE_MAPPING[key] || null;
  }

  /**
   * Classify margin as profitable, break-even, or loss
   */
  classifyMargin(margin, totalPayment) {
    if (totalPayment === 0) {
      return margin >= 0 ? 'break-even' : 'loss';
    }

    const marginRatio = margin / totalPayment;

    if (marginRatio >= CLASSIFICATION_THRESHOLDS.PROFITABLE_MIN) {
      return 'profitable';
    } else if (marginRatio >= CLASSIFICATION_THRESHOLDS.BREAK_EVEN_MIN) {
      return 'break-even';
    } else {
      return 'loss';
    }
  }

  /**
   * Compare reimbursement across all sites for a code
   */
  compareAllSites(code, deviceCost, ntapAddOn = 0) {
    const sites = ['IPPS', 'HOPD', 'ASC', 'OBL'];
    const comparisons = [];

    for (const site of sites) {
      const result = this.calculateScenario({
        code,
        siteOfService: site,
        deviceCost,
        ntapAddOn,
      });

      if (!result.error) {
        comparisons.push({
          site: result.siteOfService,
          siteKey: result.siteKey,
          basePayment: result.basePayment,
          totalPayment: result.totalPayment,
          margin: result.margin,
          marginPercentage: result.marginPercentage,
          classification: result.classification,
        });
      }
    }

    // Sort by margin (highest first)
    comparisons.sort((a, b) => b.margin - a.margin);

    return {
      code,
      deviceCost,
      ntapAddOn,
      comparisons,
      bestSite: comparisons.length > 0 ? comparisons[0] : null,
      worstSite: comparisons.length > 0 ? comparisons[comparisons.length - 1] : null,
    };
  }

  /**
   * Get classification thresholds (for documentation/UI)
   */
  getThresholds() {
    return {
      profitable: {
        condition: `Margin > ${CLASSIFICATION_THRESHOLDS.PROFITABLE_MIN * 100}% of Total Payment`,
        color: 'green',
        label: 'Profitable',
      },
      'break-even': {
        condition: `Margin between ${CLASSIFICATION_THRESHOLDS.BREAK_EVEN_MIN * 100}% and ${CLASSIFICATION_THRESHOLDS.PROFITABLE_MIN * 100}%`,
        color: 'yellow',
        label: 'Break-Even',
      },
      loss: {
        condition: `Margin < ${CLASSIFICATION_THRESHOLDS.BREAK_EVEN_MIN * 100}% of Total Payment`,
        color: 'red',
        label: 'Loss',
      },
    };
  }

  /**
   * Get list of valid sites of service
   */
  getValidSites() {
    return [
      { key: 'IPPS', name: 'Inpatient (DRG)', description: 'Inpatient Prospective Payment System' },
      { key: 'HOPD', name: 'Hospital Outpatient (OPPS)', description: 'Outpatient Prospective Payment System' },
      { key: 'ASC', name: 'Ambulatory Surgical Center', description: 'ASC Payment System' },
      { key: 'OBL', name: 'Office-Based Lab', description: 'Physician Fee Schedule (Non-Facility)' },
    ];
  }
}

// Singleton instance
const reimbursementService = new ReimbursementService();

export default reimbursementService;
export { ReimbursementService };

