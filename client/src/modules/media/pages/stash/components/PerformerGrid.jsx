import React from 'react';
import PerformerCard from './PerformerCard';

export default function PerformerGrid({ performers }) {
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
        />
      ))}
    </div>
  );
}
