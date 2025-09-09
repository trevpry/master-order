import React from 'react';

const HierarchyIndicator = ({ parentOrderName }) => {
  if (!parentOrderName) return null;

  return (
    <span className="hierarchy-indicator" title={`Sub-order of "${parentOrderName}"`}>
      ↳
    </span>
  );
};

export default HierarchyIndicator;
