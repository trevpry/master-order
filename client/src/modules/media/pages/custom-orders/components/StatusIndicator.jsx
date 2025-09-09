import React from 'react';

const StatusIndicator = ({ 
  isActive, 
  activeText = 'Active', 
  inactiveText = 'Inactive' 
}) => {
  return (
    <div className="order-status">
      <span className={`status-indicator ${isActive ? 'active' : 'inactive'}`}>
        {isActive ? activeText : inactiveText}
      </span>
    </div>
  );
};

export default StatusIndicator;
