import React from 'react';
import Button from '../../../../../../shared/components/Button';

const ShortStoryFormModal = ({
  show,
  editingItem,
  shortStoryFormData,
  setShortStoryFormData,
  shortStorySearchResults,
  onClose,
  onSubmit,
  onAddShortStory
}) => {
  if (!show) return null;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleClose = () => {
    setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{editingItem ? 'Edit Short Story' : 'Add Short Story'}</h3>
          <Button
            onClick={handleClose}
            className="close-modal"
          >
            ×
          </Button>
        </div>
        
        <form onSubmit={handleFormSubmit} className="shortstory-search-form">
          <div className="form-group">
            <label htmlFor="shortstory-title">Story Title *</label>
            <input
              type="text"
              id="shortstory-title"
              value={shortStoryFormData.title}
              onChange={(e) => setShortStoryFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter short story title"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="shortstory-author">Author (optional)</label>
            <input
              type="text"
              id="shortstory-author"
              value={shortStoryFormData.author}
              onChange={(e) => setShortStoryFormData(prev => ({ ...prev, author: e.target.value }))}
              placeholder="Enter author name (optional)"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="shortstory-year">Year (optional)</label>
            <input
              type="number"
              id="shortstory-year"
              value={shortStoryFormData.year}
              onChange={(e) => setShortStoryFormData(prev => ({ ...prev, year: e.target.value }))}
              placeholder="Publication year"
              min="1000"
              max={new Date().getFullYear() + 5}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="shortstory-url">Story URL (optional)</label>
            <input
              type="url"
              id="shortstory-url"
              value={shortStoryFormData.url}
              onChange={(e) => setShortStoryFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/story-link"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="shortstory-cover">Cover Image URL (optional)</label>
            <input
              type="url"
              id="shortstory-cover"
              value={shortStoryFormData.coverUrl}
              onChange={(e) => setShortStoryFormData(prev => ({ ...prev, coverUrl: e.target.value }))}
              placeholder="https://example.com/cover.jpg"
            />
          </div>
          
          <div className="form-actions">
            <Button type="submit" className="primary">
              {editingItem ? 'Update Story' : 'Search for Books to Contain This Story'}
            </Button>
            {!editingItem && (
              <Button
                type="button"
                onClick={() => onAddShortStory()}
                className="secondary"
              >
                Add Story Without Container Book
              </Button>
            )}
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
        {shortStorySearchResults.length > 0 && (
          <div className="shortstory-search-results">
            <h4>Select Container Book</h4>
            <p className="search-note">
              Found {shortStorySearchResults.length} books by {shortStoryFormData.author}. Select which book contains the story "{shortStoryFormData.title}", or add the story without a container book.
            </p>
            
            <div className="book-results-list">
              {shortStorySearchResults.map((book, index) => (
                <div key={index} className="book-result-item">
                  <div className="book-info">
                    {book.coverUrl && (
                      <img 
                        src={book.coverUrl} 
                        alt={`Cover of ${book.title}`} 
                        className="book-cover-small"
                      />
                    )}
                    <div className="book-details">
                      <h5>{book.title}</h5>
                      <p className="book-author">
                        {book.authors && book.authors[0] ? book.authors[0] : 'Unknown Author'}
                      </p>
                      {book.firstPublishYear && (
                        <p className="book-year">Published: {book.firstPublishYear}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => onAddShortStory(book)}
                    className="primary"
                    size="small"
                  >
                    Story is in This Book
                  </Button>
                </div>
              ))}
            </div>
            <div className="no-book-option">
              <Button
                onClick={() => onAddShortStory()}
                className="secondary"
              >
                None of These - Add Story Without Container Book
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShortStoryFormModal;
