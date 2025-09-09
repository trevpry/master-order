import React from 'react';

const HelpText = ({ 
  children, 
  className = "form-help",
  tag: Tag = "p" 
}) => {
  return (
    <Tag className={className}>
      {children}
    </Tag>
  );
};

export default HelpText;
