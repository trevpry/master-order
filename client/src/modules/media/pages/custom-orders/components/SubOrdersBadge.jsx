import React from 'react';

const SubOrdersBadge = ({ count }) => {
  if (!count || count === 0) return null;

  const pluralizedText = count > 1 ? 's' : '';
  const title = `Contains ${count} sub-order${pluralizedText}`;

  return (
    <span className="sub-orders-count" title={title}>
      ({count} sub)
    </span>
  );
};

export default SubOrdersBadge;
