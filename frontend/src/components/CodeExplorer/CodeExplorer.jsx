import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, ChevronRight, Database, Filter, Loader2 } from 'lucide-react';
import CodeDetail from './CodeDetail';
import './CodeExplorer.css';

const API_BASE_URL = 'http://localhost:3001/api';

function CodeExplorer() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
    total: 0,
    hasMore: false,
  });
  const [selectedCode, setSelectedCode] = useState(null);
  const [stats, setStats] = useState(null);

  // Fetch codes
  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });
      if (selectedType) params.append('type', selectedType);

      const response = await axios.get(`${API_BASE_URL}/codes?${params}`);
      setCodes(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        hasMore: response.data.hasMore,
      }));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset, selectedType]);

  // Search codes
  const searchCodes = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/codes/search`, {
        params: { q: query, limit: 50 },
      });
      setSearchResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/codes/stats`);
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      fetchCodes();
    }
  }, [fetchCodes, searchQuery]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchCodes(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCodes]);

  const handlePageChange = (direction) => {
    setPagination(prev => ({
      ...prev,
      offset: direction === 'next'
        ? prev.offset + prev.limit
        : Math.max(0, prev.offset - prev.limit),
    }));
  };

  const displayCodes = searchResults ? (searchResults.data || searchResults.codes || []) : codes;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="code-explorer">
      {/* Header */}
      <div className="explorer-header">
        <div className="header-title">
          <Database size={24} />
          <h2>Code Explorer</h2>
          {stats && (
            <span className="code-count">{stats.totalCodes?.toLocaleString()} codes</span>
          )}
        </div>

        <div className="header-controls">
          {/* Search */}
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search codes or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-btn" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          {/* Type Filter */}
          <div className="filter-box">
            <Filter size={18} />
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPagination(prev => ({ ...prev, offset: 0 }));
              }}
            >
              <option value="">All Types</option>
              <option value="CPT">CPT</option>
              <option value="HCPCS">HCPCS</option>
              <option value="ICD10">ICD-10 (Dx)</option>
              <option value="ICD10-PCS">ICD-10 PCS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && !searchQuery && (
        <div className="stats-bar">
          {Object.entries(stats.types || {}).map(([type, count]) => (
            <div
              key={type}
              className={`stat-item ${selectedType === type ? 'active' : ''}`}
              onClick={() => setSelectedType(selectedType === type ? '' : type)}
            >
              <span className="stat-type">{type}</span>
              <span className="stat-count">{count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search Results Info */}
      {searchResults && (
        <div className="search-info">
          Found {searchResults.total} results for "{searchResults.query}"
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-message">
          <span>Error: {error}</span>
          <button onClick={() => { setError(null); fetchCodes(); }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-overlay">
          <Loader2 className="spinner" size={32} />
          <span>Loading codes...</span>
        </div>
      )}

      {/* Code Table */}
      <div className="code-table-container">
        <table className="code-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Type</th>
              <th>Category</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayCodes?.map((code) => (
              <tr key={code.code} onClick={() => setSelectedCode(code.code)}>
                <td className="code-cell">{code.code}</td>
                <td className="desc-cell" title={code.description}>
                  {code.description.length > 100
                    ? code.description.substring(0, 100) + '...'
                    : code.description}
                </td>
                <td className="type-cell">
                  <span className={`type-badge ${code.type?.toLowerCase()}`}>
                    {code.type}
                  </span>
                </td>
                <td className="category-cell">{code.category}</td>
                <td className="action-cell">
                  <button
                    className="view-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCode(code.code);
                    }}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            {!loading && displayCodes?.length === 0 && (
              <tr>
                <td colSpan="5" className="no-results">
                  No codes found. Try adjusting your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!searchResults && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange('prev')}
            disabled={pagination.offset === 0}
          >
            <ChevronLeft size={18} />
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages} ({pagination.total.toLocaleString()} total)
          </span>
          <button
            onClick={() => handlePageChange('next')}
            disabled={!pagination.hasMore}
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Code Detail Modal */}
      {selectedCode && (
        <CodeDetail
          code={selectedCode}
          onClose={() => setSelectedCode(null)}
        />
      )}
    </div>
  );
}

export default CodeExplorer;

