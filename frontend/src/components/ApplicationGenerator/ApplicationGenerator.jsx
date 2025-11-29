import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
  FileText, 
  Download, 
  Printer,
  Building2,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  FileCheck,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import './ApplicationGenerator.css';

const API_BASE_URL = 'http://localhost:3001/api';

function ApplicationGenerator({ initialData, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [document, setDocument] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const printRef = useRef(null);

  // Form state with initial data
  const [formData, setFormData] = useState({
    // Basic info
    deviceName: initialData?.formData?.deviceName || '',
    manufacturer: initialData?.formData?.manufacturer || '',
    deviceDescription: '',
    
    // Applicant info
    manufacturerAddress: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    
    // Regulatory info
    fdaApprovalDate: initialData?.formData?.fdaApprovalDate || '',
    fdaApprovalType: initialData?.formData?.fdaApprovalType || 'PMA',
    fdaNumber: '',
    
    // Cost info
    deviceCost: initialData?.formData?.deviceCost || '',
    costJustification: '',
    
    // Clinical info
    clinicalImprovements: initialData?.formData?.clinicalImprovements || [],
    clinicalTrials: [],
    
    // Coding info
    indicatedProcedures: [],
    applicableDRGs: initialData?.formData?.drgCode ? [initialData.formData.drgCode] : [],
    applicableAPCs: initialData?.formData?.apcCode ? [initialData.formData.apcCode] : [],
    
    // TPT specific
    category: initialData?.formData?.category || 'device',
    hcpcsCode: '',
    clinicalBenefit: '',
  });

  const applicationType = initialData?.type || 'ntap';

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayInput = (field, value) => {
    const items = value.split(',').map(v => v.trim()).filter(v => v);
    setFormData(prev => ({ ...prev, [field]: items }));
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const generateApplication = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = applicationType === 'ntap' 
        ? '/ntap/application' 
        : '/tpt/application';

      const response = await axios.post(`${API_BASE_URL}${endpoint}`, {
        ...formData,
        deviceCost: formData.deviceCost ? parseFloat(formData.deviceCost) : undefined,
        clinicalTrials: formData.clinicalTrials.length > 0 
          ? formData.clinicalTrials 
          : undefined,
      });

      setDocument(response.data);
      
      // Expand all sections by default when document is generated
      const allSections = {};
      Object.keys(response.data.sections || {}).forEach(key => {
        allSections[key] = true;
      });
      setExpandedSections(allSections);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${document?.sections?.coverPage?.title || 'Application Document'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 2rem; }
            h1 { font-size: 1.5rem; text-align: center; margin-bottom: 0.5rem; }
            h2 { font-size: 1.25rem; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; margin-top: 2rem; }
            h3 { font-size: 1rem; color: #666; margin-top: 1.5rem; }
            .field { margin: 0.5rem 0; }
            .field-label { font-weight: bold; color: #333; }
            .field-value { margin-left: 0.5rem; }
            .cover-page { text-align: center; margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 2px solid #333; }
            .subtitle { color: #666; font-size: 1rem; }
            .meta { color: #888; font-size: 0.9rem; margin-top: 1rem; }
            ul { margin: 0.5rem 0; padding-left: 1.5rem; }
            li { margin: 0.25rem 0; }
            .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; background: #f0f0f0; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const downloadAsHTML = () => {
    if (!document) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${document.sections?.coverPage?.title || 'Application'}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { font-size: 1.5rem; text-align: center; }
            h2 { font-size: 1.25rem; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; margin-top: 2rem; }
            .field { margin: 0.75rem 0; }
            .field-label { font-weight: bold; }
            .cover { text-align: center; border-bottom: 2px solid #333; padding-bottom: 2rem; margin-bottom: 2rem; }
          </style>
        </head>
        <body>
          <div class="cover">
            <h1>${document.sections?.coverPage?.title}</h1>
            <p>${document.sections?.coverPage?.subtitle}</p>
            <p><strong>Technology:</strong> ${document.sections?.coverPage?.technology}</p>
            <p><strong>Applicant:</strong> ${document.sections?.coverPage?.applicant}</p>
            <p><strong>Date:</strong> ${document.sections?.coverPage?.submissionDate}</p>
          </div>
          ${Object.entries(document.sections || {})
            .filter(([key]) => key !== 'coverPage' && key !== 'attachments')
            .map(([key, section]) => `
              <h2>${section.title}</h2>
              ${Object.entries(section.fields || {}).map(([fieldKey, value]) => `
                <div class="field">
                  <span class="field-label">${formatFieldLabel(fieldKey)}:</span>
                  <span>${Array.isArray(value) ? value.join(', ') : value}</span>
                </div>
              `).join('')}
            `).join('')}
          <h2>Required Attachments</h2>
          <ul>
            ${(document.sections?.attachments?.items || []).map(item => `<li>${item}</li>`).join('')}
          </ul>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${applicationType.toUpperCase()}_Application_${formData.deviceName?.replace(/\s+/g, '_') || 'Draft'}.html`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFieldLabel = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="application-generator">
      {/* Header */}
      <div className="generator-header">
        <div className="header-content">
          <FileText size={28} />
          <div>
            <h2>{applicationType === 'ntap' ? 'NTAP' : 'TPT'} Application Generator</h2>
            <p>Generate draft application document for CMS submission</p>
          </div>
        </div>
        {onBack && (
          <button className="btn-back" onClick={onBack}>
            ← Back to Calculator
          </button>
        )}
      </div>

      <div className="generator-content">
        {/* Input Form */}
        <div className="generator-form">
          <h3>Application Details</h3>

          {/* Applicant Information */}
          <div className="form-section">
            <h4>Applicant Information</h4>
            
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
              <label>Manufacturer *</label>
              <div className="input-icon">
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
              <label>Manufacturer Address</label>
              <textarea
                value={formData.manufacturerAddress}
                onChange={(e) => handleInputChange('manufacturerAddress', e.target.value)}
                placeholder="Street, City, State, ZIP"
                rows={2}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Contact Name</label>
                <div className="input-icon">
                  <User size={18} />
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    placeholder="Full name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Contact Email</label>
                <div className="input-icon">
                  <Mail size={18} />
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                    placeholder="email@company.com"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Contact Phone</label>
              <div className="input-icon">
                <Phone size={18} />
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Product Information */}
          <div className="form-section">
            <h4>Product Information</h4>

            <div className="form-group">
              <label>Device Description</label>
              <textarea
                value={formData.deviceDescription}
                onChange={(e) => handleInputChange('deviceDescription', e.target.value)}
                placeholder="Detailed description of the device/technology"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Device Cost ($) *</label>
              <div className="input-icon">
                <DollarSign size={18} />
                <input
                  type="number"
                  value={formData.deviceCost}
                  onChange={(e) => handleInputChange('deviceCost', e.target.value)}
                  placeholder="Enter cost"
                  min="0"
                />
              </div>
            </div>

            {applicationType === 'tpt' && (
              <div className="form-group">
                <label>HCPCS Code (if assigned)</label>
                <input
                  type="text"
                  value={formData.hcpcsCode}
                  onChange={(e) => handleInputChange('hcpcsCode', e.target.value)}
                  placeholder="e.g., C1234"
                />
              </div>
            )}
          </div>

          {/* Regulatory Information */}
          <div className="form-section">
            <h4>Regulatory Information</h4>

            <div className="form-row">
              <div className="form-group">
                <label>FDA Approval Date</label>
                <div className="input-icon">
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
                  <option value="PMA">PMA</option>
                  <option value="510(k)">510(k)</option>
                  <option value="BLA">BLA</option>
                  <option value="NDA">NDA</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>FDA Approval Number</label>
              <input
                type="text"
                value={formData.fdaNumber}
                onChange={(e) => handleInputChange('fdaNumber', e.target.value)}
                placeholder="e.g., P230045 or K232456"
              />
            </div>
          </div>

          {/* Coding Information */}
          <div className="form-section">
            <h4>Coding Information</h4>

            <div className="form-group">
              <label>Indicated Procedures (CPT codes, comma-separated)</label>
              <input
                type="text"
                value={formData.indicatedProcedures.join(', ')}
                onChange={(e) => handleArrayInput('indicatedProcedures', e.target.value)}
                placeholder="e.g., 33361, 33362, 33363"
              />
            </div>

            {applicationType === 'ntap' ? (
              <div className="form-group">
                <label>Applicable DRGs (comma-separated)</label>
                <input
                  type="text"
                  value={formData.applicableDRGs.join(', ')}
                  onChange={(e) => handleArrayInput('applicableDRGs', e.target.value)}
                  placeholder="e.g., 216, 217, 218"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Applicable APCs (comma-separated)</label>
                <input
                  type="text"
                  value={formData.applicableAPCs.join(', ')}
                  onChange={(e) => handleArrayInput('applicableAPCs', e.target.value)}
                  placeholder="e.g., 5051, 5052"
                />
              </div>
            )}
          </div>

          {/* Clinical Information */}
          <div className="form-section">
            <h4>Clinical Information</h4>

            {applicationType === 'ntap' && (
              <div className="form-group">
                <label>Clinical Trials (comma-separated)</label>
                <input
                  type="text"
                  value={formData.clinicalTrials.join(', ')}
                  onChange={(e) => handleArrayInput('clinicalTrials', e.target.value)}
                  placeholder="e.g., TRIAL-001, STUDY-002"
                />
              </div>
            )}

            <div className="form-group">
              <label>{applicationType === 'ntap' ? 'Cost Justification' : 'Clinical Benefit'}</label>
              <textarea
                value={applicationType === 'ntap' ? formData.costJustification : formData.clinicalBenefit}
                onChange={(e) => handleInputChange(
                  applicationType === 'ntap' ? 'costJustification' : 'clinicalBenefit', 
                  e.target.value
                )}
                placeholder={applicationType === 'ntap' 
                  ? 'Explain why the device cost exceeds current DRG payment...'
                  : 'Describe the clinical benefit of this technology...'
                }
                rows={3}
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button 
            className="btn-generate"
            onClick={generateApplication}
            disabled={loading || !formData.deviceName || !formData.manufacturer}
          >
            {loading ? (
              <>
                <Loader2 className="spin" size={18} />
                Generating...
              </>
            ) : (
              <>
                <FileCheck size={18} />
                Generate Application
              </>
            )}
          </button>
        </div>

        {/* Document Preview */}
        <div className="document-preview">
          {document ? (
            <>
              <div className="preview-header">
                <h3>Document Preview</h3>
                <div className="preview-actions">
                  <button className="btn-action" onClick={handlePrint}>
                    <Printer size={18} />
                    Print
                  </button>
                  <button className="btn-action primary" onClick={downloadAsHTML}>
                    <Download size={18} />
                    Download
                  </button>
                </div>
              </div>

              <div className="document-content" ref={printRef}>
                {/* Cover Page */}
                <div className="doc-cover">
                  <h1>{document.sections?.coverPage?.title}</h1>
                  <p className="subtitle">{document.sections?.coverPage?.subtitle}</p>
                  <div className="cover-details">
                    <p><strong>Technology:</strong> {document.sections?.coverPage?.technology}</p>
                    <p><strong>Applicant:</strong> {document.sections?.coverPage?.applicant}</p>
                    <p><strong>Submission Date:</strong> {document.sections?.coverPage?.submissionDate}</p>
                  </div>
                  <div className="doc-status">
                    <span className="status-badge">{document.status}</span>
                  </div>
                </div>

                {/* Completion Status */}
                <div className="completion-status">
                  <div className="completion-bar">
                    <div 
                      className="completion-fill" 
                      style={{ width: `${document.summary?.completionStatus?.percentage || 0}%` }}
                    />
                  </div>
                  <span className="completion-text">
                    {document.summary?.completionStatus?.percentage || 0}% Complete
                  </span>
                  {document.summary?.completionStatus?.missingRequired?.length > 0 && (
                    <span className="missing-fields">
                      Missing: {document.summary.completionStatus.missingRequired.join(', ')}
                    </span>
                  )}
                </div>

                {/* Sections */}
                {Object.entries(document.sections || {}).map(([key, section]) => {
                  if (key === 'coverPage') return null;
                  
                  const isExpanded = expandedSections[key] !== false;
                  
                  return (
                    <div key={key} className="doc-section">
                      <div 
                        className="section-header"
                        onClick={() => toggleSection(key)}
                      >
                        <h2>{section.title}</h2>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                      
                      {isExpanded && (
                        <div className="section-content">
                          {section.fields && Object.entries(section.fields).map(([fieldKey, value]) => (
                            <div key={fieldKey} className="doc-field">
                              <span className="field-label">{formatFieldLabel(fieldKey)}:</span>
                              <span className="field-value">
                                {Array.isArray(value) 
                                  ? value.length > 0 
                                    ? value.join(', ') 
                                    : <em className="placeholder">[Not provided]</em>
                                  : value || <em className="placeholder">[Not provided]</em>
                                }
                              </span>
                            </div>
                          ))}
                          {section.items && (
                            <ul className="doc-list">
                              {section.items.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Estimated Payment */}
                {document.summary?.estimatedPayment && (
                  <div className="estimated-payment">
                    <strong>Estimated {applicationType === 'ntap' ? 'NTAP' : 'Pass-Through'} Payment:</strong>
                    <span className="payment-amount">
                      ${document.summary.estimatedPayment.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-preview">
              <FileText size={48} />
              <h4>Application Preview</h4>
              <p>Fill in the form and click "Generate Application" to preview your document.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ApplicationGenerator;

