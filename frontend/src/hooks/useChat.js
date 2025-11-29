import { useState, useCallback } from 'react';
import chatService from '../services/chatService.js';

/**
 * Custom hook for chat functionality
 * Manages chat messages, loading state, and API interaction
 */
export default function useChat() {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Send a message and get AI response
     */
    const sendMessage = useCallback(async (messageText) => {
        if (!messageText || messageText.trim() === '') {
            return;
        }

        // Add user message immediately
        const userMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setError(null);

        try {
            // Call chat API
            const response = await chatService.sendMessage(messageText);

            // Add assistant message
            const assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.text,
                citations: response.citations,
                timestamp: new Date().toISOString(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            setError(err.message || 'Failed to send message');

            // Add error message
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your message. Please try again.',
                isError: true,
                timestamp: new Date().toISOString(),
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Clear chat history
     */
    const clearMessages = useCallback(() => {
        setMessages([]);
        setError(null);
    }, []);

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        clearMessages,
    };
}
