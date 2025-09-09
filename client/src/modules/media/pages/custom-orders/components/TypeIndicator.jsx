import React from 'react';

const TypeIndicator = ({ type, className = "result-type" }) => {
  return <span className={className}>{type}</span>;
};

export default TypeIndicator;
