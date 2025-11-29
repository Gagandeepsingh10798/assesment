import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Calculator, 
  FileCheck, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  HelpCircle,
  DollarSign,
  Calendar,
  Building2,
  Pill,
  ChevronRight,
  Info,
  TrendingUp,
  FileText
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './NtapTptCalculator.css';

const API_BASE_URL = 'http://localhost:3001/api';

const CLINICAL_IMPROVEMENTS = [
  'Reduced mortality',
  'Reduced complications',
  'Reduced hospital stay',
  'Improved patient outcomes',
  'Reduced readmissions',
  'Treatment for unmet need',
];

const TPT_CATEGORIES = [
  { value: 'device', label: 'Medical Device' },
  { value: 'drug', label: 'Drug' },
  { value: 'biological', label: 'Biological' },
];

function NtapTptCalculator({ onGenerateApplication }) {
  const [activeTab, setActiveTab] = useState('ntap');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    deviceName: '',
    manufacturer: '',
    deviceCost: '',
    drgCode: '',
    apcCode: '',
    fdaApprovalDate: '',
    fdaApprovalType: 'PMA',
    category: 'device',
    clinicalImprovements: [],
  });

  // Results state
  const [eligibilityResult, setEligibilityResult] = useState(null);
  const [calculationResult, setCalculationResult] = useState(null);
  
  // Reference data
  const [availableDrgs, setAvailableDrgs] = useState([]);
  const [availableApcs, setAvailableApcs] = useState([]);
  const [approvedTechnologies, setApprovedTechnologies] = useState([]);

  // Fetch reference data on mount
  useEffect(() => {
    fetchReferenceData();
  }, [activeTab]);

  const fetchReferenceData = async () => {
    try {
      if (activeTab === 'ntap') {
        const [drgsRes, approvedRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/ntap/drgs`),
          axios.get(`${API_BASE_URL}/ntap/approved-list`),
        ]);
        setAvailableDrgs(drgsRes.data.drgs || []);
        setApprovedTechnologies(approvedRes.data.technologies || []);
      } else {
        const [apcsRes, approvedRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/tpt/apcs`),
          axios.get(`${API_BASE_URL}/tpt/approved-list`),
        ]);
        setAvailableApcs(apcsRes.data.apcs || []);
        setApprovedTechnologies(approvedRes.data.technologies || []);
      }
    } catch (err) {
      console.error('Error fetching reference data:', err);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImprovementToggle = (improvement) => {
    setFormData(prev => ({
      ...prev,
      clinicalImprovements: prev.clinicalImprovements.includes(improvement)
        ? prev.clinicalImprovements.filter(i => i !== improvement)
        : [...prev.clinicalImprovements, improvement],
    }));
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setCalculationResult(null);

    try {
      const endpoint = activeTab === 'ntap' ? '/ntap/calculate' : '/tpt/calculate';
      const payload = activeTab === 'ntap' 
        ? { deviceCost: formData.deviceCost, drgCode: formData.drgCode }
        : { deviceCost: formData.deviceCost, apcCode: formData.apcCode };

      const response = await axios.post(`${API_BASE_URL}${endpoint}`, payload);
      setCalculationResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEligibility = async () => {
    setLoading(true);
    setError(null);
    setEligibilityResult(null);

    try {
      const endpoint = activeTab === 'ntap' ? '/ntap/eligibility' : '/tpt/eligibility';
      const payload = activeTab === 'ntap'
        ? {
            deviceName: formData.deviceName,
            manufacturer: formData.manufacturer,
            deviceCost: formData.deviceCost,
            drgCode: formData.drgCode,
            fdaApprovalDate: formData.fdaApprovalDate,
            fdaApprovalType: formData.fdaApprovalType,
            clinicalImprovements: formData.clinicalImprovements,
          }
        : {
            deviceName: formData.deviceName,
            manufacturer: formData.manufacturer,
            deviceCost: formData.deviceCost,
            apcCode: formData.apcCode,
            fdaApprovalDate: formData.fdaApprovalDate,
            fdaApprovalType: formData.fdaApprovalType,
            category: formData.category,
          };

      const response = await axios.post(`${API_BASE_URL}${endpoint}`, payload);
      setEligibilityResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateApplication = () => {
    if (onGenerateApplication) {
      onGenerateApplication({
        type: activeTab,
        formData,
        eligibilityResult,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      deviceName: '',
      manufacturer: '',
      deviceCost: '',
      drgCode: '',
      apcCode: '',
      fdaApprovalDate: '',
      fdaApprovalType: 'PMA',
      category: 'device',
      clinicalImprovements: [],
    });
    setEligibilityResult(null);
    setCalculationResult(null);
    setError(null);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'likely_eligible':
        return <CheckCircle className="status-icon eligible" size={24} />;
      case 'needs_review':
        return <HelpCircle className="status-icon review" size={24} />;
      default:
        return <XCircle className="status-icon not-eligible" size={24} />;
    }
  };

  const getCriterionIcon = (met) => {
    return met 
      ? <CheckCircle className="criterion-icon met" size={16} />
      : <XCircle className="criterion-icon not-met" size={16} />;
  };

  // Chart data for payment breakdown
  const getChartData = () => {
    if (!calculationResult) return [];
    
    if (activeTab === 'ntap') {
      return [
        { name: 'DRG Payment', value: calculationResult.drgPayment || 0, fill: '#64748b' },
        { name: 'NTAP Add-On', value: calculationResult.ntapPayment || 0, fill: '#10b981' },
      ];
    } else {
      return [
        { name: 'APC Payment', value: calculationResult.apcPayment || 0, fill: '#64748b' },
        { name: 'Pass-Through', value: calculationResult.passThroughPayment || 0, fill: '#3b82f6' },
      ];
    }
  };

  return (
    <div className="ntap-tpt-calculator">
      {/* Header */}
      <div className="calculator-header">
        <div className="header-title">
          <Calculator size={28} />
          <div>
            <h2>NTAP/TPT Calculator</h2>
            <p>Calculate eligibility and payments for new technology programs</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'ntap' ? 'active' : ''}`}
          onClick={() => { setActiveTab('ntap'); resetForm(); }}
        >
          <TrendingUp size={18} />
          NTAP (Inpatient)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tpt' ? 'active' : ''}`}
          onClick={() => { setActiveTab('tpt'); resetForm(); }}
        >
          <Pill size={18} />
          TPT (Outpatient)
        </button>
      </div>

      <div className="calculator-content">
        {/* Input Form */}
        <div className="calculator-form">
          <h3>Technology Information</h3>

          <div className="form-group">
            <label>Device/Technology Name *</label>
            <input
              type="text"
              value={formData.deviceName}
              onChange={(e) => handleInputChange('deviceName', e.target.value)}
              placeholder="Enter device name"
            />
          </div>

          <div className="form-group">
            <label>Manufacturer</label>
            <div className="input-with-icon">
              <Building2 size={18} />
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                placeholder="Enter manufacturer name"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Device Cost ($) *</label>
            <div className="input-with-icon">
              <DollarSign size={18} />
              <input
                type="number"
                value={formData.deviceCost}
                onChange={(e) => handleInputChange('deviceCost', e.target.value)}
                placeholder="Enter device cost"
                min="0"
              />
            </div>
          </div>

          {activeTab === 'ntap' ? (
            <div className="form-group">
              <label>DRG Code</label>
              <select
                value={formData.drgCode}
                onChange={(e) => handleInputChange('drgCode', e.target.value)}
              >
                <option value="">Select DRG...</option>
                {availableDrgs.map(drg => (
                  <option key={drg.code} value={drg.code}>
                    {drg.code} - ${drg.payment.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>APC Code</label>
                <select
                  value={formData.apcCode}
                  onChange={(e) => handleInputChange('apcCode', e.target.value)}
                >
                  <option value="">Select APC...</option>
                  {availableApcs.map(apc => (
                    <option key={apc.code} value={apc.code}>
                      {apc.code} - ${apc.payment.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  {TPT_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label>FDA Approval Date</label>
            <div className="input-with-icon">
              <Calendar size={18} />
              <input
                type="date"
                value={formData.fdaApprovalDate}
                onChange={(e) => handleInputChange('fdaApprovalDate', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>FDA Approval Type</label>
            <select
              value={formData.fdaApprovalType}
              onChange={(e) => handleInputChange('fdaApprovalType', e.target.value)}
            >
              <option value="PMA">PMA (Premarket Approval)</option>
              <option value="510(k)">510(k) Clearance</option>
              <option value="BLA">BLA (Biologics)</option>
              <option value="NDA">NDA (New Drug)</option>
            </select>
          </div>

          {activeTab === 'ntap' && (
            <div className="form-group">
              <label>Clinical Improvements</label>
              <div className="checkbox-group">
                {CLINICAL_IMPROVEMENTS.map(improvement => (
                  <label key={improvement} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.clinicalImprovements.includes(improvement)}
                      onChange={() => handleImprovementToggle(improvement)}
                    />
                    <span>{improvement}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="form-actions">
            <button 
              className="btn-primary"
              onClick={handleCheckEligibility}
              disabled={loading || !formData.deviceName || !formData.deviceCost}
            >
              <FileCheck size={18} />
              Check Eligibility
            </button>
            <button 
              className="btn-secondary"
              onClick={handleCalculate}
              disabled={loading || !formData.deviceCost}
            >
              <Calculator size={18} />
              Calculate Payment
            </button>
            <button className="btn-reset" onClick={resetForm}>
              Reset
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="calculator-results">
          {/* Payment Calculation Result */}
          {calculationResult && (
            <div className="result-section">
              <h3>Payment Calculation</h3>
              
              <div className="payment-summary">
                <div className="payment-card total">
                  <span className="label">Total Reimbursement</span>
                  <span className="value">
                    ${calculationResult.totalReimbursement?.toLocaleString() || '0'}
                  </span>
                </div>
                
                <div className="payment-breakdown">
                  <div className="payment-card">
                    <span className="label">
                      {activeTab === 'ntap' ? 'Base DRG' : 'Base APC'}
                    </span>
                    <span className="value">
                      ${(activeTab === 'ntap' 
                        ? calculationResult.drgPayment 
                        : calculationResult.apcPayment)?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="payment-card addon">
                    <span className="label">
                      {activeTab === 'ntap' ? 'NTAP Add-On' : 'Pass-Through'}
                    </span>
                    <span className="value">
                      +${(activeTab === 'ntap' 
                        ? calculationResult.ntapPayment 
                        : calculationResult.passThroughPayment)?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="payment-chart">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={getChartData()} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {getChartData().map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Eligibility Result */}
          {eligibilityResult && (
            <div className="result-section eligibility">
              <h3>Eligibility Assessment</h3>
              
              <div className={`status-badge ${eligibilityResult.status}`}>
                {getStatusIcon(eligibilityResult.status)}
                <span>{eligibilityResult.statusLabel}</span>
              </div>

              <div className="criteria-list">
                <h4>Eligibility Criteria ({eligibilityResult.criteriaMetCount}/{eligibilityResult.totalCriteria} met)</h4>
                {eligibilityResult.eligibilityCriteria?.map((criterion, index) => (
                  <div key={index} className={`criterion-item ${criterion.met ? 'met' : 'not-met'}`}>
                    {getCriterionIcon(criterion.met)}
                    <div className="criterion-content">
                      <span className="criterion-name">{criterion.criterion}</span>
                      <span className="criterion-description">{criterion.description}</span>
                      <span className="criterion-details">{criterion.details}</span>
                    </div>
                  </div>
                ))}
              </div>

              {eligibilityResult.recommendations?.length > 0 && (
                <div className="recommendations">
                  <h4>Recommendations</h4>
                  <ul>
                    {eligibilityResult.recommendations.map((rec, index) => (
                      <li key={index}>
                        <ChevronRight size={14} />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {eligibilityResult.potentialPayment && (
                <div className="potential-payment">
                  <Info size={18} />
                  <span>
                    Potential {activeTab === 'ntap' ? 'NTAP' : 'Pass-Through'} Payment: 
                    <strong>
                      ${(activeTab === 'ntap' 
                        ? eligibilityResult.potentialPayment.ntapPayment 
                        : eligibilityResult.potentialPayment.passThroughPayment)?.toLocaleString()}
                    </strong>
                  </span>
                </div>
              )}

              {(eligibilityResult.status === 'likely_eligible' || 
                eligibilityResult.status === 'needs_review') && (
                <button 
                  className="btn-generate"
                  onClick={handleGenerateApplication}
                >
                  <FileText size={18} />
                  Generate Application Document
                </button>
              )}
            </div>
          )}

          {/* Approved Technologies Reference */}
          {approvedTechnologies.length > 0 && !eligibilityResult && !calculationResult && (
            <div className="result-section reference">
              <h3>
                {activeTab === 'ntap' ? 'Approved NTAP Technologies' : 'Approved TPT Technologies'}
              </h3>
              <div className="approved-list">
                {approvedTechnologies.slice(0, 3).map((tech, index) => (
                  <div key={index} className="approved-item">
                    <div className="approved-header">
                      <span className="approved-name">{tech.name}</span>
                      <span className="approved-manufacturer">{tech.manufacturer}</span>
                    </div>
                    <div className="approved-details">
                      <span>
                        {activeTab === 'ntap' 
                          ? `Max NTAP: $${tech.maxNtapPayment?.toLocaleString()}`
                          : `Pass-Through: $${tech.passThroughPayment?.toLocaleString()}`
                        }
                      </span>
                      <span>Cost: ${tech.deviceCost?.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!calculationResult && !eligibilityResult && approvedTechnologies.length === 0 && (
            <div className="empty-state">
              <Calculator size={48} />
              <h4>Enter Technology Details</h4>
              <p>
                Fill in the form to calculate {activeTab === 'ntap' ? 'NTAP' : 'TPT'} 
                payments and check eligibility.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NtapTptCalculator;

