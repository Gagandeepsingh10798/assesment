/**
 * TPT Routes
 * @swagger
 * tags:
 *   name: TPT
 *   description: Transitional Pass-Through Payment endpoints
 */

import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as tptController from '../controllers/tptController.js';

const router = Router();

/**
 * @swagger
 * /api/tpt/calculate:
 *   post:
 *     summary: Calculate TPT payment
 *     tags: [TPT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceCost
 *             properties:
 *               deviceCost:
 *                 type: number
 *                 example: 1200
 *               apcCode:
 *                 type: string
 *                 example: "5112"
 *               packagedPayment:
 *                 type: number
 *     responses:
 *       200:
 *         description: TPT calculation result
 */
router.post('/calculate', asyncHandler(tptController.calculatePayment));

/**
 * @swagger
 * /api/tpt/eligibility:
 *   post:
 *     summary: Check TPT eligibility
 *     tags: [TPT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceName
 *               - deviceCost
 *             properties:
 *               deviceName:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               deviceCost:
 *                 type: number
 *               apcCode:
 *                 type: string
 *               fdaApprovalDate:
 *                 type: string
 *                 format: date
 *               fdaApprovalType:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [device, drug, biological]
 *     responses:
 *       200:
 *         description: Eligibility assessment result
 */
router.post('/eligibility', asyncHandler(tptController.checkEligibility));

/**
 * @swagger
 * /api/tpt/application:
 *   post:
 *     summary: Generate TPT application document
 *     tags: [TPT]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceName
 *               - manufacturer
 *     responses:
 *       200:
 *         description: Generated application document
 */
router.post('/application', asyncHandler(tptController.generateApplication));

/**
 * @swagger
 * /api/tpt/approved-list:
 *   get:
 *     summary: Get list of approved TPT technologies
 *     tags: [TPT]
 *     responses:
 *       200:
 *         description: List of approved technologies
 */
router.get('/approved-list', tptController.getApprovedList);

/**
 * @swagger
 * /api/tpt/apcs:
 *   get:
 *     summary: Get available APC codes with payments
 *     tags: [TPT]
 *     responses:
 *       200:
 *         description: List of APC codes
 */
router.get('/apcs', tptController.getApcs);

export default router;

