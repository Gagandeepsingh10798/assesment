/**
 * Reimbursement Controller
 * Handles reimbursement scenario calculations
 */

import codeService from '../services/codeService.js';
import { ReimbursementScenario } from '../models/ReimbursementScenario.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Calculate reimbursement scenario
 * POST /api/reimbursement/scenario
 */
export const calculateScenario = async (req, res) => {
  const scenario = ReimbursementScenario.fromRequest(req.body);

  // Validate inputs
  const validation = scenario.validate();
  if (!validation.valid) {
    throw ApiError.validation(validation.errors);
  }

  // Get code details
  const codeDetail = codeService.getCode(scenario.code);
  if (!codeDetail) {
    throw ApiError.notFound(`Code not found: ${scenario.code}`);
  }

  // Calculate scenario
  scenario.calculate(codeDetail);

  res.json(scenario.toResponse());
};

/**
 * Compare reimbursement across all sites
 * GET /api/reimbursement/compare/:code
 */
export const compareAllSites = async (req, res) => {
  const { code } = req.params;
  const { deviceCost = 0, ntapAddOn = 0 } = req.query;

  const codeDetail = codeService.getCode(code);
  if (!codeDetail) {
    throw ApiError.notFound(`Code not found: ${code}`);
  }

  const sites = ReimbursementScenario.getValidSites();
  const comparisons = [];

  for (const site of sites) {
    const scenario = new ReimbursementScenario({
      code,
      siteOfService: site.key,
      deviceCost: parseFloat(deviceCost),
      ntapAddOn: parseFloat(ntapAddOn),
    });

    try {
      scenario.calculate(codeDetail);
      const result = scenario.toResponse();
      comparisons.push({
        site: result.siteOfService,
        siteKey: result.siteKey,
        basePayment: result.basePayment,
        totalPayment: result.totalPayment,
        margin: result.margin,
        marginPercentage: result.marginPercentage,
        classification: result.classification,
      });
    } catch (error) {
      // Skip invalid scenarios
    }
  }

  // Sort by margin (highest first)
  comparisons.sort((a, b) => b.margin - a.margin);

  res.json({
    code,
    description: codeDetail.description,
    deviceCost: parseFloat(deviceCost),
    ntapAddOn: parseFloat(ntapAddOn),
    comparisons,
    bestSite: comparisons.length > 0 ? comparisons[0] : null,
    worstSite: comparisons.length > 0 ? comparisons[comparisons.length - 1] : null,
  });
};

/**
 * Get valid sites of service
 * GET /api/reimbursement/sites
 */
export const getValidSites = (req, res) => {
  res.json({
    sites: ReimbursementScenario.getValidSites(),
    thresholds: ReimbursementScenario.getThresholds(),
  });
};

export default {
  calculateScenario,
  compareAllSites,
  getValidSites,
};

