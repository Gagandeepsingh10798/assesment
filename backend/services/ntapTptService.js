/**
 * NTAP/TPT Service
 * Provides calculations, eligibility checking, and document generation for
 * New Technology Add-on Payment (NTAP) and Transitional Pass-Through (TPT) programs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load mock data
let ntapData = null;
let tptData = null;

function loadData() {
  if (!ntapData) {
    const ntapPath = path.join(__dirname, '..', 'data', 'ntap_approved.json');
    ntapData = JSON.parse(fs.readFileSync(ntapPath, 'utf8'));
  }
  if (!tptData) {
    const tptPath = path.join(__dirname, '..', 'data', 'tpt_approved.json');
    tptData = JSON.parse(fs.readFileSync(tptPath, 'utf8'));
  }
}

// ============================================
// NTAP CALCULATIONS
// ============================================

/**
 * Calculate NTAP payment for a technology
 * Formula: NTAP = min(65% × (device_cost - DRG_payment), max_cap)
 */
function calculateNtapPayment(params) {
  loadData();
  
  const {
    deviceCost,
    drgCode,
    drgPayment: providedDrgPayment,
  } = params;

  // Get DRG base payment from data or use provided value
  const drgPayment = providedDrgPayment || ntapData.drgBasePayments[drgCode] || 0;
  
  if (!deviceCost || deviceCost <= 0) {
    return {
      error: true,
      message: 'Device cost is required and must be positive',
    };
  }

  // NTAP calculation parameters
  const ntapPercentage = ntapData.ntapPercentage || 0.65;
  const maxCap = ntapData.maxNtapCap || 150000;

  // Calculate the cost difference
  const costDifference = deviceCost - drgPayment;
  
  // If device cost doesn't exceed DRG payment, no NTAP
  if (costDifference <= 0) {
    return {
      eligible: false,
      deviceCost,
      drgCode,
      drgPayment,
      costDifference,
      ntapPayment: 0,
      reason: 'Device cost does not exceed DRG payment',
    };
  }

  // Calculate NTAP payment
  const calculatedNtap = costDifference * ntapPercentage;
  const ntapPayment = Math.min(calculatedNtap, maxCap);

  return {
    eligible: true,
    deviceCost,
    drgCode,
    drgPayment,
    costDifference,
    ntapPercentage: ntapPercentage * 100,
    calculatedNtap: Math.round(calculatedNtap),
    maxCap,
    ntapPayment: Math.round(ntapPayment),
    totalReimbursement: Math.round(drgPayment + ntapPayment),
    breakdown: {
      baseDrgPayment: drgPayment,
      ntapAddOn: Math.round(ntapPayment),
      total: Math.round(drgPayment + ntapPayment),
    },
  };
}

/**
 * Check NTAP eligibility based on criteria
 */
