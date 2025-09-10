import React from 'react';

const NoDataState = ({ stats }) => {
  if (!stats || stats.totalStats.totalItems !== 0) {
    return null;
  }

  return (
    <div className="stats-card">
      <div className="no-data">
        <h2>No Watch Data</h2>
        <p>Start watching TV shows, movies, web videos, or reading books and comics to see your statistics here!</p>
      </div>
    </div>
  );
};

export default NoDataState;
