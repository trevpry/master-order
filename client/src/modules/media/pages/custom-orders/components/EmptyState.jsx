import React from 'react';

const EmptyState = ({ 
  title, 
  subtitle,
  children 
}) => {
  return (
    <div className="empty-state">
      {title && <p>{title}</p>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  );
};

export default EmptyState;