function checkNtapEligibility(params) {
  loadData();

  const {
    deviceName,
    manufacturer,
    deviceCost,
    drgCode,
    fdaApprovalDate,
    fdaApprovalType,
    clinicalImprovements = [],
  } = params;

  const eligibilityCriteria = [];
  let overallEligible = true;
  let needsReview = false;

  // 1. Check FDA approval date (must be within 2-3 years)
  const fdaDate = new Date(fdaApprovalDate);
  const now = new Date();
  const yearsOld = (now - fdaDate) / (365.25 * 24 * 60 * 60 * 1000);
  
  const newnessCriteria = {
    criterion: 'Newness',
    description: 'FDA approval within qualifying timeframe (2-3 years)',
    met: yearsOld <= 3,
    details: yearsOld <= 3 
      ? `Approved ${yearsOld.toFixed(1)} years ago - within timeframe`
      : `Approved ${yearsOld.toFixed(1)} years ago - may not qualify as "new"`,
  };
  eligibilityCriteria.push(newnessCriteria);
  if (!newnessCriteria.met) overallEligible = false;

  // 2. Check cost threshold
  const drgPayment = ntapData.drgBasePayments[drgCode] || 0;
  const costThreshold = drgPayment * (ntapData.costThresholdMultiplier || 1.0);
  const meetsThreshold = deviceCost > costThreshold;
  
  const costCriteria = {
    criterion: 'Cost Threshold',
    description: 'Device cost exceeds DRG payment threshold',
    met: meetsThreshold,
    details: meetsThreshold
      ? `Device cost ($${deviceCost.toLocaleString()}) exceeds threshold ($${costThreshold.toLocaleString()})`
      : `Device cost ($${deviceCost.toLocaleString()}) does not exceed threshold ($${costThreshold.toLocaleString()})`,
  };
  eligibilityCriteria.push(costCriteria);
  if (!costCriteria.met) overallEligible = false;

  // 3. Check not already in DRG weights
  const notInWeightsCriteria = {
    criterion: 'Not in Current Weights',
    description: 'Technology not yet reflected in DRG payment weights',
    met: true, // Assume true for new technologies
    details: 'Requires CMS verification - assumed not in current weights for new FDA approvals',
  };
  eligibilityCriteria.push(notInWeightsCriteria);
  needsReview = true;

  // 4. Check substantial clinical improvement
  const clinicalImprovementCategories = [
    'Reduced mortality',
    'Reduced complications',
    'Reduced hospital stay',
    'Improved patient outcomes',
    'Reduced readmissions',
    'Treatment for unmet need',
  ];
  
  const validImprovements = clinicalImprovements.filter(imp => 
    clinicalImprovementCategories.some(cat => 
      cat.toLowerCase().includes(imp.toLowerCase()) || 
      imp.toLowerCase().includes(cat.toLowerCase())
    )
  );

  const clinicalCriteria = {
    criterion: 'Substantial Clinical Improvement',
    description: 'Demonstrates meaningful clinical benefit over existing treatments',
    met: validImprovements.length > 0,
    details: validImprovements.length > 0
      ? `Claims: ${validImprovements.join(', ')}`
      : 'No clinical improvement claims provided - documentation required',
  };
  eligibilityCriteria.push(clinicalCriteria);
  if (!clinicalCriteria.met) {
    needsReview = true;
  }

  // Calculate potential NTAP payment if eligible
  let potentialPayment = null;
  if (overallEligible || needsReview) {
    const calculation = calculateNtapPayment({ deviceCost, drgCode });
    if (!calculation.error) {
      potentialPayment = calculation;
    }
  }

  // Determine overall status
  let status = 'not_eligible';
  if (overallEligible && !needsReview) {
    status = 'likely_eligible';
  } else if (overallEligible || needsReview) {
    status = 'needs_review';
  }

  return {
    status,
    statusLabel: status === 'likely_eligible' ? 'Likely Eligible' 
                : status === 'needs_review' ? 'Needs Review' 
                : 'Not Eligible',
    technology: {
      name: deviceName,
      manufacturer,
      deviceCost,
      fdaApprovalDate,
      fdaApprovalType,
    },
    eligibilityCriteria,
    criteriaMetCount: eligibilityCriteria.filter(c => c.met).length,
    totalCriteria: eligibilityCriteria.length,
    potentialPayment,
    recommendations: generateNtapRecommendations(eligibilityCriteria, status),
  };
}

