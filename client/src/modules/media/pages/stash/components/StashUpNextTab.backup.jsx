import React from 'react';
import Button from '../../../../../shared/components/Button';
import { formatDuration } from '../../../../../utils/timeUtils';
import { getSceneDisplayTitle, getSceneImageUrl, formatDate } from '../../../utils/stashUtils';

const StashUpNextTab = ({
  data,
  pagination,
  setVideoPlayer,
  slideshow,
  setSlideshow,
  mixedMode,
  setMixedMode,
  setAutoSkipRetries
}) => {
  return (
    <div className="up-next-content">
      <div className="up-next-header">
        <h2>🎯 Up Next</h2>
        <div className="up-next-controls">
          <Button 
            onClick={() => {
              console.log('🎬 Starting clip playback from Up Next...');
              
              // Find the first available clip to play
              if (data.clips && data.clips.length > 0) {
                const clip = data.clips[0];
                console.log('🎯 Playing first clip:', clip.title);
                
                setVideoPlayer({
                  isOpen: true,
                  clip: clip,
                  scene: clip.scene,
                  playbackInfo: null // Will be loaded by video component
                });
                setAutoSkipRetries(0);
              } else {
                console.log('❌ No clips available to play');
              }
            }}
            disabled={!data.clips || data.clips.length === 0}
          >
            ▶️ Play Clips
          </Button>
          <Button 
            onClick={() => {
              console.log('🖼️ Starting slideshow from Up Next...');
              
              // Collect images from scenes and galleries
              const slideshowImages = [];
              
              // Add scene images
              if (data.scenes) {
                data.scenes.forEach(scene => {
                  if (scene.paths && scene.paths.screenshot) {
                    slideshowImages.push({
                      src: getSceneImageUrl(scene),
                      title: getSceneDisplayTitle(scene),
                      type: 'scene',
                      scene: scene
                    });
                  }
                });
              }
              
              if (slideshowImages.length > 0) {
                setSlideshow({
                  isOpen: true,
                  images: slideshowImages,
                  currentIndex: 0,
                  autoAdvance: true,
                  interval: 3000
                });
              } else {
                console.log('❌ No images available for slideshow');
              }
            }}
            disabled={!data.scenes || data.scenes.length === 0}
          >
            🖼️ Slideshow
          </Button>
          <label className="mixed-mode-toggle">
            <input 
              type="checkbox" 
              checked={mixedMode}
              onChange={(e) => setMixedMode(e.target.checked)}
            />
            🎭 Mixed Mode
          </label>
        </div>
      </div>

      {/* Up Next Content Grid */}
      <div className="up-next-grid">
        {/* Clips Section */}
        {data.clips && data.clips.length > 0 && (
          <div className="up-next-section">
            <h3>🎬 Clips ({data.clips.length})</h3>
            <div className="clips-grid">
              {data.clips.slice(0, 6).map((clip, index) => (
                <div key={`${clip.id}-${index}`} className="clip-card">
                  <div className="clip-thumbnail">
                    {clip.scene?.paths?.screenshot ? (
                      <img 
                        src={getSceneImageUrl(clip.scene)}
                        alt={getSceneDisplayTitle(clip.scene)}
                        onClick={() => {
                          console.log('🎬 Playing clip from Up Next:', clip.title);
                          setVideoPlayer({
                            isOpen: true,
                            clip: clip,
                            scene: clip.scene,
                            playbackInfo: null
                          });
                          setAutoSkipRetries(0);
                        }}
                      />
                    ) : (
                      <div className="no-thumbnail">📹</div>
                    )}
                    <div className="clip-overlay">
                      <span className="clip-duration">
                        {formatDuration(clip.duration)}
                      </span>
                    </div>
                  </div>
                  <div className="clip-info">
                    <h4>{getSceneDisplayTitle(clip.scene)}</h4>
                    <p className="clip-time">
                      {Math.floor(clip.startTime / 60)}:{String(Math.floor(clip.startTime % 60)).padStart(2, '0')} - 
                      {Math.floor(clip.endTime / 60)}:{String(Math.floor(clip.endTime % 60)).padStart(2, '0')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Scenes Section */}
        {data.scenes && data.scenes.length > 0 && (
          <div className="up-next-section">
            <h3>🎭 Recent Scenes ({data.scenes.length})</h3>
            <div className="scenes-grid">
              {data.scenes.slice(0, 4).map(scene => (
                <div key={scene.id} className="scene-card">
                  <div className="scene-thumbnail">
                    {scene.paths?.screenshot ? (
                      <img 
                        src={getSceneImageUrl(scene)}
                        alt={getSceneDisplayTitle(scene)}
                        onClick={() => {
                          // This would need a setSelectedScene prop to work
                          console.log('Scene clicked:', scene.title);
                        }}
                      />
                    ) : (
                      <div className="no-thumbnail">🎬</div>
                    )}
                  </div>
                  <div className="scene-info">
                    <h4>{getSceneDisplayTitle(scene)}</h4>
                    <p className="scene-date">{formatDate(scene.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StashUpNextTab;
