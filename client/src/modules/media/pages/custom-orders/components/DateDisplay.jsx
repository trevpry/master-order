import React from 'react';

const DateDisplay = ({ 
  date, 
  label, 
  className = "order-created" 
}) => {
  if (!date) return null;

  const formattedDate = new Date(date).toLocaleDateString();

  return (
    <div className={className}>
      {label && `${label}: `}{formattedDate}
    </div>
  );
};

export default DateDisplay;
