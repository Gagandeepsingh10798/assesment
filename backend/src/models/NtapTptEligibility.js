/**
 * NTAP/TPT Eligibility Domain Models
 * Models for New Technology Add-on Payment and Transitional Pass-Through eligibility
 */

import config from '../config/index.js';

/**
 * Eligibility status types
 */
const EligibilityStatus = {
  LIKELY_ELIGIBLE: 'likely_eligible',
  NEEDS_REVIEW: 'needs_review',
  NOT_ELIGIBLE: 'not_eligible',
};

/**
 * Clinical improvement categories
 */
const CLINICAL_IMPROVEMENTS = [
  'Reduced mortality',
  'Reduced complications',
  'Reduced hospital stay',
  'Improved patient outcomes',
  'Reduced readmissions',
  'Treatment for unmet need',
];

/**
 * TPT product categories
 */
const TPT_CATEGORIES = ['device', 'drug', 'biological'];

/**
 * NTAP Eligibility Model
 */
class NtapEligibility {
  constructor(params) {
    this.deviceName = params.deviceName;
    this.manufacturer = params.manufacturer;
    this.deviceCost = params.deviceCost;
    this.drgCode = params.drgCode;
    this.drgPayment = params.drgPayment || 0;
    this.fdaApprovalDate = params.fdaApprovalDate;
    this.fdaApprovalType = params.fdaApprovalType;
    this.clinicalImprovements = params.clinicalImprovements || [];
  }

  /**
   * Create from request data
   */
  static fromRequest(data) {
    return new NtapEligibility({
      deviceName: data.deviceName,
      manufacturer: data.manufacturer,
      deviceCost: parseFloat(data.deviceCost) || 0,
      drgCode: data.drgCode,
      drgPayment: parseFloat(data.drgPayment) || 0,
      fdaApprovalDate: data.fdaApprovalDate,
      fdaApprovalType: data.fdaApprovalType,
      clinicalImprovements: data.clinicalImprovements || [],
    });
  }

  /**
   * Check eligibility criteria
   */
  checkEligibility() {
    const criteria = [];
    let overallEligible = true;
    let needsReview = false;

    // 1. Newness criteria (FDA approval within 2-3 years)
    const newnessCriteria = this._checkNewness();
    criteria.push(newnessCriteria);
    if (!newnessCriteria.met) overallEligible = false;

    // 2. Cost threshold
    const costCriteria = this._checkCostThreshold();
    criteria.push(costCriteria);
    if (!costCriteria.met) overallEligible = false;

    // 3. Not in current weights (always needs verification)
    const weightsCriteria = this._checkNotInWeights();
    criteria.push(weightsCriteria);
    needsReview = true;

    // 4. Clinical improvement
    const clinicalCriteria = this._checkClinicalImprovement();
    criteria.push(clinicalCriteria);
    if (!clinicalCriteria.met) needsReview = true;

    // Determine overall status
    let status = EligibilityStatus.NOT_ELIGIBLE;
    if (overallEligible && !needsReview) {
      status = EligibilityStatus.LIKELY_ELIGIBLE;
    } else if (overallEligible || needsReview) {
      status = EligibilityStatus.NEEDS_REVIEW;
    }

    return {
      status,
      criteria,
      criteriaMetCount: criteria.filter(c => c.met).length,
      totalCriteria: criteria.length,
    };
  }

  _checkNewness() {
    const fdaDate = new Date(this.fdaApprovalDate);
    const now = new Date();
    const yearsOld = (now - fdaDate) / (365.25 * 24 * 60 * 60 * 1000);

    return {
      criterion: 'Newness',
      description: 'FDA approval within qualifying timeframe (2-3 years)',
      met: yearsOld <= 3,
      details: yearsOld <= 3
        ? `Approved ${yearsOld.toFixed(1)} years ago - within timeframe`
        : `Approved ${yearsOld.toFixed(1)} years ago - may not qualify as "new"`,
    };
  }

  _checkCostThreshold() {
    const costThreshold = this.drgPayment * config.ntap.costThresholdMultiplier;
    const meetsThreshold = this.deviceCost > costThreshold;

    return {
      criterion: 'Cost Threshold',
      description: 'Device cost exceeds DRG payment threshold',
      met: meetsThreshold,
      details: meetsThreshold
        ? `Device cost ($${this.deviceCost.toLocaleString()}) exceeds threshold ($${costThreshold.toLocaleString()})`
        : `Device cost ($${this.deviceCost.toLocaleString()}) does not exceed threshold ($${costThreshold.toLocaleString()})`,
    };
  }

  _checkNotInWeights() {
    return {
      criterion: 'Not in Current Weights',
      description: 'Technology not yet reflected in DRG payment weights',
      met: true,
      details: 'Requires CMS verification - assumed not in current weights for new FDA approvals',
    };
  }

