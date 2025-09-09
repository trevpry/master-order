import React from 'react';
import Button from '../../../../../shared/components/Button';

const BookForm = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit,
  searchResults,
  onSelectBook,
  isLoading,
  editingItem,
  reselectingItem,
  onManualCreate
}) => {
  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isEditing = editingItem || reselectingItem;
  const title = isEditing ? 'Edit Book' : 'Add Book';
  const submitText = isEditing ? 'Update Book' : 'Search Books';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Book Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter book title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Author
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => handleInputChange('author', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter author name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publication Year
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => handleInputChange('year', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="YYYY"
                min="1000"
                max="2100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Page Count
              </label>
              <input
                type="number"
                value={formData.pageCount}
                onChange={(e) => handleInputChange('pageCount', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Number of pages"
                min="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ISBN
            </label>
            <input
              type="text"
              value={formData.isbn}
              onChange={(e) => handleInputChange('isbn', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ISBN-10 or ISBN-13"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isLoading || !formData.title.trim()}
              className="flex-1"
            >
              {isLoading ? 'Searching...' : submitText}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="px-6"
            >
              Cancel
            </Button>
          </div>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Search Results</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {searchResults.map((book, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    {book.coverUrl && (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-12 h-16 object-cover rounded"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{book.title}</h4>
                      {book.authors && book.authors.length > 0 && (
                        <p className="text-sm text-gray-600">by {book.authors.join(', ')}</p>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {book.firstPublishYear && <span>Published: {book.firstPublishYear}</span>}
                        {book.publishers && book.publishers.length > 0 && (
                          <span className="ml-3">Publisher: {book.publishers[0]}</span>
                        )}
                      </div>
                      {book.isbn && (
                        <p className="text-xs text-gray-500">ISBN: {book.isbn}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => onSelectBook(book)}
                      size="sm"
                      className="ml-2"
                    >
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Book Creation Option */}
        {!editingItem && onManualCreate && (
          <div className="manual-book-option mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-3">
              Can't find your book? Create it manually with the information above.
            </p>
            <Button
              onClick={onManualCreate}
              type="button"
              variant="secondary"
              className="w-full"
            >
              Create Book Manually
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookForm;
