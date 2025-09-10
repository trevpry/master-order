import React from 'react';

const StatItem = ({ label, value, className = "" }) => {
  return (
    <div className={`stat-item ${className}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
};

export default StatItem;
