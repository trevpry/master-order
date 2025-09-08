import React, { useState, useEffect } from 'react';
import Button from '../../../shared/components/Button';
import './Stash.css';
import config from '../../../config';

export default function Stash() {
  const [connectionStatus, setConnectionStatus] = useState({ 
    configured: false, 
    connected: false, 
    stashUrl: null,
    apiKey: null 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mainTab, setMainTab] = useState(() => {
    // Load main tab from localStorage, default to 'upnext'
    return localStorage.getItem('stash-main-tab') || 'upnext';
  }); // 'upnext' or 'library'
  const [libraryTab, setLibraryTab] = useState('scenes'); // for library sub-tabs
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState({
    scenes: [],
    performers: [],
    studios: [],
    tags: [],
    clips: []
  });
  const [pagination, setPagination] = useState({
    scenes: { total: 0, hasMore: false },
    performers: { total: 0, hasMore: false },
    studios: { total: 0, hasMore: false },
    tags: { total: 0, hasMore: false },
    clips: { total: 0, hasMore: false }
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('DESC');
  const [watchStatusFilter, setWatchStatusFilter] = useState('all');
  const [syncStatus, setSyncStatus] = useState({
    isRunning: false,
    lastSync: null,
    message: ''
  });
  const [modal, setModal] = useState({
    isOpen: false,
    action: null, // 'play' or 'pause'
    scene: null,
    data: null
  });
  const [upNextLoading, setUpNextLoading] = useState(false);
  const [selectedScene, setSelectedScene] = useState(null); // For showing current/last selected scene
  const [markingWatched, setMarkingWatched] = useState(false);
  const [deletingScene, setDeletingScene] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    scene: null,
    deleteFile: false
  });
  const [performerImageModal, setPerformerImageModal] = useState({
    isOpen: false,
    performer: null
  });
  const [stats, setStats] = useState({
    scenes: 0,
    performers: 0,
    studios: 0,
    topPerformers: [],
    topStudios: [],
    lastUpdated: null,
    loading: false,
    error: null
  });

  // Video player state for full-screen clip playback
  const [videoPlayer, setVideoPlayer] = useState({
    isOpen: false,
    clip: null,
    scene: null,
    playbackInfo: null
  });
  const [autoSkipRetries, setAutoSkipRetries] = useState(0);
  const [videoPlayerFullscreen, setVideoPlayerFullscreen] = useState(false);
  const [videoPlayerControlsVisible, setVideoPlayerControlsVisible] = useState(true);
  const [videoPlayerControlsTimeout, setVideoPlayerControlsTimeout] = useState(null);
  const MAX_AUTO_SKIP_RETRIES = 5; // Maximum number of auto-skip attempts

  // Slideshow state for full-screen image slideshow
  const [slideshow, setSlideshow] = useState({
    isOpen: false,
    images: [],
    currentIndex: 0,
    isLoading: false,
    interval: null,
    duration: 6000, // 6 seconds per image
    includeGalleries: true,
    includeStandalone: true,
    isFullscreen: false
  });

  // Mixed mode state for clips + slideshow
  const [mixedMode, setMixedMode] = useState({
    isActive: false,
    isLoading: false,
    currentType: null, // 'clip' or 'slideshow'
    timeout: null,
    shouldContinue: false
  });

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
      console.error('Failed to toggle fullscreen:', error);
    }
  };

  // Helper function to toggle slideshow fullscreen
  const toggleSlideshowFullscreen = async () => {
    const container = document.querySelector('.slideshow-modal');
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setSlideshow(prev => ({ ...prev, isFullscreen: true }));
      } else {
        await document.exitFullscreen();
        setSlideshow(prev => ({ ...prev, isFullscreen: false }));
      }
    } catch (error) {
      console.error('Failed to toggle slideshow fullscreen:', error);
    }
  };

  // Handle mouse movement to show/hide controls
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

  // Keyboard event handler for video player
  const handleVideoPlayerKeyDown = (event) => {
    const video = document.querySelector('.clip-video-player');
    if (!video) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        // Clean up timer before closing
        if (video.clipTimer) {
          clearTimeout(video.clipTimer);
          video.clipTimer = null;
        }
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        
        // If mixed mode is active, stop it completely
        if (mixedMode.isActive) {
          stopMixedMode();
        } else {
          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
          setAutoSkipRetries(0);
        }
        break;
      case ' ':
        event.preventDefault();
        if (video.paused) {
          video.play();
        } else {
          video.pause();
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
        // Trigger next clip
        document.querySelector('.next-clip-btn')?.click();
        break;
      default:
        break;
    }
  };

  // Slideshow functions
  const startSlideshow = async () => {
    try {
      setSlideshow(prev => ({ ...prev, isLoading: true }));
      
      // Fetch random images for the slideshow
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/images/slideshow?count=50&includeGalleries=${slideshow.includeGalleries}&includeStandalone=${slideshow.includeStandalone}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch images for slideshow');
      }
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        setSlideshow(prev => ({
          ...prev,
          isOpen: true,
          images: result.data,
          currentIndex: 0,
          isLoading: false
        }));
        
        // Start the automatic progression
        startSlideshowInterval();
      } else {
        throw new Error('No images available for slideshow');
      }
    } catch (error) {
      console.error('Error starting slideshow:', error);
      setSlideshow(prev => ({ ...prev, isLoading: false }));
      alert('Failed to start slideshow: ' + error.message);
    }
  };

  const startSlideshowInterval = () => {
    const interval = setInterval(() => {
      setSlideshow(prev => {
        const nextIndex = (prev.currentIndex + 1) % prev.images.length;
        return { ...prev, currentIndex: nextIndex };
      });
    }, slideshow.duration);
    
    setSlideshow(prev => ({ ...prev, interval }));
  };

  const stopSlideshow = () => {
    if (slideshow.interval) {
      clearInterval(slideshow.interval);
    }
    
    setSlideshow({
      isOpen: false,
      images: [],
      currentIndex: 0,
      isLoading: false,
      interval: null,
      duration: 6000,
      includeGalleries: true,
      includeStandalone: true
    });
  };

  const nextSlide = () => {
    setSlideshow(prev => {
      const nextIndex = (prev.currentIndex + 1) % prev.images.length;
      return { ...prev, currentIndex: nextIndex };
    });
  };

  const prevSlide = () => {
    setSlideshow(prev => {
      const prevIndex = prev.currentIndex === 0 ? prev.images.length - 1 : prev.currentIndex - 1;
      return { ...prev, currentIndex: prevIndex };
    });
  };

  const handleSlideshowKeyDown = (event) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        // If mixed mode is active, stop it completely
        if (mixedMode.isActive) {
          stopMixedMode();
        } else {
          stopSlideshow();
        }
        break;
      case 'ArrowRight':
      case ' ':
        event.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        prevSlide();
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        toggleSlideshowFullscreen();
        break;
      default:
        break;
    }
  };

  // Mixed mode functions (Clips + Slideshow)
  const startMixedMode = async () => {
    console.log('🎬🖼️ Starting Mixed Mode (80% clips, 20% slideshow)...');
    
    setMixedMode(prev => ({ ...prev, isActive: true, isLoading: true, shouldContinue: true }));
    
    try {
      // Pass true to force execution on first run
      await executeNextMixedModeItem(true);
    } catch (error) {
      console.error('Error starting mixed mode:', error);
      stopMixedMode();
      alert('Failed to start mixed mode: ' + error.message);
    }
  };

  const stopMixedMode = () => {
    console.log('🛑 Stopping Mixed Mode...');
    
    // Clear any pending timeout
    if (mixedMode.timeout) {
      clearTimeout(mixedMode.timeout);
    }
    
    // Stop any active slideshow
    if (slideshow.isOpen) {
      stopSlideshow();
    }
    
    // Close any active video player
    if (videoPlayer.isOpen) {
      setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
    }
    
    // Reset mixed mode state
    setMixedMode({
      isActive: false,
      isLoading: false,
      currentType: null,
      timeout: null,
      shouldContinue: false
    });
  };

  // Helper function to safely continue mixed mode after a delay
  const scheduleNextMixedModeItem = (delay = 2000) => {
    console.log(`⏳ Mixed mode: Scheduling next item in ${delay}ms`);
    const timeout = setTimeout(() => {
      console.log('⏰ Mixed mode scheduled timeout fired');
      // Check state at execution time
      setMixedMode(current => {
        if (current.shouldContinue) {
          console.log('✅ Mixed mode: State allows continuation, executing next item');
          executeNextMixedModeItem();
        } else {
          console.log('🛑 Mixed mode scheduled execution cancelled - not continuing');
        }
        return { ...current, timeout: null };
      });
    }, delay);
    setMixedMode(prev => ({ ...prev, timeout }));
  };

  const executeNextMixedModeItem = async (forceExecute = false) => {
    console.log('🎭 Mixed mode: executeNextMixedModeItem called', { forceExecute });
    
    // Use a ref or state callback to get current state
    let currentMixedModeState = null;
    setMixedMode(current => {
      currentMixedModeState = current;
      return current;
    });

    console.log('🎭 Mixed mode state:', { 
      shouldContinue: currentMixedModeState?.shouldContinue,
      isActive: currentMixedModeState?.isActive,
      currentType: currentMixedModeState?.currentType
    });

    // Check if we should continue (either forced or state allows it)
    if (!forceExecute && !currentMixedModeState?.shouldContinue) {
      console.log('🛑 Mixed mode stopped - not continuing');
      return;
    }

    // Determine what to play next: 80% chance for clips, 20% for slideshow
    const randomValue = Math.random();
    const isClip = randomValue < 0.8;
    const currentType = isClip ? 'clip' : 'slideshow';
    
    console.log(`🎲 Mixed mode rolling (${randomValue.toFixed(3)}): ${isClip ? '🎬 Playing Clip (80%)' : '🖼️ Playing Slideshow (20%)'}`);
    console.log(`🎭 Mixed mode: Setting currentType to "${currentType}"`);
    
    setMixedMode(prev => ({ 
      ...prev, 
      currentType, 
      isLoading: false 
    }));

    try {
      if (isClip) {
        console.log('🎬 Mixed mode: Executing clip...');
        await executeMixedModeClip();
      } else {
        console.log('🖼️ Mixed mode: Executing slideshow...');
        await executeMixedModeSlideshow();
      }
    } catch (error) {
      console.error('❌ Error in mixed mode execution:', error);
      // Continue to next item after a short delay if there's an error
      if (forceExecute || currentMixedModeState?.shouldContinue) {
        console.log('🔄 Mixed mode: Scheduling next item after error...');
        scheduleNextMixedModeItem(2000);
      }
    }
  };

  const executeMixedModeClip = async () => {
    console.log('🎬 Mixed mode: Executing clip...');
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clip-play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Mixed mode clip started:', result);
        
        // Check if video format is supported
        const filePath = result.clip.scene.path;
        if (!isVideoFormatSupported(filePath)) {
          const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
          console.log(`🚫 Mixed mode: Unsupported video format: ${extension}, skipping to next...`);
          
          // Skip to next item immediately
          if (mixedMode.shouldContinue) {
            scheduleNextMixedModeItem(1000);
          }
          return;
        }
        
        // Update selected scene to show what's playing
        setSelectedScene({
          ...result.clip.scene,
          clipInfo: {
            clipIndex: result.clip.clipIndex + 1,
            startTime: result.playbackInfo.startTime,
            endTime: result.playbackInfo.endTime,
            duration: result.playbackInfo.duration,
            unwatchedClipsRemaining: result.totalUnwatchedClips,
            mixedMode: true
          }
        });
        
        // Open full-screen video player
        setVideoPlayer({
          isOpen: true,
          clip: result.clip,
          scene: result.clip.scene,
          playbackInfo: result.playbackInfo
        });
        
        // Automatically enter fullscreen for mixed mode
        setTimeout(() => {
          const container = document.querySelector('.video-player-container');
          if (container && !document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
              console.log('Could not enter fullscreen for mixed mode video:', err);
            });
          }
        }, 100);
        
        // Set timeout to move to next item after the clip duration
        const timeout = setTimeout(() => {
          console.log('⏰ Mixed mode clip timeout fired - moving to next item');
          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
          // Check current state and continue if mixed mode is still active
          setMixedMode(current => {
            if (current.shouldContinue) {
              console.log('✅ Mixed mode: State allows continuation after clip, executing next item');
              executeNextMixedModeItem();
            } else {
              console.log('🛑 Mixed mode clip timeout cancelled - not continuing');
            }
            return { ...current, timeout: null };
          });
        }, result.playbackInfo.duration * 1000);
        
        console.log(`⏱️ Mixed mode clip timeout set for ${result.playbackInfo.duration} seconds`);
        setMixedMode(prev => ({ ...prev, timeout }));
        
      } else {
        console.error('Mixed mode clip failed:', result.error);
        // Continue to next item after a short delay
        if (mixedMode.shouldContinue) {
          scheduleNextMixedModeItem(2000);
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const executeMixedModeSlideshow = async () => {
    console.log('🖼️ Mixed mode: Executing slideshow for 60 seconds...');
    
    try {
      // Fetch random images for the slideshow
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/images/slideshow?count=50&includeGalleries=${slideshow.includeGalleries}&includeStandalone=${slideshow.includeStandalone}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch images for mixed mode slideshow');
      }
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        console.log(`✅ Mixed mode slideshow: Loaded ${result.data.length} images`);
        
        setSlideshow(prev => ({
          ...prev,
          isOpen: true,
          images: result.data,
          currentIndex: 0,
          isLoading: false
        }));
        
        // Start the automatic progression
        startSlideshowInterval();
        
        // Automatically enter fullscreen for mixed mode slideshow
        setTimeout(() => {
          const container = document.querySelector('.slideshow-modal');
          if (container && !document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
              console.log('Could not enter fullscreen for mixed mode slideshow:', err);
            });
          }
        }, 100);
        
        // Set timeout to stop slideshow after 60 seconds and move to next item
        const timeout = setTimeout(() => {
          console.log('⏰ Mixed mode slideshow timeout fired - moving to next item');
          stopSlideshow();
          // Check current state and continue if mixed mode is still active
          setMixedMode(current => {
            if (current.shouldContinue) {
              console.log('✅ Mixed mode: State allows continuation after slideshow, executing next item');
              executeNextMixedModeItem();
            } else {
              console.log('🛑 Mixed mode slideshow timeout cancelled - not continuing');
            }
            return { ...current, timeout: null };
          });
        }, 60000); // 60 seconds
        
        console.log('⏱️ Mixed mode slideshow timeout set for 60 seconds');
        setMixedMode(prev => ({ ...prev, timeout }));
        
      } else {
        throw new Error('No images available for mixed mode slideshow');
      }
    } catch (error) {
      throw error;
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      setVideoPlayerFullscreen(isFullscreen);
      
      // Update slideshow fullscreen state if slideshow is open
      if (slideshow.isOpen) {
        setSlideshow(prev => ({ ...prev, isFullscreen }));
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (videoPlayerControlsTimeout) {
        clearTimeout(videoPlayerControlsTimeout);
      }
    };
  }, [videoPlayerControlsTimeout]);

  // Helper function to extract filename from path without extension
  const getFileNameFromPath = (path) => {
    if (!path) return null;
    
    // Extract filename from path (handle both forward and back slashes)
    const fileName = path.split(/[/\\]/).pop();
    if (!fileName) return null;
    
    // Remove file extension
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName; // No extension
    
    return fileName.substring(0, lastDotIndex);
  };

  // Helper function to get display title for a scene
  const getSceneDisplayTitle = (scene) => {
    if (!scene) return 'Untitled Scene';
    
    // If scene has a title, use it
    if (scene.title && scene.title.trim()) {
      return scene.title;
    }
    
    // If no title but has details, use details
    if (scene.details && scene.details.trim()) {
      return scene.details;
    }
    
    // If no title or details, try to extract filename from path
    const fileName = getFileNameFromPath(scene.path);
    if (fileName) {
      return fileName;
    }
    
    // Fallback to default
    return 'Untitled Scene';
  };

  // Load selected scene from localStorage on mount
  useEffect(() => {
    const savedScene = localStorage.getItem('stash-selected-scene');
    if (savedScene) {
      try {
        const parsedScene = JSON.parse(savedScene);
        setSelectedScene(parsedScene);
        console.log('Restored selected scene from localStorage:', parsedScene);
      } catch (error) {
        console.warn('Failed to parse saved scene from localStorage:', error);
        localStorage.removeItem('stash-selected-scene');
      }
    }
  }, []);

  // Save selected scene to localStorage whenever it changes
  useEffect(() => {
    if (selectedScene) {
      localStorage.setItem('stash-selected-scene', JSON.stringify(selectedScene));
      console.log('Saved selected scene to localStorage:', selectedScene);
    }
  }, [selectedScene]);

  // Test Stash connection on component mount
  useEffect(() => {
    testConnection();
  }, []);

  // Load data when tab changes or page changes
  useEffect(() => {
    if (connectionStatus.connected && mainTab === 'library') {
      loadData();
    }
  }, [libraryTab, currentPage, sortBy, sortDirection, watchStatusFilter, connectionStatus.connected, mainTab]);

  // Keyboard controls for video player
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!videoPlayer.isOpen) return;

      switch (e.key) {
        case 'Escape':
          // Close video player
          const video = document.querySelector('.clip-video-player');
          if (video && video.clipTimer) {
            clearTimeout(video.clipTimer);
            video.clipTimer = null;
            console.log('🧹 Cleaned up clip timer on ESC key');
          }
          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
          setAutoSkipRetries(0);
          break;
        case 'n':
        case 'N':
        case 'ArrowRight':
          // Next clip (simulate click on next button)
          document.querySelector('.next-clip-btn')?.click();
          break;
        case ' ':
          // Space bar - play/pause video
          e.preventDefault();
          const videoEl = document.querySelector('.clip-video-player');
          if (videoEl) {
            if (videoEl.paused) {
              videoEl.play();
            } else {
              videoEl.pause();
            }
          }
          break;
        case 'f':
        case 'F':
          // Toggle native browser fullscreen
          const videoElement = document.querySelector('.clip-video-player');
          if (videoElement) {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              videoElement.requestFullscreen().catch(err => {
                console.log('Fullscreen not supported:', err);
              });
            }
          }
          break;
      }
    };

    if (videoPlayer.isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [videoPlayer.isOpen]);

  const testConnection = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/test`);
      const result = await response.json();
      
      setConnectionStatus({
        configured: result.configured || false,
        connected: result.success || false,
        message: result.message || 'Unknown status',
        version: result.version || null,
        stashUrl: result.url || null,  // Backend returns 'url', not 'stashUrl'
        apiKey: result.apiKey || null
      });
    } catch (error) {
      console.error('Failed to test Stash connection:', error);
      setConnectionStatus({
        configured: false,
        connected: false,
        message: 'Failed to test connection',
        stashUrl: null,
        apiKey: null
      });
    }
  };

  const loadData = async () => {
    if (!connectionStatus.connected) return;
    
    setIsLoading(true);
    try {
      let url = '';
      const params = new URLSearchParams({
        page: currentPage,
        perPage: 20
      });

      if (libraryTab === 'scenes') {
        params.append('sort', sortBy);
        params.append('direction', sortDirection);
      }

      if (libraryTab === 'clips') {
        params.append('sortBy', sortBy);
        params.append('sortDirection', sortDirection);
        if (watchStatusFilter !== 'all') {
          params.append('watched', watchStatusFilter);
        }
      }

      if (searchQuery.trim()) {
        params.append('filter', searchQuery.trim());
      }

      switch (libraryTab) {
        case 'scenes':
          url = `${config.apiBaseUrl}/api/stash/scenes?${params}`;
          break;
        case 'performers':
          url = `${config.apiBaseUrl}/api/stash/performers?${params}`;
          break;
        case 'studios':
          url = `${config.apiBaseUrl}/api/stash/studios?${params}`;
          break;
        case 'tags':
          url = `${config.apiBaseUrl}/api/stash/tags?${params}`;
          break;
        case 'clips':
          url = `${config.apiBaseUrl}/api/stash/clips?${params}`;
          break;
        default:
          return;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (result.success || result.data || result.clips) {
        let items = [];
        
        if (libraryTab === 'clips') {
          items = result.clips || [];
        } else {
          items = result.data || result.scenes || result.performers || result.studios || result.tags || [];
        }
        
        setData(prev => ({
          ...prev,
          [libraryTab]: items
        }));

        setPagination(prev => ({
          ...prev,
          [libraryTab]: {
            total: result.total || result.pagination?.totalItems || items.length,
            hasMore: result.hasMore || result.pagination?.hasMore || items.length === 20
          }
        }));
      }
    } catch (error) {
      console.error(`Failed to load ${libraryTab}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadData();
  };

  // Utility function to format time in seconds to MM:SS format
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to check if video format is supported by browsers
  const isVideoFormatSupported = (filePath) => {
    if (!filePath) return true; // Assume supported if no path provided
    
    const extension = filePath.split('.').pop()?.toLowerCase();
    const unsupportedFormats = ['wmv', 'asf', 'avi', 'flv', 'divx'];
    const supportedFormats = ['mp4', 'webm', 'ogg', 'm4v'];
    const partiallySupported = ['mov', 'mkv']; // May work depending on codec and browser
    
    // Check if explicitly unsupported
    if (unsupportedFormats.includes(extension)) {
      return false;
    }
    
    // Check if explicitly supported
    if (supportedFormats.includes(extension)) {
      return true;
    }
    
    // For partially supported and unknown formats, let the browser try
    // The error handler will catch format errors if they occur
    return true;
  };

  // Play a specific clip
  const playClip = async (clip) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/${clip.id}/play`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Playing clip:', result);
        
        // Open the video player modal with the clip
        setSelectedVideo({
          id: clip.sceneId,
          title: clip.scene?.title || 'Unknown Scene',
          streamUrl: result.streamUrl,
          clipId: clip.id,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration
        });
        setShowVideo(true);
      } else {
        console.error('Failed to play clip');
      }
    } catch (error) {
      console.error('Error playing clip:', error);
    }
  };

  // Mark a clip as watched
  const markClipWatched = async (clipId) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/${clipId}/watched`, {
        method: 'POST'
      });
      
      if (response.ok) {
        console.log('Clip marked as watched');
        // Reload the clips data to update the UI
        if (libraryTab === 'clips') {
          loadData();
        }
      } else {
        console.error('Failed to mark clip as watched');
      }
    } catch (error) {
      console.error('Error marking clip as watched:', error);
    }
  };

  const handleLibraryTabChange = (tab) => {
    setLibraryTab(tab);
    setCurrentPage(1);
    
    // Set appropriate default sort values for each tab
    if (tab === 'clips') {
      setSortBy('createdAt');
      setSortDirection('desc');
    } else if (tab === 'scenes') {
      setSortBy('date');
      setSortDirection('DESC');
    } else {
      setSortBy('date');
      setSortDirection('DESC');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Helper function to build the stream URL
  const getStreamUrl = (sceneId) => {
    if (!connectionStatus.stashUrl || !sceneId) return null;
    const baseUrl = connectionStatus.stashUrl.endsWith('/') 
      ? connectionStatus.stashUrl.slice(0, -1) 
      : connectionStatus.stashUrl;
    
    // Use streaming endpoint without .m3u8 extension
    return `${baseUrl}/scene/${sceneId}/stream`;
  };

  // Helper function to build the scene image URL
  // Load persisted state on component mount
  useEffect(() => {
    try {
      const savedSelectedScene = localStorage.getItem('stash-selectedScene');
      const savedMainTab = localStorage.getItem('stash-mainTab');
      
      if (savedSelectedScene) {
        const parsedScene = JSON.parse(savedSelectedScene);
        setSelectedScene(parsedScene);
      }
      
      if (savedMainTab) {
        setMainTab(savedMainTab);
      }
    } catch (error) {
      console.warn('Failed to load persisted Stash state:', error);
    }
  }, []);

  // Persist selected scene when it changes
  useEffect(() => {
    try {
      if (selectedScene) {
        localStorage.setItem('stash-selectedScene', JSON.stringify(selectedScene));
      } else {
        localStorage.removeItem('stash-selectedScene');
      }
    } catch (error) {
      console.warn('Failed to persist selected scene:', error);
    }
  }, [selectedScene]);

  // Load stats when stats tab is active
  useEffect(() => {
    if (mainTab === 'stats' && connectionStatus.connected) {
      loadStats();
    }
  }, [mainTab, connectionStatus.connected]);

  // Function to load statistics
  const loadStats = async () => {
    setStats(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/stats`);
      const result = await response.json();
      
      if (result.success) {
        setStats(prev => ({
          ...prev,
          scenes: result.stats.scenes,
          performers: result.stats.performers,
          studios: result.stats.studios,
          topPerformers: result.stats.topPerformers || [],
          topStudios: result.stats.topStudios || [],
          lastUpdated: result.stats.lastUpdated,
          loading: false,
          error: null
        }));
      } else {
        setStats(prev => ({
          ...prev,
          loading: false,
          error: result.message || 'Failed to load stats'
        }));
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // Persist main tab when it changes
  useEffect(() => {
    try {
      localStorage.setItem('stash-mainTab', mainTab);
    } catch (error) {
      console.warn('Failed to persist main tab:', error);
    }
  }, [mainTab]);

  // Handle slideshow keyboard events and cleanup
  useEffect(() => {
    if (slideshow.isOpen) {
      const handleKeyDown = (event) => {
        handleSlideshowKeyDown(event);
      };

      // Focus the slideshow modal for keyboard events
      const slideshowModal = document.querySelector('.slideshow-modal');
      if (slideshowModal) {
        slideshowModal.focus();
      }

      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [slideshow.isOpen]);

  // Cleanup slideshow interval on component unmount
  useEffect(() => {
    return () => {
      if (slideshow.interval) {
        clearInterval(slideshow.interval);
      }
    };
  }, [slideshow.interval]);

  // Cleanup mixed mode timeout on component unmount
  useEffect(() => {
    return () => {
      if (mixedMode.timeout) {
        clearTimeout(mixedMode.timeout);
      }
    };
  }, [mixedMode.timeout]);

  const getSceneImageUrl = (scene) => {
    if (!scene) return null;
    
    // If scene has an image property (from our API), use that first
    if (scene.image) {
      // If it's already a full URL, return as-is
      if (scene.image.startsWith('http')) {
        return scene.image;
      }
      // If it's a relative path, build the full URL with our base
      return `${config.apiBaseUrl}${scene.image}`;
    }
    
    // If no stash URL available, can't build fallback URLs
    if (!connectionStatus.stashUrl) return null;
    
    const baseUrl = connectionStatus.stashUrl.endsWith('/') 
      ? connectionStatus.stashUrl.slice(0, -1) 
      : connectionStatus.stashUrl;
    
    // If scene has paths with screenshot, use that
    if (scene.paths && scene.paths.screenshot) {
      // If it's already a full URL, return as-is
      if (scene.paths.screenshot.startsWith('http')) {
        return scene.paths.screenshot;
      }
      // If it's a relative path, build the full URL
      return `${baseUrl}${scene.paths.screenshot}`;
    }
    
    // Fallback to standard screenshot endpoint
    return `${baseUrl}/scene/${scene.id}/screenshot`;
  };

  // Handle play button click
  const handlePlayScene = async (scene) => {
    console.log('🎬 Playing scene in browser:', scene.title || scene.id);
    
    // Create a simple video element and play the HLS stream
    const streamUrl = getStreamUrl(scene.id);
    
    if (!streamUrl) {
      alert('Unable to get stream URL for this scene');
      return;
    }
    
    // Create a new window/tab with a video player
    const videoWindow = window.open('', '_blank', 'width=800,height=600');
    videoWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Playing: ${getSceneDisplayTitle(scene)}</title>
          <style>
            body { margin: 0; padding: 20px; background: #000; font-family: Arial, sans-serif; }
            h1 { color: white; margin-bottom: 20px; }
            video { width: 100%; max-width: 100%; height: auto; }
            .info { color: white; margin-top: 10px; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>🎬 ${getSceneDisplayTitle(scene)}</h1>
          <video controls autoplay>
            <source src="${streamUrl}" type="application/x-mpegURL">
            <source src="${streamUrl}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
          <div class="info">
            <p><strong>Duration:</strong> ${scene.duration ? Math.floor(scene.duration / 60) + ':' + String(Math.floor(scene.duration % 60)).padStart(2, '0') : 'Unknown'}</p>
            <p><strong>Studio:</strong> ${scene.studio?.name || 'Unknown'}</p>
            <p><strong>Performers:</strong> ${scene.performers?.map(p => p.name).join(', ') || 'Unknown'}</p>
          </div>
          <script>
            // Try to load HLS.js for better HLS support if available
            if (Hls.isSupported && Hls.isSupported()) {
              var video = document.querySelector('video');
              var hls = new Hls();
              hls.loadSource('${streamUrl}');
              hls.attachMedia(video);
            }
          </script>
          <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
        </body>
      </html>
    `);
    
    console.log('🎥 Opened video player in new window with stream URL:', streamUrl);
  };

  // Handle pause button click
  const handlePauseScene = async (scene) => {
    console.log('⏸️ Pause functionality - use video controls in the player window');
    alert('Use the video controls in the player window to pause/resume the video');
  };

  // Handle stop button click
  const handleStopScene = async (scene) => {
    console.log('⏹️ Stop functionality - close the video player window');
    alert('Close the video player window to stop playback');
  };

  // Close modal
  const closeModal = () => {
    setModal({
      isOpen: false,
      action: null,
      scene: null,
      data: null
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, scene: null, deleteFile: false });
  };

  const openPerformerImageModal = (performer) => {
    setPerformerImageModal({
      isOpen: true,
      performer: performer
    });
  };

  const closePerformerImageModal = () => {
    setPerformerImageModal({
      isOpen: false,
      performer: null
    });
  };

  // Send command to Android companion app
  const sendCommandToAndroidApp = async (commandData, actionName) => {
    try {
      console.log(`Sending ${actionName} command to Android app:`, commandData);
      
      const response = await fetch(`${config.apiBaseUrl}/api/android/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commandData)
      });

      if (response.ok) {
        console.log(`${actionName} command sent successfully to Android app`);
      } else {
        console.error(`Failed to send ${actionName} command: HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Failed to send ${actionName} command to Android app:`, error);
    }
  };

  // Legacy function for modal (if needed elsewhere)
  const sendToAndroidApp = async () => {
    await sendCommandToAndroidApp(modal.data, modal.action);
    closeModal();
  };

  const handleSync = async () => {
    setSyncStatus(prev => ({ ...prev, isRunning: true, message: 'Starting sync...' }));
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSyncStatus({
          isRunning: false,
          lastSync: new Date(),
          message: `Sync completed: ${result.results.scenes} scenes, ${result.results.performers} performers, ${result.results.studios} studios, ${result.results.tags} tags`
        });
        
        // Reload current tab data
        loadData();
      } else {
        setSyncStatus({
          isRunning: false,
          lastSync: null,
          message: `Sync failed: ${result.message}`
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus({
        isRunning: false,
        lastSync: null,
        message: `Sync failed: ${error.message}`
      });
    }
  };

  // Handle "Get Up Next" for random Stash scene
  const handleGetUpNext = async () => {
    setUpNextLoading(true);
    try {
      console.log('🎲 Getting random unwatched scene...');
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/next`);
      const result = await response.json();
      
      console.log('Next scene API response:', result);
      
      if (result.success && result.scene) {
        console.log(`🎯 Selected unwatched scene: ${result.scene.title} (${result.totalUnwatched} total unwatched)`);
        
        // Store the selected scene
        setSelectedScene(result.scene);
        
        // Show info about the selection
        console.log(`📊 ${result.message}`);
      } else {
        console.log('No unwatched scenes available:', result.message);
        alert(result.message || 'No unwatched scenes available');
      }
    } catch (error) {
      console.error('Failed to get up next:', error);
      alert('Failed to get a random unwatched scene');
    } finally {
      setUpNextLoading(false);
    }
  };

  // Handle mark Stash scene as watched
  const handleMarkStashWatched = async (scene) => {
    setMarkingWatched(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/watched`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update the selected scene to reflect watched status
        setSelectedScene(prev => ({
          ...prev,
          playCount: (prev.playCount || 0) + 1,
          lastPlayedAt: new Date().toISOString()
        }));
        console.log('Scene marked as watched successfully');
      } else {
        console.error('Failed to mark scene as watched');
      }
    } catch (error) {
      console.error('Error marking scene as watched:', error);
    } finally {
      setMarkingWatched(false);
    }
  };

  // Handle delete Stash scene
  const handleDeleteStashScene = (scene) => {
    setDeleteModal({
      isOpen: true,
      scene: scene,
      deleteFile: false
    });
  };

  const confirmDeleteStashScene = async (deleteFile = false) => {
    if (!deleteModal.scene) return;

    const scene = deleteModal.scene;
    setDeletingScene(true);
    setDeleteModal({ isOpen: false, scene: null, deleteFile: false });
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}?deleteFile=${deleteFile}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('Scene deleted successfully:', result);
        
        // Clear the selected scene since it's been deleted
        setSelectedScene(null);
        
        // Reload the scenes list to reflect the deletion
        if (libraryTab === 'scenes') {
          loadData();
        }
        
        alert('Scene deleted successfully!');
      } else {
        console.error('Failed to delete scene:', result);
        alert(`Failed to delete scene: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting scene:', error);
      alert(`Error deleting scene: ${error.message}`);
    } finally {
      setDeletingScene(false);
    }
  };

  const renderConnectionStatus = () => {
    if (!connectionStatus.configured) {
      return (
        <div className="connection-status warning">
          <div className="status-icon">⚠️</div>
          <div className="status-content">
            <h3>Stash Not Configured</h3>
            <p>Please configure Stash URL and API key in Settings to use this feature.</p>
          </div>
        </div>
      );
    }

    if (!connectionStatus.connected) {
      return (
        <div className="connection-status error">
          <div className="status-icon">❌</div>
          <div className="status-content">
            <h3>Stash Connection Failed</h3>
            <p>{connectionStatus.message}</p>
            <Button onClick={testConnection} className="retry-button">
              Test Connection
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="connection-status success">
        <div className="status-icon">✅</div>
        <div className="status-content">
          <h3>Stash Connected</h3>
          <p>
            {connectionStatus.message}
            {connectionStatus.version && ` (Version: ${connectionStatus.version})`}
          </p>
        </div>
      </div>
    );
  };

  const renderScenes = () => {
    const scenes = data.scenes || [];
    
    return (
      <div className="content-grid scenes-grid">
        {scenes.map((scene) => (
          <div key={scene.id} className="content-card scene-card">
            {getSceneImageUrl(scene) && (
              <div className="scene-thumbnail">
                <img
                  src={getSceneImageUrl(scene)}
                  alt={getSceneDisplayTitle(scene)}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="duration-badge">
                  {formatDuration(scene.duration)}
                </div>
              </div>
            )}
            
            <div className="content-card-body">
              <h3 className="content-title">
                {getSceneDisplayTitle(scene)}
              </h3>
              
              <div className="content-meta">
                {scene.date && (
                  <div className="meta-item">
                    <span className="meta-icon">📅</span>
                    <span>{formatDate(scene.date)}</span>
                  </div>
                )}
                
                {scene.rating && (
                  <div className="meta-item">
                    <span className="meta-icon">⭐</span>
                    <span>{scene.rating}/5</span>
                  </div>
                )}
                
                {scene.performers && scene.performers.length > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">👤</span>
                    <span className="meta-text">
                      {scene.performers.map(p => p.name).join(', ')}
                    </span>
                  </div>
                )}
                
                {scene.studio && (
                  <div className="meta-item">
                    <span className="meta-icon">🏢</span>
                    <span className="meta-text">{scene.studio.name}</span>
                  </div>
                )}
                
                {scene.playCount > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">▶️</span>
                    <span className="meta-text">
                      Played {scene.playCount} time{scene.playCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {scene.lastPlayedAt && (
                  <div className="meta-item">
                    <span className="meta-icon">🕒</span>
                    <span className="meta-text">
                      Last: {formatDate(scene.lastPlayedAt)}
                    </span>
                  </div>
                )}
                
                {scene.resumeTime > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">⏸️</span>
                    <span className="meta-text">
                      Resume: {formatDuration(scene.resumeTime)}
                    </span>
                  </div>
                )}
                
                {scene.playDuration > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">⏱️</span>
                    <span className="meta-text">
                      Watched: {formatDuration(scene.playDuration)}
                    </span>
                  </div>
                )}
                
                {scene.tags && scene.tags.length > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">🏷️</span>
                    <span className="meta-text">
                      {scene.tags.slice(0, 3).map(t => t.name).join(', ')}
                      {scene.tags.length > 3 && ` +${scene.tags.length - 3}`}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="content-actions">
                {scene.id && (
                  <div className="playback-buttons">
                    <Button
                      className="action-button play-button"
                      onClick={() => handlePlayScene(scene)}
                      disabled={!connectionStatus.stashUrl}
                    >
                      ▶️ Play
                    </Button>
                    <Button
                      className="action-button pause-button"
                      onClick={() => handlePauseScene(scene)}
                      disabled={!connectionStatus.stashUrl}
                    >
                      ⏸️ Pause
                    </Button>
                    <Button
                      className="action-button stop-button"
                      onClick={() => handleStopScene(scene)}
                      disabled={!connectionStatus.stashUrl}
                    >
                      ⏹️ Stop
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPerformers = () => {
    const performers = data.performers || [];
    
    return (
      <div className="content-grid performers-grid">
        {performers.map((performer) => (
          <div key={performer.id} className="content-card performer-card">
            <div className="performer-image">
              {performer.image ? (
                <img
                  src={performer.image}
                  alt={performer.name}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <div className="performer-placeholder">
                  <span>👤</span>
                </div>
              )}
              {performer.image && (
                <div className="performer-placeholder" style={{display: 'none'}}>
                  <span>👤</span>
                </div>
              )}
            </div>
            
            <div className="content-card-body">
              <h3 className="content-title">{performer.name}</h3>
              
              <div className="content-meta">
                {performer.birthdate && (
                  <div className="meta-item">
                    <span className="meta-icon">🎂</span>
                    <span>Born: {formatDate(performer.birthdate)}</span>
                  </div>
                )}
                
                {performer.country && (
                  <div className="meta-item">
                    <span className="meta-icon">🌍</span>
                    <span>{performer.country}</span>
                  </div>
                )}
                
                {performer.scene_count && (
                  <div className="meta-item">
                    <span className="meta-icon">🎬</span>
                    <span>{performer.scene_count} scenes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStudios = () => {
    const studios = data.studios || [];
    
    return (
      <div className="content-grid studios-grid">
        {studios.map((studio) => (
          <div key={studio.id} className="content-card studio-card">
            <div className="studio-image">
              {studio.image ? (
                <img
                  src={studio.image}
                  alt={studio.name}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <div className="studio-placeholder">
                  <span>🏢</span>
                </div>
              )}
              {studio.image && (
                <div className="studio-placeholder" style={{display: 'none'}}>
                  <span>🏢</span>
                </div>
              )}
            </div>
            
            <div className="content-card-body">
              <div className="studio-header">
                <h3 className="content-title">{studio.name}</h3>
              </div>
              
              <div className="content-meta">
                {studio.scene_count && (
                  <div className="meta-item">
                    <span className="meta-icon">🎬</span>
                    <span>{studio.scene_count} scenes</span>
                  </div>
                )}
                
                {studio.url && (
                  <div className="content-actions">
                    <Button
                      className="action-button"
                      onClick={() => window.open(studio.url, '_blank')}
                    >
                      🔗 Website
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTags = () => {
    const tags = data.tags || [];
    
    return (
      <div className="content-grid tags-grid">
        {tags.map((tag) => (
          <div key={tag.id} className="content-card tag-card">
            <div className="content-card-body">
              <h3 className="content-title">{tag.name}</h3>
              
              {tag.scene_count && (
                <div className="content-meta">
                  <div className="meta-item">
                    <span className="meta-icon">🎬</span>
                    <span>{tag.scene_count} scenes</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderClips = () => {
    const clips = data.clips || [];
    
    return (
      <div className="content-grid clips-grid">
        {clips.map((clip) => (
          <div key={clip.id} className="content-card clip-card">
            <div className="clip-thumbnail-container">
              <div className="clip-placeholder">
                🎬
              </div>
              <div className="clip-duration-badge">
                {Math.round(clip.duration)}s
              </div>
              <div className={`clip-watch-status ${clip.watched ? 'watched' : 'unwatched'}`}>
                {clip.watched ? '✅' : '⏳'}
              </div>
            </div>
            
            <div className="content-card-body">
              <h3 className="content-title">{clip.scene?.title || 'Unknown Scene'}</h3>
              
              <div className="clip-info">
                <div className="clip-timing">
                  {clip.markerBased && clip.title ? (
                    <span className="clip-marker-title">📍 {clip.title}</span>
                  ) : (
                    <span className="clip-index">Clip #{clip.clipIndex + 1}</span>
                  )}
                  <span className="clip-time-range">
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                  </span>
                </div>
                
                {clip.scene?.performers && clip.scene.performers.length > 0 && (
                  <div className="clip-performers">
                    <span className="meta-icon">👥</span>
                    <span>{clip.scene.performers.map(p => p.performer.name).join(', ')}</span>
                  </div>
                )}
                
                {clip.scene?.studioObject && (
                  <div className="clip-studio">
                    <span className="meta-icon">🏢</span>
                    <span>{clip.scene.studioObject.name}</span>
                  </div>
                )}
              </div>
              
              <div className="clip-actions">
                <button 
                  className="clip-play-btn"
                  onClick={() => playClip(clip)}
                >
                  ▶️ Play Clip
                </button>
                
                {!clip.watched && (
                  <button 
                    className="clip-mark-watched-btn"
                    onClick={() => markClipWatched(clip.id)}
                  >
                    ✅ Mark Watched
                  </button>
                )}
                
                {clip.watched && (
                  <div className="clip-watched-info">
                    <span>✅ Watched</span>
                    {clip.watchedAt && (
                      <span className="clip-watched-date">
                        {new Date(clip.watchedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (!connectionStatus.connected) {
      return null;
    }

    if (isLoading && currentPage === 1) {
      return (
        <div className="loading-container">
          <div className="loading-spinner">⏳</div>
          <span>Loading {libraryTab}...</span>
        </div>
      );
    }

    switch (libraryTab) {
      case 'scenes':
        return renderScenes();
      case 'performers':
        return renderPerformers();
      case 'studios':
        return renderStudios();
      case 'tags':
        return renderTags();
      case 'clips':
        return renderClips();
      default:
        return null;
    }
  };

  const tabLabels = {
    scenes: '🎬 Scenes',
    performers: '👤 Performers',
    studios: '🏢 Studios',
    tags: '🏷️ Tags',
    clips: '🎞️ Clips'
  };

  // Handle Clip Play - get random clip and start playing
  const handleClipPlay = async () => {
    setUpNextLoading(true);
    try {
      console.log('🎬 Starting Clip Play...');
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clip-play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Clip Play started:', result);
        console.log(`🎯 Playing clip ${result.clip.clipIndex + 1} from: ${result.clip.scene.title}`);
        console.log(`⏱️ Clip duration: ${result.playbackInfo.duration}s (${Math.floor(result.playbackInfo.startTime / 60)}:${String(Math.floor(result.playbackInfo.startTime % 60)).padStart(2, '0')} - ${Math.floor(result.playbackInfo.endTime / 60)}:${String(Math.floor(result.playbackInfo.endTime % 60)).padStart(2, '0')})`);
        
        // Check if video format is supported before opening player
        const filePath = result.clip.scene.path;
        
        if (!isVideoFormatSupported(filePath)) {
          const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
          console.error(`🚫 Initial clip: Unsupported video format: ${extension}`);
          
          alert(`⚠️ Unsupported Video Format\n\nThe selected clip file "${filePath}" is in ${extension} format, which is not supported by modern browsers.\n\nSupported formats: MP4, WebM, OGG, M4V\nPartially supported: MOV, MKV\nNot supported: WMV, AVI, FLV, DIVX\n\nPlease convert the file to a supported format (MP4 recommended) or try again to get a different clip.`);
          
          setUpNextLoading(false);
          return;
        }
        
        // Update selected scene to show what's playing
        setSelectedScene({
          ...result.clip.scene,
          clipInfo: {
            clipIndex: result.clip.clipIndex + 1,
            startTime: result.playbackInfo.startTime,
            endTime: result.playbackInfo.endTime,
            duration: result.playbackInfo.duration,
            unwatchedClipsRemaining: result.totalUnwatchedClips
          }
        });
        
        // Open full-screen video player
        setVideoPlayer({
          isOpen: true,
          clip: result.clip,
          scene: result.clip.scene,
          playbackInfo: result.playbackInfo
        });
        
      } else {
        console.error('Clip Play failed:', result.error);
        alert(`❌ Clip Play failed: ${result.error}\n💡 ${result.suggestion || 'Try generating clips for more scenes first'}`);
      }
      
    } catch (error) {
      console.error('Error in Clip Play:', error);
      alert('❌ Failed to start Clip Play');
    } finally {
      setUpNextLoading(false);
    }
  };

  return (
    <div className="stash-page">
      {/* Enhanced Full-Screen Video Player */}
      {videoPlayer.isOpen && (
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
                {videoPlayer.playbackInfo ? (
                  <>
                    <p>Clip {videoPlayer.clip.clipIndex + 1} • {Math.floor(videoPlayer.playbackInfo.startTime / 60)}:{String(Math.floor(videoPlayer.playbackInfo.startTime % 60)).padStart(2, '0')} - {Math.floor(videoPlayer.playbackInfo.endTime / 60)}:{String(Math.floor(videoPlayer.playbackInfo.endTime % 60)).padStart(2, '0')}</p>
                    <p className="keyboard-shortcuts">ESC: Close • Space: Play/Pause • N/→: Next • F: Fullscreen • Click: Hide Controls</p>
                  </>
                ) : (
                  <p>Loading clip info...</p>
                )}
              </div>
              <div className="video-player-controls">
                <button 
                  className="fullscreen-btn"
                  onClick={toggleVideoFullscreen}
                  title="Toggle fullscreen (F)"
                >
                  {videoPlayerFullscreen ? '🪟' : '⛶'}
                </button>
                <button 
                  className="next-clip-btn"
                  onClick={async () => {
                    console.log('⏭️ Manual next clip requested');
                    
                    // Clean up current timer
                    const video = document.querySelector('.clip-video-player');
                    if (video && video.clipTimer) {
                      clearTimeout(video.clipTimer);
                      video.clipTimer = null;
                    }
                    
                    try {
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
                            
                            // Try to get a different clip
                            console.log('🔄 Attempting to fetch a different clip...');
                            return; // Exit early, don't open the player
                          }
                          
                          console.log('🎯 Manually loaded next clip:', result.clip.scene.title);
                          console.log('📊 Manual new clip data:', {
                            clipId: result.clip.id,
                            sceneTitle: result.clip.scene.title,
                            startTime: result.playbackInfo.startTime,
                            endTime: result.playbackInfo.endTime,
                            duration: result.playbackInfo.duration
                          });
                          
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
                  }}
                  title="Load next random clip"
                >
                  ⏭️ Next
                </button>
                <button 
                  className="close-player-btn"
                  onClick={() => {
                    // Clean up timer before closing
                    const video = document.querySelector('.clip-video-player');
                    if (video && video.clipTimer) {
                      clearTimeout(video.clipTimer);
                      video.clipTimer = null;
                      console.log('🧹 Cleaned up clip timer on close');
                    }
                    setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                    setAutoSkipRetries(0); // Reset retry counter when manually closing
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            {videoPlayer.playbackInfo ? (
              <video
                src={(() => {
                  // Use the stream URL provided by the backend, only if playbackInfo exists
                  if (!videoPlayer.playbackInfo) {
                    console.log('⚠️ No playback info available yet');
                    return '';
                  }
                  
                  const backendStreamUrl = videoPlayer.playbackInfo.streamUrl;
                  console.log('🎥 Using backend-provided stream URL:', backendStreamUrl);
                  console.log('📊 Scene data:', videoPlayer.scene);
                  
                  return backendStreamUrl;
                })()}
                controls
                className={`clip-video-player ${videoPlayerFullscreen ? 'fullscreen-video' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle controls visibility on video click
                  setVideoPlayerControlsVisible(!videoPlayerControlsVisible);
                }}
                onLoadedMetadata={(e) => {
                  // Only proceed if playbackInfo is available
                  if (!videoPlayer.playbackInfo) {
                    console.log('⚠️ No playback info in onLoadedMetadata');
                    return;
                  }
                  
                  console.log('📺 Video loaded, duration:', e.target.duration);
                  console.log('⏰ Setting start time to:', videoPlayer.playbackInfo.startTime);
                  console.log('⏰ End time should be:', videoPlayer.playbackInfo.endTime);
                  console.log('⏰ Clip duration:', videoPlayer.playbackInfo.duration);
                  
                  // Set video to start at clip start time
                  try {
                    e.target.currentTime = videoPlayer.playbackInfo.startTime;
                    console.log('✅ Successfully set start time');
                    
                    // Now start playing after timing is set
                    e.target.play().then(() => {
                      console.log('▶️ Video started playing at correct time');
                    }).catch(error => {
                      console.error('❌ Failed to start playback:', error);
                    });
                  } catch (error) {
                    console.error('❌ Failed to set start time:', error);
                  }
                  
                  // Backup timer to ensure clip stops after the actual clip duration
                  // Skip backup timer if mixed mode is active (mixed mode handles its own flow)
                  if (!mixedMode.isActive) {
                    const clipDurationMs = videoPlayer.playbackInfo.duration * 1000; // Convert to milliseconds
                    const clipTimer = setTimeout(async () => {
                      console.log(`⏰ Backup timer: Stopping video after ${videoPlayer.playbackInfo.duration} seconds of playback - loading next clip`);
                      e.target.pause();
                      
                      // Load next clip after backup timer expires
                      try {
                        console.log('🔄 Fetching next clip from API...');
                        const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
                        const result = await response.json();
                        
                        console.log('📡 API Response status:', response.status);
                        console.log('📦 API Response data:', result);
                        
                        if (response.ok) {
                          if (result.clip && result.clip.scene) {
                            // Check if video format is supported before opening player
                            const filePath = result.clip.scene.path;
                            
                            if (!isVideoFormatSupported(filePath)) {
                              const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
                              console.error(`🚫 Backup timer: Unsupported video format: ${extension}`);
                              
                              // Close player instead of showing unsupported format
                              setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                              return;
                            }
                            
                            console.log('🎯 Auto-loaded next clip via backup timer:', result.clip.scene.title);
                            console.log('📊 New clip data:', {
                              clipId: result.clip.id,
                              sceneTitle: result.clip.scene.title,
                              startTime: result.playbackInfo.startTime,
                              endTime: result.playbackInfo.endTime,
                              duration: result.playbackInfo.duration
                            });
                            
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
                        } else {
                          console.error('Failed to load next clip via backup timer:', result.error);
                          // Close player if no more clips available
                          setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                        }
                      } catch (error) {
                        console.error('Error loading next clip via backup timer:', error);
                        // Close player on error
                        setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                      }
                    }, clipDurationMs);
                    
                    // Store timer reference for cleanup
                    e.target.clipTimer = clipTimer;
                  } else {
                    console.log('🎭 Mixed mode active - skipping backup timer');
                  }
                }}
                onTimeUpdate={(e) => {
                  // Only proceed if playbackInfo is available
                  if (!videoPlayer.playbackInfo) {
                    return;
                  }
                  
                  // Calculate if we've watched the full clip
                  const currentTime = e.target.currentTime;
                  const clipStartTime = videoPlayer.playbackInfo.startTime;
                  const clipEndTime = videoPlayer.playbackInfo.endTime;
                  const playedDuration = currentTime - clipStartTime;
                  const clipDuration = videoPlayer.playbackInfo.duration;
                
                // Debug logging every 5 seconds
                if (Math.floor(currentTime) % 5 === 0) {
                  console.log(`⏱️ Current: ${currentTime.toFixed(1)}s, Clip Start: ${clipStartTime}s, Clip End: ${clipEndTime}s, Played: ${playedDuration.toFixed(1)}s/${clipDuration}s`);
                }
                
                // Stop video when we've reached the clip end time or played the full clip duration
                if (currentTime >= clipEndTime || playedDuration >= clipDuration) {
                  console.log('⏹️ Reached clip end, loading next clip');
                  console.log(`📊 Final stats: Current: ${currentTime.toFixed(1)}s, End: ${clipEndTime}s, Duration played: ${playedDuration.toFixed(1)}s/${clipDuration}s`);
                  e.target.pause();
                  
                  // Clear the backup timer
                  if (e.target.clipTimer) {
                    clearTimeout(e.target.clipTimer);
                    e.target.clipTimer = null;
                  }
                  
                  // Load next clip automatically
                  (async () => {
                    try {
                      console.log('🔄 TimeUpdate: fetching next clip from API...');
                      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
                      const result = await response.json();
                      
                      console.log('📡 TimeUpdate API Response status:', response.status);
                      console.log('📦 TimeUpdate API Response data:', result);
                      
                      if (response.ok) {
                        if (result.clip && result.clip.scene) {
                          // Check if video format is supported before opening player
                          const filePath = result.clip.scene.path;
                          
                          if (!isVideoFormatSupported(filePath)) {
                            const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
                            console.error(`🚫 TimeUpdate: Unsupported video format: ${extension}`);
                            
                            // Close player instead of showing unsupported format
                            setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                            return;
                          }
                          
                          console.log('🎯 Auto-loaded next clip via timeUpdate:', result.clip.scene.title);
                          console.log('📊 TimeUpdate new clip data:', {
                            clipId: result.clip.id,
                            sceneTitle: result.clip.scene.title,
                            startTime: result.playbackInfo.startTime,
                            endTime: result.playbackInfo.endTime,
                            duration: result.playbackInfo.duration
                          });
                          
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
                        // Close player if no more clips available
                        setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                      }
                    } catch (error) {
                      console.error('Error loading next clip via timeUpdate:', error);
                      // Close player on error
                      setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                    }
                  })();
                }
              }}
              onPause={() => {
                console.log('⏸️ Video paused');
              }}
              onEnded={async () => {
                console.log('🏁 Video ended - loading next clip...');
                // Clear timer if video ends naturally
                const video = document.querySelector('.clip-video-player');
                if (video && video.clipTimer) {
                  clearTimeout(video.clipTimer);
                  video.clipTimer = null;
                }
                
                // Automatically load next clip
                try {
                  console.log('🔄 OnEnded: fetching next clip from API...');
                  const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
                  const result = await response.json();
                  
                  console.log('📡 OnEnded API Response status:', response.status);
                  console.log('📦 OnEnded API Response data:', result);
                  
                  if (response.ok) {
                    if (result.clip && result.clip.scene) {
                      console.log('🎯 Auto-loaded next clip via onEnded:', result.clip.scene.title);
                      console.log('📊 OnEnded new clip data:', {
                        clipId: result.clip.id,
                        sceneTitle: result.clip.scene.title,
                        startTime: result.playbackInfo.startTime,
                        endTime: result.playbackInfo.endTime,
                        duration: result.playbackInfo.duration
                      });
                      
                      // Update video player with new clip
                      setVideoPlayer({
                        isOpen: true,
                        clip: result.clip,
                        scene: result.clip.scene,
                        playbackInfo: result.playbackInfo
                      });
                    } else {
                      console.error('❌ Invalid onEnded clip data received:', result);
                      setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                    }
                  } else {
                    console.error('Failed to load next clip via onEnded:', result.error);
                    // Close player if no more clips available
                    setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                  }
                } catch (error) {
                  console.error('Error loading next clip via onEnded:', error);
                  // Close player on error
                  setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
                }
              }}
              onError={async (e) => {
                const errorCode = e.target.error?.code;
                const errorMessage = e.target.error?.message;
                
                console.error('❌ Video error details:');
                console.error('   Code:', errorCode);
                console.error('   Message:', errorMessage);
                console.error('   Failed URL:', e.target.src);
                console.error('   Stash URL:', connectionStatus.stashUrl);
                console.error('   Auto-skip retries:', autoSkipRetries);
                
                // Error code meanings:
                // 1: MEDIA_ERR_ABORTED - The user aborted the video
                // 2: MEDIA_ERR_NETWORK - A network error occurred  
                // 3: MEDIA_ERR_DECODE - A decode error occurred
                // 4: MEDIA_ERR_SRC_NOT_SUPPORTED - The video format is not supported
                
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
                    // Try HLS stream format
                    nextUrl = `${baseUrl}/scene/${videoPlayer.scene.id}/stream.m3u8`;
                    console.log('� Direct stream failed, trying HLS:', nextUrl);
                  } else if (currentSrc.includes('.m3u8')) {
                    // Try direct file endpoint
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
                      // Check if the next video format is supported before switching
                      const filePath = result.clip.scene.path;
                      
                      if (!isVideoFormatSupported(filePath)) {
                        const extension = filePath?.split('.').pop()?.toUpperCase() || 'Unknown';
                        console.error(`🚫 Auto-skip: Next clip also has unsupported format: ${extension}`);
                        
                        // Recursively try the next clip
                        console.log('🔄 Auto-skipping again to find supported format...');
                        // Trigger another skip by calling this error handler again
                        setTimeout(() => {
                          if (videoPlayer.isOpen) {
                            e.target.dispatchEvent(new Event('error'));
                          }
                        }, 100);
                        return;
                      }
                      
                      console.log('🎯 Auto-skipped to next clip:', result.clip.scene.title);
                      console.log('� Auto-skip new clip data:', {
                        clipId: result.clip.id,
                        sceneTitle: result.clip.scene.title,
                        startTime: result.playbackInfo.startTime,
                        endTime: result.playbackInfo.endTime,
                        duration: result.playbackInfo.duration
                      });
                      
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
              }}
              onCanPlay={() => {
                console.log('✅ Video can play');
                setAutoSkipRetries(0); // Reset retry counter on successful video load
              }}
            >
              Your browser does not support the video tag.
            </video>
            ) : (
              <div className="video-loading">
                <p>⏳ Loading clip...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="main-tabs-section">
        <div className="main-tabs">
          <button
            className={`main-tab ${mainTab === 'upnext' ? 'active' : ''}`}
            onClick={() => setMainTab('upnext')}
          >
            🎲 Next Stash
          </button>
          <button
            className={`main-tab ${mainTab === 'library' ? 'active' : ''}`}
            onClick={() => setMainTab('library')}
          >
            📚 Library
          </button>
          <button
            className={`main-tab ${mainTab === 'stats' ? 'active' : ''}`}
            onClick={() => setMainTab('stats')}
          >
            📊 Stats
          </button>
        </div>
      </div>

      {mainTab === 'upnext' && (
            <div className="up-next-tab">
              {/* Up Next Content */}
              <div className="up-next-content">
                <div className="up-next-hero">
                  <div className="stash-controls">
                    <Button 
                      onClick={handleGetUpNext} 
                      disabled={upNextLoading || !connectionStatus.connected}
                      className={`up-next-main-button ${upNextLoading ? 'loading' : ''}`}
                    >
                      {upNextLoading ? '🎲 Getting...' : '🎲 Next Stash'}
                    </Button>
                    
                    <Button 
                      onClick={handleClipPlay} 
                      disabled={upNextLoading || !connectionStatus.connected}
                      className={`clip-play-button ${upNextLoading ? 'loading' : ''}`}
                      style={{ 
                        backgroundColor: '#e74c3c', 
                        color: '#fff',
                        marginLeft: '10px'
                      }}
                    >
                      {upNextLoading ? '🎬 Loading...' : '🎬 Clip Play'}
                    </Button>
                    
                    <Button 
                      onClick={startSlideshow} 
                      disabled={slideshow.isLoading || !connectionStatus.connected}
                      className={`slideshow-button ${slideshow.isLoading ? 'loading' : ''}`}
                      style={{ 
                        backgroundColor: '#9b59b6', 
                        color: '#fff',
                        marginLeft: '10px'
                      }}
                    >
                      {slideshow.isLoading ? '🖼️ Loading...' : '🖼️ Slideshow'}
                    </Button>
                    
                    <Button 
                      onClick={mixedMode.isActive ? stopMixedMode : startMixedMode} 
                      disabled={mixedMode.isLoading || !connectionStatus.connected}
                      className={`mixed-mode-button ${mixedMode.isLoading ? 'loading' : ''} ${mixedMode.isActive ? 'active' : ''}`}
                      style={{ 
                        backgroundColor: mixedMode.isActive ? '#e67e22' : '#34495e', 
                        color: '#fff',
                        marginLeft: '10px'
                      }}
                    >
                      {mixedMode.isLoading ? '🎭 Loading...' : mixedMode.isActive ? '🛑 Stop Mixed' : '🎭 Clips + Slideshow'}
                    </Button>
                    
                    {/* Mixed Mode Status */}
                    {mixedMode.isActive && (
                      <div className="mixed-mode-status" style={{
                        marginTop: '15px',
                        padding: '10px 15px',
                        backgroundColor: '#e67e22',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span>🎭</span>
                        <span>Mixed Mode Active</span>
                        <span style={{ opacity: 0.8 }}>
                          {mixedMode.currentType === 'clip' ? '(Currently: 🎬 Clip)' : 
                           mixedMode.currentType === 'slideshow' ? '(Currently: 🖼️ Slideshow)' : 
                           '(Selecting next...)'}
                        </span>
                      </div>
                    )}
                    
                    {selectedScene && (
                      <>
                        {/* Scene Title */}
                        <h3 className="selected-scene-title">
                          {getSceneDisplayTitle(selectedScene)}
                          {selectedScene.clipInfo && (
                            <span className="clip-info">
                              <br />
                              <small style={{ color: selectedScene.clipInfo.mixedMode ? '#e67e22' : '#e74c3c', fontWeight: 'normal' }}>
                                {selectedScene.clipInfo.mixedMode ? '🎭 Mixed Mode • ' : ''}
                                🎬 Clip {selectedScene.clipInfo.clipIndex} • 
                                {Math.floor(selectedScene.clipInfo.startTime / 60)}:{String(Math.floor(selectedScene.clipInfo.startTime % 60)).padStart(2, '0')} - 
                                {Math.floor(selectedScene.clipInfo.endTime / 60)}:{String(Math.floor(selectedScene.clipInfo.endTime % 60)).padStart(2, '0')} • 
                                {selectedScene.clipInfo.duration}s • 
                                {selectedScene.clipInfo.unwatchedClipsRemaining} clips left
                              </small>
                            </span>
                          )}
                        </h3>
                        
                        {/* Action Buttons */}
                        <div className="stash-action-buttons">
                          <Button
                            onClick={() => handleMarkStashWatched(selectedScene)}
                            disabled={markingWatched}
                            style={{ 
                              backgroundColor: '#28a745', 
                              color: '#fff',
                              minWidth: '40px',
                              padding: '8px 12px'
                            }}
                            title="Mark as Watched"
                          >
                            {markingWatched ? '⏳' : '✓'}
                          </Button>
                          
                          <Button
                            onClick={() => handlePlayScene(selectedScene)}
                            disabled={!connectionStatus.stashUrl}
                            style={{ 
                              backgroundColor: '#e5a00d', 
                              color: '#000',
                              minWidth: '40px',
                              padding: '8px 12px'
                            }}
                            title="Play Scene"
                          >
                            ▶️
                          </Button>
                          
                          <Button
                            onClick={() => handlePauseScene(selectedScene)}
                            disabled={!connectionStatus.stashUrl}
                            style={{ 
                              backgroundColor: '#f39c12', 
                              color: '#fff',
                              minWidth: '40px',
                              padding: '8px 12px'
                            }}
                            title="Pause Scene"
                          >
                            ⏸️
                          </Button>
                          
                          <Button
                            onClick={() => handleDeleteStashScene(selectedScene)}
                            disabled={deletingScene || !selectedScene}
                            style={{ 
                              backgroundColor: '#dc3545', 
                              color: '#fff',
                              minWidth: '40px',
                              padding: '8px 12px'
                            }}
                            title="Delete Scene (keeps video file)"
                          >
                            {deletingScene ? '⏳' : '🗑️'}
                          </Button>
                        </div>
                        
                        {/* Scene Image */}
                        {selectedScene && (
                          <div className="selected-scene-image">
                            <img
                              src={getSceneImageUrl(selectedScene)}
                              alt={getSceneDisplayTitle(selectedScene)}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <div className="duration-badge">
                              {formatDuration(selectedScene.duration)}
                            </div>
                          </div>
                        )}
                        
                        {/* Scene Metadata Card */}
                        {selectedScene && (
                          <div className="scene-metadata-card">
                            <div className="scene-meta">
                              {selectedScene.date && (
                                <div className="meta-item">
                                  <span className="meta-icon">📅</span>
                                  <span>{formatDate(selectedScene.date)}</span>
                                </div>
                              )}
                              
                              {selectedScene.studio && (
                                <div className="meta-item">
                                  <span className="meta-icon">🏢</span>
                                  <span>
                                    {typeof selectedScene.studio === 'string' 
                                      ? selectedScene.studio 
                                      : selectedScene.studio.name || selectedScene.studio
                                    }
                                  </span>
                                </div>
                              )}
                              
                              {selectedScene.performers && selectedScene.performers.length > 0 && (
                                <div className="meta-item">
                                  <span className="meta-icon">👤</span>
                                  <span>
                                    {selectedScene.performers.map(p => {
                                      if (typeof p === 'string') return p;
                                      // Handle the nested structure: p.performer.name
                                      return p.performer?.name || p.name || `Performer ${p.performerId || p.id}` || 'Unknown Performer';
                                    }).join(', ')}
                                  </span>
                                </div>
                              )}
                              
                              {selectedScene.rating && (
                                <div className="meta-item">
                                  <span className="meta-icon">⭐</span>
                                  <span>{selectedScene.rating}/5</span>
                                </div>
                              )}
                              
                              {selectedScene.playCount > 0 && (
                                <div className="meta-item">
                                  <span className="meta-icon">▶️</span>
                                  <span>
                                    Played {selectedScene.playCount} time{selectedScene.playCount !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                              
                              {selectedScene.lastPlayedAt && (
                                <div className="meta-item">
                                  <span className="meta-icon">🕒</span>
                                  <span>
                                    Last: {formatDate(selectedScene.lastPlayedAt)}
                                  </span>
                                </div>
                              )}
                              
                              {selectedScene.tags && selectedScene.tags.length > 0 && (
                                <div className="meta-item">
                                  <span className="meta-icon">🏷️</span>
                                  <span>
                                    {selectedScene.tags.slice(0, 3).map(t => {
                                      if (typeof t === 'string') return t;
                                      // Handle nested structure similar to performers: t.tag.name
                                      return t.tag?.name || t.name || `Tag ${t.tagId || t.id}` || 'Unknown Tag';
                                    }).join(', ')}
                                    {selectedScene.tags.length > 3 && ` +${selectedScene.tags.length - 3}`}
                                  </span>
                                </div>
                              )}
                              
                              {/* Additional metadata fields */}
                              {selectedScene.duration && (
                                <div className="meta-item">
                                  <span className="meta-icon">⏱️</span>
                                  <span>{formatDuration(selectedScene.duration)}</span>
                                </div>
                              )}
                              
                              {selectedScene.details && (
                                <div className="meta-item">
                                  <span className="meta-icon">📝</span>
                                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {selectedScene.details}
                                  </span>
                                </div>
                              )}
                              
                              {selectedScene.url && (
                                <div className="meta-item">
                                  <span className="meta-icon">🔗</span>
                                  <a href={selectedScene.url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none' }}>
                                    View on External Site
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mainTab === 'library' && (
            <div className="library-tab">
              {/* Sync Section */}
              <div className="sync-section">
                <div className="sync-controls">
                  <Button 
                    onClick={handleSync} 
                    disabled={syncStatus.isRunning}
                    className={`sync-button ${syncStatus.isRunning ? 'syncing' : ''}`}
                  >
                    {syncStatus.isRunning ? '🔄 Syncing...' : '🔄 Sync Library'}
                  </Button>
                  
                  {syncStatus.lastSync && (
                    <div className="sync-info">
                      <span className="sync-time">
                        Last sync: {syncStatus.lastSync.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                {syncStatus.message && (
                  <div className={`sync-message ${syncStatus.isRunning ? 'running' : 'complete'}`}>
                    {syncStatus.message}
                  </div>
                )}
              </div>

              {/* Search and Controls */}
              <div className="controls-section">
                <div className="search-controls">
                  <input
                    type="text"
                    placeholder={`Search ${libraryTab}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="search-input"
                  />
                  <Button onClick={handleSearch} disabled={isLoading} className="search-button">
                    🔍
                  </Button>
                </div>

                {libraryTab === 'scenes' && (
                  <div className="sort-controls">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="sort-select"
                    >
                      <option value="date">Date</option>
                      <option value="title">Title</option>
                      <option value="rating">Rating</option>
                      <option value="duration">Duration</option>
                    </select>
                    
                    <Button
                      className="sort-direction-button"
                      onClick={() => setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC')}
                    >
                      {sortDirection === 'ASC' ? '↑' : '↓'}
                    </Button>
                  </div>
                )}

                {libraryTab === 'clips' && (
                  <div className="clip-controls">
                    <div className="sort-controls">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="sort-select"
                      >
                        <option value="createdAt">Date Created</option>
                        <option value="sceneTitle">Scene Title</option>
                        <option value="duration">Duration</option>
                        <option value="startTime">Start Time</option>
                        <option value="watchedAt">Watch Date</option>
                      </select>
                      
                      <Button
                        className="sort-direction-button"
                        onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                      >
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Button>
                    </div>
                    
                    <div className="watch-filter">
                      <select
                        value={watchStatusFilter}
                        onChange={(e) => setWatchStatusFilter(e.target.value)}
                        className="filter-select"
                      >
                        <option value="all">All Clips</option>
                        <option value="false">Unwatched</option>
                        <option value="true">Watched</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Library Sub-Tabs */}
              <div className="tabs-section">
                <div className="tabs">
                  {['scenes', 'performers', 'studios', 'tags', 'clips'].map((tab) => (
                    <button
                      key={tab}
                      className={`tab ${libraryTab === tab ? 'active' : ''}`}
                      onClick={() => handleLibraryTabChange(tab)}
                    >
                      {tabLabels[tab]}
                      {pagination[tab]?.total > 0 && (
                        <span className="tab-count">({pagination[tab].total})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="content-section">
                {renderContent()}
              </div>

              {/* Pagination */}
              {!isLoading && (
                <div className="pagination-section">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="pagination-button"
                  >
                    ← Previous
                  </Button>
                  
                  <span className="page-indicator">
                    Page {currentPage}
                  </span>
                  
                  <Button
                    disabled={!pagination[libraryTab]?.hasMore}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="pagination-button"
                  >
                    Next →
                  </Button>
                </div>
              )}
            </div>
          )}

          {mainTab === 'stats' && (
            <div className="stats-tab">
              <div className="stats-header">
                <h2>📊 Database Statistics</h2>
                {stats.lastUpdated && (
                  <p className="last-updated">
                    Last updated: {new Date(stats.lastUpdated).toLocaleString()}
                  </p>
                )}
              </div>

              {stats.loading ? (
                <div className="loading-stats">
                  <div className="loading-spinner"></div>
                  <p>Loading statistics...</p>
                </div>
              ) : stats.error ? (
                <div className="stats-error">
                  <div className="error-icon">❌</div>
                  <h3>Error Loading Statistics</h3>
                  <p>{stats.error}</p>
                  <Button onClick={loadStats} className="retry-button">
                    🔄 Retry
                  </Button>
                </div>
              ) : (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon">🎬</div>
                      <div className="stat-content">
                        <div className="stat-number">{stats.scenes.toLocaleString()}</div>
                        <div className="stat-label">Scenes</div>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-icon">👥</div>
                      <div className="stat-content">
                        <div className="stat-number">{stats.performers.toLocaleString()}</div>
                        <div className="stat-label">Performers</div>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-icon">🏢</div>
                      <div className="stat-content">
                        <div className="stat-number">{stats.studios.toLocaleString()}</div>
                        <div className="stat-label">Studios</div>
                      </div>
                    </div>
                  </div>

                  {/* Top Performers and Studios Lists */}
                  <div className="top-lists">
                    <div className="top-list">
                      <h3 className="top-list-title">🌟 Top 10 Performers</h3>
                      {stats.topPerformers && stats.topPerformers.length > 0 ? (
                        <div className="top-list-items">
                          {stats.topPerformers.map((performer, index) => (
                            <div key={performer.id} className="top-list-item">
                              <div className="rank">#{index + 1}</div>
                              <div className="performer-info">
                                <div className="performer-avatar-small" onClick={() => openPerformerImageModal(performer)}>
                                  {performer.image ? (
                                    <img
                                      src={performer.image}
                                      alt={performer.name}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextElementSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : (
                                    <div className="performer-placeholder-small">
                                      <span>👤</span>
                                    </div>
                                  )}
                                  {performer.image && (
                                    <div className="performer-placeholder-small" style={{display: 'none'}}>
                                      <span>👤</span>
                                    </div>
                                  )}
                                </div>
                                <div className="name">{performer.name}</div>
                              </div>
                              <div className="count">{performer.sceneCount} scenes</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-data">No performer data available</div>
                      )}
                    </div>

                    <div className="top-list">
                      <h3 className="top-list-title">🏆 Top 10 Studios</h3>
                      {stats.topStudios && stats.topStudios.length > 0 ? (
                        <div className="top-list-items">
                          {stats.topStudios.map((studio, index) => {
                            console.log('Studio data:', studio); // Debug log
                            return (
                            <div key={studio.id} className="top-list-item">
                              <div className="rank">#{index + 1}</div>
                              <div className="studio-info">
                                {studio.image ? (
                                  <div className="studio-image-small">
                                    <img
                                      src={studio.image}
                                      alt={studio.name}
                                      onLoad={(e) => {
                                        console.log('Studio image loaded successfully:', studio.image);
                                      }}
                                      onError={(e) => {
                                        console.log('Failed to load studio image:', studio.image);
                                        e.target.style.display = 'none';
                                        // Show the name when image fails
                                        e.target.closest('.studio-info').querySelector('.studio-name-fallback').style.display = 'block';
                                      }}
                                    />
                                    <div className="studio-name-fallback" style={{display: 'none'}}>
                                      {studio.name}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="name">{studio.name}</div>
                                )}
                              </div>
                              <div className="count">{studio.sceneCount} scenes</div>
                            </div>
                          )})}
                        </div>
                      ) : (
                        <div className="no-data">No studio data available</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="stats-actions">
                <Button onClick={loadStats} disabled={stats.loading} className="refresh-stats-button">
                  {stats.loading ? '⏳ Loading...' : '🔄 Refresh Statistics'}
                </Button>
              </div>
            </div>
          )}

      {/* Modal for showing Android companion app data */}
      {modal.isOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modal.action === 'play' ? '▶️ Play Scene' : '⏸️ Pause Scene'}
              </h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="scene-info">
                <h4>{getSceneDisplayTitle(modal.scene)}</h4>
                {modal.scene?.file?.duration && (
                  <p>Duration: {formatDuration(modal.scene.file.duration)}</p>
                )}
                {modal.scene?.resumeTime > 0 && (
                  <p>Resume from: {formatDuration(modal.scene.resumeTime)}</p>
                )}
              </div>
              
              <div className="data-preview">
                <h4>Data to be sent to Android companion app:</h4>
                <pre className="json-preview">
                  {JSON.stringify(modal.data, null, 2)}
                </pre>
              </div>
            </div>
            
            <div className="modal-footer">
              <Button 
                className="modal-button secondary" 
                onClick={closeModal}
              >
                Cancel
              </Button>
              <Button 
                className="modal-button primary" 
                onClick={sendToAndroidApp}
              >
                Send to Android App
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🗑️ Delete Scene</h3>
              <button className="modal-close" onClick={closeDeleteModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="scene-info">
                <h4>{getSceneDisplayTitle(deleteModal.scene)}</h4>
                <p className="warning-text">
                  ⚠️ This action cannot be undone. The scene will be removed from both 
                  our database and Stash.
                </p>
              </div>
              
              <div className="delete-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={deleteModal.deleteFile}
                    onChange={(e) => setDeleteModal(prev => ({ ...prev, deleteFile: e.target.checked }))}
                  />
                  Also delete the video file from disk
                  <span className="checkbox-warning"> (This will permanently delete the file!)</span>
                </label>
              </div>
            </div>
            
            <div className="modal-footer">
              <Button 
                className="modal-button secondary" 
                onClick={closeDeleteModal}
              >
                Cancel
              </Button>
              <Button 
                className="modal-button danger" 
                onClick={() => confirmDeleteStashScene(deleteModal.deleteFile)}
                style={{ backgroundColor: '#dc3545' }}
              >
                Delete Scene
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Performer Image Modal */}
      {performerImageModal.isOpen && performerImageModal.performer && (
        <div className="modal-overlay" onClick={closePerformerImageModal}>
          <div className="modal-content performer-image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {performerImageModal.performer.name}
              </h3>
              <button className="modal-close" onClick={closePerformerImageModal}>×</button>
            </div>
            
            <div className="performer-image-container">
              {performerImageModal.performer.image ? (
                <img
                  src={performerImageModal.performer.image}
                  alt={performerImageModal.performer.name}
                  className="full-performer-image"
                />
              ) : (
                <div className="no-image-placeholder">
                  <span>👤</span>
                  <p>No image available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slideshow Modal */}
      {slideshow.isOpen && (
        <div 
          className="slideshow-modal" 
          onKeyDown={handleSlideshowKeyDown}
          tabIndex={0}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'black',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Close button */}
          <button 
            className="slideshow-close"
            onClick={stopSlideshow}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 10001
            }}
          >
            ×
          </button>
          
          {/* Controls */}
          <div 
            className="slideshow-controls"
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '10px',
              zIndex: 10001
            }}
          >
            <button 
              onClick={prevSlide}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ← Previous
            </button>
            <span style={{ color: 'white', alignSelf: 'center' }}>
              {slideshow.currentIndex + 1} / {slideshow.images.length}
            </span>
            <button 
              onClick={nextSlide}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Next →
            </button>
            <button 
              onClick={toggleSlideshowFullscreen}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
              title={slideshow.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {slideshow.isFullscreen ? '🗗' : '🗖'}
            </button>
          </div>

          {/* Current Image */}
          {slideshow.images.length > 0 && slideshow.images[slideshow.currentIndex] && (
            <div 
              className="slideshow-image-container"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <img
                src={`${config.apiBaseUrl}/api/stash-image-proxy/${encodeURIComponent(slideshow.images[slideshow.currentIndex].path)}`}
                alt={slideshow.images[slideshow.currentIndex].title || 'Stash Image'}
                style={slideshow.isFullscreen ? {
                  maxWidth: '100vw',
                  maxHeight: '100vh',
                  width: '100%',
                  height: '100vh',
                  objectFit: 'contain'
                } : {
                  maxWidth: '100vw',
                  maxHeight: '100vh',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  console.error('Failed to load image:', slideshow.images[slideshow.currentIndex].path);
                  // Try next image if current fails to load
                  nextSlide();
                }}
              />
              
              {/* Image info overlay */}
              <div 
                className="slideshow-info"
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '15px',
                  borderRadius: '5px',
                  maxWidth: '400px'
                }}
              >
                {slideshow.images[slideshow.currentIndex].title && (
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
                    {slideshow.images[slideshow.currentIndex].title}
                  </h3>
                )}
                
                {slideshow.images[slideshow.currentIndex].gallery && (
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    📁 {slideshow.images[slideshow.currentIndex].gallery.title}
                  </p>
                )}
                
                {slideshow.images[slideshow.currentIndex].performers && slideshow.images[slideshow.currentIndex].performers.length > 0 && (
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    👥 {slideshow.images[slideshow.currentIndex].performers.map(p => p.name).join(', ')}
                  </p>
                )}
                
                {slideshow.images[slideshow.currentIndex].photographer && (
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    📸 {slideshow.images[slideshow.currentIndex].photographer}
                  </p>
                )}
                
                {slideshow.images[slideshow.currentIndex].studioObject && (
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    🏢 {slideshow.images[slideshow.currentIndex].studioObject.name}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
