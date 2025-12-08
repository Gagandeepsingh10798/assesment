import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Citations from './Citations';
import { User, Bot, Stethoscope, Database, FileText, Brain, Zap, Copy, Check, Play, Code } from 'lucide-react';
import './Message.css';

/**
 * Get icon and label for query type
 */
function getQueryTypeInfo(queryType) {
  switch (queryType) {
    case 'sql':
      return { 
        icon: Database, 
        label: 'Database Query',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)'
      };
    case 'pdf':
      return { 
        icon: FileText, 
        label: 'Document Search',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.1)'
      };
    case 'general':
      return { 
        icon: Brain, 
        label: 'General Knowledge',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.1)'
      };
    default:
      return { 
        icon: Zap, 
        label: 'AI Response',
        color: '#6b7280',
        bgColor: 'rgba(107, 114, 128, 0.1)'
      };
  }
}

/**
 * SQL Query Display Component
 */
function SqlQueryDisplay({ sqlQuery, sqlExplanation }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sqlQuery);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="sql-query-container">
      <div className="sql-query-header">
        <div className="sql-query-title">
          <Code size={16} />
          <span>Generated SQL Query</span>
        </div>
        <button 
          className={`sql-copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy SQL query'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="sql-query-code">
        <code>{sqlQuery}</code>
      </pre>
      {sqlExplanation && (
        <div className="sql-query-explanation">
          <span className="explanation-label">What this query does:</span>
          <span>{sqlExplanation}</span>
        </div>
      )}
      <div className="sql-query-footer">
        <span className="sql-hint">
          💡 Copy this query and run it directly in your database (PostgreSQL/MySQL compatible)
        </span>
      </div>
    </div>
  );
}

function Message({ message }) {
  const isUser = message.role === 'user';
  const hasCitations = message.citations &&
    (message.citations.groundingChunks?.length > 0 ||
      message.citations.webSearchQueries?.length > 0 ||
      message.citations.processedChunks?.length > 0);
  
  // Get query type info for assistant messages
  const queryTypeInfo = !isUser && message.queryType ? getQueryTypeInfo(message.queryType) : null;
  const QueryIcon = queryTypeInfo?.icon;

  // Check if this is a SQL query response
  const hasSqlQuery = !isUser && message.sqlQuery;

  return (
    <div className={`message-wrapper ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar-container">
        <div className={`message-avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`}>
          {isUser ? <User size={18} /> : <Stethoscope size={18} />}
        </div>
      </div>

      <div className="message-content-container">
        {/* Query Type Badge - Only for assistant messages with classification */}
        {queryTypeInfo && (
          <div 
            className="query-type-badge"
            style={{ 
              backgroundColor: queryTypeInfo.bgColor,
              color: queryTypeInfo.color,
              borderColor: queryTypeInfo.color
            }}
          >
            <QueryIcon size={12} />
            <span>{queryTypeInfo.label}</span>
            {message.classification?.confidence && (
              <span className="confidence-badge">
                {Math.round(message.classification.confidence * 100)}%
              </span>
            )}
          </div>
        )}

        {/* SQL Query Display - Show before the main content */}
        {hasSqlQuery && (
          <SqlQueryDisplay 
            sqlQuery={message.sqlQuery} 
            sqlExplanation={message.sqlExplanation}
          />
        )}

        <div className="message-bubble">
          {isUser ? (
            <div className="message-text">
              {message.content.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < message.content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => <h1 className="md-h1" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="md-h2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="md-h3" {...props} />,
                  ul: ({ node, ...props }) => <ul className="md-ul" {...props} />,
                  ol: ({ node, ...props }) => <ol className="md-ol" {...props} />,
                  li: ({ node, ...props }) => <li className="md-li" {...props} />,
                  code: ({ node, inline, ...props }) =>
                    inline ? <code className="md-code-inline" {...props} /> : <code className="md-code-block" {...props} />,
                  a: ({ node, ...props }) => <a className="md-link" target="_blank" rel="noopener noreferrer" {...props} />,
                  table: ({ node, ...props }) => <div className="table-wrapper"><table className="md-table" {...props} /></div>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* SQL Results Summary */}
        {message.sqlResults && message.sqlResults.success && (
          <div className="sql-results-summary">
            <Database size={14} />
            <span>{message.sqlResults.message}</span>
            {message.sqlResults.resultCount > 0 && (
              <span className="result-count">{message.sqlResults.resultCount} results</span>
            )}
            {message.sqlResults.previewExecuted && (
              <span className="preview-badge">Preview</span>
            )}
          </div>
        )}

        {/* Code Context Summary */}
        {message.codeContext && message.codeContext.length > 0 && (
          <div className="code-context-summary">
            <span className="context-label">Referenced Codes:</span>
            <div className="code-tags">
              {message.codeContext.map((code, idx) => (
                <span key={idx} className="code-tag">{code.code}</span>
              ))}
            </div>
          </div>
        )}

        {hasCitations && (
          <div className="message-citations">
            <Citations citations={message.citations} />
          </div>
        )}

        <div className="message-meta">
          <span className="message-time">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.classification?.reasoning && (
            <span className="classification-reasoning" title={message.classification.reasoning}>
              ℹ️
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default Message;
