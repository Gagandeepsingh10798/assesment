/**
 * Server Entry Point
 * Minimal entry point that initializes services and starts the server
 */

import createApp from './src/app.js';
import config, { validateConfig } from './src/config/index.js';
import codeService from './src/services/codeService.js';
import genaiService from './src/services/genaiService.js';

/**
 * Initialize all services
 */
async function initializeServices() {
  console.log('='.repeat(50));
  console.log('Initializing services...');
  console.log('='.repeat(50));

  // Validate configuration
  validateConfig();

  // Initialize code service (load medical codes)
  try {
    await codeService.loadCodes();
    console.log('✓ Code service initialized');
  } catch (error) {
    console.error('✗ Failed to initialize code service:', error.message);
  }

  // Initialize GenAI service
  try {
    const genaiInitialized = await genaiService.initialize();
    if (genaiInitialized) {
      console.log('✓ GenAI service initialized');
    } else {
      console.log('⚠ GenAI service not available (API key not configured)');
    }
  } catch (error) {
    console.error('✗ Failed to initialize GenAI service:', error.message);
  }

  console.log('='.repeat(50));
}

/**
 * Start the server
 */
async function startServer() {
  // Initialize services before starting server
  await initializeServices();

  // Create Express application
  const app = createApp();

  // Start listening
  const port = config.server.port;
  
  app.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  Reimbursement Intelligence Module - Backend Server        ║
╠════════════════════════════════════════════════════════════╣
║  Status:      Running                                      ║
║  Port:        ${port}                                          ║
║  Environment: ${config.server.env.padEnd(41)}║
║  API Base:    ${config.api.basePath.padEnd(41)}║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET  /api/health          - Health check                ║
║    GET  /api/codes           - List codes                  ║
║    GET  /api/codes/:code     - Code details                ║
║    GET  /api/codes/search    - Search codes                ║
║    POST /api/reimbursement/scenario - Calculate scenario   ║
║    POST /api/ntap/calculate  - NTAP calculation            ║
║    POST /api/tpt/calculate   - TPT calculation             ║
║    POST /api/chat            - AI chat                     ║
║    GET  /api/files           - List files                  ║
║    POST /api/upload          - Upload file                 ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
