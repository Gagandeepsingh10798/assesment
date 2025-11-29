/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 */

import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

/**
 * Create and configure Express application
 */
function createApp() {
  const app = express();

  // ===================
  // Middleware
  // ===================

  // CORS configuration
  app.use(cors(config.cors));

  // Body parsing with increased limits for file uploads
  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ extended: true, limit: '500mb' }));

  // Request logging (development)
  if (config.server.env === 'development') {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  // ===================
  // API Routes
  // ===================

  // Mount all API routes under /api
  app.use(config.api.basePath, routes);

  // Legacy route support - /api/upload maps to file routes
  app.use('/api/upload', routes);

  // ===================
  // Error Handling
  // ===================

  // Handle 404 for undefined routes
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

export default createApp;
export { createApp };

