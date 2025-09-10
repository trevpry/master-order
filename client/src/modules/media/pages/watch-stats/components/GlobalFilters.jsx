import React from 'react';

const GlobalFilters = ({
  globalPeriod,
  onGlobalPeriodChange,
  selectedMediaTypes,
  onMediaTypeToggle,
  onSelectAllMediaTypes
}) => {
  return (
    <div className="global-filters">
      <div className="filter-section">
        <h3>Time Period</h3>
        <div className="control-group">
          <select value={globalPeriod} onChange={(e) => onGlobalPeriodChange(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>
      
      <div className="filter-section">
        <h3>Media Types</h3>
        <div className="media-type-filters">
          <label className="media-filter">
            <input 
              type="checkbox" 
              checked={selectedMediaTypes.includes('tv')} 
              onChange={() => onMediaTypeToggle('tv')}
            />
            TV Shows
          </label>
          <label className="media-filter">
            <input 
              type="checkbox" 
              checked={selectedMediaTypes.includes('movie')} 
              onChange={() => onMediaTypeToggle('movie')}
            />
            Movies
          </label>
          <label className="media-filter">
            <input 
              type="checkbox" 
              checked={selectedMediaTypes.includes('book')} 
              onChange={() => onMediaTypeToggle('book')}
            />
            Books
          </label>
          <label className="media-filter">
            <input 
              type="checkbox" 
              checked={selectedMediaTypes.includes('comic')} 
              onChange={() => onMediaTypeToggle('comic')}
            />
            Comics
          </label>
          <label className="media-filter">
            <input 
              type="checkbox" 
              checked={selectedMediaTypes.includes('shortstory')} 
              onChange={() => onMediaTypeToggle('shortstory')}
            />
            Short Stories
          </label>
          <label className="media-filter">
            <input 
              type="checkbox" 
              checked={selectedMediaTypes.includes('webvideo')} 
              onChange={() => onMediaTypeToggle('webvideo')}
            />
            Web Videos
          </label>
        </div>
        <button onClick={onSelectAllMediaTypes} className="select-all-btn">
          {selectedMediaTypes.length === 6 ? 'Deselect All' : 'Select All'}
        </button>
      </div>
    </div>
  );
};

export default GlobalFilters;
