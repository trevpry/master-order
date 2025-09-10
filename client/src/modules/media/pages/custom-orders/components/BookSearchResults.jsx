import React from 'react';
import Button from '../../../../../shared/components/Button';

const BookSearchResults = ({ 
  bookSearchResults, 
  onSelectBook, 
  reselectingItem 
}) => {
  if (bookSearchResults.length === 0) {
    return null;
  }

  return (
    <div className="book-search-results">
      <h4>Search Results</h4>
      <div className="book-results-list">
        {bookSearchResults.map((book, index) => (
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
                {book.publishers && book.publishers[0] && (
                  <p className="book-publisher">Publisher: {book.publishers[0]}</p>
                )}
              </div>
            </div>
            <Button
              onClick={() => onSelectBook(book)}
              className="primary"
              size="small"
            >
              {reselectingItem && reselectingItem.mediaType === 'shortstory' 
                ? 'Story is in This Book'
                : reselectingItem 
                  ? 'Re-select This Book' 
                  : 'Add This Book'
              }
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookSearchResults;
