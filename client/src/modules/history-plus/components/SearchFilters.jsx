import React from 'react';

const SearchFilters = ({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  reviewedFilter,
  setReviewedFilter,
  contentTypeFilter,
  setContentTypeFilter,
  startDateFilter,
  setStartDateFilter,
  endDateFilter,
  setEndDateFilter,
  categories = [],
  onClearFilters,
  resultCount,
  totalCount
}) => {
  const hasActiveFilters = 
    searchTerm || 
    selectedCategory || 
    reviewedFilter !== 'all' || 
    contentTypeFilter !== 'all' || 
    startDateFilter || 
    endDateFilter;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      {/* Search Bar */}
      <div className="mb-4">
        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
          Search Events
        </label>
        <div className="relative">
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, details, or category..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {/* Category Filter */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Review Status Filter */}
        <div>
          <label htmlFor="reviewedFilter" className="block text-sm font-medium text-gray-700 mb-1">
            Review Status
          </label>
          <select
            id="reviewedFilter"
            value={reviewedFilter}
            onChange={(e) => setReviewedFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Events</option>
            <option value="reviewed">Reviewed Only</option>
            <option value="unreviewed">Unreviewed Only</option>
          </select>
        </div>

        {/* Content Type Filter */}
        <div>
          <label htmlFor="contentTypeFilter" className="block text-sm font-medium text-gray-700 mb-1">
            Content Type
          </label>
          <select
            id="contentTypeFilter"
            value={contentTypeFilter}
            onChange={(e) => setContentTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Content</option>
            <option value="videos">Has Videos</option>
            <option value="books">Has Books</option>
            <option value="chapters">Has Chapters</option>
            <option value="sections">Has Sections</option>
            <option value="no-content">No Content</option>
          </select>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date (From)
          </label>
          <input
            type="date"
            id="startDate"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            For BCE dates, use negative years (e.g., -0500-01-01 for 500 BCE)
          </p>
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            End Date (To)
          </label>
          <input
            type="date"
            id="endDate"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filter Status and Clear Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-sm text-gray-600">
          {hasActiveFilters ? (
            <>
              <span className="font-medium">{resultCount}</span> of{' '}
              <span className="font-medium">{totalCount}</span> events match your filters
            </>
          ) : (
            <>
              Showing all <span className="font-medium">{totalCount}</span> events
            </>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-300 hover:border-blue-400 px-3 py-1 rounded-lg transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-2">Active filters:</div>
          <div className="flex flex-wrap gap-2">
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                Search: "{searchTerm}"
                <button 
                  onClick={() => setSearchTerm('')}
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            )}
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                Category: {selectedCategory}
                <button 
                  onClick={() => setSelectedCategory('')}
                  className="hover:text-purple-900"
                >
                  ×
                </button>
              </span>
            )}
            {reviewedFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                {reviewedFilter === 'reviewed' ? 'Reviewed' : 'Unreviewed'}
                <button 
                  onClick={() => setReviewedFilter('all')}
                  className="hover:text-green-900"
                >
                  ×
                </button>
              </span>
            )}
            {contentTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                Content: {contentTypeFilter}
                <button 
                  onClick={() => setContentTypeFilter('all')}
                  className="hover:text-orange-900"
                >
                  ×
                </button>
              </span>
            )}
            {startDateFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                From: {startDateFilter}
                <button 
                  onClick={() => setStartDateFilter('')}
                  className="hover:text-gray-900"
                >
                  ×
                </button>
              </span>
            )}
            {endDateFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                To: {endDateFilter}
                <button 
                  onClick={() => setEndDateFilter('')}
                  className="hover:text-gray-900"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
