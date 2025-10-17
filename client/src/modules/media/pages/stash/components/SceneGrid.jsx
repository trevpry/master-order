import React from 'react';
import SceneCard from './SceneCard';

export default function SceneGrid({ scenes, onSceneClick }) {
  if (!scenes || scenes.length === 0) {
    return (
      <div className="empty-state">
        <p>No scenes found</p>
      </div>
    );
  }

  return (
    <div className="content-grid scenes-grid">
      {scenes.map((scene) => (
        <SceneCard 
          key={scene.id} 
          scene={scene} 
          onSceneClick={onSceneClick}
        />
      ))}
    </div>
  );
}
