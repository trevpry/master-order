import React from 'react';

const ReadingProgressDisplay = ({ item }) => {
  // Prioritize unified progress data from the Books system
  const unifiedProgress = item.unifiedProgress?.percentageComplete;
  const legacyProgress = item.bookPercentRead;
  const currentPage = item.bookCurrentPage;
  const totalPages = item.bookPageCount;
  
  // Use unified progress if available, fallback to legacy data
  const percentComplete = unifiedProgress !== undefined ? unifiedProgress : legacyProgress;
  
  if (currentPage && totalPages) {
    return (
      <span>📖 Page {currentPage} of {totalPages} ({Math.round(percentComplete || 0)}%)</span>
    );
  }
  
  if (percentComplete > 0) {
    return (
      <span>📖 {Math.round(percentComplete)}% complete{unifiedProgress !== undefined ? ' (unified)' : ''}</span>
    );
  }
  
  if (currentPage) {
    return (
      <span>📖 Page {currentPage}</span>
    );
  }
  
  return null;
};

export default ReadingProgressDisplay;
