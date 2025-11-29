/**
 * Health Controller
 * Handles health check and status endpoints
 */

import codeService from '../services/codeService.js';
import genaiService from '../services/genaiService.js';

/**
 * Health check endpoint
 * GET /api/health
 */
export const getHealth = (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    googleGenAI: genaiService.getStatus(),
    codeService: {
      isReady: codeService.isReady(),
      stats: codeService.isReady() ? codeService.getStats() : null,
    },
  };
  res.json(health);
};

export default {
  getHealth,
};

