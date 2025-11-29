/**
 * NTAP Routes
 * @swagger
 * tags:
 *   name: NTAP
 *   description: New Technology Add-on Payment endpoints
 */

import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as ntapController from '../controllers/ntapController.js';

const router = Router();

/**
 * @swagger
 * /api/ntap/calculate:
 *   post:
 *     summary: Calculate NTAP payment
 *     tags: [NTAP]
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
 *                 example: 32500
 *               drgCode:
 *                 type: string
 *                 example: "216"
 *               drgPayment:
 *                 type: number
 *                 example: 45000
 *     responses:
 *       200:
 *         description: NTAP calculation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NtapCalculation'
 */
router.post('/calculate', asyncHandler(ntapController.calculatePayment));

/**
 * @swagger
 * /api/ntap/eligibility:
 *   post:
 *     summary: Check NTAP eligibility
 *     tags: [NTAP]
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
 *               drgCode:
 *                 type: string
 *               fdaApprovalDate:
 *                 type: string
 *                 format: date
 *               fdaApprovalType:
 *                 type: string
 *                 enum: [PMA, 510(k), BLA, NDA]
 *               clinicalImprovements:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Eligibility assessment result
 */
router.post('/eligibility', asyncHandler(ntapController.checkEligibility));

/**
 * @swagger
 * /api/ntap/application:
 *   post:
 *     summary: Generate NTAP application document
 *     tags: [NTAP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceName
 *               - manufacturer
 *             properties:
 *               deviceName:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               deviceCost:
 *                 type: number
 *               fdaApprovalDate:
 *                 type: string
 *               fdaApprovalType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generated application document
 */
router.post('/application', asyncHandler(ntapController.generateApplication));

/**
 * @swagger
 * /api/ntap/approved-list:
 *   get:
 *     summary: Get list of approved NTAP technologies
 *     tags: [NTAP]
 *     responses:
 *       200:
 *         description: List of approved technologies
 */
router.get('/approved-list', ntapController.getApprovedList);

/**
 * @swagger
 * /api/ntap/drgs:
 *   get:
 *     summary: Get available DRG codes with payments
 *     tags: [NTAP]
 *     responses:
 *       200:
 *         description: List of DRG codes
 */
router.get('/drgs', ntapController.getDrgs);

export default router;

