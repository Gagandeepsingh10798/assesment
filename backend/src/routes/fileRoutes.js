/**
 * File Routes
 * @swagger
 * tags:
 *   name: Files
 *   description: File upload and management endpoints
 */

import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import * as fileController from '../controllers/fileController.js';
import { upload } from '../config/multer.js';

const router = Router();

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: List files in file search store
 *     tags: [Files]
 *     responses:
 *       200:
 *         description: List of files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       displayName:
 *                         type: string
 *                       uploadedAt:
 *                         type: string
 *                       size:
 *                         type: integer
 *                       mimeType:
 *                         type: string
 *                 totalFiles:
 *                   type: integer
 *                 source:
 *                   type: string
 */
router.get('/', asyncHandler(fileController.listFiles));

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a file
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 fileName:
 *                   type: string
 *       400:
 *         description: No file uploaded or file too large
 */
// POST /api/files/upload or POST /api/upload (both work via route mounting)
router.post(
  '/',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: true,
            message: 'File too large. Maximum file size is 500MB.',
          });
        }
        return res.status(400).json({
          error: true,
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  },
  asyncHandler(fileController.uploadFile)
);

/**
 * @swagger
 * /api/files/{documentName}:
 *   delete:
 *     summary: Delete a file from file search store
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: documentName
 *         required: true
 *         schema:
 *           type: string
 *         description: Full document resource name (URL encoded)
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       400:
 *         description: Document name required
 *       500:
 *         description: Failed to delete file
 */
// Use wildcard to capture full document path with slashes
router.delete('/*', asyncHandler(fileController.deleteFileByPath));

export default router;

