import React, { useState } from 'react';
import { useCategories } from '../hooks/useTasks';
import Button from '../../../shared/components/Button';

const CategoryList = ({ onEdit, onCreateNew }) => {
  const { categories, loading, error, deleteCategory } = useCategories();
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (categoryId, categoryName) => {
    if (window.confirm(`Are you sure you want to delete the category "${categoryName}"? This will remove the category from all associated tasks.`)) {
      try {
        setDeletingId(categoryId);
        await deleteCategory(categoryId);
      } catch (error) {
        console.error('Failed to delete category:', error);
        alert('Failed to delete category. Please try again.');
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
          <p className="text-gray-600 mt-1">
            Organize your tasks with custom categories
          </p>
        </div>
        <Button 
          onClick={onCreateNew}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          + New Category
        </Button>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full">
            <span className="text-4xl">📁</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first category to help organize your tasks
          </p>
          <Button 
            onClick={onCreateNew}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create Category
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map(category => (
            <div
              key={category.id}
              className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-6"
            >
              {/* Category Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                    style={{ backgroundColor: category.color + '20', color: category.color }}
                  >
                    {category.icon || '📁'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{category.name}</h3>
                    <p className="text-sm text-gray-500">
                      {category._count?.tasks || 0} task{category._count?.tasks !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {category.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {category.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onEdit(category)}
                    className="text-xs px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category.name)}
                    disabled={deletingId === category.id}
                    className="text-xs px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors disabled:opacity-50"
                  >
                    {deletingId === category.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
                
                {/* Color indicator */}
                <div 
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: category.color }}
                  title={`Color: ${category.color}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryList;
