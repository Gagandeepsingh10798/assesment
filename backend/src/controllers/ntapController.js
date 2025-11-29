/**
 * NTAP Controller
 * Handles New Technology Add-on Payment operations
 */

import ntapTptService from '../services/ntapTptService.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Calculate NTAP payment
 * POST /api/ntap/calculate
 */
export const calculatePayment = (req, res) => {
  const { deviceCost, drgCode, drgPayment } = req.body;

  if (!deviceCost) {
    throw ApiError.badRequest('Device cost is required');
  }

  const result = ntapTptService.calculateNtapPayment({
    deviceCost: parseFloat(deviceCost),
    drgCode,
    drgPayment: drgPayment ? parseFloat(drgPayment) : undefined,
  });

  res.json(result);
};

/**
 * Check NTAP eligibility
 * POST /api/ntap/eligibility
 */
export const checkEligibility = (req, res) => {
  const {
    deviceName,
    manufacturer,
    deviceCost,
    drgCode,
    fdaApprovalDate,
    fdaApprovalType,
    clinicalImprovements,
  } = req.body;

  if (!deviceName || !deviceCost) {
    throw ApiError.badRequest('Device name and cost are required');
  }

  const result = ntapTptService.checkNtapEligibility({
    deviceName,
    manufacturer,
    deviceCost: parseFloat(deviceCost),
    drgCode,
    fdaApprovalDate,
    fdaApprovalType,
    clinicalImprovements: clinicalImprovements || [],
  });

  res.json(result);
};

/**
 * Generate NTAP application document
 * POST /api/ntap/application
 */
export const generateApplication = (req, res) => {
  const params = req.body;

  if (!params.deviceName || !params.manufacturer) {
    throw ApiError.badRequest('Device name and manufacturer are required');
  }

  const document = ntapTptService.generateNtapApplication({
    ...params,
    deviceCost: params.deviceCost ? parseFloat(params.deviceCost) : undefined,
  });

  res.json(document);
};

/**
 * Get approved NTAP technologies list
 * GET /api/ntap/approved-list
 */
export const getApprovedList = (req, res) => {
  const result = ntapTptService.getApprovedNtapTechnologies();
  res.json(result);
};

/**
 * Get available DRG codes
 * GET /api/ntap/drgs
 */
export const getDrgs = (req, res) => {
  const drgs = ntapTptService.getAvailableDrgs();
  res.json({ drgs });
};

export default {
  calculatePayment,
  checkEligibility,
  generateApplication,
  getApprovedList,
  getDrgs,
};

