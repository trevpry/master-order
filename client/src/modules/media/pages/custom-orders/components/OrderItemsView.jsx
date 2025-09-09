import React from 'react';
import Button from '../../../../../shared/components/Button';

const OrderItemsView = ({
  viewingOrderItems,
  showWatchedItems,
  setShowWatchedItems,
  getFilteredItems,
  scrollToBottom,
  isDragging,
  draggedItem,
  dragOverIndex,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  expandedItems,
  toggleItemExpansion,
  setMessage,
  setEditingItem,
  setShowMovieForm,
  setShowEpisodeForm,
  setShowBookForm,
  setShowComicForm,
  setShowShortStoryForm,
  setShowWebVideoForm,
  setMovieFormData,
  setEpisodeFormData,
  setBookFormData,
  setComicFormData,
  setShortStoryFormData,
  setWebVideoFormData,
  handleViewOrder,
  config,
  handleDeleteItem,
  getArtworkUrl
}) => {

  return (
    <>
      {/* Filter Controls */}
      <div className="filter-controls">
        <div className="filter-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showWatchedItems}
              onChange={(e) => setShowWatchedItems(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-text">
              {showWatchedItems ? 'Hide Watched Items' : 'Show Watched Items'}
            </span>
          </label>
        </div>
      </div>
      
      {!viewingOrderItems?.items || viewingOrderItems.items.length === 0 ? (
        <div className="empty-state">
          <p>No items in this custom order yet.</p>
          <p>Add some movies, TV episodes, or comics to get started!</p>
        </div>
      ) : getFilteredItems(viewingOrderItems?.items || []).length === 0 ? (
        <div className="empty-state">
          <p>No items match the current filter.</p>
          <p>{showWatchedItems ? 'All items are hidden.' : 'All unwatched items are hidden. Toggle "Show Watched Items" to see watched items.'}</p>
        </div>
      ) : (
        <>
          {/* Scroll Navigation Buttons - only show when there are more than 5 items */}
          {getFilteredItems(viewingOrderItems?.items || []).length > 5 && (
            <div className="scroll-navigation">
              <Button
                onClick={scrollToBottom}
                className="secondary"
                size="small"
              >
                ↓ Scroll to Bottom
              </Button>
            </div>
          )}
          
          <div className="items-list">
            {getFilteredItems(viewingOrderItems?.items || []).map((item, index) => (
              <div 
                key={item.id} 
                className={`item-card ${item.isWatched ? 'watched' : ''} ${
                  isDragging && draggedItem?.id === item.id ? 'dragging' : ''
                } ${
                  dragOverIndex === index ? 'drag-over' : ''
                }`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, item, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="item-main">
                  {item.mediaType !== 'reference' && (
                    <div className="item-artwork">
                      {getArtworkUrl(item, config.apiBaseUrl) ? (
                        <img 
                          src={getArtworkUrl(item, config.apiBaseUrl)} 
                          alt={item.title}
                          className="item-image"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="placeholder-artwork">
                          <span>No Image</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="item-details">
                    <div className="item-header">
                      <div className="item-title-section">
                        <h4 className="item-title">
                          {item.mediaType === 'episode' ? (
                            <>
                              <span className="series-title">{item.showTitle}</span>
                              {item.seasonNumber && item.episodeNumber && (
                                <span className="episode-info">
                                  S{String(item.seasonNumber).padStart(2, '0')}E{String(item.episodeNumber).padStart(2, '0')}
                                </span>
                              )}
                              {item.title && <span className="episode-title">{item.title}</span>}
                            </>
                          ) : item.mediaType === 'book' ? (
                            <>
                              <span className="book-title">{item.bookTitle || item.title}</span>
                              {item.bookAuthor && <span className="book-author">by {item.bookAuthor}</span>}
                            </>
                          ) : item.mediaType === 'comic' ? (
                            <>
                              <span className="comic-series">{item.comicSeries}</span>
                              {item.comicIssue && <span className="comic-issue">#{item.comicIssue}</span>}
                              {item.comicTitle && <span className="comic-title">{item.comicTitle}</span>}
                            </>
                          ) : item.mediaType === 'shortstory' ? (
                            <>
                              <span className="story-title">{item.title}</span>
                              {item.storyAuthor && <span className="story-author">by {item.storyAuthor}</span>}
                            </>
                          ) : item.mediaType === 'webvideo' ? (
                            <>
                              <span className="webvideo-title">{item.title}</span>
                              {item.webVideoDescription && (
                                <span className="webvideo-description">{item.webVideoDescription}</span>
                              )}
                            </>
                          ) : item.mediaType === 'reference' ? (
                            <>
                              <span className="reference-title">{item.referencedCustomOrder?.name || 'Referenced Order'}</span>
                              <span className="reference-info">→ Custom Order Reference</span>
                            </>
                          ) : (
                            <span className="default-title">{item.title}</span>
                          )}
                        </h4>
                        
                        <div className="item-metadata">
                          <span className={`media-type-badge ${item.mediaType}`}>
                            {item.mediaType === 'episode' ? 'TV' : 
                             item.mediaType === 'shortstory' ? 'Short Story' :
                             item.mediaType === 'webvideo' ? 'Web Video' :
                             item.mediaType}
                          </span>
                          
                          {item.year && (
                            <span className="year-badge">{item.year}</span>
                          )}
                          
                          {item.isWatched && (
                            <span className="watched-badge">✓ Watched</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="item-actions">
                        {item.mediaType === 'reference' && item.referencedCustomOrder && (
                          <Button
                            onClick={() => handleViewOrder(item.referencedCustomOrder)}
                            className="reference-link"
                            size="small"
                          >
                            View Order
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => {
                            setEditingItem(item);
                            // Set appropriate form data based on media type
                            switch (item.mediaType) {
                              case 'episode':
                                setEpisodeFormData({
                                  series: item.showTitle || '',
                                  season: item.seasonNumber || '',
                                  episode: item.episodeNumber || ''
                                });
                                setShowEpisodeForm(true);
                                break;
                              case 'movie':
                                setMovieFormData({
                                  title: item.title || '',
                                  year: item.year || ''
                                });
                                setShowMovieForm(true);
                                break;
                              case 'book':
                                setBookFormData({
                                  title: item.bookTitle || item.title || '',
                                  author: item.bookAuthor || '',
                                  year: item.bookYear || item.year || '',
                                  isbn: item.bookIsbn || '',
                                  pageCount: item.bookPageCount || ''
                                });
                                setShowBookForm(true);
                                break;
                              case 'comic':
                                setComicFormData({
                                  series: item.comicSeries || '',
                                  year: item.comicYear || item.year || '',
                                  issue: item.comicIssue || '',
                                  title: item.comicTitle || ''
                                });
                                setShowComicForm(true);
                                break;
                              case 'shortstory':
                                setShortStoryFormData({
                                  title: item.title || '',
                                  author: item.storyAuthor || '',
                                  year: item.storyYear || item.year || '',
                                  url: item.storyUrl || '',
                                  containedInBookId: item.storyContainedInBookId || '',
                                  coverUrl: item.storyCoverUrl || ''
                                });
                                setShowShortStoryForm(true);
                                break;
                              case 'webvideo':
                                setWebVideoFormData({
                                  title: item.title || '',
                                  url: item.webVideoUrl || '',
                                  description: item.webVideoDescription || ''
                                });
                                setShowWebVideoForm(true);
                                break;
                            }
                          }}
                          className="secondary"
                          size="small"
                        >
                          Edit
                        </Button>
                        
                        <Button
                          onClick={() => handleDeleteItem(item.id)}
                          className="danger"
                          size="small"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {/* Expandable content for comics */}
                    {item.mediaType === 'comic' && (
                      <div className="item-expandable">
                        {(item.comicCharacters?.length > 0 || item.comicCreators?.length > 0) && (
                          <Button
                            onClick={() => toggleItemExpansion(item.id)}
                            className="expand-toggle"
                            size="small"
                          >
                            {expandedItems.has(item.id) ? 'Hide Details' : 'Show Details'}
                          </Button>
                        )}
                        
                        {expandedItems.has(item.id) && (
                          <div className="expanded-details">
                            {item.comicCharacters?.length > 0 && (
                              <div className="detail-section">
                                <strong>Characters:</strong>
                                <div className="character-list">
                                  {item.comicCharacters.map((char, idx) => (
                                    <span key={idx} className="character-tag">
                                      {char.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {item.comicCreators?.length > 0 && (
                              <div className="detail-section">
                                <strong>Creators:</strong>
                                <div className="creator-list">
                                  {item.comicCreators.map((creator, idx) => (
                                    <span key={idx} className="creator-tag">
                                      {creator.name} ({creator.role})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Additional metadata for books */}
                    {item.mediaType === 'book' && (
                      <div className="book-metadata">
                        {item.bookIsbn && (
                          <div className="metadata-item">
                            <strong>ISBN:</strong> {item.bookIsbn}
                          </div>
                        )}
                        {item.bookPageCount && (
                          <div className="metadata-item">
                            <strong>Pages:</strong> {item.bookPageCount}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Additional metadata for short stories */}
                    {item.mediaType === 'shortstory' && (
                      <div className="shortstory-metadata">
                        {item.storyUrl && (
                          <div className="metadata-item">
                            <strong>URL:</strong> 
                            <a href={item.storyUrl} target="_blank" rel="noopener noreferrer">
                              {item.storyUrl}
                            </a>
                          </div>
                        )}
                        {item.storyContainedInBook?.title && (
                          <div className="metadata-item">
                            <strong>From Book:</strong> {item.storyContainedInBook.title}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Additional metadata for web videos */}
                    {item.mediaType === 'webvideo' && (
                      <div className="webvideo-metadata">
                        {item.webVideoUrl && (
                          <div className="metadata-item">
                            <strong>URL:</strong> 
                            <a href={item.webVideoUrl} target="_blank" rel="noopener noreferrer">
                              {item.webVideoUrl}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Scroll Navigation Buttons at bottom */}
          {getFilteredItems(viewingOrderItems?.items || []).length > 10 && (
            <div className="scroll-navigation bottom">
              <Button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="secondary"
                size="small"
              >
                ↑ Scroll to Top
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default OrderItemsView;
