import React, { useState } from 'react';
import './SearchBar.css';

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-input-container">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events, books, videos..."
          className="search-input"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="clear-button"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
        <button 
          type="submit" 
          className="search-button"
          aria-label="Search"
        >
          🔍
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
