import React from 'react';
import SceneCard from './SceneCard';

export default function SceneGrid({ scenes, onSceneClick, showSceneNumbers = false }) {
  if (!scenes || scenes.length === 0) {
    return (
      <div className="empty-state">
        <p>No scenes found</p>
      </div>
    );
  }

  return (
    <div className="content-grid scenes-grid">
      {scenes.map((scene, index) => (
        <SceneCard 
          key={scene.id} 
          scene={scene} 
          onSceneClick={onSceneClick}
          sceneNumber={showSceneNumbers ? index + 1 : null}
        />
      ))}
    </div>
  );
}
