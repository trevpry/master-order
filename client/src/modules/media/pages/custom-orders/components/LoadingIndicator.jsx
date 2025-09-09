import React from 'react';

const LoadingIndicator = ({ 
  isLoading, 
  message,
  className = "form-help" 
}) => {
  if (!isLoading) return null;

  return (
    <small className={className}>
      {message}
    </small>
  );
};

export default LoadingIndicator;
