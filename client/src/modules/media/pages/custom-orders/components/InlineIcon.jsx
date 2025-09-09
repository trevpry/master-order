import React from 'react';

const InlineIcon = ({ 
  icon, 
  className = "custom-order-icon inline-icon" 
}) => {
  if (!icon) return null;

  return (
    <span 
      className={className}
      dangerouslySetInnerHTML={{__html: icon}}
    />
  );
};

export default InlineIcon;
