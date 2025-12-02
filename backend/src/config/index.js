/**
 * Application Configuration
 * Centralized configuration for the backend application
 */

import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development',
  },

  // API configuration
  api: {
    basePath: '/api',
    version: '1.0.0',
  },

  // File upload limits
  upload: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    maxFieldSize: 500 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
    ],
  },

  // Google GenAI configuration
  genai: {
    apiKey: process.env.GOOGLE_API_KEY,
    model: 'gemini-3-pro-preview',
    defaultFileSearchStore: 'default-file-search-store',
  },

  // Reimbursement classification thresholds
  reimbursement: {
    profitableMinMargin: 0.10,    // Margin > 10% of total = profitable
    breakEvenMinMargin: -0.05,   // Margin between -5% and 10% = break-even
  },

  // CMS Conversion Factors (2025 approximate values)
  cms: {
    facilityConversionFactor: 33.89,
    nonFacilityConversionFactor: 33.89,
    ascMultiplier: 50.0,
    ippsMultiplier: 1.5,
  },

  // NTAP configuration
  ntap: {
    percentage: 0.65,
    maxCap: 150000,
    costThresholdMultiplier: 1.0,
  },

  // TPT configuration
  tpt: {
    maxPassThroughDuration: 3, // years
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
};

// Validate required configuration
export function validateConfig() {
  const warnings = [];
  
  if (!config.genai.apiKey) {
    warnings.push('GOOGLE_API_KEY is not set - GenAI features will be disabled');
  }

  if (warnings.length > 0) {
    console.warn('Configuration warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  return warnings.length === 0;
}

export default config;

