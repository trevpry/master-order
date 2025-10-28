import React from 'react';
import PerformerCard from './PerformerCard';

export default function PerformerGrid({ 
  performers, 
  selectionMode = false, 
  selectedPerformers = new Set(), 
  onToggleSelection,
  currentPage = 1
}) {
  if (!performers || performers.length === 0) {
    return (
      <div className="empty-state">
        <p>No performers found</p>
      </div>
    );
  }

  return (
    <div className="content-grid performers-grid">
      {performers.map((performer) => (
        <PerformerCard 
          key={performer.id} 
          performer={performer}
          selectionMode={selectionMode}
          isSelected={selectedPerformers.has(performer.id)}
          onToggleSelection={onToggleSelection}
          currentPage={currentPage}
        />
      ))}
    </div>
  );
}
