import axios from 'axios';

/**
 * Base API configuration and client
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// Request interceptor for logging
apiClient.interceptors.request.use(
    (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        console.error('[API] Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            // Server responded with error status
            console.error(`[API] Error ${error.response.status}:`, error.response.data);

            return Promise.reject({
                status: error.response.status,
                message: error.response.data.error || error.response.data.message || 'An error occurred',
                data: error.response.data,
            });
        } else if (error.request) {
            // Request made but no response
            console.error('[API] No response received:', error.request);
            return Promise.reject({
                status: 0,
                message: 'Network error - no response from server',
            });
        } else {
            // Error in request configuration
            console.error('[API] Request configuration error:', error.message);
            return Promise.reject({
                status: -1,
                message: error.message || 'Request configuration error',
            });
        }
    }
);

export default apiClient;
export { API_BASE_URL };
