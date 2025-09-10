import React, { useState } from 'react';
import StatItem from './shared/StatItem';
import ToggleButtonGroup from './shared/ToggleButtonGroup';

const BooksTab = ({ bookStats, formatDateWithTimezone, authorSortBy, setAuthorSortBy }) => {
  const [publisherSortBy, setPublisherSortBy] = useState('readtime');
  const [characterSortBy, setCharacterSortBy] = useState('readtime');

  return (
    <div className="tab-content">
      {bookStats ? (
        <>
          {/* Overall Book Statistics */}
          <div className="stats-card">
            <h2>📚 Book Statistics</h2>
            <div className="stats-grid">
              <StatItem 
                label="Total Books" 
                value={bookStats.totalStats?.totalBooks || 0} 
              />
              <StatItem 
                label="Completed Books" 
                value={bookStats.totalStats?.totalCompletedBooks || 0} 
              />
              <StatItem 
                label="Total Read Time" 
                value={bookStats.totalStats?.totalBookReadTimeFormatted || '0 minutes'} 
              />
              <StatItem 
                label="Total Pages Read" 
                value={`${bookStats.totalStats?.totalPagesRead || 0} pages`} 
              />
              <StatItem 
                label="Custom Orders" 
                value={bookStats.totalStats?.uniqueCustomOrders || 0} 
              />
              <StatItem 
                label="Average Read Time" 
                value={bookStats.totalStats?.totalBooks > 0 
                  ? Math.round((bookStats.totalStats?.totalBookReadTime || 0) / bookStats.totalStats.totalBooks) + ' min' 
                  : '0 min'
                } 
              />
              <StatItem 
                label="Average Pages per Book" 
                value={bookStats.totalStats?.totalBooks > 0 && bookStats.totalStats?.totalPagesRead > 0
                  ? Math.round(bookStats.totalStats.totalPagesRead / bookStats.totalStats.totalBooks) + ' pages'
                  : '0 pages'
                } 
              />
            </div>
          </div>

          {/* Author Breakdown */}
          {bookStats.totalStats?.authorBreakdown && (
            <div className="stats-card">
              <div className="breakdown-header">
                <h2>📖 Top Authors</h2>
                <ToggleButtonGroup
                  options={[
                    { value: 'readtime', label: 'By Read Time' },
                    { value: 'pages', label: 'By Pages Read' },
                    { value: 'books', label: 'By Book Count' },
                    { value: 'completed', label: 'By Completed Books' }
                  ]}
                  activeValue={authorSortBy}
                  onChange={setAuthorSortBy}
                />
              </div>
              {(() => {
                const getAuthorData = () => {
                  switch (authorSortBy) {
                    case 'readtime':
                      return bookStats.totalStats.authorBreakdown.byReadTime || [];
                    case 'pages':
                      return bookStats.totalStats.authorBreakdown.byPagesRead || [];
                    case 'books':
                      return bookStats.totalStats.authorBreakdown.byBookCount || [];
                    case 'completed':
                      return bookStats.totalStats.authorBreakdown.byCompletedBooks || [];
                    default:
                      return [];
                  }
                };
                
                const authorData = getAuthorData();
                const sortLabel = authorSortBy === 'readtime' ? 'Total Read Time' : 
                                 authorSortBy === 'pages' ? 'Pages Read' : 
                                 authorSortBy === 'books' ? 'Book Count' :
                                 authorSortBy === 'completed' ? 'Completed Books' :
                                 'Book Count';
                
                return authorData.length > 0 ? (
                  <div className="time-breakdown">
                    {authorData.map((author, index) => (
                      <div key={`book-${authorSortBy}-${index}`} className="time-period">
                        <div className="period-header">
                          <div className="actor-info">
                            <span className="actor-rank">#{index + 1}</span>
                            <h3>{author.name}</h3>
                          </div>
                          <span className="period-total">
                            {authorSortBy === 'readtime' && author.totalReadTimeFormatted}
                            {authorSortBy === 'pages' && `${author.totalPagesRead} pages`}
                            {authorSortBy === 'books' && `${author.bookCount} books`}
                            {authorSortBy === 'completed' && `${author.completedBooks} completed`}
                          </span>
                        </div>
                        <div className="period-stats">
                          {authorSortBy !== 'readtime' && (
                            <div className="period-stat">
                              <span className="stat-type">Read Time:</span>
                              <span>{author.totalReadTimeFormatted}</span>
                            </div>
                          )}
                          {authorSortBy !== 'pages' && (
                            <div className="period-stat">
                              <span className="stat-type">Pages Read:</span>
                              <span>{author.totalPagesRead}</span>
                            </div>
                          )}
                          {authorSortBy !== 'books' && (
                            <div className="period-stat">
                              <span className="stat-type">Books:</span>
                              <span>{author.bookCount}</span>
                            </div>
                          )}
                          {authorSortBy !== 'completed' && author.completedBooks && (
                            <div className="period-stat">
                              <span className="stat-type">Completed:</span>
                              <span>{author.completedBooks}</span>
                            </div>
                          )}
                          {author.averagePagesPerBook > 0 && (
                            <div className="period-stat">
                              <span className="stat-type">Avg Pages/Book:</span>
                              <span>{author.averagePagesPerBook}</span>
                            </div>
                          )}
                        </div>
                        {author.books && author.books.length > 0 && authorSortBy === 'books' && (
                          <div className="collection-shows">
                            <h4>Books Read:</h4>
                            <div className="shows-list">
                              {author.books.map((book, bookIndex) => (
                                <span key={bookIndex} className="show-tag">{book.title}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {author.completedBooks && author.completedBooksList && author.completedBooksList.length > 0 && authorSortBy === 'completed' && (
                          <div className="collection-shows">
                            <h4>Completed Books:</h4>
                            <div className="shows-list">
                              {author.completedBooksList.map((book, bookIndex) => (
                                <span key={bookIndex} className="show-tag">{book.title}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e' }}>
                    <p>No author data available</p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Completed Books */}
          {bookStats.totalStats?.completedBooks && bookStats.totalStats.completedBooks.length > 0 && (
            <div className="stats-card">
              <h2>📖 Completed Books ({bookStats.totalStats.totalCompletedBooks})</h2>
              <div className="recent-activity">
                {bookStats.totalStats.completedBooks.slice(0, 15).map((book, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-info">
                      <div className="activity-title">
                        <span className="title">{book.title}</span>
                        {book.author && book.author !== 'Unknown Author' && (
                          <span className="subtitle">by {book.author}</span>
                        )}
                      </div>
                      <div className="activity-meta">
                        <span className="media-type">BOOK</span>
                        <span className="separator">•</span>
                        <span className="completion-status">{book.percentRead}% Complete</span>
                        {book.pageCount && (
                          <>
                            <span className="separator">•</span>
                            <span className="page-count">{book.pageCount} pages</span>
                          </>
                        )}
                        {book.year && (
                          <>
                            <span className="separator">•</span>
                            <span className="year">{book.year}</span>
                          </>
                        )}
                        <span className="separator">•</span>
                        <span className="date">{formatDateWithTimezone(book.completedDate)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {bookStats.totalStats.totalCompletedBooks > 15 && (
                  <div className="activity-item">
                    <div className="activity-info">
                      <div className="activity-title">
                        <span className="subtitle">
                          ... and {bookStats.totalStats.totalCompletedBooks - 15} more completed books
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Books */}
          {bookStats.logs && bookStats.logs.length > 0 && (
            <div className="stats-card">
              <h2>Recent Books</h2>
              <div className="recent-activity">
                {bookStats.logs
                  .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                  .slice(0, 10)
                  .map((log, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-info">
                      <div className="activity-title">
                        <span className="title">{log.title}</span>
                      </div>
                      <div className="activity-meta">
                        <span className="media-type">BOOK</span>
                        <span className="separator">•</span>
                        <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                        <span className="separator">•</span>
                        <span className="date">{formatDateWithTimezone(log.startTime)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="stats-card">
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
            <h3>Loading Book Statistics...</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default BooksTab;
