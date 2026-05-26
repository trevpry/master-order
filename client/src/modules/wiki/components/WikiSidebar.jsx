import React from 'react';
import { formatDate } from '../utils/dateFormat';

const WikiSidebar = ({ pages, activeSlug, onSelectPage, activeView, onViewChange, stats, filters, onFiltersChange }) => {
  // Group pages by type
  const grouped = {};
  for (const page of pages) {
    if (!grouped[page.type]) grouped[page.type] = [];
    grouped[page.type].push(page);
  }

  const typeIcons = {
    entity: '📄',
    concept: '💡',
    comparison: '⚖️',
    index: '📋'
  };

  const typeLabels = {
    entity: 'Entities',
    concept: 'Concepts',
    comparison: 'Comparisons',
    index: 'Indexes'
  };

  return (
    <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          📚 Wiki
          {stats && (
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
              {stats.totalPages} pages
            </span>
          )}
        </h2>
      </div>

      {/* View Tabs */}
      <div className="flex border-b border-gray-800">
        {[
          { key: 'wiki', label: 'Pages', icon: '📄' },
          { key: 'log', label: 'Log', icon: '📋' },
          { key: 'settings', label: 'Settings', icon: '⚙️' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => onViewChange(tab.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeView === tab.key
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-800">
        <input
          type="text"
          placeholder="Search pages..."
          value={filters.search}
          onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-full bg-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex gap-2 mt-2">
          <select
            value={filters.type}
            onChange={e => onFiltersChange({ ...filters, type: e.target.value })}
            className="flex-1 bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700"
          >
            <option value="">All Types</option>
            <option value="entity">Entities</option>
            <option value="concept">Concepts</option>
            <option value="comparison">Comparisons</option>
          </select>
          <select
            value={filters.category}
            onChange={e => onFiltersChange({ ...filters, category: e.target.value })}
            className="flex-1 bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700"
          >
            <option value="">All Categories</option>
            <option value="personal">Personal</option>
            <option value="health">Health</option>
            <option value="work">Work</option>
            <option value="interests">Interests</option>
            <option value="relationships">Relationships</option>
            <option value="goals">Goals</option>
            <option value="habits">Habits</option>
            <option value="media">Media</option>
            <option value="technology">Technology</option>
            <option value="finance">Finance</option>
            <option value="travel">Travel</option>
            <option value="food">Food</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>

      {/* Page List */}
      <div className="flex-1 overflow-y-auto">
        {pages.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No wiki pages yet. Seed from notes or chat to get started.
          </div>
        ) : (
          Object.entries(grouped).map(([type, typePages]) => (
            <div key={type}>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-900/50">
                {typeIcons[type] || '📄'} {typeLabels[type] || type} ({typePages.length})
              </div>
              {typePages.map(page => (
                <button
                  key={page.slug}
                  onClick={() => onSelectPage(page.slug)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors border-l-2 ${
                    activeSlug === page.slug
                      ? 'bg-blue-900/30 border-blue-400 text-white'
                      : 'border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="font-medium truncate">{page.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {page.category} · {formatDate(page.updatedAt)}
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WikiSidebar;
