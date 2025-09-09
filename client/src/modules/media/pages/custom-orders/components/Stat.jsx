import React from 'react';

const Stat = ({ label, value }) => {
  return (
    <div className="stat">
      <span className="stat-label">{label}:</span>
      <span className="stat-value">{value}</span>
    </div>
  );
};

export default Stat;
