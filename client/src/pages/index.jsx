import React from 'react';
import { useState } from 'react'
import Button from '../components/Button'
import MediaDetails from '../components/MediaDetails'


function Home() {
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const callExpressRoute = async () => {
      setLoading(true);
      setError('');
      setSelectedMedia(null);
      try {        const response = await fetch('http://localhost:3001/api/up_next');
        const data = await response.json();        console.log('API Response:', data);
        console.log('Order Type:', data.orderType);
        console.log('TVDB Artwork:', data.tvdbArtwork);
        console.log('Plex Thumb URL:', data.thumb);
        console.log('Generated artwork URL:', getArtworkUrl(data));
        console.log('Finale Type:', data.finaleType);
        console.log('Is Current Season Final:', data.isCurrentSeasonFinal);
        console.log('Series Status:', data.seriesStatus);
        
        if (data.message) {
          setError(data.message);
        } else {
          setSelectedMedia(data);
        }
      } catch (error) {
        console.error('Error calling Express route:', error);
        setError('Error calling Express route');
      } finally {
        setLoading(false);
      }
  };  const getArtworkUrl = (media) => {
    // For comics, prioritize ComicVine artwork
    if (media?.type === 'comic' && media?.comicDetails?.coverUrl) {
      console.log('Using ComicVine artwork:', media.comicDetails.coverUrl);
      return `http://localhost:3001/api/comicvine-artwork?url=${encodeURIComponent(media.comicDetails.coverUrl)}`;
    }
    
    // Prioritize TVDB artwork if available for TV content
    if (media?.tvdbArtwork?.url) {
      console.log('Using TVDB artwork:', media.tvdbArtwork.url);
      return `http://localhost:3001/api/tvdb-artwork?url=${encodeURIComponent(media.tvdbArtwork.url)}`;
    }
    
    // Fall back to Plex artwork
    const thumb = media?.thumb || media?.art;
    if (!thumb) return null;
    
    console.log('Using Plex artwork:', thumb);
    return `http://localhost:3001/api/artwork${thumb}`;
  };return (
    <div className="app-container">
      <div className="app-card">
        
        <div className="app-content">
          <div className="button-container">
            <Button
              onClick={callExpressRoute}
              disabled={loading}
            >
              {loading ? 'Finding Up Next...' : 'Get Up Next'}
            </Button>
          </div>
          
          {error && (
            <div className="message-box error">
              <p>{error}</p>
            </div>
          )}          {selectedMedia && (            <div className="media-result">
              <div className="media-artwork-large">
                {(selectedMedia.type === 'comic' && selectedMedia.comicDetails?.coverUrl) || 
                 selectedMedia.tvdbArtwork?.url || selectedMedia.thumb || selectedMedia.art ? (
                  <img 
                    src={getArtworkUrl(selectedMedia)} 
                    alt={selectedMedia.title}
                    onLoad={(e) => {
                      console.log('Image loaded successfully');
                    }}
                    onError={(e) => {
                      console.error('Image failed to load:', e.target.src);
                      // Handle different fallback scenarios
                      if (selectedMedia.type === 'comic') {
                        // For comics, if ComicVine artwork fails, hide the image
                        e.target.style.display = 'none';
                      } else if (selectedMedia.tvdbArtwork?.url && !e.target.src.includes('/api/artwork')) {
                        // If TVDB artwork fails, try Plex artwork as fallback
                        console.log('TVDB artwork failed, trying Plex artwork fallback');
                        const plexUrl = `http://localhost:3001/api/artwork${selectedMedia.thumb || selectedMedia.art}`;
                        e.target.src = plexUrl;
                      } else {
                        e.target.style.display = 'none';
                      }
                    }}
                  />
                ) : (
                  <div className="no-artwork-large">
                    <span>
                      {selectedMedia.type === 'comic' ? '📚' : 
                       selectedMedia.orderType === 'MOVIES_GENERAL' ? '🎬' : '📺'}
                    </span>
                  </div>
                )}                {/* Episode overlay for TV shows only, comic info overlay for comics */}
                {selectedMedia.type === 'comic' ? (
                  <div className="episode-overlay">
                    <span className="episode-info">
                      {selectedMedia.comicSeries} ({selectedMedia.comicYear}) #{selectedMedia.comicIssue}
                    </span>
                  </div>
                ) : (selectedMedia.orderType === 'TV_GENERAL' || (selectedMedia.orderType === 'CUSTOM_ORDER' && selectedMedia.customOrderMediaType === 'tv')) && selectedMedia.currentEpisode && selectedMedia.totalEpisodesInSeason ? (
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
                
                <MediaDetails selectedMedia={selectedMedia} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


export default Home;