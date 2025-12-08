/**
 * Chat Routes
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI chat endpoints with Multi-Agent Orchestration
 */

import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as chatController from '../controllers/chatController.js';

const router = Router();

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Send a message to the AI chat with multi-agent routing
 *     description: |
 *       Processes user queries through a multi-agent system:
 *       1. Query Classifier - Determines if query is SQL, PDF, or General
 *       2. SQL Agent - Handles database queries (code lookups, searches, filters)
 *       3. PDF Agent - Handles document/file searches
 *       4. General Agent - Handles conceptual questions (uses both sources)
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
 *                 example: "Show me all CPT codes related to cardiovascular procedures"
 *     responses:
 *       200:
 *         description: AI response with agent routing information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   type: string
 *                   description: AI-generated response
 *                 queryType:
 *                   type: string
 *                   enum: [sql, pdf, general]
 *                   description: Type of query as classified
 *                 classification:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                     confidence:
 *                       type: number
 *                     reasoning:
 *                       type: string
 *                 citations:
 *                   type: object
 *                   properties:
 *                     groundingChunks:
 *                       type: array
 *                     webSearchQueries:
 *                       type: array
 *                     processedChunks:
 *                       type: array
 *                 sqlResults:
 *                   type: object
 *                   description: Present for SQL queries
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     queryType:
 *                       type: string
 *                     message:
 *                       type: string
 *                     resultCount:
 *                       type: number
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

/**
 * @swagger
 * /api/chat/status:
 *   get:
 *     summary: Get agent system status
 *     description: Returns the status of all agents and services
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Agent status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agentService:
 *                   type: boolean
 *                 codeService:
 *                   type: boolean
 *                 codeStats:
 *                   type: object
 *                 availableAgents:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/status', asyncHandler(chatController.getAgentStatus));

export default router;
