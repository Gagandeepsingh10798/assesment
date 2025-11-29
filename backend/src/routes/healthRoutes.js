/**
 * Health Routes
 * @swagger
 * tags:
 *   name: Health
 *   description: System health and status endpoints
 */

import { Router } from 'express';
import healthController from '../controllers/healthController.js';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 googleGenAI:
 *                   type: object
 *                 codeService:
 *                   type: object
 */
router.get('/', healthController.getHealth);

export default router;

