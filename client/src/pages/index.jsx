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
        console.error('Error calling Express route:', error);
        setError('Error calling Express route');
      } finally {
        setLoading(false);
      }
  };  const getArtworkUrl = (media) => {
    // Web videos don't have artwork
    if (media?.type === 'webvideo') {
      return null;
    }
    
    // For comics, prioritize ComicVine artwork
    if (media?.type === 'comic' && media?.comicDetails?.coverUrl) {
      console.log('Using ComicVine artwork:', media.comicDetails.coverUrl);
      return `http://localhost:3001/api/comicvine-artwork?url=${encodeURIComponent(media.comicDetails.coverUrl)}`;
    }
    
    // For books, use OpenLibrary artwork
    if (media?.type === 'book' && media?.bookCoverUrl) {
      console.log('Using OpenLibrary artwork:', media.bookCoverUrl);
      return `http://localhost:3001/api/openlibrary-artwork?url=${encodeURIComponent(media.bookCoverUrl)}`;
    }
      // For short stories, use story cover or fallback to containing book's cover
    if (media?.type === 'shortstory') {
      if (media?.storyCoverUrl) {
        console.log('Using short story cover artwork:', media.storyCoverUrl);
        return `http://localhost:3001/api/openlibrary-artwork?url=${encodeURIComponent(media.storyCoverUrl)}`;
      } else if (media?.containedInBookDetails?.coverUrl) {
        console.log('Using containing book cover artwork for short story:', media.containedInBookDetails.coverUrl);
        return `http://localhost:3001/api/openlibrary-artwork?url=${encodeURIComponent(media.containedInBookDetails.coverUrl)}`;
      }
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
    <div className="app-container home-responsive">
      <div className="app-card home-card">
        <div className="app-content home-content">
          <div className="button-container home-button">
            <Button
              onClick={callExpressRoute}
              disabled={loading}
            >
              {loading ? 'Finding Up Next...' : 'Get Up Next'}
            </Button>
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
                    // Web videos don't have artwork, so always show fallback
                    const isWebVideo = selectedMedia.type === 'webvideo';
                    
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
                    
                    return hasAnyArtwork;
                  })() ? (
                    <img 
                      src={getArtworkUrl(selectedMedia)} 
                      alt={selectedMedia.title}
                      onLoad={(e) => {
                        console.log('Image loaded successfully');
                      }}                      onError={(e) => {
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
                          const plexUrl = `http://localhost:3001/api/artwork${selectedMedia.thumb || selectedMedia.art}`;
                          e.target.src = plexUrl;
                        } else {
                          e.target.style.display = 'none';
                        }
                      }}
                    />                  ) : (
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
                  )}{/* Episode overlay for TV shows only, comic info overlay for comics, book info overlay for books, story info overlay for short stories */}
                  {selectedMedia.type === 'comic' ? (
                    <div className="episode-overlay">
                      <span className="episode-info">
                        {selectedMedia.comicSeries} ({selectedMedia.comicYear}) #{selectedMedia.comicIssue}
                      </span>
                    </div>
                  ) : selectedMedia.type === 'book' ? (
                    <div className="episode-overlay">
                      <span className="episode-info">
                        {selectedMedia.bookAuthor ? `by ${selectedMedia.bookAuthor}` : 'Unknown Author'}{selectedMedia.bookYear ? ` (${selectedMedia.bookYear})` : ''}
                      </span>
                    </div>                  
                    ) : selectedMedia.type === 'shortstory' ? (
                    <div className="episode-overlay">
                      <span className="episode-info">
                        {selectedMedia.storyTitle ? selectedMedia.storyTitle : 'Untitled Story'}
                        {selectedMedia.storyAuthor ? `by ${selectedMedia.storyAuthor}` : 'Unknown Author'}{selectedMedia.storyYear ? ` (${selectedMedia.storyYear})` : ''}                        {selectedMedia.containedInBookDetails?.title ? ` • from "${selectedMedia.containedInBookDetails.title}"` : ''}
                      </span>
                    </div>                  ) : selectedMedia.type === 'webvideo' ? (
                    <div className="episode-overlay" style={{zIndex: 10, pointerEvents: 'auto'}}>
                      <span className="episode-info" style={{pointerEvents: 'auto'}}>
                        {selectedMedia.webUrl && (
                          <a href={selectedMedia.webUrl} target="_blank" rel="noopener noreferrer" style={{color: '#fff', textDecoration: 'underline', cursor: 'pointer', pointerEvents: 'auto', position: 'relative', zIndex: 11}}>
                            {selectedMedia.webUrl}
                          </a>
                        )}
                        {selectedMedia.webDescription && (
                          <div style={{marginTop: '4px', fontSize: '12px', opacity: '0.9'}}>
                            {selectedMedia.webDescription}
                          </div>
                        )}
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
                </div>
                
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