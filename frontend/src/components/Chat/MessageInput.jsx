import React, { useRef } from 'react';
import { Send, Paperclip } from 'lucide-react';
import './MessageInput.css';

function MessageInput({ onSendMessage, onFileUpload, isLoading, isUploading, isFileOperationInProgress, inputValue, setInputValue }) {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Use controlled input from parent
  const message = inputValue || '';
  const setMessage = setInputValue || (() => {});

  // Disable all inputs when any file operation is in progress
  const isDisabled = isLoading || isUploading || isFileOperationInProgress;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !isDisabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  // Focus on textarea when inputValue changes (suggestion clicked)
  React.useEffect(() => {
    if (inputValue && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [inputValue]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileClick = () => {
    if (!isDisabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && !isDisabled) {
      onFileUpload(file);
      e.target.value = ''; // Reset
    }
  };

  const getPlaceholder = () => {
    if (isUploading) return "Uploading file...";
    if (isFileOperationInProgress) return "File operation in progress...";
    if (isLoading) return "Processing...";
    return "Ask a question about your health or uploaded files...";
  };

  return (
    <div className="message-input-container">
      <form onSubmit={handleSubmit} className="message-input-form">
        <button
          type="button"
          className={`action-button file-button ${isUploading ? 'uploading' : ''}`}
          onClick={handleFileClick}
          disabled={isDisabled}
          title={isUploading ? "Uploading..." : "Upload file"}
        >
          {isUploading ? (
            <div className="button-spinner" />
          ) : (
            <Paperclip size={20} />
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".txt,.pdf,.doc,.docx,.md"
          disabled={isDisabled}
        />

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={getPlaceholder()}
          className="message-input"
          rows={1}
          disabled={isDisabled}
        />

        <button
          type="submit"
          disabled={!message.trim() || isDisabled}
          className={`action-button send-button ${message.trim() && !isDisabled ? 'active' : ''}`}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
