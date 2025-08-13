import React from 'react';
import { useState, useEffect } from 'react'
import Button from '../components/Button'
import MediaDetails from '../components/MediaDetails'
import io from 'socket.io-client'
import toast, { Toaster } from 'react-hot-toast'
import './MobileImageFix.css'
import config from '../config'


function Home() {  const [selectedMedia, setSelectedMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markingWatched, setMarkingWatched] = useState(false);
  const [playingOnPlex, setPlayingOnPlex] = useState(false);
  const [findingNewSeries, setFindingNewSeries] = useState(false);

  // WebSocket connection for Plex webhook notifications
  useEffect(() => {
    const socket = io(config.apiBaseUrl);

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socket.on('plexPlayback', (data) => {
      console.log('Received Plex playback notification:', data);
      
      // Create a detailed toast message
      const formatMediaInfo = (media) => {
        switch (media.type) {
          case 'episode':
            return `${media.grandparentTitle} - S${media.parentIndex}E${media.index}: ${media.title}`;
          case 'movie':
            return `${media.title}${media.year ? ` (${media.year})` : ''}`;
          case 'track':
            return `${media.artistTitle} - ${media.title}`;
          case 'album':
            return `${media.artistTitle} - ${media.title}`;
          default:
            return media.title || 'Unknown Media';
        }
      };

      const mediaInfo = formatMediaInfo(data.media);
      const message = `🎬 ${data.user} is watching ${mediaInfo} on ${data.player}`;
      
      // Show toast notification
      toast(message, {
        duration: 6000,
        position: 'top-right',
        style: {
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '8px',
          maxWidth: '400px',
        },
        icon: '▶️'
      });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  const callExpressRoute = async () => {
      setLoading(true);
      setError('');
      setSelectedMedia(null);
      try {
        console.log('Mobile Debug - Making API call to:', `${config.apiBaseUrl}/api/up_next`);
        const response = await fetch(`${config.apiBaseUrl}/api/up_next`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();        console.log('API Response:', data);
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

  const testAndroidTVNotification = async () => {
    if (!selectedMedia) {
      return;
    }

    // Only support TV shows and movies for now
    if (!['episode', 'movie'].includes(selectedMedia.type)) {
      setError('AndroidTV testing is only supported for TV shows and movies');
      return;
    }

    setPlayingOnPlex(true);
    setError('');

    try {
      // Get the rating key for playback
      const ratingKey = selectedMedia.episodeRatingKey || selectedMedia.ratingKey;
      
      if (!ratingKey) {
        setError('Unable to test: missing media identifier');
        return;
      }

      console.log('Testing AndroidTV notification approaches for ratingKey:', ratingKey);
      
      const response = await fetch(`${config.apiBaseUrl}/api/plex/test-androidtv-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ratingKey: ratingKey,
          offset: 0
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('AndroidTV test result:', result);
        
        // Show detailed results
        const successMethods = Object.entries(result.results || {})
          .filter(([method, data]) => data.success)
          .map(([method]) => method);
        
        const failedMethods = Object.entries(result.results || {})
          .filter(([method, data]) => !data.success)
          .map(([method, data]) => `${method}: ${data.error}`);
        
        let message = `AndroidTV Test for "${result.media}" completed.\n`;
        
        if (successMethods.length > 0) {
          message += `✅ Successful methods: ${successMethods.join(', ')}\n`;
        }
        
        if (failedMethods.length > 0) {
          message += `❌ Failed methods: ${failedMethods.join('; ')}\n`;
        }
        
        setError(message);
      } else {
        console.error('AndroidTV test failed:', result);
        setError(`AndroidTV test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing AndroidTV notification:', error);
      setError('Error testing AndroidTV notification');
    } finally {
      setPlayingOnPlex(false);
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

  const getArtworkUrl = (media) => {
    // Web videos don't have artwork
    if (media?.type === 'webvideo') {
      return null;
    }
    
    // For comics, prioritize ComicVine artwork
    if (media?.type === 'comic' && media?.comicDetails?.coverUrl) {
      console.log('Using ComicVine artwork:', media.comicDetails.coverUrl);
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
  };return (
    <div className="app-container home-responsive">
      <div className="app-card home-card">
        <div className="app-content home-content">          <div className="button-container home-button">
            <Button
              onClick={callExpressRoute}
              disabled={loading}
            >
              {loading ? 'Finding Up Next...' : 'Get Up Next'}
            </Button>
            
            {selectedMedia && (selectedMedia.customOrderItemId || selectedMedia.orderType === 'TV_GENERAL' || selectedMedia.orderType === 'MOVIES_GENERAL') && (
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

            {selectedMedia && ['episode', 'movie'].includes(selectedMedia.type) && (
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
          </div>
          
          {error && (
            <div className="message-box error compact">
              <p>{error}</p>
            </div>
          )}

          {selectedMedia && (
            <div className="media-result home-result">
              <div className="media-display-container">                <div className="media-artwork-responsive">                  {(() => {                    // Check if we have any artwork to display - handle empty strings as falsy
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
                  })() ? (                    selectedMedia.type === 'webvideo' && selectedMedia.webUrl && selectedMedia.webUrl.includes('youtube.com') ? (
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
                        })()}                        title={selectedMedia.webTitle || selectedMedia.title || 'YouTube Video'}
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
                          console.log('Image loaded successfully');
                        }}                        onError={(e) => {
                          console.error('Image failed to load:', e.target.src);
                          // Handle different fallback scenarios
                          if (selectedMedia.type === 'comic') {
                            // For comics, if ComicVine artwork fails, hide the image
                            e.target.style.display = 'none';
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
                      ) : (                        <span>
                          {selectedMedia.type === 'comic' ? '📚' : 
                           selectedMedia.type === 'book' ? '📖' :
                           selectedMedia.type === 'shortstory' ? '📖' :
                           selectedMedia.type === 'webvideo' ? '🌐' :
                           selectedMedia.orderType === 'MOVIES_GENERAL' ? '🎬' : '📺'}
                        </span>
                      )}
                    </div>
                  )}{/* Episode overlay for TV shows only, comic info overlay for comics, book info overlay for books, story info overlay for short stories */}                  {selectedMedia.type === 'comic' ? (
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
                    </div>                    ) : selectedMedia.type === 'shortstory' ? (
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
                    </div>) : selectedMedia.type === 'webvideo' ? (
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

          {/* Start New Series button - positioned below the media display */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Button
              onClick={startNewSeries}
              disabled={findingNewSeries}
              style={{ backgroundColor: '#28a745', color: '#fff' }}
              title="Find the earliest episode from a completed series in your collection that you haven't started watching yet"
            >
              {findingNewSeries ? 'Finding New Series...' : 'Start New Series'}
            </Button>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  )
}


export default Home;