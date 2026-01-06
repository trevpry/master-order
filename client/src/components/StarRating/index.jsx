import React, { useState } from 'react';
import './StarRating.css';

const StarRating = ({ value = 0, onChange, readOnly = false, size = 'medium' }) => {
  const [hoverValue, setHoverValue] = useState(0);
  
  const handleClick = (rating) => {
    if (!readOnly && onChange) {
      // If clicking the same rating, set to 0 (remove rating)
      onChange(rating === value ? 0 : rating);
    }
  };
  
  const handleMouseEnter = (rating) => {
    if (!readOnly) {
      setHoverValue(rating);
    }
  };
  
  const handleMouseLeave = () => {
    if (!readOnly) {
      setHoverValue(0);
    }
  };
  
  const displayValue = hoverValue || value;
  
  return (
    <div 
      className={`star-rating ${size} ${readOnly ? 'read-only' : 'interactive'}`}
      onMouseLeave={handleMouseLeave}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
        <button
          key={rating}
          type="button"
          className={`star ${rating <= displayValue ? 'filled' : 'empty'} ${hoverValue === rating ? 'hover' : ''}`}
          onClick={() => handleClick(rating)}
          onMouseEnter={() => handleMouseEnter(rating)}
          disabled={readOnly}
          title={`${rating / 2} star${rating !== 2 ? 's' : ''}`}
        >
          {rating <= displayValue ? '★' : '☆'}
        </button>
      ))}
      {!readOnly && value > 0 && (
        <button
          type="button"
          className="clear-rating"
          onClick={() => onChange(0)}
          title="Clear rating"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default StarRating;
