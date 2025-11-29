/**
 * Code Routes
 * @swagger
 * tags:
 *   name: Codes
 *   description: Medical code lookup and search endpoints
 */

import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as codeController from '../controllers/codeController.js';

const router = Router();

/**
 * @swagger
 * /api/codes:
 *   get:
 *     summary: Get all codes with pagination
 *     tags: [Codes]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of codes to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of codes to skip
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CPT, HCPCS, ICD10, ICD10-PCS]
 *         description: Filter by code type
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: code
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *     responses:
 *       200:
 *         description: List of codes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CodeSummary'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router.get('/', asyncHandler(codeController.getCodes));

/**
 * @swagger
 * /api/codes/search:
 *   get:
 *     summary: Search codes by query
 *     tags: [Codes]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (min 2 characters)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', asyncHandler(codeController.searchCodes));

/**
 * @swagger
 * /api/codes/stats:
 *   get:
 *     summary: Get code database statistics
 *     tags: [Codes]
 *     responses:
 *       200:
 *         description: Code statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCodes:
 *                   type: integer
 *                 isLoaded:
 *                   type: boolean
 *                 types:
 *                   type: object
 */
router.get('/stats', asyncHandler(codeController.getCodeStats));

/**
 * @swagger
 * /api/codes/{code}:
 *   get:
 *     summary: Get code details by code string
 *     tags: [Codes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: The code to look up (e.g., 36903)
 *     responses:
 *       200:
 *         description: Code details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CodeDetail'
 *       404:
 *         description: Code not found
 */
router.get('/:code', asyncHandler(codeController.getCodeByCode));

export default router;

