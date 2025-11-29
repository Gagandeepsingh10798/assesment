import React, { useState } from 'react';
import { BookOpen, Link as LinkIcon, ChevronDown, ChevronUp, Globe, FileText, ExternalLink } from 'lucide-react';
import './Citations.css';

function Citations({ citations }) {
  const [isExpanded, setIsExpanded] = useState(true); // Default expanded

  if (!citations) return null;

  const { groundingChunks, webSearchQueries } = citations;
  const hasChunks = groundingChunks && groundingChunks.length > 0;
  const hasQueries = webSearchQueries && webSearchQueries.length > 0;

  if (!hasChunks && !hasQueries) return null;

  // Helper function to extract citation info from different formats
  const getCitationInfo = (chunk) => {
    // Web search format: { web: { uri, title } }
    if (chunk.web) {
      return {
        type: 'web',
        uri: chunk.web.uri,
        title: chunk.web.title || 'Web Source',
        text: chunk.chunk?.content || chunk.text || null
      };
    }
    // File search format: { retrievedContext: { uri, title, text } }
    if (chunk.retrievedContext) {
      return {
        type: 'file',
        uri: chunk.retrievedContext.uri,
        title: chunk.retrievedContext.title || 'Uploaded Document',
        text: chunk.retrievedContext.text || null
      };
    }
    // File search alternate format
    if (chunk.fileSearch) {
      return {
        type: 'file',
        uri: chunk.fileSearch.uri,
        title: chunk.fileSearch.title || 'Uploaded Document',
        text: chunk.fileSearch.text || null
      };
    }
    // Fallback
    return {
      type: 'unknown',
      uri: null,
      title: chunk.title || 'Source',
      text: chunk.content || chunk.text || null
    };
  };

  const totalCount = groundingChunks?.length || 0;

  return (
    <div className="citations-container">
      <div className="citations-header" onClick={() => setIsExpanded(!isExpanded)}>
        <BookOpen size={16} />
        <span>Sources & Citations</span>
        <span className="citation-count">({totalCount})</span>
        <button className="toggle-button" aria-label={isExpanded ? "Collapse citations" : "Expand citations"}>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isExpanded && (
        <div className="citations-content">
          {hasChunks && (
            <div className="citations-section">
              {groundingChunks.map((chunk, index) => {
                const info = getCitationInfo(chunk);
                return (
                  <div key={index} className={`citation-card ${info.type}`}>
                    <div className="citation-badge">{index + 1}</div>
                    <div className="citation-text">
                      {info.text && (
                        <p className="citation-snippet">
                          "{info.text.substring(0, 150)}{info.text.length > 150 ? '...' : ''}"
                        </p>
                      )}
                      <div className="citation-source">
                        {info.type === 'web' ? <Globe size={14} /> : <FileText size={14} />}
                        {info.uri ? (
                          <a 
                            href={info.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="source-link"
                          >
                            {info.title}
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="source-title">{info.title}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasQueries && (
            <div className="web-search-section">
              <h4 className="section-title">
                <Globe size={14} />
                Web Searches
              </h4>
              <div className="search-queries">
                {webSearchQueries.map((query, index) => (
                  <div key={index} className="search-chip">
                    <LinkIcon size={12} />
                    <span>{query}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Citations;
