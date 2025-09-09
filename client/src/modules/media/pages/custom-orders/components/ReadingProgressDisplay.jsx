import React from 'react';

const ReadingProgressDisplay = ({ item }) => {
  if (item.bookCurrentPage && item.bookPageCount) {
    return (
      <span>📖 Page {item.bookCurrentPage} of {item.bookPageCount} ({Math.round(item.bookPercentRead || 0)}%)</span>
    );
  }
  
  if (item.bookPercentRead) {
    return (
      <span>📖 {Math.round(item.bookPercentRead)}% complete</span>
    );
  }
  
  if (item.bookCurrentPage) {
    return (
      <span>📖 Page {item.bookCurrentPage}</span>
    );
  }
  
  return null;
};

export default ReadingProgressDisplay;
