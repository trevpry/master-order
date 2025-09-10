import React from 'react';
import Button from '../../../../../../shared/components/Button';
import BookSearchResults from '../BookSearchResults';

const BookFormModal = ({
  show,
  editingItem,
  reselectingItem,
  bookFormData,
  setBookFormData,
  bookSearchLoading,
  bookSearchResults,
  viewingOrderItems,
  onSubmit,
  onSelectBook,
  onClose,
  onManualBookCreate,
  setMessage
}) => {
  if (!show) return null;

  const getModalTitle = () => {
    if (editingItem) return 'Edit Book';
    if (reselectingItem && reselectingItem.mediaType === 'shortstory') return 'Select Book for Story Collection';
    if (reselectingItem) return 'Re-select Book';
    return 'Add Book';
  };

  const handleManualCreate = async () => {
    if (!bookFormData.title.trim()) {
      setMessage('Please enter a book title to create manually');
      return;
    }
    
    const manualBookData = {
      type: 'book',
      title: bookFormData.title.trim(),
      bookTitle: bookFormData.title.trim(),
      bookAuthor: bookFormData.author.trim() || 'Unknown Author',
      bookYear: bookFormData.year ? parseInt(bookFormData.year) : null,
      bookIsbn: bookFormData.isbn.trim() || null,
      bookPageCount: bookFormData.pageCount ? parseInt(bookFormData.pageCount) : null
    };
    
    await onManualBookCreate(viewingOrderItems.id, manualBookData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{getModalTitle()}</h3>
          <Button
            onClick={onClose}
            className="secondary"
            size="small"
          >
            ✕
          </Button>
        </div>
        
        <form onSubmit={onSubmit} className="book-search-form">
          <div className="form-group">
            <label htmlFor="bookTitle">Book Title *</label>
            <input
              type="text"
              id="bookTitle"
              value={bookFormData.title}
              onChange={(e) => setBookFormData({...bookFormData, title: e.target.value})}
              placeholder="Enter book title..."
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="bookAuthor">Author</label>
            <input
              type="text"
              id="bookAuthor"
              value={bookFormData.author}
              onChange={(e) => setBookFormData({...bookFormData, author: e.target.value})}
              placeholder="Enter author name (optional)..."
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="bookYear">Publication Year</label>
            <input
              type="number"
              id="bookYear"
              min="1000"
              max="2030"
              value={bookFormData.year}
              onChange={(e) => setBookFormData({...bookFormData, year: e.target.value})}
              placeholder="Enter publication year (optional)..."
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="bookIsbn">ISBN</label>
            <input
              type="text"
              id="bookIsbn"
              value={bookFormData.isbn}
              onChange={(e) => setBookFormData({...bookFormData, isbn: e.target.value})}
              placeholder="Enter ISBN (optional)..."
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="bookPageCount">Page Count</label>
            <input
              type="number"
              id="bookPageCount"
              value={bookFormData.pageCount}
              onChange={(e) => setBookFormData({...bookFormData, pageCount: e.target.value})}
              placeholder="Enter page count (optional)..."
              min="1"
              max="10000"
            />
          </div>
          
          <div className="form-actions">
            <Button 
              type="submit" 
              disabled={bookSearchLoading}
              className="primary"
            >
              {bookSearchLoading 
                ? (editingItem ? 'Updating...' : 'Searching...') 
                : (editingItem ? 'Update Book' : 'Search Books')
              }
            </Button>
            <Button
              type="button"
              onClick={onClose}
              className="secondary"
            >
              Cancel
            </Button>
          </div>
        </form>
        
        {/* Search Results */}
        <BookSearchResults
          bookSearchResults={bookSearchResults}
          onSelectBook={onSelectBook}
          reselectingItem={reselectingItem}
        />
        
        {/* Manual Book Creation Option */}
        {!editingItem && (
          <div className="manual-book-option">
            <hr className="form-divider" />
            <p className="manual-book-text">
              Can't find your book? Create it manually with the information above.
            </p>
            <Button
              onClick={handleManualCreate}
              className="secondary"
            >
              Create Book Manually
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookFormModal;
