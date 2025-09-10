import React from 'react';
import Button from '../../../../../../shared/components/Button';
import ComicSearchResults from '../ComicSearchResults';

const ComicFormModal = ({
  show,
  editingItem,
  reselectingItem,
  comicFormData,
  setComicFormData,
  comicSearchResults,
  comicSearchLoading,
  onClose,
  onSubmit,
  onSelectComic
}) => {
  if (!show) return null;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleClose = () => {
    setComicFormData({ series: '', year: '', issue: '', title: '' });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{editingItem ? 'Edit Comic' : reselectingItem ? 'Re-select Comic' : 'Add Comic'}</h3>
          <Button
            onClick={handleClose}
            className="secondary"
            size="small"
          >
            ✕
          </Button>
        </div>
        
        <form onSubmit={handleFormSubmit} className="comic-search-form">
          <div className="form-group">
            <label htmlFor="comicSeries">Comic Series *</label>
            <input
              type="text"
              id="comicSeries"
              value={comicFormData.series}
              onChange={(e) => setComicFormData({...comicFormData, series: e.target.value})}
              placeholder="Enter comic series name..."
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="comicYear">Year</label>
              <input
                type="number"
                id="comicYear"
                value={comicFormData.year}
                onChange={(e) => setComicFormData({...comicFormData, year: e.target.value})}
                placeholder="e.g., 2022 (optional)"
                min="1930"
                max="2030"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="comicIssue">Issue Number *</label>
              <input
                type="text"
                id="comicIssue"
                value={comicFormData.issue}
                onChange={(e) => setComicFormData({...comicFormData, issue: e.target.value})}
                placeholder="e.g., 1 or 1-2"
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="comicTitle">Title (optional)</label>
            <input
              type="text"
              id="comicTitle"
              value={comicFormData.title}
              onChange={(e) => setComicFormData({...comicFormData, title: e.target.value})}
              placeholder="Custom title or differentiator..."
            />
            <small className="form-help">
              Add a custom title to differentiate duplicate comics or provide additional context
            </small>
          </div>
          
          <div className="form-actions">
            <Button 
              type="submit" 
              disabled={comicSearchLoading}
              className="primary"
            >
              {comicSearchLoading 
                ? (editingItem ? 'Updating...' : 'Searching...') 
                : (editingItem ? 'Update Comic' : 'Search Comic Series')
              }
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
        
        {/* Search Results */}
        <ComicSearchResults
          comicSearchResults={comicSearchResults}
          comicFormData={comicFormData}
          onSelectComic={onSelectComic}
          reselectingItem={reselectingItem}
        />
      </div>
    </div>
  );
};

export default ComicFormModal;
