/**
 * Route Aggregator
 * Mounts all API routes
 */

import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import codeRoutes from './codeRoutes.js';
import reimbursementRoutes from './reimbursementRoutes.js';
import ntapRoutes from './ntapRoutes.js';
import tptRoutes from './tptRoutes.js';
import fileRoutes from './fileRoutes.js';
import chatRoutes from './chatRoutes.js';

const router = Router();

// Mount routes
router.use('/health', healthRoutes);
router.use('/codes', codeRoutes);
router.use('/reimbursement', reimbursementRoutes);
router.use('/ntap', ntapRoutes);
router.use('/tpt', tptRoutes);
router.use('/files', fileRoutes);
router.use('/upload', fileRoutes);
router.use('/chat', chatRoutes);

export default router;

