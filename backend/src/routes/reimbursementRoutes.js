/**
 * Reimbursement Routes
 * @swagger
 * tags:
 *   name: Reimbursement
 *   description: Reimbursement scenario calculation endpoints
 */

import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as reimbursementController from '../controllers/reimbursementController.js';

const router = Router();

/**
 * @swagger
 * /api/reimbursement/scenario:
 *   post:
 *     summary: Calculate reimbursement scenario
 *     tags: [Reimbursement]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - siteOfService
 *               - deviceCost
 *             properties:
 *               code:
 *                 type: string
 *                 example: "36903"
 *               siteOfService:
 *                 type: string
 *                 enum: [IPPS, HOPD, ASC, OBL]
 *                 example: "HOPD"
 *               deviceCost:
 *                 type: number
 *                 example: 5800
 *               ntapAddOn:
 *                 type: number
 *                 example: 3770
 *     responses:
 *       200:
 *         description: Reimbursement calculation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReimbursementResult'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Code not found
 */
router.post('/scenario', asyncHandler(reimbursementController.calculateScenario));

/**
 * @swagger
 * /api/reimbursement/compare/{code}:
 *   get:
 *     summary: Compare reimbursement across all sites
 *     tags: [Reimbursement]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: deviceCost
 *         schema:
 *           type: number
 *           default: 0
 *       - in: query
 *         name: ntapAddOn
 *         schema:
 *           type: number
 *           default: 0
 *     responses:
 *       200:
 *         description: Comparison results across all sites
 *       404:
 *         description: Code not found
 */
router.get('/compare/:code', asyncHandler(reimbursementController.compareAllSites));

/**
 * @swagger
 * /api/reimbursement/sites:
 *   get:
 *     summary: Get valid sites of service and thresholds
 *     tags: [Reimbursement]
 *     responses:
 *       200:
 *         description: Sites and classification thresholds
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sites:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                 thresholds:
 *                   type: object
 */
router.get('/sites', reimbursementController.getValidSites);

export default router;

