import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import './Chatbot.css';

const API_BASE_URL = 'http://localhost:3001/api';

function Chatbot({ onUploadSuccess, onFileOperationStart, onFileOperationEnd, isFileOperationInProgress }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = async (file) => {
    // Validate file size (500MB)
    const maxFileSize = 500 * 1024 * 1024;
    if (file.size > maxFileSize) {
      addMessage('assistant', `Error: File "${file.name}" is too large. Maximum file size is 500MB.`);
      return;
    }

    // Start file operation
    setIsUploading(true);
    if (onFileOperationStart) onFileOperationStart();
    
    // Optimistic update
    addMessage('system', `Uploading "${file.name}"...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30 * 60 * 1000,
      });

      if (response.data.success) {
        addMessage('system', `File "${response.data.fileName}" uploaded and indexed successfully.`);
      } else {
        addMessage('system', `Upload completed but with warning: ${response.data.message || 'Unknown status'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      addMessage('system', `Error uploading file: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      if (onFileOperationEnd) onFileOperationEnd();
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/chat`, { message });

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.text,
        citations: response.data.citations,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      addMessage('assistant', `Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addMessage = (role, content) => {
    const message = {
      id: Date.now(),
      role: role,
      content: content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
  };

  return (
    <div className="chatbot-container">
      <div className="chat-area">
        <MessageList 
          messages={messages} 
          isLoading={isLoading} 
          onSuggestionClick={handleSuggestionClick}
        />
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area-wrapper">
        <MessageInput
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
          isUploading={isUploading}
          isFileOperationInProgress={isFileOperationInProgress}
          inputValue={inputValue}
          setInputValue={setInputValue}
        />
        <div className="input-footer">
          <p>AI can make mistakes. Please verify important information.</p>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;
