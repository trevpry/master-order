import React from 'react';

const MusicControls = ({
  searchQuery,
  setSearchQuery,
  onSearch,
  selectedSection,
  sections,
  onFilterBySection
}) => {
  return (
    <div className="music-controls">
      <div className="search-section">
        <input
          type="text"
          placeholder="Search artists, albums, or tracks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onSearch()}
          className="search-input"
        />
        <button onClick={onSearch} className="search-button">
          🔍 Search
        </button>
      </div>
      
      <div className="filter-section">
        <select 
          value={selectedSection} 
          onChange={(e) => onFilterBySection(e.target.value)}
          className="section-filter"
        >
          <option value="all">All Sections</option>
          {sections.map(section => (
            <option key={section.id} value={section.sectionKey}>
              {section.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MusicControls;
