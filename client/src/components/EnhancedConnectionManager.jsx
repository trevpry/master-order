import React from 'react';
import { Users, Filter, SortAsc } from 'lucide-react';
import { Button } from './ui/button';

const EnhancedConnectionManager = ({ 
  connections = [], 
  onFilterChange, 
  onSortChange, 
  currentFilter = 'all',
  currentSort = 'name'
}) => {
  const filterOptions = [
    { value: 'all', label: 'All Connections' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'ended', label: 'Ended' }
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Date Added' },
    { value: 'rating', label: 'Rating' },
    { value: 'lastContact', label: 'Last Contact' }
  ];

  const getFilteredCount = (filter) => {
    if (filter === 'all') return connections.length;
    return connections.filter(c => c.status === filter).length;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Connection Manager
        </h3>
        <div className="text-sm text-gray-500">
          {connections.length} total connections
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filterOptions.map(option => (
          <Button
            key={option.value}
            onClick={() => onFilterChange && onFilterChange(option.value)}
            variant={currentFilter === option.value ? 'primary' : 'outline'}
            size="sm"
            className="text-xs"
          >
            {option.label} ({getFilteredCount(option.value)})
          </Button>
        ))}
      </div>

      {/* Sort and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={currentFilter}
            onChange={(e) => onFilterChange && onFilterChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {filterOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <SortAsc className="w-4 h-4 text-gray-400" />
          <select
            value={currentSort}
            onChange={(e) => onSortChange && onSortChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                Sort by {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {connections.filter(c => c.status === 'active').length}
          </div>
          <div className="text-sm text-blue-600">Active</div>
        </div>
        
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {connections.filter(c => c.status === 'paused').length}
          </div>
          <div className="text-sm text-yellow-600">Paused</div>
        </div>
        
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-600">
            {connections.filter(c => c.status === 'ended').length}
          </div>
          <div className="text-sm text-gray-600">Ended</div>
        </div>
        
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {connections.filter(c => c.rating >= 4).length}
          </div>
          <div className="text-sm text-green-600">High Rated</div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedConnectionManager;