  _checkClinicalImprovement() {
    const validImprovements = this.clinicalImprovements.filter(imp =>
      CLINICAL_IMPROVEMENTS.some(cat =>
        cat.toLowerCase().includes(imp.toLowerCase()) ||
        imp.toLowerCase().includes(cat.toLowerCase())
      )
    );

    return {
      criterion: 'Substantial Clinical Improvement',
      description: 'Demonstrates meaningful clinical benefit over existing treatments',
      met: validImprovements.length > 0,
      details: validImprovements.length > 0
        ? `Claims: ${validImprovements.join(', ')}`
        : 'No clinical improvement claims provided - documentation required',
    };
  }

  /**
   * Calculate potential NTAP payment
   */
  calculatePayment() {
    const costDifference = this.deviceCost - this.drgPayment;

    if (costDifference <= 0) {
      return {
        eligible: false,
        ntapPayment: 0,
        reason: 'Device cost does not exceed DRG payment',
      };
    }

    const calculatedNtap = costDifference * config.ntap.percentage;
    const ntapPayment = Math.min(calculatedNtap, config.ntap.maxCap);

    return {
      eligible: true,
      deviceCost: this.deviceCost,
      drgPayment: this.drgPayment,
      costDifference,
      ntapPercentage: config.ntap.percentage * 100,
      calculatedNtap: Math.round(calculatedNtap),
      maxCap: config.ntap.maxCap,
      ntapPayment: Math.round(ntapPayment),
      totalReimbursement: Math.round(this.drgPayment + ntapPayment),
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(eligibilityResult) {
    const recommendations = [];

    eligibilityResult.criteria.forEach(c => {
      if (!c.met) {
        switch (c.criterion) {
          case 'Newness':
            recommendations.push('Consider applying in next fiscal year if technology becomes newly eligible');
            break;
          case 'Cost Threshold':
            recommendations.push('Review device pricing or identify additional costs that may be included');
            break;
          case 'Substantial Clinical Improvement':
            recommendations.push('Compile clinical trial data demonstrating improvement over existing treatments');
            recommendations.push('Document specific clinical benefits (mortality, complications, outcomes)');
            break;
        }
      }
    });

    if (eligibilityResult.status === EligibilityStatus.LIKELY_ELIGIBLE) {
      recommendations.push('Prepare formal NTAP application for CMS submission');
      recommendations.push('Gather supporting clinical documentation and cost data');
    }

    return recommendations;
  }

  /**
   * Convert to response format
   */
  toResponse(eligibilityResult, potentialPayment = null) {
    const recommendations = this.generateRecommendations(eligibilityResult);

    return {
      status: eligibilityResult.status,
      statusLabel: this._getStatusLabel(eligibilityResult.status),
      technology: {
        name: this.deviceName,
        manufacturer: this.manufacturer,
        deviceCost: this.deviceCost,
        fdaApprovalDate: this.fdaApprovalDate,
        fdaApprovalType: this.fdaApprovalType,
      },
      eligibilityCriteria: eligibilityResult.criteria,
      criteriaMetCount: eligibilityResult.criteriaMetCount,
      totalCriteria: eligibilityResult.totalCriteria,
      potentialPayment,
      recommendations,
    };
  }

  _getStatusLabel(status) {
    switch (status) {
      case EligibilityStatus.LIKELY_ELIGIBLE: return 'Likely Eligible';
      case EligibilityStatus.NEEDS_REVIEW: return 'Needs Review';
      default: return 'Not Eligible';
    }
  }

  /**
   * Get valid clinical improvements
   */
  static getValidClinicalImprovements() {
    return CLINICAL_IMPROVEMENTS;
  }
}

/**
 * TPT Eligibility Model
 */
class TptEligibility {
  constructor(params) {
    this.deviceName = params.deviceName;
    this.manufacturer = params.manufacturer;
    this.deviceCost = params.deviceCost;
    this.apcCode = params.apcCode;
    this.apcPayment = params.apcPayment || 0;
    this.fdaApprovalDate = params.fdaApprovalDate;
    this.fdaApprovalType = params.fdaApprovalType;
    this.category = params.category || 'device';
  }

  /**
   * Create from request data
   */
  static fromRequest(data) {
    return new TptEligibility({
      deviceName: data.deviceName,
      manufacturer: data.manufacturer,
      deviceCost: parseFloat(data.deviceCost) || 0,
      apcCode: data.apcCode,
      apcPayment: parseFloat(data.apcPayment) || 0,
      fdaApprovalDate: data.fdaApprovalDate,
      fdaApprovalType: data.fdaApprovalType,
      category: data.category || 'device',
    });
  }

  /**
   * Check eligibility criteria
   */
  checkEligibility() {
    const criteria = [];
    let overallEligible = true;
    let needsReview = false;

    // 1. Newness criteria
    const newnessCriteria = this._checkNewness();
    criteria.push(newnessCriteria);
    if (!newnessCriteria.met) overallEligible = false;

    // 2. Category validity
    const categoryCriteria = this._checkCategory();
    criteria.push(categoryCriteria);
    if (!categoryCriteria.met) overallEligible = false;

    // 3. Cost significance
    const costCriteria = this._checkCostSignificance();
    criteria.push(costCriteria);
    if (!costCriteria.met) needsReview = true;

    // 4. Not packaged
    const packagedCriteria = this._checkNotPackaged();
    criteria.push(packagedCriteria);
    needsReview = true;

    // Determine overall status
    let status = EligibilityStatus.NOT_ELIGIBLE;
    if (overallEligible && !needsReview) {
      status = EligibilityStatus.LIKELY_ELIGIBLE;
    } else if (overallEligible || needsReview) {
      status = EligibilityStatus.NEEDS_REVIEW;
    }

    return {
      status,
      criteria,
      criteriaMetCount: criteria.filter(c => c.met).length,
      totalCriteria: criteria.length,
    };
  }

  _checkNewness() {
    const fdaDate = new Date(this.fdaApprovalDate);
    const now = new Date();
    const yearsOld = (now - fdaDate) / (365.25 * 24 * 60 * 60 * 1000);

    return {
      criterion: 'Newness',
      description: `Recent FDA approval (within ${config.tpt.maxPassThroughDuration}-year window)`,
      met: yearsOld <= config.tpt.maxPassThroughDuration,
      details: yearsOld <= config.tpt.maxPassThroughDuration
        ? `Approved ${yearsOld.toFixed(1)} years ago - within window`
        : `Approved ${yearsOld.toFixed(1)} years ago - exceeds pass-through duration`,
    };
  }

  _checkCategory() {
    const isValid = TPT_CATEGORIES.includes(this.category.toLowerCase());

    return {
      criterion: 'Eligible Category',
      description: 'Must be a device, drug, or biological',
      met: isValid,
      details: `Category: ${this.category} - ${isValid ? 'Valid' : 'Invalid'}`,
    };
  }

  _checkCostSignificance() {
    const costSignificant = this.apcPayment > 0 && this.deviceCost > (this.apcPayment * 0.15);

    return {
      criterion: 'Cost Significance',
      description: 'Device cost represents significant portion of procedure cost',
      met: costSignificant,
      details: this.apcPayment > 0
        ? `Device cost ($${this.deviceCost.toLocaleString()}) is ${((this.deviceCost / this.apcPayment) * 100).toFixed(1)}% of APC payment`
        : 'APC payment not specified',
    };
  }

  _checkNotPackaged() {
    return {
      criterion: 'Not Packaged',
      description: 'Device/drug not already packaged into APC payment',
      met: true,
      details: 'Requires CMS verification - assumed not currently packaged for new approvals',
    };
  }

  /**
   * Calculate potential TPT payment
   */
  calculatePayment() {
    const packagedAmount = Math.round(this.apcPayment * 0.1);
    const passThroughPayment = Math.max(0, this.deviceCost - packagedAmount);

    return {
      deviceCost: this.deviceCost,
      apcCode: this.apcCode,
      apcPayment: this.apcPayment,
      packagedAmount,
      passThroughPayment: Math.round(passThroughPayment),
      totalReimbursement: Math.round(this.apcPayment + passThroughPayment),
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(eligibilityResult) {
    const recommendations = [];

    eligibilityResult.criteria.forEach(c => {
      if (!c.met) {
        switch (c.criterion) {
          case 'Newness':
            recommendations.push('Pass-through status may have expired - verify with CMS');
            break;
          case 'Cost Significance':
            recommendations.push('Consider if separate payment is warranted given cost relative to APC');
            break;
        }
      }
    });

    if (eligibilityResult.status === EligibilityStatus.LIKELY_ELIGIBLE ||
        eligibilityResult.status === EligibilityStatus.NEEDS_REVIEW) {
      recommendations.push('Prepare HCPCS code application if not already assigned');
      recommendations.push('Submit pass-through application to CMS with supporting cost data');
    }

    return recommendations;
  }

  /**
   * Convert to response format
   */
  toResponse(eligibilityResult, potentialPayment = null) {
    const recommendations = this.generateRecommendations(eligibilityResult);

    return {
      status: eligibilityResult.status,
      statusLabel: this._getStatusLabel(eligibilityResult.status),
      technology: {
        name: this.deviceName,
        manufacturer: this.manufacturer,
        deviceCost: this.deviceCost,
        category: this.category,
        fdaApprovalDate: this.fdaApprovalDate,
        fdaApprovalType: this.fdaApprovalType,
      },
      eligibilityCriteria: eligibilityResult.criteria,
      criteriaMetCount: eligibilityResult.criteriaMetCount,
      totalCriteria: eligibilityResult.totalCriteria,
      potentialPayment,
      recommendations,
    };
  }

  _getStatusLabel(status) {
    switch (status) {
      case EligibilityStatus.LIKELY_ELIGIBLE: return 'Likely Eligible';
      case EligibilityStatus.NEEDS_REVIEW: return 'Needs Review';
      default: return 'Not Eligible';
    }
  }

  /**
   * Get valid categories
   */
  static getValidCategories() {
    return TPT_CATEGORIES;
  }
}

export {
  NtapEligibility,
  TptEligibility,
  EligibilityStatus,
  CLINICAL_IMPROVEMENTS,
  TPT_CATEGORIES,
};

