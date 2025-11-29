import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, Sector, ReferenceLine
} from 'recharts';
import { Calculator, DollarSign, TrendingUp, TrendingDown, Search, RefreshCw, Info, ArrowRight } from 'lucide-react';
import './ReimbursementSimulator.css';

const API_BASE_URL = 'http://localhost:3001/api';

const CLASSIFICATION_COLORS = {
  profitable: '#10b981', // Emerald 500
  'break-even': '#f59e0b', // Amber 500
  loss: '#ef4444', // Red 500
};

const CLASSIFICATION_LABELS = {
  profitable: 'Profitable',
  'break-even': 'Break-Even',
  loss: 'Loss',
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="tooltip-item">
            <span className="tooltip-dot" style={{ backgroundColor: entry.fill || entry.color }}></span>
            <span className="tooltip-name">{entry.name}:</span>
            <span className="tooltip-value">
              {typeof entry.value === 'number'
                ? `$${entry.value.toLocaleString()}`
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Active Shape for Pie Chart
const renderActiveShape = (props) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="chart-center-text">
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
    </g>
  );
};

const RADIAN = Math.PI / 180;

function ReimbursementSimulator({ initialCode = '' }) {
  // Form state
  const [code, setCode] = useState(initialCode);
  const [codeSearch, setCodeSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [siteOfService, setSiteOfService] = useState('HOPD');
  const [deviceCost, setDeviceCost] = useState('');
  const [ntapAddOn, setNtapAddOn] = useState('');

  // Results state
  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Sites reference
  const [sites, setSites] = useState([]);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  // Fetch sites on mount
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/reimbursement/sites`);
        setSites(response.data.sites);
      } catch (err) {
        console.error('Error fetching sites:', err);
      }
    };
    fetchSites();
  }, []);

  // Handle initial code from navigation
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setCodeSearch(initialCode);
    }
  }, [initialCode]);

  // Debounced code search
  useEffect(() => {
    if (codeSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/codes/search`, {
          params: { q: codeSearch, limit: 10 },
        });
        setSearchResults(response.data.data || response.data.codes || []);
        setShowCodeDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [codeSearch]);

  // Calculate scenario
  const calculateScenario = async () => {
    if (!code || !siteOfService || !deviceCost) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate main scenario
      const scenarioResponse = await axios.post(`${API_BASE_URL}/reimbursement/scenario`, {
        code,
        siteOfService,
        deviceCost: parseFloat(deviceCost),
        ntapAddOn: ntapAddOn ? parseFloat(ntapAddOn) : 0,
      });

      if (scenarioResponse.data.error) {
        throw new Error(scenarioResponse.data.message);
      }

      setResult(scenarioResponse.data);

      // Fetch comparison across all sites
      const compareResponse = await axios.get(`${API_BASE_URL}/reimbursement/compare/${code}`, {
        params: {
          deviceCost: parseFloat(deviceCost),
          ntapAddOn: ntapAddOn ? parseFloat(ntapAddOn) : 0,
        },
      });

      setComparison(compareResponse.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setResult(null);
      setComparison(null);
    } finally {
      setLoading(false);
    }
  };

  // Select code from dropdown
  const selectCode = (selectedCode) => {
    setCode(selectedCode.code);
    setCodeSearch(selectedCode.code);
    setShowCodeDropdown(false);
    setSearchResults([]);
  };

  // Reset form
  const resetForm = () => {
    setCode('');
    setCodeSearch('');
    setSiteOfService('HOPD');
    setDeviceCost('');
    setNtapAddOn('');
    setResult(null);
    setComparison(null);
    setError(null);
  };

  // Prepare chart data
  const pieChartData = result ? [
    { name: 'Device Cost', value: result.deviceCost, fill: '#94a3b8' }, // Slate 400
    { name: 'Margin', value: Math.max(0, result.margin), fill: CLASSIFICATION_COLORS[result.classification] },
  ].filter(d => d.value > 0) : [];

  const comparisonChartData = comparison?.comparisons?.map(c => ({
    site: c.site,
    margin: c.margin,
    fill: CLASSIFICATION_COLORS[c.classification],
    totalPayment: c.totalPayment
  })) || [];

  return (
    <div className="reimbursement-simulator">
      <div className="simulator-header">
        <div className="header-title">
          <div className="icon-wrapper">
            <Calculator size={24} />
          </div>
          <div>
            <h2>Reimbursement Simulator</h2>
            <p>Calculate financial scenarios for medical procedures</p>
          </div>
        </div>
      </div>

      <div className="simulator-content">
        {/* Input Form */}
        <div className="simulator-form card">
          <h3>Scenario Parameters</h3>

          {/* Code Input */}
          <div className="form-group">
            <label>
              Procedure Code (CPT/HCPCS)
              <span className="required">*</span>
            </label>
            <div className="code-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                value={codeSearch}
                onChange={(e) => {
                  setCodeSearch(e.target.value);
                  if (e.target.value !== code) {
                    setCode('');
                  }
                }}
                onFocus={() => searchResults.length > 0 && setShowCodeDropdown(true)}
                placeholder="Search code (e.g. 33208)..."
                className="code-input"
              />
              {showCodeDropdown && searchResults.length > 0 && (
                <div className="code-dropdown">
                  {searchResults.map((c) => (
                    <div
                      key={c.code}
                      className="code-option"
                      onClick={() => selectCode(c)}
                    >
                      <span className="option-code">{c.code}</span>
                      <span className="option-desc">
                        {c.description.substring(0, 60)}...
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Site of Service */}
          <div className="form-group">
            <label>
              Site of Service
              <span className="required">*</span>
            </label>
            <select
              value={siteOfService}
              onChange={(e) => setSiteOfService(e.target.value)}
              className="form-select"
            >
              {sites.map((site) => (
                <option key={site.key} value={site.key}>
                  {site.name}
                </option>
              ))}
            </select>
            <span className="field-hint">
              {sites.find(s => s.key === siteOfService)?.description}
            </span>
          </div>

          {/* Device Cost */}
          <div className="form-group">
            <label>
              Device/Supply Cost ($)
              <span className="required">*</span>
            </label>
            <div className="money-input-wrapper">
              <DollarSign size={18} className="money-icon" />
              <input
                type="number"
                value={deviceCost}
                onChange={(e) => setDeviceCost(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="money-input"
              />
            </div>
          </div>

          {/* NTAP Add-On */}
          <div className="form-group">
            <label>
              NTAP Add-On Payment ($)
              <span className="optional">(optional)</span>
            </label>
            <div className="money-input-wrapper">
              <DollarSign size={18} className="money-icon" />
              <input
                type="number"
                value={ntapAddOn}
                onChange={(e) => setNtapAddOn(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="money-input"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="form-error">
              <Info size={18} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button
              className="calculate-btn"
              onClick={calculateScenario}
              disabled={loading || !code || !deviceCost}
            >
              {loading ? (
                <>
                  <RefreshCw className="spinner" size={18} />
                  Calculating...
                </>
              ) : (
                <>
                  Calculate Scenario
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <button className="reset-btn" onClick={resetForm}>
              Reset
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="simulator-results">
            {/* Summary Cards */}
            <div className="result-cards-grid">
              <div className="result-card">
                <span className="card-label">Base Payment</span>
                <span className="card-value">${result.basePayment.toLocaleString()}</span>
                <span className="card-source">{result.siteOfService}</span>
              </div>

              {result.addOnPayment > 0 && (
                <div className="result-card">
                  <span className="card-label">NTAP Add-On</span>
                  <span className="card-value add-on">+${result.addOnPayment.toLocaleString()}</span>
                </div>
              )}

              <div className="result-card highlight">
                <span className="card-label">Total Payment</span>
                <span className="card-value">${result.totalPayment.toLocaleString()}</span>
              </div>

              <div className="result-card">
                <span className="card-label">Device Cost</span>
                <span className="card-value cost">-${result.deviceCost.toLocaleString()}</span>
              </div>

              <div className={`result-card margin ${result.classification}`}>
                <span className="card-label">Net Margin</span>
                <span className="card-value">
                  {result.margin >= 0 ? '+' : ''}${result.margin.toLocaleString()}
                </span>
                <span className="card-percentage">{result.marginPercentage}%</span>
              </div>
            </div>

            {/* Classification Banner */}
            <div className={`classification-banner ${result.classification}`}>
              <div className="banner-icon">
                {result.classification === 'profitable' && <TrendingUp size={24} />}
                {result.classification === 'loss' && <TrendingDown size={24} />}
                {result.classification === 'break-even' && <span className="equals">=</span>}
              </div>
              <div className="banner-content">
                <span className="banner-title">
                  {CLASSIFICATION_LABELS[result.classification]} Scenario
                </span>
                <span className="banner-desc">
                  {result.classification === 'profitable' && 'This procedure is projected to be financially sustainable.'}
                  {result.classification === 'break-even' && 'This procedure is near the break-even point.'}
                  {result.classification === 'loss' && 'This procedure is projected to operate at a loss.'}
                </span>
              </div>
            </div>

            <div className="charts-grid">
              {/* Breakdown Chart */}
              {pieChartData.length > 0 && (
                <div className="chart-card">
                  <h4>Payment Breakdown</h4>
                  <div className="pie-chart-container">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          activeIndex={activeIndex}
                          activeShape={renderActiveShape}
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          onMouseEnter={onPieEnter}
                          paddingAngle={5}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                          ))}
                        </Pie>
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Site Comparison */}
              {comparison && comparisonChartData.length > 0 && (
                <div className="chart-card">
                  <h4>Margin Comparison by Site</h4>
                  <div className="comparison-chart-container">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={comparisonChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                        <XAxis
                          type="number"
                          tickFormatter={(v) => `$${v >= 0 ? (v / 1000).toFixed(0) + 'k' : `(${Math.abs(v / 1000).toFixed(0)}k)`}`}
                          fontSize={12}
                          stroke="var(--text-light)"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="site"
                          width={100}
                          fontSize={12}
                          stroke="var(--text-main)"
                          tickLine={false}
                          axisLine={false}
                          fontWeight={500}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-app)', opacity: 0.4 }} />
                        <ReferenceLine x={0} stroke="var(--border)" />
                        <Bar dataKey="margin" radius={[0, 4, 4, 0]} barSize={32}>
                          {comparisonChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Code Info */}
            <div className="code-info-card">
              <h4>Procedure Information</h4>
              <div className="code-info-grid">
                <div className="info-item">
                  <span className="info-label">Code</span>
                  <span className="info-value code-badge">{result.code}</span>
                </div>
                {result.codeDetails?.apc && (
                  <div className="info-item">
                    <span className="info-label">APC</span>
                    <span className="info-value">{result.codeDetails.apc}</span>
                  </div>
                )}
                <div className="info-item full-width">
                  <span className="info-label">Description</span>
                  <span className="info-value description">{result.description}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReimbursementSimulator;
