import React from 'react';
import Button from '../../../../../shared/components/Button';

const ComicForm = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit,
  searchResults,
  onSelectComic,
  isLoading,
  editingItem,
  reselectingItem
}) => {
  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isEditing = editingItem || reselectingItem;
  const title = editingItem ? 'Edit Comic' : reselectingItem ? 'Re-select Comic' : 'Add Comic';
  const submitText = editingItem ? 'Update Comic' : 'Search Comic Series';
  const selectText = reselectingItem ? 'Re-select This Comic' : 'Add This Comic';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
              Comic Series *
            </label>
            <input
              type="text"
              value={formData.series}
              onChange={(e) => handleInputChange('series', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter comic series name..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => handleInputChange('year', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 2022 (optional)"
                min="1930"
                max="2030"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue Number *
              </label>
              <input
                type="text"
                value={formData.issue}
                onChange={(e) => handleInputChange('issue', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 1 or 1-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Custom title or differentiator..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Add a custom title to differentiate duplicate comics or provide additional context
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isLoading || !formData.series.trim() || !formData.issue.trim()}
              className="flex-1"
            >
              {isLoading 
                ? (editingItem ? 'Updating...' : 'Searching...') 
                : submitText
              }
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
            <h3 className="text-lg font-semibold mb-2">Select Comic Series</h3>
            <p className="text-sm text-gray-600 mb-4">
              Found {searchResults.length} series that have issue #{formData.issue}. Select the correct series:
            </p>
            
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {searchResults.map((series, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    {series.coverUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={series.coverUrl}
                          alt={`Cover of ${series.series.name} #${formData.issue}`}
                          className="w-16 h-24 object-cover rounded"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        {series.series.name}
                        {series.isFuzzyMatch && (
                          <span 
                            className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded"
                            title={`${Math.round(series.similarity * 100)}% similarity match`}
                          >
                            ~{Math.round(series.similarity * 100)}% match
                          </span>
                        )}
                      </h4>
                      
                      <div className="text-sm text-gray-600 mt-1 space-y-1">
                        <p>Publisher: {series.series.publisher?.name || 'Unknown'}</p>
                        {series.series.start_year && (
                          <p>Started: {series.series.start_year}</p>
                        )}
                        {series.series.count_of_issues && (
                          <p>Total Issues: {series.series.count_of_issues}</p>
                        )}
                        {series.issueName && (
                          <p className="font-medium">Issue #{formData.issue}: {series.issueName}</p>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => onSelectComic(series)}
                      size="sm"
                      className="ml-2"
                    >
                      {selectText}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComicForm;
