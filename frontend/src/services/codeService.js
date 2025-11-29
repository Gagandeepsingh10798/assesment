import apiClient from './api.js';
import Code from '../domain/Code.js';

/**
 * Code Service - API calls for medical codes
 */
const codeService = {
    /**
     * Search for codes
     */
    async searchCodes(query, options = {}) {
        const { limit = 50, type } = options;

        const params = {
            q: query,
            limit,
            ...(type && { type }),
        };

        const response = await apiClient.get('/codes/search', { params });

        return {
            codes: response.data.codes.map(code => new Code(code)),
            total: response.data.total,
            query,
        };
    },

    /**
     * Get all codes with pagination
     */
    async getAllCodes(options = {}) {
        const { limit = 50, offset = 0, type, sortBy = 'code', sortOrder = 'asc' } = options;

        const params = {
            limit,
            offset,
            sortBy,
            sortOrder,
            ...(type && { type }),
        };

        const response = await apiClient.get('/codes', { params });

        return {
            codes: response.data.codes.map(code => new Code(code)),
            total: response.data.total,
            hasMore: response.data.hasMore,
        };
    },

    /**
     * Get specific code details
     */
    async getCode(codeString) {
        const response = await apiClient.get(`/codes/${codeString}`);
        return new Code(response.data);
    },

    /**
     * Get code statistics
     */
    async getStats() {
        const response = await apiClient.get('/codes/stats');
        return response.data;
    },
};

export default codeService;
