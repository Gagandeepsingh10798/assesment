/**
 * Code Controller
 * Handles medical code lookup and search operations
 */

import codeService from '../services/codeService.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Get all codes with pagination and filtering
 * GET /api/codes
 */
export const getCodes = async (req, res) => {
  const { limit = 50, offset = 0, type, sortBy = 'code', sortOrder = 'asc' } = req.query;

  const result = codeService.getAllCodes({
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    type: type || null,
    sortBy,
    sortOrder,
  });

  res.json({
    data: result.codes,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    page: Math.floor(result.offset / result.limit) + 1,
    totalPages: Math.ceil(result.total / result.limit),
    hasMore: result.hasMore,
  });
};

/**
 * Search codes by query
 * GET /api/codes/search
 */
export const searchCodes = async (req, res) => {
  const { q: query, limit = 50, type } = req.query;

  if (!query || query.trim().length < 2) {
    return res.json({
      data: [],
      total: 0,
      query: query || '',
      message: 'Query must be at least 2 characters',
    });
  }

  const result = codeService.searchCodes(query, {
    limit: parseInt(limit, 10),
    type: type || null,
  });

  res.json({
    data: result.codes,
    total: result.total,
    query: result.query,
  });
};

/**
 * Get code statistics
 * GET /api/codes/stats
 */
export const getCodeStats = async (req, res) => {
  const stats = codeService.getStats();
  res.json(stats);
};

/**
 * Get single code by code string
 * GET /api/codes/:code
 */
export const getCodeByCode = async (req, res) => {
  const { code } = req.params;

  const codeDetail = codeService.getCode(code);

  if (!codeDetail) {
    throw ApiError.notFound(`Code not found: ${code}`);
  }

  res.json(codeDetail);
};

export default {
  getCodes,
  searchCodes,
  getCodeStats,
  getCodeByCode,
};

