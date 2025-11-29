import apiClient from './api.js';

/**
 * File Service - API calls for file management
 */
const fileService = {
    /**
     * Get list of uploaded files
     */
    async getFiles() {
        const response = await apiClient.get('/files');

        return {
            files: response.data.files || [],
            totalFiles: response.data.totalFiles || 0,
            storeName: response.data.storeName,
        };
    },

    /**
     * Upload a file
     */
    async uploadFile(file, onProgress) {
        const formData = new FormData();
        formData.append('file', file);

        const config = {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        };

        if (onProgress) {
            config.onUploadProgress = (progressEvent) => {
                const percentCompleted = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total
                );
                onProgress(percentCompleted);
            };
        }

        const response = await apiClient.post('/upload', formData, config);

        return {
            success: response.data.success,
            message: response.data.message,
            fileName: response.data.fileName,
        };
    },

    /**
     * Delete a file
     */
    async deleteFile(documentName) {
        const response = await apiClient.delete(`/files/${encodeURIComponent(documentName)}`);

        return {
            success: response.data.success,
            message: response.data.message,
        };
    },
};

export default fileService;
