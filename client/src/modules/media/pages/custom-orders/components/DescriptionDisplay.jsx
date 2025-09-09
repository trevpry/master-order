import React from 'react';

const DescriptionDisplay = ({ description, className = "order-description" }) => {
  if (!description) {
    return null;
  }

  return <p className={className}>{description}</p>;
};

export default DescriptionDisplay;
