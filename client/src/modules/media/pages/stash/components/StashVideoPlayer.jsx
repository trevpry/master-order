import React, { useState } from 'react';
import { formatDuration } from '../../../../../utils/timeUtils';
import { 
  getSceneDisplayTitle, 
  getSceneImageUrl, 
  isVideoFormatSupported, 
  getSceneFileName, 
  getSceneTags,
  getClipTags,
  getSceneStudio,
  getScenePerformers,
  getTagParents,
  getTagChildren
} from '../../../utils/stashUtils';
import config from '../../../../../config.js';
import ClipTagManager from './ClipTagManager';

const StashVideoPlayer = ({
  videoPlayer,
  setVideoPlayer,
  videoPlayerFullscreen,
  setVideoPlayerFullscreen,
  videoPlayerControlsVisible,
  setVideoPlayerControlsVisible,
  videoPlayerControlsTimeout,
  setVideoPlayerControlsTimeout,
  autoSkipRetries,
  setAutoSkipRetries,
  connectionStatus,
  mixedMode,
  MAX_AUTO_SKIP_RETRIES
}) => {
  // State for pause overlay
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedPauseTags, setExpandedPauseTags] = useState(new Set());
  const [showClipTagManager, setShowClipTagManager] = useState(false);
  
  // Helper function to check if a tag is already on the clip
  const isTagOnClip = (tagId) => {
    const clipTags = getClipTags(videoPlayer.clip);
    return clipTags.some(tag => tag.id === tagId);
  };
  
  // Helper function to toggle a tag on/off the clip
  const toggleTagOnClip = async (tagId, isCurrentlyOnClip) => {
    if (!videoPlayer.clip?.id) return;
    
    try {
      if (isCurrentlyOnClip) {
        // Remove tag from clip
        const response = await fetch(`/api/stash/clips/${videoPlayer.clip.id}/tags/${tagId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to remove tag');
      } else {
        // Add tag to clip
        const response = await fetch(`/api/stash/clips/${videoPlayer.clip.id}/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tagIds: [tagId] }),
        });
        if (!response.ok) throw new Error('Failed to add tag');
      }
      
      // Refresh clip tags
      const refreshResponse = await fetch(`/api/stash/clips/${videoPlayer.clip.id}/tags`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        if (videoPlayer.clip) {
          videoPlayer.clip.tags = data.tags;
        }
      }
    } catch (error) {
      console.error('Error toggling tag on clip:', error);
      alert('Failed to update clip tag. Please try again.');
    }
  };
  // Helper function to mark a clip as watched
  const markClipAsWatched = async (clipId) => {
    try {
      console.log(`✅ Marking clip ${clipId} as watched...`);
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/${clipId}/watched`, {
        method: 'POST'
      });
      
      if (response.ok) {
        console.log(`✅ Clip ${clipId} successfully marked as watched`);
      } else {
        console.error(`❌ Failed to mark clip ${clipId} as watched`);
      }
    } catch (error) {
      console.error(`❌ Error marking clip ${clipId} as watched:`, error);
    }
  };

  // Helper function to delete scene and all its clips
  const deleteSceneAndClips = async () => {
    if (!videoPlayer.scene?.id) return;
    
    const sceneId = videoPlayer.scene.id;
    const sceneTitle = getSceneDisplayTitle(videoPlayer.scene);
    
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete "${sceneTitle}" and all its clips?\n\nThis will:\n• Delete the video file from disk\n• Delete all generated content (thumbnails, sprites, etc.)\n• Delete the scene from Stash database\n• Delete all clips from your local database\n\nThis action cannot be undone.`)) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      console.log(`🗑️ Deleting scene ${sceneId} and all clips...`);
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${sceneId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ Successfully deleted scene and ${result.clipsDeleted} clips`);
        
        // Build detailed message
        let message = `✅ Successfully deleted "${sceneTitle}"\n\n`;
        message += `• Deleted ${result.clipsDeleted} clip${result.clipsDeleted !== 1 ? 's' : ''}\n`;
        message += `• Removed from local database: ${result.localDeleted ? 'Yes' : 'No'}\n`;
        message += `• Deleted from Stash: ${result.stashDeleted ? 'Yes' : 'No'}`;
        
        if (result.warning) {
          message += `\n\n⚠️ ${result.warning}`;
        }
        
        alert(message);
        
        // Close video player
        setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
        setShowPauseOverlay(false);
      } else {
        console.error('❌ Failed to delete scene:', result.error);
        alert(`❌ Failed to delete scene: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('❌ Error deleting scene:', error);
      alert(`❌ Error deleting scene: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper function to toggle fullscreen
  const toggleVideoFullscreen = async () => {
    const container = document.querySelector('.video-player-container');
    if (!container) return;
    
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setVideoPlayerFullscreen(true);
      } else {
        await document.exitFullscreen();
        setVideoPlayerFullscreen(false);
      }
    } catch (error) {
      console.error('Failed to toggle video fullscreen:', error);
    }
  };

  const handleVideoPlayerMouseMove = () => {
    setVideoPlayerControlsVisible(true);
    
    // Clear existing timeout
    if (videoPlayerControlsTimeout) {
      clearTimeout(videoPlayerControlsTimeout);
    }
    
    // Set new timeout to hide controls after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      setVideoPlayerControlsVisible(false);
    }, 3000);
    
    setVideoPlayerControlsTimeout(timeout);
  };

  const handleVideoPlayerKeyDown = (event) => {
    const video = document.querySelector('.clip-video-player');
    if (!video) return;

    switch (event.key) {
      case 'Escape':
        // Clean up timer before closing
        if (video.clipTimer) {
          clearTimeout(video.clipTimer);
          video.clipTimer = null;
          console.log('🧹 Cleaned up clip timer on ESC');
        }
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
        setAutoSkipRetries(0);
        break;
      case ' ':
        event.preventDefault();
        if (video.paused) {
          video.play();
          // Overlay will be hidden by onPlay event
        } else {
          video.pause();
          // Overlay will be shown by onPause event which also clears timer
        }
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        toggleVideoFullscreen();
        break;
      case 'ArrowRight':
      case 'n':
      case 'N':
        event.preventDefault();
        // Load next clip manually
        handleManualNextClip();
        break;
      default:
        break;
    }
  };

  const handleManualNextClip = async () => {
    try {
      // Mark current clip as watched before moving to next
      if (videoPlayer.clip?.id) {
        await markClipAsWatched(videoPlayer.clip.id);
      }
      
      console.log('🔄 Manually fetching next clip from API...');
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
      const result = await response.json();
      
      console.log('📡 Manual API Response status:', response.status);
      console.log('📦 Manual API Response data:', result);
      
      if (response.ok) {
        if (result.clip && result.clip.scene) {
          // Check if video format is supported before opening player
          const filePath = result.clip.scene.path;
          
          if (!isVideoFormatSupported(filePath)) {
            const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
            console.error(`🚫 Unsupported video format: ${extension}`);
            
            alert(`⚠️ Unsupported Video Format\n\nThe file "${filePath}" is in ${extension} format, which is not supported by modern browsers.\n\nSupported formats: MP4, WebM, OGG, M4V\nPartially supported: MOV, MKV\nNot supported: WMV, AVI, FLV, DIVX\n\nPlease convert the file to a supported format (MP4 recommended) or use a different video.`);
            return;
          }
          
          console.log('🎯 Manually loaded next clip:', result.clip.scene.title);
          
          // Update video player with new clip
          setVideoPlayer({
            isOpen: true,
            clip: result.clip,
            scene: result.clip.scene,
            playbackInfo: result.playbackInfo
          });
        } else {
          console.error('❌ Invalid manual clip data received:', result);
          alert('❌ Invalid clip data received');
        }
      } else {
        console.error('Failed to manually load next clip:', result.error);
        alert(`❌ Failed to load next clip: ${result.error}`);
      }
    } catch (error) {
      console.error('Error manually loading next clip:', error);
      alert('❌ Error loading next clip');
    }
  };

  const handleVideoTimeUpdate = async (e) => {
    // Don't advance to next clip if video is paused (pause overlay is showing)
    if (showPauseOverlay) {
      return;
    }
    
    // Only proceed if playbackInfo is available
    if (!videoPlayer.playbackInfo) {
      return;
    }
    
    // Calculate if we've watched the full clip
    const currentTime = e.target.currentTime;
    const clipStartTime = videoPlayer.playbackInfo.startTime;
    const clipEndTime = videoPlayer.playbackInfo.endTime;
    
    // Check if we've reached the end of the clip (within 1 second tolerance)
    if (currentTime >= clipEndTime - 1) {
      console.log('⏱️ Reached end of clip via timeUpdate - marking as watched and loading next clip...');
      
      // Clear existing timer first
      if (e.target.clipTimer) {
        clearTimeout(e.target.clipTimer);
        e.target.clipTimer = null;
      }
      
      // Mark current clip as watched before moving to next
      if (videoPlayer.clip?.id) {
        await markClipAsWatched(videoPlayer.clip.id);
      }
      
      // Automatically load next clip
      try {
        console.log('🔄 TimeUpdate: fetching next clip from API...');
        const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
        const result = await response.json();
        
        if (response.ok) {
          if (result.clip && result.clip.scene) {
            console.log('🎯 TimeUpdate: Auto-loaded next clip:', result.clip.scene.title);
            
            // Update video player with new clip
            setVideoPlayer({
              isOpen: true,
              clip: result.clip,
              scene: result.clip.scene,
              playbackInfo: result.playbackInfo
            });
          } else {
            console.error('❌ Invalid timeUpdate clip data received:', result);
            setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
          }
        } else {
          console.error('Failed to load next clip via timeUpdate:', result.error);
          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
        }
      } catch (error) {
        console.error('Error loading next clip via timeUpdate:', error);
        setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
      }
    }
  };

  const handleVideoError = async (e) => {
    const errorCode = e.target.error?.code;
    console.error('🚫 Video playback error:', {
      code: errorCode,
      message: e.target.error?.message,
      src: e.target.src
    });
    
    if (errorCode === 1) {
      // User aborted - don't auto-skip
      console.log('🛑 User aborted video playback');
      return;
    }
    
    // Check retry limit
    if (autoSkipRetries >= MAX_AUTO_SKIP_RETRIES) {
      console.error(`❌ Maximum auto-skip retries reached (${MAX_AUTO_SKIP_RETRIES})`);
      alert(`❌ Unable to find a playable video after ${MAX_AUTO_SKIP_RETRIES} attempts.\n\nThis may indicate:\n• Network issues with Stash server\n• All available clips have unsupported formats\n• Stash server problems\n\nTry again later or check your Stash server.`);
      setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
      setAutoSkipRetries(0); // Reset for next session
      return;
    }
    
    console.log('🔄 Video error detected - automatically skipping to next clip without marking as watched');
    
    // Try alternative Stash endpoints first for network/decode errors
    const baseUrl = connectionStatus.stashUrl?.endsWith('/') 
      ? connectionStatus.stashUrl.slice(0, -1) 
      : connectionStatus.stashUrl;
    
    const currentSrc = e.target.src;
    let nextUrl = null;
    
    // Only try alternatives for network/decode errors, not format errors
    if (errorCode === 2 || errorCode === 3) {
      // Try Stash's known streaming endpoints
      if (currentSrc.includes('/stream') && !currentSrc.includes('.')) {
        nextUrl = `${baseUrl}/scene/${videoPlayer.scene.id}/stream.m3u8`;
        console.log('🔄 Direct stream failed, trying HLS:', nextUrl);
      } else if (currentSrc.includes('.m3u8')) {
        nextUrl = `${baseUrl}/scene/${videoPlayer.scene.id}/file`;
        console.log('🔄 HLS failed, trying direct file:', nextUrl);
      }
      
      // If we have an alternative URL to try, attempt it once
      if (nextUrl && nextUrl !== currentSrc && !e.target.hasTriedAlternative) {
        console.log('🔄 Retrying with alternative URL...');
        e.target.hasTriedAlternative = true; // Prevent infinite retry loop
        e.target.src = nextUrl;
        e.target.load(); // Reload with new source
        return;
      }
    }
    
    // All alternatives failed or this is a format error - skip to next clip
    console.log('🚀 Auto-skipping to next clip due to playback error');
    setAutoSkipRetries(prev => prev + 1); // Increment retry counter
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
      const result = await response.json();
      
      if (response.ok) {
        if (result.clip && result.clip.scene) {
          // Check if video format is supported before updating player
          const filePath = result.clip.scene.path;
          
          if (!isVideoFormatSupported(filePath)) {
            const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
            console.error(`🚫 Auto-skip: Unsupported video format: ${extension}`);
            
            // Delay and try again
            setTimeout(() => {
              e.target.dispatchEvent(new Event('error'));
            }, 100);
            return;
          }
          
          console.log('🎯 Auto-skipped to next clip:', result.clip.scene.title);
          
          // Update video player with new clip (don't mark previous as watched)
          setVideoPlayer({
            isOpen: true,
            clip: result.clip,
            scene: result.clip.scene,
            playbackInfo: result.playbackInfo
          });
        } else {
          console.error('❌ No more clips available for auto-skip');
          alert('❌ No more playable clips available');
          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
          setAutoSkipRetries(0); // Reset for next session
        }
      } else {
        console.error('Failed to auto-skip to next clip:', result.error);
        alert(`❌ Auto-skip failed: ${result.error || 'No more clips available'}`);
        setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
        setAutoSkipRetries(0); // Reset for next session
      }
    } catch (error) {
      console.error('Error during auto-skip:', error);
      alert('❌ Failed to skip to next clip');
      setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
      setAutoSkipRetries(0); // Reset for next session
    }
  };

  if (!videoPlayer.isOpen) {
    return null;
  }

  return (
    <div 
      className={`video-player-overlay ${videoPlayerFullscreen ? 'fullscreen' : ''}`}
      onMouseMove={handleVideoPlayerMouseMove}
      onKeyDown={handleVideoPlayerKeyDown}
      tabIndex={0} // Make div focusable for keyboard events
      onClick={(e) => {
        // Close player when clicking on overlay background (not the video or controls)
        if (e.target === e.currentTarget) {
          // Clean up timer before closing
          const video = document.querySelector('.clip-video-player');
          if (video && video.clipTimer) {
            clearTimeout(video.clipTimer);
            video.clipTimer = null;
            console.log('🧹 Cleaned up clip timer on overlay click');
          }
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
          setAutoSkipRetries(0);
        }
      }}
    >
      <div 
        className="video-player-container"
        onClick={(e) => e.stopPropagation()} // Prevent overlay click when clicking inside container
      >
        {/* Enhanced Header with Auto-Hide */}
        <div className={`video-player-header ${videoPlayerControlsVisible ? 'visible' : 'hidden'}`}>
          <div className="video-info">
            <h3>🎬 {getSceneDisplayTitle(videoPlayer.scene)}</h3>
            {videoPlayer.clip && videoPlayer.playbackInfo ? (
              <>
                <p>Clip {videoPlayer.clip.clipIndex + 1} • {Math.floor(videoPlayer.playbackInfo.startTime / 60)}:{String(Math.floor(videoPlayer.playbackInfo.startTime % 60)).padStart(2, '0')} - {Math.floor(videoPlayer.playbackInfo.endTime / 60)}:{String(Math.floor(videoPlayer.playbackInfo.endTime % 60)).padStart(2, '0')}</p>
                <p className="keyboard-shortcuts">ESC: Close • Space: Play/Pause • N/→: Next • F: Fullscreen • Click: Hide Controls</p>
              </>
            ) : videoPlayer.scene && !videoPlayer.clip ? (
              <>
                <p>Playing full scene</p>
                <p className="keyboard-shortcuts">ESC: Close • Space: Play/Pause • F: Fullscreen • Click: Hide Controls</p>
              </>
            ) : (
              <p>Loading video info...</p>
            )}
          </div>
          <div className="video-player-controls">
            <button 
              className="control-btn fullscreen-btn"
              onClick={toggleVideoFullscreen}
              title={videoPlayerFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
            >
              {videoPlayerFullscreen ? '🗗' : '🗖'}
            </button>
            <button 
              className="control-btn close-btn"
              onClick={() => {
                // Clean up timer before closing
                const video = document.querySelector('.clip-video-player');
                if (video && video.clipTimer) {
                  clearTimeout(video.clipTimer);
                  video.clipTimer = null;
                  console.log('🧹 Cleaned up clip timer on close button');
                }
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                }
                setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                setAutoSkipRetries(0);
              }}
              title="Close Player (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video Element */}
        {videoPlayer.scene ? (
          <>
            <video
            className="clip-video-player"
            controls
            autoPlay
            playsInline
            preload="metadata"
            src={videoPlayer.scene.streamUrl || videoPlayer.scene.paths?.webm || videoPlayer.scene.paths?.mp4 || `${connectionStatus.stashUrl}/scene/${videoPlayer.scene.id}/stream`}
            onLoadedData={(e) => {
              if (videoPlayer.playbackInfo) {
                console.log(`⏰ Setting video start time to ${videoPlayer.playbackInfo.startTime}s`);
                e.target.currentTime = videoPlayer.playbackInfo.startTime;
              }
            }}
            onLoadStart={() => {
              console.log('📺 Video loading started');
              const video = document.querySelector('.clip-video-player');
              if (video && video.clipTimer) {
                clearTimeout(video.clipTimer);
                video.clipTimer = null;
                console.log('🧹 Cleaned up existing clip timer on load start');
              }
            }}
            onCanPlayThrough={(e) => {
              console.log('✅ Video can play through');
              
              if (videoPlayer.playbackInfo) {
                console.log(`⏰ Clip duration: ${videoPlayer.playbackInfo.duration}s`);
                console.log(`📍 Clip range: ${videoPlayer.playbackInfo.startTime}s - ${videoPlayer.playbackInfo.endTime}s`);
                
                // Clear any existing timer first
                if (e.target.clipTimer) {
                  clearTimeout(e.target.clipTimer);
                  e.target.clipTimer = null;
                  console.log('🧹 Cleared existing timer before setting new one');
                }
                
                // Set backup timer only if mixed mode is not active
                if (!mixedMode) {
                  const clipDurationMs = videoPlayer.playbackInfo.duration * 1000 + 2000; // Add 2 second buffer
                  console.log(`⏱️ Setting backup timer for ${clipDurationMs}ms`);
                  
                  const clipTimer = setTimeout(async () => {
                    console.log('⏰ Backup timer triggered - marking as watched and loading next clip...');
                    
                    // Mark current clip as watched before moving to next
                    if (videoPlayer.clip?.id) {
                      await markClipAsWatched(videoPlayer.clip.id);
                    }
                    
                    try {
                      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
                      const result = await response.json();
                      
                      if (response.ok && result.clip && result.clip.scene) {
                        // Check if video format is supported
                        const filePath = result.clip.scene.path;
                        
                        if (!isVideoFormatSupported(filePath)) {
                          const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
                          console.error(`🚫 Backup timer: Unsupported video format: ${extension}`);
                          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                          return;
                        }
                        
                        console.log('🎯 Auto-loaded next clip via backup timer:', result.clip.scene.title);
                        
                        // Update video player with new clip
                        setVideoPlayer({
                          isOpen: true,
                          clip: result.clip,
                          scene: result.clip.scene,
                          playbackInfo: result.playbackInfo
                        });
                      } else {
                        console.error('❌ Invalid clip data received:', result);
                        setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                      }
                    } catch (error) {
                      console.error('Error loading next clip via backup timer:', error);
                      setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                    }
                  }, clipDurationMs);
                  
                  e.target.clipTimer = clipTimer;
                } else {
                  console.log('🎭 Mixed mode active - skipping backup timer');
                }
              }
            }}
            onTimeUpdate={handleVideoTimeUpdate}
            onPause={() => {
              console.log('⏸️ Video paused');
              const video = document.querySelector('.clip-video-player');
              // Clear backup timer when paused to prevent automatic clip advancement
              if (video && video.clipTimer) {
                clearTimeout(video.clipTimer);
                video.clipTimer = null;
                console.log('🧹 Cleared backup timer on pause');
              }
              setShowPauseOverlay(true);
            }}
            onPlay={() => {
              console.log('▶️ Video playing');
              setShowPauseOverlay(false);
              
              // Restart backup timer if we're in clip mode and not in mixed mode
              const video = document.querySelector('.clip-video-player');
              if (video && videoPlayer.playbackInfo && !mixedMode) {
                // Calculate remaining time for this clip
                const currentTime = video.currentTime;
                const clipEndTime = videoPlayer.playbackInfo.endTime;
                const remainingTime = Math.max(0, (clipEndTime - currentTime) * 1000 + 2000); // Add 2 second buffer
                
                if (remainingTime > 0) {
                  console.log(`⏱️ Restarting backup timer for ${remainingTime}ms`);
                  
                  const clipTimer = setTimeout(async () => {
                    console.log('⏰ Backup timer triggered after resume - marking as watched and loading next clip...');
                    
                    // Mark current clip as watched before moving to next
                    if (videoPlayer.clip?.id) {
                      await markClipAsWatched(videoPlayer.clip.id);
                    }
                    
                    try {
                      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
                      const result = await response.json();
                      
                      if (response.ok && result.clip && result.clip.scene) {
                        // Check if video format is supported
                        const filePath = result.clip.scene.path;
                        
                        if (!isVideoFormatSupported(filePath)) {
                          const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
                          console.error(`🚫 Resume timer: Unsupported video format: ${extension}`);
                          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                          return;
                        }
                        
                        console.log('🎯 Auto-loaded next clip via resume timer:', result.clip.scene.title);
                        
                        // Update video player with new clip
                        setVideoPlayer({
                          isOpen: true,
                          clip: result.clip,
                          scene: result.clip.scene,
                          playbackInfo: result.playbackInfo
                        });
                      } else {
                        console.error('❌ Invalid clip data received:', result);
                        setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                      }
                    } catch (error) {
                      console.error('Error loading next clip via resume timer:', error);
                      setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                    }
                  }, remainingTime);
                  
                  video.clipTimer = clipTimer;
                }
              }
            }}
            onEnded={async () => {
              console.log('🏁 Video ended - marking as watched and loading next clip...');
              // Clear timer if video ends naturally
              const video = document.querySelector('.clip-video-player');
              if (video && video.clipTimer) {
                clearTimeout(video.clipTimer);
                video.clipTimer = null;
              }
              
              // Mark current clip as watched before moving to next
              if (videoPlayer.clip?.id) {
                await markClipAsWatched(videoPlayer.clip.id);
              }
              
              // Automatically load next clip
              try {
                const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
                const result = await response.json();
                
                if (response.ok && result.clip && result.clip.scene) {
                  // Check if video format is supported
                  const filePath = result.clip.scene.path;
                  
                  if (!isVideoFormatSupported(filePath)) {
                    const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
                    console.error(`🚫 OnEnded: Unsupported video format: ${extension}`);
                    setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                    return;
                  }
                  
                  console.log('🎯 OnEnded: Auto-loaded next clip:', result.clip.scene.title);
                  
                  // Update video player with new clip
                  setVideoPlayer({
                    isOpen: true,
                    clip: result.clip,
                    scene: result.clip.scene,
                    playbackInfo: result.playbackInfo
                  });
                } else {
                  console.error('❌ No more clips available');
                  setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                }
              } catch (error) {
                console.error('Error loading next clip on ended:', error);
                setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
              }
            }}
            onError={handleVideoError}
            onCanPlay={() => {
              console.log('✅ Video can play');
              setAutoSkipRetries(0); // Reset retry counter on successful video load
            }}
          >
            Your browser does not support the video tag.
          </video>

          {/* Pause Overlay with Delete Button */}
          {showPauseOverlay && (
            <div className="pause-overlay">
              <div className="pause-overlay-content">
                <div className="pause-icon">⏸️</div>
                <h2>Paused</h2>
                <p className="scene-title">{getSceneDisplayTitle(videoPlayer.scene)}</p>
                
                {/* File Name */}
                {getSceneFileName(videoPlayer.scene) && (
                  <p className="file-name">
                    📁 {getSceneFileName(videoPlayer.scene)}
                  </p>
                )}
                
                {/* Studio */}
                {getSceneStudio(videoPlayer.scene) && (
                  <p className="scene-studio">
                    🏢 {getSceneStudio(videoPlayer.scene).name}
                  </p>
                )}
                
                {/* Performers */}
                {getScenePerformers(videoPlayer.scene).length > 0 && (
                  <div className="scene-performers">
                    <span className="performers-label">👥 </span>
                    <span className="performers-list">
                      {getScenePerformers(videoPlayer.scene).map((performer, index) => (
                        <span key={performer.id}>
                          {performer.name}
                          {index < getScenePerformers(videoPlayer.scene).length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                
                {/* Clip Info */}
                {videoPlayer.clip && (
                  <p className="clip-info">Clip {videoPlayer.clip.clipIndex + 1}</p>
                )}
                
                {/* Tags with Hierarchy - Root Tags Only with Expansion */}
                {getSceneTags(videoPlayer.scene).length > 0 && (
                  <div className="scene-tags-section">
                    <div className="scene-tags-header">
                      <h4>Scene Tags</h4>
                      <span className="scene-tags-help">✓ Check to copy to clip</span>
                    </div>
                    <div className="scene-tags-hierarchical">
                    {(() => {
                      const allTags = getSceneTags(videoPlayer.scene);
                      
                      // Filter to only root tags (tags with no parents)
                      const rootTags = allTags.filter(tag => {
                        const tagObj = tag.tag || tag;
                        const parents = getTagParents(tagObj);
                        return parents.length === 0;
                      });
                      
                      const toggleTagExpansion = (tagId) => {
                        setExpandedPauseTags(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(tagId)) {
                            newSet.delete(tagId);
                          } else {
                            newSet.add(tagId);
                          }
                          return newSet;
                        });
                      };
                      
                      const renderTagWithChildren = (tag, level = 0) => {
                        const tagObj = tag.tag || tag;
                        const children = getTagChildren(tagObj);
                        const isExpanded = expandedPauseTags.has(tagObj.id);
                        const hasChildren = children.length > 0;
                        const isOnClip = isTagOnClip(tagObj.id);
                        
                        return (
                          <div key={tagObj.id} className="pause-tag-item" style={{ marginLeft: `${level * 1.5}rem` }}>
                            <div className="pause-tag-row">
                              {hasChildren && (
                                <button
                                  className="tag-expand-button-small"
                                  onClick={() => toggleTagExpansion(tagObj.id)}
                                  title={isExpanded ? 'Collapse' : 'Expand children'}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                              )}
                              
                              {/* Checkbox to add/remove tag from clip */}
                              <input
                                type="checkbox"
                                className="tag-clip-checkbox"
                                checked={isOnClip}
                                onChange={() => toggleTagOnClip(tagObj.id, isOnClip)}
                                title={isOnClip ? 'Remove from clip' : 'Add to clip'}
                              />
                              
                              <span 
                                className={`tag-badge ${tag.favorite || tagObj.favorite ? 'tag-favorite' : ''} ${hasChildren ? 'tag-has-hierarchy' : ''} ${isOnClip ? 'tag-on-clip' : ''}`}
                                title={tag.description || tagObj.description}
                              >
                                {tag.favorite || tagObj.favorite ? '⭐ ' : ''}{tagObj.name}
                                {hasChildren && <span className="tag-child-count"> ({children.length})</span>}
                                {isOnClip && <span className="tag-on-clip-icon"> ✓</span>}
                              </span>
                            </div>
                            
                            {/* Render children when expanded */}
                            {isExpanded && hasChildren && (
                              <div className="pause-tag-children">
                                {children.map(child => {
                                  // Find the full tag object from allTags
                                  const childTagFull = allTags.find(t => (t.tag?.id || t.id) === child.id);
                                  return renderTagWithChildren(childTagFull || child, level + 1);
                                })}
                              </div>
                            )}
                          </div>
                        );
                      };
                      
                      return rootTags.map(tag => renderTagWithChildren(tag));
                    })()}
                    </div>
                  </div>
                )}
                
                {/* Clip-specific Tags */}
                <div className="clip-tags-section">
                  <div className="clip-tags-header">
                    <h4>Clip Tags</h4>
                    <button 
                      className="manage-tags-btn"
                      onClick={() => setShowClipTagManager(true)}
                    >
                      ⚙️ Manage Tags
                    </button>
                  </div>
                  {(() => {
                    const clipTags = getClipTags(videoPlayer.clip);
                    return clipTags.length > 0 ? (
                      <div className="clip-tags-list">
                        {clipTags.map(tag => (
                          <span 
                            key={tag.id}
                            className={`tag-badge clip-tag ${tag.favorite ? 'tag-favorite' : ''}`}
                            title={tag.description}
                          >
                            {tag.favorite ? '⭐ ' : ''}{tag.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="no-clip-tags">No clip-specific tags. Click "Manage Tags" to add some.</p>
                    );
                  })()}
                </div>
                
                <div className="pause-actions">
                  <button 
                    className="pause-action-btn play-btn"
                    onClick={() => {
                      const video = document.querySelector('.clip-video-player');
                      if (video) {
                        video.play();
                        setShowPauseOverlay(false);
                      }
                    }}
                  >
                    ▶️ Resume
                  </button>
                  <button 
                    className="pause-action-btn delete-btn"
                    onClick={deleteSceneAndClips}
                    disabled={isDeleting}
                  >
                    {isDeleting ? '⏳ Deleting...' : '🗑️ Delete Scene & Clips'}
                  </button>
                </div>
                <p className="pause-hint">Press Space to resume • Press ESC to close</p>
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="video-loading">
            <p>⏳ Loading clip...</p>
          </div>
        )}
      </div>
      
      {/* Clip Tag Manager */}
      <ClipTagManager
        clip={videoPlayer.clip}
        isVisible={showClipTagManager}
        onClose={() => setShowClipTagManager(false)}
        onTagsUpdated={() => {
          // Refresh the clip data to get updated tags
          if (videoPlayer.clip?.id) {
            fetch(`/api/stash/clips/${videoPlayer.clip.id}/tags`)
              .then(response => response.json())
              .then(data => {
                // Update the clip with new tags
                if (videoPlayer.clip) {
                  videoPlayer.clip.tags = data.tags;
                }
              })
              .catch(error => console.error('Error refreshing clip tags:', error));
          }
        }}
      />
    </div>
  );
};

export default StashVideoPlayer;
