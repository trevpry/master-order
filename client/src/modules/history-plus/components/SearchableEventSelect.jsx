import React, { useState, useRef, useEffect } from 'react';

const SearchableEventSelect = ({ 
  events = [], 
  value, 
  onChange, 
  placeholder = "Select an event...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Format date to show BCE/CE
  const formatHistoricalDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    
    // Handle BCE dates (negative years or years less than 1)
    if (year <= 0) {
      const bceYear = Math.abs(year - 1); // Adjust for year 0
      return `${bceYear} BCE`;
    }
    
    // Handle CE dates
    if (year < 1000) {
      return `${year} CE`;
    }
    
    // For modern dates (1000+), just show the regular date
    return date.toLocaleDateString();
  };

  // Sort events alphabetically by title
  const sortedEvents = [...events].sort((a, b) => {
    const titleA = (a.title || '').toLowerCase();
    const titleB = (b.title || '').toLowerCase();
    return titleA.localeCompare(titleB);
  });

  // Filter events based on search term
  const filteredEvents = sortedEvents.filter(event =>
    event.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find selected event when value changes
  useEffect(() => {
    if (value) {
      const event = events.find(e => e.id === parseInt(value));
      setSelectedEvent(event);
    } else {
      setSelectedEvent(null);
    }
  }, [value, events]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputClick = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    setIsOpen(false);
    setSearchTerm('');
    onChange({
      target: {
        name: 'eventId',
        value: event.id
      }
    });
  };

  const handleClear = () => {
    setSelectedEvent(null);
    setSearchTerm('');
    setIsOpen(false);
    onChange({
      target: {
        name: 'eventId',
        value: ''
      }
    });
  };

  const displayValue = selectedEvent ? selectedEvent.title : '';
  const inputValue = isOpen ? searchTerm : displayValue;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          autoComplete="off"
        />
        
        {/* Clear button */}
        {selectedEvent && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        {/* Dropdown arrow */}
        <button
          type="button"
          onClick={handleInputClick}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <svg 
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredEvents.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {searchTerm ? 'No events found matching your search' : 'No events available'}
            </div>
          ) : (
            <>
              {/* Clear selection option */}
              <button
                type="button"
                onClick={handleClear}
                className="w-full px-3 py-2 text-left text-gray-500 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 border-b border-gray-100"
              >
                <em>Clear selection</em>
              </button>
              
              {/* Event options */}
              {filteredEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleEventSelect(event)}
                  className={`w-full px-3 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 ${
                    selectedEvent?.id === event.id ? 'bg-blue-100 text-blue-800' : 'text-gray-900'
                  }`}
                >
                  <div className="font-medium">{event.title}</div>
                  {event.startDate && (
                    <div className="text-xs text-gray-500 mt-1">
                      {formatHistoricalDate(event.startDate)}
                    </div>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableEventSelect;