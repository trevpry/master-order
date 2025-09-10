import React from 'react';

const NoMediaTypesMessage = ({ selectedMediaTypes }) => {
  if (selectedMediaTypes.length > 0) {
    return null;
  }

  return (
    <div className="stats-card">
      <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
        <h3>No Media Types Selected</h3>
        <p>Please select at least one media type from the filters above to view statistics.</p>
      </div>
    </div>
  );
};

export default NoMediaTypesMessage;
