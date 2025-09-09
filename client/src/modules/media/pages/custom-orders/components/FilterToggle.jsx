import React from 'react';

const FilterToggle = ({ 
  checked, 
  onChange, 
  trueText = 'Hide Watched Items',
  falseText = 'Show Watched Items'
}) => {
  return (
    <div className="filter-controls">
      <div className="filter-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="toggle-checkbox"
          />
          <span className="toggle-text">
            {checked ? trueText : falseText}
          </span>
        </label>
      </div>
    </div>
  );
};

export default FilterToggle;
