/**
 * Chat Routes
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI chat endpoints
 */

import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as chatController from '../controllers/chatController.js';

const router = Router();

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Send a message to the AI chat
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: "What is CPT code 36903?"
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 *                 citations:
 *                   type: object
 *                   properties:
 *                     groundingChunks:
 *                       type: array
 *                     webSearchQueries:
 *                       type: array
 *                     processedChunks:
 *                       type: array
 *                 codeContext:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Message is required
 *       500:
 *         description: Failed to process chat message
 */
router.post('/', asyncHandler(chatController.processChat));

export default router;

