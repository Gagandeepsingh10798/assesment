import apiClient from './api.js';

/**
 * Chat Service - API calls for chat functionality
 */
const chatService = {
    /**
     * Send chat message and get response
     */
    async sendMessage(message) {
        const response = await apiClient.post('/chat', { message });

        return {
            text: response.data.text,
            citations: response.data.citations || null,
            groundingMetadata: response.data.groundingMetadata || null,
        };
    },
};

export default chatService;
