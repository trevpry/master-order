import React from 'react';

const ToggleButtonGroup = ({ options, activeValue, onChange, className = "" }) => {
  return (
    <div className={`toggle-group ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          className={`toggle-btn ${activeValue === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default ToggleButtonGroup;
