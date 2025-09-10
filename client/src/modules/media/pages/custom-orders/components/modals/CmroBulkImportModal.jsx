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
    onSubmit();
  };

  const handleClose = () => {
    setImportData('');
    onClose();
  };

  const handleTestData = () => {
    setImportData(`41: Shield of the Jedi
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
Writer: Michael Kogge`);
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
            <p>Paste CMRO-style data with the following format:</p>
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
            
            <div className="example-data">
              <strong>Example:</strong>
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
