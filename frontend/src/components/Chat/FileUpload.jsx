import React, { useRef } from 'react';
import './FileUpload.css';

function FileUpload({ onFileUpload, uploadedFiles }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileUpload(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload">
      <div className="file-upload-header">
        <h3>Upload Files</h3>
        <button onClick={handleClick} className="upload-button">
          Choose File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".txt,.pdf,.doc,.docx,.md"
        />
      </div>
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <p className="uploaded-files-label">Uploaded Files ({uploadedFiles.length}):</p>
          <div className="file-list">
            {uploadedFiles.map((fileName, index) => (
              <span key={index} className="file-tag" title={fileName}>
                {fileName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUpload;

