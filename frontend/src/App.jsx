import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Chatbot } from './components/Chat';
import { CodeExplorer } from './components/CodeExplorer';
import { ReimbursementSimulator } from './components/ReimbursementSimulator';
import { NtapTptCalculator } from './components/NtapTptCalculator';
import { ApplicationGenerator } from './components/ApplicationGenerator';
import {
  Activity,
  MessageSquare,
  Database,
  Calculator,
  Menu,
  X,
  FileText,
  ChevronRight,
  BarChart3,
  Cloud,
  Trash2,
  FileCheck
} from 'lucide-react';
import './App.css';

const API_BASE_URL = 'http://localhost:3001/api';

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [filesSource, setFilesSource] = useState('');
  const [codeStats, setCodeStats] = useState(null);
  const [calculatorCode, setCalculatorCode] = useState('');
  const [ntapApplicationData, setNtapApplicationData] = useState(null);
  const [isFileOperationInProgress, setIsFileOperationInProgress] = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/files`);
      if (response.data.files) {
        setUploadedFiles(response.data.files);
        setFilesSource(response.data.source || 'unknown');
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const deleteFile = async (file) => {
    const displayName = file.displayName || file.name?.split('/').pop() || 'this file';
    if (!window.confirm(`Delete "${displayName}"?`)) return;

    setIsFileOperationInProgress(true);
    setDeletingFile(file.name);
    
    try {
      const documentName = file.name || file.fileName;
      const response = await axios.delete(`${API_BASE_URL}/files/${encodeURIComponent(documentName)}`);
      
      if (response.data.success === false) {
        // Handle graceful failure (e.g., file in use)
        alert(response.data.message || 'Failed to delete file');
      } else {
        await fetchFiles();
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file: ' + (error.response?.data?.message || error.response?.data?.error || error.message));
    } finally {
      setIsFileOperationInProgress(false);
      setDeletingFile(null);
    }
  };

  const handleFileOperationStart = () => {
    setIsFileOperationInProgress(true);
  };

  const handleFileOperationEnd = () => {
    setIsFileOperationInProgress(false);
    fetchFiles();
  };

  const fetchCodeStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/codes/stats`);
      setCodeStats(response.data);
    } catch (error) {
      console.error('Error fetching code stats:', error);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchCodeStats();
  }, []);

  // Listen for navigation events from CodeDetail
  useEffect(() => {
    const handleNavigateToCalculator = (event) => {
      setCalculatorCode(event.detail.code);
      navigate('/calculator');
    };

    window.addEventListener('navigate-to-calculator', handleNavigateToCalculator);
    return () => {
      window.removeEventListener('navigate-to-calculator', handleNavigateToCalculator);
    };
  }, [navigate]);

  // Handle NTAP/TPT application generation
  const handleGenerateApplication = (data) => {
    setNtapApplicationData(data);
    navigate('/ntap-tpt/application');
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Reimbursement Consultation';
      case '/codes':
        return 'Code Explorer';
      case '/calculator':
        return 'Reimbursement Simulator';
      case '/ntap-tpt':
        return 'NTAP/TPT Calculator';
      case '/ntap-tpt/application':
        return 'Application Generator';
      default:
        return 'Reimbursement Intelligence';
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <BarChart3 className="logo-icon" size={28} />
            <span className="logo-text">RIM</span>
          </div>
          <button className="mobile-close-btn" onClick={toggleSidebar}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
          >
            <MessageSquare size={20} />
            <span>Consultation</span>
          </Link>

          <Link
            to="/codes"
            className={`nav-item ${location.pathname === '/codes' ? 'active' : ''}`}
          >
            <Database size={20} />
            <span>Code Explorer</span>
            {codeStats && (
              <span className="nav-badge">{(codeStats.totalCodes / 1000).toFixed(0)}K</span>
            )}
          </Link>

          <Link
            to="/calculator"
            className={`nav-item ${location.pathname === '/calculator' ? 'active' : ''}`}
          >
            <Calculator size={20} />
            <span>Reimbursement Simulator</span>
          </Link>

          <Link
            to="/ntap-tpt"
            className={`nav-item ${location.pathname.startsWith('/ntap-tpt') ? 'active' : ''}`}
          >
            <FileCheck size={20} />
            <span>NTAP/TPT Applications</span>
          </Link>

          {/* Uploaded Files Section */}
          {uploadedFiles.length > 0 && (
            <div className="nav-section">
              <span className="nav-section-title">
                <Cloud size={14} style={{ marginRight: '4px' }} />
                File Store ({uploadedFiles.length})
              </span>
              <div className="file-list-sidebar">
                {uploadedFiles.map((file, index) => {
                  const isDeleting = deletingFile === file.name;
                  return (
                    <div 
                      key={index} 
                      className={`nav-file-item ${isDeleting ? 'deleting' : ''}`} 
                      title={file.displayName || file.fileName}
                    >
                      {isDeleting ? (
                        <div className="file-spinner" />
                      ) : (
                        <FileText size={16} />
                      )}
                      <div className="file-info">
                        <span className="file-name">
                          {isDeleting ? 'Deleting...' : (file.displayName || file.fileName)}
                        </span>
                        {file.size && !isDeleting && (
                          <span className="file-size">
                            {(file.size / 1024).toFixed(1)}KB
                          </span>
                        )}
                      </div>
                      <button
                        className="file-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFile(file);
                        }}
                        title="Delete file"
                        disabled={isFileOperationInProgress}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Code Type Stats */}
          {codeStats?.types && (
            <div className="nav-section">
              <span className="nav-section-title">Code Database</span>
              <div className="stats-list">
                {Object.entries(codeStats.types).map(([type, count]) => (
                  <div key={type} className="stat-item-sidebar">
                    <span className={`stat-dot ${type.toLowerCase()}`}></span>
                    <span className="stat-label">{type}</span>
                    <span className="stat-value">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="nav-spacer"></div>

          <div className="sidebar-footer">
            <div className="footer-text">
              <Activity size={16} />
              Reimbursement Intelligence Module
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <button className="menu-btn" onClick={toggleSidebar}>
            <Menu size={24} />
          </button>

          <div className="breadcrumb">
            <span className="breadcrumb-home">RIM</span>
            <ChevronRight size={16} />
            <span className="breadcrumb-current">{getPageTitle()}</span>
          </div>

          <div className="user-profile">
            <div className="avatar">RI</div>
          </div>
        </header>

        <div className="content-area">
          <Routes>
            <Route path="/" element={
              <Chatbot 
                onUploadSuccess={fetchFiles}
                onFileOperationStart={handleFileOperationStart}
                onFileOperationEnd={handleFileOperationEnd}
                isFileOperationInProgress={isFileOperationInProgress}
              />
            } />
            <Route path="/codes" element={<CodeExplorer />} />
            <Route
              path="/calculator"
              element={
                <ReimbursementSimulator
                  initialCode={calculatorCode}
                />
              }
            />
            <Route
              path="/ntap-tpt"
              element={
                <NtapTptCalculator
                  onGenerateApplication={handleGenerateApplication}
                />
              }
            />
            <Route
              path="/ntap-tpt/application"
              element={
                <ApplicationGenerator
                  initialData={ntapApplicationData}
                  onBack={() => navigate('/ntap-tpt')}
                />
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
