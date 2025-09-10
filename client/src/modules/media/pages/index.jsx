import React from 'react';
import { useState, useEffect } from 'react'
import Button from '../../../shared/components/Button'
import MediaDetails from '../../../shared/components/MediaDetails'
import config from '../../../config'
import '../../../App.css'
import './HomeMobile.css'
import '../../../shared/components/MobileImageFix.css'
import toast, { Toaster } from 'react-hot-toast';

function MediaHome() {
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markingWatched, setMarkingWatched] = useState(false);
  const [playingOnPlex, setPlayingOnPlex] = useState(false);
  const [findingNewSeries, setFindingNewSeries] = useState(false);
  
  // Reading session state
  const [readingSession, setReadingSession] = useState(null);
  const [readingTimer, setReadingTimer] = useState(0);
  const [readingActionLoading, setReadingActionLoading] = useState('');
  const [showReadingProgressModal, setShowReadingProgressModal] = useState(false);
  const [readingProgress, setReadingProgress] = useState({
    currentPage: '',
    totalPages: '',
    readPercentage: '',
    inputType: 'page'
  });

  // Viewing session state
  const [viewingSession, setViewingSession] = useState(null);
  const [viewingTimer, setViewingTimer] = useState(0);
  const [viewingActionLoading, setViewingActionLoading] = useState('');

  // Settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Auto-load data when component mounts (prevent manual button clicking)
  useEffect(() => {
    // Check if we have recent data in localStorage to avoid unnecessary API calls
    const loadRecentData = () => {
      try {
        const storedData = localStorage.getItem('upNext_recentMedia');
        const storedTimestamp = localStorage.getItem('upNext_timestamp');
        
        if (storedData && storedTimestamp) {
          const age = Date.now() - parseInt(storedTimestamp);
          // Use cached data if it's less than 5 minutes old
          if (age < 5 * 60 * 1000) {
            const parsedData = JSON.parse(storedData);
            setSelectedMedia(parsedData);
            console.log('Loaded recent Up Next data from cache');
            return true;
          }
        }
      } catch (error) {
        console.error('Error loading cached Up Next data:', error);
      }
      return false;
    };

    // Restore reading session if it exists
    const restoreReadingSession = () => {
      try {
        const storedSession = localStorage.getItem('readingSession');
        const storedTimer = localStorage.getItem('readingSessionTimer');
        
        if (storedSession) {
          const session = JSON.parse(storedSession);
          setReadingSession(session);
          
          if (storedTimer) {
            setReadingTimer(parseInt(storedTimer));
          }
          
          console.log('Restored reading session from cache');
          return true;
        }
      } catch (error) {
        console.error('Error restoring reading session:', error);
      }
      return false;
    };

    // Restore viewing session if it exists
    const restoreViewingSession = () => {
      try {
        const storedSession = localStorage.getItem('viewingSession');
        const storedTimer = localStorage.getItem('viewingSessionTimer');
        
        if (storedSession) {
          const session = JSON.parse(storedSession);
          setViewingSession(session);
          
          if (storedTimer) {
            setViewingTimer(parseInt(storedTimer));
          }
          
          console.log('Restored viewing session from cache');
          return true;
        }
      } catch (error) {
        console.error('Error restoring viewing session:', error);
      }
      return false;
    };

    // Restore sessions first
    restoreReadingSession();
    restoreViewingSession();

    // Only auto-load if we don't already have selected media and no recent cache
    if (!selectedMedia && !loading) {
      if (!loadRecentData()) {
        callExpressRoute();
      }
    }
  }, []); // Empty dependency array = run once on mount

  // Timer effects
  useEffect(() => {
    let interval;
    if (readingSession && !readingSession.isPaused) {
      interval = setInterval(() => {
        setReadingTimer(prev => {
          const newTimer = prev + 1;
          // Save timer to localStorage
          try {
            localStorage.setItem('readingSessionTimer', newTimer.toString());
          } catch (error) {
            console.error('Error saving reading timer:', error);
          }
          return newTimer;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [readingSession]);

  useEffect(() => {
    let interval;
    if (viewingSession && !viewingSession.isPaused) {
      interval = setInterval(() => {
        setViewingTimer(prev => {
          const newTimer = prev + 1;
          // Save timer to localStorage
          try {
            localStorage.setItem('viewingSessionTimer', newTimer.toString());
          } catch (error) {
            console.error('Error saving viewing timer:', error);
          }
          return newTimer;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [viewingSession]);

  // Save reading session to localStorage whenever it changes
  useEffect(() => {
    try {
      if (readingSession) {
        localStorage.setItem('readingSession', JSON.stringify(readingSession));
      } else {
        localStorage.removeItem('readingSession');
        localStorage.removeItem('readingSessionTimer');
      }
    } catch (error) {
      console.error('Error saving reading session:', error);
    }
  }, [readingSession]);

  // Save viewing session to localStorage whenever it changes
  useEffect(() => {
    try {
      if (viewingSession) {
        localStorage.setItem('viewingSession', JSON.stringify(viewingSession));
      } else {
        localStorage.removeItem('viewingSession');
        localStorage.removeItem('viewingSessionTimer');
      }
    } catch (error) {
      console.error('Error saving viewing session:', error);
    }
  }, [viewingSession]);

  const formatReadingTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const formatViewingTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const callExpressRoute = async () => {
      setLoading(true);
      setError('');
      // Clear any existing selected media to get a fresh one
      setSelectedMedia(null);
      
      // Clear cache for manual refresh
      try {
        localStorage.removeItem('upNext_recentMedia');
        localStorage.removeItem('upNext_timestamp');
      } catch (error) {
        console.error('Error clearing Up Next cache:', error);
      }

      try {
        console.log('Mobile Debug - Making API call to:', `${config.apiBaseUrl}/api/up_next`);
        const response = await fetch(`${config.apiBaseUrl}/api/up_next`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        console.log('Order Type:', data.orderType);
        console.log('Media Type:', data.type);
        console.log('TVDB Artwork:', data.tvdbArtwork);
        console.log('Plex Thumb URL:', data.thumb);
        console.log('Generated artwork URL:', getArtworkUrl(data));
        console.log('Finale Type:', data.finaleType);
        console.log('Is Current Season Final:', data.isCurrentSeasonFinal);
        console.log('Series Status:', data.seriesStatus);

        // Debug short story specific data
        if (data.type === 'shortstory') {
          console.log('SHORT STORY DEBUG:');
          console.log('- Story Title:', data.storyTitle);
          console.log('- Story Author:', data.storyAuthor);
          console.log('- Story Cover URL:', data.storyCoverUrl);
          console.log('- Contained in Book Details:', data.containedInBookDetails);
        }

        if (data.message) {
          setError(data.message);
        } else {
          setSelectedMedia(data);
          
          // Cache the data for quick reload prevention
          try {
            localStorage.setItem('upNext_recentMedia', JSON.stringify(data));
            localStorage.setItem('upNext_timestamp', Date.now().toString());
          } catch (error) {
            console.error('Error caching Up Next data:', error);
          }
        }
      } catch (error) {
        console.error('Mobile Debug - API Error:', error);
        console.error('Mobile Debug - Config:', config);
        setError('Error calling Express route: ' + error.message);
      } finally {
        setLoading(false);
      }
  };

  const markAsWatched = async () => {
    if (!selectedMedia) {
      return;
    }

    setMarkingWatched(true);
    try {
      let response;

      // Check if this is a custom order item
      if (selectedMedia.customOrderItemId) {
        // Use the custom order endpoint
        response = await fetch(`${config.apiBaseUrl}/api/mark-custom-order-item-watched/${selectedMedia.customOrderItemId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (selectedMedia.orderType === 'TV_GENERAL' || selectedMedia.orderType === 'MOVIES_GENERAL') {
        // Use the general media endpoint for TV and Movie orders
        const mediaType = selectedMedia.type === 'episode' ? 'episode' : 'movie';
        const ratingKey = selectedMedia.episodeRatingKey || selectedMedia.ratingKey;

        if (!ratingKey) {
          setError('Unable to mark as watched: missing media identifier');
          return;
        }

        response = await fetch(`${config.apiBaseUrl}/api/mark-media-watched`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaType: mediaType,
            ratingKey: ratingKey,
            episodeRatingKey: selectedMedia.episodeRatingKey
          }),
        });
      } else {
        setError('Unable to mark as watched: unsupported order type');
        return;
      }

      if (response.ok) {
        setSelectedMedia(null);
        setError('Item marked as watched! Getting next item...');
        
        // Clear cached data since we're getting a new item
        try {
          localStorage.removeItem('upNext_recentMedia');
          localStorage.removeItem('upNext_timestamp');
        } catch (error) {
          console.error('Error clearing Up Next cache:', error);
        }
        
        // Automatically get the next item
        setTimeout(() => {
          callExpressRoute();
        }, 1000);
      } else {
        const errorData = await response.json();
        setError(`Error marking as watched: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error marking item as watched:', error);
      setError('Error marking item as watched');
    } finally {
      setMarkingWatched(false);
    }
  };

  const playOnPlex = async () => {
    if (!selectedMedia) {
      return;
    }

    // Only support TV shows and movies for now
    if (!['episode', 'movie'].includes(selectedMedia.type)) {
      setError('Plex playback is only supported for TV shows and movies');
      return;
    }

    setPlayingOnPlex(true);
    setError('');

    try {
      // Get the rating key for playback
      const ratingKey = selectedMedia.episodeRatingKey || selectedMedia.ratingKey;

      if (!ratingKey) {
        setError('Unable to play: missing media identifier');
        return;
      }

      // Send immediate webhook notification to Node-RED via backend
      try {
        console.log('Sending webhook notification with ratingKey:', ratingKey);
        const webhookResponse = await fetch(`${config.apiBaseUrl}/api/webhook/notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ratingKey: ratingKey,
            action: 'play_on_plex',
            title: selectedMedia.type === 'episode'
              ? `${selectedMedia.seriesTitle} - ${selectedMedia.episodeTitle}`
              : selectedMedia.title,
            type: selectedMedia.type,
            timestamp: new Date().toISOString()
          }),
        });

        if (webhookResponse.ok) {
          console.log('Webhook notification sent successfully');
        } else {
          console.warn('Webhook notification failed:', await webhookResponse.text());
        }
      } catch (webhookError) {
        console.warn('Failed to send webhook notification:', webhookError);
        // Don't stop the Plex playback if webhook fails
      }

      const response = await fetch(`${config.apiBaseUrl}/api/plex/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ratingKey: ratingKey
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Show success message
        const mediaTitle = selectedMedia.type === 'episode'
          ? `${selectedMedia.seriesTitle} - ${selectedMedia.episodeTitle}`
          : selectedMedia.title;

        toast.success(`🎬 Playing "${mediaTitle}" on ${data.player}`, {
          duration: 4000,
          position: 'top-right'
        });
      } else {
        let errorMessage = data.error || 'Failed to start playback';

        // Provide helpful error messages for common issues
        if (errorMessage.includes('No player specified') || errorMessage.includes('not found')) {
          errorMessage = 'No Plex player selected. Please go to Settings and select a player first.';
        } else if (errorMessage.includes('not currently available')) {
          errorMessage = 'Selected Plex player is not currently available. Try refreshing players in Settings.';
        }

        setError(errorMessage);
      }
    } catch (error) {
      console.error('Error starting playback:', error);
      setError('Error starting playback on Plex');
    } finally {
      setPlayingOnPlex(false);
    }
  };

  const startNewSeries = async () => {
    setFindingNewSeries(true);
    setError('');
    setSelectedMedia(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/start-new-series`);
      const data = await response.json();

      if (response.ok) {
        setSelectedMedia(data);
        toast.success(`🎬 Found new series: ${data.seriesTitle}`, {
          duration: 4000,
          position: 'top-right'
        });
      } else {
        setError(data.error || 'Failed to find a new series');
      }
    } catch (error) {
      console.error('Error finding new series:', error);
      setError('Error finding new series');
    } finally {
      setFindingNewSeries(false);
    }
  };

  // Reading session functions
  const startReading = async () => {
    if (!selectedMedia) return;

    setReadingActionLoading('start');
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/reading/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaType: selectedMedia.type,
          customOrderItemId: selectedMedia.customOrderItemId || selectedMedia.ratingKey,
          title: selectedMedia.title || selectedMedia.storyTitle || selectedMedia.comicSeries
        }),
      });

      if (response.ok) {
        const session = await response.json();
        setReadingSession(session);
        setReadingTimer(0);
        toast.success('📚 Started reading session!', {
          duration: 2000,
          position: 'top-right'
        });
      } else {
        const error = await response.json();
        toast.error(`Failed to start reading: ${error.error}`, {
          duration: 4000,
          position: 'top-right'
        });
      }
    } catch (error) {
      console.error('Error starting reading session:', error);
      toast.error('Error starting reading session', {
        duration: 4000,
        position: 'top-right'
      });
    } finally {
      setReadingActionLoading('');
    }
  };

  const pauseReading = async () => {
    if (!readingSession) return;

    setReadingActionLoading('pause');
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/reading/pause`, {
        method: 'POST',
      });

      if (response.ok) {
        const updatedSession = await response.json();
        setReadingSession(updatedSession);
        toast(`📚 Reading ${updatedSession.isPaused ? 'paused' : 'resumed'}!`, {
          duration: 2000,
          position: 'top-right'
        });
      }
    } catch (error) {
      console.error('Error pausing reading session:', error);
      toast.error('Error pausing reading session', {
        duration: 4000,
        position: 'top-right'
      });
    } finally {
      setReadingActionLoading('');
    }
  };

  const stopReading = () => {
    setShowReadingProgressModal(true);
  };

  const handleReadingProgressSubmit = async (e) => {
    e.preventDefault();
    stopReadingSession();
  };

  const stopReadingSession = async () => {
    if (!readingSession) return;

    setReadingActionLoading('stop');
    try {
      let progressData = {};

      console.log('🔍 Reading Progress Debug:');
      console.log('- inputType:', readingProgress.inputType);
      console.log('- currentPage:', readingProgress.currentPage);
      console.log('- totalPages:', readingProgress.totalPages);
      console.log('- readPercentage:', readingProgress.readPercentage);

      if (readingProgress.inputType === 'page' && readingProgress.currentPage) {
        progressData.currentPage = parseInt(readingProgress.currentPage);
        if (readingProgress.totalPages) {
          progressData.totalPages = parseInt(readingProgress.totalPages);
        }
      } else if (readingProgress.inputType === 'percentage' && readingProgress.readPercentage) {
        progressData.readPercentage = parseFloat(readingProgress.readPercentage);
      }

      console.log('📤 Sending progressData:', progressData);

      const response = await fetch(`${config.apiBaseUrl}/api/reading/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progressData),
      });

      if (response.ok) {
        const completedSession = await response.json();
        setReadingSession(null);
        setReadingTimer(0);
        setShowReadingProgressModal(false);
        setReadingProgress({
          currentPage: '',
          totalPages: '',
          readPercentage: '',
          inputType: 'page'
        });

        const formatTime = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;

          if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
          } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
          } else {
            return `${secs}s`;
          }
        };

        if (completedSession.deleted) {
          toast(`🗑️ Reading session discarded (less than 1 minute)`, {
            duration: 4000,
            position: 'top-right'
          });
        } else {
          let message = `📚 Reading session completed! Total time: ${formatTime(completedSession.totalTime)}`;
          toast.success(message, {
            duration: 5000,
            position: 'top-right'
          });
        }
      }
    } catch (error) {
      console.error('Error stopping reading session:', error);
      toast.error('Error stopping reading session', {
        duration: 4000,
        position: 'top-right'
      });
    } finally {
      setReadingActionLoading('');
    }
  };

  // Viewing session functions 
  const startViewing = async () => {
    if (!selectedMedia) return;

    setViewingActionLoading('start');
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/viewing/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaType: selectedMedia.type,
          customOrderItemId: selectedMedia.customOrderItemId || selectedMedia.ratingKey,
          title: selectedMedia.webTitle || selectedMedia.title,
          url: selectedMedia.webUrl
        }),
      });

      if (response.ok) {
        const session = await response.json();
        setViewingSession(session);
        setViewingTimer(0);
        toast.success('🌐 Started viewing session!', {
          duration: 2000,
          position: 'top-right'
        });
      } else {
        const error = await response.json();
        toast.error(`Failed to start viewing: ${error.error}`, {
          duration: 4000,
          position: 'top-right'
        });
      }
    } catch (error) {
      console.error('Error starting viewing session:', error);
      toast.error('Error starting viewing session', {
        duration: 4000,
        position: 'top-right'
      });
    } finally {
      setViewingActionLoading('');
    }
  };

  const pauseViewing = async () => {
    if (!viewingSession) return;

    setViewingActionLoading('pause');
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/viewing/pause`, {
        method: 'POST',
      });

      if (response.ok) {
        const updatedSession = await response.json();
        setViewingSession(updatedSession);
        toast(`🌐 Viewing ${updatedSession.isPaused ? 'paused' : 'resumed'}!`, {
          duration: 2000,
          position: 'top-right'
        });
      }
    } catch (error) {
      console.error('Error pausing viewing session:', error);
      toast.error('Error pausing viewing session', {
        duration: 4000,
        position: 'top-right'
      });
    } finally {
      setViewingActionLoading('');
    }
  };

  const stopViewing = async () => {
    if (!viewingSession) return;

    setViewingActionLoading('stop');
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/viewing/stop`, {
        method: 'POST',
      });

      if (response.ok) {
        const completedSession = await response.json();
        setViewingSession(null);
        setViewingTimer(0);

        const formatTime = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;

          if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
          } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
          } else {
            return `${secs}s`;
          }
        };

        if (completedSession.deleted) {
          toast(`🗑️ Viewing session discarded (less than 1 minute)`, {
            duration: 4000,
            position: 'top-right'
          });
        } else {
          let message = `🏁 Viewing session completed! Total time: ${formatTime(completedSession.totalTime)}`;
          toast.success(message, {
            duration: 5000,
            position: 'top-right'
          });
        }
      } else {
        const error = await response.json();
        toast.error(`Failed to stop viewing: ${error.error}`, {
          duration: 4000,
          position: 'top-right'
        });
      }
    } catch (error) {
      console.error('Error stopping viewing session:', error);
      toast.error('Error stopping viewing session', {
        duration: 4000,
        position: 'top-right'
      });
    } finally {
      setViewingActionLoading('');
    }
  };

  const getArtworkUrl = (media) => {
    // Web videos don't have artwork
    if (media?.type === 'webvideo') {
      return null;
    }

    // First priority: Check for cached artwork (works for all media types)
    if (media?.localArtworkPath) {
      const filename = media.localArtworkPath.includes('\\') || media.localArtworkPath.includes('/')
        ? media.localArtworkPath.split(/[\\\/]/).pop()
        : media.localArtworkPath;
      console.log('Using cached artwork:', filename);
      return `${config.apiBaseUrl}/api/artwork/${filename}`;
    }

    // For comics, fallback to ComicVine artwork if no cached artwork
    if (media?.type === 'comic' && media?.comicDetails?.coverUrl) {
      console.log('Using ComicVine artwork (fallback):', media.comicDetails.coverUrl);
      return `${config.apiBaseUrl}/api/comicvine-artwork?url=${encodeURIComponent(media.comicDetails.coverUrl)}`;
    }

    // For books, use OpenLibrary artwork
    if (media?.type === 'book' && media?.bookCoverUrl) {
      console.log('Using OpenLibrary artwork:', media.bookCoverUrl);
      return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.bookCoverUrl)}`;
    }
      // For short stories, use story cover or fallback to containing book's cover
    if (media?.type === 'shortstory') {
      if (media?.storyCoverUrl) {
        console.log('Using short story cover artwork:', media.storyCoverUrl);
        return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.storyCoverUrl)}`;
      } else if (media?.containedInBookDetails?.coverUrl) {
        console.log('Using containing book cover artwork for short story:', media.containedInBookDetails.coverUrl);
        return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.containedInBookDetails.coverUrl)}`;
      }
    }

    // Prioritize TVDB artwork if available for TV content
    if (media?.tvdbArtwork?.url) {
      console.log('Using TVDB artwork:', media.tvdbArtwork.url);
      return `${config.apiBaseUrl}/api/tvdb-artwork?url=${encodeURIComponent(media.tvdbArtwork.url)}`;
    }

    // Fall back to Plex artwork
    const thumb = media?.thumb || media?.art;
    if (!thumb) return null;

    // Check if thumb is already a full URL (starts with http)
    if (thumb.startsWith('http')) {
      console.log('Using full artwork URL:', thumb);
      return thumb;
    }

    // Otherwise, it's a relative path, so add the base URL
    console.log('Using Plex artwork:', thumb);
    return `${config.apiBaseUrl}/api/artwork${thumb}`;
  };

  return (
    <div className="app-container home-responsive">
      <div className="settings-icon-container">
        <button
          className="settings-cog-button"
          onClick={() => setShowSettingsModal(true)}
          title="Temporary Settings"
        >
          ⚙️
        </button>
      </div>

      <div className="app-card home-card">
        <div className="app-content home-content">

          {/* Top button row with all controls */}
          <div className="top-button-row">
            <div className="button-group">
              <Button
                onClick={callExpressRoute}
                disabled={loading}
              >
                {loading ? 'Finding Up Next...' : 'Get Up Next'}
              </Button>

              <Button
                onClick={startNewSeries}
                disabled={findingNewSeries}
                style={{ backgroundColor: '#28a745', color: '#fff' }}
                title="Find the earliest episode from a completed series in your collection that you haven't started watching yet"
              >
                {findingNewSeries ? 'Finding New Series...' : 'Start New Series'}
              </Button>
            </div>

            {selectedMedia && (
              <div className="button-group">
                {(selectedMedia.customOrderItemId || selectedMedia.orderType === 'TV_GENERAL' || selectedMedia.orderType === 'MOVIES_GENERAL') && (
                  <Button
                    onClick={markAsWatched}
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
                )}

                {['episode', 'movie'].includes(selectedMedia.type) && (
                  <Button
                    onClick={playOnPlex}
                    disabled={playingOnPlex}
                    style={{
                      backgroundColor: '#e5a00d',
                      color: '#000',
                      minWidth: '40px',
                      padding: '8px 12px'
                    }}
                    title="Play this episode/movie on your selected Plex device"
                  >
                    {playingOnPlex ? '⏳' : '🎬'}
                  </Button>
                )}

                {/* Reading controls for books, comics, and short stories */}
                {['book', 'comic', 'shortstory'].includes(selectedMedia.type) && (
                  <div className="button-group">
                    {/* Reading timer display */}
                    {readingSession && (
                      <div className="timer-display" style={{
                        backgroundColor: readingSession.isPaused ? '#f39c12' : '#27ae60'
                      }}>
                        {formatReadingTime(readingTimer)}
                        {readingSession.isPaused && ' (Paused)'}
                      </div>
                    )}

                    {/* Start/Stop button */}
                    {!readingSession ? (
                      <Button
                        onClick={startReading}
                        disabled={readingActionLoading === 'start'}
                        style={{
                          backgroundColor: '#27ae60',
                          color: '#fff',
                          minWidth: '40px',
                          padding: '8px 12px'
                        }}
                        title="Start reading session"
                      >
                        {readingActionLoading === 'start' ? '⏳' : '▶️'}
                      </Button>
                    ) : (
                      <>
                        {/* Pause/Resume button */}
                        <Button
                          onClick={pauseReading}
                          disabled={readingActionLoading === 'pause'}
                          style={{
                            backgroundColor: readingSession.isPaused ? '#27ae60' : '#f39c12',
                            color: '#fff',
                            minWidth: '40px',
                            padding: '8px 12px'
                          }}
                          title={readingSession.isPaused ? "Resume reading session" : "Pause reading session"}
                        >
                          {readingActionLoading === 'pause' ? '⏳' : (readingSession.isPaused ? '▶️' : '⏸️')}
                        </Button>

                        {/* Stop button */}
                        <Button
                          onClick={stopReading}
                          disabled={readingActionLoading === 'stop'}
                          style={{
                            backgroundColor: '#e74c3c',
                            color: '#fff',
                            minWidth: '40px',
                            padding: '8px 12px'
                          }}
                          title="Stop reading session"
                        >
                          {readingActionLoading === 'stop' ? '⏳' : '⏹️'}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Viewing controls for web videos */}
                {selectedMedia.type === 'webvideo' && (
                  <div className="button-group">
                    {/* Viewing timer display */}
                    {viewingSession && (
                      <div className="timer-display" style={{
                        backgroundColor: viewingSession.isPaused ? '#f39c12' : '#17a2b8'
                      }}>
                        {formatViewingTime(viewingTimer)}
                        {viewingSession.isPaused && ' (Paused)'}
                      </div>
                    )}

                    {/* Start/Stop button */}
                    {!viewingSession ? (
                      <Button
                        onClick={startViewing}
                        disabled={viewingActionLoading === 'start'}
                        style={{
                          backgroundColor: '#17a2b8',
                          color: '#fff',
                          minWidth: '40px',
                          padding: '8px 12px'
                        }}
                        title="Start viewing session"
                      >
                        {viewingActionLoading === 'start' ? '⏳' : '▶️'}
                      </Button>
                    ) : (
                      <>
                        {/* Pause/Resume button */}
                        <Button
                          onClick={pauseViewing}
                          disabled={viewingActionLoading === 'pause'}
                          style={{
                            backgroundColor: viewingSession.isPaused ? '#17a2b8' : '#f39c12',
                            color: '#fff',
                            minWidth: '40px',
                            padding: '8px 12px'
                          }}
                          title={viewingSession.isPaused ? "Resume viewing session" : "Pause viewing session"}
                        >
                          {viewingActionLoading === 'pause' ? '⏳' : (viewingSession.isPaused ? '▶️' : '⏸️')}
                        </Button>

                        {/* Stop button */}
                        <Button
                          onClick={stopViewing}
                          disabled={viewingActionLoading === 'stop'}
                          style={{
                            backgroundColor: '#e74c3c',
                            color: '#fff',
                            minWidth: '40px',
                            padding: '8px 12px'
                          }}
                          title="Stop viewing session"
                        >
                          {viewingActionLoading === 'stop' ? '⏳' : '⏹️'}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="message-box error compact">
              <p>{error}</p>
            </div>
          )}

          {selectedMedia && (
            <div className="media-result home-result">
              <div className="media-display-container">
                <div className="media-artwork-responsive">
                  {(() => {
                    // Check if we have any artwork to display - handle empty strings as falsy
                    const hasComicArt = selectedMedia.type === 'comic' && selectedMedia.comicDetails?.coverUrl;
                    const hasBookArt = selectedMedia.type === 'book' && selectedMedia.bookCoverUrl;
                    const hasStoryArt = selectedMedia.type === 'shortstory' &&
                      (selectedMedia.storyCoverUrl && selectedMedia.storyCoverUrl.trim() !== '') ||
                      (selectedMedia.containedInBookDetails?.coverUrl && selectedMedia.containedInBookDetails.coverUrl.trim() !== '');
                    const hasTvdbArt = selectedMedia.tvdbArtwork?.url;
                    const hasPlexArt = (selectedMedia.thumb && selectedMedia.thumb.trim() !== '') || (selectedMedia.art && selectedMedia.art.trim() !== '');

                    // Web videos show embedded YouTube or fallback
                    const isWebVideo = selectedMedia.type === 'webvideo';
                    const isYouTubeVideo = isWebVideo && selectedMedia.webUrl && selectedMedia.webUrl.includes('youtube.com');

                    const hasAnyArtwork = !isWebVideo && (hasComicArt || hasBookArt || hasStoryArt || hasTvdbArt || hasPlexArt);

                    // Debug logging
                    console.log('ARTWORK DEBUG:');
                    console.log('- Media type:', selectedMedia.type);
                    console.log('- storyCoverUrl:', `"${selectedMedia.storyCoverUrl}"`);
                    console.log('- containedInBookDetails:', selectedMedia.containedInBookDetails);
                    console.log('- thumb:', `"${selectedMedia.thumb}"`);
                    console.log('- art:', `"${selectedMedia.art}"`);
                    console.log('- hasComicArt:', hasComicArt);
                    console.log('- hasBookArt:', hasBookArt);
                    console.log('- hasStoryArt:', hasStoryArt);
                    console.log('- hasTvdbArt:', hasTvdbArt);
                    console.log('- hasPlexArt:', hasPlexArt);
                    console.log('- hasAnyArtwork:', hasAnyArtwork);
                    console.log('- isYouTubeVideo:', isYouTubeVideo);

                    // Show image artwork OR YouTube embedded video
                    return hasAnyArtwork || isYouTubeVideo;
                  })() ? (
                    selectedMedia.type === 'webvideo' && selectedMedia.webUrl && selectedMedia.webUrl.includes('youtube.com') ? (
                      // Render YouTube iframe with casting support
                      <iframe
                        width="100%"
                        height="100%"
                        src={(() => {
                          // Convert YouTube URL to embed URL
                          const url = selectedMedia.webUrl;
                          let videoId = '';

                          // Handle different YouTube URL formats
                          if (url.includes('watch?v=')) {
                            videoId = url.split('watch?v=')[1].split('&')[0];
                          } else if (url.includes('youtu.be/')) {
                            videoId = url.split('youtu.be/')[1].split('?')[0];
                          } else if (url.includes('embed/')) {
                            videoId = url.split('embed/')[1].split('?')[0];
                          }

                          // Add parameters for casting and fullscreen
                          return `https://www.youtube.com/embed/${videoId}?autoplay=1&fs=1&enablejsapi=1&enablecastapi=1&rel=0&modestbranding=1`;
                        })()}
                        title={selectedMedia.webTitle || selectedMedia.title || 'YouTube Video'}
                        frameBorder="0"
                        allowFullScreen
                        style={{borderRadius: '12px'}}
                      />
                    ) : (
                      // Render regular image
                      <img
                        src={getArtworkUrl(selectedMedia)}
                        alt={selectedMedia.title}
                        onLoad={(e) => {
                          console.log('Image loaded successfully:', e.target.src);
                        }}
                        onError={(e) => {
                          console.error('Image failed to load:', e.target.src);
                          console.error('Error details:', e.target.naturalWidth, e.target.naturalHeight);

                          // Handle different fallback scenarios
                          if (selectedMedia.type === 'comic') {
                            // For comics, if ComicVine artwork fails, hide the image
                            console.log('ComicVine artwork failed, hiding image');
                            e.target.style.display = 'none';

                            // Show a loading placeholder for mobile debugging
                            if (window.innerWidth <= 768) {
                              const placeholder = document.createElement('div');
                              placeholder.innerHTML = `
                                <div style="background: #333; color: #fff; padding: 20px; text-align: center; border-radius: 8px;">
                                  <p>Comic cover failed to load</p>
                                  <p style="font-size: 12px; opacity: 0.7;">${e.target.src}</p>
                                  <p style="font-size: 10px; opacity: 0.5;">Check network connection</p>
                                </div>
                              `;
                              e.target.parentNode.insertBefore(placeholder, e.target);
                            }
                          } else if (selectedMedia.type === 'book' || selectedMedia.type === 'shortstory') {
                            // For books and short stories, if artwork fails, hide the image
                            e.target.style.display = 'none';
                          } else if (selectedMedia.tvdbArtwork?.url && !e.target.src.includes('/api/artwork')) {
                            // If TVDB artwork fails, try Plex artwork as fallback
                            console.log('TVDB artwork failed, trying Plex artwork fallback');
                            const plexThumb = selectedMedia.thumb || selectedMedia.art;
                            if (plexThumb) {
                              // Check if it's already a full URL
                              if (plexThumb.startsWith('http')) {
                                e.target.src = plexThumb;
                              } else {
                                e.target.src = `${config.apiBaseUrl}/api/artwork${plexThumb}`;
                              }
                            }
                          } else {
                            e.target.style.display = 'none';
                          }
                        }}
                      />
                    )) : (
                    <div className="no-artwork-large">
                      {selectedMedia.orderType === 'CUSTOM_ORDER' && selectedMedia.customOrderIcon ? (
                        <div
                          className="custom-order-icon-large"
                          dangerouslySetInnerHTML={{__html: selectedMedia.customOrderIcon}}
                        />
                      ) : (
                        <span>
                          {selectedMedia.type === 'comic' ? '📚' :
                           selectedMedia.type === 'book' ? '📖' :
                           selectedMedia.type === 'shortstory' ? '📖' :
                           selectedMedia.type === 'webvideo' ? '🌐' :
                           selectedMedia.orderType === 'MOVIES_GENERAL' ? '🎬' : '📺'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Episode overlay for TV shows only, comic info overlay for comics, book info overlay for books, story info overlay for short stories */}
                  {selectedMedia.type === 'comic' ? (
                    <div className="episode-overlay">
                      <span className="episode-info">
                        {selectedMedia.customTitle
                          ? selectedMedia.customTitle
                          : `${selectedMedia.comicSeries} (${selectedMedia.comicYear}) #${selectedMedia.comicIssue}`
                        }
                      </span>
                    </div>
                  ) : selectedMedia.type === 'book' ? (
                    <div className="episode-overlay">
                      <span className="episode-info">
                        {selectedMedia.bookAuthor ? `by ${selectedMedia.bookAuthor}` : 'Unknown Author'}{selectedMedia.bookYear ? ` (${selectedMedia.bookYear})` : ''}
                      </span>
                    </div>
                  ) : selectedMedia.type === 'shortstory' ? (
                    <div className="episode-overlay" style={{zIndex: 10, pointerEvents: 'auto'}}>
                      <span className="episode-info" style={{pointerEvents: 'auto'}}>
                        {/* Story title - clickable if URL is available */}
                        {selectedMedia.storyUrl ? (
                          <a
                            href={selectedMedia.storyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{color: '#fff', textDecoration: 'underline', cursor: 'pointer', pointerEvents: 'auto', position: 'relative', zIndex: 11}}
                          >
                            {selectedMedia.storyTitle ? selectedMedia.storyTitle : 'Untitled Story'}
                          </a>
                        ) : (
                          selectedMedia.storyTitle ? selectedMedia.storyTitle : 'Untitled Story'
                        )}
                        {selectedMedia.storyYear ? ` (${selectedMedia.storyYear})` : ''}
                        {selectedMedia.containedInBookDetails?.title ? ` • from "${selectedMedia.containedInBookDetails.title}"` : ''}

                        {/* Author name on new line, hidden if "Unknown Author" */}
                        {selectedMedia.storyAuthor && selectedMedia.storyAuthor !== 'Unknown Author' && (
                          <div style={{marginTop: '4px', fontSize: '12px', opacity: '0.9'}}>
                            by {selectedMedia.storyAuthor}
                          </div>
                        )}
                      </span>
                    </div>
                  ) : selectedMedia.type === 'webvideo' ? (
                    // Only show overlay for non-YouTube web videos (YouTube videos are embedded above)
                    selectedMedia.webUrl && !selectedMedia.webUrl.includes('youtube.com') ? (
                      <div className="episode-overlay" style={{zIndex: 10, pointerEvents: 'auto'}}>
                        <span className="episode-info" style={{pointerEvents: 'auto'}}>
                          <a href={selectedMedia.webUrl} target="_blank" rel="noopener noreferrer" style={{color: '#fff', textDecoration: 'underline', cursor: 'pointer', pointerEvents: 'auto', position: 'relative', zIndex: 11}}>
                            {selectedMedia.webUrl}
                          </a>
                          {selectedMedia.webDescription && (
                            <div style={{marginTop: '4px', fontSize: '12px', opacity: '0.9'}}>
                              {selectedMedia.webDescription}
                            </div>
                          )}
                        </span>
                      </div>
                    ) : null
                  ) : (selectedMedia.orderType === 'TV_GENERAL' || selectedMedia.orderType === 'NEW_SERIES' || (selectedMedia.orderType === 'CUSTOM_ORDER' && selectedMedia.customOrderMediaType === 'tv')) && selectedMedia.currentEpisode && selectedMedia.totalEpisodesInSeason ? (
                    <div className="episode-overlay">
                      <span className="episode-info">
                        Episode {selectedMedia.currentEpisode} of {selectedMedia.totalEpisodesInSeason}
                      </span>
                      {/* Show Final Season badge if current season is final season of ended series */}
                      {selectedMedia.isCurrentSeasonFinal && selectedMedia.seriesStatus === 'Ended' && (
                        <div className="finale-badge final-season">
                          Final Season
                        </div>
                      )}
                      {/* Show finale type badge if not final season */}
                      {selectedMedia.finaleType && !(selectedMedia.isCurrentSeasonFinal && selectedMedia.seriesStatus === 'Ended') && (
                        <div className="finale-badge">
                          {selectedMedia.finaleType.toLowerCase().includes('series') ? 'Series Finale' :
                           selectedMedia.finaleType.toLowerCase().includes('season') ? 'Season Finale' :
                           selectedMedia.finaleType.toLowerCase().includes('mid') ? 'Mid-Season Finale' :
                           'Finale'}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <MediaDetails selectedMedia={selectedMedia} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reading Progress Modal */}
      {showReadingProgressModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Reading Progress</h3>
              <Button
                onClick={() => {
                  setShowReadingProgressModal(false);
                  setReadingProgress({
                    currentPage: '',
                    totalPages: '',
                    readPercentage: '',
                    inputType: 'page'
                  });
                }}
                className="close-modal"
              >
                ×
              </Button>
            </div>

            <form onSubmit={handleReadingProgressSubmit} className="reading-progress-form">
              <p>Track your reading progress for: <strong>{selectedMedia?.title || readingSession?.title}</strong></p>

              {/* Input Type Toggle */}
              <div className="form-group">
                <label>Progress Input Type</label>
                <div className="input-type-toggle">
                  <button
                    type="button"
                    className={readingProgress.inputType === 'page' ? 'active' : ''}
                    onClick={() => setReadingProgress(prev => ({ ...prev, inputType: 'page' }))}
                  >
                    Page Number
                  </button>
                  <button
                    type="button"
                    className={readingProgress.inputType === 'percentage' ? 'active' : ''}
                    onClick={() => setReadingProgress(prev => ({ ...prev, inputType: 'percentage' }))}
                  >
                    Percentage
                  </button>
                </div>
              </div>

              {readingProgress.inputType === 'page' ? (
                <>
                  <div className="form-group">
                    <label htmlFor="currentPage">Current Page</label>
                    <input
                      type="number"
                      id="currentPage"
                      value={readingProgress.currentPage}
                      onChange={(e) => setReadingProgress(prev => ({ ...prev, currentPage: e.target.value }))}
                      placeholder="Enter current page"
                      min="1"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="totalPages">Total Pages {readingProgress.totalPages ? '' : '(optional)'}</label>
                    <input
                      type="number"
                      id="totalPages"
                      value={readingProgress.totalPages}
                      onChange={(e) => setReadingProgress(prev => ({ ...prev, totalPages: e.target.value }))}
                      placeholder="Enter total pages"
                      min="1"
                    />
                    {!readingProgress.totalPages && (
                      <small style={{ color: '#6c757d', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                        Adding total pages helps calculate reading percentage
                      </small>
                    )}
                  </div>

                  {readingProgress.currentPage && parseInt(readingProgress.currentPage) > 0 && (
                    <div className="progress-preview">
                      {readingProgress.totalPages && parseInt(readingProgress.totalPages) > 0 ? (
                        <p>Progress: {Math.round((parseInt(readingProgress.currentPage) / parseInt(readingProgress.totalPages)) * 100)}%</p>
                      ) : (
                        <p>Current page: {readingProgress.currentPage}</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="readPercentage">Read Percentage</label>
                    <input
                      type="number"
                      id="readPercentage"
                      value={readingProgress.readPercentage}
                      onChange={(e) => setReadingProgress(prev => ({ ...prev, readPercentage: e.target.value }))}
                      placeholder="Enter percentage (0-100)"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  {readingProgress.totalPages && readingProgress.readPercentage && (
                    <div className="progress-preview">
                      <p>Approximate page: {Math.round((parseFloat(readingProgress.readPercentage) / 100) * parseInt(readingProgress.totalPages))}</p>
                    </div>
                  )}
                </>
              )}

              <div className="form-actions">
                <Button type="submit" className="primary" disabled={readingActionLoading === 'stop'}>
                  {readingActionLoading === 'stop' ? 'Saving...' : 'Save Progress & Stop Reading'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowReadingProgressModal(false);
                    stopReadingSession(); // Stop without saving progress
                  }}
                  className="secondary"
                  disabled={readingActionLoading === 'stop'}
                >
                  Skip & Stop Reading
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="settings-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>Temporary Settings</h3>
              <button
                className="settings-modal-close"
                onClick={() => setShowSettingsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="settings-modal-body">
              {/* Settings content can be added here in the future */}
            </div>

            <div className="settings-modal-footer">
              <Button
                onClick={() => setShowSettingsModal(false)}
                className="primary"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}

export default MediaHome;
