/**
 * TPT Controller
 * Handles Transitional Pass-Through Payment operations
 */

import ntapTptService from '../services/ntapTptService.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Calculate TPT payment
 * POST /api/tpt/calculate
 */
export const calculatePayment = (req, res) => {
  const { deviceCost, apcCode, packagedPayment } = req.body;

  if (!deviceCost) {
    throw ApiError.badRequest('Device cost is required');
  }

  const result = ntapTptService.calculateTptPayment({
    deviceCost: parseFloat(deviceCost),
    apcCode,
    packagedPayment: packagedPayment ? parseFloat(packagedPayment) : undefined,
  });

  res.json(result);
};

/**
 * Check TPT eligibility
 * POST /api/tpt/eligibility
 */
export const checkEligibility = (req, res) => {
  const {
    deviceName,
    manufacturer,
    deviceCost,
    apcCode,
    fdaApprovalDate,
    fdaApprovalType,
    category,
  } = req.body;

  if (!deviceName || !deviceCost) {
    throw ApiError.badRequest('Device name and cost are required');
  }

  const result = ntapTptService.checkTptEligibility({
    deviceName,
    manufacturer,
    deviceCost: parseFloat(deviceCost),
    apcCode,
    fdaApprovalDate,
    fdaApprovalType,
    category,
  });

  res.json(result);
};

/**
 * Generate TPT application document
 * POST /api/tpt/application
 */
export const generateApplication = (req, res) => {
  const params = req.body;

  if (!params.deviceName || !params.manufacturer) {
    throw ApiError.badRequest('Device name and manufacturer are required');
  }

  const document = ntapTptService.generateTptApplication({
    ...params,
    deviceCost: params.deviceCost ? parseFloat(params.deviceCost) : undefined,
  });

  res.json(document);
};

/**
 * Get approved TPT technologies list
 * GET /api/tpt/approved-list
 */
export const getApprovedList = (req, res) => {
  const result = ntapTptService.getApprovedTptTechnologies();
  res.json(result);
};

/**
 * Get available APC codes
 * GET /api/tpt/apcs
 */
export const getApcs = (req, res) => {
  const apcs = ntapTptService.getAvailableApcs();
  res.json({ apcs });
};

export default {
  calculatePayment,
  checkEligibility,
  generateApplication,
  getApprovedList,
  getApcs,
};

