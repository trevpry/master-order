import React, { useState } from 'react';
import './MediaDetails.css';

const MediaDetails = ({ selectedMedia }) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const toggleDetails = () => {
    setIsDetailsOpen(!isDetailsOpen);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
  };

  return (
    <>
      {/* Hamburger Menu Button */}
      <button 
        className="hamburger-details-button" 
        onClick={toggleDetails}
        aria-label="Show media details"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Overlay and Details Panel */}
      {isDetailsOpen && (
        <>
          <div className="details-overlay" onClick={closeDetails} />
          <div className="details-panel">
            <div className="details-header">
              <h3>Media Details</h3>
              <button 
                className="close-details-button" 
                onClick={closeDetails}
                aria-label="Close details"
              >
                ×
              </button>
            </div>
              <div className="details-content">              
              <div className="media-basic-info">                <h4 className="details-title">
                  {selectedMedia.type === 'shortstory' && selectedMedia.storyUrl ? (
                    <a 
                      href={selectedMedia.storyUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="story-title-link"
                    >
                      {selectedMedia.storyTitle || selectedMedia.title}
                    </a>
                  ) : selectedMedia.type === 'shortstory' && selectedMedia.storyTitle ? 
                    selectedMedia.storyTitle : 
                    selectedMedia.type === 'comic' && selectedMedia.customTitle ? 
                    selectedMedia.customTitle : selectedMedia.title}
                </h4><div className="details-stats">
                  {/* Show different stats based on media type */}                  {selectedMedia.type === 'comic' ? (
                    <>
                      {selectedMedia.customTitle && (
                        <span className="custom-title-note">
                          Custom title for: {selectedMedia.title}
                        </span>
                      )}
                      <span className="comic-series">
                        Series: {selectedMedia.comicSeries} ({selectedMedia.comicYear})
                      </span>
                      <span className="comic-issue">
                        Issue #{selectedMedia.comicIssue}
                      </span>
                      {selectedMedia.customOrderName && (
                        <span className="custom-order-info">
                          From custom order: {selectedMedia.customOrderName}
                        </span>
                      )}
                    </>
                  ): selectedMedia.type === 'book' ? (
                    <>
                      <span className="book-author">
                        {selectedMedia.bookAuthor ? `Author: ${selectedMedia.bookAuthor}` : 'Unknown Author'}
                      </span>
                      {selectedMedia.bookYear && (
                        <span className="book-year">
                          Published: {selectedMedia.bookYear}
                        </span>
                      )}
                      {selectedMedia.bookPublisher && (
                        <span className="book-publisher">
                          Publisher: {selectedMedia.bookPublisher}
                        </span>
                      )}
                      {selectedMedia.customOrderName && (
                        <span className="custom-order-info">
                          From custom order: {selectedMedia.customOrderName}
                        </span>
                      )}
                    </>
                  ) : selectedMedia.type === 'shortstory' ? (
                    <>
                      <span className="story-title">
                        {selectedMedia.storyTitle ? `${selectedMedia.storyTitle}` : 'Unknown Title'}
                      </span>
                      <span className="story-author">
                        {selectedMedia.storyAuthor ? `Author: ${selectedMedia.storyAuthor}` : 'Unknown Author'}
                      </span>
                      {selectedMedia.storyYear && (
                        <span className="story-year">
                          Published: {selectedMedia.storyYear}
                        </span>
                      )}                      {selectedMedia.containedInBookDetails?.title && (
                        <span className="story-contained-in">
                          From book: "{selectedMedia.containedInBookDetails.title}"
                        </span>
                      )}
                      {selectedMedia.storyUrl && (
                        <span className="story-url">
                          <a href={selectedMedia.storyUrl} target="_blank" rel="noopener noreferrer">
                            Read Online
                          </a>
                        </span>
                      )}
                      {selectedMedia.customOrderName && (
                        <span className="custom-order-info">
                          From custom order: {selectedMedia.customOrderName}
                        </span>
                      )}
                    </>
                  ) : (selectedMedia.orderType === 'TV_GENERAL' || (selectedMedia.orderType === 'CUSTOM_ORDER' && selectedMedia.customOrderMediaType === 'tv')) ? (
                    <>
                      <span className="episodes-watched">
                        {selectedMedia.viewedLeafCount || 0} / {selectedMedia.leafCount || 0} episodes watched
                      </span>
                      {selectedMedia.currentSeason && selectedMedia.currentEpisode && (
                        <span className="current-position">
                          Next up: Season {selectedMedia.currentSeason}, Episode {selectedMedia.currentEpisode}
                          {selectedMedia.nextEpisodeTitle && ` - "${selectedMedia.nextEpisodeTitle}"`}
                        </span>
                      )}
                      {selectedMedia.orderType === 'CUSTOM_ORDER' && selectedMedia.customOrderName && (
                        <span className="custom-order-info">
                          From custom order: {selectedMedia.customOrderName}
                        </span>
                      )}
                    </>
                  ) : selectedMedia.orderType === 'MOVIES_GENERAL' ? (
                    <span className="movie-status">
                      {selectedMedia.viewCount && selectedMedia.viewCount > 0 ? 'Watched' : 'Unwatched'} Movie
                    </span>
                  ) : selectedMedia.orderType === 'CUSTOM_ORDER' ? (
                    <>
                      <span className="movie-status">
                        {selectedMedia.viewCount && selectedMedia.viewCount > 0 ? 'Watched' : 'Unwatched'} Movie
                      </span>
                      {selectedMedia.customOrderName && (
                        <span className="custom-order-info">
                          From custom order: {selectedMedia.customOrderName}
                        </span>
                      )}
                    </>
                  ) : null}                  
                  {/* Only show year/release date for non-comic, non-book, non-shortstory media */}
                  {selectedMedia.type !== 'comic' && selectedMedia.type !== 'book' && selectedMedia.type !== 'shortstory' && (
                    <>
                      <span className="media-year">
                        {selectedMedia.year && `Released: ${selectedMedia.year}`}
                      </span>
                      {selectedMedia.originallyAvailableAt && (
                        <span className="release-date">
                          {`Release Date: ${new Date(selectedMedia.originallyAvailableAt).toLocaleDateString()}`}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {selectedMedia.summary && (
                  <div className="details-summary">
                    <h5>Summary</h5>
                    <p>{selectedMedia.summary}</p>
                  </div>
                )}
              </div>

              {selectedMedia.otherCollections && selectedMedia.otherCollections.length > 0 && (
                <div className="details-collections">
                  <h5>Also appears in:</h5>
                  <div className="collections-list">
                    {selectedMedia.otherCollections.map((collection, index) => (
                      <div key={index} className="collection-section">
                        <details className="collection-dropdown">
                          <summary className="collection-tag">
                            {collection.title} ({collection.items?.length || 0} items)
                          </summary>
                          <div className="collection-items">
                            {collection.items && collection.items.length > 0 ? (
                              collection.items.map((item, itemIndex) => (
                                <div key={itemIndex} className="collection-item">
                                  <div className="item-info">
                                    <span className="item-title">{item.title}</span>
                                    {item.year && <span className="item-year">({item.year})</span>}
                                  </div>
                                  <div className="item-stats">
                                    {item.libraryType === 'tv' && (
                                      <span className="item-progress">
                                        {item.viewedLeafCount || 0}/{item.leafCount || 0} episodes
                                      </span>
                                    )}
                                    {item.libraryType === 'movie' && (
                                      <span className="item-type">
                                        {(item.viewCount && item.viewCount > 0) ? 'Watched' : 'Unwatched'}
                                      </span>
                                    )}
                                    {!item.libraryType && (
                                      <span className="item-type">Unknown</span>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="no-items">No items found</div>
                            )}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MediaDetails;