function generateNtapRecommendations(criteria, status) {
  const recommendations = [];
  
  criteria.forEach(c => {
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

  if (status === 'likely_eligible') {
    recommendations.push('Prepare formal NTAP application for CMS submission');
    recommendations.push('Gather supporting clinical documentation and cost data');
  }

  return recommendations;
}

/**
 * Get list of approved NTAP technologies
 */
function getApprovedNtapTechnologies() {
  loadData();
  return {
    fiscalYear: ntapData.fiscalYear,
    lastUpdated: ntapData.lastUpdated,
    technologies: ntapData.technologies,
    totalCount: ntapData.technologies.length,
  };
}

// ============================================
// TPT CALCULATIONS
// ============================================

/**
 * Calculate TPT (Transitional Pass-Through) payment
 * Formula: TPT = device_cost - packaged_APC_payment
 */
function calculateTptPayment(params) {
  loadData();

  const {
    deviceCost,
    apcCode,
    packagedPayment: providedPackagedPayment,
  } = params;

  // Get APC base payment from data or use provided value
  const apcPayment = providedPackagedPayment || tptData.apcBasePayments[apcCode] || 0;

  if (!deviceCost || deviceCost <= 0) {
    return {
      error: true,
      message: 'Device cost is required and must be positive',
    };
  }

  // TPT is the difference between device cost and what's packaged in APC
  const passThroughPayment = Math.max(0, deviceCost - (apcPayment * 0.1)); // Packaged portion is ~10% of APC

  return {
    deviceCost,
    apcCode,
    apcPayment,
    packagedAmount: Math.round(apcPayment * 0.1),
    passThroughPayment: Math.round(passThroughPayment),
    totalReimbursement: Math.round(apcPayment + passThroughPayment),
    breakdown: {
      baseApcPayment: apcPayment,
      devicePassThrough: Math.round(passThroughPayment),
      total: Math.round(apcPayment + passThroughPayment),
    },
  };
}

/**
 * Check TPT eligibility
 */
function checkTptEligibility(params) {
  loadData();

  const {
    deviceName,
    manufacturer,
    deviceCost,
    apcCode,
    fdaApprovalDate,
    fdaApprovalType,
    category = 'device', // device, drug, or biological
  } = params;

  const eligibilityCriteria = [];
  let overallEligible = true;
  let needsReview = false;

  // 1. Check FDA approval date (must be recent)
  const fdaDate = new Date(fdaApprovalDate);
  const now = new Date();
  const yearsOld = (now - fdaDate) / (365.25 * 24 * 60 * 60 * 1000);
  
  const newnessCriteria = {
    criterion: 'Newness',
    description: 'Recent FDA approval (within pass-through duration)',
    met: yearsOld <= tptData.maxPassThroughDuration,
    details: yearsOld <= tptData.maxPassThroughDuration
      ? `Approved ${yearsOld.toFixed(1)} years ago - within ${tptData.maxPassThroughDuration}-year window`
      : `Approved ${yearsOld.toFixed(1)} years ago - exceeds pass-through duration`,
  };
  eligibilityCriteria.push(newnessCriteria);
  if (!newnessCriteria.met) overallEligible = false;

  // 2. Check category validity
  const validCategories = ['device', 'drug', 'biological'];
  const categoryCriteria = {
    criterion: 'Eligible Category',
    description: 'Must be a device, drug, or biological',
    met: validCategories.includes(category.toLowerCase()),
    details: `Category: ${category} - ${validCategories.includes(category.toLowerCase()) ? 'Valid' : 'Invalid'}`,
  };
  eligibilityCriteria.push(categoryCriteria);
  if (!categoryCriteria.met) overallEligible = false;

  // 3. Check cost significance
  const apcPayment = tptData.apcBasePayments[apcCode] || 0;
  const costSignificant = deviceCost > (apcPayment * 0.15); // Device should be significant portion
  
  const costCriteria = {
    criterion: 'Cost Significance',
    description: 'Device cost represents significant portion of procedure cost',
    met: costSignificant,
    details: `Device cost ($${deviceCost.toLocaleString()}) is ${((deviceCost / apcPayment) * 100).toFixed(1)}% of APC payment`,
  };
  eligibilityCriteria.push(costCriteria);
  if (!costCriteria.met) needsReview = true;

  // 4. Check not already packaged
  const notPackagedCriteria = {
    criterion: 'Not Packaged',
    description: 'Device/drug not already packaged into APC payment',
    met: true, // Assume true for new items
    details: 'Requires CMS verification - assumed not currently packaged for new approvals',
  };
  eligibilityCriteria.push(notPackagedCriteria);
  needsReview = true;

  // Calculate potential payment
  let potentialPayment = null;
  if (overallEligible || needsReview) {
    potentialPayment = calculateTptPayment({ deviceCost, apcCode });
  }

  let status = 'not_eligible';
  if (overallEligible && !needsReview) {
    status = 'likely_eligible';
  } else if (overallEligible || needsReview) {
    status = 'needs_review';
  }

  return {
    status,
    statusLabel: status === 'likely_eligible' ? 'Likely Eligible' 
                : status === 'needs_review' ? 'Needs Review' 
                : 'Not Eligible',
    technology: {
      name: deviceName,
      manufacturer,
      deviceCost,
      category,
      fdaApprovalDate,
      fdaApprovalType,
    },
    eligibilityCriteria,
    criteriaMetCount: eligibilityCriteria.filter(c => c.met).length,
    totalCriteria: eligibilityCriteria.length,
    potentialPayment,
    recommendations: generateTptRecommendations(eligibilityCriteria, status),
  };
}

function generateTptRecommendations(criteria, status) {
  const recommendations = [];
  
  criteria.forEach(c => {
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

  if (status === 'likely_eligible' || status === 'needs_review') {
    recommendations.push('Prepare HCPCS code application if not already assigned');
    recommendations.push('Submit pass-through application to CMS with supporting cost data');
  }

  return recommendations;
}

/**
 * Get list of approved TPT technologies
 */
function getApprovedTptTechnologies() {
  loadData();
  return {
    fiscalYear: tptData.fiscalYear,
    lastUpdated: tptData.lastUpdated,
    maxDuration: tptData.maxPassThroughDuration,
    technologies: tptData.technologies,
    totalCount: tptData.technologies.length,
  };
}

// ============================================
// APPLICATION DOCUMENT GENERATION
// ============================================

/**
 * Generate NTAP application document
 */
function generateNtapApplication(params) {
  const {
    deviceName,
    manufacturer,
    manufacturerAddress,
    contactName,
    contactEmail,
    contactPhone,
    deviceDescription,
    deviceCost,
    indicatedProcedures = [],
    applicableDRGs = [],
    fdaApprovalDate,
    fdaApprovalType,
    fdaNumber,
    clinicalTrials = [],
    clinicalImprovements = [],
    costJustification,
  } = params;

  const applicationDate = new Date().toISOString().split('T')[0];
  const fiscalYear = new Date().getFullYear() + (new Date().getMonth() >= 7 ? 1 : 0);

  // Calculate potential payment
  const drgCode = applicableDRGs[0];
  const paymentCalc = drgCode ? calculateNtapPayment({ deviceCost, drgCode }) : null;

  const document = {
    documentType: 'NTAP Application',
    generatedDate: applicationDate,
    fiscalYear: `FY${fiscalYear}`,
    status: 'DRAFT',
    
    sections: {
      coverPage: {
        title: `NEW TECHNOLOGY ADD-ON PAYMENT APPLICATION`,
        subtitle: `Fiscal Year ${fiscalYear}`,
        technology: deviceName,
        applicant: manufacturer,
        submissionDate: applicationDate,
      },

      section1_applicantInfo: {
        title: 'Section 1: Applicant Information',
        fields: {
          manufacturerName: manufacturer,
          manufacturerAddress: manufacturerAddress || '[Address Required]',
          contactPerson: contactName || '[Contact Name Required]',
          contactEmail: contactEmail || '[Email Required]',
          contactPhone: contactPhone || '[Phone Required]',
        },
      },

      section2_technologyDescription: {
        title: 'Section 2: Technology Description',
        fields: {
          deviceName: deviceName,
          description: deviceDescription || '[Detailed description required]',
          mechanismOfAction: '[Describe how the technology works]',
          indicatedUse: '[FDA-approved indications]',
          targetPopulation: '[Patient population that would benefit]',
        },
      },

      section3_regulatoryStatus: {
        title: 'Section 3: Regulatory Status',
        fields: {
          fdaApprovalType: fdaApprovalType || '[PMA/510(k)/BLA]',
          fdaApprovalNumber: fdaNumber || '[FDA Number Required]',
          fdaApprovalDate: fdaApprovalDate || '[Date Required]',
          labeledIndications: '[List all FDA-approved indications]',
        },
      },

      section4_newnessCriteria: {
        title: 'Section 4: Newness Criteria',
        fields: {
          marketEntryDate: fdaApprovalDate,
          priorVersions: '[Describe any predecessor technologies]',
          substantialDifferences: '[How this differs from existing technologies]',
          newMechanismOfAction: '[Yes/No - explain]',
        },
      },

      section5_costAnalysis: {
        title: 'Section 5: Cost Analysis',
        fields: {
          deviceCost: `$${deviceCost?.toLocaleString() || '[Cost Required]'}`,
          applicableDRGs: applicableDRGs.join(', ') || '[DRG codes required]',
          currentDRGPayments: paymentCalc ? `$${paymentCalc.drgPayment?.toLocaleString()}` : '[Lookup required]',
          costExceedance: paymentCalc ? `$${paymentCalc.costDifference?.toLocaleString()}` : '[Calculate]',
          proposedNTAP: paymentCalc ? `$${paymentCalc.ntapPayment?.toLocaleString()}` : '[Calculate]',
          costJustification: costJustification || '[Detailed cost justification required]',
        },
      },

      section6_clinicalImprovement: {
        title: 'Section 6: Substantial Clinical Improvement',
        fields: {
          improvementClaims: clinicalImprovements.length > 0 
            ? clinicalImprovements 
            : ['[List clinical improvement claims]'],
          supportingTrials: clinicalTrials.length > 0 
            ? clinicalTrials 
            : ['[List supporting clinical trials]'],
          comparatorTechnology: '[Current standard of care]',
          improvementMetrics: '[Quantified improvement data]',
        },
      },

      section7_codingInfo: {
        title: 'Section 7: Coding Information',
        fields: {
          indicatedProcedures: indicatedProcedures.length > 0 
            ? indicatedProcedures.join(', ') 
            : '[CPT/HCPCS codes required]',
          proposedDRGs: applicableDRGs.join(', ') || '[DRG codes required]',
          icd10Codes: '[Relevant ICD-10 diagnosis codes]',
        },
      },

      attachments: {
        title: 'Required Attachments',
        items: [
          'FDA approval letter',
          'Product labeling/Instructions for Use',
          'Clinical trial results and publications',
          'Cost documentation and invoices',
          'Letters of support from clinical experts',
          'Peer-reviewed publications',
        ],
      },
    },

    summary: {
      totalSections: 7,
      estimatedPayment: paymentCalc?.ntapPayment || null,
      completionStatus: calculateCompletionStatus(params),
    },
  };

  return document;
}

/**
 * Generate TPT application document
 */
function generateTptApplication(params) {
  const {
    deviceName,
    manufacturer,
    manufacturerAddress,
    contactName,
    contactEmail,
    contactPhone,
    deviceDescription,
    deviceCost,
    category = 'device',
    indicatedProcedures = [],
    applicableAPCs = [],
    fdaApprovalDate,
    fdaApprovalType,
    fdaNumber,
    hcpcsCode,
    clinicalBenefit,
  } = params;

  const applicationDate = new Date().toISOString().split('T')[0];
  const calendarYear = new Date().getFullYear() + 1;

  // Calculate potential payment
  const apcCode = applicableAPCs[0];
  const paymentCalc = apcCode ? calculateTptPayment({ deviceCost, apcCode }) : null;

  const document = {
    documentType: 'TPT Application',
    generatedDate: applicationDate,
    calendarYear: `CY${calendarYear}`,
    status: 'DRAFT',

    sections: {
      coverPage: {
        title: `TRANSITIONAL PASS-THROUGH PAYMENT APPLICATION`,
        subtitle: `Calendar Year ${calendarYear}`,
        technology: deviceName,
        category: category.charAt(0).toUpperCase() + category.slice(1),
        applicant: manufacturer,
        submissionDate: applicationDate,
      },

      section1_applicantInfo: {
        title: 'Section 1: Applicant Information',
        fields: {
          manufacturerName: manufacturer,
          manufacturerAddress: manufacturerAddress || '[Address Required]',
          contactPerson: contactName || '[Contact Name Required]',
          contactEmail: contactEmail || '[Email Required]',
          contactPhone: contactPhone || '[Phone Required]',
        },
      },

      section2_productInfo: {
        title: 'Section 2: Product Information',
        fields: {
          productName: deviceName,
          category: category,
          description: deviceDescription || '[Detailed description required]',
          hcpcsCode: hcpcsCode || '[HCPCS code required or pending]',
          unitOfService: '[Define unit of service]',
        },
      },

      section3_regulatoryStatus: {
        title: 'Section 3: Regulatory Status',
        fields: {
          fdaApprovalType: fdaApprovalType || '[PMA/510(k)/NDA/BLA]',
          fdaApprovalNumber: fdaNumber || '[FDA Number Required]',
          fdaApprovalDate: fdaApprovalDate || '[Date Required]',
          marketEntryDate: fdaApprovalDate,
        },
      },

      section4_costInfo: {
        title: 'Section 4: Cost Information',
        fields: {
          productCost: `$${deviceCost?.toLocaleString() || '[Cost Required]'}`,
          applicableAPCs: applicableAPCs.join(', ') || '[APC codes required]',
          currentAPCPayment: paymentCalc ? `$${paymentCalc.apcPayment?.toLocaleString()}` : '[Lookup required]',
          requestedPassThrough: paymentCalc ? `$${paymentCalc.passThroughPayment?.toLocaleString()}` : '[Calculate]',
          pricingMethodology: '[Describe how cost was determined]',
        },
      },

      section5_clinicalInfo: {
        title: 'Section 5: Clinical Information',
        fields: {
          indicatedProcedures: indicatedProcedures.length > 0 
            ? indicatedProcedures.join(', ') 
            : '[CPT/HCPCS codes required]',
          clinicalBenefit: clinicalBenefit || '[Describe clinical benefit]',
          patientPopulation: '[Target patient population]',
          expectedUtilization: '[Projected annual utilization]',
        },
      },

      attachments: {
        title: 'Required Attachments',
        items: [
          'FDA approval documentation',
          'Product labeling',
          'Pricing/cost documentation',
          'HCPCS code application (if applicable)',
          'Clinical evidence and publications',
        ],
      },
    },

    summary: {
      totalSections: 5,
      estimatedPayment: paymentCalc?.passThroughPayment || null,
      completionStatus: calculateCompletionStatus(params),
    },
  };

  return document;
}

function calculateCompletionStatus(params) {
  const requiredFields = ['deviceName', 'manufacturer', 'deviceCost', 'fdaApprovalDate'];
  const providedFields = requiredFields.filter(f => params[f]);
  const percentage = Math.round((providedFields.length / requiredFields.length) * 100);
  
  return {
    percentage,
    missingRequired: requiredFields.filter(f => !params[f]),
    status: percentage === 100 ? 'Complete' : percentage >= 50 ? 'In Progress' : 'Incomplete',
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get DRG payment lookup
 */
function getDrgPayment(drgCode) {
  loadData();
  return ntapData.drgBasePayments[drgCode] || null;
}

/**
 * Get APC payment lookup
 */
function getApcPayment(apcCode) {
  loadData();
  return tptData.apcBasePayments[apcCode] || null;
}

/**
 * Get available DRG codes
 */
function getAvailableDrgs() {
  loadData();
  return Object.keys(ntapData.drgBasePayments).map(code => ({
    code,
    payment: ntapData.drgBasePayments[code],
  }));
}

/**
 * Get available APC codes
 */
function getAvailableApcs() {
  loadData();
  return Object.keys(tptData.apcBasePayments).map(code => ({
    code,
    payment: tptData.apcBasePayments[code],
  }));
}

export default {
  // NTAP functions
  calculateNtapPayment,
  checkNtapEligibility,
  getApprovedNtapTechnologies,
  generateNtapApplication,
  
  // TPT functions
  calculateTptPayment,
  checkTptEligibility,
  getApprovedTptTechnologies,
  generateTptApplication,
  
  // Utility functions
  getDrgPayment,
  getApcPayment,
  getAvailableDrgs,
  getAvailableApcs,
};

