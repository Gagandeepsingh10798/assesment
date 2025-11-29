import React from 'react';
import Message from './Message';
import { Stethoscope } from 'lucide-react';
import './MessageList.css';

function MessageList({ messages, isLoading, onSuggestionClick }) {
  const suggestions = [
    "Analyze this blood report",
    "What are symptoms of flu?",
    "Explain this prescription"
  ];

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Stethoscope size={48} strokeWidth={1.5} />
        </div>
        <h2>Welcome to MediChat AI</h2>
        <p>Your intelligent medical assistant. Upload reports or ask health-related questions.</p>
        <div className="empty-state-examples">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="example-chip"
              onClick={() => onSuggestionClick && onSuggestionClick(suggestion)}
            >
              "{suggestion}"
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      {isLoading && (
        <div className="message-wrapper assistant">
          <div className="message-avatar-container">
            <div className="message-avatar bot-avatar">
              <Stethoscope size={16} />
            </div>
          </div>
          <div className="message-bubble loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageList;
