import React from 'react';
import Button from '../../../../../../shared/components/Button';

const BulkImportFormModal = ({
  show,
  bulkImportData,
  setBulkImportData,
  bulkImportLoading,
  onClose,
  onSubmit
}) => {
  if (!show) return null;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleClose = () => {
    setBulkImportData('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content bulk-import-modal">
        <div className="modal-header">
          <h3>Bulk Import Media</h3>
          <Button
            onClick={handleClose}
            className="secondary"
            size="small"
          >
            ✕
          </Button>
        </div>
        
        <form onSubmit={handleFormSubmit} className="bulk-import-form">
          <div className="bulk-import-instructions">
            <h4>Tab-Delimited Import Format</h4>
            <p>Paste tab-separated data with 4-5 columns in order:</p>
            <ol>
              <li><strong>Series/Movie/Comic/Book Name:</strong> The name of the TV series, movie, comic, or book (for comics use "Series Name (Year) #Issue" format)</li>
              <li><strong>Season/Episode/Author:</strong> For episodes: S1E1, S01E01, 1x1, 1,1, or 1-1 format; For books: Author name (optionally with year: "Author Name (Year)"); Leave blank for movies and comics</li>
              <li><strong>Title:</strong> The specific episode title, movie title, comic issue title, or book title</li>
              <li><strong>Type:</strong> "episode" (or "TV Series") for TV episodes, "movie" for movies, "comic" for comics, "book" for books</li>
              <li><strong>Year (Optional):</strong> Release year for more accurate matching (especially useful for movies and TV shows)</li>
            </ol>
            
            <div className="example-data">
              <strong>Example:</strong>
              <pre>
Breaking Bad	S1E1	Pilot	episode	2008
Breaking Bad	S01E02	Cat's in the Bag...	episode	2008
The Avengers		The Avengers	movie	2012
Superman		Superman	movie	1978
Game of Thrones	1x1	Winter Is Coming	episode	2011
The Amazing Spider-Man (2018) #1		Amazing Spider-Man	comic
The High Republic Adventures (2022) #7		The Monster of Temple Peak Part 1	comic
The High Republic: Convergence	Zoraida Córdova (2022)	The High Republic: Convergence	book
Dune	Frank Herbert (1965)	Dune	book
              </pre>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="bulkData">Tab-Delimited Data *</label>
            <textarea
              id="bulkData"
              value={bulkImportData}
              onChange={(e) => setBulkImportData(e.target.value)}
              placeholder="Paste your tab-delimited data here..."
              rows="10"
              className="bulk-import-textarea"
              required
            />
          </div>
          
          <div className="form-actions">
            <Button 
              type="submit" 
              disabled={bulkImportLoading}
              className="primary"
            >
              {bulkImportLoading ? 'Importing...' : 'Import Items'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setBulkImportData('Batman Adventures (Vol. 1)\tIssue #01\tPenguin\'s Big Score\tComic');
              }}
              className="secondary"
              style={{ marginLeft: '10px' }}
            >
              Test Batman Adventures
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

export default BulkImportFormModal;
