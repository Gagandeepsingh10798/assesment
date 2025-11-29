import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Citations from './Citations';
import { User, Bot, Stethoscope } from 'lucide-react';
import './Message.css';

function Message({ message }) {
  const isUser = message.role === 'user';
  const hasCitations = message.citations &&
    (message.citations.groundingChunks?.length > 0 ||
      message.citations.webSearchQueries?.length > 0);

  return (
    <div className={`message-wrapper ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar-container">
        <div className={`message-avatar ${isUser ? 'user-avatar' : 'bot-avatar'}`}>
          {isUser ? <User size={18} /> : <Stethoscope size={18} />}
        </div>
      </div>

      <div className="message-content-container">
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

        {hasCitations && (
          <div className="message-citations">
            <Citations citations={message.citations} />
          </div>
        )}

        <div className="message-meta">
          <span className="message-time">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Message;
