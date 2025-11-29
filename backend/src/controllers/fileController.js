/**
 * File Controller
 * Handles file upload and management operations
 */

import fs from 'fs';
import genaiService from '../services/genaiService.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * List files in file search store
 * GET /api/files
 */
export const listFiles = async (req, res) => {
  const result = await genaiService.listFiles();
  res.json(result);
};

/**
 * Upload file to file search store
 * POST /api/upload
 */
export const uploadFile = async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded');
  }

  const filePath = req.file.path;
  const fileName = req.file.originalname;

  try {
    const result = await genaiService.uploadFile(filePath, fileName);

    // Delete local file after successful upload
    try {
      fs.unlinkSync(filePath);
    } catch (deleteError) {
      console.warn('Could not delete local file:', deleteError.message);
    }

    res.json(result);
  } catch (error) {
    // Clean up local file on error
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
};

/**
 * Delete file from file search store
 * DELETE /api/files/:documentName
 */
export const deleteFile = async (req, res) => {
  const { documentName } = req.params;

  if (!documentName) {
    throw ApiError.badRequest('Document name is required');
  }

  const result = await genaiService.deleteFile(documentName);
  res.json(result);
};

/**
 * Delete file by path (handles full paths with slashes)
 * DELETE /api/files/*
 */
export const deleteFileByPath = async (req, res) => {
  // Extract the full path after /api/files/
  const documentName = req.params[0] || req.path.replace(/^\//, '');

  if (!documentName) {
    throw ApiError.badRequest('Document name is required');
  }

  // Decode the URL-encoded document name
  const decodedName = decodeURIComponent(documentName);
  console.log('Deleting file:', decodedName);

  const result = await genaiService.deleteFile(decodedName);
  res.json(result);
};

export default {
  listFiles,
  uploadFile,
  deleteFile,
  deleteFileByPath,
};

