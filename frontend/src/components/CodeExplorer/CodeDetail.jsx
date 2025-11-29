import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { X, Calculator, DollarSign, FileText, Tag, Calendar, Loader2 } from 'lucide-react';
import './CodeDetail.css';

const API_BASE_URL = 'http://localhost:3001/api';

const SITE_COLORS = {
  IPPS: '#3b82f6',   // Blue
  HOPD: '#10b981',   // Green
  ASC: '#f59e0b',    // Amber
  OBL: '#8b5cf6',    // Purple
};

const SITE_LABELS = {
  IPPS: 'Inpatient (DRG)',
  HOPD: 'Outpatient (OPPS)',
  ASC: 'ASC',
  OBL: 'Office-Based',
};

function CodeDetail({ code, onClose, onCalculate }) {
  const [codeData, setCodeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCodeDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/codes/${code}`);
        setCodeData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchCodeDetail();
    }
  }, [code]);

  if (!code) return null;

  // Prepare chart data
  const chartData = codeData ? Object.entries(codeData.payments || {})
    .filter(([_, value]) => value > 0)
    .map(([site, value]) => ({
      site,
      label: SITE_LABELS[site] || site,
      value,
      color: SITE_COLORS[site] || '#64748b',
    })) : [];

  const hasPaymentData = chartData.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="code-detail-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          <X size={24} />
        </button>

        {loading && (
          <div className="modal-loading">
            <Loader2 className="spinner" size={32} />
            <span>Loading code details...</span>
          </div>
        )}

        {error && (
          <div className="modal-error">
            <span>Error: {error}</span>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {codeData && (
          <>
            {/* Header */}
            <div className="detail-header">
              <div className="code-badge-large">{codeData.code}</div>
              <span className={`type-badge-large ${codeData.type?.toLowerCase()}`}>
                {codeData.type}
              </span>
            </div>

            {/* Description */}
            <div className="detail-section">
              <h3><FileText size={18} /> Description</h3>
              <p className="description-text">{codeData.description}</p>
            </div>

            {/* Category & Labels */}
            <div className="detail-row">
              <div className="detail-section half">
                <h3><Tag size={18} /> Category</h3>
                <p>{codeData.category}</p>
              </div>
              {codeData.labels && codeData.labels.length > 0 && (
                <div className="detail-section half">
                  <h3>Labels</h3>
                  <div className="labels-list">
                    {codeData.labels.map((label, i) => (
                      <span key={i} className="label-chip">{label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Chart */}
            {hasPaymentData && (
              <div className="detail-section">
                <h3><DollarSign size={18} /> Payment by Site of Service</h3>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis 
                        type="number" 
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                        fontSize={12}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="label" 
                        fontSize={12}
                        width={75}
                      />
                      <Tooltip 
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Payment']}
                        contentStyle={{ 
                          background: 'var(--bg-surface)', 
                          border: '1px solid var(--border)',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Payment Table */}
                <div className="payment-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Site of Service</th>
                        <th>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((item) => (
                        <tr key={item.site}>
                          <td>
                            <span 
                              className="site-dot" 
                              style={{ background: item.color }}
                            />
                            {item.label}
                          </td>
                          <td className="payment-value">
                            ${item.value.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!hasPaymentData && (
              <div className="detail-section no-payment">
                <h3><DollarSign size={18} /> Payment Information</h3>
                <p className="no-data-text">
                  Payment data is not available for this code type. 
                  Payment calculations are typically available for CPT and HCPCS codes.
                </p>
              </div>
            )}

            {/* Optional Metadata */}
            {codeData.optional && (
              <div className="detail-section">
                <h3>Additional Information</h3>
                <div className="metadata-grid">
                  {codeData.optional.apc && (
                    <div className="metadata-item">
                      <span className="meta-label">APC</span>
                      <span className="meta-value">{codeData.optional.apc}</span>
                    </div>
                  )}
                  {codeData.optional.si && (
                    <div className="metadata-item">
                      <span className="meta-label">Status Indicator</span>
                      <span className="meta-value">{codeData.optional.si}</span>
                    </div>
                  )}
                  {codeData.optional.rank && codeData.optional.rank > 0 && (
                    <div className="metadata-item">
                      <span className="meta-label">Rank</span>
                      <span className="meta-value">{codeData.optional.rank}</span>
                    </div>
                  )}
                  {codeData.optional.effectiveDate && (
                    <div className="metadata-item">
                      <span className="meta-label"><Calendar size={14} /> Effective Date</span>
                      <span className="meta-value">{codeData.optional.effectiveDate}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {hasPaymentData && (
              <div className="detail-actions">
                <button 
                  className="calculate-btn"
                  onClick={() => {
                    if (onCalculate) {
                      onCalculate(codeData.code);
                    }
                    // Navigate to calculator with this code pre-selected
                    window.dispatchEvent(new CustomEvent('navigate-to-calculator', { 
                      detail: { code: codeData.code } 
                    }));
                  }}
                >
                  <Calculator size={18} />
                  Calculate Reimbursement
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CodeDetail;

