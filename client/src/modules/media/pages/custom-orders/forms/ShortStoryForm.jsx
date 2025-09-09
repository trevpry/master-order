import React from 'react';
import Button from '../../../../../shared/components/Button';

const ShortStoryForm = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit,
  searchResults,
  onSelectBook,
  onAddWithoutBook,
  editingItem
}) => {
  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const title = editingItem ? 'Edit Short Story' : 'Add Short Story';
  const submitText = editingItem ? 'Update Story' : 'Search for Books to Contain This Story';

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
              Story Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter short story title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Author (optional)
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => handleInputChange('author', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter author name (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year (optional)
            </label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => handleInputChange('year', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Publication year"
              min="1000"
              max={new Date().getFullYear() + 5}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Story URL (optional)
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/story-link"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cover Image URL (optional)
            </label>
            <input
              type="url"
              value={formData.coverUrl}
              onChange={(e) => handleInputChange('coverUrl', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/cover.jpg"
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={!formData.title.trim()}
              className="w-full"
            >
              {submitText}
            </Button>
            
            {!editingItem && (
              <Button
                type="button"
                variant="secondary"
                onClick={onAddWithoutBook}
                className="w-full"
              >
                Add Story Without Container Book
              </Button>
            )}
            
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Select Container Book</h3>
            <p className="text-sm text-gray-600 mb-4">
              Found {searchResults.length} books by {formData.author}. Select which book contains the story "{formData.title}", or add the story without a container book.
            </p>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {searchResults.map((book, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    {book.coverUrl && (
                      <img
                        src={book.coverUrl}
                        alt={`Cover of ${book.title}`}
                        className="w-12 h-16 object-cover rounded"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{book.title}</h4>
                      <p className="text-sm text-gray-600">
                        {book.authors && book.authors[0] ? book.authors[0] : 'Unknown Author'}
                      </p>
                      {book.firstPublishYear && (
                        <p className="text-xs text-gray-500">Published: {book.firstPublishYear}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => onSelectBook(book)}
                      size="sm"
                      className="ml-2"
                    >
                      Story is in This Book
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4">
              <Button
                onClick={onAddWithoutBook}
                variant="secondary"
                className="w-full"
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

export default ShortStoryForm;
