import React from 'react';
import Button from '../../../../../../shared/components/Button';

const CmroBulkImportModal = ({ 
  isOpen, 
  onClose, 
  importData, 
  setImportData, 
  onSubmit, 
  isLoading 
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleClose = () => {
    setImportData('');
    onClose();
  };

  const handleTestData = () => {
    setImportData(`111/1961 Fantastic Four (1961) #1-Fantastic Four (1961) #1
201/1962 Fantastic Four (1961) #2-Fantastic Four (1961) #2
301/1962 Tales to Astonish (1958) #27-Tales to Astonish (1958) #27
403/1962 Fantastic Four (1961) #3-Fantastic Four (1961) #3
505/1962 Fantastic Four (1961) #4-Fantastic Four (1961) #4
603/1962 Tales to Astonish (1958) #29 [A Story]-Tales to Astonish (1958) #29 [A Story]
1,89301/1974 Fantastic Four (1961) #142-Fantastic Four (1961) #142
1,89402/1974 Marvel Team-Up (1972) #18-Marvel Team-Up (1972) #18`);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content bulk-import-modal">
        <div className="modal-header">
          <h3>CMRO Bulk Import</h3>
          <Button
            onClick={handleClose}
            className="secondary"
            size="small"
          >
            ✕
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="bulk-import-form">
          <div className="bulk-import-instructions">
            <h4>Complete Marvel Reading Order (CMRO) Format</h4>
            <p>Supports two CMRO-style data formats:</p>
            
            <div className="format-section">
              <h5>New Format (Comics):</h5>
              <ul>
                <li><strong>Pattern:</strong> "111/1961 Fantastic Four (1961) #1-Fantastic Four (1961) #1"</li>
                <li><strong>With Commas:</strong> "1,89301/1974 Fantastic Four (1961) #142-Fantastic Four (1961) #142"</li>
                <li><strong>Structure:</strong> Entry#/Year SeriesName (Year) #Issue-Full Title</li>
                <li>Entry numbers can include commas (e.g., 1,89301) which will be automatically handled</li>
                <li>Automatically extracts series, year, issue, and title information</li>
              </ul>
            </div>
            
            <div className="format-section">
              <h5>Original Format (Stories/Episodes):</h5>
              <ul>
                <li><strong>Entry Number:</strong> "41: Title of Story"</li>
                <li><strong>Source:</strong> "from Source Publication" (optional)</li>
                <li><strong>Synopsis:</strong> Brief description (optional)</li>
                <li><strong>Timeline:</strong> "349y BBY" or similar (optional)</li>
                <li><strong>Published Date:</strong> "Published: Date"</li>
                <li><strong>Publisher:</strong> "Published by: Publisher Name"</li>
                <li><strong>Writer:</strong> "Writer: Author Name"</li>
                <li><strong>Pages:</strong> "Pages: Number" (optional)</li>
              </ul>
            </div>
            
            <div className="example-data">
              <strong>New Format Example:</strong>
              <pre>
111/1961 Fantastic Four (1961) #1-Fantastic Four (1961) #1
201/1962 Fantastic Four (1961) #2-Fantastic Four (1961) #2
301/1962 Tales to Astonish (1958) #27-Tales to Astonish (1958) #27
603/1962 Tales to Astonish (1958) #29 [A Story]-Tales to Astonish (1958) #29 [A Story]
1,89301/1974 Fantastic Four (1961) #142-Fantastic Four (1961) #142
1,89402/1974 Marvel Team-Up (1972) #18-Marvel Team-Up (1972) #18
              </pre>
              
              <strong>Original Format Example:</strong>
              <pre>
41: Shield of the Jedi
from The High Republic: Tales of Light and Life

Synopsis Unavailable.
349y BBY
View Listing Details

Published: September 5, 2023
Published by: Disney-Lucasfilm Press
Writer: George Mann
Pages: 5

42: What a Jedi Makes
from Stories of Jedi and Sith

An orphan from Coruscant's lower levels seeks out the Jedi Temple in the hopes of joining the Order.
260y BBY
View Listing Details

Published: June 7, 2022
Published by: Disney-Lucasfilm Press
Writer: Michael Kogge
              </pre>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="cmroData">CMRO Data *</label>
            <textarea
              id="cmroData"
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste your CMRO data here..."
              rows="15"
              className="bulk-import-textarea"
              required
            />
          </div>
          
          <div className="form-actions">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="primary"
            >
              {isLoading ? 'Importing...' : 'Import CMRO Items'}
            </Button>
            <Button
              type="button"
              onClick={handleTestData}
              className="secondary"
              style={{ marginLeft: '10px' }}
            >
              Test Example
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              className="secondary"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CmroBulkImportModal;
